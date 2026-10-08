import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {currentCaregiver,expenseTotals,careValidation} from '../shared/care.js';
test('caregiver state, reimbursements and nonwrapping routine styles',()=>{
 const at=Date.parse('2026-10-07T12:00:00Z');
 assert.equal(currentCaregiver([{id:'closed',hora_inicio:'2026-10-07T08:00:00Z',hora_fin:'2026-10-07T09:00:00Z'},{id:'current',hora_inicio:'2026-10-07T10:00:00Z',hora_fin:''}],at).id,'current');
 assert.equal(currentCaregiver([{hora_inicio:'2026-10-07T13:00:00Z',hora_fin:''}],at),null);
 assert.deepEqual(expenseTotals([{monto:30000,monto_reembolsado:10000,estado_reembolso:'Pendiente en Isapre/Fonasa'},{monto:20000,monto_reembolsado:20000,estado_reembolso:'Reembolsado'}]),{spent:50000,reimbursed:30000,pending:20000});
 assert.ok(careValidation('gastos_medicos',{monto:100,monto_reembolsado:101,fecha:'2026-10-07'},'',at));
 assert.ok(careValidation('gastos_medicos',{monto:100.5,fecha:'2026-10-07'},'',at));
 assert.ok(careValidation('turnos_cuidadores',{hora_inicio:'2026-10-07T10:00:00Z',hora_fin:'2026-10-07T09:00:00Z'},'2020-01-01',at));
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.daily-routine time\s*\{[^}]*white-space:nowrap/);
 assert.match(css,/\.daily-routine li\s*\{[^}]*align-items:center/);
});
test('therapy, expenses and handovers preserve family isolation, files, reader RBAC and one active caregiver',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-team-')));let cookie='';
 async function call(path,method='GET',data){const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,...(data instanceof FormData ? {} : {'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 try{
 assert.equal((await call('setup','POST',{nombre:'QA',familia:'A',correo:'team-a@example.test',password:'FamilyPassword!2026'})).status,201);
 const owner=cookie,child=(await call('children','POST',{primer_nombre:'QA',fecha_nacimiento:'2020-01-01'})).body.id;
 const form=new FormData();form.append('file',new Blob(['%PDF-1.4 QA'],{type:'application/pdf'}),'pauta.pdf');const file=(await call(`files?child=${child}&module=salud`,'POST',form)).body.id;
 const start=new Date(Date.now()-3600000).toISOString();
 const data={sesiones_terapia:{profesional:'Profesional QA',especialidad:'Fonoaudiología',fecha:start,objetivos:'Meta de prueba',tareas_hogar:'Tarea asignada',avances:'Avance registrado',adjuntos_json:[file]},gastos_medicos:{fecha:'2026-10-01',concepto:'Terapia',monto:30000,estado_reembolso:'Pendiente en Isapre/Fonasa',monto_reembolsado:5000,adjuntos_json:[file]},turnos_cuidadores:{cuidador:'Cuidador QA',hora_inicio:start,hora_fin:'',notas_entrega:'Entrega de prueba',adjuntos_json:[file]}};
 const ids={};
 for(const [table,row]of Object.entries(data)){
   const saved=await call(`records/${table}?child=${child}`,'POST',row);assert.equal(saved.status,201,JSON.stringify(saved));ids[table]=saved.body.id;
   assert.equal((await call(`records/${table}/${saved.body.id}?child=${child}`,'PUT',row)).status,200);
   assert.equal((await call(`records/${table}?child=${child}`,'POST',{...row,adjuntos_json:['foreign-file']})).status,400);
 }
 assert.equal((await call(`records/gastos_medicos?child=${child}`,'POST',{...data.gastos_medicos,monto_reembolsado:30001})).status,400);
 assert.equal((await call(`records/turnos_cuidadores?child=${child}`,'POST',data.turnos_cuidadores)).status,409);
 // The database itself protects against a race bypassing the friendly pre-check.
 await assert.rejects(env.DB.prepare("INSERT INTO turnos_cuidadores(id,nino_id,cuidador,hora_inicio) VALUES(?,?,?,?)").bind('race',child,'Concurrent',start).run(),/UNIQUE/);
 const closed={...data.turnos_cuidadores,hora_fin:new Date(Date.now()-1000).toISOString()};
 assert.equal((await call(`records/turnos_cuidadores/${ids.turnos_cuidadores}?child=${child}`,'PUT',closed)).status,200);
 assert.equal((await call(`records/turnos_cuidadores?child=${child}`,'POST',{...data.turnos_cuidadores,hora_inicio:new Date(Date.now()-500).toISOString(),cuidador:'Nuevo cuidador'})).status,201);
 const exportData=await call('export','POST',{child,modules:['salud'],selection:['therapy','expenses','caregivers']});assert.equal(exportData.status,200);assert.equal(exportData.body.sections.sesiones_terapia.length,1);assert.equal(exportData.body.sections.turnos_cuidadores.length,2);
 assert.equal((await call('users','POST',{nombre:'Reader',correo:'team-reader@example.test',rol:'lector',password:'ReaderPassword!2026'})).status,201);
 await call('login','POST',{correo:'team-reader@example.test',password:'ReaderPassword!2026'});
 for(const [table,row]of Object.entries(data)){
   assert.equal((await call(`records/${table}?child=${child}`)).status,200);
   assert.equal((await call(`records/${table}?child=${child}`,'POST',row)).status,403);
   assert.equal((await call(`records/${table}/${ids[table]}?child=${child}`,'PUT',row)).status,403);
   assert.equal((await call(`records/${table}/${ids[table]}?child=${child}`,'DELETE')).status,403);
 }
 await call('register','POST',{legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v3',nombre:'QA B',familia:'B',correo:'team-b@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'});
 for(const table of Object.keys(data))assert.equal((await call(`records/${table}?child=${child}`)).status,404);
 assert.equal((await call('files/'+file)).status,404);
 cookie=owner;
 for(const table of Object.keys(data))assert.equal((await call(`records/${table}/${ids[table]}?child=${child}`,'DELETE')).status,200);
 }finally{env.close();}
});
