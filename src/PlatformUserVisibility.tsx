import { useState } from "react";
import { api, type Row } from "./lib";
import { Modal, ErrorNote } from "./components";
export default function PlatformUserVisibility({
  family,
  user,
  close,
  changed,
}: {
  family: string;
  user: Row;
  close: () => void;
  changed: () => void;
}) {
  const [audit, setAudit] = useState(!!user.audit_visible),
    [ai, setAi] = useState(!!user.ai_visible),
    [password, setPassword] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={"Visibilidad de funciones · " + user.nombre}
      close={() => {
        if (!busy) close();
      }}
    >
      <ErrorNote error={error} />
      <p className="muted">
        Ambas funciones están desactivadas por defecto. Solo el administrador de
        plataforma puede habilitarlas. No modifica los permisos clínicos. Al
        guardar, se cierra la sesión familiar de esta cuenta para aplicar el
        cambio.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              `platform/families/${family}/users/${user.id}/visibility`,
              "POST",
              {
                audit_visible: audit,
                ai_visible: ai,
                admin_password: password,
                reason,
              },
            );
            changed();
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={audit}
                disabled={user.rol !== "superadmin"}
                onChange={(e) => setAudit(e.target.checked)}
              />{" "}
              Mostrar Auditoría familiar
            </span>
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={ai}
                onChange={(e) => setAi(e.target.checked)}
              />{" "}
              Mostrar asistencia IA en Consultas médicas
            </span>
          </label>
          <label className="field">
            Motivo
            <input
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="field">
            Tu contraseña administrativa
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar visibilidad"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
