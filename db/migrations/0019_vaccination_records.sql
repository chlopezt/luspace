-- Additive migration: no existing clinical records or attachments are changed.
CREATE TABLE IF NOT EXISTS vacunas (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  catalogo_id TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL,
  dosis TEXT NOT NULL DEFAULT '',
  etapa TEXT NOT NULL CHECK (etapa IN ('0–6 meses','12–36 meses','Escolar','Particulares')),
  estado TEXT NOT NULL CHECK (estado IN ('Administrada','Pendiente/Próxima','Atrasada')),
  fecha_aplicacion TEXT NOT NULL DEFAULT '',
  fecha_prevista TEXT NOT NULL DEFAULT '',
  centro TEXT NOT NULL DEFAULT '',
  lote_marca TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  referencia TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vacunas_nino ON vacunas(nino_id, fecha_aplicacion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vacunas_dosis ON vacunas(nino_id,catalogo_id) WHERE catalogo_id<>'';
