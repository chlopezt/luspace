import { Clock } from 'lucide-react';
import { sosReminders } from '../shared/care.js';
import { dateLabel, type Row } from './lib';
export default function SosReminders({rows,now}:{rows:Row[];now:number}) {
  const reminders = sosReminders(rows,now);
  return <div className="sos-reminders" aria-live="polite">
    {reminders.map((r:Row)=><p key={r.id}><Clock size={16}/><span><strong>{r.medicamento}</strong> · {r.next>now ? `Intervalo indicado: faltan ${Math.ceil((r.next-now)/60000)} min` : 'Se cumplió el intervalo registrado'}<small>Referencia: {dateLabel(new Date(r.next).toISOString())}. No implica que deba administrarse otra dosis.</small></span></p>)}
  </div>;
}
