PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS familias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('superadmin', 'editor')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ninos (
  id TEXT PRIMARY KEY,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  primer_nombre TEXT NOT NULL,
  apellidos TEXT,
  apodo TEXT,
  fecha_nacimiento TEXT NOT NULL,
  grupo_sanguineo TEXT,
  alergias TEXT,
  rnd_habilitado INTEGER NOT NULL DEFAULT 0 CHECK (rnd_habilitado IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registros_crecimiento (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  fecha_medicion TEXT NOT NULL,
  peso_kg REAL CHECK (peso_kg > 0),
  talla_cm REAL CHECK (talla_cm > 0),
  perimetro_cefalico_cm REAL CHECK (perimetro_cefalico_cm > 0),
  notas TEXT,
  creado_por_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicamentos (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dosis TEXT NOT NULL,
  frecuencia_horas INTEGER CHECK (frecuencia_horas > 0),
  hora_referencia TEXT,
  fecha_inicio TEXT NOT NULL,
  fecha_termino TEXT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  instrucciones_especiales TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultas_medicas (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  medico_nombre TEXT NOT NULL,
  especialidad TEXT,
  motivo_consulta TEXT,
  diagnostico TEXT,
  plan_tratamiento TEXT,
  archivo_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credenciales_discapacidad (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL UNIQUE REFERENCES ninos(id) ON DELETE CASCADE,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  folio TEXT,
  tipo_discapacidad TEXT,
  movilidad_reducida INTEGER NOT NULL DEFAULT 0 CHECK (movilidad_reducida IN (0, 1)),
  fecha_vencimiento TEXT,
  frente_r2_key TEXT,
  reverso_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perfiles_escolares (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL UNIQUE REFERENCES ninos(id) ON DELETE CASCADE,
  colegio_actual TEXT,
  curso TEXT,
  pie_paci_activo INTEGER NOT NULL DEFAULT 0 CHECK (pie_paci_activo IN (0, 1)),
  detonantes TEXT,
  estrategias_autorregulacion TEXT,
  adecuaciones_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(adecuaciones_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS historial_colegios (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  establecimiento TEXT NOT NULL,
  periodo_desde TEXT,
  periodo_hasta TEXT,
  cursos_realizados TEXT,
  motivo_retiro TEXT,
  observaciones TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bitacora_escolar_diaria (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  estado_animo TEXT NOT NULL CHECK (estado_animo IN ('tranquilo', 'sobrecargado', 'feliz', 'fatigado')),
  crisis_sobrecarga INTEGER NOT NULL DEFAULT 0 CHECK (crisis_sobrecarga IN (0, 1)),
  incidentes TEXT,
  resolucion TEXT,
  creado_por_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nino_id, fecha)
);

CREATE TABLE IF NOT EXISTS anamnesis (
  id TEXT PRIMARY KEY,
  nino_id TEXT NOT NULL UNIQUE REFERENCES ninos(id) ON DELETE CASCADE,
  documento_json TEXT NOT NULL CHECK (json_valid(documento_json)),
  version INTEGER NOT NULL DEFAULT 1,
  actualizado_por_usuario_id TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens_invitados (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  nino_id TEXT NOT NULL REFERENCES ninos(id) ON DELETE CASCADE,
  destino_nombre TEXT NOT NULL,
  modulos_json TEXT NOT NULL CHECK (json_valid(modulos_json)),
  expira_at TEXT NOT NULL,
  pin_hash TEXT,
  max_accesos INTEGER,
  contador_accesos INTEGER NOT NULL DEFAULT 0,
  un_solo_uso INTEGER NOT NULL DEFAULT 0 CHECK (un_solo_uso IN (0, 1)),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_por_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  token_invitado_id TEXT REFERENCES tokens_invitados(id) ON DELETE SET NULL,
  accion TEXT NOT NULL CHECK (accion IN ('LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD_PDF', 'GUEST_ACCESS', 'REVOKE', 'BACKUP_EXPORT')),
  descripcion TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (usuario_id IS NOT NULL OR token_invitado_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_familia_id ON usuarios(familia_id);
CREATE INDEX IF NOT EXISTS idx_ninos_familia_id ON ninos(familia_id);
CREATE INDEX IF NOT EXISTS idx_crecimiento_nino_fecha ON registros_crecimiento(nino_id, fecha_medicion DESC);
CREATE INDEX IF NOT EXISTS idx_medicamentos_nino_activo ON medicamentos(nino_id, activo) WHERE activo = 1;
CREATE INDEX IF NOT EXISTS idx_consultas_nino_fecha ON consultas_medicas(nino_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_nino_fecha ON bitacora_escolar_diaria(nino_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_historial_nino_periodo ON historial_colegios(nino_id, periodo_desde DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_nino_activo ON tokens_invitados(nino_id, activo, expira_at);
CREATE INDEX IF NOT EXISTS idx_audit_familia_fecha ON audit_logs(familia_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario_fecha ON audit_logs(usuario_id, created_at DESC);
PRAGMA optimize;
