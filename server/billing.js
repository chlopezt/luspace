import {uid} from './security.js';
import {billingConfiguration,verifyBillingSignature,validateBillingNotification,assertProviderSubscription,fictionalAccounts,assertTestPaymentMode} from './billing-security.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const sql=(db,query,...args)=>db.prepare(query).bind(...args);
const first=(db,query,...args)=>sql(db,query,...args).first();
const all=async(db,query,...args)=>(await sql(db,query,...args).all()).results;
const now=()=>new Date().toISOString();
const resource=id=>{if(!/^[a-zA-Z0-9_-]{1,128}$/.test(String(id)))fail(400,'Identificador de pago inválido.');return encodeURIComponent(id);};
const iso=value=>{if(!value||!Number.isFinite(Date.parse(value)))fail(502,'El proveedor no informó una fecha válida.');return new Date(value).toISOString();};

export function testBilling(env) {
  const configuration=billingConfiguration(env);
  // This phase deliberately has NO production checkout. Test databases must be isolated.
  return {...configuration,enabled:configuration.enabled && configuration.mode==='test'
    &&(!env.LUSPACE_BILLING_TEST_STRATEGY||env.LUSPACE_BILLING_TEST_STRATEGY==='sandbox'||fictionalAccounts(env))
    && (env.LOCAL_DEV===true || env.LUSPACE_BILLING_ISOLATED==='true')};
}
export function activeBilling(env){
  const config=billingConfiguration(env);
  return config.mode==='production'?config:testBilling(env);
}
function requireTest(env){const config=activeBilling(env);if(!config.enabled)fail(503,'Los pagos todavía no están configurados. No se realizó ningún cobro.');return config;}
const billingMode=env=>requireTest(env).mode;
const expectedApp=env=>billingMode(env)==='production'?env.MP_APPLICATION_ID:fictionalAccounts(env)?env.MP_TEST_APPLICATION_ID:undefined;
async function mp(env,path,method='GET',data,key) {
  requireTest(env);
  if(env.BILLING_READ_ONLY && method!=='GET')fail(403,'La comprobación de conexión no permite crear ni modificar cobros.');
  if(env.BILLING_REQUEST_BUDGET && --env.BILLING_REQUEST_BUDGET.remaining<0)fail(503,'La conciliación continuará en la siguiente ejecución.');
  const transport=env.LOCAL_DEV===true && env.BILLING_TEST_FETCH ? env.BILLING_TEST_FETCH : globalThis.fetch.bind(globalThis);
  let response;
  try {response=await transport('https://api.mercadopago.com'+path,{method,redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+env.MP_ACCESS_TOKEN,'Content-Type':'application/json',...(key?{'X-Idempotency-Key':key}:{})},...(data?{body:JSON.stringify(data)}:{})});}
  catch(error){
    // Never expose provider URLs, authorization headers or raw exception details.
    const detail=String(error?.message||'');
    if(/header|ByteString|character/i.test(detail))fail(503,'La clave de Mercado Pago contiene caracteres no válidos. Revisa que hayas pegado solo el Access Token, sin espacios ni saltos de línea.');
    if(/illegal invocation|receiver|this/i.test(detail))fail(502,'La conexión de pagos encontró un error de compatibilidad del servidor. No se realizó ningún cobro.');
    if(error?.name==='TimeoutError'||error?.name==='AbortError')fail(502,'Mercado Pago no respondió a tiempo. Reintenta la comprobación de conexión; no se realizó ningún cobro.');
    fail(502,'No se pudo confirmar la respuesta de Mercado Pago. Actualiza el estado antes de reintentar.');
  }
  if(response.status>=300&&response.status<400)fail(502,'Mercado Pago respondió con una redirección no autorizada. Por seguridad, no se envió la clave a otro destino.');
  if(!response.ok){
    // Static operation labels and HTTP status only: no provider body, URL, token or payer data.
    const operation=path.startsWith('/users/')?'verificación de cuenta':path.startsWith('/authorized_payments')?'consulta de cuotas':path.startsWith('/v1/payments/')?'consulta de pago':method==='GET'?'consulta de suscripción':'gestión de suscripción';
    throw Object.assign(new Error(`Mercado Pago rechazó la ${operation} (HTTP ${response.status}). No se confirmó ningún pago ni se creó otra suscripción.`),{status:502,provider_status:response.status});
  }
  try{return await response.json();}catch{fail(502,'Mercado Pago devolvió una respuesta inválida.');}
}
async function seller(env){
  const user=await mp(env,'/users/me');
  if(billingMode(env)==='production'){
    if(!Array.isArray(user.tags)||user.tags.includes('test_user')||user.site_id!=='MLC'||String(user.id)!==env.MP_SELLER_ID)
      fail(503,'La clave no corresponde al vendedor real de Chile configurado.');
    return user.id;
  }
  if(!Array.isArray(user.tags)||!user.tags.includes('test_user')||user.site_id!=='MLC'
      ||String(user.id)!==String(env.MP_TEST_SELLER_ID))
    fail(503,'Se requiere una cuenta vendedora ficticia de Chile. Los cobros reales están bloqueados.');
  return user.id;
}
function checkoutUrl(value){
  let url;try{url=new URL(value);}catch{fail(502,'Enlace de suscripción inválido.');}
  if(url.protocol!=='https:'||url.hostname!=='www.mercadopago.cl'||url.username||url.password
      ||url.pathname!=='/subscriptions/checkout')fail(502,'Enlace de suscripción no autorizado.');
  return url.href;
}
const owner=a=>{if(a.guest||a.rol!=='superadmin')fail(403,'Solo el Administrador de la familia puede gestionar la suscripción.');};

