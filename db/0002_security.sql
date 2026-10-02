ALTER TABLE ninos ADD COLUMN sexo_referencia TEXT NOT NULL DEFAULT 'sin_registrar' CHECK(sexo_referencia IN ('sin_registrar','masculino','femenino'));
ALTER TABLE perfiles_escolares ADD COLUMN fortalezas TEXT;
ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1));
CREATE TABLE credenciales_usuario(usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE, password_hash TEXT NOT NULL);
CREATE TABLE sesiones(id TEXT PRIMARY KEY, usuario_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE, token_invitado_id TEXT REFERENCES tokens_invitados(id) ON DELETE CASCADE, expira_at TEXT NOT NULL, CHECK((usuario_id IS NULL) != (token_invitado_id IS NULL)));
CREATE TABLE archivos(id TEXT PRIMARY KEY, familia_id TEXT NOT NULL REFERENCES familias(id), nino_id TEXT NOT NULL REFERENCES ninos(id), modulo TEXT NOT NULL CHECK(modulo IN ('salud','escolar','anamnesis','rnd')), nombre TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, r2_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE intentos_acceso(clave TEXT PRIMARY KEY, cantidad INTEGER NOT NULL, reinicio INTEGER NOT NULL);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_archivos_nino_modulo ON archivos(nino_id,modulo);
