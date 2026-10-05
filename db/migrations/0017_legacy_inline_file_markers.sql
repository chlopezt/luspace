-- Compatibility with the original inline D1 uploads (r2_key = id).
-- Only normalize exact, unverified markers with a complete original belonging
-- to an existing child of the SAME family. No bytes or ownership are changed.
-- This also makes these originals eligible for the verified R2 copy workflow.
UPDATE archivos
SET r2_key = 'd1:' || id
WHERE r2_key = id
  AND contenido IS NOT NULL
  AND length(contenido) = bytes
  AND sha256 IS NULL
  AND r2_verified_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ninos
    WHERE ninos.id = archivos.nino_id
      AND ninos.familia_id = archivos.familia_id
  );