export const isTestBuyerEmail=value=>typeof value==='string'&&/^(?:testuser\d+|test_user_\d+)@testuser\.com$/i.test(value);
async function testBuyerEmail(env){
  if(env.MP_TEST_BUYER_ID){
    if(!/^\d{1,20}$/.test(env.MP_TEST_BUYER_ID)||env.MP_TEST_BUYER_ID===env.MP_TEST_SELLER_ID)fail(503,'La cuenta compradora de pruebas debe ser distinta de la vendedora.');
    const user=await mp(env,'/users/'+resource(env.MP_TEST_BUYER_ID));
    if(String(user.id)!==env.MP_TEST_BUYER_ID)fail(503,'Mercado Pago devolvió un identificador de comprador distinto.');
    if(user.site_id!=='MLC')fail(503,'Mercado Pago no confirmó que el comprador sea de Chile.');
    if(user.nickname?.toUpperCase()!==env.MP_TEST_BUYER_USERNAME?.toUpperCase())fail(503,'El nombre de usuario comprador no coincide con el registrado en la configuración de pruebas.');
    // Never invent an email from the nickname or ID. Some public user responses omit it.
    if(user.tags?.includes('test_user')&&isTestBuyerEmail(user.email))return user.email;
  }
  return isTestBuyerEmail(env.MP_TEST_BUYER_EMAIL)?env.MP_TEST_BUYER_EMAIL:null;
}

// Read-only provider check: never create contracts, charges or payment records.
export async function billingConnection(env,a){
  owner(a);
  const checked=env.LUSPACE_BILLING_MODE==='production'?{...env,LUSPACE_BILLING_LIVE_APPROVED:'true',BILLING_READ_ONLY:true}:env;
  requireTest(checked);await seller(checked);
  return {seller_verified:true,mode:billingMode(checked),buyer_configured:billingMode(checked)==='production'||!!await testBuyerEmail(checked)};
}

export async function billingStatus(env,a){
  if(a.guest)fail(403,'El invitado no tiene acceso a los pagos de la familia.');
  const config=activeBilling(env),mode=env.LUSPACE_BILLING_MODE==='production'?'production':'test';
  const subscriptions=await all(env.DB,"SELECT id,state,amount_clp,currency,paid_until,created_at,updated_at FROM billing_subscriptions WHERE familia_id=? AND environment=? ORDER BY created_at DESC LIMIT 20",a.familia_id,mode);
  const payments=await all(env.DB,"SELECT p.id,p.state,p.amount_clp,p.currency,p.period_start,p.period_end,p.created_at FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment=? ORDER BY p.created_at DESC LIMIT 50",a.familia_id,mode);
  return {enabled:config.enabled,mode:config.mode,amount:config.amount||null,can_manage:!a.guest&&a.rol==='superadmin',subscriptions,payments};
}

