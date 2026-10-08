// Nueva organización; las versiones anteriores permanecen conservadas.
import {sections,updatedAt} from './legal-content-v2.js';
import {privacy} from './legal-content-v1.js';
export {updatedAt};
export const termsSections = sections.filter(section=>!section.title.startsWith('4. ')).map((section,index)=>({...section,title:section.title.replace(/^\d+\./,String(index+1)+'.')}));
export const privacySections = [
  {...sections[3],title:'1. DATOS PERSONALES Y DATOS SENSIBLES'},
  ...privacy.map(([title,text],index)=>({title:String(index+2)+'. '+title,paragraphs:[text]})),
  {...sections[9],title:'12. CONTACTO'},
];
