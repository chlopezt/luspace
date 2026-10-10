import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PDFDocument } from 'pdf-lib';
import { localEnv } from '../server/local.js';
import { handle } from '../server/api.js';
import { createArchive, restoreArchive, databaseSummary } from './backup-core.mjs';

export function drillNames(suffix) {
  if (!/^[a-z0-9-]{1,24}$/.test(suffix)) throw new Error('Identificador de ensayo inválido.');
  return { database: `luspace-drill-db-${suffix}`, bucket: `luspace-drill-files-${suffix}`, project: `luspace-drill-${suffix}` };
}
export function guardDrillTarget(names, id) {
  if (!names.database.startsWith('luspace-drill-db-') || !names.bucket.startsWith('luspace-drill-files-') || !names.project.startsWith('luspace-drill-') ||
    !/^[a-f0-9-]{36}$/.test(id) || id === '853a2ab9-2950-4be8-8aec-4350cd7dd8a0') throw new Error('Destino de recuperación no autorizado.');
}
const identifier = name => {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Identificador SQL inválido.');
  return `"${name}"`;
};
const literal = value => value == null ? 'NULL' : value instanceof Uint8Array ? `X'${Buffer.from(value).toString('hex')}'` :
  typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;

// Complete authenticated snapshot, ordered by foreign-key dependencies for D1.
// Never opens a source file: the caller supplies a verified in-memory database.
export function recoverySql(db) {
  const schema = db.prepare("SELECT name,sql,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name").all();
  const tables = schema.filter(row => row.type === 'table');
  const remaining = new Map(tables.map(row => [row.name, row])), ordered = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter(row => db.prepare(`PRAGMA foreign_key_list(${identifier(row.name)})`).all()
      .every(fk => fk.table === row.name || !remaining.has(fk.table)));
    if (!ready.length) throw new Error('Dependencias SQL cíclicas: revisar la importación antes de escribir.');
    for (const row of ready) { ordered.push(row); remaining.delete(row.name); }
  }
  const statements = ['PRAGMA defer_foreign_keys=ON;', ...ordered.map(row => row.sql + ';')];
  for (const table of ordered) {
    const columns = db.prepare(`PRAGMA table_info(${identifier(table.name)})`).all().map(row => row.name);
    for (const row of db.prepare(`SELECT * FROM ${identifier(table.name)}`).all()) statements.push(
      `INSERT INTO ${identifier(table.name)}(${columns.map(identifier).join(',')}) VALUES(${columns.map(key => literal(row[key])).join(',')});`);
  }
  statements.push(...schema.filter(row => row.type !== 'table').map(row => row.sql + ';'));
  return statements.join('\n');
}

export async function syntheticRecoveryFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'luspace-recovery-fixture-')), env = localEnv(directory), objects = new Map();
  env.FILES = { async put(key, bytes) { objects.set(key, Buffer.from(bytes)); }, async get(key) {
    const bytes = objects.get(key); return bytes ? { async arrayBuffer() { return Uint8Array.from(bytes).buffer; } } : null;
  }, async delete(key) { objects.delete(key); } };
  let counter = 0;
  const call = async (path, data, cookie = '', method = 'POST') => {
    const response = await handle(new Request('http://localhost/api/' + path, { method,
      headers: { Origin: 'http://localhost', cookie, 'CF-Connecting-IP': `synthetic-${counter++}`, ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: data instanceof FormData ? data : JSON.stringify(data) }),
    }), env);
    const result = await response.json();
    if (!response.ok) throw new Error(`Fixture ${path}: HTTP ${response.status}`);
    return { body: result, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const families = [], password = 'SyntheticRecovery2026!', originalCookies = [];
  let source;
  try {
    for (let i = 0; i < 2; i++) {
      const correo = `recovery-${i}@example.test`;
      const login = await call(i ? 'register' : 'setup', { nombre: `Tutor ficticio ${i}`, familia: `Familia ficticia ${i}`, correo, password,
        password_confirmation: password, legal_accepted: true, legal_version: '2026-10-08-v3' });
      originalCookies.push(login.cookie);
      const child = (await call('children', { primer_nombre: `Niño ficticio ${i}`, fecha_nacimiento: '2020-01-01' }, login.cookie)).body.id;
      await call('records/medicamentos?child=' + child, { nombre: `Tratamiento ficticio ${i}`, dosis: 'Dosis de prueba', activo: 1, fecha_inicio: '2026-01-01', frecuencia_horas: 8, hora_referencia: new Date().toISOString() }, login.cookie);
      const files = [];
      for (const backend of ['r2', 'd1']) {
        env.LUSPACE_R2_ENABLED = backend === 'r2' ? 'true' : 'false';
        const pdf = await PDFDocument.create(); pdf.addPage().drawText(`Documento ficticio ${i} ${backend}`);
        const form = new FormData(); form.append('file', new Blob([await pdf.save()], { type: 'application/pdf' }), `demo-${backend}.pdf`);
        files.push((await call('files?child=' + child + '&module=salud', form, login.cookie)).body.id);
      }
      const permissions = { modules: ['salud'], acciones: ['ver', 'descargar'], sensibles: [], privacidad: [] };
      const reader = `reader-${i}@example.test`;
      await call('users', { nombre: 'Lector ficticio', correo: reader, password, rol: 'lector', permisos: permissions }, login.cookie);
      await env.DB.prepare('UPDATE usuarios SET permisos_json=? WHERE correo=?').bind(JSON.stringify(permissions), reader).run();
      const guest = (await call('guests?child=' + child, { nombre: 'Invitado ficticio', modules: ['salud'], hours: 24 }, login.cookie)).body.url;
      families.push({ correo, reader, password, child, files, guestToken: guest.split('#')[1] });
    }
    await env.DB.prepare("UPDATE familias SET commercial_exempt=1,subscription_status='active'").run();
    source = new DatabaseSync(join(directory, 'luspace.sqlite'));
    const before = databaseSummary(source), key = randomBytes(32).toString('hex');
    const archive = await createArchive({ sql: recoverySql(source), key, getObject: key => objects.get(key), maxBytes: 2_000_000 });
    const restored = restoreArchive(archive.objects, key);
    if (JSON.stringify(databaseSummary(source)) !== JSON.stringify(before)) throw new Error('El ensayo alteró el fixture de origen.');
    return { archive, key, restored, families, originalCookies };
  } finally { source?.close(); env.close(); rmSync(directory, { recursive: true, force: true }); }
}