export async function createCheckout(env,a,consent){
  owner(a);const config=requireTest(env),sellerId=await seller(env),db=env.DB;
  // Resuming an existing checkout does not create a new contract. Its consent
  // was checked before reserving it; still require fresh consent for new ones.
  const open=await first(db,"SELECT * FROM billing_subscriptions WHERE familia_id=? AND environment=? AND state IN ('pending','authorized','paused')",a.familia_id,config.mode);
  if(open){
    if(open.state==='pending'&&open.checkout_url)return {url:checkoutUrl(open.checkout_url),existing:true};
    fail(409,open.provider_id?'Ya existe una suscripción. Actualiza su estado o cancélala antes de crear otra.':'Hay una solicitud por conciliar. No se creará otra para evitar duplicar cobros.');
  }
  if(config.mode==='production' && (consent?.accepted!==true||consent?.amount_clp!==config.amount))fail(400,'Confirma el importe y la renovación mensual antes de continuar.');
  if(config.mode==='production'){
    const job=await first(db,'SELECT last_finished_at,failures FROM billing_job_status WHERE id=1');
    if(!job?.last_finished_at||Date.now()-Date.parse(job.last_finished_at)>4*3600000||job.failures)fail(503,'La verificación automática de pagos requiere revisión. No se creó una suscripción.');
  }
  // A fixed fictional payer must be configured in preview; never send a real family email.
  const account=config.mode==='production'?await first(db,'SELECT correo FROM usuarios WHERE id=? AND familia_id=? AND activo=1',a.id,a.familia_id):null;
  const payerEmail=config.mode==='production'?account?.correo:await testBuyerEmail(env);
  if(config.mode==='production' && (typeof payerEmail!=='string'||!/^\S+@\S+\.\S+$/.test(payerEmail)||isTestBuyerEmail(payerEmail)))fail(400,'Revisa el correo de tu cuenta antes de continuar.');
  if(!payerEmail)fail(503,'Mercado Pago no publicó el correo de la cuenta de prueba. Revisa el correo dentro del perfil del comprador ficticio.');
  let back;try{back=new URL(env.MP_BILLING_BACK_URL);}catch{fail(503,'Configura la URL de retorno de pruebas.');}
  if(back.protocol!=='https:'&&!((back.hostname==='127.0.0.1'||back.hostname==='localhost')&&env.LOCAL_DEV===true))fail(503,'La URL de retorno debe ser segura.');
  if(back.search||back.hash||back.username||back.password)fail(503,'La URL de retorno no debe incluir parámetros.');
  const id=uid(),reference=uid();
  try{await sql(db,"INSERT INTO billing_subscriptions(id,familia_id,environment,external_reference,amount_clp) VALUES(?,?,?,?,?)",id,a.familia_id,config.mode,reference,config.amount).run();}
  catch(error){if(String(error.message).includes('UNIQUE'))fail(409,'Ya hay una solicitud en curso. Actualiza el estado.');throw error;}
  // Keep the reservation on timeout/error. No blind second POST after an uncertain result.
  const provider=await mp(env,'/preapproval','POST',{reason:config.mode==='production'?'LuSpace · Suscripción mensual':'LuSpace · Suscripción mensual de prueba',external_reference:reference,payer_email:payerEmail,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:config.amount,currency_id:'CLP'},back_url:back.href,status:'pending'},id);
  resource(provider.id);assertProviderSubscription({provider_id:String(provider.id),external_reference:reference,amount_clp:config.amount},provider,sellerId,expectedApp(env));
  const url=checkoutUrl(provider.init_point);
  await sql(db,"UPDATE billing_subscriptions SET provider_id=?,checkout_url=?,state=?,provider_updated_at=?,updated_at=? WHERE id=? AND familia_id=?",String(provider.id),url,provider.status,iso(provider.last_modified),now(),id,a.familia_id).run();
  return {url,existing:false};
}

