import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {billingConfiguration} from '../server/billing-security.js';

test('production readiness fails closed on seller, application, origin and fictional strategy',()=>{
  const env={LUSPACE_BILLING_MODE:'production',LUSPACE_BILLING_LIVE_APPROVED:'true',MP_SELLER_ID:'101',MP_APPLICATION_ID:'303',MP_BILLING_BACK_URL:'https://luspace.cl/login',MP_ACCESS_TOKEN:'FAKE',MP_WEBHOOK_SECRET:'FAKE',LUSPACE_BILLING_AMOUNT_CLP:'5938'};
  assert.equal(billingConfiguration(env).enabled,true);
  for(const changes of [{MP_SELLER_ID:''},{MP_APPLICATION_ID:''},{MP_BILLING_BACK_URL:'https://attacker.test/login'},{LUSPACE_BILLING_TEST_STRATEGY:'fictional_accounts'},{LUSPACE_BILLING_LIVE_APPROVED:'false'}])assert.equal(billingConfiguration({...env,...changes}).enabled,false);
});

test('production semantics with mocked provider only: consent, signed webhook, scheduled recovery, refund and manual coexistence',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-live-mock-')));
  Object.assign(env,{LUSPACE_BILLING_MODE:'production',LUSPACE_BILLING_LIVE_APPROVED:'true',MP_SELLER_ID:'101',MP_APPLICATION_ID:'303',MP_BILLING_BACK_URL:'https://luspace.cl/login',MP_ACCESS_TOKEN:'FAKE',MP_WEBHOOK_SECRET:'FAKE',LUSPACE_BILLING_JOB_KEY:'fictitious-job-key-'.repeat(3),LUSPACE_BILLING_AMOUNT_CLP:'5938'});
  let cookie='',creates=0,clock=Date.now(),contract,invoice,payment,unsafeSeller=false,extendedHistory=false;
  const stamp=()=>new Date(clock+=1000).toISOString();
  env.BILLING_TEST_FETCH=async(input,options)=>{
    const url=new URL(input);let result;
    assert.equal(url.hostname,'api.mercadopago.com');
    if(url.pathname==='/users/me')result={id:101,site_id:'MLC',tags:unsafeSeller?['test_user']:[]};
    else if(url.pathname==='/preapproval'&&options.method==='POST'){
      creates++;const body=JSON.parse(options.body);
      assert.equal(body.back_url,'https://luspace.cl/login');assert.equal(body.payer_email,'owner@example.test');
      assert.equal(body.status,'pending');assert.equal(body.auto_recurring.transaction_amount,5938);
      contract={...body,id:'live-contract',application_id:303,collector_id:101,last_modified:stamp(),init_point:'https://www.mercadopago.cl/subscriptions/checkout?preapproval_id=live-contract'};result=contract;
    }else if(url.pathname==='/preapproval/live-contract'){
      if(options.method==='PUT')contract={...contract,...JSON.parse(options.body),last_modified:stamp()};
      result=contract;
    }else if(url.pathname==='/authorized_payments/search'){
      const rows=extendedHistory?[...Array.from({length:20},(_,i)=>({...invoice,id:'scheduled-'+i,payment:null})),invoice]:invoice?[invoice]:[];
      const offset=Number(url.searchParams.get('offset')||0);
      result={results:rows.slice(offset,offset+20),paging:{total:rows.length,offset}};
    }
    else if(url.pathname==='/authorized_payments/invoice1')result=invoice;
    else if(url.pathname==='/v1/payments/pay1')result=payment;
    else throw new Error('Unexpected fixture path');
    return new Response(JSON.stringify(result),{status:result?200:404});
  };
  async function call(path,method='GET',body,session=cookie){
    const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{cookie:session,origin:'http://localhost:5173','Content-Type':'application/json','CF-Connecting-IP':Math.random().toString()},...(body?{body:JSON.stringify(body)}:{})}),env);
    if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};
  }
  async function job(valid=true){
    const ts=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.LUSPACE_BILLING_JOB_KEY).update('billing-reconcile:'+ts).digest('hex');
    const r=await handle(new Request('https://luspace.cl/api/billing/reconcile-job',{method:'POST',headers:{'x-luspace-job-ts':ts,'x-luspace-job-signature':valid?sig:'0'.repeat(64)}}),env);return r.status;
  }
  async function webhook(live=true,sellerId=101){
    const ts=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.MP_WEBHOOK_SECRET).update(`id:invoice1;request-id:event1;ts:${ts};`).digest('hex');
    const r=await handle(new Request('https://luspace.cl/api/billing/webhook?data.id=invoice1',{method:'POST',headers:{'x-request-id':'event1','x-signature':`ts=${ts},v1=${sig}`},body:JSON.stringify({type:'subscription_authorized_payment',data:{id:'invoice1'},live_mode:live,user_id:sellerId})}),env);return r.status;
  }
  try{
    assert.equal((await call('setup','POST',{nombre:'Owner',familia:'Live fixture',correo:'owner@example.test',password:'Password!2026qa'})).status,201);
    const ownerCookie=cookie,me=(await call('me')).body;
    assert.equal((await call('users','POST',{nombre:'Editor',correo:'editor@example.test',password:'Password!2026qa',rol:'editor'})).status,201);
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01T00:00:00Z' WHERE id=?").bind(me.familia_id).run();
    assert.equal((await call('billing/checkout','POST',{})).status,400);assert.equal(creates,0);
    assert.equal((await call('billing/checkout','POST',{accepted:true,amount_clp:1})).status,400);
    assert.equal((await call('billing/checkout','POST',{accepted:true,amount_clp:5938})).status,503,'requires operational scheduler');
    assert.equal(await job(false),401);assert.equal(await job(),200);assert.equal(creates,0,'scheduler never creates contracts');
    unsafeSeller=true;assert.equal((await call('billing/connection')).status,503);unsafeSeller=false;
    assert.equal((await call('billing/connection')).body.mode,'production');assert.equal(creates,0);
    assert.equal((await call('billing/checkout','POST',{accepted:true,amount_clp:5938})).status,201);
    assert.equal((await call('billing/checkout','POST',{accepted:true,amount_clp:5938})).body.existing,true);assert.equal(creates,1);
    assert.equal((await call('billing/checkout','POST',{})).body.existing,true,'resume the same checkout without creating another contract');assert.equal(creates,1);
    contract.status='authorized';contract.last_modified=stamp();
    assert.equal(await job(),200);assert.equal((await call('subscription')).body.can_write,false,'authorization alone grants no access');
    invoice={id:'invoice1',preapproval_id:contract.id,external_reference:contract.external_reference,currency_id:'CLP',transaction_amount:5938,debit_date:new Date(Date.now()-86400000).toISOString(),payment:{id:'pay1'}};
    payment={id:'pay1',collector_id:101,live_mode:true,external_reference:contract.external_reference,currency_id:'CLP',transaction_amount:5938,status:'approved',date_last_updated:stamp()};
    assert.equal(await webhook(false),400);assert.equal(await webhook(true,999),400);
    payment.live_mode=false;assert.equal(await webhook(),400);payment.live_mode=true;
    contract.application_id=999;assert.equal(await job(),503);assert.equal((await call('billing')).body.payments.length,0);contract.application_id=303;
    extendedHistory=true;
    assert.equal(await job(),200,'recover a lost webhook through a paginated history');assert.equal((await call('billing')).body.payments.length,1);assert.equal((await call('subscription')).body.can_write,true);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM billing_webhook_inbox WHERE state!='processed'").first()).n,0,'scheduler recovers a failed invoice notification');
    extendedHistory=false;
    assert.equal(await webhook(),200);assert.equal((await call('billing')).body.payments.length,1,'duplicate webhook does not double paid periods');
    env.LUSPACE_BILLING_LIVE_APPROVED='false';assert.equal((await call('subscription')).body.can_write,true,'disabled checkout preserves confirmed paid periods');assert.equal((await call('billing')).body.payments.length,1,'disabled checkout preserves visible production history');env.LUSPACE_BILLING_LIVE_APPROVED='true';
    await call('login','POST',{correo:'editor@example.test',password:'Password!2026qa'});assert.equal((await call('billing/checkout','POST',{accepted:true,amount_clp:5938})).status,403);cookie=ownerCookie;
    const row=(await env.DB.prepare('SELECT * FROM billing_subscriptions WHERE familia_id=?').bind(me.familia_id).all()).results[0];
    assert.equal((await call('billing/'+row.id+'/cancel','POST',{})).status,200);assert.equal((await call('subscription')).body.can_write,true);
    payment.status='refunded';payment.date_last_updated=stamp();assert.equal(await job(),200);assert.equal((await call('subscription')).body.can_write,false);
    await env.DB.prepare('UPDATE familias SET manual_paid_until=? WHERE id=?').bind(new Date(Date.now()+86400000).toISOString(),me.familia_id).run();assert.equal((await call('subscription')).body.can_write,true,'manual access remains independent');
  }finally{env.close();}
});

