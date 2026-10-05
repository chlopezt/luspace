import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {storageLevel} from '../server/platform-consumption.js';
import {password} from '../server/security.js';

test('global consumption, private admin notifications and atomic upload reservations',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-consumption-')));let cookie='';
 const call=async(path,method='GET',data)=>{
  const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,...(data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),env);
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;
 };
 const upload=child=>{const data=new FormData();data.append('file',new Blob(['%PDF-1.4 test!']),'PRIVATE-DOCUMENT.pdf');return call('files?child='+child+'&module=salud','POST',data);};
 try{
  assert.equal((await call('platform/consumption')).status,401);
  await call('setup','POST',{nombre:'QA',familia:'Nueva familia QA',correo:'consumption@example.test',password:'FamilyPassword!2026'});
  const me=await(await call('me')).json(),familyCookie=cookie;
  const child=(await(await call('children','POST',{primer_nombre:'PRIVATE-CHILD',fecha_nacimiento:'2020-01-01',diagnostico:'PRIVATE-DIAGNOSIS'})).json()).id;
  assert.equal((await call('platform/notifications')).status,401);
  await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();
  await call('platform/enroll','POST',{correo:'consumption-admin@example.test',current_password:'FamilyPassword!2026',password:'AdminPassword!2026'});
  await call('platform/login','POST',{correo:'consumption-admin@example.test',password:'AdminPassword!2026'});const adminCookie=cookie;
  const metrics=await(await call('platform/consumption')).json();
  assert.equal(metrics.storage.limit_bytes,8000000000);assert.equal(metrics.storage.used_bytes,0);assert.equal(metrics.cloudflare.r2_class_a_operations,null);assert.equal(metrics.ai.neurons_used,null);
  assert.ok(!JSON.stringify(metrics).includes('PRIVATE-CHILD'));assert.ok(!JSON.stringify(metrics).includes('PRIVATE-DIAGNOSIS'));
  let notes=await(await call('platform/notifications')).json();assert.ok(notes.items.some(n=>n.key==='family-new:'+me.familia_id));
  const keys=notes.items.filter(n=>!n.read).map(n=>n.key);
  assert.equal((await call('platform/notifications/read','POST',{keys:['invalid']})).status,400);
  assert.equal((await call('platform/notifications/read','POST',{keys})).status,200);
  assert.equal((await(await call('platform/notifications')).json()).unread,0);
  assert.equal((await call('platform/notifications/read','POST',{keys})).status,200);
  // Read state is scoped to the independent administrator, not the whole platform.
  const second=crypto.randomUUID();await env.DB.prepare("INSERT INTO usuarios(id,familia_id,nombre,correo,rol) VALUES(?,?,'Second admin','second@example.test','editor')").bind(second,me.familia_id).run();
  await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(second).run();
  await env.DB.prepare("INSERT INTO credenciales_plataforma(usuario_id,correo,password_hash) VALUES(?,? ,?)").bind(second,'second-admin@example.test',await password('SecondPassword!2026')).run();
  await call('platform/login','POST',{correo:'second-admin@example.test',password:'SecondPassword!2026'});
  assert.ok((await(await call('platform/notifications')).json()).unread>0);
  cookie=familyCookie;
  await env.DB.prepare('UPDATE familias SET commercial_exempt=1 WHERE id=?').bind(me.familia_id).run();
  const objects=new Map();let puts=0;
  env.LUSPACE_R2_ENABLED='true';env.FILES={async put(k,v){puts++;objects.set(k,new Uint8Array(v));},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.slice().buffer}:null;},async delete(k){objects.delete(k);}};
  await env.DB.prepare("INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key) VALUES('global-seed',?,?,'salud','PRIVATE-DOCUMENT','application/pdf',7999999980,'d1:global-seed')").bind(me.familia_id,child).run();
  const responses=await Promise.all([upload(child),upload(child)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,413]);assert.equal(puts,1);assert.equal(objects.size,1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reservas_almacenamiento').first()).n,0);
  cookie=adminCookie;
  notes=await(await call('platform/notifications')).json();assert.ok(notes.items.some(n=>n.key==='global-storage:critical'));
  const full=await(await call('platform/consumption')).json();assert.ok(full.storage.committed_bytes<=8000000000);assert.ok(!JSON.stringify(full).includes('PRIVATE-DOCUMENT'));
  await env.DB.prepare("DELETE FROM archivos WHERE id='global-seed'").run();
  cookie=familyCookie;
  const originalPut=env.FILES.put;env.FILES.put=async()=>{throw new Error('simulated failure');};
  assert.equal((await upload(child)).status,500);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reservas_almacenamiento').first()).n,0);env.FILES.put=originalPut;
  const originalDelete=env.FILES.delete;env.FILES.put=async()=>{throw new Error('simulated interrupted upload');};env.FILES.delete=async()=>{throw new Error('cleanup unavailable');};
  assert.equal((await upload(child)).status,500);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM reservas_almacenamiento').first()).n,1);
  cookie=adminCookie;assert.ok((await(await call('platform/notifications')).json()).items.some(n=>n.key==='pending-reservations'));
  env.FILES.put=originalPut;env.FILES.delete=originalDelete;await env.DB.prepare('DELETE FROM reservas_almacenamiento').run();cookie=familyCookie;
  // Global reservations also guard direct concurrent metadata insertions.
  await env.DB.prepare("INSERT INTO reservas_almacenamiento(id,bytes) SELECT 'pending-test',8000000000-COALESCE(SUM(bytes),0) FROM archivos").run();
  const before=puts;assert.equal((await upload(child)).status,413);assert.equal(puts,before);
  await env.DB.prepare("DELETE FROM reservas_almacenamiento WHERE id='pending-test'").run();
  cookie=adminCookie;assert.equal((await(await call('platform/consumption')).json()).storage.reserved_bytes,0);
  for(const [ratio,level] of [[0,'normal'],[.7,'notice'],[.85,'warning'],[.95,'critical'],[1,'blocked']])assert.equal(storageLevel(ratio*100,100),level);
 }finally{env.close();}
});