export function billingPeriod(value){
  const start=new Date(iso(value)),end=new Date(start);
  const day=start.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);
  const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(day,last));return {start:start.toISOString(),end:end.toISOString()};
}
async function saveInvoice(env,record,invoice,sellerId){
  if(String(invoice.preapproval_id)!==record.provider_id || invoice.external_reference!==record.external_reference
    ||invoice.currency_id!=='CLP'||invoice.transaction_amount!==record.amount_clp)fail(400,'La cuota no corresponde a la suscripción.');
  // A scheduled invoice without a payment has not been collected yet.
  if(!invoice.payment?.id)return;
  const payment=await mp(env,'/v1/payments/'+resource(invoice.payment.id));
  if(String(payment.id)!==String(invoice.payment.id))fail(400,'El identificador del pago no coincide con la cuota consultada.');
  if(String(payment.collector_id)!==String(sellerId))fail(400,'El vendedor del pago no coincide con el vendedor verificado.');
  assertTestPaymentMode(env,payment,sellerId);
  if(payment.currency_id!=='CLP'||payment.transaction_amount!==record.amount_clp)fail(400,'La moneda o el importe del pago no coincide con la suscripción.');
  if(payment.external_reference!==record.external_reference)fail(400,'La referencia del pago no coincide con la familia de la suscripción.');
  const states={approved:'approved',rejected:'rejected',cancelled:'cancelled',refunded:'refunded',charged_back:'charged_back',pending:'pending',in_process:'pending',authorized:'pending'};
  const state=states[payment.status];if(!state)fail(400,'Estado de pago no admitido.');
  const period=billingPeriod(invoice.debit_date),updated=iso(payment.date_last_updated),db=env.DB;
  await db.batch([
    sql(db,"INSERT INTO billing_payments(id,subscription_id,provider_payment_id,state,amount_clp,currency,period_start,period_end,provider_updated_at) VALUES(?,?,?,?,?,'CLP',?,?,?) ON CONFLICT(provider_payment_id) DO UPDATE SET state=excluded.state,provider_updated_at=excluded.provider_updated_at WHERE billing_payments.subscription_id=excluded.subscription_id AND excluded.provider_updated_at>billing_payments.provider_updated_at",uid(),record.id,String(payment.id),state,record.amount_clp,period.start,period.end,updated),
    sql(db,"UPDATE billing_subscriptions SET paid_until=(SELECT MAX(period_end) FROM billing_payments WHERE subscription_id=? AND state='approved'),updated_at=? WHERE id=?",record.id,now(),record.id)
  ]);
}
async function syncRecord(env,record,sellerId){
  // Recover uncertain creation by the opaque reference, never by family email.
  if(!record.provider_id){
    const result=await mp(env,'/preapproval/search?external_reference='+encodeURIComponent(record.external_reference));
    const matches=(result.results||[]).filter(p=>p.external_reference===record.external_reference);
    if(matches.length!==1)fail(409,'La solicitud todavía no se pudo conciliar. No se creará otra automáticamente.');
    record={...record,provider_id:String(matches[0].id)};
    assertProviderSubscription(record,matches[0],sellerId,expectedApp(env));
    await sql(env.DB,'UPDATE billing_subscriptions SET provider_id=? WHERE id=?',record.provider_id,record.id).run();
  }
  const provider=await mp(env,'/preapproval/'+resource(record.provider_id));
  assertProviderSubscription(record,provider,sellerId,expectedApp(env));
  const updated=iso(provider.last_modified),url=provider.status==='pending'?checkoutUrl(provider.init_point):null;
  await sql(env.DB,'UPDATE billing_subscriptions SET state=?,checkout_url=?,provider_updated_at=?,updated_at=? WHERE id=? AND (provider_updated_at IS NULL OR provider_updated_at<=?)',provider.status,url,updated,now(),record.id,updated).run();
  // Start without pagination inputs (some test accounts reject them). For a
  // partial real history, use Limit/Offset as supported by the official SDK.
  const base='/authorized_payments/search?preapproval_id='+resource(record.provider_id);
  let invoices=await mp(env,base),offset=0,total,seen=new Set();
  do{
    if(!Array.isArray(invoices.results)||!Number.isSafeInteger(invoices.paging?.total)||invoices.paging.total<0)fail(502,'Mercado Pago no devolvió un historial de cuotas válido.');
    if(total===undefined)total=invoices.paging.total;
    if(total!==invoices.paging.total||total>240)fail(409,'El historial requiere una revisión ampliada.');
    if(offset && invoices.paging.offset!==offset)fail(502,'Mercado Pago no confirmó la página solicitada.');
    if(!invoices.results.length&&offset<total)fail(502,'Mercado Pago devolvió un historial incompleto.');
    for(const invoice of invoices.results){
      const id=String(invoice.id);
      if(seen.has(id))fail(502,'Mercado Pago devolvió cuotas duplicadas entre páginas.');
      seen.add(id);await saveInvoice(env,record,invoice,sellerId);
    }
    offset+=invoices.results.length;
    if(offset>total)fail(502,'Mercado Pago devolvió un total de cuotas inconsistente.');
    if(offset<total)invoices=await mp(env,base+'&offset='+offset+'&limit=20');
  }while(offset<total);
  await sql(env.DB,'UPDATE billing_subscriptions SET last_reconciled_at=? WHERE id=?',now(),record.id).run();
}
export async function reconcileFamily(env,a){
  owner(a);requireTest(env);const sellerId=await seller(env);
  const records=await all(env.DB,"SELECT * FROM billing_subscriptions WHERE familia_id=? AND environment=? ORDER BY created_at DESC LIMIT 20",a.familia_id,billingMode(env));
  for(const record of records)await syncRecord(env,record,sellerId);
  return billingStatus(env,a);
}
export async function cancelSubscription(env,a,id){
  owner(a);requireTest(env);const sellerId=await seller(env);
  const record=await first(env.DB,"SELECT * FROM billing_subscriptions WHERE id=? AND familia_id=? AND environment=?",id,a.familia_id,billingMode(env));
  if(!record)fail(404,'Suscripción no encontrada.');
  if(!record.provider_id)fail(409,'Primero concilia la solicitud pendiente.');
  const original=await mp(env,'/preapproval/'+resource(record.provider_id));
  assertProviderSubscription(record,original,sellerId,expectedApp(env));
  if(original.status!=='cancelled'){
    const canceled=await mp(env,'/preapproval/'+resource(record.provider_id),'PUT',{status:'cancelled'});
    assertProviderSubscription(record,canceled,sellerId,expectedApp(env));
    if(canceled.status!=='cancelled')fail(502,'Mercado Pago no confirmó la cancelación.');
  }
  await syncRecord(env,record,sellerId);
  return billingStatus(env,a);
}

