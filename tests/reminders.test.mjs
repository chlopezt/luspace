import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {LEGAL_VERSION} from '../shared/legal.js';
test('reminders: CRUD, concurrency, readonly, family isolation and backup',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-reminders-')));let cookie='';
 async function call(path,method='GET',data){const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 try{
 assert.equal((await call('setup','POST',{nombre:'QA',familia:'QA',correo:'reminders@example.test',password:'FamilyPassword!2026'})).status,201);
 const owner=cookie,me=(await call('me')).body;
 const child=(await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01'})).body.id;
 const payload={titulo:'Recordatorio ficticio',categoria:'Salud',fecha:'2026-10-20T12:00:00Z',nino_id:child,responsable_id:me.id,notas:'Notas QA'};
 const created=await call('reminders','POST',payload);assert.equal(created.status,201,JSON.stringify(created));const id=created.body.id;
 assert.equal((await call('reminders','POST',{...payload,titulo:''})).status,400);
 assert.equal((await call('reminders','POST',{...payload,fecha:'invalid'})).status,400);
 assert.equal((await call('reminders','POST',{...payload,nino_id:'other'})).status,404);
 assert.equal((await call('reminders','POST',{...payload,responsable_id:'other'})).status,400);
 assert.equal((await call('reminders/'+id,'PATCH',{version:1,completado:true})).status,200);
 assert.equal((await call('reminders/'+id,'PUT',{...payload,version:1})).status,409);
 assert.equal((await call('reminders')).body.rows[0].completado,1);
 assert.equal((await call('reminders/'+id,'PATCH',{version:2,completado:false})).status,200);
 assert.equal((await call('reminders/'+id,'PUT',{...payload,version:3,nino_id:null,responsable_id:null})).status,200);
 assert.equal((await call('backup')).body.recordatorios[0].id,id);
 assert.equal((await call('users','POST',{nombre:'Lector QA',correo:'reminder-reader@example.test',rol:'lector',password:'ReaderPassword!2026'})).status,201);
 await call('login','POST',{correo:'reminder-reader@example.test',password:'ReaderPassword!2026'});
 assert.equal((await call('reminders')).status,200);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await call(method==='POST'?'reminders':'reminders/'+id,method,{...payload,version:4,completado:true})).status,403);
 await env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE correo=?').bind(JSON.stringify({modules:['salud'],acciones:['ver']}),'reminder-reader@example.test').run();assert.equal((await call('reminders')).status,403);
 assert.equal((await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:LEGAL_VERSION,nombre:'Other',familia:'Other',correo:'other-reminder@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'})).status,201);
 assert.equal((await call('reminders')).body.rows.length,0);
 assert.equal((await call('reminders/'+id,'DELETE',{version:4})).status,404);
 assert.equal((await call('reminders','POST',payload)).status,404);
 cookie=owner;
 const guest=await call('guests?child='+child,'POST',{nombre:'Profesional QA',hours:24,modules:['recordatorios'],pin:'1234',single:false});assert.equal(guest.status,201);
 cookie='';assert.equal((await call('guest/exchange','POST',{token:guest.body.url.split('#')[1],pin:'1234'})).status,200);
 assert.equal((await call('reminders')).status,403,'guest cannot access family reminders even with a module in its link');
 cookie=owner;
 await env.DB.prepare("UPDATE familias SET commercial_exempt=0,subscription_status='expired',trial_ends_at=? WHERE id=?").bind(new Date(Date.now()-86400000).toISOString(),me.familia_id).run();
 assert.equal((await call('reminders')).status,200,'grace permits consultation');
 assert.equal((await call('reminders','POST',payload)).status,403,'expiry blocks writes');
 await env.DB.prepare('UPDATE familias SET commercial_exempt=1 WHERE id=?').bind(me.familia_id).run();
 assert.equal((await call('reminders/'+id,'DELETE',{version:4})).status,200);
 assert.equal((await call('reminders')).body.rows.length,0);
 }finally{env.close();}
});
