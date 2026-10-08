import {defaultSiteConfig,validateSiteConfig} from '../shared/site-config.js';
export async function readSiteConfig(db) {
  const row=await db.prepare('SELECT contenido_json,revision,updated_at FROM configuracion_sitio WHERE id=1').first();
  return {config:row?JSON.parse(row.contenido_json):structuredClone(defaultSiteConfig),revision:row?.revision||0,updated_at:row?.updated_at||null};
}
export async function saveSiteConfig(db,actor,input) {
  const config=validateSiteConfig(input?.config);
  if(!Number.isSafeInteger(input?.revision)||input.revision<0)throw Object.assign(new Error('Versión inválida.'),{status:400});
  const now=new Date().toISOString();
  await db.prepare('INSERT OR IGNORE INTO configuracion_sitio(id,contenido_json,revision,updated_at) VALUES(1,?,0,?)').bind(JSON.stringify(defaultSiteConfig),now).run();
  const results=await db.batch([
    db.prepare('UPDATE configuracion_sitio SET contenido_json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=?').bind(JSON.stringify(config),now,actor.id,input.revision),
    db.prepare("INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) SELECT ?,?,'SITE_CONFIG_UPDATE',? WHERE changes()=1").bind(crypto.randomUUID(),actor.id,'Actualización de contenido público del sitio; revisión '+(input.revision+1)),
  ]);
  if(!results[0].meta.changes)throw Object.assign(new Error('Otra sesión modificó el sitio. Recarga la configuración antes de guardar.'),{status:409});
  return {config,revision:input.revision+1,updated_at:now};
}
