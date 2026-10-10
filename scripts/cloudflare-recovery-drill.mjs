// Synthetic disaster-recovery rehearsal only. No production SQL or backup keys.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { drillNames, guardDrillTarget, syntheticRecoveryFixture, recoverySql } from './recovery-drill-core.mjs';
import { databaseSummary, openSnapshot, hashBytes, decrypt } from './backup-core.mjs';

const account = 'b82d9c355fea7fa6d20ed89e2b3971fa', token = process.env.CLOUDFLARE_API_TOKEN;
const suffix = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || 1}` : randomUUID().slice(0, 12);
const names = drillNames(suffix), gate = randomBytes(32).toString('hex');
const report = { synthetic_only: true, production_modified: false, status: 'running', started_at: new Date().toISOString(), resources: names, checks: [], timings_seconds: {} };
const started = performance.now(), directory = resolve('.private-wrangler/recovery-drill');
let phase = 'preflight', fixture, dbId, createdBucket = false, createdProject = false, requests = 0;
const storedKeys = [];
const timed = async (name, action) => { const start = performance.now(); const result = await action(); report.timings_seconds[name] = +( (performance.now() - start) / 1000).toFixed(3); return result; };
const check = (name, condition) => { assert(condition, name); report.checks.push(name); };
const redact = text => String(text).replaceAll(token || '\0', '[redacted]').replaceAll(gate, '[redacted]');
async function request(path, options = {}) {
  if (++requests > 1000) throw new Error('Límite preventivo de solicitudes alcanzado.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers }, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Cloudflare ${options.method || 'GET'} ${path}: HTTP ${response.status}`);
  return response;
}
async function cf(path, method = 'GET', data) {
  const response = await request(path, { method, ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) });
  const body = await response.json();
  if (body.success === false) throw new Error('Cloudflare rechazó la operación de ensayo.');
  return body;
}
const objectPath = key => `r2/buckets/${names.bucket}/objects/` + key.split('/').map(encodeURIComponent).join('/');
async function inventory(bucket) {
  let cursor = '', bytes = 0, count = 0;
  do {
    const body = await cf(`r2/buckets/${bucket}/objects?per_page=1000${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    for (const object of body.result) {
      if (object.storage_class && object.storage_class !== 'Standard') throw new Error('Inventario fuera de R2 Standard; detener el ensayo.');
      bytes += Number(object.size); count++;
    }
    if (count > 20000 || !Number.isSafeInteger(bytes)) throw new Error('No se puede comprobar la cuota R2.');
    cursor = body.result_info?.is_truncated ? body.result_info.cursor : '';
    if (body.result_info?.is_truncated && !cursor) throw new Error('Inventario R2 incompleto.');
  } while (cursor);
  return bytes;
}
const run = (args, cwd = process.cwd(), input) => {
  const result = spawnSync('npx', ['wrangler', ...args], { cwd, input, encoding: 'utf8', maxBuffer: 10_000_000,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account } });
  if (result.status !== 0) throw new Error('Wrangler: ' + redact((result.stderr || '') + (result.stdout || '')).slice(-3500));
};
async function exportRestoredSql() {
  let bookmark;
  for (let attempt = 0; attempt < 60; attempt++) {
    const body = await cf(`d1/database/${dbId}/export`, 'POST', { output_format: 'polling', ...(bookmark ? { current_bookmark: bookmark } : {}) });
    if (body.result.status === 'complete') {
      const url = new URL(body.result.result.signed_url);
      if (url.protocol !== 'https:') throw new Error('Exportación D1 sin HTTPS.');
      // No API token is sent to the signed download or written to the report.
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error('La exportación de la D1 de ensayo no pudo descargarse.');
      const sql = await response.text();
      if (Buffer.byteLength(sql) > 2_000_000) throw new Error('La exportación excede el tamaño del fixture.');
      return sql;
    }
    if (body.result.status === 'error') throw new Error('Falló la exportación de ensayo.');
    bookmark = body.result.at_bookmark || bookmark; await delay(1000);
  }
  throw new Error('La exportación de ensayo no terminó a tiempo.');
}
async function main() {
  if (!token) throw new Error('Falta el secreto existente CLOUDFLARE_API_TOKEN.');
  if (process.env.GITHUB_REF === 'refs/heads/main') throw new Error('Ejecutar desde una rama de ensayo.');
  await timed('preflight', async () => {
    const databases = (await cf('d1/database?per_page=100')).result;
    check('Capacidad D1 dentro del límite conservador de 10 bases', databases.length < 10);
    check('La D1 de ensayo no existe y no se reutilizará', !databases.some(db => db.name === names.database));
    const buckets = (await cf('r2/buckets')).result.buckets;
    check('Bucket nuevo y número de buckets comprobable', Array.isArray(buckets) && buckets.length < 20 && !buckets.some(bucket => bucket.name === names.bucket));
    let total = 0;
    for (const bucket of buckets) total += await inventory(bucket.name);
    check('Margen R2 inferior al umbral preventivo de 8 GB', total + 2_000_000 < 8_000_000_000);
    report.r2_account_bytes_before = total;
    check('Proyecto de ensayo nuevo', !(await cf('pages/projects')).result.some(project => project.name === names.project));
  });
  phase = 'synthetic-backup';
  fixture = await timed('synthetic_backup_and_local_restore', () => syntheticRecoveryFixture());
  report.families = fixture.restored.summary.families; report.files = fixture.archive.manifest.files.length; report.encrypted_bytes = fixture.archive.bytes;
  check('Dos familias y cuatro archivos ficticios verificados', report.families === 2 && report.files === 4);
  check('Sesiones eliminadas de la copia restaurada', fixture.restored.db.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n === 0);
  phase = 'provision';
  await timed('provision', async () => {
    dbId = (await cf('d1/database', 'POST', { name: names.database })).result.uuid;
    guardDrillTarget(names, dbId); report.resources.database_id = dbId;
    await cf('r2/buckets', 'POST', { name: names.bucket }); createdBucket = true;
    check('El dominio público R2 está desactivado', (await cf(`r2/buckets/${names.bucket}/domains/managed`)).result.enabled === false);
    const projects = { name: names.project, production_branch: 'production-disabled' };
    await cf('pages/projects', 'POST', projects); createdProject = true;
  });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const config = resolve(directory, 'wrangler.toml'), sqlPath = resolve(directory, 'restore.sql');
  writeFileSync(config, `name = "${names.project}"\ncompatibility_date = "2026-10-01"\npages_build_output_dir = "dist"\n[vars]\nLUSPACE_REGISTRATION_ENABLED = "false"\nLUSPACE_R2_ENABLED = "true"\nLUSPACE_AI_ENABLED = "false"\nLUSPACE_BILLING_MODE = "disabled"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "${names.database}"\ndatabase_id = "${dbId}"\n[[r2_buckets]]\nbinding = "FILES"\nbucket_name = "${names.bucket}"\n`);
  writeFileSync(sqlPath, recoverySql(fixture.restored.db), { mode: 0o600 });
  // Pages secret creation is a separate supported operation; provide its value
  // on stdin, never as a command argument or a plaintext config variable.
  run(['pages', 'secret', 'put', 'RECOVERY_TEST_KEY', '--project-name', names.project], directory, gate);
  phase = 'restore-d1';
  await timed('restore_d1', async () => run(['d1', 'execute', names.database, '--remote', '--config', config, '--file', sqlPath]));
  phase = 'restore-r2';
  await timed('restore_r2', async () => {
    for (const file of fixture.archive.manifest.files) {
      const bytes = decrypt(fixture.archive.objects.get(file.name), fixture.key, file.name);
      await request(objectPath(file.key), { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes }); storedKeys.push(file.key);
      const recovered = Buffer.from(await (await request(objectPath(file.key))).arrayBuffer());
      check('Integridad R2 del documento ficticio ' + storedKeys.length, hashBytes(recovered) === file.sha256 && recovered.length === file.bytes);
    }
  });
  phase = 'verify-d1';
  await timed('verify_d1_export', async () => {
    const remote = openSnapshot(await exportRestoredSql());
    try {
      const expected = databaseSummary(fixture.restored.db), actual = databaseSummary(remote);
      for (const [table, summary] of Object.entries(expected)) assert.deepEqual(actual[table], summary, 'Tabla recuperada: ' + table);
      check('Exportación de D1 coincide con todas las tablas y filas restauradas', true);
      check('Invitados antiguos desactivados', remote.prepare('SELECT COUNT(*) AS n FROM tokens_invitados WHERE activo=1').get().n === 0);
    } finally { remote.close(); }
  });
  phase = 'private-validation-app';
  await timed('validation_app_deploy', async () => {
    for (const folder of ['functions', 'server', 'shared', 'dist']) cpSync(resolve(folder), resolve(directory, folder), { recursive: true });
    writeFileSync(resolve(directory, 'dist/_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
    writeFileSync(resolve(directory, 'functions/_middleware.js'), `export async function onRequest(context) { if (!context.env.RECOVERY_TEST_KEY || context.request.headers.get('X-LuSpace-Drill-Key') !== context.env.RECOVERY_TEST_KEY) return new Response('Private recovery rehearsal', {status:403}); return context.next(); }`);
    run(['pages', 'deploy', 'dist', '--project-name', names.project, '--branch', 'drill', '--commit-dirty=true'], directory);
  });
  const origin = `https://drill.${names.project}.pages.dev`;
  const api = (path, method = 'GET', data, cookie = '', download = false) => fetch(origin + '/api/' + path, {
    method, headers: { Origin: origin, cookie, 'X-LuSpace-Drill-Key': gate, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(download ? 30000 : 15000),
  });
  phase = 'functional-checks';
  await timed('functional_checks', async () => {
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) { if ((await api('status')).ok) { ready = true; break; } await delay(1500); }
    check('Functions de validación disponibles con la clave de ensayo', ready);
    check('Sitio privado sin clave de ensayo', (await fetch(origin)).status === 403);
    for (let i = 0; i < fixture.families.length; i++) {
      const family = fixture.families[i], other = fixture.families[1 - i];
      check('Sesión antigua rechazada ' + i, (await api('children', 'GET', undefined, fixture.originalCookies[i])).status === 401);
      check('Enlace invitado antiguo rechazado ' + i, !(await api('guest/exchange', 'POST', { token: family.guestToken })).ok);
      for (const [role, correo] of [['owner', family.correo], ['reader', family.reader]]) {
        const login = await api('login', 'POST', { correo, password: family.password });
        check('Login recuperado ' + role + i, login.ok);
        const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert(cookie, 'Cookie de sesión requerida');
        const children = await (await api('children', 'GET', undefined, cookie)).json();
        check('Perfil familiar aislado ' + role + i, children.length === 1 && children[0].id === family.child);
        check('Perfil de otra familia inaccesible ' + role + i, (await api('records/medicamentos?child=' + other.child, 'GET', undefined, cookie)).status === 404);
        check('Documento de otra familia inaccesible ' + role + i, (await api('files/' + other.files[0], 'GET', undefined, cookie)).status === 404);
        for (const fileId of family.files) {
          const response = await api('files/' + fileId + '?download=1', 'GET', undefined, cookie, true);
          const bytes = Buffer.from(await response.arrayBuffer()), expected = fixture.archive.manifest.files.find(file => file.id === fileId);
          check('Descarga íntegra ' + role + fileId, response.ok && hashBytes(bytes) === expected.sha256);
        }
        const endpoint = 'records/medicamentos?child=' + family.child;
        const rows = await (await api(endpoint, 'GET', undefined, cookie)).json();
        check('Tratamiento recuperado ' + role + i, rows.length === 1 && rows[0].dosis === 'Dosis de prueba');
        if (role === 'reader') for (const method of ['POST', 'PUT', 'DELETE']) check('Escritura de lector bloqueada ' + method + i,
          (await api(endpoint.replace('?', method === 'POST' ? '?' : '/' + rows[0].id + '?'), method, method === 'DELETE' ? undefined : {}, cookie)).status === 403);
      }
    }
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome' });
    try {
      const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
      await page.route(origin + '/**', route => route.continue({ headers: { ...route.request().headers(), 'X-LuSpace-Drill-Key': gate } }));
      await page.goto(origin + '/login');
      await page.locator('input[type=email]').fill(fixture.families[0].correo);
      await page.locator('input[type=password]').fill(fixture.families[0].password);
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
      await page.locator('article.medicine').waitFor();
      check('Dashboard restaurado utilizable en navegador móvil', await page.locator('article.medicine').getByText('Tratamiento ficticio 0', { exact: true }).isVisible());
    } finally { await browser.close(); }
  });
  phase = 'cleanup';
  await timed('cleanup', async () => {
    // Delete only resources created and identified in this invocation.
    guardDrillTarget(names, dbId);
    await cf('pages/projects/' + names.project, 'DELETE'); createdProject = false;
    for (const key of storedKeys) await request(objectPath(key), { method: 'DELETE' });
    await cf('r2/buckets/' + names.bucket, 'DELETE'); createdBucket = false;
    await cf('d1/database/' + dbId, 'DELETE'); dbId = null;
  });
  report.status = 'verified'; report.resources_removed = true;
}

async function cleanPriorAttempt() {
  // Explicitly identify only our previously reported failed resources. Never
  // infer a database from ordering or accept an arbitrary production name.
  const priorSuffix = process.argv[process.argv.indexOf('--cleanup-suffix') + 1];
  const expectedId = process.argv[process.argv.indexOf('--cleanup-database-id') + 1];
  const prior = drillNames(priorSuffix); guardDrillTarget(prior, expectedId);
  const db = (await cf('d1/database?per_page=100')).result.find(db => db.uuid === expectedId);
  if (db) assert.equal(db.name, prior.database, 'La base debe coincidir con el ensayo fallido registrado');
  const project = (await cf('pages/projects')).result.find(project => project.name === prior.project);
  if (project) { assert.equal(project.production_branch, 'production-disabled'); await cf('pages/projects/' + prior.project, 'DELETE'); }
  const bucket = (await cf('r2/buckets')).result.buckets.find(bucket => bucket.name === prior.bucket);
  if (bucket) {
    assert.equal(await inventory(prior.bucket), 0, 'Esta limpieza solo acepta el bucket vacío del intento previo');
    await cf('r2/buckets/' + prior.bucket, 'DELETE');
  }
  if (db) await cf('d1/database/' + expectedId, 'DELETE');
  report.resources = prior; report.status = 'cleanup_completed'; report.resources_removed = true;
}
async function cleanFailedAttempt() {
  if (!dbId) return;
  guardDrillTarget(names, dbId);
  const project = (await cf('pages/projects')).result.find(project => project.name === names.project);
  if (project) { assert.equal(project.production_branch, 'production-disabled'); await cf('pages/projects/' + names.project, 'DELETE'); }
  createdProject = false;
  if (createdBucket) {
    for (const key of storedKeys) await request(objectPath(key), { method: 'DELETE' });
    await cf('r2/buckets/' + names.bucket, 'DELETE'); createdBucket = false;
  }
  await cf('d1/database/' + dbId, 'DELETE'); dbId = null;
}
try { if (process.argv.includes('--cleanup-suffix')) await cleanPriorAttempt(); else await main(); }
catch (error) {
  try { await timed('failure_cleanup', cleanFailedAttempt); } catch { console.error('::warning::Los recursos de ensayo requieren limpieza controlada; permanecen separados de producción.'); }
  report.status = 'failed'; report.failed_phase = phase; report.resources_removed = !dbId && !createdBucket && !createdProject;
  const message = redact(error.message).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error('::error::Ensayo de recuperación: ' + message); process.exitCode = 1;
} finally {
  fixture?.restored.db.close();
  report.total_seconds = +((performance.now() - started) / 1000).toFixed(3); report.completed_at = new Date().toISOString(); report.requests = requests;
  const out = resolve('.private-backups/recovery-report'); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(report, null, 2));
  console.log('::notice::RECOVERY_REPORT ' + JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Ensayo de recuperación\n\nEstado: ${report.status}. Solo datos ficticios.\n\nComprobaciones aprobadas: ${report.checks.length}. Tiempo total: ${report.total_seconds} s.\n\nTiempos por etapa:\n\n\x60\x60\x60json\n${JSON.stringify(report.timings_seconds, null, 2)}\n\x60\x60\x60\n\nProducción modificada: no. Recursos de ensayo retirados: ${report.resources_removed}.\n`, { flag: 'a' });
}
