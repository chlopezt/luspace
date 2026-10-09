import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {LEGAL_VERSION} from '../shared/legal.js';

test('single month: no recurring contract, trusted approval only, isolation, replay, refund, expiration and manual coexistence (mock provider)',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-oneoff-')));
  Object.assign(env,{LUSPACE_BILLING_MODE:'production',LUSPACE_BILLING_LIVE_APPROVED:'true',MP_SELLER_ID:'101',MP_APPLICATION_ID:'303',MP_BILLING_BACK_URL:'https://luspace.cl/login',MP_ACCESS_TOKEN:'FAKE',MP_WEBHOOK_SECRET:'FAKE',LUSPACE_BILLING_JOB_KEY:'fictional-job-secret'.repeat(3),LUSPACE_BILLING_AMOUNT_CLP:'5938'});
  let cookie='',creates=0,preference,payment,clock=Date.now(),searchRows=[],wrongMerchantPreference=false;const preferences=new Map();
  const stamp=()=>new Date(clock+=1000).toISOString();
  env.BILLING_TEST_FETCH=async(input,options)=>{
    const url=new URL(input);let result;
    assert.equal(url.hostname,'api.mercadopago.com');
    if(url.pathname==='/users/me')result={id:101,site_id:'MLC',tags:[]};
    else if(url.pathname==='/checkout/preferences'&&options.method==='POST'){
      creates++;const body=JSON.parse(options.body);
      assert.equal(body.items[0].unit_price,5938);assert.equal(body.items[0].quantity,1);
      assert.equal(body.notification_url,'https://luspace.cl/api/billing/webhook');
      assert.equal(body.auto_recurring,undefined);assert.equal(body.payer,undefined,'no family or clinical data in preference');
      preference={...body,id:'pref'+creates,collector_id:101,init_point:'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=pref'+creates};preferences.set(preference.id,preference);result=preference;
    }else if(url.pathname.startsWith('/checkout/preferences/'))result=preferences.get(url.pathname.split('/').at(-1));
    else if(url.pathname==='/v1/payments/search')result={results:searchRows,paging:{total:searchRows.length}};
    else if(url.pathname==='/v1/payments/payonce')result=payment;
    else if(url.pathname==='/merchant_orders/merchant1')result={id:'merchant1',application_id:'hosted-checkout',collector:{id:101},preference_id:wrongMerchantPreference?'another-preference':[...preferences.values()].find(p=>p.external_reference===payment.external_reference).id,external_reference:payment.external_reference,payments:[{id:'payonce'}]};
    else throw new Error('Unexpected provider request: '+url.pathname);
    return new Response(JSON.stringify(result),{status:result?200:404});
  };
  async function call(path,method='GET',data,session=cookie){
    const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie:session,'Content-Type':'application/json','CF-Connecting-IP':Math.random().toString()},...(data?{body:JSON.stringify(data)}:{})}),env);
    if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};
  }
  async function webhook(){
    const ts=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.MP_WEBHOOK_SECRET).update(`id:payonce;request-id:once;ts:${ts};`).digest('hex');
    const r=await handle(new Request('https://luspace.cl/api/billing/webhook?data.id=payonce',{method:'POST',headers:{'x-request-id':'once','x-signature':`ts=${ts},v1=${sig}`},body:JSON.stringify({type:'payment',data:{id:'payonce'},live_mode:true,user_id:101})}),env);return r.status;
  }
  const consent={accepted:true,amount_clp:5938};
  async function job(){
    const ts=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256',env.LUSPACE_BILLING_JOB_KEY).update('billing-reconcile:'+ts).digest('hex');
    const r=await handle(new Request('https://luspace.cl/api/billing/reconcile-job',{method:'POST',headers:{'x-luspace-job-ts':ts,'x-luspace-job-signature':signature}}),env);return r.status;
  }
  try{
    assert.equal((await call('setup','POST',{nombre:'Owner',familia:'Family A',correo:'owner@example.test',password:'TestPassword2026!'})).status,201);
    const ownerCookie=cookie,me=(await call('me')).body;
    await env.DB.prepare("UPDATE familias SET commercial_exempt=0,subscription_status='expired',trial_ends_at='2000-01-01' WHERE id=?").bind(me.familia_id).run();
    await env.DB.prepare('UPDATE billing_job_status SET last_finished_at=? WHERE id=1').bind(stamp()).run();
    assert.equal((await call('billing/oneoff','POST',{})).status,400);assert.equal(creates,0);
    assert.equal((await call('billing/oneoff','POST',{accepted:true,amount_clp:1})).status,400);
    assert.equal((await call('billing/oneoff','POST',consent)).status,201);
    assert.equal((await call('billing/oneoff','POST',consent)).body.existing,true);assert.equal(creates,1);
    assert.equal((await call('billing/checkout','POST',consent)).status,409);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM billing_subscriptions').first()).n,0);
    assert.equal((await call('subscription')).body.can_write,false);
    assert.equal((await call('subscription')).body.confirmed_paid_until,null,'pending checkout is not paid coverage');
    payment={id:'payonce',external_reference:preference.external_reference,collector_id:101,live_mode:true,transaction_amount:5938,currency_id:'CLP',status:'pending',order:{type:'mercadopago',id:'merchant1'},date_approved:new Date(Date.now()-60000).toISOString(),date_last_updated:stamp()};
    searchRows=[payment];assert.equal((await call('billing/refresh','POST',{})).status,200);
    assert.equal((await call('subscription')).body.can_write,false);
    payment.status='approved';payment.transaction_amount=1;assert.equal(await webhook(),400);
    payment.transaction_amount=5938;payment.live_mode=false;assert.equal(await webhook(),400);
    payment.live_mode=true;payment.collector_id=999;assert.equal(await webhook(),400);
    payment.collector_id=101;payment.date_last_updated=stamp();
    wrongMerchantPreference=true;assert.equal(await webhook(),400,'reject another preference even when the seller and reference match');wrongMerchantPreference=false;
    const correctPrice=preference.items[0].unit_price;preference.items[0].unit_price=1;assert.equal(await webhook(),400,'re-fetch exact preference and verify its server-owned amount');preference.items[0].unit_price=correctPrice;
    assert.equal(await job(),200,'scheduled polling recovers a lost webhook without making a charge');
    assert.equal((await call('subscription')).body.can_write,true);
    const period=(await call('billing')).body.payments[0];assert.equal(period.kind,'oneoff');
    assert.equal((await call('subscription')).body.confirmed_paid_until,period.period_end);
    const trialEnd=new Date(Date.now()+14*86400000).toISOString(),futureEnd=new Date(Date.now()+44*86400000).toISOString();
    await env.DB.prepare("UPDATE familias SET subscription_status='trial',trial_ends_at=? WHERE id=?").bind(trialEnd,me.familia_id).run();
    await env.DB.prepare('UPDATE billing_order_payments SET period_start=?,period_end=? WHERE id=?').bind(trialEnd,futureEnd,period.id).run();
    const futureCoverage=(await call('subscription')).body;
    assert.equal(futureCoverage.subscription_status,'trial','trial and future paid period keep their original access rules');
    assert.equal(futureCoverage.confirmed_paid_until,futureEnd,'sidebar knows approved future coverage');
    assert.equal(futureCoverage.access_expires_at,trialEnd,'display status must not advance paid access');
    await env.DB.prepare('UPDATE billing_order_payments SET period_start=?,period_end=? WHERE id=?').bind(period.period_start,period.period_end,period.id).run();
    await env.DB.prepare("UPDATE familias SET subscription_status='expired',trial_ends_at='2000-01-01' WHERE id=?").bind(me.familia_id).run();
    assert.equal(await webhook(),200);assert.equal(await webhook(),200);
    assert.equal((await call('billing')).body.payments.length,1);
    assert.equal((await call('billing/oneoff','POST',consent)).status,409,'no duplicate month while coverage is active');
    assert.equal((await call('billing/checkout','POST',consent)).status,409,'switch only after the one-off period');
    assert.equal((await call('register','POST',{nombre:'Other',familia:'Family B',correo:'other@example.test',password:'OtherPassword2026!',password_confirmation:'OtherPassword2026!',legal_accepted:true,legal_version:LEGAL_VERSION})).status,201);
    assert.equal((await call('billing')).body.payments.length,0);
    assert.equal((await call('subscription')).body.confirmed_paid_until,null,'paid coverage is private to the correct family');
    const other=(await call('me')).body;
    await env.DB.prepare("UPDATE familias SET subscription_status='expired',trial_ends_at='2000-01-01' WHERE id=?").bind(other.familia_id).run();
    assert.equal((await call('subscription')).body.can_write,false,'A payment never unlocks B');cookie=ownerCookie;
    payment.status='refunded';payment.date_last_updated=stamp();assert.equal((await call('billing/refresh','POST',{})).status,200);
    assert.equal((await call('subscription')).body.confirmed_paid_until,null,'refunded coverage must not be shown as paid');
    assert.equal((await call('subscription')).body.can_write,false);
    payment.status='approved';payment.date_last_updated=period.period_start;await call('billing/refresh','POST',{});
    assert.equal((await call('subscription')).body.can_write,false,'stale approval cannot undo refund');
    await env.DB.prepare('UPDATE familias SET manual_paid_until=? WHERE id=?').bind(new Date(Date.now()+86400000).toISOString(),me.familia_id).run();
    assert.equal((await call('subscription')).body.can_write,true,'manual coverage remains independent');
    await call('users','POST',{nombre:'Editor',correo:'editor@example.test',password:'EditorPassword2026!',rol:'editor'});
    await call('login','POST',{correo:'editor@example.test',password:'EditorPassword2026!'});
    assert.equal((await call('billing/oneoff','POST',consent)).status,403);cookie=ownerCookie;
    assert.equal((await call('billing/oneoff','POST',consent)).status,201);
    searchRows=[];preference.expiration_date_to='2000-01-01T00:00:00Z';
    await env.DB.prepare("UPDATE billing_orders SET expires_at='2000-01-01T00:00:00Z' WHERE state='pending'").run();
    assert.equal((await call('billing/refresh','POST',{})).status,200);
    assert.equal((await call('billing')).body.orders[0].state,'expired','only verified empty expired preferences release reservation');
  }finally{env.close();}
});
