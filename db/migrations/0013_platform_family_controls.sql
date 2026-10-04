-- Platform overrides are separate from settings editable by a family.
CREATE TABLE plataforma_controles_familia (
 familia_id TEXT PRIMARY KEY REFERENCES familias(id) ON DELETE CASCADE,
 modulos_bloqueados_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(modulos_bloqueados_json)),
 ai_enabled INTEGER NOT NULL DEFAULT 1 CHECK(ai_enabled IN (0,1)),
 uploads_enabled INTEGER NOT NULL DEFAULT 1 CHECK(uploads_enabled IN (0,1)),
 reports_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reports_enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
