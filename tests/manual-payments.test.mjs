import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {registerManualPayment,reviewManualPayment} from '../server/manual-payments.js';
import {subscription} from '../server/subscription.js';
import {randomUUID} from 'node:crypto';

test('manual transfers: independent families, atomic confirmation, expiry, quota and courtesy without fake revenue',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-manual-')));let cookie='';
 const call=async(path,method='GET',data)=>{const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,body:await r.json()};};
 try{
  assert.equal((await call('platform/manual-payments')).status,401);
  await call('setup','POST',{nombre:'QA',familia:'QA Payments',correo:'qa-payments@example.test',password:'QaPassword!2026'});
  const me=(await call('me')).body,familyCookie=cookie;
  assert.equal((await call('platform/manual-payments')).status,401);
  await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();
  await call('platform/enroll','POST',{correo:'qa-admin@example.test',current_password:'QaPassword!2026',password:'AdminPassword!2026'});
  await call('platform/login','POST',{correo:'qa-admin@example.test',password:'AdminPassword!2026'});
  const adminCookie=cookie;
  await env.DB.prepare("INSERT INTO familias(id,nombre,subscription_status) VALUES('separate','QA Separate','active')").run();
  const payload={familia_id:me.familia_id,tipo:'transferencia',monto_clp:5938,fecha_pago:'2026-01-01',referencia:'BANK-TEST-01',notas:'Ingreso bancario de prueba',dias_cortesia:0,cuota_bytes:524288000,request_key:randomUUID(),admin_password:'AdminPassword!2026'};
  assert.equal((await call('platform/manual-payments','POST',{...payload,admin_password:'wrong'})).status,401);
  assert.equal((await call('platform/manual-payments','POST',{...payload,monto_clp:2.5})).status,400);
  const created=await call('platform/manual-payments','POST',payload);assert.equal(created.status,201);assert.equal(created.body.estado,'pendiente');
  assert.equal((await call('platform/manual-payments','POST',payload)).body.id,created.body.id);
  assert.equal((await call('platform/manual-payments','POST',{...payload,request_key:randomUUID()})).status,409);
  assert.equal((await env.DB.prepare('SELECT manual_paid_until FROM familias WHERE id=?').bind(me.familia_id).first()).manual_paid_until,null);
  const pending=(await call('platform/notifications')).body.items.find(n=>n.key==='manual-payment:'+created.body.id);assert.ok(pending);assert.equal(pending.target,'payments');
  const review={estado:'confirmado',bank_verified:true,notas:'Verificado en banco de prueba',admin_password:'AdminPassword!2026'};
  const route='platform/manual-payments/'+created.body.id+'/review';
  assert.equal((await call(route,'POST',{...review,bank_verified:false})).status,400);
  const confirmed=await call(route,'POST',review);assert.equal(confirmed.status,200);assert.ok(confirmed.body.periodo_fin);
  assert.equal((await call(route,'POST',review)).body.periodo_fin,confirmed.body.periodo_fin);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM auditoria_plataforma WHERE accion='CONFIRM_MANUAL_ACCESS'").first()).n,1);
  assert.equal((await call(route,'POST',{...review,estado:'rechazado'})).status,409);
  assert.equal((await env.DB.prepare('SELECT storage_limit_bytes FROM familias WHERE id=?').bind(me.familia_id).first()).storage_limit_bytes,524288000);
  assert.equal((await env.DB.prepare("SELECT manual_paid_until FROM familias WHERE id='separate'").first()).manual_paid_until,null);
  cookie=familyCookie;assert.equal((await call(route,'POST',review)).status,401);assert.equal((await call('subscription')).body.can_write,true);
  cookie=adminCookie;
  await env.DB.prepare("DELETE FROM intentos_acceso WHERE clave=?").bind('platform-payment:'+me.id).run(); // Reset the test's mutation burst; production throttling stays enabled.
  const gift=await call('platform/manual-payments','POST',{...payload,tipo:'cortesia',monto_clp:0,dias_cortesia:7,referencia:'',request_key:randomUUID(),cuota_bytes:0});assert.equal(gift.status,201);
  const gifted=await call('platform/manual-payments/'+gift.body.id+'/review','POST',review);assert.equal(gifted.status,200);assert.equal(gifted.body.periodo_inicio,confirmed.body.periodo_fin);assert.equal(Date.parse(gifted.body.periodo_fin)-Date.parse(gifted.body.periodo_inicio),7*86400000);
  assert.equal((await call('platform/manual-payments')).body.pending,0);
  const rejected=await call('platform/manual-payments','POST',{...payload,referencia:'BANK-REJECT',request_key:randomUUID()});
  await call('platform/manual-payments/'+rejected.body.id+'/review','POST',{...review,estado:'rechazado'});
  assert.equal((await env.DB.prepare('SELECT manual_paid_until FROM familias WHERE id=?').bind(me.familia_id).first()).manual_paid_until,gifted.body.periodo_fin);
  await env.DB.prepare("UPDATE familias SET manual_paid_until='2000-01-01T00:00:00Z',trial_ends_at='2000-01-01T00:00:00Z' WHERE id=?").bind(me.familia_id).run();
  assert.equal((await subscription(env.DB,me.familia_id)).can_write,false);
  assert.equal((await subscription(env.DB,'separate')).can_write,true); // untouched legacy/manual admin activation
 }finally{env.close();}
});

test('calendar-month clamp, retry and preserved paid period alongside a canceled automatic test contract',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-manual-month-')));
 try{
  await env.DB.prepare("INSERT INTO familias(id,nombre,manual_paid_until) VALUES('f','Calendar QA','2032-01-31T10:00:00.000Z')").run();
  await env.DB.prepare("INSERT INTO usuarios(id,familia_id,nombre,correo,rol) VALUES('a','f','QA','calendar@example.test','superadmin')").run();
  await env.DB.prepare("INSERT INTO administradores_plataforma(usuario_id) VALUES('a')").run();
  const b={familia_id:'f',tipo:'transferencia',monto_clp:5938,fecha_pago:'2026-01-01',referencia:'',notas:'Calendar test',dias_cortesia:0,cuota_bytes:0,request_key:randomUUID()};
  const p=await registerManualPayment(env.DB,{id:'a'},b),r=await reviewManualPayment(env.DB,{id:'a'},p.id,{estado:'confirmado',bank_verified:true,notas:'Ingreso verificado'});
  assert.equal(r.periodo_inicio,'2032-01-31T10:00:00.000Z');assert.equal(r.periodo_fin,'2032-02-29T10:00:00.000Z');
  // Mercado Pago currently lives only in isolated preview. Exercise coexistence there without adding billing tables to production.
  if(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='billing_subscriptions'").first()){
    await env.DB.prepare("INSERT INTO billing_subscriptions(id,familia_id,environment,external_reference,amount_clp,state) VALUES('test-contract','f','test','qa-ref',5938,'cancelled')").run();
    Object.assign(env,{LUSPACE_BILLING_MODE:'test',MP_ACCESS_TOKEN:'FAKE',MP_WEBHOOK_SECRET:'FAKE',LUSPACE_BILLING_AMOUNT_CLP:'5938',MP_TEST_SELLER_ID:'101'});
    assert.equal((await subscription(env.DB,'f',env)).can_write,true);
    assert.equal((await env.DB.prepare("SELECT state FROM billing_subscriptions WHERE id='test-contract'").first()).state,'cancelled');
  }else assert.equal((await subscription(env.DB,'f',env)).can_write,true);
 }finally{env.close();}
});
