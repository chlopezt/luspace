ALTER TABLE ninos ADD COLUMN diagnostico TEXT;
ALTER TABLE ninos ADD COLUMN especialistas_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ninos ADD COLUMN foto_perfil_id TEXT;
ALTER TABLE perfiles_escolares ADD COLUMN paec_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE usuarios ADD COLUMN permisos_json TEXT NOT NULL DEFAULT '{"modulos":["perfil","salud","escolar","anamnesis","rnd"],"acciones":["ver","crear","editar","eliminar"]}';
