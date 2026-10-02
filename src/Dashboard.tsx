import { useEffect, useState } from "react";
import { BookOpen, HeartPulse, CalendarDays } from "lucide-react";
import { api, age, today, dateLabel, type Row } from "./lib";
import { ErrorNote } from "./components";
import Growth from "./Growth";
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
}: {
  child: Row;
  go: (v: string) => void;
}) {
  const [growth, setGrowth] = useState<Row[]>([]),
    [meds, setMeds] = useState<Row[]>([]),
    [visits, setVisits] = useState<Row[]>([]),
    [diary, setDiary] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tables = [
      "registros_crecimiento",
      "medicamentos",
      "consultas_medicas",
      "bitacora_escolar_diaria",
    ];
    Promise.all(tables.map((t) => api(`records/${t}?child=${child.id}`)))
      .then(([g, m, v, d]) => {
        setGrowth(
          g.sort((a: Row, b: Row) =>
            b.fecha_medicion.localeCompare(a.fecha_medicion),
          ),
        );
        setMeds(m);
        setVisits(v);
        setDiary(d);
      })
      .catch((e) => setError(e.message));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [child.id]);
  const weight = growth.find((r) => r.peso_kg),
    height = growth.find((r) => r.talla_cm),
    next = meds
      .map((m): Row => ({ ...m, next: nextDose(m, now) }))
      .filter((m) => m.next)
      .sort((a, b) => a.next - b.next)[0],
    visit = visits
      .filter((v) => Date.parse(v.fecha) >= now)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0],
    mood = diary.find((d) => d.fecha === today()),
    remaining = next ? Math.max(0, Math.floor((next.next - now) / 1000)) : 0;
  return (
    <>
      <section className="intro">
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
            {child.apodo || child.primer_nombre}.
          </p>
        </div>
      </section>
      <ErrorNote error={error} />
      {child.alergias && (
        <div className="allergy">
          <strong>Alergias registradas</strong>
          <p>{child.alergias}</p>
        </div>
      )}
      <section className="stats">
        <article className="card stat">
          <p>EDAD ACTUAL</p>
          <strong className="age-value">{age(child.fecha_nacimiento)}</strong>
          <button className="link-button" onClick={() => go("perfil")}>
            Ver perfil
          </button>
        </article>
        <article className="card stat teal">
          <p>PESO RECIENTE</p>
          <strong>{weight ? weight.peso_kg + " kg" : "Sin registro"}</strong>
          <small>
            {weight
              ? dateLabel(weight.fecha_medicion)
              : "Agrega su primera medición"}
          </small>
        </article>
        <article className="card stat violet">
          <p>TALLA RECIENTE</p>
          <strong>{height ? height.talla_cm + " cm" : "Sin registro"}</strong>
          <small>
            {height
              ? dateLabel(height.fecha_medicion)
              : "Agrega su primera medición"}
          </small>
        </article>
      </section>
      <section className="grid">
        <Growth child={child} rows={growth} />
        <article className="card medicine">
          <div className="section-heading">
            <h2>Próxima dosis</h2>
            <HeartPulse size={21} />
          </div>
          {next ? (
            <>
              <h3>{next.nombre}</h3>
              <p>{next.dosis}</p>
              <strong className="countdown">
                {Math.floor(remaining / 3600)} h{" "}
                {Math.floor((remaining % 3600) / 60)} min {remaining % 60} s
              </strong>
              <p className="muted">
                {dateLabel(new Date(next.next!).toISOString())}
              </p>
              <p className="muted">
                Horario orientativo según la pauta registrada; no confirma
                administración.
              </p>
            </>
          ) : (
            <p className="empty-state">Sin tratamientos activos programados.</p>
          )}
          <button className="soft-action" onClick={() => go("salud")}>
            Ver tratamientos
          </button>
        </article>
        <article className="card school">
          <div className="section-heading">
            <h2>Hoy en el colegio</h2>
            <BookOpen size={21} />
          </div>
          <h3>{mood ? mood.estado_animo : "Bitácora pendiente"}</h3>
          <p className="muted">
            {mood
              ? mood.crisis_sobrecarga
                ? "Sobrecarga registrada. Revisa los apoyos utilizados."
                : "Sin sobrecarga registrada."
              : "Registra cómo estuvo su día y qué apoyos ayudaron."}
          </p>
          <button className="soft-action" onClick={() => go("escolar")}>
            Abrir módulo escolar
          </button>
        </article>
        <article className="card appointment">
          <div className="section-heading">
            <h2>Próximo control</h2>
            <CalendarDays size={21} />
          </div>
          {visit ? (
            <>
              <h3>{visit.especialidad || "Consulta médica"}</h3>
              <p>{visit.medico_nombre}</p>
              <p className="date">{dateLabel(visit.fecha)}</p>
            </>
          ) : (
            <p className="empty-state">No hay controles programados.</p>
          )}
          <button className="soft-action" onClick={() => go("salud")}>
            Gestionar consultas
          </button>
        </article>
      </section>
    </>
  );
}
