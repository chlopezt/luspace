-- Alternativa gratuita a R2: adjuntos privados en D1.
-- D1 admite BLOBs de hasta 2 MB; la API restringe cada archivo a 1.5 MB.
ALTER TABLE archivos ADD COLUMN contenido BLOB;
