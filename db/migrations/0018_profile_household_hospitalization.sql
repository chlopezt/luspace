-- Additive migration: no existing family, profile, consultation or file is
-- deleted or rewritten. Empty values mean these answers are not registered.
ALTER TABLE ninos ADD COLUMN convivientes TEXT NOT NULL DEFAULT '';
ALTER TABLE ninos ADD COLUMN hospitalizado TEXT NOT NULL DEFAULT '' CHECK (hospitalizado IN ('', 'Sí', 'No'));
ALTER TABLE ninos ADD COLUMN hospitalizacion_motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE ninos ADD COLUMN hospitalizacion_estadia TEXT NOT NULL DEFAULT '';
ALTER TABLE consultas_medicas ADD COLUMN acompanante TEXT NOT NULL DEFAULT '';
