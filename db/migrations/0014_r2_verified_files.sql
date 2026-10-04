ALTER TABLE archivos ADD COLUMN sha256 TEXT;
ALTER TABLE archivos ADD COLUMN r2_verified_at TEXT;
-- Application-wide reserve below the R2 free storage allowance. This is not
-- an account-wide billing cap; other buckets and operation usage are separate.
CREATE TRIGGER archivos_app_storage_guard BEFORE INSERT ON archivos
WHEN (SELECT COALESCE(SUM(bytes),0) FROM archivos)+NEW.bytes>8000000000
BEGIN SELECT RAISE(ABORT,'APP_STORAGE_LIMIT_EXCEEDED'); END;
