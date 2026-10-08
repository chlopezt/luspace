ALTER TABLE sesiones_plataforma ADD COLUMN mfa_verified_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE plataforma_mfa (
 usuario_id TEXT PRIMARY KEY REFERENCES credenciales_plataforma(usuario_id) ON DELETE CASCADE,
 activo INTEGER NOT NULL DEFAULT 0 CHECK(activo IN(0,1)),
 secreto_cifrado TEXT,
 pendiente_cifrado TEXT,
 pendiente_expira_at INTEGER,
 ultimo_paso INTEGER NOT NULL DEFAULT -1,
 activacion_id TEXT,
 activado_at TEXT
);
CREATE TABLE plataforma_mfa_recuperacion (
 usuario_id TEXT NOT NULL REFERENCES plataforma_mfa(usuario_id) ON DELETE CASCADE,
 codigo_hash TEXT NOT NULL,
 usado_at TEXT,
 PRIMARY KEY(usuario_id,codigo_hash)
);
