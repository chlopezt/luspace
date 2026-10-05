import {readFileSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {backup} from 'node:sqlite';
import {decrypt,restoreArchive} from './backup-core.mjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,i,list)=>i%2?pairs:[...pairs,[value,list[i+1]]],[]));
const input=realpathSync(args['--input']||'.private-backups/encrypted');
const key=args['--key-file']?readFileSync(args['--key-file'],'utf8').trim():process.env.LUSPACE_BACKUP_KEY;
const objects=new Map();objects.set('manifest.enc',readFileSync(resolve(input,'manifest.enc')));
const manifest=JSON.parse(decrypt(objects.get('manifest.enc'),key,'manifest.enc'));
for(const o of manifest.objects){
 if(!/^(database\.sql\.gz\.enc|objects\/[a-f0-9-]{36}\.enc)$/.test(o.name))throw new Error('Nombre de objeto no permitido.');
 const path=realpathSync(resolve(input,o.name));if(!path.startsWith(input+sep))throw new Error('El archivo sale del directorio de la copia.');objects.set(o.name,readFileSync(path));
}
const restored=restoreArchive(objects,key);
try{
 if(args['--output']){
  const target=resolve(args['--output']),project=resolve('.');
  if(target===project||target.startsWith(project+sep)||target===input||input.startsWith(target+sep))throw new Error('Usa un directorio nuevo fuera del proyecto y de la copia original.');
  // mkdir without recursive refuses an existing target: never overwrite data.
  mkdirSync(target,{mode:0o700});await backup(restored.db,resolve(target,'luspace-restored.sqlite'));
  for(const file of restored.manifest.files){const dest=resolve(target,'files',file.key);if(!dest.startsWith(target+sep))throw new Error('Referencia inválida.');mkdirSync(resolve(dest,'..'),{recursive:true,mode:0o700});writeFileSync(dest,decrypt(objects.get(file.name),key,file.name),{flag:'wx',mode:0o600});}
  console.log('Restauración local completada en un directorio nuevo. No hay conexiones ni escrituras a producción.');
 }
 console.log(JSON.stringify({verified:true,families:restored.summary.families,files:restored.summary.files,sessions_revoked:true,production_modified:false}));
}finally{restored.db.close();}
