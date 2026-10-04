CREATE TABLE identidades_google (
  subject TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE oauth_google_estados (
  id TEXT PRIMARY KEY,
  navegador_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  modo TEXT NOT NULL CHECK (modo IN ('login','register')),
  nombre TEXT NOT NULL,
  familia TEXT NOT NULL,
  expira_at TEXT NOT NULL
);
