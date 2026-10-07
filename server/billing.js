import {uid} from './security.js';
import {billingConfiguration,verifyBillingSignature,validateBillingNotification,assertProviderSubscription} from './billing-security.js';
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
    && (env.LOCAL_DEV===true || env.LUSPACE_BILLING_ISOLATED==='true')};
}
function requireTest(env){const config=testBilling(env);if(!config.enabled)fail(503,'Los pagos de prueba todavía no están configurados. No se realizó ningún cobro.');return config;}
async function mp(env,path,method='GET',data,key) {
  requireTest(env);
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
  if(!response.ok)fail(502,'Mercado Pago no confirmó la operación. No se modificó el acceso de la familia.');
  try{return await response.json();}catch{fail(502,'Mercado Pago devolvió una respuesta inválida.');}
}
async function seller(env){
  const user=await mp(env,'/users/me');
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
    if(String(user.id)!==env.MP_TEST_BUYER_ID||user.site_id!=='MLC'||!user.tags?.includes('test_user')||user.nickname!==env.MP_TEST_BUYER_USERNAME)
      fail(503,'No se pudo verificar la cuenta compradora ficticia de Chile.');
    // Never invent an email from the nickname or ID. Some public user responses omit it.
    if(isTestBuyerEmail(user.email))return user.email;
  }
  return isTestBuyerEmail(env.MP_TEST_BUYER_EMAIL)?env.MP_TEST_BUYER_EMAIL:null;
}

// Read-only provider check: never create contracts, charges or payment records.
export async function billingConnection(env,a){
  owner(a);requireTest(env);
  await seller(env);
  return {seller_verified:true,mode:'test',buyer_configured:!!await testBuyerEmail(env)};
}

export async function billingStatus(env,a){
  if(a.guest)fail(403,'El invitado no tiene acceso a los pagos de la familia.');
  const config=testBilling(env);
  const subscriptions=await all(env.DB,"SELECT id,state,amount_clp,currency,paid_until,created_at,updated_at FROM billing_subscriptions WHERE familia_id=? AND environment='test' ORDER BY created_at DESC LIMIT 20",a.familia_id);
  const payments=await all(env.DB,"SELECT p.id,p.state,p.amount_clp,p.currency,p.period_start,p.period_end,p.created_at FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment='test' ORDER BY p.created_at DESC LIMIT 50",a.familia_id);
  return {enabled:config.enabled,mode:'test',amount:config.amount||null,can_manage:!a.guest&&a.rol==='superadmin',subscriptions,payments};
}

export async function createCheckout(env,a){
  owner(a);const config=requireTest(env),sellerId=await seller(env),db=env.DB;
  // A fixed fictional payer must be configured in preview; never send a real family email.
  const payerEmail=await testBuyerEmail(env);
  if(!payerEmail)fail(503,'Mercado Pago no publicó el correo de la cuenta de prueba. Revisa el correo dentro del perfil del comprador ficticio.');
  let back;try{back=new URL(env.MP_BILLING_BACK_URL);}catch{fail(503,'Configura la URL de retorno de pruebas.');}
  if(back.protocol!=='https:'&&!((back.hostname==='127.0.0.1'||back.hostname==='localhost')&&env.LOCAL_DEV===true))fail(503,'La URL de retorno debe ser segura.');
  if(back.search||back.hash||back.username||back.password)fail(503,'La URL de retorno no debe incluir parámetros.');
  const open=await first(db,"SELECT * FROM billing_subscriptions WHERE familia_id=? AND environment='test' AND state IN ('pending','authorized','paused')",a.familia_id);
  if(open){
    if(open.state==='pending'&&open.checkout_url)return {url:checkoutUrl(open.checkout_url),existing:true};
    fail(409,open.provider_id?'Ya existe una suscripción. Actualiza su estado o cancélala antes de crear otra.':'Hay una solicitud por conciliar. No se creará otra para evitar duplicar cobros.');
  }
  const id=uid(),reference=uid();
  try{await sql(db,"INSERT INTO billing_subscriptions(id,familia_id,environment,external_reference,amount_clp) VALUES(?,?,'test',?,?)",id,a.familia_id,reference,config.amount).run();}
  catch(error){if(String(error.message).includes('UNIQUE'))fail(409,'Ya hay una solicitud en curso. Actualiza el estado.');throw error;}
  // Keep the reservation on timeout/error. No blind second POST after an uncertain result.
  const provider=await mp(env,'/preapproval','POST',{reason:'LuSpace · Suscripción mensual de prueba',external_reference:reference,payer_email:payerEmail,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:config.amount,currency_id:'CLP'},back_url:back.href,status:'pending'},id);
  resource(provider.id);assertProviderSubscription({provider_id:String(provider.id),external_reference:reference,amount_clp:config.amount},provider,sellerId);
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
  if(String(payment.id)!==String(invoice.payment.id)||String(payment.collector_id)!==String(sellerId)
     ||payment.live_mode!==false||payment.currency_id!=='CLP'||payment.transaction_amount!==record.amount_clp
     ||payment.external_reference!==record.external_reference)fail(400,'El pago no coincide con la familia, el vendedor o el importe.');
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
    assertProviderSubscription(record,matches[0],sellerId);
    await sql(env.DB,'UPDATE billing_subscriptions SET provider_id=? WHERE id=?',record.provider_id,record.id).run();
  }
  const provider=await mp(env,'/preapproval/'+resource(record.provider_id));
  assertProviderSubscription(record,provider,sellerId);
  const updated=iso(provider.last_modified),url=provider.status==='pending'?checkoutUrl(provider.init_point):null;
  await sql(env.DB,'UPDATE billing_subscriptions SET state=?,checkout_url=?,provider_updated_at=?,updated_at=? WHERE id=? AND (provider_updated_at IS NULL OR provider_updated_at<=?)',provider.status,url,updated,now(),record.id,updated).run();
  const invoices=await mp(env,'/authorized_payments/search?preapproval_id='+resource(record.provider_id)+'&limit=20&offset=0');
  // Bounded reconciliation; never silently declare a partial history complete.
  if((invoices.paging?.total||0)>20)fail(409,'Esta suscripción requiere conciliación ampliada del historial.');
  for(const invoice of invoices.results||[])await saveInvoice(env,record,invoice,sellerId);
}
export async function reconcileFamily(env,a){
  owner(a);requireTest(env);const sellerId=await seller(env);
  const records=await all(env.DB,"SELECT * FROM billing_subscriptions WHERE familia_id=? AND environment='test' ORDER BY created_at DESC LIMIT 20",a.familia_id);
  for(const record of records)await syncRecord(env,record,sellerId);
  return billingStatus(env,a);
}
export async function cancelSubscription(env,a,id){
  owner(a);requireTest(env);const sellerId=await seller(env);
  const record=await first(env.DB,"SELECT * FROM billing_subscriptions WHERE id=? AND familia_id=? AND environment='test'",id,a.familia_id);
  if(!record)fail(404,'Suscripción no encontrada.');
  if(!record.provider_id)fail(409,'Primero concilia la solicitud pendiente.');
  const original=await mp(env,'/preapproval/'+resource(record.provider_id));
  assertProviderSubscription(record,original,sellerId);
  if(original.status!=='cancelled'){
    const canceled=await mp(env,'/preapproval/'+resource(record.provider_id),'PUT',{status:'cancelled'});
    assertProviderSubscription(record,canceled,sellerId);
    if(canceled.status!=='cancelled')fail(502,'Mercado Pago no confirmó la cancelación.');
  }
  await syncRecord(env,record,sellerId);
  return billingStatus(env,a);
}

