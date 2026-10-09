// Synthetic data only; no network, account or production database access.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToFile} from '@react-pdf/renderer';
import {mkdir} from 'node:fs/promises';
const server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
try{
 const {Report}=await server.ssrLoadModule('/src/report.tsx');
 await mkdir('tmp/pdfs',{recursive:true});
 const data={created:'2026-10-09T12:00:00Z',child:{primer_nombre:'Paciente',apellidos:'Prueba ficticia',fecha_nacimiento:'2020-01-01'},sections:{
 medicamentos:Array.from({length:12},(_,i)=>({id:'med'+i,nombre:'Medicamento ficticio '+i,dosis:'Dosis de prueba',activo:1,frecuencia_horas:24,fecha_inicio:'2026-10-01',instrucciones_especiales:'Indicación ficticia para revisión visual, sin uso médico. '.repeat(3)})),
 consultas_medicas:Array.from({length:5},(_,i)=>({id:'c'+i,especialidad:'Consulta ficticia '+i,medico_nombre:'Profesional de prueba',fecha:'2026-10-01T12:00:00Z',motivo_consulta:'CONTROL QA '+i,diagnostico:'Información ficticia para verificar conservación y paginación. '.repeat(4)}))}};
 await renderToFile(React.createElement(Report,{data}),'tmp/pdfs/pagination-check.pdf');
 console.log('Synthetic PDF generated: tmp/pdfs/pagination-check.pdf');
}finally{await server.close();}
