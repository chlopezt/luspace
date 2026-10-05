import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve('../work/private-backup-key');
mkdirSync(root,{recursive:true});
const path=resolve(root,'LUSPACE_BACKUP_KEY.txt');
if(!existsSync(path))writeFileSync(path,randomBytes(32).toString('hex')+'\n',{flag:'wx',mode:0o600});
if(process.platform==='win32'){
 if(!process.env.USERNAME)throw new Error('No se pudo identificar al propietario del archivo privado.');
 execFileSync('icacls',[path,'/inheritance:r','/grant:r',`${process.env.USERNAME}:(R,W)`,'SYSTEM:(F)'],{stdio:'ignore'});
}
console.log('Clave creada en archivo privado; su valor no se imprime: '+path);
