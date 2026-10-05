-- Unfinished uploads remain reserved: fail closed, do not expire a reservation
-- while an R2 object may still exist. Metadata completion releases it atomically.
CREATE TABLE reservas_almacenamiento (
 id TEXT PRIMARY KEY,
 bytes INTEGER NOT NULL CHECK(bytes>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER reservas_global_guard BEFORE INSERT ON reservas_almacenamiento
WHEN (SELECT COALESCE(SUM(bytes),0) FROM archivos)+(SELECT COALESCE(SUM(bytes),0) FROM reservas_almacenamiento)+NEW.bytes>8000000000
BEGIN SELECT RAISE(ABORT,'APP_STORAGE_LIMIT_EXCEEDED'); END;
DROP TRIGGER archivos_app_storage_guard;
CREATE TRIGGER archivos_app_storage_guard BEFORE INSERT ON archivos
WHEN (SELECT COALESCE(SUM(bytes),0) FROM archivos)+(SELECT COALESCE(SUM(bytes),0) FROM reservas_almacenamiento)+NEW.bytes>8000000000
BEGIN SELECT RAISE(ABORT,'APP_STORAGE_LIMIT_EXCEEDED'); END;
-- Protect the D1 fallback too. This measures attachment payload only, NOT the
-- total size of the database, its indexes, metadata or other databases.
CREATE TRIGGER archivo_chunks_global_guard BEFORE INSERT ON archivo_chunks
WHEN (SELECT COALESCE(SUM(length(contenido)),0) FROM archivo_chunks)+(SELECT COALESCE(SUM(length(contenido)),0) FROM archivos)+length(NEW.contenido)>200000000
BEGIN SELECT RAISE(ABORT,'D1_ATTACHMENT_LIMIT_EXCEEDED'); END;
CREATE TABLE notificaciones_plataforma_leidas (
 usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 clave TEXT NOT NULL,
 leido_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(usuario_id,clave)
);
