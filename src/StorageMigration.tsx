import { useEffect, useState } from "react";
import { ShieldCheck, CloudUpload, RefreshCw } from "lucide-react";
import { api, type Row } from "./lib";
import { ErrorNote } from "./components";
export default function StorageMigration() {
  const [status, setStatus] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setStatus(await api("platform/storage-migration"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function copy() {
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < 10; i++) {
        const next = await api("platform/storage-migration", "POST", {});
        setStatus(next);
        if (next.pending === 0 || next.complete) break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card">
      <h2>
        <ShieldCheck size={20} /> Copia segura de adjuntos a R2
      </h2>
      <p className="muted">
        Bucket privado. El servidor conserva la familia propietaria y verifica
        tamaño y SHA-256 antes de cambiar la ubicación. No se borran originales
        de D1 durante la copia ni se muestran documentos en este panel.
      </p>
      <ErrorNote error={error} />
      {status && (
        <>
          <p>
            {status.r2_enabled
              ? "R2 vinculado y habilitado"
              : "R2 pendiente de vincular"}{" "}
            · {status.verified} archivos verificados · {status.pending}{" "}
            pendientes · {status.total} total
          </p>
          <progress
            max={status.total || 1}
            value={status.verified}
            aria-label="Progreso de copia verificada a R2"
          />
          {status.pending === 0 && (
            <p role="status">
              No quedan archivos pendientes. Los originales migrados se
              conservan en D1.
            </p>
          )}
          <div className="actions">
            <button disabled={busy} onClick={() => void refresh()}>
              <RefreshCw size={16} /> Actualizar copia
            </button>
            <button
              className="primary"
              disabled={busy || !status.r2_enabled || status.pending === 0}
              onClick={() => void copy()}
            >
              <CloudUpload size={17} />
              {busy
                ? "Copiando y verificando…"
                : "Copiar archivos pendientes a R2"}
            </button>
          </div>
          <p className="muted">
            Hasta diez archivos por lote. La cuota de la app no es un límite de
            facturación de Cloudflare; otras cargas y operaciones también
            cuentan.
          </p>
        </>
      )}
    </article>
  );
}
