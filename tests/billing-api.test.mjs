import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {billingPeriod,isTestBuyerEmail} from '../server/billing.js';

test('fictional buyer email accepts legacy and current formats, never real addresses',()=>{
  for(const email of ['testuser202@testuser.com','test_user_202@testuser.com'])assert.equal(isTestBuyerEmail(email),true);
  for(const email of ['owner@gmail.com','test@testuser.com','testuser202@testuser.com.attacker.test','testuser202@testuser.com\n',''])assert.equal(isTestBuyerEmail(email),false);
});

test('monthly period clamps leap years and month-end without adding days from today',()=>{
  assert.equal(billingPeriod('2024-01-31T09:00:00Z').end,'2024-02-29T09:00:00.000Z');
  assert.equal(billingPeriod('2025-01-31T09:00:00Z').end,'2025-02-28T09:00:00.000Z');
});

test('isolated subscription flow: scope, checkout, approved payment, renewal, stale event, cancellation and refunds',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-billing-')));let cookie='',sequence=0;
  const contracts=new Map(),invoices=new Map(),payments=new Map();let unsafeSeller=false,buyerPublicOnly=false,createCount=0,providerClock=Date.now();
  const stamp=()=>new Date(providerClock+=1000).toISOString();
  Object.assign(env,{LUSPACE_BILLING_MODE:'test',MP_ACCESS_TOKEN:'FAKE',MP_WEBHOOK_SECRET:'fictitious-secret',LUSPACE_BILLING_AMOUNT_CLP:'5938',MP_TEST_SELLER_ID:'101',MP_TEST_BUYER_EMAIL:'testuser202@testuser.com',MP_BILLING_BACK_URL:'http://localhost:5173/login'});
  env.BILLING_TEST_FETCH=async(input,options={})=>{
    const url=new URL(input);let result;
    assert.equal(url.hostname,'api.mercadopago.com');
    if(url.pathname==='/users/me')result={id:101,site_id:'MLC',tags:unsafeSeller?[]:['test_user']};
    else if(url.pathname==='/users/202')result={id:202,site_id:'MLC',nickname:'TESTBUYER202',...(buyerPublicOnly?{}:{tags:['test_user'],email:'test_user_202@testuser.com'})};
    else if(url.pathname==='/preapproval'&&options.method==='POST'){
      const data=JSON.parse(options.body);assert.equal(data.payer_email,'testuser202@testuser.com');assert.equal(data.status,'pending');assert.equal(data.auto_recurring.transaction_amount,5938);
      const id='contract'+(++createCount);result={...data,id,collector_id:101,last_modified:stamp(),init_point:'https://www.mercadopago.cl/subscriptions/checkout?preapproval_id='+id};contracts.set(id,result);
    }else if(url.pathname.startsWith('/preapproval/')){
      result=contracts.get(url.pathname.split('/').pop());
      if(options.method==='PUT'){result={...result,...JSON.parse(options.body),last_modified:stamp()};contracts.set(result.id,result);}
    }else if(url.pathname==='/authorized_payments/search'){
      assert.equal(url.searchParams.has('limit'),false);assert.equal(url.searchParams.has('offset'),false);
      const list=[...invoices.values()].filter(i=>url.searchParams.has('payment_id')?String(i.payment.id)===url.searchParams.get('payment_id'):i.preapproval_id===url.searchParams.get('preapproval_id'));
      result={results:list,paging:{total:list.length}};
    }else if(url.pathname.startsWith('/authorized_payments/'))result=invoices.get(url.pathname.split('/').pop());
    else if(url.pathname.startsWith('/v1/payments/'))result=payments.get(url.pathname.split('/').pop());
    else throw new Error('Unexpected test request '+url.pathname);
    return new Response(JSON.stringify(result),{status:result?200:404,headers:{'Content-Type':'application/json'}});
  };
  async function call(path,method='GET',data,session=cookie){
    const response=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie:session,'CF-Connecting-IP':'billing-'+sequence++,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  async function webhook(id,topic='subscription_authorized_payment',signed=true,liveMode=false,userId){
    const ts=String(Math.floor(Date.now()/1000)),requestId='request-'+sequence++;
    const signature=createHmac('sha256',env.MP_WEBHOOK_SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
    const req=new Request('http://localhost:5173/api/billing/webhook?data.id='+id,{method:'POST',headers:{'Content-Type':'application/json','x-request-id':requestId,'x-signature':`ts=${ts},v1=${signed?signature:'0'.repeat(64)}`},body:JSON.stringify({type:topic,data:{id},live_mode:liveMode,...(userId?{user_id:userId}:{})})});
    const response=await handle(req,env);return {status:response.status,body:await response.json()};
  }
  function pay(contractId,id,debitDate){
    const contract=contracts.get(contractId),updated=stamp();
    invoices.set(id,{id,preapproval_id:contractId,external_reference:contract.external_reference,currency_id:'CLP',transaction_amount:5938,debit_date:debitDate,payment:{id:'pay'+id,status:'approved'}});
    payments.set('pay'+id,{id:'pay'+id,collector_id:101,live_mode:false,currency_id:'CLP',transaction_amount:5938,external_reference:contract.external_reference,status:'approved',date_last_updated:updated});
  }
  try{
    assert.equal((await call('setup','POST',{nombre:'Owner',familia:'One',correo:'owner@example.test',password:'Password!2026qa'})).status,201);
    const one=(await call('me')).body,ownerCookie=cookie;
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01T00:00:00Z' WHERE id=?").bind(one.familia_id).run();
    unsafeSeller=true;assert.equal((await call('billing/connection')).status,503);assert.equal((await call('billing/checkout','POST',{})).status,503);assert.equal(createCount,0);unsafeSeller=false;
    assert.deepEqual((await call('billing/connection')).body,{seller_verified:true,mode:'test',buyer_configured:true});
    assert.equal(createCount,0,'connection check must not create a subscription');
    assert.equal((await call('billing')).body.subscriptions.length,0);
    delete env.MP_TEST_BUYER_EMAIL;
    assert.equal((await call('billing/connection')).body.buyer_configured,false);
    env.MP_TEST_BUYER_ID='202';env.MP_TEST_BUYER_USERNAME='TESTBUYER202';
    assert.equal((await call('billing/connection')).body.buyer_configured,true,'resolve the email returned by the provider without inventing it');
    buyerPublicOnly=true;
    assert.equal((await call('billing/connection')).body.buyer_configured,false,'a public response must not invent a buyer email');
    env.MP_TEST_BUYER_EMAIL='test_user_202@testuser.com';
    assert.equal((await call('billing/connection')).body.buyer_configured,true,'allow explicit fictional-profile email when public API omits private fields');
    delete env.MP_TEST_BUYER_EMAIL;buyerPublicOnly=false;
    env.MP_TEST_BUYER_USERNAME='WRONG';assert.equal((await call('billing/connection')).status,503);
    delete env.MP_TEST_BUYER_ID;delete env.MP_TEST_BUYER_USERNAME;
    env.MP_TEST_BUYER_EMAIL='testuser202@testuser.com';
    const checkout=await call('billing/checkout','POST',{amount:1,familia_id:'other'});assert.equal(checkout.status,201);assert.ok(checkout.body.url);
    const row=(await env.DB.prepare('SELECT * FROM billing_subscriptions WHERE familia_id=?').bind(one.familia_id).all()).results[0];
    assert.equal(row.amount_clp,5938);assert.equal((await call('billing/checkout','POST',{})).body.existing,true);assert.equal(createCount,1);
    const heldContract=contracts.get(row.provider_id);contracts.delete(row.provider_id);
    const unavailable=await call('billing/refresh','POST',{});
    assert.equal(unavailable.status,502);assert.match(unavailable.body.error,/consulta de suscripción \(HTTP 404\)/);
    assert.equal((await call('billing')).body.subscriptions[0].state,'pending');
    assert.equal(createCount,1,'failed reconciliation never creates a duplicate contract');contracts.set(row.provider_id,heldContract);
    assert.equal((await call('subscription')).body.can_write,false);
    contracts.get(row.provider_id).status='authorized';contracts.get(row.provider_id).last_modified=stamp();
    assert.equal((await webhook(row.provider_id,'subscription_preapproval')).status,200);
    assert.equal((await call('subscription')).body.can_write,false,'card authorization is not a payment');
    const current=new Date();current.setUTCDate(Math.max(1,current.getUTCDate()-1));
    pay(row.provider_id,'inv1',current.toISOString());
    const firstPayment=payments.get('payinv1');
    payments.set('payinv1',{...firstPayment,live_mode:true,payer:{id:202}});
    assert.equal((await call('billing/refresh','POST',{})).status,400,'traditional sandbox still rejects production-labelled payments');
    Object.assign(env,{LUSPACE_BILLING_TEST_STRATEGY:'fictional_accounts',MP_TEST_SELLER_ID:'101',MP_TEST_BUYER_ID:'202',MP_TEST_APPLICATION_ID:'303'});
    assert.equal((await call('billing/refresh','POST',{})).status,400,'fictional mode requires matching application as well as seller');
    contracts.get(row.provider_id).application_id=303;
    payments.set('payinv1',{...firstPayment,live_mode:true,payer:{id:999}});
    assert.equal((await call('billing/refresh','POST',{})).status,400,'other buyers cannot grant access even with a matching seller');
    assert.equal((await call('billing')).body.payments.length,0);
    payments.set('payinv1',{...firstPayment,live_mode:true,payer:{id:202}});
    assert.equal((await call('billing/refresh','POST',{})).status,200);
    assert.equal((await call('billing')).body.payments.length,1);
    assert.equal((await webhook('inv1',undefined,false,true,101)).status,401);
    assert.equal((await webhook('inv1',undefined,true,true,999)).status,400);
    assert.equal((await webhook('inv1',undefined,true,true,101)).status,200);
    // Reset only this disposable fixture before exercising the original sandbox/webhook flow.
    await env.DB.prepare('DELETE FROM billing_payments WHERE subscription_id=?').bind(row.id).run();
    await env.DB.prepare('UPDATE billing_subscriptions SET paid_until=NULL WHERE id=?').bind(row.id).run();
    delete env.LUSPACE_BILLING_TEST_STRATEGY;delete env.MP_TEST_BUYER_ID;delete env.MP_TEST_APPLICATION_ID;
    payments.set('payinv1',firstPayment);
    assert.equal((await webhook('inv1',undefined,false)).status,401);assert.equal((await call('subscription')).body.can_write,false);
    assert.equal((await webhook('inv1')).status,200);assert.equal((await call('subscription')).body.can_write,true);
    assert.equal((await webhook('inv1')).status,200);assert.equal((await call('billing')).body.payments.length,1);
    const second=billingPeriod(current.toISOString()).end;pay(row.provider_id,'inv2',second);
    assert.equal((await webhook('inv2')).status,200);assert.equal((await call('billing')).body.payments.length,2);
    const oldUntil=(await call('billing')).body.subscriptions[0].paid_until;
    const old=payments.get('payinv1');payments.set('payinv1',{...old,status:'refunded',date_last_updated:'2000-01-01T00:00:00Z'});
    assert.equal((await webhook('inv1')).status,200);assert.equal((await call('billing')).body.payments.find(p=>p.id).state,'approved');payments.set('payinv1',old);
    // A different family cannot read or cancel the first family's subscription.
    assert.equal((await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v3',nombre:'Other',familia:'Two',correo:'other@example.test',password:'Password!2026qa',password_confirmation:'Password!2026qa'})).status,201);
    const twoCookie=cookie;assert.equal((await call('billing')).body.subscriptions.length,0);
    assert.equal((await call('billing/'+row.id+'/cancel','POST',{})).status,404);
    assert.equal((await call('billing/checkout','POST',{},ownerCookie)).status,409);
    cookie=ownerCookie;
    const editor=await call('users','POST',{nombre:'Editor',correo:'editor@example.test',password:'Password!2026qa',rol:'editor'});
    assert.equal(editor.status,201);
    await call('login','POST',{correo:'editor@example.test',password:'Password!2026qa'});
    assert.equal((await call('billing/connection')).status,403);
    assert.equal((await call('billing/checkout','POST',{})).status,403);assert.equal((await call('billing/refresh','POST',{})).status,403);assert.equal((await call('billing/'+row.id+'/cancel','POST',{})).status,403);
    cookie=ownerCookie;
    assert.equal((await call('billing/'+row.id+'/cancel','POST',{})).status,200);
    assert.equal((await call('billing')).body.subscriptions[0].state,'cancelled');assert.equal((await call('subscription')).body.can_write,true,'cancellation preserves paid time');
    assert.equal((await call('billing')).body.subscriptions[0].paid_until,oldUntil);
    // Refund both periods; canceled paid access ends, but records are not deleted.
    for(const id of ['inv1','inv2']){const p=payments.get('pay'+id);payments.set('pay'+id,{...p,status:'refunded',date_last_updated:stamp()});assert.equal((await webhook(id)).status,200);}
    assert.equal((await call('subscription')).body.can_write,false);
    assert.equal((await call('children')).status,200);
    assert.equal((await call('billing','GET',undefined,twoCookie)).body.payments.length,0);
    env.LUSPACE_BILLING_MODE='production';env.LUSPACE_BILLING_LIVE_APPROVED='true';
    assert.equal((await call('billing/checkout','POST',{})).status,503,'this phase never allows live charges');
  }finally{env.close();}
});

