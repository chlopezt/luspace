import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
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
    await env.DB.prepare("UPDATE familias SET trial_ends_at='2000-01-01T00:00:00Z' WHERE id=?").bind(me.familia_id).run();
    assert.equal((await call('subscription')).body.subscription_status,'expired');assert.equal((await call('children')).status,200);
    assert.equal((await call('children/'+child,'PUT',{primer_nombre:'NO'})).status,403);assert.equal((await call('anamnesis?child='+child,'PUT',{})).status,403);assert.equal((await upload()).status,403);
    assert.equal((await call('subscription','PUT',{subscription_status:'active'})).status,404);
    assert.equal((await call('files/'+first.body.id,'DELETE')).status,200);assert.equal((await call('subscription')).body.storage_used_bytes,0);
    await env.DB.prepare('UPDATE familias SET commercial_exempt=1 WHERE id=?').bind(me.familia_id).run();assert.equal((await upload()).status,201);
  }finally{env.close();}
});
