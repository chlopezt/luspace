import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {createArchive,restoreArchive,encrypt,decrypt,verifyDatabase,databaseSummary} from '../scripts/backup-core.mjs';

function dump(db){
 const schema=db.prepare("SELECT name,sql,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all();
 const tables=schema.filter(s=>s.type==='table');let sql='PRAGMA foreign_keys=OFF;\n'+tables.map(s=>s.sql+';').join('\n')+'\n';
 for(const table of tables){const columns=db.prepare(`PRAGMA table_info("${table.name}")`).all().filter(c=>!c.hidden).map(c=>c.name);for(const row of db.prepare(`SELECT * FROM "${table.name}"`).all()){const values=columns.map(c=>row[c]==null?'NULL':row[c] instanceof Uint8Array?"X'"+Buffer.from(row[c]).toString('hex')+"'":typeof row[c]==='number'?String(row[c]):"'"+String(row[c]).replaceAll("'","''")+"'");sql+=`INSERT INTO "${table.name}"(${columns.map(c=>'"'+c+'"').join(',')}) VALUES(${values.join(',')});\n`;}}
 return sql+schema.filter(s=>s.type!=='table').map(s=>s.sql+';').join('\n')+'\nPRAGMA foreign_keys=ON;';
}
test('encrypted backups restore two isolated families and reject tampering, missing files and invalid ownership',async()=>{
 mkdirSync(resolve('../work'),{recursive:true});const root=mkdtempSync(resolve('../work','backup-test-')),env=localEnv(root),sourceObjects=new Map();
 env.LUSPACE_R2_ENABLED='true';env.FILES={async put(k,b){sourceObjects.set(k,Buffer.from(b));},async get(k){const b=sourceObjects.get(k);return b?{async arrayBuffer(){return Uint8Array.from(b).buffer;}}:null;},async delete(k){sourceObjects.delete(k);}};
 let ip=0;const request=async(target,path,method='GET',data,cookie='')=>{const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'CF-Connecting-IP':'backup-'+ip++,...(data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),target);return {res,cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 let original;try{
  const password='BackupPassword!2026';
  const a=await request(env,'setup','POST',{nombre:'Admin A',familia:'Familia A',correo:'backup-a@example.test',password});assert.equal(a.res.status,201);const ca=a.cookie;
  const b=await request(env,'register','POST',{nombre:'Admin B',familia:'Familia B',correo:'backup-b@example.test',password,password_confirmation:password});assert.equal(b.res.status,201);const cb=b.cookie;
  const children=[];for(const session of [ca,cb]){const c=await request(env,'children','POST',{primer_nombre:'Niño QA',fecha_nacimiento:'2020-01-01'},session);assert.equal(c.res.status,201);children.push((await c.res.json()).id);}
  const files=[];for(let i=0;i<2;i++){const form=new FormData();form.append('file',new Blob(['%PDF-1.4 Familia '+i],{type:'application/pdf'}),'privado.pdf');const f=await request(env,'files?child='+children[i]+'&module=salud','POST',form,[ca,cb][i]);assert.equal(f.res.status,201);files.push((await f.res.json()).id);}
  // A third attachment remains in D1 to test old formats and binary exports.
  env.LUSPACE_R2_ENABLED='false';const legacy=new FormData();legacy.append('file',new Blob(['%PDF-1.4 Legacy'],{type:'application/pdf'}),'antiguo.pdf');assert.equal((await request(env,'files?child='+children[0]+'&module=salud','POST',legacy,ca)).res.status,201);
  original=new DatabaseSync(resolve(root,'luspace.sqlite'));const before=databaseSummary(original),sql=dump(original),key=randomBytes(32).toString('hex');
  sourceObjects.set('orphan/unknown',Buffer.from('objeto sin referencia'));
  const archive=await createArchive({sql,key,getObject:async k=>sourceObjects.get(k),listObjects:[...sourceObjects].map(([key,value])=>({key,size:value.length}))});
  assert.equal(archive.manifest.summary.families,2);assert.equal(archive.manifest.files.length,3);assert.equal(archive.manifest.extras.length,1);
  for(const encrypted of archive.objects.values())assert.equal(encrypted.includes(Buffer.from('backup-a@example.test')),false);
  const restored=restoreArchive(archive.objects,key);try{
   assert.equal(restored.summary.families,2);assert.equal(restored.db.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n,0);
   assert.equal((await request(restored.env,'children','GET',undefined,ca)).res.status,401);
   const ra=await request(restored.env,'login','POST',{correo:'backup-a@example.test',password});assert.equal(ra.res.status,200);
   const rb=await request(restored.env,'login','POST',{correo:'backup-b@example.test',password});assert.equal(rb.res.status,200);
   for(let i=0;i<2;i++){const session=[ra.cookie,rb.cookie][i];const list=await (await request(restored.env,'children','GET',undefined,session)).res.json();assert.deepEqual(list.map(c=>c.id),[children[i]]);assert.equal((await request(restored.env,'files/'+files[1-i],'GET',undefined,session)).res.status,404);assert.equal((await request(restored.env,'records/vacunas?child='+children[1-i],'GET',undefined,session)).res.status,404);const response=(await request(restored.env,'files/'+files[i],'GET',undefined,session)).res;assert.equal(response.status,200);assert.equal(await response.text(),'%PDF-1.4 Familia '+i);}
  }finally{restored.db.close();}
  const missing=new Map(archive.objects);missing.delete(archive.manifest.files[0].name);assert.throws(()=>restoreArchive(missing,key),/INTEGRITY/);
  const tampered=new Map(archive.objects),changed=Buffer.from(tampered.get('database.sql.gz.enc'));changed[changed.length-1]^=1;tampered.set('database.sql.gz.enc',changed);assert.throws(()=>restoreArchive(tampered,key),/INTEGRITY/);
  assert.throws(()=>restoreArchive(archive.objects,randomBytes(32).toString('hex')),/INTEGRITY/);
  assert.notDeepEqual(encrypt(Buffer.from('same'),key,'file'),encrypt(Buffer.from('same'),key,'file'));
  assert.throws(()=>decrypt(encrypt(Buffer.from('same'),key,'file'),key,'other'),/INTEGRITY/);
  assert.deepEqual(databaseSummary(original),before);
  await assert.rejects(createArchive({sql,key,getObject:async()=>null}),/Archivo no disponible/);
  await assert.rejects(createArchive({sql,key,getObject:async k=>sourceObjects.get(k),maxBytes:1}),/CAPACITY/);
  const bad=new DatabaseSync(':memory:');bad.exec(sql);bad.exec('PRAGMA foreign_keys=OFF');bad.prepare('UPDATE archivos SET familia_id=(SELECT familia_id FROM ninos WHERE id=?) WHERE id=?').run(children[1],files[0]);assert.throws(()=>verifyDatabase(bad),/ISOLATION/);bad.close();
 }finally{original?.close();env.close();}
});

test('backup operational summaries are platform-admin only and do not include clinical information',async()=>{
 const root=mkdtempSync(resolve('../work','backup-status-test-')),env=localEnv(root);let ip=0;
 const call=async(path,method='GET',body,cookie='')=>{const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json','CF-Connecting-IP':'status-'+ip++},body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 try{const setup=await call('setup','POST',{nombre:'QA',familia:'QA',correo:'backup-status@example.test',password:'FamilyPassword!2026'});const session=setup.cookie,me=(await call('me','GET',undefined,session)).data;assert.equal((await call('platform/backups','GET',undefined,session)).status,401);await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();await call('platform/enroll','POST',{correo:'backup-platform@example.test',current_password:'FamilyPassword!2026',password:'PlatformPassword!2026'},session);const login=await call('platform/login','POST',{correo:'backup-platform@example.test',password:'PlatformPassword!2026'});assert.equal(login.status,200);const report=await call('platform/backups','GET',undefined,login.cookie);assert.equal(report.status,200);assert.equal(report.data.state,'pending');assert.equal(JSON.stringify(report.data).includes('password_hash'),false);assert.equal((await call('platform/backups','POST',{},login.cookie)).status,404);
 }finally{env.close();}
});
