import { useContext, useEffect, useId, useState } from 'react';
import { ChevronDown, Clock3, History, Plus, RotateCcw } from 'lucide-react';
import { api, type Row } from './lib';
import { AccessActor } from './AccessPolicy';
import { canAccess } from '../shared/access-policy.js';
import { recentSosDoses } from '../shared/care.js';
import './dashboard-medications.css';

export default function DashboardSos({ childId, readonly, go }: {
  childId: string; readonly: boolean; go: (view: string, tab?: number, create?: boolean) => void;
}) {
  const actor = useContext(AccessActor), panelId = useId(), headingId = useId();
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const readable = canAccess(actor, 'salud');
  useEffect(() => {
    if (!open || !readable) return;
    let live = true;
    setLoading(true); setLoaded(false); setRows([]); setError('');
    api(`records/dosis_sos?child=${encodeURIComponent(childId)}`)
      .then(result => {
        if (!Array.isArray(result)) throw new Error('No se pudieron interpretar las dosis registradas.');
        if (live) { setRows(result); setLoaded(true); }
      })
      .catch(e => { if (live) setError((e as Error).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, childId, readable, retry]);
  if (!readable) return null;
  const recent = recentSosDoses(rows);
  return <section className="dashboard-sos">
    <button id={headingId} type="button" className="sos-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <History size={19} aria-hidden="true"/><span>Dosis SOS recientes</span>
      {loaded && !error && !loading && rows.length > 0 && <span className="sos-count" aria-label={`${rows.length} registros`}>{rows.length}</span>}
      <ChevronDown size={18} className="sos-chevron" aria-hidden="true"/>
    </button>
    <div id={panelId} role="region" aria-labelledby={headingId} aria-hidden={!open} inert={!open} className={`sos-collapse${open ? ' is-open' : ''}`}>
      <div className="sos-collapse-inner"><div className="sos-panel" aria-busy={loading}>
        {loading ? <p role="status" className="sos-message">Cargando dosis SOS…</p> : error ? <div className="sos-error">
          <p role="alert">No pudimos cargar las dosis SOS. {error}</p>
          <button type="button" className="medicine-secondary" onClick={() => setRetry(value => value + 1)}><RotateCcw size={16} aria-hidden="true"/>Reintentar</button>
        </div> : loaded && !recent.length ? <p role="status" className="sos-message">No hay dosis SOS registradas recientemente</p> : <>
          {loaded && <p className="sos-caption">{rows.length > recent.length ? 'Los 5 registros más recientes' : 'Últimas dosis registradas'}</p>}
          <ul className="sos-history" tabIndex={recent.length ? 0 : undefined} aria-label="Últimas dosis SOS registradas">
            {recent.map((row: Row) => {
              const date = new Date(Date.parse(row.fecha)), validDate = Number.isFinite(date.getTime());
              return <li key={row.id} className="sos-history-card">
                <Clock3 size={17} aria-hidden="true"/><div><strong>{row.medicamento || 'Medicamento no registrado'}</strong>
                  {validDate ? <time dateTime={date.toISOString()}>{date.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} · {date.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' })}</time> : <span>Fecha y hora no registradas</span>}
                  {row.dosis && <p>Dosis registrada: {row.dosis}</p>}
                </div>
              </li>;
            })}
          </ul>
        </>}
        <div className="sos-actions">
          {!readonly && canAccess(actor, 'salud', 'crear') && <button type="button" className="medicine-secondary" onClick={() => go('salud', 6, true)}><Plus size={16} aria-hidden="true"/>Registrar dosis SOS</button>}
          {loaded && rows.length > recent.length && <button type="button" className="link-button" onClick={() => go('salud', 6)}>Ver historial completo</button>}
        </div>
      </div></div>
    </div>
  </section>;
}
