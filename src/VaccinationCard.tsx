import { useEffect, useState } from "react";
import { Syringe, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { api, dateLabel, type Row } from "./lib";
import { Modal, RecordForm, ErrorNote } from "./components";
import {
  vaccinationCatalog,
  vaccinationDue,
  vaccinationState,
  vaccinationSource,
  vaccinationVersion,
} from "../shared/vaccinations.js";
import "./vaccinations.css";
import { FileGallery, fileIds } from "./RecordFiles";

export default function VaccinationCard({
  child,
  readonly,
  user,
}: {
  child: Row;
  readonly: boolean;
  user: Row;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [edit, setEdit] = useState<Row | null>(null),
    [remove, setRemove] = useState<Row | null>(null),
    [busy, setBusy] = useState(false);
  const actions = JSON.parse(user.permisos_json || "{}").acciones || [];
  const can = (action: string) =>
    !readonly && (user.rol === "superadmin" || actions.includes(action));
  const endpoint = `records/vacunas?child=${encodeURIComponent(child.id)}`;
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
  }, [child.id]);
  const applied = rows.filter((r) => r.estado === "Administrada").length;
  const percent = rows.length ? Math.round((applied / rows.length) * 100) : 0;
  const cards: Row[] = [
    ...vaccinationCatalog.map((c) => ({
      ...c,
      catalogo_id: c.id,
      id: undefined,
      ...rows.find((r) => r.catalogo_id === c.id),
    })),
    ...rows.filter((r) => !r.catalogo_id),
  ];
  async function save(values: Row) {
    await api(
      `records/vacunas${edit?.id ? "/" + encodeURIComponent(edit.id) : ""}?child=${encodeURIComponent(child.id)}`,
      edit?.id ? "PUT" : "POST",
      values,
    );
    setEdit(null);
    await reload();
  }
  return (
    <section className="vaccination-carnet">
      <div className="section-heading">
        <h2>
          <Syringe size={23} /> Carnet de vacunas
        </h2>
        {can("crear") && (
          <button
            className="secondary"
            onClick={() => setEdit({ etapa: "Particulares" })}
          >
            <Plus size={17} /> Agregar vacuna particular
          </button>
        )}
      </div>
      <div className="card vaccine-summary">
        <ShieldCheck size={26} />
        <div>
          <strong>
            {rows.length
              ? `${percent}% de las dosis con seguimiento administradas`
              : "Comienza a completar tu carnet"}
          </strong>
          <p>
            {applied} aplicadas · {rows.length - applied} pendientes o atrasadas
            registradas
          </p>
          <progress
            aria-label="Progreso de dosis registradas"
            max={100}
            value={percent}
          />
        </div>
      </div>
      <p className="vaccine-reference">
        <a href={vaccinationSource} target="_blank" rel="noreferrer">
          {vaccinationVersion}
        </a>{" "}
        · Referencia, no certificado MINSAL. Las pautas anteriores pueden variar
        por año de nacimiento. Sin registro no significa sin vacuna: confirma
        con tu carnet o vacunatorio. Las dosis condicionales solo se registran
        si corresponden. El porcentaje considera las dosis que tu familia ha
        incorporado al seguimiento, no certifica que el esquema completo esté al
        día.
      </p>
      <ErrorNote error={error} />
      {loading ? (
        <p role="status">Cargando carnet…</p>
      ) : (
        !error &&
        ["0–6 meses", "12–36 meses", "Escolar", "Particulares"].map((group) => (
          <section key={group} className="vaccine-group">
            <h3>{group}</h3>
            <div className="vaccine-grid">
              {cards
                .filter((r) => r.etapa === group)
                .map((row, i) => {
                  const state = vaccinationState(row, child.fecha_nacimiento),
                    due =
                      row.fecha_prevista ||
                      vaccinationDue(child.fecha_nacimiento, row.meses);
                  return (
                    <details
                      className="card vaccine-dose"
                      key={row.id || row.catalogo_id || i}
                    >
                      <summary>
                        <div className="vaccine-dose-top">
                          <Syringe size={19} />
                          <div>
                            <h4>{row.nombre}</h4>
                            <small>{row.dosis}</small>
                          </div>
                          <span
                            className={
                              "vaccine-badge " +
                              (state === "Administrada"
                                ? "applied"
                                : state === "Atrasada"
                                  ? "overdue"
                                  : state === "Por verificar"
                                    ? "unverified"
                                    : "pending")
                            }
                          >
                            {state}
                          </span>
                        </div>
                      </summary>
                      <p>
                        {state === "Administrada"
                          ? `Aplicada: ${dateLabel(row.fecha_aplicacion)}`
                          : due
                            ? `Fecha de referencia: ${dateLabel(due)}`
                            : row.meses != null
                              ? `${row.meses === 0 ? "Nacimiento" : row.meses + " meses"}`
                              : "Fecha por confirmar con el establecimiento"}
                      </p>
                      {row.condicion && (
                        <small className="vaccine-condition">
                          {row.condicion}
                        </small>
                      )}
                      {row.nota && <small>{row.nota}</small>}
                      {row.centro && (
                        <p>
                          <strong>Lugar:</strong> {row.centro}
                        </p>
                      )}
                      {row.lote_marca && (
                        <p>
                          <strong>Lote / marca:</strong> {row.lote_marca}
                        </p>
                      )}
                      {row.notas && (
                        <p className="vaccine-notes">{row.notas}</p>
                      )}
                      {row.id && (
                        <FileGallery
                          ids={fileIds(row.adjuntos_json)}
                          child={child.id}
                          module="salud"
                        />
                      )}
                      <div className="actions">
                        {(row.id ? can("editar") : can("crear")) && (
                          <button
                            className="secondary"
                            onClick={() =>
                              setEdit(
                                row.id
                                  ? row
                                  : {
                                      nombre: row.nombre,
                                      dosis: row.dosis,
                                      etapa: row.etapa,
                                      catalogo_id: row.catalogo_id,
                                      referencia: vaccinationVersion,
                                      fecha_prevista: due,
                                      estado: "Pendiente/Próxima",
                                    },
                              )
                            }
                          >
                            <Pencil size={15} />
                            {row.id ? "Editar dosis" : "Registrar dosis"}
                          </button>
                        )}
                        {row.id && can("eliminar") && (
                          <button
                            className="secondary"
                            aria-label={"Eliminar dosis de " + row.nombre}
                            onClick={() => setRemove(row)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
            {group === "Particulares" &&
              !cards.some((r) => r.etapa === group) && (
                <p>
                  Agrega vacunas particulares o de campaña, como influenza anual
                  o rotavirus, según indicación profesional.
                </p>
              )}
          </section>
        ))
      )}
      {edit && (
        <Modal
          title={edit.id ? "Editar dosis" : "Registrar vacuna"}
          close={() => setEdit(null)}
        >
          <RecordForm
            table="vacunas"
            initial={edit}
            child={child.id}
            onSave={save}
            onCancel={() => setEdit(null)}
          />
        </Modal>
      )}
      {remove && (
        <Modal
          title="Eliminar registro de vacuna"
          close={() => !busy && setRemove(null)}
        >
          <p>
            ¿Eliminar el registro de {remove.nombre}? Esta acción no modifica
            otras dosis.
          </p>
          <ErrorNote error={error} />
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(
                  `records/vacunas/${remove.id}?child=${child.id}`,
                  "DELETE",
                );
                setRemove(null);
                await reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar registro"}
          </button>
        </Modal>
      )}
    </section>
  );
}
