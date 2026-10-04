ALTER TABLE familias ADD COLUMN trial_ends_at TEXT;
ALTER TABLE familias ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK(subscription_status IN ('trial','active','past_due','canceled','expired'));
ALTER TABLE familias ADD COLUMN storage_used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(storage_used_bytes>=0);
ALTER TABLE familias ADD COLUMN storage_limit_bytes INTEGER NOT NULL DEFAULT 52428800 CHECK(storage_limit_bytes>=0);
ALTER TABLE familias ADD COLUMN commercial_exempt INTEGER NOT NULL DEFAULT 0 CHECK(commercial_exempt IN(0,1));
-- Existing families are preserved, without a retroactive commercial lockout.
UPDATE familias SET subscription_status='active',commercial_exempt=1,
 storage_used_bytes=(SELECT COALESCE(SUM(bytes),0) FROM archivos WHERE familia_id=familias.id);
CREATE TRIGGER familias_trial_start AFTER INSERT ON familias BEGIN
 UPDATE familias SET trial_ends_at=strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at,'+14 days') WHERE id=NEW.id;
END;
CREATE TRIGGER archivos_quota_guard BEFORE INSERT ON archivos
WHEN EXISTS(SELECT 1 FROM familias WHERE id=NEW.familia_id AND commercial_exempt=0 AND storage_used_bytes+NEW.bytes>storage_limit_bytes)
BEGIN SELECT RAISE(ABORT,'STORAGE_QUOTA_EXCEEDED'); END;
CREATE TRIGGER archivos_usage_insert AFTER INSERT ON archivos BEGIN
 UPDATE familias SET storage_used_bytes=storage_used_bytes+NEW.bytes WHERE id=NEW.familia_id;
END;
CREATE TRIGGER archivos_usage_delete AFTER DELETE ON archivos BEGIN
 UPDATE familias SET storage_used_bytes=MAX(0,storage_used_bytes-OLD.bytes) WHERE id=OLD.familia_id;
END;
