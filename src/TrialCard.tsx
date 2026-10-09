import {Gift,Hourglass,CheckCircle2} from 'lucide-react';
import './trial-card.css';

export default function TrialCard({daysLeft,onActivate,paidUntil}:{daysLeft:number;onActivate:()=>void;paidUntil?:string|null}) {
  if(paidUntil && Number.isFinite(Date.parse(paidUntil)))return <section className="trial-card" aria-label="Tu plan pagado">
    <span className="trial-card-label"><CheckCircle2 size={17} aria-hidden="true"/> Pago confirmado</span>
    <div className="trial-card-heading"><strong>Mes pagado</strong><CheckCircle2 size={23} aria-hidden="true"/></div>
    <p className="trial-card-validity">Acceso hasta {new Date(paidUntil).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'})}</p>
    <button type="button" className="trial-card-action" onClick={onActivate}>Ver mi plan</button>
  </section>;
  const days=Number.isFinite(daysLeft)?Math.max(0,Math.ceil(daysLeft)):0;
  const percentage=Math.min(100,days/14*100);
  return <section className="trial-card" aria-label="Tu prueba gratuita">
    <span className="trial-card-label"><Gift size={17} aria-hidden="true"/> Prueba gratis</span>
    <div className="trial-card-heading"><strong>{days>0?`Te ${days===1?'queda':'quedan'} ${days} ${days===1?'día':'días'}`:'Tu prueba ha terminado'}</strong><Hourglass size={23} aria-hidden="true"/></div>
    <div className="trial-card-track" role="progressbar" aria-label="Días restantes de la prueba gratuita" aria-valuemin={0} aria-valuemax={14} aria-valuenow={Math.min(14,days)} aria-valuetext={`${days} ${days===1?'día restante':'días restantes'}`}><span style={{width:`${percentage}%`}}/></div>
    <button type="button" className="trial-card-action" onClick={onActivate}>Activar plan</button>
  </section>;
}
