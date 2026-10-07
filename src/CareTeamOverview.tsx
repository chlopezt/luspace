import {HeartHandshake,Receipt,Users} from 'lucide-react';
import {currentCaregiver,expenseTotals,moneyCLP} from '../shared/care.js';
import {dateLabel,type Row} from './lib';
import './care-team.css';
export default function CareTeamOverview({table,rows,now,finish}:{table:string;rows:Row[];now:number;finish?:(row:Row)=>void}) {
 if(table==='gastos_medicos'){
   const totals=expenseTotals(rows);
   return <div className="expense-overview" aria-label="Resumen de gastos médicos">
     {[['Gastado',totals.spent],['Reembolsado',totals.reimbursed],['Pendiente de reembolso',totals.pending]].map(([label,value])=><article className="card" key={String(label)}><Receipt size={18}/><p>{label}</p><strong>{moneyCLP(value)}</strong><small>Pesos chilenos · registros de este perfil</small></article>)}
   </div>;
 }
 if(table==='turnos_cuidadores'){
   const active=currentCaregiver(rows,now);
   return <article className="card caregiver-overview" aria-live="polite"><Users size={24}/><div><small>Cuidador a cargo actualmente</small><h3>{active?.cuidador || 'Ningún turno abierto'}</h3>{active && <p>{active.parentesco} · Desde {dateLabel(active.hora_inicio)}</p>}<p className="muted">Finaliza el turno actual antes de abrir el siguiente. Esta bitácora no registra automáticamente dosis ni comidas en otros módulos.</p></div>{active && finish && <button className="secondary" onClick={()=>finish({...active,hora_fin:new Date().toISOString()})}>Finalizar turno</button>}</article>;
 }
 if(table==='sesiones_terapia'){
   const professionals=new Set(rows.map(r=>`${r.profesional.trim().toLocaleLowerCase('es')}|${r.especialidad.trim().toLocaleLowerCase('es')}`));
   return <article className="card caregiver-overview"><HeartHandshake size={24}/><div><h3>{professionals.size} profesionales · {rows.length} sesiones registradas</h3><p className="muted">Un registro por sesión, con objetivos, tareas asignadas y avances. Los informes y pautas se adjuntan dentro de cada sesión.</p></div></article>;
 }
 return null;
}
