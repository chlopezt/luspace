import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {password} from '../server/security.js';
import {digest,readFileBytes,removeR2} from '../server/file-storage.js';
test('legacy inline JPG stays readable, migrates without losing bytes and never follows foreign keys',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-legacy-jpg-')));let cookie='';
 const call=async(path,method='GET',data)=>{
  const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;
 };
 try{
  await call('setup','POST',{nombre:'QA',familia:'QA',correo:'legacy@example.test',password:'FamilyPassword!2026'});
  const me=await (await call('me')).json(),ownCookie=cookie;
  const child=(await (await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01'})).json()).id;
  const id=crypto.randomUUID(),bytes=Uint8Array.from([255,216,255,224,0,16,255,217]);
  await env.DB.prepare('INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,contenido) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,me.familia_id,child,'salud','legacy.jpg','image/jpeg',bytes.length,id,bytes).run();
  const file=await env.DB.prepare('SELECT * FROM archivos WHERE id=?').bind(id).first();
  env.FILES={get(){throw new Error('Legacy D1 must never query R2');},delete(){throw new Error('Legacy D1 must never delete R2');}};
  const inline=await call('files/'+id);assert.equal(inline.status,200);assert.equal(inline.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await inline.arrayBuffer()),bytes);
  const download=await call('files/'+id+'?download=1');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);
  await assert.rejects(()=>readFileBytes(env,{...file,r2_key:crypto.randomUUID()}),/ubicación/);
  await assert.rejects(()=>readFileBytes(env,{...file,r2_key:crypto.randomUUID()+'/'+child+'/'+id}),/ubicación/);
  await assert.rejects(()=>readFileBytes(env,{...file,bytes:bytes.length+1}),/tamaño/);
  await removeR2(env,file);
  assert.equal((await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v1',nombre:'Other',familia:'Other',correo:'legacy-other@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'})).status,201);
  assert.equal((await call('files/'+id)).status,404);assert.equal((await call('files/'+id,'DELETE')).status,404);
  cookie=ownCookie;
  // Apply the exact production repair twice to verify it is scoped and idempotent.
  const sql=readFileSync(new URL('../db/migrations/0017_legacy_inline_file_markers.sql',import.meta.url),'utf8');
  await env.DB.prepare(sql).run();await env.DB.prepare(sql).run();
  const repaired=await env.DB.prepare('SELECT * FROM archivos WHERE id=?').bind(id).first();
  assert.equal(repaired.r2_key,'d1:'+id);assert.deepEqual(repaired.contenido,bytes);assert.equal(repaired.familia_id,me.familia_id);assert.equal(repaired.nino_id,child);
  assert.equal((await call('files/'+id)).status,200);
  assert.equal((await call('files/'+id,'DELETE')).status,200);
 }finally{env.close();}
});
test('private R2 copy preserves original bytes, ownership, quotas and family isolation',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-r2-')));let cookie='';
 async function call(path,method='GET',data){const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,...(data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),env);if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;}
 const upload=async(child)=>{const form=new FormData();form.append('file',new Blob(['%PDF-1.4 R2 QA'],{type:'application/pdf'}),'test.pdf');return call('files?child='+child+'&module=rnd','POST',form);};
 try{
  await call('setup','POST',{nombre:'QA',familia:'QA',correo:'r2@example.test',password:'FamilyPassword!2026'});
  const me=await (await call('me')).json(),familyCookie=cookie;
  const child=(await (await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01'})).json()).id;
  const fileId=(await (await upload(child)).json()).id;
  const original=await env.DB.prepare('SELECT * FROM archivos WHERE id=?').bind(fileId).first();
  assert.equal((await call('platform/storage-migration','POST',{})).status,401);
  await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();
  await call('platform/enroll','POST',{correo:'r2-admin@example.test',current_password:'FamilyPassword!2026',password:'PlatformPassword!2026'});
  await call('platform/login','POST',{correo:'r2-admin@example.test',password:'PlatformPassword!2026'});const adminCookie=cookie;
  assert.equal((await call('platform/storage-migration','POST',{})).status,503);
  const objects=new Map();env.FILES={async put(key,value){objects.set(key,new Uint8Array(value).slice());},async get(key){const bytes=objects.get(key);return bytes?{async arrayBuffer(){return bytes.slice().buffer;}}:null;},async delete(key){objects.delete(key);}};env.LUSPACE_R2_ENABLED='true';
  const copied=await call('platform/storage-migration','POST',{});assert.equal(copied.status,200);assert.equal((await copied.json()).verified,1);
  const migrated=await env.DB.prepare('SELECT * FROM archivos WHERE id=?').bind(fileId).first();
  assert.equal(migrated.r2_key,`${me.familia_id}/${child}/${fileId}`);assert.equal(migrated.familia_id,original.familia_id);assert.equal(migrated.nino_id,original.nino_id);assert.equal(migrated.bytes,original.bytes);
  assert.equal(migrated.sha256,await digest(new TextEncoder().encode('%PDF-1.4 R2 QA')));
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM archivo_chunks WHERE archivo_id=?').bind(fileId).first()).n,1);
  assert.equal((await env.DB.prepare('SELECT storage_used_bytes FROM familias WHERE id=?').bind(me.familia_id).first()).storage_used_bytes,original.bytes);
  assert.equal((await (await call('platform/storage-migration','POST',{})).json()).complete,true);
  cookie=familyCookie;assert.equal(await (await call('files/'+fileId)).text(),'%PDF-1.4 R2 QA');
  objects.set(migrated.r2_key,new TextEncoder().encode('corrupt'));
  assert.equal(await (await call('files/'+fileId)).text(),'%PDF-1.4 R2 QA'); // Verified D1 fallback.
  const freshRes=await upload(child);assert.equal(freshRes.status,201);const freshId=(await freshRes.json()).id;
  const fresh=await env.DB.prepare('SELECT * FROM archivos WHERE id=?').bind(freshId).first();
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM archivo_chunks WHERE archivo_id=?').bind(freshId).first()).n,0);
  assert.equal(await (await call('files/'+freshId)).text(),'%PDF-1.4 R2 QA');
  const otherFamily=crypto.randomUUID(),otherUser=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO familias(id,nombre) VALUES(?,?)').bind(otherFamily,'Another').run();
  await env.DB.prepare("INSERT INTO usuarios(id,familia_id,nombre,correo,rol) VALUES(?,?,'Other','r2-other@example.test','superadmin')").bind(otherUser,otherFamily).run();
  await env.DB.prepare('INSERT INTO credenciales_usuario(usuario_id,password_hash) VALUES(?,?)').bind(otherUser,await password('OtherPassword!2026')).run();
  await call('login','POST',{correo:'r2-other@example.test',password:'OtherPassword!2026'});
  assert.equal((await call('files/'+fileId)).status,404);assert.equal((await call('files/'+freshId,'DELETE')).status,404);assert.equal((await call('platform/storage-migration','POST',{})).status,401);
  cookie=familyCookie;
  // Tampered key cannot be used to read an object belonging to a different family.
  await env.DB.prepare('UPDATE archivos SET r2_key=? WHERE id=?').bind(otherFamily+'/'+child+'/'+freshId,freshId).run();
  assert.equal((await call('files/'+freshId)).status,500);
  await env.DB.prepare('UPDATE archivos SET r2_key=? WHERE id=?').bind(fresh.r2_key,freshId).run();
  const goodPut=env.FILES.put;env.FILES.put=async(key)=>objects.set(key,new Uint8Array([1]));
  const fileCount=(await env.DB.prepare('SELECT COUNT(*) AS n FROM archivos').first()).n;
  assert.equal((await upload(child)).status,503);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM archivos').first()).n,fileCount);env.FILES.put=goodPut;
  assert.equal((await call('files/'+fileId,'DELETE')).status,200);assert.ok(!objects.has(migrated.r2_key));
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM archivo_chunks WHERE archivo_id=?').bind(fileId).first()).n,0);
  const rndRes=await call('records/credenciales_discapacidad?child='+child,'POST',{activo:1,folio:'QA'});const rnd=(await rndRes.json()).id;
  assert.equal((await call('records/credenciales_discapacidad/'+rnd+'?child='+child,'DELETE')).status,200);assert.ok(!objects.has(fresh.r2_key));
  assert.equal((await env.DB.prepare('SELECT storage_used_bytes FROM familias WHERE id=?').bind(me.familia_id).first()).storage_used_bytes,0);
  cookie=adminCookie;assert.equal((await (await call('platform/storage-migration')).json()).total,0);
 }finally{env.close();}
});
