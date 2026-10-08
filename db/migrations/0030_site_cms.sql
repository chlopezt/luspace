CREATE TABLE IF NOT EXISTS configuracion_sitio (
 id INTEGER PRIMARY KEY CHECK(id=1),
 contenido_json TEXT NOT NULL CHECK(json_valid(contenido_json)),
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL,
 updated_by TEXT REFERENCES usuarios(id) ON DELETE SET NULL
);
