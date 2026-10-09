CREATE TABLE IF NOT EXISTS recordatorios (
  id TEXT PRIMARY KEY,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nino_id TEXT REFERENCES ninos(id) ON DELETE CASCADE,
  responsable_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL CHECK(length(titulo) BETWEEN 1 AND 180),
  categoria TEXT NOT NULL DEFAULT 'Otro' CHECK(categoria IN ('Salud','Educación','Cuidado','Otro')),
  fecha TEXT,
  notas TEXT NOT NULL DEFAULT '',
  completado INTEGER NOT NULL DEFAULT 0 CHECK(completado IN (0,1)),
  completado_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS recordatorios_familia_estado ON recordatorios(familia_id,completado,fecha);
CREATE TRIGGER IF NOT EXISTS recordatorios_scope_insert BEFORE INSERT ON recordatorios
WHEN (NEW.nino_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ninos WHERE id=NEW.nino_id AND familia_id=NEW.familia_id)) OR (NEW.responsable_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.responsable_id AND familia_id=NEW.familia_id))
BEGIN SELECT RAISE(ABORT,'recordatorio fuera de su familia'); END;
CREATE TRIGGER IF NOT EXISTS recordatorios_scope_update BEFORE UPDATE ON recordatorios
WHEN (NEW.nino_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ninos WHERE id=NEW.nino_id AND familia_id=NEW.familia_id)) OR (NEW.responsable_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.responsable_id AND familia_id=NEW.familia_id))
BEGIN SELECT RAISE(ABORT,'recordatorio fuera de su familia'); END;
-- Add the module to existing standard full-family access without expanding
-- accounts with restricted module sets. Preserve every action/privacy setting.
UPDATE usuarios SET permisos_json=json_insert(permisos_json,'$.modules[#]','recordatorios')
WHERE json_valid(permisos_json) AND json_type(permisos_json,'$.modules')='array'
AND NOT EXISTS(SELECT 1 FROM json_each(permisos_json,'$.modules') WHERE value='recordatorios')
AND (SELECT COUNT(DISTINCT value) FROM json_each(permisos_json,'$.modules') WHERE value IN ('perfil','salud','escolar','anamnesis','rnd'))=5;
