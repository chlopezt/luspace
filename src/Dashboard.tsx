import { useEffect, useState, useContext } from "react";
import { Activity, AlertTriangle, Calendar, CalendarHeart, CheckCircle2, ChevronRight, GraduationCap, Pill, PencilLine, Ruler, Scale, Stethoscope } from "lucide-react";
import { api, age, today, dateLabel, type Row } from "./lib";
import { ErrorNote } from "./components";
import Growth from "./Growth";
import { todaySchedule } from '../shared/care.js';
import SosReminders from './SosReminders';
import Reminders from './Reminders';
import {AccessActor} from './AccessPolicy';
import {canAccess} from '../shared/access-policy.js';
import {models} from '../shared/models.js';
export function nextDose(m: Row, now: number) {
  if (
    !m.activo ||
    !m.hora_referencia ||
    !m.frecuencia_horas ||
    m.fecha_inicio > today() ||
    (m.fecha_termino && m.fecha_termino < today())
  )
    return null;
  const start = Date.parse(m.hora_referencia),
    step = Number(m.frecuencia_horas) * 3600000;
  if (!Number.isFinite(start) || step <= 0) return null;
  const next = start + Math.max(0, Math.ceil((now - start) / step)) * step;
  if (m.fecha_termino && next > Date.parse(m.fecha_termino + "T23:59:59"))
    return null;
  return next;
}
export default function Dashboard({
  child,
  go,
  readonly=false,
  remindersEnabled=false,
  available=[],
}: {
  child: Row;
  go: (v: string) => void;
  readonly?: boolean;
  remindersEnabled?: boolean;
  available?: string[];
}) {
  const actor=useContext(AccessActor), health=available.includes('salud'), school=available.includes('escolar');
  const [growth, setGrowth] = useState<Row[]>([]),
    [meds, setMeds] = useState<Row[]>([]),
    [visits, setVisits] = useState<Row[]>([]),
    [diary, setDiary] = useState<Row[]>([]),
    [schedule, setSchedule] = useState<Row[]>([]),
    [sos, setSos] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const tables = [
      "registros_crecimiento",
      "medicamentos",
      "consultas_medicas",
      "bitacora_escolar_diaria",
      "horario_escolar",
      "dosis_sos",
    ];
    Promise.all(tables.map((t) => (models[t as keyof typeof models].module==='salud'?health:school) ? api(`records/${t}?child=${child.id}`) : Promise.resolve([])))
      .then(([g, m, v, d, s, doses]) => {
        if (!live) return;
        setGrowth(
          g.sort((a: Row, b: Row) =>
            b.fecha_medicion.localeCompare(a.fecha_medicion),
          ),
        );
        setMeds(m);
        setVisits(v);
        setDiary(d);
        setSchedule(s);
        setSos(doses);
      })
      .catch((e) => {if(live)setError(e.message);})
      .finally(()=>{if(live)setLoading(false);});
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {live=false;clearInterval(timer);};
  }, [child.id, health, school]);
  const weight = growth.find((r) => r.peso_kg),
    height = growth.find((r) => r.talla_cm),
    activeMeds = meds
      .map((m): Row => ({ ...m, next: nextDose(m, now) }))
      .filter(
        (m) =>
          m.activo &&
          m.fecha_inicio <= today() &&
          (!m.fecha_termino || m.fecha_termino >= today()),
      )
      .sort((a, b) => (a.next || Number.MAX_SAFE_INTEGER) - (b.next || Number.MAX_SAFE_INTEGER)),
    upcomingVisits = visits
      .filter((v) => Date.parse(v.fecha) >= now)
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    mood = diary.find((d) => d.fecha === today()),
    allergyItems = String(child.alergias || "")
      .split(/[\n;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  const timeLabel = (value?: number) =>
    value
      ? new Date(value).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
      : "Sin horario";
  const visitDate = (value: string) => {
    const date = new Date(value);
    return {
      month: date.toLocaleDateString("es-CL", { month: "short" }).replace(".", "").toUpperCase(),
      day: date.toLocaleDateString("es-CL", { day: "2-digit" }),
      time: date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    };
  };
  if(loading)return <section className="card" role="status" aria-live="polite">Cargando…</section>;
  if(error)return <ErrorNote error={error}/>;
  return (
    <>
      <section className="intro home-intro">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>Hola, familia.</h1>
          <p className="muted">
            Una mirada tranquila al cuidado de{" "}
            {child.primer_nombre}.
          </p>
        </div>
      </section>
      <ErrorNote error={error} />
      {health && allergyItems.length > 0 && (
        <div className="allergy home-allergy">
          <AlertTriangle size={18} aria-hidden="true" />
          <strong>ALERGIAS REGISTRADAS:</strong>
          <div className="allergy-items">
            {allergyItems.map((item) => <span key={item}>• {item}</span>)}
          </div>
          <button className="allergy-detail" onClick={() => go("perfil")}>Ver detalles <ChevronRight size={16} /></button>
        </div>
      )}
      <section className="stats home-kpis">
        <article className="card stat home-kpi age-kpi">
          <span className="home-icon"><Calendar size={22} /></span><p>EDAD ACTUAL</p>
          <strong className="age-value">{age(child.fecha_nacimiento)}</strong>
          <button className="link-button" onClick={() => go("perfil")}>Ver perfil <ChevronRight size={15} /></button>
        </article>
        {health && <article className="card stat teal home-kpi">
          <span className="home-icon teal-icon"><Scale size={22} /></span><p>PESO RECIENTE</p>
          <strong>{weight ? weight.peso_kg + " kg" : "Sin registro"}</strong>
          <small>
            {weight
              ? dateLabel(weight.fecha_medicion)
              : "Agrega su primera medición"}
          </small>
        </article>}
        {health && <article className="card stat violet home-kpi">
          <span className="home-icon violet-icon"><Ruler size={22} /></span><p>TALLA RECIENTE</p>
          <strong>{height ? height.talla_cm + " cm" : "Sin registro"}</strong>
          <small>
            {height
              ? dateLabel(height.fecha_medicion)
              : "Agrega su primera medición"}
          </small>
        </article>}
      </section>
      <section className="grid home-grid">
        {health && <Growth child={child} rows={growth} />}
        {health && <article className="card medicine dashboard-panel home-panel">
          <div className="section-heading">
            <h2><Pill size={19} /> Medicamentos activos</h2>
            <button className="home-add" disabled={readonly || !canAccess(actor,'salud','crear')} onClick={() => go("salud")}>＋ Agregar</button>
          </div>
          {activeMeds.length ? (
            <ul className="dashboard-list medication-list">
              {activeMeds.map((med) => (
                <li key={med.id}>
                  <Pill size={17} aria-hidden="true" />
                  <button className="link-button" onClick={() => go("salud")}>{med.nombre}</button>
                  <span className="dose">{med.dosis || "Dosis sin registrar"}</span>
                  <time>{timeLabel(med.next)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Sin tratamientos activos programados.</p>
          )}
          <button className="soft-action" onClick={() => go("salud")}>
            Ver tratamientos
          </button>
          {sos.length > 0 && <details><summary>Dosis SOS recientes</summary><SosReminders rows={sos} now={now}/></details>}
        </article>}
        {school && <article className="card school dashboard-panel home-panel">
          <div className="section-heading">
            <h2><GraduationCap size={20} /> Hoy en el colegio</h2>
            <span className={mood ? "home-status done" : "home-status"}>{mood ? <><CheckCircle2 size={14} /> Completado</> : "Pendiente"}</span>
          </div>
          <div className="school-cta">
            <ul className="daily-routine">
              {todaySchedule(schedule, new Date(now)).map((block:Row)=><li key={block.id}><time>{block.hora_inicio}–{block.hora_fin}</time><div><strong>{block.actividad}</strong>{block.lugar && <small>{block.lugar}</small>}{block.materiales && <p>Materiales / recordatorios: {block.materiales}</p>}</div></li>)}
            </ul>
            {!todaySchedule(schedule, new Date(now)).length && <p className="muted">No hay actividades programadas para hoy.</p>}
            <h3>{mood ? mood.estado_animo : "Bitácora de hoy pendiente"}</h3>
            <p className="muted">
            {mood
              ? mood.crisis_sobrecarga
                ? "Sobrecarga registrada. Revisa los apoyos utilizados."
                : "Sin sobrecarga registrada."
              : "Registra cómo estuvo su día y qué apoyos ayudaron."}
            </p>
            <button className="primary" disabled={readonly || !canAccess(actor,'escolar','crear')} onClick={() => go("escolar")}>
              <PencilLine size={16} /> Registrar bitácora
            </button>
          </div>
        </article>}
        {health && <article className="card appointment dashboard-panel home-panel">
          <div className="section-heading">
            <h2><Stethoscope size={20} /> Próximos controles médicos</h2>
            <CalendarHeart size={20} className="panel-heading-icon" />
          </div>
          {upcomingVisits.length ? (
            <ul className="dashboard-list appointment-list">
              {upcomingVisits.map((visit) => (
                <li key={visit.id}>
                  {(() => { const date = visitDate(visit.fecha); return <>
                    <time className="calendar-block"><b>{date.month}</b><strong>{date.day}</strong><small>{date.time}</small></time>
                    <div className="appointment-copy">
                      <button className="link-button" title={visit.especialidad || "Consulta médica"} onClick={() => go("salud")}>{visit.especialidad || "Consulta médica"} ↗</button>
                      <p>{visit.medico_nombre || "Profesional por confirmar"}</p>
                      <small>Programado <ChevronRight size={14} /></small>
                    </div>
                  </>; })()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No hay controles programados.</p>
          )}
          <button className="soft-action" onClick={() => go("salud")}>
            Gestionar consultas
          </button>
        </article>}
      </section>
      {remindersEnabled&&<Reminders compact selectedChild={child.id} readonly={readonly} onViewAll={()=>go('recordatorios')}/>}
    </>
  );
}
