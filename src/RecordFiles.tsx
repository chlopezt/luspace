import { useEffect, useState } from "react";
import { Download, FileText, Paperclip, X } from "lucide-react";
import { api, type Row } from "./lib";
import { fetchAttachment, downloadAttachment } from "./fileAccess";
import { compressUploadImage } from "./imageCompression";
export function fileIds(value: unknown): string[] {
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value || "[]") : value;
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
function FileItem({ file, remove }: { file: Row; remove?: () => void }) {
  const [open, setOpen] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [mime, setMime] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let object = "";
    setError("");
    fetchAttachment(file.id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        object = URL.createObjectURL(blob);
        setUrl(object);
        setMime(blob.type);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (object) URL.revokeObjectURL(object);
      setUrl("");
    };
  }, [open, file.id]);
  return (
    <article className="record-file-item">
      <div className="record-file-heading">
        <FileText size={18} />
        <strong title={file.nombre}>{file.nombre || "Archivo adjunto"}</strong>
        <button
          type="button"
          className="secondary"
          aria-label={"Descargar " + (file.nombre || "archivo")}
          onClick={() =>
            void downloadAttachment(file.id, file.nombre || "Documento").catch(
              (e) => setError(e.message),
            )
          }
        >
          <Download size={16} />
        </button>
        {remove && (
          <button
            type="button"
            className="link-button"
            aria-label={
              "Retirar " + (file.nombre || "archivo") + " del registro"
            }
            onClick={remove}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>Vista previa</summary>
        {open &&
          (error ? (
            <p className="error">{error}</p>
          ) : !url ? (
            <p role="status">Abriendo archivo…</p>
          ) : mime.startsWith("image/") ? (
            <img src={url} alt={file.nombre || "Imagen adjunta"} />
          ) : (
            <div className="pdf-preview-card">
              <FileText />
              <div>
                <p>Documento PDF</p>
                <a
                  className="secondary"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver PDF
                </a>
              </div>
            </div>
          ))}
      </details>
      {error && !open && <p className="error">{error}</p>}
    </article>
  );
}
export function FileGallery({
  ids,
  child,
  module,
  remove,
}: {
  ids: string[];
  child: string;
  module: string;
  remove?: (id: string) => void;
}) {
  const [files, setFiles] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (!ids.length) {
      setFiles([]);
      return;
    }
    api(`files?child=${child}&module=${module}`)
      .then((rows) => {
        if (live) {
          setFiles(rows.filter((row: Row) => ids.includes(row.id)));
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [child, module, ids.join(",")]);
  if (!ids.length) return null;
  return (
    <div className="record-file-gallery">
      {error && <p className="error">{error}</p>}
      {ids.map((id) => (
        <FileItem
          key={id}
          file={
            files.find((file) => file.id === id) || {
              id,
              nombre: "Archivo adjunto",
            }
          }
          remove={remove ? () => remove(id) : undefined}
        />
      ))}
    </div>
  );
}
export default function MultiFiles({
  value,
  onChange,
  child,
  module,
  label = "Archivos de este registro",
  disabled = false,
  onBusy,
}: {
  value: unknown;
  onChange: (ids: string[]) => void;
  child?: string;
  module: string;
  label?: string;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const ids = fileIds(value),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [existing, setExisting] = useState<Row[]>([]);
  useEffect(() => {
    if (!child || disabled) return;
    let live = true;
    api(`files?child=${child}&module=${module}`)
      .then((rows) => {
        if (live) setExisting(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [child, module, disabled, ids.join(",")]);
  async function upload(selected: File[]) {
    if (!child) return;
    setBusy(true);
    onBusy?.(true);
    setError("");
    let next = [...ids];
    try {
      if (next.length + selected.length > 20)
        throw new Error("Máximo 20 archivos por registro.");
      for (const original of selected) {
        const file = await compressUploadImage(original),
          data = new FormData();
        data.append("file", file);
        const result = await api(
          `files?child=${child}&module=${module}`,
          "POST",
          data,
        );
        next.push(result.id);
        onChange([...next]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <section className="multi-files">
      <h4>
        <Paperclip size={17} /> {label}
      </h4>
      {!child && (
        <p className="muted">
          Guarda primero el perfil para adjuntar sus documentos.
        </p>
      )}
      {!disabled && child && (
        <>
          <label className="field">
            <span>Seleccionar varios archivos</span>
            <input
              aria-label={"Subir varios archivos: " + label}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                e.target.value = "";
                void upload(selected);
              }}
            />
          </label>
          <label className="field">
            <span>Asociar un archivo ya subido</span>
            <select
              value=""
              disabled={busy || ids.length >= 20}
              onChange={(e) => {
                if (e.target.value) onChange([...ids, e.target.value]);
              }}
            >
              <option value="">Seleccionar documento…</option>
              {existing
                .filter((file) => !ids.includes(file.id))
                .map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.nombre}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted">
            Retirar un archivo de este registro no elimina su original.
          </p>
        </>
      )}
      {busy && <p role="status">Subiendo archivos…</p>}
      {error && <p className="error">{error}</p>}
      {child && (
        <FileGallery
          ids={ids}
          child={child}
          module={module}
          remove={
            !disabled && !busy
              ? (id) => onChange(ids.filter((current) => current !== id))
              : undefined
          }
        />
      )}
    </section>
  );
}
