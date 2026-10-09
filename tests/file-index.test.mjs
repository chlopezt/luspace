import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {fileCatalog} from '../server/file-catalog.js';
test('family file index isolates metadata and enforces document permissions',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-file-index-')));let cookie='';
 const call=async(path,method='GET',data)=>{const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;};
 try{
  assert.equal((await call('setup','POST',{nombre:'QA',familia:'QA',correo:'index@example.test',password:'FamilyPassword!2026'})).status,201);
  const me=await(await call('me')).json(),own=cookie;
  const n=await(await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01'})).json();
  const id=crypto.randomUUID(),bytes=Uint8Array.from([255,216,255,224,0,16,255,217]);
  await env.DB.prepare('INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,contenido) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,me.familia_id,n.id,'salud','exam.jpg','image/jpeg',bytes.length,'d1:'+id,bytes).run();
  const list=await(await call('file-index')).json();assert.equal(list.total,1);assert.equal(list.items[0].can_download,true);assert.equal(list.items[0].seccion,'Salud');assert.ok(!('r2_key' in list.items[0]));assert.ok(!('contenido' in list.items[0]));
  assert.equal((await(await call('file-index?q=absent')).json()).total,0);
  const actor={...me,rol:'lector',guest:false};
  const restricted={modules:['salud'],acciones:['ver'],sensibles:[]};
  assert.equal((await fileCatalog(env.DB,actor,restricted,['salud'])).length,0);
  assert.equal((await fileCatalog(env.DB,actor,{...restricted,privacidad:['archivos']},['salud'])).length,0);
  assert.equal((await fileCatalog(env.DB,actor,{modules:['salud'],acciones:['ver']},['salud']))[0].can_download,false);
  assert.equal((await fileCatalog(env.DB,actor,{modules:['salud'],acciones:['ver']},[])).length,0);
  // Apply a read-only permission to the same test user; direct URL cannot bypass download RBAC.
  await env.DB.prepare('UPDATE usuarios SET rol=?,permisos_json=? WHERE id=?').bind('editor',JSON.stringify({modules:['salud'],acciones:['ver']}),me.id).run();
  assert.equal((await call('files/'+id)).status,200);
  assert.equal((await call('files/'+id+'?download=1')).status,403);
  await env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE id=?').bind(JSON.stringify({...restricted}),me.id).run();
  assert.equal((await call('files/'+id)).status,403);
  assert.equal((await(await call('files?child='+n.id+'&module=salud')).json()).length,0);
  assert.equal((await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v3',nombre:'Other',familia:'Other',correo:'index-other@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'})).status,201);
  assert.equal((await(await call('file-index')).json()).total,0);
  assert.equal((await call('files/'+id)).status,404);
  cookie=own;assert.equal((await(await call('file-index?child=foreign')).json()).total,0);
 }finally{env.close();}
});
