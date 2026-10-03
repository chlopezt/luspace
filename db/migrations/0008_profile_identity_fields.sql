-- Amplía Perfil e incorpora el módulo perfil como origen válido de adjuntos.
ALTER TABLE ninos ADD COLUMN rut TEXT;
ALTER TABLE ninos ADD COLUMN carnet_identidad_id TEXT;
ALTER TABLE ninos ADD COLUMN prevision_salud TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_principal_nombre TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_principal_parentesco TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_principal_telefono TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_secundario_nombre TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_secundario_parentesco TEXT;
ALTER TABLE ninos ADD COLUMN contacto_emergencia_secundario_telefono TEXT;
ALTER TABLE ninos ADD COLUMN colegio_actual TEXT;
ALTER TABLE ninos ADD COLUMN curso_actual TEXT;

-- La restricción original no contemplaba archivos de Perfil. Se reconstruye
-- preservando metadatos y blobs/chunks ya almacenados.
PRAGMA foreign_keys = OFF;
CREATE TABLE archivos_perfil_nuevo (
  id TEXT PRIMARY KEY,
  familia_id TEXT NOT NULL REFERENCES familias(id),
  nino_id TEXT NOT NULL REFERENCES ninos(id),
  modulo TEXT NOT NULL CHECK(modulo IN ('perfil','salud','escolar','anamnesis','rnd')),
  nombre TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  contenido BLOB
);
INSERT INTO archivos_perfil_nuevo(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,created_at,contenido)
  SELECT id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key,created_at,contenido FROM archivos;
CREATE TABLE archivo_chunks_respaldo AS SELECT archivo_id,indice,contenido FROM archivo_chunks;
DROP TABLE archivo_chunks;
DROP TABLE archivos;
ALTER TABLE archivos_perfil_nuevo RENAME TO archivos;
CREATE TABLE archivo_chunks (
  archivo_id TEXT NOT NULL REFERENCES archivos(id) ON DELETE CASCADE,
  indice INTEGER NOT NULL,
  contenido BLOB NOT NULL,
  PRIMARY KEY (archivo_id, indice)
);
INSERT INTO archivo_chunks(archivo_id,indice,contenido)
  SELECT archivo_id,indice,contenido FROM archivo_chunks_respaldo;
DROP TABLE archivo_chunks_respaldo;
CREATE INDEX IF NOT EXISTS idx_archivos_nino_modulo ON archivos(nino_id,modulo);
PRAGMA foreign_keys = ON;
