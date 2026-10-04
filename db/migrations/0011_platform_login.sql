CREATE TABLE IF NOT EXISTS credenciales_plataforma (
 usuario_id TEXT PRIMARY KEY REFERENCES administradores_plataforma(usuario_id) ON DELETE CASCADE,
 correo TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones_plataforma (
 id TEXT PRIMARY KEY,
 usuario_id TEXT NOT NULL REFERENCES administradores_plataforma(usuario_id) ON DELETE CASCADE,
 expira_at TEXT NOT NULL
);
