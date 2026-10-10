// Generates a NEW local fixture. Never reads an existing or remote database.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnv } from '../server/local.js';
import { handle } from '../server/api.js';

export async function previewFixtureSql() {
  const directory = mkdtempSync(join(tmpdir(), 'luspace-synthetic-preview-'));
  const env = localEnv(directory);
  let cookie = '';
  const call = async (path, data) => {
    const response = await handle(new Request('http://localhost/api/' + path, {
      method: 'POST', headers: { Origin: 'http://localhost', cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }), env);
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const result = await response.json();
    if (!response.ok) throw new Error(`Synthetic fixture ${path}: ${JSON.stringify(result)}`);
    return result;
  };
  const literal = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  try {
    await call('setup', { nombre: 'Familia de demostración', familia: 'Vista previa · datos ficticios', correo: 'familia@preview.luspace.test', password: 'VistaPrevia!2026' });
    const child = (await call('children', { primer_nombre: 'Alex (demo)', apellidos: 'Ejemplo', fecha_nacimiento: '2020-03-12' })).id;
    const now = Date.now();
    for (const [nombre, dosis, frecuencia_horas] of [['Tratamiento de ejemplo A', 'Dosis ficticia A', 8], ['Tratamiento de ejemplo B', 'Dosis ficticia B', 24]]) {
      await call('records/medicamentos?child=' + child, { nombre, dosis, frecuencia_horas, hora_referencia: new Date(now - 3600000).toISOString(), fecha_inicio: '2026-01-01', activo: 1 });
    }
    for (let i = 0; i < 3; i++) await call('records/dosis_sos?child=' + child, {
      medicamento: `Medicamento SOS ficticio ${i + 1}`, dosis: 'Dosis de demostración', fecha: new Date(now - (i + 2) * 86400000).toISOString(), motivo: 'Registro ficticio para revisar la interfaz',
    });
    // Only the newly generated fixture is exempt; no real family is altered.
    await env.DB.prepare("UPDATE familias SET commercial_exempt=1, subscription_status='active'").run();
    const statements = [];
    for (const table of ['familias', 'usuarios', 'credenciales_usuario', 'ninos', 'medicamentos', 'dosis_sos']) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      for (const row of results) statements.push(`INSERT INTO ${table}(${Object.keys(row).map(key => `"${key}"`).join(',')}) VALUES(${Object.values(row).map(literal).join(',')});`);
    }
    statements.push("INSERT INTO intentos_acceso(clave,cantidad,reinicio) VALUES('installed',1,0);");
    return statements.join('\n');
  } finally {
    env.close(); rmSync(directory, { recursive: true, force: true });
  }
}
