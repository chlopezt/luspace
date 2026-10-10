import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnv } from '../server/local.js';
import { handle } from '../server/api.js';
import { hash, token } from '../server/security.js';
import { modules } from '../shared/models.js';
import { permissionActions, projectRecord } from '../shared/access-policy.js';

const origin = 'http://localhost:5173';
const allModules = Object.keys(modules);
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'luspace-authorization-'));
  const env = localEnv(dir);
  t.after(() => { env.close(); rmSync(dir, { recursive: true, force: true }); });
  let ip = 0;
  async function call(path, method = 'GET', data, cookie = owner) {
    const response = await handle(new Request(origin + '/api/' + path, {
      method, headers: { origin, cookie, 'CF-Connecting-IP': 'authorization-' + ip++,
        ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
    }), env);
    const raw = await response.text();
    let body; try { body = JSON.parse(raw); } catch { body = raw; }
    return { status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  let owner = '';
  const setup = await call('setup', 'POST', {
    nombre: 'QA owner', familia: 'QA family', correo: 'owner@example.test', password: 'SyntheticPassword2026!',
  }, '');
  assert.equal(setup.status, 201);
  owner = setup.cookie;
  const me = (await call('me')).body;
  const child = crypto.randomUUID(), sibling = crypto.randomUUID(), foreign = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO familias(id,nombre) VALUES(?,?)').bind('foreign-family', 'Foreign QA').run();
  for (const [id, family, name] of [[child, me.familia_id, 'Authorized'], [sibling, me.familia_id, 'Sibling'], [foreign, 'foreign-family', 'Foreign']]) {
    await env.DB.prepare(`INSERT INTO ninos(id,familia_id,primer_nombre,apellidos,fecha_nacimiento,rut,diagnostico,contacto_emergencia_principal_telefono,rnd_habilitado)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(id, family, name, 'Private surname', '2020-01-01', '12.345.678-5', 'PRIVATE_PROFILE_DIAGNOSIS', 'PRIVATE_PHONE', 1).run();
  }
  const visit = crypto.randomUUID(), file = crypto.randomUUID();
  const bytes = new TextEncoder().encode('%PDF-1.4 QA');
  await env.DB.prepare('INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,contenido) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(file, me.familia_id, child, 'salud', 'PRIVATE_DOCUMENT.pdf', 'application/pdf', bytes.length, 'd1:' + file, bytes).run();
  await env.DB.prepare('INSERT INTO consultas_medicas(id,nino_id,fecha,medico_nombre,diagnostico,archivo_r2_key) VALUES(?,?,?,?,?,?)')
    .bind(visit, child, '2026-01-01T12:00', 'QA doctor', 'PRIVATE_VISIT_DIAGNOSIS', file).run();
  await env.DB.prepare('INSERT INTO examenes_medicos(id,nino_id,nombre,fecha,observaciones) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(), child, 'PRIVATE_EXAM', '2026-01-01', 'PRIVATE_EXAM_RESULT').run();
  await env.DB.prepare('INSERT INTO anamnesis(id,nino_id,documento_json) VALUES(?,?,?)')
    .bind(crypto.randomUUID(), child, JSON.stringify({ identificacion: { 0: 'PRIVATE_FAMILY_CONTACT' }, antecedentes: { 0: 'PRIVATE_HISTORY_DIAGNOSIS' }, desarrollo: { 0: 'Visible development' } })).run();
  async function user(policy, role = 'editor') {
    const id = crypto.randomUUID(), raw = token();
    await env.DB.prepare('INSERT INTO usuarios(id,familia_id,nombre,correo,rol,permisos_json,ai_visible) VALUES(?,?,?,?,?,?,1)')
      .bind(id, me.familia_id, 'QA member', id + '@example.test', role, typeof policy === 'string' ? policy : JSON.stringify(policy)).run();
    await env.DB.prepare('INSERT INTO sesiones(id,usuario_id,expira_at) VALUES(?,?,?)')
      .bind(await hash(raw), id, new Date(Date.now() + 3600000).toISOString()).run();
    return 'luspace_session=' + raw;
  }
  return { env, call, user, owner, child, sibling, foreign, file, visit, me };
}

test('privacy and sensitive permissions filter profiles, records, reports, file metadata and stored updates', async t => {
  const f = await fixture(t);
  const cookie = await f.user({ modules: allModules, acciones: permissionActions, sensibles: [], privacidad: ['rut', 'telefono', 'direccion', 'diagnosticos', 'archivos'] });
  const children = await f.call('children', 'GET', undefined, cookie);
  assert.equal(children.status, 200);
  assert.equal(children.body.length, 2);
  assert.equal(children.body[0].rut, undefined);
  assert.equal(children.body[0].contacto_emergencia_principal_telefono, undefined);
  assert.equal(children.body[0].diagnostico, undefined);
  assert.equal(children.body[0].rnd_habilitado, 0);
  const records = await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, cookie);
  assert.equal(records.status, 200);
  assert.equal(records.body[0].medico_nombre, 'QA doctor');
  assert.equal(records.body[0].diagnostico, undefined);
  assert.equal(records.body[0].archivo_r2_key, undefined);
  assert.deepEqual((await f.call('records/examenes_medicos?child=' + f.child, 'GET', undefined, cookie)).body, []);
  assert.equal((await f.call('anamnesis?child=' + f.child, 'GET', undefined, cookie)).status, 403);
  assert.equal((await f.call('records/credenciales_discapacidad?child=' + f.child, 'GET', undefined, cookie)).status, 403);
  for (const selection of [undefined, ['personal', 'diagnoses', 'emergency', 'exams', 'appointments_past', 'documents']]) {
    const report = await f.call('export', 'POST', { child: f.child, modules: ['perfil', 'salud'], ...(selection ? { selection } : {}) }, cookie);
    assert.equal(report.status, 200);
    for (const secret of ['12.345.678-5', 'PRIVATE_PHONE', 'PRIVATE_PROFILE_DIAGNOSIS', 'PRIVATE_VISIT_DIAGNOSIS', 'PRIVATE_EXAM', 'PRIVATE_DOCUMENT'])
      assert.ok(!JSON.stringify(report.body).includes(secret), secret);
    assert.equal(report.body.patient_summary.rut, undefined);
  }
  for (const path of ['files/' + f.file, 'files/' + f.file + '/metadata', 'files/' + f.file + '?download=1'])
    assert.equal((await f.call(path, 'GET', undefined, cookie)).status, 403);
  assert.equal((await f.call('file-index', 'GET', undefined, cookie)).body.total, 0);
  const preview = await f.call('consultation/preview', 'POST', { child: f.child, modules: ['salud'], concern: 'QA concern' }, cookie);
  assert.equal(preview.status, 200);
  assert.ok(!JSON.stringify(preview.body).includes('PRIVATE_VISIT_DIAGNOSIS'));
  assert.ok(!JSON.stringify(preview.body).includes('PRIVATE_EXAM'));
  assert.equal((await f.call('children/' + f.child, 'PUT', { primer_nombre: 'Changed', fecha_nacimiento: '2020-01-01' }, cookie)).status, 200);
  assert.equal((await f.call('children/' + f.child, 'PUT', { primer_nombre: 'Changed', fecha_nacimiento: '2020-01-01', diagnostico: 'Forbidden overwrite' }, cookie)).status, 200);
  const stored = await f.env.DB.prepare('SELECT rut,diagnostico,contacto_emergencia_principal_telefono FROM ninos WHERE id=?').bind(f.child).first();
  assert.equal(stored.diagnostico, 'PRIVATE_PROFILE_DIAGNOSIS');
  assert.equal(stored.rut, '12.345.678-5');
  assert.equal(stored.contacto_emergencia_principal_telefono, 'PRIVATE_PHONE');
  assert.equal((await f.call('children')).body.find(n => n.id === f.child).diagnostico, 'PRIVATE_PROFILE_DIAGNOSIS');
});

test('guest scope precedes profile projection even when the profile module is blocked', async t => {
  const f = await fixture(t);
  const share = await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA professional', hours: 24, modules: ['salud', 'anamnesis'] });
  assert.equal(share.status, 201);
  const exchange = await f.call('guest/exchange', 'POST', { token: share.body.url.split('#')[1] }, '');
  assert.equal(exchange.status, 200);
  const guest = exchange.cookie;
  await f.env.DB.prepare('INSERT INTO plataforma_controles_familia(familia_id,modulos_bloqueados_json) VALUES(?,?)')
    .bind(f.me.familia_id, '["perfil"]').run();
  const children = await f.call('children', 'GET', undefined, guest);
  assert.equal(children.status, 200);
  assert.deepEqual(children.body.map(n => n.id), [f.child]);
  assert.equal(children.body[0].rut, undefined);
  assert.equal(children.body[0].apellidos, undefined);
  for (const id of [f.sibling, f.foreign]) {
    for (const path of ['records/consultas_medicas?child=', 'anamnesis?child=', 'files?module=salud&child='])
      assert.equal((await f.call(path + id, 'GET', undefined, guest)).status, 404);
    assert.equal((await f.call('export', 'POST', { child: id, modules: ['salud'] }, guest)).status, 404);
  }
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, guest)).status, 200);
  assert.equal((await f.call('export', 'POST', { child: f.child, modules: ['anamnesis'] }, guest)).status, 200);
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'POST', {}, guest)).status, 403);
});

test('empty, missing, malformed and unsupported permissions never become full editor access', async t => {
  const f = await fixture(t);
  for (const policy of ['not-json', 'null', '{}', { modules: [], acciones: ['ver', 'crear'] }, { modules: ['salud'], acciones: [] }, { modules: ['salud'] }, { modules: ['salud'], acciones: ['unknown'] }, { modules: ['salud'], acciones: ['ver'], sensibles: null }]) {
    const cookie = await f.user(policy);
    assert.deepEqual((await f.call('children', 'GET', undefined, cookie)).body, []);
    assert.equal((await f.call('records/registros_crecimiento?child=' + f.child, 'GET', undefined, cookie)).status, 403);
    assert.equal((await f.call('children', 'POST', { primer_nombre: 'Forbidden', fecha_nacimiento: '2020-01-01' }, cookie)).status, 403);
    assert.equal((await f.call('guests?child=' + f.child, 'POST', { nombre: 'Forbidden', hours: 24, modules: ['salud'] }, cookie)).status, 403);
    const me = (await f.call('me', 'GET', undefined, cookie)).body;
    assert.ok(!JSON.parse(me.permisos_json).modules.length || !JSON.parse(me.permisos_json).acciones.length);
  }
});

test('read, create, download and attach are independent permissions', async t => {
  const f = await fixture(t);
  const noRead = await f.user({ modules: ['salud'], acciones: ['crear'] });
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, noRead)).status, 403);
  const reader = await f.user({ modules: ['salud'], acciones: ['ver'] });
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, reader)).status, 200);
  assert.equal((await f.call('export', 'POST', { child: f.child, modules: ['salud'] }, reader)).status, 403);
  assert.equal((await f.call('files/' + f.file + '?download=1', 'GET', undefined, reader)).status, 403);
  const form = () => { const data = new FormData(); data.append('file', new Blob(['%PDF-1.4 QA']), 'qa.pdf'); return data; };
  const creator = await f.user({ modules: ['salud'], acciones: ['ver', 'crear'] });
  assert.equal((await f.call('files?module=salud&child=' + f.child, 'POST', form(), creator)).status, 403);
  const uploader = await f.user({ modules: ['salud'], acciones: ['ver', 'adjuntar'] });
  assert.equal((await f.call('files?module=salud&child=' + f.child, 'POST', form(), uploader)).status, 201);
  const exporter = await f.user({ modules: ['salud'], acciones: ['ver', 'descargar'] });
  assert.equal((await f.call('export', 'POST', { child: f.child, modules: ['salud'] }, exporter)).status, 200);
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'POST', {}, exporter)).status, 403);
});

test('module-limited members get minimal profile metadata and cannot disclose other modules through links', async t => {
  const f = await fixture(t);
  const cookie = await f.user({ modules: ['escolar'], acciones: permissionActions });
  const children = (await f.call('children', 'GET', undefined, cookie)).body;
  assert.equal(children.length, 2);
  assert.equal(children[0].rut, undefined);
  assert.equal(children[0].diagnostico, undefined);
  assert.equal(children[0].rnd_habilitado, 0);
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, cookie)).status, 403);
  assert.equal((await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA', hours: 24, modules: ['salud'] }, cookie)).status, 403);
  assert.equal((await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA', hours: 24, modules: ['escolar'] }, cookie)).status, 201);
  const privateMember = await f.user({ modules: allModules, acciones: permissionActions, privacidad: ['rut'] });
  assert.equal((await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA', hours: 24, modules: ['perfil'] }, privateMember)).status, 403);
  const sensitiveMember = await f.user({ modules: allModules, acciones: permissionActions, sensibles: ['anamnesis'] });
  assert.equal((await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA', hours: 24, modules: ['anamnesis'] }, sensitiveMember)).status, 403);
});

test('anamnesis privacy applies equally to API and reports and preserves hidden sections on save', async t => {
  const f = await fixture(t);
  const cookie = await f.user({ modules: ['anamnesis'], acciones: ['ver', 'editar', 'descargar'], privacidad: ['telefono', 'diagnosticos', 'archivos'] });
  const read = await f.call('anamnesis?child=' + f.child, 'GET', undefined, cookie);
  assert.equal(read.status, 200);
  assert.equal(read.body.documento.identificacion, undefined);
  assert.equal(read.body.documento.antecedentes, undefined);
  assert.equal(read.body.documento.desarrollo[0], 'Visible development');
  const report = await f.call('export', 'POST', { child: f.child, modules: ['anamnesis'] }, cookie);
  assert.equal(report.status, 200);
  assert.ok(!JSON.stringify(report.body).includes('PRIVATE_FAMILY_CONTACT'));
  assert.ok(!JSON.stringify(report.body).includes('PRIVATE_HISTORY_DIAGNOSIS'));
  const save = await f.call('anamnesis?child=' + f.child, 'PUT', { version: read.body.version, documento: { desarrollo: { 0: 'Changed development' } } }, cookie);
  assert.equal(save.status, 200);
  const owner = (await f.call('anamnesis?child=' + f.child)).body.documento;
  assert.equal(owner.identificacion[0], 'PRIVATE_FAMILY_CONTACT');
  assert.equal(owner.antecedentes[0], 'PRIVATE_HISTORY_DIAGNOSIS');
  assert.equal(owner.desarrollo[0], 'Changed development');
});

test('legacy explicit scopes, family isolation and owner access remain compatible', async t => {
  const f = await fixture(t);
  const reader = await f.user({ modules: ['salud'], acciones: ['ver', 'descargar'] });
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, reader)).body[0].diagnostico, 'PRIVATE_VISIT_DIAGNOSIS');
  assert.equal((await f.call('records/consultas_medicas?child=' + f.foreign, 'GET', undefined, reader)).status, 404);
  assert.equal((await f.call('export', 'POST', { child: f.foreign, modules: ['salud'] }, reader)).status, 404);
  assert.equal((await f.call('children')).body.find(n => n.id === f.child).rut, '12.345.678-5');
  assert.equal((await f.call('export', 'POST', { child: f.child, modules: ['perfil', 'salud'] })).status, 200);
  const projected = projectRecord({ rol: 'editor', permisos_json: JSON.stringify({ modules: ['perfil'], acciones: ['ver'], privacidad: ['direccion'] }) }, 'ninos', { id: 'qa', direccion: 'Private address', primer_nombre: 'QA' });
  assert.equal(projected.direccion, undefined);
});

test('edit permission preserves retained attachments but cannot attach new references through forms or anamnesis', async t => {
  const f = await fixture(t);
  const editor = await f.user({ modules: ['salud', 'anamnesis'], acciones: ['ver', 'editar'] });
  const visit = (await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, editor)).body[0];
  assert.equal((await f.call('records/consultas_medicas/' + f.visit + '?child=' + f.child, 'PUT', { ...visit, medico_nombre: 'Updated doctor' }, editor)).status, 200);
  const newId = crypto.randomUUID(), bytes = new TextEncoder().encode('%PDF-1.4 new');
  await f.env.DB.prepare('INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,contenido) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(newId, f.me.familia_id, f.child, 'salud', 'new.pdf', 'application/pdf', bytes.length, 'd1:' + newId, bytes).run();
  assert.equal((await f.call('records/consultas_medicas/' + f.visit + '?child=' + f.child, 'PUT', { ...visit, archivo_r2_key: newId }, editor)).status, 403);
  const data = new FormData(); data.append('file', new Blob(['%PDF-1.4 QA']), 'anamnesis.pdf');
  const upload = await f.call('files?module=anamnesis&child=' + f.child, 'POST', data);
  assert.equal(upload.status, 201);
  const read = (await f.call('anamnesis?child=' + f.child)).body;
  assert.equal((await f.call('anamnesis?child=' + f.child, 'PUT', { version: read.version, documento: { desarrollo: { archivos: [upload.body.id] } } }, editor)).status, 403);
  const ownerSave = await f.call('anamnesis?child=' + f.child, 'PUT', { version: read.version, documento: { desarrollo: { 0: 'Owner text', archivos: [upload.body.id] } } });
  assert.equal(ownerSave.status, 200);
  const retained = (await f.call('anamnesis?child=' + f.child, 'GET', undefined, editor)).body;
  assert.equal((await f.call('anamnesis?child=' + f.child, 'PUT', { version: retained.version, documento: { ...retained.documento, desarrollo: { ...retained.documento.desarrollo, 0: 'Updated text' } } }, editor)).status, 200);
});

test('create-only action cannot overwrite a single-record module through POST', async t => {
  const f = await fixture(t);
  await f.env.DB.prepare('INSERT INTO perfiles_escolares(id,nino_id,colegio_actual,curso) VALUES(?,?,?,?)')
    .bind(crypto.randomUUID(), f.child, 'Original school', 'Original course').run();
  const creator = await f.user({ modules: ['escolar'], acciones: ['ver', 'crear'] });
  const write = await f.call('records/perfiles_escolares?child=' + f.child, 'POST', { colegio_actual: 'Forbidden overwrite', curso: 'Other course' }, creator);
  assert.equal(write.status, 403);
  assert.equal((await f.call('records/perfiles_escolares?child=' + f.child)).body[0].colegio_actual, 'Original school');
});

test('existing guest links and sessions cannot retain permissions revoked from their creator', async t => {
  const f = await fixture(t);
  const share = await f.call('guests?child=' + f.child, 'POST', { nombre: 'QA professional', hours: 24, modules: ['salud', 'escolar'] });
  assert.equal(share.status, 201);
  const bearer = share.body.url.split('#')[1];
  const exchange = await f.call('guest/exchange', 'POST', { token: bearer }, '');
  assert.equal(exchange.status, 200);
  const guest = exchange.cookie;
  await f.env.DB.prepare('UPDATE usuarios SET rol=?,permisos_json=? WHERE id=?')
    .bind('editor', JSON.stringify({ modules: ['salud'], acciones: ['ver', 'descargar'] }), f.me.id).run();
  const me = await f.call('me', 'GET', undefined, guest);
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.modules, ['salud']);
  assert.equal((await f.call('records/horario_escolar?child=' + f.child, 'GET', undefined, guest)).status, 403);
  assert.equal((await f.call('records/consultas_medicas?child=' + f.child, 'GET', undefined, guest)).status, 200);
  await f.env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE id=?')
    .bind(JSON.stringify({ modules: ['salud'], acciones: ['ver', 'descargar'], privacidad: ['rut'] }), f.me.id).run();
  assert.equal((await f.call('me', 'GET', undefined, guest)).status, 401);
  assert.equal((await f.call('guest/exchange', 'POST', { token: bearer }, '')).status, 403);
});
