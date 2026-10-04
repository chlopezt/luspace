-- Centro de administración familiar: configuración persistente del SuperAdmin.
CREATE TABLE IF NOT EXISTS familia_configuracion (
  familia_id TEXT PRIMARY KEY REFERENCES familias(id) ON DELETE CASCADE,
  logo_archivo_id TEXT,
  nino_principal_id TEXT,
  modulos_activos_json TEXT NOT NULL DEFAULT '["perfil","salud","escolar","anamnesis","rnd"]' CHECK (json_valid(modulos_activos_json)),
  rnd_visible INTEGER NOT NULL DEFAULT 1 CHECK (rnd_visible IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
