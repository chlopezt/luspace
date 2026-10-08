-- Preserve every historical declaration; new general acceptances record no declaration.
CREATE TABLE consentimientos_registro_nuevo (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  version_legal TEXT NOT NULL,
  canal TEXT NOT NULL CHECK(canal IN ('correo','google')),
  aceptado_at TEXT NOT NULL,
  autorizacion_cuidado INTEGER NOT NULL CHECK(autorizacion_cuidado IN (0,1)),
  UNIQUE(usuario_id,version_legal)
);
INSERT INTO consentimientos_registro_nuevo
SELECT id,usuario_id,familia_id,version_legal,canal,aceptado_at,autorizacion_cuidado
FROM consentimientos_registro;
DROP TABLE consentimientos_registro;
ALTER TABLE consentimientos_registro_nuevo RENAME TO consentimientos_registro;
CREATE TRIGGER consentimiento_misma_familia BEFORE INSERT ON consentimientos_registro
WHEN NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.usuario_id AND familia_id=NEW.familia_id)
BEGIN SELECT RAISE(ABORT,'Consentimiento fuera de su familia'); END;
CREATE TRIGGER consentimiento_no_reescribir BEFORE UPDATE ON consentimientos_registro
BEGIN SELECT RAISE(ABORT,'Conserva el consentimiento original; registra una nueva version'); END;

