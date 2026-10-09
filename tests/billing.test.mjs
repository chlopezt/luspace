import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {billingConfiguration,verifyBillingSignature,validateBillingNotification,assertProviderSubscription,fictionalAccounts,assertTestPaymentMode} from '../server/billing-security.js';

test('fictional-account strategy pins both counterparties and cannot enable production or unknown modes',()=>{
  const env={LUSPACE_BILLING_MODE:'test',LUSPACE_BILLING_TEST_STRATEGY:'fictional_accounts',LUSPACE_BILLING_ISOLATED:'true',MP_TEST_SELLER_ID:'101',MP_TEST_BUYER_ID:'202',MP_TEST_APPLICATION_ID:'303'};
  const payment={live_mode:true,collector_id:101,payer:{id:202}};
  assert.equal(fictionalAccounts(env),true);assert.doesNotThrow(()=>assertTestPaymentMode(env,payment,101));
  assert.throws(()=>assertTestPaymentMode(env,{...payment,payer:{id:999}},101));
  assert.throws(()=>assertTestPaymentMode(env,{...payment,collector_id:999},101));
  assert.throws(()=>assertTestPaymentMode(env,payment,999));
  assert.throws(()=>assertTestPaymentMode(env,{...payment,live_mode:undefined},101));
  for(const changes of [{LUSPACE_BILLING_MODE:'production'},{LUSPACE_BILLING_ISOLATED:'false'},{MP_TEST_APPLICATION_ID:''},{MP_TEST_BUYER_ID:'101'},{LUSPACE_BILLING_TEST_STRATEGY:'sandbox'}]){
    const unsafe={...env,...changes};assert.equal(fictionalAccounts(unsafe),false);assert.throws(()=>assertTestPaymentMode(unsafe,payment,101));
  }
  const req=new Request('https://example.test/webhook?data.id=abc',{headers:{'x-request-id':'event1'}});
  const notification={type:'payment',data:{id:'abc'},live_mode:true,user_id:101};
  assert.doesNotThrow(()=>validateBillingNotification(req,notification,'test',env));
  assert.throws(()=>validateBillingNotification(req,{...notification,user_id:999},'test',env));
  assert.throws(()=>validateBillingNotification(req,notification,'test'));
});

test('billing is disabled by default and production requires explicit approval',()=>{
  assert.equal(billingConfiguration({}).enabled,false);
  const env={LUSPACE_BILLING_MODE:'production',MP_ACCESS_TOKEN:'fake',MP_WEBHOOK_SECRET:'fake',LUSPACE_BILLING_AMOUNT_CLP:'5938'};
  assert.equal(billingConfiguration(env).enabled,false);
  assert.equal(billingConfiguration({...env,LUSPACE_BILLING_MODE:'test'}).enabled,true);
  assert.equal(billingConfiguration({...env,LUSPACE_BILLING_MODE:'test',LUSPACE_BILLING_AMOUNT_CLP:'-1'}).enabled,false);
  assert.equal(billingConfiguration({...env,LUSPACE_BILLING_MODE:'test',LUSPACE_BILLING_AMOUNT_CLP:''}).enabled,false);
  assert.equal(billingConfiguration({...env,LUSPACE_BILLING_MODE:'test',MP_ACCESS_TOKEN:''}).enabled,false);
});
test('webhook signature rejects forgeries, replay, ambiguous IDs and mismatched environments',async()=>{
  const secret='fictitious-test-secret',now=Date.now(),ts=String(Math.floor(now/1000));
  const sig=createHmac('sha256',secret).update(`id:abc123;request-id:request-1;ts:${ts};`).digest('hex');
  const request=(query='data.id=ABC123',signature=`ts=${ts},v1=${sig}`)=>new Request('https://example.test/webhook?'+query,{headers:{'x-request-id':'request-1','x-signature':signature}});
  assert.equal(await verifyBillingSignature(request(),secret,now),true);
  assert.equal(await verifyBillingSignature(request(),'wrong',now),false);
  assert.equal(await verifyBillingSignature(request(),secret,now+360000),false);
  assert.equal(await verifyBillingSignature(request('data.id=ABC123&data.id=OTHER'),secret,now),false);
  assert.equal(await verifyBillingSignature(request('data.id=OTHER'),secret,now),false);
  assert.equal(await verifyBillingSignature(request('data.id=ABC123',`ts=${ts},ts=${ts},v1=${sig}`),secret,now),false);
  const payload={type:'subscription_preapproval',data:{id:'ABC123'},live_mode:false};
  assert.equal(validateBillingNotification(request(),payload,'test').resourceId,'ABC123');
  assert.throws(()=>validateBillingNotification(request(),{...payload,live_mode:true},'test'));
  assert.throws(()=>validateBillingNotification(request(),{...payload,data:{id:'other'}},'test'));
});
test('provider verification binds seller, opaque reference, amount, currency and period',()=>{
  const row={provider_id:'123',external_reference:'opaque-ref',amount_clp:5938};
  const provider={id:'123',external_reference:'opaque-ref',collector_id:456,status:'authorized',auto_recurring:{transaction_amount:5938,currency_id:'CLP',frequency:1,frequency_type:'months'}};
  assert.equal(assertProviderSubscription(row,provider,456),'authorized');
  for(const change of [{external_reference:'other-family'},{collector_id:999},{id:'other'}])
    assert.throws(()=>assertProviderSubscription(row,{...provider,...change},456));
  assert.throws(()=>assertProviderSubscription(row,{...provider,auto_recurring:{...provider.auto_recurring,transaction_amount:1}},456));
});
test('additive billing schema preserves families and prevents duplicate subscriptions/events',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE familias(id TEXT PRIMARY KEY,status TEXT); INSERT INTO familias VALUES('one','active'),('two','trial');");
    db.exec(readFileSync(new URL('../db/migrations/0031_billing_foundation.sql',import.meta.url),'utf8'));
    assert.equal(db.prepare('SELECT status FROM familias WHERE id=?').get('one').status,'active');
    const insert=db.prepare('INSERT INTO billing_subscriptions(id,familia_id,environment,external_reference,amount_clp) VALUES(?,?,?,?,?)');
    insert.run('a','one','test','ref-a',5938);insert.run('b','two','test','ref-b',5938);
    assert.throws(()=>insert.run('c','one','test','ref-c',5938),/UNIQUE/);
    assert.throws(()=>insert.run('c','absent','test','ref-c',5938),/FOREIGN KEY/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_subscriptions WHERE familia_id=?').get('one').count,1);
    const event=db.prepare('INSERT INTO billing_webhook_inbox(id,environment,topic,resource_id,request_id,signature_ts) VALUES(?,?,?,?,?,?)');
    event.run('event1','test','payment','123','request1','1704908010');
    assert.throws(()=>event.run('event2','test','payment','123','request1','1704908010'),/UNIQUE/);
  } finally {db.close();}
});

