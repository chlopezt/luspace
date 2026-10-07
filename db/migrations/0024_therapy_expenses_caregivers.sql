-- Additive: no changes to existing health records or attachments.
CREATE TABLE sesiones_terapia (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 profesional TEXT NOT NULL, especialidad TEXT NOT NULL, fecha TEXT NOT NULL,
 objetivos TEXT NOT NULL DEFAULT '', tareas_hogar TEXT NOT NULL DEFAULT '', avances TEXT NOT NULL DEFAULT '', observaciones TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_terapia_child_date ON sesiones_terapia(nino_id,fecha);
CREATE TABLE gastos_medicos (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 fecha TEXT NOT NULL, concepto TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '',
 monto INTEGER NOT NULL CHECK(monto>=0 AND monto<=1000000000),
 estado_reembolso TEXT NOT NULL DEFAULT 'No aplica', monto_reembolsado INTEGER CHECK(monto_reembolsado IS NULL OR (monto_reembolsado>=0 AND monto_reembolsado<=monto)),
 observaciones TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gastos_child_date ON gastos_medicos(nino_id,fecha);
CREATE TABLE turnos_cuidadores (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 cuidador TEXT NOT NULL, parentesco TEXT NOT NULL DEFAULT '', hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL DEFAULT '',
 estado_animo TEXT NOT NULL DEFAULT '', alimentacion_hidratacion TEXT NOT NULL DEFAULT '', medicamentos_administrados TEXT NOT NULL DEFAULT '', notas_entrega TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_turnos_child_start ON turnos_cuidadores(nino_id,hora_inicio);
-- Atomic protection: only one open handover per child, even with simultaneous requests.
CREATE UNIQUE INDEX idx_turno_unico_abierto ON turnos_cuidadores(nino_id) WHERE hora_fin='';
