// Fictitious data only. Server rendering never runs effects or calls the API.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {models} from '../shared/models.js';
const server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
try {
  const {default:Dashboard}=await server.ssrLoadModule('/src/Dashboard.tsx');
  const {default:ChildAvatar}=await server.ssrLoadModule('/src/ChildAvatar.tsx');
  const {default:TrialCard}=await server.ssrLoadModule('/src/TrialCard.tsx');
  const {Records,Attachments}=await server.ssrLoadModule('/src/components.tsx');
  const child={id:'fictitious',primer_nombre:'Mateo',fecha_nacimiento:'2024-01-01'};
  for(const element of [React.createElement(Dashboard,{child,go:()=>{}}),React.createElement(Records,{child,table:'consultas_medicas'}),React.createElement(Attachments,{child,module:'salud'})]) {
    const html=renderToStaticMarkup(element);
    assert.match(html,/role="status"/);
    assert.match(html,/Cargando/);
    assert.doesNotMatch(html,/Aún no hay información|Sin documentos adjuntos|Sin registro|Bitácora de hoy pendiente/);
  }
  assert.match(renderToStaticMarkup(React.createElement(ChildAvatar,{child})),/>M<\/span>/);
  assert.match(renderToStaticMarkup(React.createElement(ChildAvatar,{child:{...child,id:'second',primer_nombre:'Sofía'}})),/>S<\/span>/);
  assert.match(renderToStaticMarkup(React.createElement(ChildAvatar,{child:{...child,foto_perfil_id:'unavailable'}})),/>M<\/span>/);
  for(const daysLeft of [14,7,1,0]) {
    const html=renderToStaticMarkup(React.createElement(TrialCard,{daysLeft,onActivate:()=>{}}));
    assert.match(html,/Activar plan/);
    assert.match(html,new RegExp(`aria-valuenow="${daysLeft}"`));
    assert.match(html,new RegExp(`width:${daysLeft/14*100}%`));
    assert.match(html,daysLeft===0?/Tu prueba ha terminado/:daysLeft===1?/Te queda 1 día/:new RegExp(`Te quedan ${daysLeft} días`));
  }
  for(const table of ['ninos','perfiles_escolares']) {
    assert.equal(models[table].fields.find(f=>f.key==='colegio_actual').label,'Institución o modalidad de cuidado');
    assert.match(models[table].fields.find(f=>['curso','curso_actual'].includes(f.key)).label,/Nivel, etapa o curso/);
  }
  console.log('Verificación correcta: estados iniciales de carga, iniciales y etiquetas de cuidado.');
} finally {await server.close();}