export async function receiveBillingWebhook(req,env){
  // Closing new checkout must not drop signed notifications for existing payments.
  // This context only retrieves provider resources, never creates contracts.
  if(env.LUSPACE_BILLING_MODE==='production')env={...env,LUSPACE_BILLING_LIVE_APPROVED:'true',BILLING_READ_ONLY:true};
  requireTest(env);
  if(Number(req.headers.get('content-length'))>20000)fail(413,'Notificación demasiado grande.');
  if(!await verifyBillingSignature(req,env.MP_WEBHOOK_SECRET))fail(401,'Firma de notificación inválida.');
  const raw=await req.text();if(raw.length>20000)fail(413,'Notificación demasiado grande.');
  let payload;try{payload=JSON.parse(raw);}catch{fail(400,'Notificación inválida.');}
  const mode=billingMode(env),message=validateBillingNotification(req,payload,mode,env),db=env.DB;
  if(mode==='production' && payload.user_id!==undefined && String(payload.user_id)!==env.MP_SELLER_ID)fail(400,'El vendedor de la notificación no coincide.');
  const ts=req.headers.get('x-signature').split(',').find(part=>part.trim().startsWith('ts=')).trim().slice(3);
  await sql(db,"INSERT INTO billing_webhook_inbox(id,environment,topic,resource_id,request_id,signature_ts) VALUES(?,?,?,?,?,?) ON CONFLICT(environment,topic,resource_id,request_id,signature_ts) DO NOTHING",uid(),mode,message.topic,message.resourceId,message.requestId,ts).run();
  const event=await first(db,"SELECT * FROM billing_webhook_inbox WHERE environment=? AND topic=? AND resource_id=? AND request_id=? AND signature_ts=?",mode,message.topic,message.resourceId,message.requestId,ts);
  if(event.state==='processed')return {ok:true};
  const claim=await sql(db,"UPDATE billing_webhook_inbox SET state='processing',attempts=attempts+1,lease_until=? WHERE id=? AND (state IN ('queued','failed') OR lease_until<?)",new Date(Date.now()+120000).toISOString(),event.id,now()).run();
  if(!claim.meta.changes)fail(503,'Notificación en proceso; reintenta más tarde.');
  try{
    const sellerId=await seller(env);let record;
    if(message.topic==='subscription_preapproval'){
      record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment=?",message.resourceId,mode);
      // A signed notification can belong to a contract not created by LuSpace,
      // including the provider's simulator. Acknowledge without granting access.
      // Uncertain local reservations are recovered independently by the job.
      if(!record){await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL WHERE id=?",event.id).run();return {ok:true,ignored:true};}
    }
    else if(message.topic==='subscription_authorized_payment'){
      const invoice=await mp(env,'/authorized_payments/'+resource(message.resourceId));
      record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment=?",String(invoice.preapproval_id),mode);
      if(record){const subscription=await mp(env,'/preapproval/'+resource(record.provider_id));assertProviderSubscription(record,subscription,sellerId,expectedApp(env));await saveInvoice(env,record,invoice,sellerId);}
    } else {
      const invoices=await mp(env,'/authorized_payments/search?payment_id='+resource(message.resourceId));
      if(invoices.results?.length===1&&invoices.paging?.total===1){const invoice=invoices.results[0];record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment=?",String(invoice.preapproval_id),mode);}
    }
    // Unknown resources cannot grant access. Retry allows a creation transaction to finish.
    if(!record)fail(409,'La notificación todavía no corresponde a una suscripción registrada.');
    await syncRecord(env,record,sellerId);
    await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL WHERE id=?",event.id).run();
    return {ok:true};
  }catch(error){
    // A correctly signed notification for a resource the provider says does not
    // exist (e.g. its simulator) must never grant access or poison reconciliation.
    if(error.provider_status===404){await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL WHERE id=?",event.id).run();return {ok:true,ignored:true};}
    await sql(db,"UPDATE billing_webhook_inbox SET state='failed',lease_until=NULL WHERE id=?",event.id).run();throw error;
  }
}

export async function platformBillingStatus(env){
  const rows=await all(env.DB,"SELECT s.id,f.nombre AS family,s.environment,s.state,s.amount_clp,s.paid_until,s.updated_at FROM billing_subscriptions s JOIN familias f ON f.id=s.familia_id ORDER BY s.created_at DESC LIMIT 100");
  const inbox=await first(env.DB,"SELECT COUNT(*) AS pending FROM billing_webhook_inbox WHERE state!='processed'");
  const job=await first(env.DB,'SELECT last_started_at,last_finished_at,failures,processed FROM billing_job_status WHERE id=1');
  return {mode:activeBilling(env).mode,enabled:activeBilling(env).enabled,subscriptions:rows,pending_notifications:inbox.pending,job};
}

// Scheduled reconciliation only reads provider resources: never creates or cancels a contract, nor issues charges.
export async function reconcileBillingJob(req,env){
  const secret=env.LUSPACE_BILLING_JOB_KEY,ts=req.headers.get('x-luspace-job-ts'),sig=req.headers.get('x-luspace-job-signature');
  if(typeof secret!=='string'||secret.length<32||!/^\d{10}$/.test(ts||'')||!/^[a-f0-9]{64}$/.test(sig||'')||Math.abs(Date.now()-Number(ts)*1000)>300000)fail(401,'Verificación automática no autorizada.');
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(sig.match(/../g),v=>parseInt(v,16));
  if(!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode('billing-reconcile:'+ts)))fail(401,'Verificación automática no autorizada.');
  // Allow read-only readiness verification before checkout is opened. This context can never POST to the provider.
  env=env.LUSPACE_BILLING_MODE==='production'?{...env,LUSPACE_BILLING_LIVE_APPROVED:'true',BILLING_READ_ONLY:true}:env;
  requireTest(env);
  const db=env.DB,start=now();
  const claim=await sql(db,'UPDATE billing_job_status SET lease_until=?,last_started_at=? WHERE id=1 AND (lease_until IS NULL OR lease_until<?)',new Date(Date.now()+300000).toISOString(),start,start).run();
  if(!claim.meta.changes)fail(409,'La verificación automática ya está en curso.');
  let processed=0,failures=0;
  const jobEnv={...env,BILLING_REQUEST_BUDGET:{remaining:40}};
  try{
    const sellerId=await seller(jobEnv);
    const records=await all(db,"SELECT * FROM billing_subscriptions WHERE environment=? ORDER BY COALESCE(last_reconciled_at,'') ASC,created_at ASC LIMIT 4",billingMode(env));
    for(const record of records){
      try{
        await syncRecord(jobEnv,record,sellerId);processed++;
        await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL WHERE environment=? AND topic='subscription_preapproval' AND resource_id=?",billingMode(env),record.provider_id).run();
      }catch{
        failures++;
        await sql(db,'UPDATE billing_subscriptions SET last_reconciled_at=? WHERE id=?',now(),record.id).run();
      }
    }
    // Recover durable failed notifications independently of provider delivery.
    // Never mark an unknown resource processed or grant access from its payload.
    const events=await all(db,"SELECT * FROM billing_webhook_inbox WHERE environment=? AND (state IN ('queued','failed') OR (state='processing' AND lease_until<?)) ORDER BY attempts ASC,received_at ASC LIMIT 4",billingMode(env),now());
    for(const event of events){
      try{
        let record,invoice;
        if(event.topic==='subscription_preapproval')record=await first(db,'SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment=?',event.resource_id,billingMode(env));
        else{
          if(event.topic==='subscription_authorized_payment')invoice=await mp(jobEnv,'/authorized_payments/'+resource(event.resource_id));
          else{
            const result=await mp(jobEnv,'/authorized_payments/search?payment_id='+resource(event.resource_id));
            if(result.results?.length===1&&result.paging?.total===1)invoice=result.results[0];
          }
          if(invoice)record=await first(db,'SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment=?',String(invoice.preapproval_id),billingMode(env));
        }
        if(!record)fail(409,'Notificación sin suscripción asociada.');
        const provider=await mp(jobEnv,'/preapproval/'+resource(record.provider_id));
        assertProviderSubscription(record,provider,sellerId,expectedApp(env));
        if(invoice)await saveInvoice(jobEnv,record,invoice,sellerId);
        else await syncRecord(jobEnv,record,sellerId);
        await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL,attempts=attempts+1 WHERE id=? AND state!='processed'",event.id).run();
        processed++;
      }catch{
        failures++;
        await sql(db,"UPDATE billing_webhook_inbox SET state='failed',lease_until=NULL,attempts=attempts+1 WHERE id=? AND state!='processed'",event.id).run();
      }
    }
  }catch{failures++;}
  await sql(db,'UPDATE billing_job_status SET lease_until=NULL,last_finished_at=?,failures=?,processed=? WHERE id=1',now(),failures,processed).run();
  if(failures)fail(503,'La verificación automática encontró operaciones pendientes de revisar.');
  return {ok:true,processed};
}


