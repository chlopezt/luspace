CREATE TABLE IF NOT EXISTS archivo_chunks (
  archivo_id TEXT NOT NULL REFERENCES archivos(id) ON DELETE CASCADE,
  indice INTEGER NOT NULL,
  contenido BLOB NOT NULL,
  PRIMARY KEY (archivo_id, indice)
);
