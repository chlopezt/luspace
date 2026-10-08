import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnv } from '../server/local.js';
import { handle } from '../server/api.js';
import {LEGAL_VERSION} from '../shared/legal.js';

test('family registration is atomic, gated and isolated with a server-owned trial', async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), 'luspace-registration-')));
  const origin = 'http://localhost:5173';
  let ip = 0;
  async function call(path, method = 'GET', data, cookie = '', fixedIp) {
    const response = await handle(new Request(origin + '/api/' + path, {
      method, headers: { origin, cookie, 'CF-Connecting-IP': fixedIp || `qa-${ip++}`,
        ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
    }), env);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const form = (correo) => ({ nombre: 'Administrador QA', familia: 'Familia QA', correo,
    password: 'RegistroSeguro2026!', password_confirmation: 'RegistroSeguro2026!',legal_accepted:true,legal_version:LEGAL_VERSION });
  try {
    assert.equal((await call('register', 'POST', form('first@example.test'))).status, 403);
    const setup = await call('setup', 'POST', { ...form('owner@example.test') });
    assert.equal(setup.status, 201);
    env.LUSPACE_REGISTRATION_ENABLED = 'false';
    assert.equal((await call('status')).body.registration, false);
    assert.equal((await call('register', 'POST', form('closed@example.test'))).status, 403);
    env.LUSPACE_REGISTRATION_ENABLED = 'true';
    assert.equal((await call('status')).body.registration, true);
    for(const overrides of [{legal_accepted:false},{legal_accepted:'true'},{legal_version:'old'}]){
      assert.equal((await call('register','POST',{...form('no-consent@example.test'),...overrides})).status,400);
      assert.equal(await env.DB.prepare("SELECT id FROM usuarios WHERE correo='no-consent@example.test'").first(),null);
    }
    assert.equal((await call('register', 'POST', { ...form('wrong@example.test'), password_confirmation: 'DifferentPassword123' })).status, 400);
    assert.equal((await call('register', 'POST', { ...form('weak@example.test'), password: 'abcdefghijkl', password_confirmation: 'abcdefghijkl' })).status, 400);

    const registration = await call('register', 'POST', { ...form('new@example.test'),
      rol: 'platform', commercial_exempt: 1, subscription_status: 'active', storage_limit_bytes: 999999999 });
    assert.equal(registration.status, 201);
    const me = (await call('me', 'GET', undefined, registration.cookie)).body;
    assert.equal(me.rol, 'superadmin');
    const consent=await env.DB.prepare('SELECT * FROM consentimientos_registro WHERE usuario_id=?').bind(me.id).first();
    assert.equal(consent.familia_id,me.familia_id);assert.equal(consent.version_legal,LEGAL_VERSION);assert.equal(consent.canal,'correo');assert.ok(Date.parse(consent.aceptado_at));
    assert.equal(consent.autorizacion_cuidado,0);
    assert.equal(me.subscription.subscription_status, 'trial');
    assert.equal(me.subscription.storage_limit_bytes, 52428800);
    assert.equal(me.subscription.commercial_exempt, 0);
    const family = await env.DB.prepare('SELECT * FROM familias WHERE id=?').bind(me.familia_id).first();
    assert.equal(Date.parse(family.trial_ends_at) - Date.parse(family.created_at), 14 * 86400000);
    assert.equal((await call('platform/overview', 'GET', undefined, registration.cookie)).status, 401);
    assert.deepEqual((await call('children', 'GET', undefined, registration.cookie)).body, []);

    const ownerChild = (await call('children', 'POST', { primer_nombre: 'A', fecha_nacimiento: '2020-01-01', sexo_referencia: 'masculino' }, setup.cookie)).body.id;
    const newChild = (await call('children', 'POST', { primer_nombre: 'B', fecha_nacimiento: '2020-01-01', sexo_referencia: 'masculino' }, registration.cookie)).body.id;
    assert.ok(ownerChild && newChild);
    assert.equal((await call('children', 'GET', undefined, registration.cookie)).body.length, 1);
    assert.equal((await call('records/ninos?child=' + ownerChild, 'GET', undefined, registration.cookie)).status, 404);
    assert.equal((await call('children/' + ownerChild, 'PUT', { primer_nombre: 'Intruso' }, registration.cookie)).status, 404);
    const attachment = new FormData(); attachment.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'test.pdf');
    const file = await call('files?child=' + ownerChild + '&module=salud', 'POST', attachment, setup.cookie);
    assert.equal(file.status, 201);
    assert.equal((await call('files/' + file.body.id, 'GET', undefined, registration.cookie)).status, 404);
    assert.equal((await call('files/' + file.body.id, 'DELETE', undefined, registration.cookie)).status, 404);
    assert.equal((await call('users', 'GET', undefined, registration.cookie)).body.length, 1);

    const before = (await env.DB.prepare('SELECT count(*) AS n FROM familias').first()).n;
    assert.equal((await call('register', 'POST', form('NEW@example.test'))).status, 409);
    assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM familias').first()).n, before);
    const concurrent = await Promise.all([call('register', 'POST', form('race@example.test')), call('register', 'POST', form('race@example.test'))]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
    assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM familias').first()).n, before + 1);
    // A failure late in the transaction must not leave a family or account behind.
    await env.DB.prepare("CREATE TRIGGER fail_registration BEFORE INSERT ON familia_configuracion BEGIN SELECT RAISE(ABORT,'QA_ROLLBACK'); END").run();
    assert.equal((await call('register', 'POST', form('rollback@example.test'))).status, 500);
    assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM familias').first()).n, before + 1);
    assert.equal(await env.DB.prepare("SELECT id FROM usuarios WHERE correo='rollback@example.test'").first(), null);
    assert.equal((await env.DB.prepare('SELECT count(*) n FROM consentimientos_registro').first()).n,before);
    await env.DB.prepare('DROP TRIGGER fail_registration').run();
    for (let attempt = 0; attempt < 10; attempt++) await call('register', 'POST', { ...form('limited@example.test'), nombre: '' }, '', 'fixed-register-ip');
    assert.equal((await call('register', 'POST', form('limited@example.test'), '', 'fixed-register-ip')).status, 429);
  } finally { env.close(); }
});

