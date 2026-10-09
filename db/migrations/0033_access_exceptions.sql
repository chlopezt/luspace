CREATE TABLE family_access_exceptions (
 familia_id TEXT PRIMARY KEY REFERENCES familias(id),
 read_until TEXT,
 write_until TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
