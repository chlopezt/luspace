import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from 'node:sqlite';
import { models, fieldVisible } from '../shared/models.js';
import { resolve } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
import { calendarAge } from "../shared/dates.js";
mkdirSync(resolve("../work"), {recursive:true});
const dir = mkdtempSync(resolve("../work", "api-test-")),
  env = localEnv(dir);
const origin = "http://localhost:5173";
let cookie = "";
let ip = 0;
async function call(path, method = "GET", data, session = cookie, extras = {}) {
  const req = new Request(origin + "/api/" + path, {
    method,
    headers: {
      origin,
      cookie: session,
      "CF-Connecting-IP": `test-${ip++}`,
      ...(data instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...extras,
    },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const response = await handle(req, env);
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
const baseChild = {
  primer_nombre: "Prueba",
  apellidos: "QA",
  apodo: "Lu",
  fecha_nacimiento: "2018-05-20",
  sexo_referencia: "masculino",
  grupo_sanguineo: "",
  alergias: "",
  rnd_habilitado: 1,
};
test("authentication, family isolation, CRUD, guest scope, revocation, files, exports and audit", async () => {
  assert.equal((await call("children")).status, 401);
  const setup = await call("setup", "POST", {
    nombre: "QA Admin",
    familia: "Familia QA",
    correo: "admin@example.test",
    password: "QaPassword!2026",
  });
  assert.equal(setup.status, 201, JSON.stringify(setup));
  cookie = setup.cookie;
  const owner = cookie;
  assert.equal((await call("setup", "POST", { nombre: "X" })).status, 409);
  assert.equal(
    (
      await call("children", "POST", baseChild, owner, {
        origin: "http://evil.test",
      })
    ).status,
    403,
  );
  const c = await call("children", "POST", baseChild);
  assert.equal(c.status, 201, JSON.stringify(c));
  const child = c.body.id;
  const me = (await call("me")).body;
  await env.DB.prepare("INSERT INTO familias(id,nombre) VALUES(?,?)")
    .bind("other-family", "Otra")
    .run();
  await env.DB.prepare(
    "INSERT INTO ninos(id,familia_id,primer_nombre,fecha_nacimiento) VALUES(?,?,?,?)",
  )
    .bind("other-child", "other-family", "Privado", "2018-01-01")
    .run();
  assert.equal(
    (await call("records/medicamentos?child=other-child")).status,
    404,
  );
  assert.equal(
    (await call("children/other-child", "PUT", baseChild)).status,
    404,
  );
  const growth = {
    fecha_medicion: "2026-01-01",
    peso_kg: 25,
    talla_cm: 125,
    perimetro_cefalico_cm: "",
    notas: "QA",
  };
  assert.equal(
    (
      await call(`records/registros_crecimiento?child=${child}`, "POST", {
        ...growth,
        peso_kg: -5,
      })
    ).status,
    400,
  );
  const rec = await call(
    `records/registros_crecimiento?child=${child}`,
    "POST",
    growth,
  );
  assert.equal(rec.status, 201, JSON.stringify(rec));
  assert.equal(
    (
      await call(
        `records/registros_crecimiento/${rec.body.id}?child=${child}`,
        "PUT",
        { ...growth, peso_kg: 26 },
      )
    ).status,
    200,
  );
  const user = await call("users", "POST", {
    nombre: "Editora",
    correo: "editor@example.test",
    rol: "editor",
    password: "QaPassword!2026",
  });
  assert.equal(user.status, 201, JSON.stringify(user));
  const editorLogin = await call(
    "login",
    "POST",
    { correo: "editor@example.test", password: "QaPassword!2026" },
    "",
  );
  assert.equal(editorLogin.status, 200);
  const editor = editorLogin.cookie;
  assert.equal((await call("audit", "GET", undefined, editor)).status, 403);
  assert.equal((await call("backup", "GET", undefined, editor)).status, 403);
  assert.equal((await call("users", "GET", undefined, editor)).status, 403);
  assert.equal(
    (
      await call(
        `records/registros_crecimiento?child=${child}`,
        "GET",
        undefined,
        editor,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`anamnesis?child=${child}`, "PUT", {
        documento: { identificacion: { 0: "Padres QA" } },
        version: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`anamnesis?child=${child}`, "PUT", {
        documento: {},
        version: 0,
      })
    ).status,
    409,
  );
  const fd = new FormData();
  fd.append(
    "file",
    new Blob(["%PDF-1.4\nQA"], { type: "application/pdf" }),
    "receta.pdf",
  );
  const file = await call(`files?child=${child}&module=salud`, "POST", fd);
  assert.equal(file.status, 201, JSON.stringify(file));
  assert.equal((await call("files/" + file.body.id)).status, 200);
  const bad = new FormData();
  bad.append(
    "file",
    new Blob(["<script>alert(1)</script>"], { type: "image/png" }),
    "x.png",
  );
  assert.equal(
    (await call(`files?child=${child}&module=salud`, "POST", bad)).status,
    400,
  );
  const g = await call(`guests?child=${child}`, "POST", {
    nombre: "Profesional",
    hours: 24,
    modules: ["anamnesis"],
    pin: "1234",
    single: true,
  });
  assert.equal(g.status, 201, JSON.stringify(g));
  const tok = g.body.url.split("#")[1];
  assert.equal(
    (await call("guest/exchange", "POST", { token: tok, pin: "0000" }, ""))
      .status,
    403,
  );
  const exchanges = await Promise.all([
    call("guest/exchange", "POST", { token: tok, pin: "1234" }, ""),
    call("guest/exchange", "POST", { token: tok, pin: "1234" }, ""),
  ]);
  assert.deepEqual(exchanges.map((x) => x.status).sort(), [200, 403]);
  const guest = exchanges.find((x) => x.status === 200).cookie;
  assert.equal(
    (await call(`anamnesis?child=${child}`, "GET", undefined, guest)).status,
    200,
  );
  assert.equal(
    (
      await call(
        `anamnesis?child=${child}`,
        "PUT",
        { documento: {}, version: 1 },
        guest,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `records/registros_crecimiento?child=${child}`,
        "GET",
        undefined,
        guest,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("files/" + file.body.id, "GET", undefined, guest)).status,
    403,
  );
  assert.equal(
    (await call("export", "POST", { child, modules: ["salud"] }, guest)).status,
    403,
  );
  const report = await call(
    "export",
    "POST",
    { child, modules: ["anamnesis"] },
    guest,
  );
  assert.equal(report.status, 200);
  assert.equal(report.body.anamnesis.identificacion[0], "Padres QA");
  const granular = await call('export','POST',{child,modules:['anamnesis'],selection:['anamnesis_identificacion']},guest);
  assert.equal(granular.status,200);
  assert.deepEqual(Object.keys(granular.body.anamnesis),['identificacion']);
  assert.equal(granular.body.child.fecha_nacimiento,undefined);
  const documentReport=await call('export','POST',{child,modules:['salud'],selection:['documents']});
  assert.equal(documentReport.status,200);
  assert.deepEqual(documentReport.body.sections,{});
  assert.ok(documentReport.body.documents.every(f=>!('r2_key' in f)&&!('familia_id' in f)));
  assert.equal((await call('export','POST',{child:'other-child',modules:['salud'],selection:['documents']})).status,404);
  assert.equal((await call('export','POST',{child,modules:['anamnesis'],selection:['diagnoses']},guest)).status,400);
  assert.equal((await call('export','POST',{child,modules:['salud'],selection:['nutrition']},guest)).status,403);
  assert.equal((await call('export','POST',{child,modules:['anamnesis'],selection:['invented']},guest)).status,400);
  const guests = (await call("guests?child=" + child)).body;
  assert.equal("token_hash" in guests[0], false);
  assert.equal((await call("guests/" + guests[0].id, "DELETE")).status, 200);
  assert.equal((await call("me", "GET", undefined, guest)).status, 401);
  assert.equal(
    (await call("users/" + user.body.id, "PUT", { activo: false })).status,
    200,
  );
  assert.equal((await call("me", "GET", undefined, editor)).status, 401);
  const backup = (await call("backup")).body;
  assert.equal(backup.ninos.length, 1);
  assert.equal(backup.ninos[0].id, child);
  assert.equal(JSON.stringify(backup).includes("password_hash"), false);
  assert.equal(JSON.stringify(backup).includes("token_hash"), false);
  assert.equal(
    (
      await call(
        `records/registros_crecimiento/${rec.body.id}?child=${child}`,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal((await call("audit")).status, 403);
  await env.DB.prepare("UPDATE usuarios SET audit_visible=1 WHERE correo=?").bind("admin@example.test").run();
  const logs = (await call("audit")).body;
  for (const action of [
    "CREATE",
    "UPDATE",
    "DELETE",
    "GUEST_ACCESS",
    "DOWNLOAD_PDF",
    "REVOKE",
    "BACKUP_EXPORT",
  ])
    assert.ok(
      logs.some((l) => l.accion === action),
      action,
    );
  assert.ok(logs.every((l) => l.familia_id === me.familia_id));
  await call("logout", "POST");
  assert.equal((await call("me")).status, 401);
  env.close();
});
test("calendar age handles end-of-month and leap days", () => {
  assert.deepEqual(calendarAge("2020-01-31", "2020-03-01"), {years:0,months:1,days:1});
  assert.deepEqual(calendarAge("2020-02-29", "2021-02-28"), {years:1,months:0,days:0});
  assert.equal(calendarAge("2027-01-01", "2026-01-01"), null);
});
test('household, hospital history and consultation companion persist without erasing legacy fields',async()=>{
 const env=localEnv(mkdtempSync(resolve('../work','profile-fields-')));let cookie='';
 const call=async(path,method='GET',data)=>{
  const res=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,body:await res.json()};
 };
 try{
  await call('setup','POST',{nombre:'QA',familia:'QA',correo:'fields@example.test',password:'FamilyPassword!2026'});
  const base={primer_nombre:'QA',fecha_nacimiento:'2020-01-01',convivientes:'Tía y abuela',hospitalizado:'Sí',hospitalizacion_motivo:'Antecedente registrado',hospitalizacion_estadia:'3 días'};
  const created=await call('children','POST',base);assert.equal(created.status,201);const id=created.body.id;
  let row=(await call('children')).body[0];assert.equal(row.convivientes,'Tía y abuela');assert.equal(row.hospitalizacion_estadia,'3 días');
  const hospitalField=models.ninos.fields.find(f=>f.key==='hospitalizacion_motivo');assert.equal(fieldVisible(hospitalField,row),true);
  assert.equal((await call('children/'+id,'PUT',{...base,hospitalizado:'No'})).status,200);
  row=(await call('children')).body[0];assert.equal(row.hospitalizacion_motivo,base.hospitalizacion_motivo);assert.equal(fieldVisible(hospitalField,row),false);
  assert.equal((await call('children/'+id,'PUT',{primer_nombre:'QA editado',fecha_nacimiento:base.fecha_nacimiento})).status,200);
  row=(await call('children')).body[0];assert.equal(row.convivientes,base.convivientes);assert.equal(row.hospitalizado,'No');assert.equal(row.hospitalizacion_estadia,'3 días');
  assert.equal((await call('children/'+id,'PUT',{...base,hospitalizado:'quizás'})).status,400);
  assert.equal((await call('children/'+id,'PUT',{...base,convivientes:'x'.repeat(181)})).status,400);
  const visit={fecha:'2026-11-01T15:00:00Z',medico_nombre:'Profesional QA',especialidad:'Neurología',acompanante:'Madre'};
  const consultation=await call('records/consultas_medicas?child='+id,'POST',visit);assert.equal(consultation.status,201);
  const endpoint='records/consultas_medicas/'+consultation.body.id+'?child='+id;
  assert.equal((await call(endpoint,'PUT',{fecha:visit.fecha,medico_nombre:visit.medico_nombre,especialidad:'Especialidad personalizada antigua'})).status,200);
  let visits=(await call('records/consultas_medicas?child='+id)).body;assert.equal(visits[0].especialidad,'Especialidad personalizada antigua');assert.equal(visits[0].acompanante,'Madre');
  assert.equal((await call(endpoint,'PUT',{...visit,especialidad:'Enfermería',acompanante:'Tía'})).status,200);
  visits=(await call('records/consultas_medicas?child='+id)).body;assert.equal(visits[0].especialidad,'Enfermería');assert.equal(visits[0].acompanante,'Tía');
  assert.equal((await call(endpoint,'PUT',{...visit,acompanante:'x'.repeat(181)})).status,400);
  assert.equal((await call('users','POST',{nombre:'Reader',correo:'fields-reader@example.test',rol:'lector',password:'ReaderPassword!2026'})).status,201);
  const owner=cookie;assert.equal((await call('login','POST',{correo:'fields-reader@example.test',password:'ReaderPassword!2026'})).status,200);
  assert.equal((await call('children/'+id,'PUT',base)).status,403);assert.equal((await call(endpoint,'PUT',visit)).status,403);
  cookie=owner;
  assert.equal((await call('register','POST',{nombre:'Other',familia:'Other',correo:'fields-other@example.test',password:'OtherPassword!2026',password_confirmation:'OtherPassword!2026'})).status,201);
  assert.deepEqual((await call('children')).body,[]);assert.equal((await call(endpoint)).status,404);
 }finally{env.close();}
});
test('additive profile migration preserves existing data and does not assume hospital history',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE ninos(id TEXT,primer_nombre TEXT); CREATE TABLE consultas_medicas(id TEXT,especialidad TEXT); INSERT INTO ninos VALUES('old','QA'); INSERT INTO consultas_medicas VALUES('visit','Especialidad antigua');");
  db.exec(readFileSync(new URL('../db/migrations/0018_profile_household_hospitalization.sql',import.meta.url),'utf8'));
  const profile=db.prepare('SELECT * FROM ninos').get();assert.equal(profile.primer_nombre,'QA');assert.equal(profile.hospitalizado,'');assert.equal(profile.convivientes,'');
  const visit=db.prepare('SELECT * FROM consultas_medicas').get();assert.equal(visit.especialidad,'Especialidad antigua');assert.equal(visit.acompanante,'');
 }finally{db.close();}
});
