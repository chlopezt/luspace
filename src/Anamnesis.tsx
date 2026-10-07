import { useEffect, useRef, useState, useContext } from "react";
import { api, type Row } from "./lib";
import { anamnesisSections } from "../shared/models.js";
import { ErrorNote, FileUploadEnabled } from "./components";
import MultiFiles from "./RecordFiles";
export default function Anamnesis({
  child,
  readonly,
  onDirty,
}: {
  child: Row;
  readonly: boolean;
  onDirty: (v: boolean) => void;
}) {
  const uploadEnabled = useContext(FileUploadEnabled);
  const [doc, setDoc] = useState<Row>({}),
    [uploads, setUploads] = useState<Record<string, boolean>>({}),
    [ready, setReady] = useState(false),
    [state, setState] = useState("Cargando…"),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const uploadBusy = Object.values(uploads).some(Boolean);
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
      uploadBusy ||
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
  }, [doc, dirty, error, uploadBusy]);
  useEffect(() => {
    if (!dirty || error) return;
    const timer = setInterval(() => void save(), 2500);
    return () => clearInterval(timer);
  }, [dirty, error, ready, uploadBusy]);
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
          <button
            className="secondary"
            disabled={uploadBusy}
            onClick={() => void save()}
          >
            Guardar ahora
          </button>
        )}
      </div>
      <progress value={completed} max={7} aria-label="Secciones completadas" />
      <ErrorNote error={error} />
      <div className="anamnesis-sections">
        {anamnesisSections.map(([sectionKey, title, sectionFields]) => {
          const key = String(sectionKey),
            fields = sectionFields as string[];
          return (
            <details className="card anamnesis-accordion" key={key}>
              <summary>{String(title)}</summary>
              <section className="anamnesis-body">
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
                            [key]: {
                              ...current.current[key],
                              [i]: e.target.value,
                            },
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
                {ready && (
                  <MultiFiles
                    child={child.id}
                    module="anamnesis"
                    label={"Archivos de " + String(title)}
                    disabled={readonly || !uploadEnabled}
                    value={doc[key]?.archivos || []}
                    onBusy={(busy) =>
                      setUploads((previous) => ({ ...previous, [key]: busy }))
                    }
                    onChange={(ids) => {
                      const next = {
                        ...current.current,
                        [key]: { ...current.current[key], archivos: ids },
                      };
                      current.current = next;
                      revision.current++;
                      setDoc(next);
                      setDirty(true);
                      setState("Cambios pendientes");
                    }}
                  />
                )}
              </section>
            </details>
          );
        })}
      </div>
    </>
  );
}