export async function receiveBillingWebhook(req,env){
  requireTest(env);
  if(Number(req.headers.get('content-length'))>20000)fail(413,'Notificación demasiado grande.');
  if(!await verifyBillingSignature(req,env.MP_WEBHOOK_SECRET))fail(401,'Firma de notificación inválida.');
  const raw=await req.text();if(raw.length>20000)fail(413,'Notificación demasiado grande.');
  let payload;try{payload=JSON.parse(raw);}catch{fail(400,'Notificación inválida.');}
  const message=validateBillingNotification(req,payload,'test'),db=env.DB;
  const ts=req.headers.get('x-signature').split(',').find(part=>part.trim().startsWith('ts=')).trim().slice(3);
  await sql(db,"INSERT INTO billing_webhook_inbox(id,environment,topic,resource_id,request_id,signature_ts) VALUES(?,'test',?,?,?,?) ON CONFLICT(environment,topic,resource_id,request_id,signature_ts) DO NOTHING",uid(),message.topic,message.resourceId,message.requestId,ts).run();
  const event=await first(db,"SELECT * FROM billing_webhook_inbox WHERE environment='test' AND topic=? AND resource_id=? AND request_id=? AND signature_ts=?",message.topic,message.resourceId,message.requestId,ts);
  if(event.state==='processed')return {ok:true};
  const claim=await sql(db,"UPDATE billing_webhook_inbox SET state='processing',attempts=attempts+1,lease_until=? WHERE id=? AND (state IN ('queued','failed') OR lease_until<?)",new Date(Date.now()+120000).toISOString(),event.id,now()).run();
  if(!claim.meta.changes)fail(503,'Notificación en proceso; reintenta más tarde.');
  try{
    const sellerId=await seller(env);let record;
    if(message.topic==='subscription_preapproval')record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment='test'",message.resourceId);
    else if(message.topic==='subscription_authorized_payment'){
      const invoice=await mp(env,'/authorized_payments/'+resource(message.resourceId));
      record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment='test'",String(invoice.preapproval_id));
      if(record){const subscription=await mp(env,'/preapproval/'+resource(record.provider_id));assertProviderSubscription(record,subscription,sellerId);await saveInvoice(env,record,invoice,sellerId);}
    } else {
      const invoices=await mp(env,'/authorized_payments/search?payment_id='+resource(message.resourceId)+'&limit=2');
      if(invoices.results?.length===1){const invoice=invoices.results[0];record=await first(db,"SELECT * FROM billing_subscriptions WHERE provider_id=? AND environment='test'",String(invoice.preapproval_id));}
    }
    // Unknown resources cannot grant access. Retry allows a creation transaction to finish.
    if(!record)fail(409,'La notificación todavía no corresponde a una suscripción registrada.');
    await syncRecord(env,record,sellerId);
    await sql(db,"UPDATE billing_webhook_inbox SET state='processed',lease_until=NULL WHERE id=?",event.id).run();
    return {ok:true};
  }catch(error){await sql(db,"UPDATE billing_webhook_inbox SET state='failed',lease_until=NULL WHERE id=?",event.id).run();throw error;}
}

export async function platformBillingStatus(env){
  const rows=await all(env.DB,"SELECT s.id,f.nombre AS family,s.environment,s.state,s.amount_clp,s.paid_until,s.updated_at FROM billing_subscriptions s JOIN familias f ON f.id=s.familia_id ORDER BY s.created_at DESC LIMIT 100");
  const inbox=await first(env.DB,"SELECT COUNT(*) AS pending FROM billing_webhook_inbox WHERE state!='processed'");
  return {mode:'test',enabled:testBilling(env).enabled,subscriptions:rows,pending_notifications:inbox.pending};
}
