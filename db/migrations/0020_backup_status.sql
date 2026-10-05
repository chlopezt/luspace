-- Operational summaries only; no patient data, encryption keys or signed URLs.
CREATE TABLE IF NOT EXISTS respaldos_plataforma (
 id TEXT PRIMARY KEY,
 started_at TEXT NOT NULL,
 completed_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('running','verified','failed')),
 verified_files INTEGER NOT NULL DEFAULT 0,
 verified_families INTEGER NOT NULL DEFAULT 0,
 encrypted_bytes INTEGER NOT NULL DEFAULT 0,
 restore_test_at TEXT,
 error_code TEXT,
 retained_until TEXT,
 independent_copy TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_respaldos_fecha ON respaldos_plataforma(started_at DESC);
