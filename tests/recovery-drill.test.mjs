import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { drillNames, guardDrillTarget, recoverySql, syntheticRecoveryFixture } from '../scripts/recovery-drill-core.mjs';
import { verifyDatabase, databaseSummary } from '../scripts/backup-core.mjs';

test('drill rejects production and malformed destinations before any remote write', () => {
  const names = drillNames('unit-test');
  assert.throws(() => drillNames('../production'));
  assert.throws(() => guardDrillTarget(names, '853a2ab9-2950-4be8-8aec-4350cd7dd8a0'));
  assert.throws(() => guardDrillTarget({ ...names, bucket: 'luspace-files' }, crypto.randomUUID()));
  assert.throws(() => guardDrillTarget({ ...names, database: 'luspace-db' }, crypto.randomUUID()));
  guardDrillTarget(names, crypto.randomUUID());
});
test('synthetic recovery preserves schema, blobs, roles and family isolation while revoking sessions and guests', async () => {
  const fixture = await syntheticRecoveryFixture(), copy = new DatabaseSync(':memory:');
  try {
    copy.exec('PRAGMA foreign_keys=ON'); copy.exec(recoverySql(fixture.restored.db));
    assert.deepEqual(databaseSummary(copy), databaseSummary(fixture.restored.db));
    assert.equal(verifyDatabase(copy).families, 2);
    assert.equal(verifyDatabase(copy).files, 4);
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n, 0);
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM tokens_invitados WHERE activo=1').get().n, 0);
    const readers = copy.prepare("SELECT permisos_json FROM usuarios WHERE correo LIKE 'reader-%'").all();
    assert.equal(readers.length, 2);
    for (const reader of readers) assert.deepEqual(JSON.parse(reader.permisos_json).acciones, ['ver', 'descargar']);
    assert.equal(copy.prepare("SELECT COUNT(*) AS n FROM archivos WHERE r2_key LIKE 'd1:%'").get().n, 2);
    assert(fixture.archive.bytes < 2_000_000);
  } finally { copy.close(); fixture.restored.db.close(); }
});
