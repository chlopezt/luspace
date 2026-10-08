import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {todaySchedule,nextSosDose,sosReminders,careValidation} from '../shared/care.js';
test('Santiago school weekdays, weekends, sorting and prescribed SOS intervals',()=>{
 const rows=[{dia:'Lunes',hora_inicio:'10:00'},{dia:'Lunes',hora_inicio:'08:00'}];
 assert.equal(todaySchedule(rows,new Date('2026-10-05T12:00:00Z'))[0].hora_inicio,'08:00');
 assert.equal(todaySchedule(rows,new Date('2026-10-04T12:00:00Z')).length,0);
 assert.equal(nextSosDose({fecha:'2026-10-07T12:00:00Z',intervalo_horas:6}),Date.parse('2026-10-07T18:00:00Z'));
 assert.equal(nextSosDose({fecha:'2026-10-07T12:00:00Z'}),null);
 assert.equal(sosReminders([{medicamento:'QA',fecha:'2026-10-07T12:00:00Z',intervalo_horas:6},{medicamento:'qa',fecha:'2026-10-07T13:00:00Z',intervalo_horas:6}],Date.parse('2026-10-07T14:00:00Z')).length,1);
 assert.ok(careValidation('horario_escolar',{hora_inicio:'10:00',hora_fin:'09:00'}));
 assert.ok(careValidation('horario_escolar',{hora_inicio:'08:70',hora_fin:'10:00'}));
});
test('SOS, emergency and routine CRUD, attachment ownership, readonly and family isolation',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-care-')));let cookie='';
 async function call(path,method='GET',data){const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 try{
 assert.equal((await call('setup','POST',{nombre:'QA',familia:'QA',correo:'care@example.test',password:'FamilyPassword!2026'})).status,201);
 const owner=cookie,me=(await call('me')).body;
 const child=(await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01',rut:'12.345.678-5',grupo_sanguineo:'O+',contacto_emergencia_principal_nombre:'Tutor QA'})).body.id;
 await call(`records/registros_crecimiento?child=${child}`,'POST',{fecha_medicion:'2026-09-01',peso_kg:21,talla_cm:119});
 await call(`records/registros_crecimiento?child=${child}`,'POST',{fecha_medicion:'2026-10-01',peso_kg:24});
 const data={dosis_sos:{fecha:new Date(Date.now()-60000).toISOString(),medicamento:'Registro ficticio',dosis:'Dosis registrada',motivo:'Fiebre',temperatura:38,intervalo_horas:6},urgencias:{fecha:new Date(Date.now()-60000).toISOString(),centro:'Centro QA',motivo:'Motivo QA',diagnostico:'Ejemplo'},horario_escolar:{dia:'Lunes',hora_inicio:'08:00',hora_fin:'09:00',actividad:'Actividad QA',materiales:'Cuaderno'}};
 for(const [table,row] of Object.entries(data)){
   const endpoint=`records/${table}?child=${child}`;const saved=await call(endpoint,'POST',row);assert.equal(saved.status,201,JSON.stringify(saved));
   assert.equal((await call(endpoint)).body.length,1);
   assert.equal((await call(`records/${table}/${saved.body.id}?child=${child}`,'PUT',row)).status,200);
   assert.equal((await call(endpoint,'POST',{...row,adjuntos_json:['not-owned']})).status,400);
 }
 assert.equal((await call(`records/dosis_sos?child=${child}`,'POST',{...data.dosis_sos,temperatura:99})).status,400);
 assert.equal((await call(`records/urgencias?child=${child}`,'POST',{...data.urgencias,fecha:'2099-01-01T12:00:00Z'})).status,400);
 assert.equal((await call(`records/horario_escolar?child=${child}`,'POST',{...data.horario_escolar,hora_fin:'07:00'})).status,400);
 const report=await call('export','POST',{child,modules:['salud','escolar'],selection:['sos','urgent','school_schedule']});assert.equal(report.status,200);assert.equal(report.body.sections.urgencias.length,1);
 assert.equal(report.body.patient_summary.rut,'12.345.678-5');assert.equal(report.body.patient_summary.weight.peso_kg,24);assert.equal(report.body.patient_summary.height.talla_cm,119);assert.equal(report.body.sections.registros_crecimiento,undefined);
 assert.equal((await call('users','POST',{nombre:'Reader',correo:'reader-care@example.test',rol:'lector',password:'ReaderPassword!2026'})).status,201);
 await call('login','POST',{correo:'reader-care@example.test',password:'ReaderPassword!2026'});
 await env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE correo=?').bind(JSON.stringify({modules:['salud'],acciones:['ver','descargar'],privacidad:['rut','telefono']}),'reader-care@example.test').run();
 const restricted=await call('export','POST',{child,modules:['salud'],selection:['urgent']});assert.equal(restricted.status,200);assert.equal(restricted.body.patient_summary.rut,undefined);assert.equal(restricted.body.patient_summary.birth,undefined);assert.equal(restricted.body.patient_summary.weight.peso_kg,24);
 await env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE correo=?').bind(JSON.stringify({modules:['salud','escolar','perfil'],acciones:['ver']}),'reader-care@example.test').run();
 for(const [table,row] of Object.entries(data)){
 const list=await call(`records/${table}?child=${child}`);assert.equal(list.status,200);
 for(const method of ['POST','PUT','DELETE'])assert.equal((await call(`records/${table}${method==='POST'?'':'/'+list.body[0].id}?child=${child}`,method,row)).status,403);
 }
 await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v1',nombre:'Other',familia:'Other',correo:'other-care@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'});
 for(const table of Object.keys(data))assert.equal((await call(`records/${table}?child=${child}`)).status,404);
 cookie=owner;await env.DB.prepare("UPDATE usuarios SET rol='superadmin' WHERE id=?").bind(me.id).run();
 for(const table of Object.keys(data)){const rows=(await call(`records/${table}?child=${child}`)).body;assert.equal((await call(`records/${table}/${rows[0].id}?child=${child}`,'DELETE')).status,200);}
 }finally{env.close();}
});
