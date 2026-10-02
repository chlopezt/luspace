import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Pencil, Trash2, Download, FileText } from "lucide-react";
import { api, dateLabel, today, type Row } from "./lib";
import { models as definitions } from "../shared/models.js";
export const models: Record<string, any> = definitions;
export function Brand() {
  const [bad, setBad] = useState(false);
  return (
    <div className="brand">
      {bad ? (
        <span className="brand-fallback">L</span>
      ) : (
        <img
          src="/brand/luspace-logo.png"
          alt=""
          onError={() => setBad(true)}
        />
      )}
      <span>
        Lu<span>Space</span>
      </span>
    </div>
  );
}
export function Modal({
  title,
  description = "Completa la información y guarda los cambios.",
  close,
  children,
  fullScreen = false,
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={"dialog-content" + (fullScreen ? " full-screen" : "")}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="muted">
            {description}
          </Dialog.Description>
          <Dialog.Close className="close" aria-label="Cerrar">
            <X size={19} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ErrorNote({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <FileText size={24} />
      <p>{children}</p>
    </div>
  );
}
export function Field({
  field: f,
  value,
  onChange,
  child,
  module,
  disabled = false,
  onBusy,
}: {
  field: any;
  value: any;
  onChange: (v: any) => void;
  child?: string;
  module?: string;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api(`files?child=${child}&module=${module}`, "POST", fd);
      onChange(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  const common = {
    disabled: disabled || busy,
    required: f.required,
    "aria-label": f.label,
  };
  return (
    <label
      className={
        "field " +
        (["textarea", "lines", "file"].includes(f.type) ? "wide" : "")
      }
    >
      {f.type !== "checkbox" && (
        <span>
          {f.label}
          {f.required ? " *" : ""}
        </span>
      )}
      {f.type === "checkbox" ? (
        <span className="check">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
            disabled={disabled}
          />
          {f.label}
        </span>
      ) : f.type === "select" ? (
        <select
          {...common}
          value={value || f.options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {f.options.map((v: string) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : f.type === "file" ? (
        <div>
          {!disabled && (
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => void upload(e.target.files?.[0])}
              disabled={busy}
            />
          )}
          <small>{busy ? "Subiendo…" : "PDF, JPG o PNG · hasta 10 MB"}</small>
          {value && (
            <div className="actions">
              <a target="_blank" rel="noreferrer" href={"/api/files/" + value}>
                Ver adjunto
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => onChange("")}
                >
                  Quitar del registro
                </button>
              )}
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      ) : ["textarea", "lines"].includes(f.type) ? (
        <textarea
          {...common}
          rows={4}
          value={value ?? ""}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...common}
          type={f.type}
          value={value ?? ""}
          min={f.min}
          max={f.max}
          step={f.type === "number" ? "any" : undefined}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function RecordForm({
  table,
  initial = {},
  child,
  onSave,
  onCancel,
}: {
  table: string;
  initial?: Row;
  child?: string;
  onSave: (v: Row) => Promise<void>;
  onCancel?: () => void;
}) {
  const config = models[table];
  const [values, setValues] = useState<Row>(() =>
    Object.fromEntries(
      config.fields.map((f: any) => {
        let v = initial[f.key];
        if (v && f.type === "datetime-local" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v)) {
          const d = new Date(v);
          v = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        if (f.type === "lines")
          v = Array.isArray(v)
            ? v.join("\n")
            : v
              ? JSON.parse(v).join("\n")
              : "";
        if (v === undefined)
          v =
            f.type === "checkbox"
              ? 0
              : f.type === "select"
                ? f.options[0]
                : f.type === "date" &&
                    ["fecha", "fecha_medicion", "fecha_inicio"].includes(f.key)
                  ? today()
                  : "";
        return [f.key, v];
      }),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [uploads, setUploads] = useState<Record<string, boolean>>({});
  const uploading = Object.values(uploads).some(Boolean);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (uploading) return;
    setBusy(true);
    setError("");
    try {
      const payload = { ...values };
      for (const f of config.fields) {
        if (f.type === "datetime-local" && payload[f.key]) payload[f.key] = new Date(payload[f.key]).toISOString();
      }
      await onSave(payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-grid">
        {config.fields.map((f: any) => (
          <Field
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => setValues(previous => ({ ...previous, [f.key]: v }))}
            onBusy={(value) => setUploads(previous => ({ ...previous, [f.key]: value }))}
            child={child}
            module={config.module}
          />
        ))}
      </fieldset>
      <ErrorNote error={error} />
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary" disabled={busy || uploading}>
          {uploading ? "Esperando archivo…" : busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
export function RecordDetails({ table, row }: { table: string; row: Row }) {
  return (
    <dl className="details">
      {models[table].fields.map((f: any) => {
        let v = row[f.key];
        if (v === null || v === undefined || v === "") return null;
        if (f.type === "checkbox") v = v ? "Sí" : "No";
        if (f.type === "lines") v = JSON.parse(v).join("\n");
        if (f.type === "date" || f.type === "datetime-local") v = dateLabel(v);
        return (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>
              {f.type === "file" ? (
                <a href={"/api/files/" + v} target="_blank" rel="noreferrer">
                  Abrir archivo
                </a>
              ) : (
                String(v)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
export function Records({
  table,
  child,
  readonly = false,
  onChange,
  onlyFields,
}: {
  table: string;
  child: Row;
  readonly?: boolean;
  onChange?: () => void;
  onlyFields?: string[];
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [edit, setEdit] = useState<Row | null>(null),
    [remove, setRemove] = useState<Row | null>(null),
    [busy, setBusy] = useState(false);
  const endpoint = `records/${table}?child=${child.id}`;
  async function reload() {
    setError("");
    try {
      setRows(await api(endpoint));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, [table, child.id]);
  async function save(v: Row) {
    await api(
      `records/${table}${edit?.id ? "/" + edit.id : ""}?child=${child.id}`,
      edit?.id ? "PUT" : "POST",
      v,
    );
    setEdit(null);
    await reload();
    onChange?.();
  }
  const config = models[table];
  return (
    <section className="record-section">
      <div className="section-heading">
        <h2>{onlyFields ? "Adecuaciones PIE / PACI" : config.title}</h2>
        {!readonly && (
          <button
            className="secondary"
            onClick={() => setEdit(config.single ? rows[0] || {} : {})}
          >
            <Plus size={16} />
            {config.single && rows.length ? "Editar" : "Agregar"}
          </button>
        )}
      </div>
      <ErrorNote error={error} />
      {loading ? (
        <p role="status">Cargando registros…</p>
      ) : !rows.length ? (
        <Empty>Aún no hay información registrada.</Empty>
      ) : (
        <div
          className={
            table === "historial_colegios" ? "timeline" : "record-list"
          }
        >
          {rows.map((row) => (
            <article className="card record-card" key={row.id}>
              {onlyFields ? (
                <div>
                  <h3>
                    {row.pie_paci_activo
                      ? "Programa activo"
                      : "Sin programa activo"}
                  </h3>
                  <ul>
                    {JSON.parse(row.adecuaciones_json || "[]").map(
                      (s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ),
                    )}
                  </ul>
                </div>
              ) : (
                <RecordDetails table={table} row={row} />
              )}
              <div className="actions">
                {!readonly && (
                  <>
                    <button
                      className="link-button"
                      onClick={() => setEdit(row)}
                    >
                      <Pencil size={15} />
                      Editar
                    </button>
                    <button
                      className="link-button danger"
                      onClick={() => setRemove(row)}
                    >
                      <Trash2 size={15} />
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={config.title} close={() => setEdit(null)}>
          <RecordForm
            table={table}
            initial={edit}
            child={child.id}
            onSave={save}
            onCancel={() => setEdit(null)}
          />
        </Modal>
      )}
      {remove && (
        <Modal
          title="Eliminar registro"
          description="Esta acción elimina el registro. Quedará constancia en la auditoría."
          close={() => setRemove(null)}
        >
          <ErrorNote error={error} />
          <div className="form-actions">
            <button className="secondary" onClick={() => setRemove(null)}>
              Cancelar
            </button>
            <button
              className="primary danger-bg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(
                    `records/${table}/${remove.id}?child=${child.id}`,
                    "DELETE",
                  );
                  setRemove(null);
                  await reload();
                  onChange?.();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export function Attachments({
  child,
  module,
  readonly = false,
}: {
  child: Row;
  module: string;
  readonly?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      setRows(await api(`files?child=${child.id}&module=${module}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [child.id, module]);
  return (
    <section className="card attachments">
      <h2>Documentos adjuntos</h2>
      <ErrorNote error={error} />
      {!readonly && (
        <Field
          field={{ label: "Adjuntar documento", type: "file" }}
          value=""
          onChange={() => void load()}
          child={child.id}
          module={module}
        />
      )}
      <ul>
        {rows.map((f) => (
          <li key={f.id}>
            <FileText size={16} />
            <span>
              {f.nombre} <small>({Math.ceil(f.bytes / 1024)} KB)</small>
            </span>
            <a
              href={"/api/files/" + f.id + "?download=1"}
              aria-label={"Descargar " + f.nombre}
            >
              <Download size={17} />
            </a>
            <details className="file-preview">
              <summary>Vista previa</summary>
              {String(f.mime).startsWith("image/") ? (
                <img src={"/api/files/" + f.id} alt={f.nombre} />
              ) : (
                <iframe title={"Vista previa de " + f.nombre} src={"/api/files/" + f.id} />
              )}
            </details>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Sin documentos adjuntos.</p>}
    </section>
  );
}

