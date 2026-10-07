-- Additive only: existing profiles, records and attachments remain unchanged.
CREATE TABLE dosis_sos (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 fecha TEXT NOT NULL, medicamento TEXT NOT NULL, dosis TEXT NOT NULL, motivo TEXT NOT NULL,
 temperatura REAL CHECK(temperatura IS NULL OR temperatura BETWEEN 30 AND 45),
 intervalo_horas REAL CHECK(intervalo_horas IS NULL OR intervalo_horas BETWEEN 0.25 AND 720),
 observaciones TEXT NOT NULL DEFAULT '', adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sos_child_date ON dosis_sos(nino_id,fecha);
CREATE TABLE urgencias (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 fecha TEXT NOT NULL, centro TEXT NOT NULL, motivo TEXT NOT NULL, diagnostico TEXT NOT NULL DEFAULT '',
 indicaciones TEXT NOT NULL DEFAULT '', profesional TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_urgencias_child_date ON urgencias(nino_id,fecha);
CREATE TABLE horario_escolar (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 dia TEXT NOT NULL CHECK(dia IN ('Lunes','Martes','Miércoles','Jueves','Viernes')),
 hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL CHECK(hora_fin>hora_inicio),
 actividad TEXT NOT NULL, lugar TEXT NOT NULL DEFAULT '', materiales TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_horario_child_day ON horario_escolar(nino_id,dia,hora_inicio);
