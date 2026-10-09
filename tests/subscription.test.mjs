import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {accessWindow} from '../server/subscription.js';
import {password} from '../server/security.js';
test('platform exceptions: password, reason, isolation, audit, expiry and no payment mutation',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-exceptions-')));let cookie='';
  async function call(path,method='GET',data){const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
  try{
    await call('setup','POST',{nombre:'QA',familia:'Familia QA',correo:'qa@example.test',password:'QaPassword!2026'});
    const me=(await call('me')).body,familyCookie=cookie;
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01',subscription_status='expired' WHERE id=?").bind(me.familia_id).run();
    await env.DB.prepare("INSERT INTO familias(id,nombre,trial_ends_at,subscription_status) VALUES('other','Otra','2000-01-01','expired')").run();
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01',subscription_status='expired' WHERE id='other'").run();
    const route='platform/families/'+me.familia_id+'/access';
    const auth={admin_password:'AdminPassword!2026',reason:'Excepción solicitada por familia',read_until:new Date(Date.now()+86400000).toISOString(),write_until:null};
    assert.equal((await call(route,'POST',auth)).status,401);
    await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();
    await env.DB.prepare('INSERT INTO credenciales_plataforma(usuario_id,correo,password_hash) VALUES(?,?,?)').bind(me.id,'admin@example.test',await password(auth.admin_password)).run();
    await call('platform/login','POST',{correo:'admin@example.test',password:auth.admin_password});const platformCookie=cookie;
    assert.equal((await call(route,'POST',{...auth,admin_password:'wrong'})).status,401);
    assert.equal((await call(route,'POST',{...auth,reason:''})).status,400);
    assert.equal((await call(route,'POST',{...auth,read_until:'2000-01-01'})).status,400);
    assert.equal((await call(route,'POST',auth)).status,200);
    cookie=familyCookie;assert.equal((await call('children')).status,200);assert.equal((await call('subscription')).body.can_write,false);
    cookie=platformCookie;
    assert.equal((await call('platform/families/other')).body.access.can_read,false);
    assert.equal((await call(route,'POST',{...auth,write_until:auth.read_until})).status,200);
    cookie=familyCookie;assert.equal((await call('subscription')).body.can_write,true);
    await env.DB.prepare("UPDATE family_access_exceptions SET read_until='2000-01-01',write_until='2000-01-01' WHERE familia_id=?").bind(me.familia_id).run();
    assert.equal((await call('children')).status,403,'no extra 14-day window after courtesy');
    assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM auditoria_plataforma WHERE accion='UPDATE_ACCESS_EXCEPTION'").first()).n,2);
    assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM billing_payments').first()).n,0);
  }finally{env.close();}
});
test('one grace window ends exactly 14 days after expiry, without resetting on login',()=>{
  const row={subscription_status:'expired',trial_ends_at:'2026-11-01T03:00:00Z'};
  const end=Date.parse('2026-11-15T03:00:00Z');
  assert.equal(accessWindow(row,null,end-1).can_read,true);
  assert.equal(accessWindow(row,null,end-1).can_write,false);
  assert.equal(accessWindow(row,null,end).can_read,false);
  assert.equal(accessWindow({...row,subscription_status:'active',trial_ends_at:'2026-10-01T03:00:00Z'},'2026-11-01T03:00:00Z',end).can_read,false,'persisted active label cannot extend a confirmed paid period');
  assert.equal(accessWindow(row,'2026-12-01T03:00:00Z',end).can_write,true);
  assert.equal(accessWindow({...row,commercial_exempt:1},null,end).can_read,true);
});
test('migration preserves existing families and grants only new families a 14-day trial',()=>{
  const db=new DatabaseSync(':memory:');
  try{db.exec("CREATE TABLE familias(id TEXT PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE archivos(id TEXT PRIMARY KEY,familia_id TEXT,bytes INTEGER); INSERT INTO familias(id) VALUES('legacy'); INSERT INTO archivos VALUES('old','legacy',123);");
    db.exec(readFileSync(new URL('../db/migrations/0012_family_subscription.sql',import.meta.url),'utf8'));
    const legacy=db.prepare("SELECT * FROM familias WHERE id='legacy'").get();assert.equal(legacy.commercial_exempt,1);assert.equal(legacy.subscription_status,'active');assert.equal(legacy.storage_used_bytes,123);
    db.exec("INSERT INTO familias(id) VALUES('new')");const fresh=db.prepare("SELECT * FROM familias WHERE id='new'").get();assert.equal(fresh.commercial_exempt,0);assert.equal(fresh.storage_limit_bytes,52428800);
    assert.equal(db.prepare("SELECT ROUND(julianday(trial_ends_at)-julianday(created_at)) AS days FROM familias WHERE id='new'").get().days,14);
  }finally{db.close();}
});
test('trial server enforcement, quota rollback, deletion accounting and no public activation',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-trial-')));let cookie='';
  async function call(path,method='GET',data){const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,...(data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),env);if(r.headers.get('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
  try{
    assert.equal((await call('setup','POST',{nombre:'QA',familia:'Trial',correo:'trial@example.test',password:'QaPassword!2026'})).status,201);
    const me=(await call('me')).body;assert.equal(me.subscription.subscription_status,'trial');assert.equal(me.subscription.commercial_exempt,0);assert.equal(me.subscription.can_write,true);
    const child=(await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01',sexo_referencia:'masculino',rnd_habilitado:0})).body.id;assert.ok(child);
    await env.DB.prepare('UPDATE familias SET storage_limit_bytes=20 WHERE id=?').bind(me.familia_id).run();
    const upload=()=>{const fd=new FormData();fd.append('file',new Blob(['%PDF-1.4 QA'],{type:'application/pdf'}),'qa.pdf');return call('files?child='+child+'&module=salud','POST',fd);};
    const first=await upload();assert.equal(first.status,201);assert.equal((await call('subscription')).body.storage_used_bytes,11);
    assert.equal((await upload()).status,413);assert.equal((await call('subscription')).body.storage_used_bytes,11);
    // Simulate a competing upload at SQL boundary; quota trigger must reject atomically.
    await assert.rejects(()=>env.DB.prepare("INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key) VALUES('overflow',?,?,'salud','x.pdf','application/pdf',11,'d1:overflow')").bind(me.familia_id,child).run(),/STORAGE_QUOTA_EXCEEDED/);
    await env.DB.prepare("UPDATE familias SET trial_ends_at=? WHERE id=?").bind(new Date(Date.now()-86400000).toISOString(),me.familia_id).run();
    assert.equal((await call('subscription')).body.subscription_status,'expired');assert.equal((await call('children')).status,200);
    assert.equal((await call('backup')).status,200,'backup remains available within the single grace window');
    assert.equal((await call('children/'+child,'PUT',{primer_nombre:'NO'})).status,403);assert.equal((await call('anamnesis?child='+child,'PUT',{})).status,403);assert.equal((await upload()).status,403);
    assert.equal((await call('subscription','PUT',{subscription_status:'active'})).status,404);
    assert.equal((await call('files/'+first.body.id,'DELETE')).status,403);
    assert.equal((await call('subscription')).body.storage_used_bytes,11);
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01T00:00:00Z' WHERE id=?").bind(me.familia_id).run();
    assert.equal((await call('children')).status,403);
    assert.equal((await call('files/'+first.body.id)).status,403);
    assert.equal((await call('backup')).status,403);
    assert.equal((await call('export','POST',{})).status,403);
    assert.equal((await call('me')).status,200);
    assert.equal((await call('subscription')).body.access_phase,'locked');
    await env.DB.prepare('UPDATE familias SET commercial_exempt=1 WHERE id=?').bind(me.familia_id).run();assert.equal((await upload()).status,201);
  }finally{env.close();}
});
