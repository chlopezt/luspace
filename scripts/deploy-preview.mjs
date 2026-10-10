// Separate Pages project and D1 database. Never uses production bindings/config.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { previewFixtureSql } from './preview-fixture.mjs';

const project = 'luspace-review', database = 'luspace-review-db';
const productionBranch = 'preview-disabled', previewBranch = 'review';
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('Falta CLOUDFLARE_API_TOKEN para publicar únicamente la vista previa.');
if (process.env.GITHUB_REF === 'refs/heads/main') throw new Error('La vista previa debe publicarse desde una rama independiente.');
async function cf(path, method = 'GET', data) {
  const response = await fetch('https://api.cloudflare.com/client/v4/' + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(`Cloudflare ${method} ${path}: ${JSON.stringify(body.errors)}`);
  return body.result;
}
const accounts = await cf('accounts?per_page=50');
const account = process.env.CLOUDFLARE_ACCOUNT_ID || (accounts.length === 1 ? accounts[0].id : null);
if (!account) throw new Error('Configura CLOUDFLARE_ACCOUNT_ID: hay varias cuentas y no se seleccionará una automáticamente.');
const root = `accounts/${account}`;
const projects = await cf(root + '/pages/projects');
const existingProject = projects.find(item => item.name === project);
if (existingProject && existingProject.production_branch !== productionBranch) throw new Error('El proyecto de vista previa ya existe sin la marca de aislamiento esperada.');

let databases = [];
for (let page = 1; ; page++) {
  const batch = await cf(root + `/d1/database?per_page=100&page=${page}`);
  databases.push(...batch);
  if (batch.length < 100) break;
}
let db = databases.find(item => item.name === database);
const created = !db;
if (created) db = await cf(root + '/d1/database', 'POST', { name: database });
const dbId = db.uuid;
const query = sql => cf(root + `/d1/database/${dbId}/query`, 'POST', { sql });
if (!created) {
  const result = await query("SELECT name FROM sqlite_master WHERE name='_luspace_preview_guard'");
  if (!result[0]?.results?.length) throw new Error('La base existente no está marcada como sintética: no se modificará.');
}
if (!existingProject) await cf(root + '/pages/projects', 'POST', { name: project, production_branch: productionBranch });
const directory = resolve('.private-wrangler/preview');
mkdirSync(directory, { recursive: true });
const config = resolve(directory, 'wrangler.toml');
writeFileSync(config, `name = "${project}"
account_id = "${account}"
compatibility_date = "2026-10-01"
pages_build_output_dir = "../../dist"

[vars]
LUSPACE_REGISTRATION_ENABLED = "false"
LUSPACE_AI_ENABLED = "false"
LUSPACE_R2_ENABLED = "false"
LUSPACE_BILLING_MODE = "disabled"

[[d1_databases]]
binding = "DB"
database_name = "${database}"
database_id = "${dbId}"
migrations_dir = "../../db/migrations"
`);
const run = args => {
  const result = spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account } });
  if (result.status !== 0) throw new Error('Wrangler falló: ' + args[0]);
};
run(['d1', 'migrations', 'apply', database, '--remote', '--config', config]);
if (created) {
  // D1 batch executes the marker and generated fixture atomically.
  await query((await previewFixtureSql()) + '\nCREATE TABLE _luspace_preview_guard(marker TEXT NOT NULL); INSERT INTO _luspace_preview_guard VALUES(\'synthetic-only-v1\');');
}
run(['pages', 'deploy', 'dist', '--project-name', project, '--branch', previewBranch, '--config', config, '--commit-dirty=true']);
const url = `https://${previewBranch}.${project}.pages.dev`;
console.log(`Vista previa sintética: ${url}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Vista previa\n\n[Ver cambios](${url})\n\nDatos ficticios. Producción no modificada.\n\nCuenta: familia@preview.luspace.test · Contraseña: VistaPrevia!2026\n`);
}
