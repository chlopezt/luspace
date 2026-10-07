-- Additive migration approved after isolated preview. Preserves original records and files.
ALTER TABLE usuarios ADD COLUMN audit_visible INTEGER NOT NULL DEFAULT 0 CHECK(audit_visible IN(0,1));
ALTER TABLE usuarios ADD COLUMN ai_visible INTEGER NOT NULL DEFAULT 0 CHECK(ai_visible IN(0,1));
CREATE TABLE alimentacion (
 id TEXT PRIMARY KEY, nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
 fecha TEXT NOT NULL, via TEXT NOT NULL DEFAULT 'Oral', tipo_comida TEXT NOT NULL,
 textura TEXT NOT NULL DEFAULT 'Habitual', cantidad REAL CHECK(cantidad IS NULL OR cantidad BETWEEN 0 AND 10000),
 unidad TEXT NOT NULL DEFAULT 'ml', aceptacion TEXT NOT NULL DEFAULT '', reacciones TEXT NOT NULL DEFAULT '', observaciones TEXT NOT NULL DEFAULT '',
 adjuntos_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(adjuntos_json) AND json_type(adjuntos_json)='array'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alimentacion_child_date ON alimentacion(nino_id,fecha);
ALTER TABLE ninos ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE registros_crecimiento ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE medicamentos ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE consultas_medicas ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE examenes_medicos ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE vacunas ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE perfiles_escolares ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE perfiles_escolares ADD COLUMN adecuaciones_adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE historial_colegios ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE bitacora_escolar_diaria ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE credenciales_discapacidad ADD COLUMN adjuntos_json TEXT NOT NULL DEFAULT '[]';
