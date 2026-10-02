import { useEffect, useRef, useState } from "react";
import { api, type Row } from "./lib";
import { anamnesisSections } from "../shared/models.js";
import { Attachments, ErrorNote } from "./components";
export default function Anamnesis({
  child,
  readonly,
  onDirty,
}: {
  child: Row;
  readonly: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [doc, setDoc] = useState<Row>({}),
    [step, setStep] = useState(0),
    [ready, setReady] = useState(false),
    [state, setState] = useState("Cargando…"),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const current = useRef<Row>({}),
    version = useRef(0),
    revision = useRef(0),
    saved = useRef(0),
    inflight = useRef(false);
  useEffect(() => {
    let live = true;
    api("anamnesis?child=" + child.id)
      .then((r) => {
        if (live) {
          current.current = r.documento;
          version.current = r.version;
          setDoc(r.documento);
          setReady(true);
          setState("Guardado");
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
      onDirty(false);
    };
  }, [child.id]);
  useEffect(() => {
    onDirty(dirty);
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  async function save() {
    if (
      inflight.current ||
      !ready ||
      readonly ||
      saved.current === revision.current
    )
      return;
    inflight.current = true;
    const rev = revision.current;
    setState("Guardando…");
    try {
      const r = await api("anamnesis?child=" + child.id, "PUT", {
        documento: current.current,
        version: version.current,
      });
      version.current = r.version;
      saved.current = rev;
      setDirty(rev !== revision.current);
      setError("");
      setState(rev === revision.current ? "Guardado" : "Cambios pendientes");
    } catch (e) {
      setError((e as Error).message);
      setState("No guardado");
    } finally {
      inflight.current = false;
    }
  }
  useEffect(() => {
    if (!dirty || error) return;
    const t = setTimeout(() => void save(), 900);
    return () => clearTimeout(t);
  }, [doc, dirty, error]);
  useEffect(() => {
    if (!dirty || error) return;
    const timer = setInterval(() => void save(), 2500);
    return () => clearInterval(timer);
  }, [dirty, error, ready]);
  const [key, title, fields] = anamnesisSections[step] as [
    string,
    string,
    string[],
  ];
  const completed = anamnesisSections.filter(([k, , fs]) =>
    (fs as string[]).some((_, i) => doc[k as string]?.[i]?.trim()),
  ).length;
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Anamnesis pediátrica</h2>
          <p className="muted">
            {completed} de 7 secciones con información ·{" "}
            <span role="status">{readonly ? "Solo lectura" : state}</span>
          </p>
        </div>
        {!readonly && (
          <button className="secondary" onClick={() => void save()}>
            Guardar ahora
          </button>
        )}
      </div>
      <progress value={completed} max={7} aria-label="Secciones completadas" />
      <div className="wizard">
        <nav aria-label="Secciones de anamnesis">
          {anamnesisSections.map(([, label], i) => (
            <button
              key={i}
              className={i === step ? "selected" : ""}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {label as string}
            </button>
          ))}
        </nav>
        <section className="card">
          <h3>{title}</h3>
          <ErrorNote error={error} />
          {error && dirty && (
            <p className="muted">
              El texto sigue aquí. Puedes copiarlo antes de recargar o
              reintentar el guardado.
            </p>
          )}
          {ready &&
            fields.map((label, i) => (
              <label className="field" key={key + i}>
                <span>{label}</span>
                <textarea
                  disabled={readonly}
                  rows={4}
                  maxLength={8000}
                  value={doc[key]?.[i] || ""}
                  onChange={(e) => {
                    const next = {
                      ...current.current,
                      [key]: { ...current.current[key], [i]: e.target.value },
                    };
                    current.current = next;
                    revision.current++;
                    setDoc(next);
                    setDirty(true);
                    setState("Cambios pendientes");
                  }}
                />
              </label>
            ))}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary"
              disabled={step === 6}
              onClick={() => setStep(step + 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>
      <Attachments child={child} module="anamnesis" readonly={readonly} />
    </>
  );
}
