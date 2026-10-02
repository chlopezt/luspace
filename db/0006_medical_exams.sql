CREATE TABLE IF NOT EXISTS examenes_medicos (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  lugar TEXT,
  observaciones TEXT,
  archivo_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_examenes_medicos_nino_fecha ON examenes_medicos(nino_id, fecha DESC);
