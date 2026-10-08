CREATE TABLE consentimientos_registro (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  version_legal TEXT NOT NULL,
  canal TEXT NOT NULL CHECK(canal IN ('correo','google')),
  aceptado_at TEXT NOT NULL,
  autorizacion_cuidado INTEGER NOT NULL CHECK(autorizacion_cuidado=1),
  UNIQUE(usuario_id,version_legal)
);
CREATE TRIGGER consentimiento_misma_familia BEFORE INSERT ON consentimientos_registro
WHEN NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.usuario_id AND familia_id=NEW.familia_id)
BEGIN SELECT RAISE(ABORT,'Consentimiento fuera de su familia'); END;
CREATE TRIGGER consentimiento_no_reescribir BEFORE UPDATE ON consentimientos_registro
BEGIN SELECT RAISE(ABORT,'Conserva el consentimiento original; registra una nueva version'); END;
ALTER TABLE oauth_google_estados ADD COLUMN version_legal TEXT;

