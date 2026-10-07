import {
  useEffect,
  useState,
  useRef,
  useId,
  createContext,
  useContext,
  type ReactNode,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Download,
  FileText,
  UserRound,
  HeartPulse,
  School,
  Phone,
  ShieldCheck,
  ImagePlus,
} from "lucide-react";
import "./profile-editor.css";
import "./care-lists.css";
import "./contextual-records.css";
import MultiFiles, { FileGallery, fileIds } from "./RecordFiles";
import { api, dateLabel, today, type Row } from "./lib";
import { models as definitions, fieldVisible } from "../shared/models.js";
import { compressUploadImage } from "./imageCompression";
import { fetchAttachment, downloadAttachment } from "./fileAccess";
export const models: Record<string, any> = definitions;
export const FileUploadEnabled = createContext(true);
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
  className = "",
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={
            "dialog-content" +
            (fullScreen ? " full-screen" : "") +
            " " +
            className
          }
        >
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
function SelectWithOther({
  field,
  value,
  disabled,
  onChange,
}: {
  field: any;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [other, setOther] = useState(!!value && !field.options.includes(value));
  const custom = other || (!!value && !field.options.includes(value));
  return (
    <>
      <select
        aria-label={field.label}
        required={field.required}
        disabled={disabled}
        value={custom ? "__other" : value || ""}
        onChange={(e) => {
          const isOther = e.target.value === "__other";
          setOther(isOther);
          onChange(isOther ? "" : e.target.value);
        }}
      >
        <option value="">Sin registrar</option>
        {field.options.map((option: string) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="__other">{field.otherLabel || "Otro"}</option>
      </select>
      {custom && (
        <label className="field">
          <span>{field.customLabel}</span>
          <input
            type="text"
            aria-label={field.customLabel}
            value={value || ""}
            required
            disabled={disabled}
            maxLength={field.maxLength || 180}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </>
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
  compact = false,
}: {
  field: any;
  value: any;
  onChange: (v: any) => void;
  child?: string;
  module?: string;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  compact?: boolean;
}) {
  const uploadEnabled = useContext(FileUploadEnabled);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    image: boolean;
  } | null>(null);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    if (!compact || f.type !== "file" || !value) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    const controller = new AbortController();
    let objectUrl = "";
    setPreview(null);
    setPreviewError("");
    fetchAttachment(String(value), controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ url: objectUrl, image: blob.type.startsWith("image/") });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setPreviewError((e as Error).message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value, compact, f.type]);
  if (f.type === "files")
    return (
      <MultiFiles
        value={value}
        onChange={onChange}
        child={child}
        module={module || "perfil"}
        label={f.label}
        disabled={disabled || !uploadEnabled}
        onBusy={onBusy}
      />
    );
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      compact &&
      f.key === "foto_perfil_id" &&
      !["image/png", "image/jpeg"].includes(file.type)
    ) {
      setError("Selecciona una foto JPG o PNG.");
      return;
    }
    if (!child) {
      setError(
        "Guarda primero el perfil para poder adjuntar una imagen o documento.",
      );
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", await compressUploadImage(file));
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
  const formatRut = (value: string) => {
    const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 2) return clean;
    const body = clean.slice(0, -1).replace(/^0+/, "") || "0";
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + clean.slice(-1);
  };
  const Container =
    f.type === "select-other" || (f.type === "file" && compact)
      ? "div"
      : "label";
  return (
    <Container
      className={
        "field " +
        (f.fullWidth ||
        (["textarea", "lines", "file"].includes(f.type) &&
          !(compact && f.type === "file"))
          ? "wide"
          : "") +
        (compact && f.type === "file" ? " compact-upload" : "")
      }
    >
      {f.type !== "checkbox" && (
        <span>
          {f.displayLabel || f.label}
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
      ) : f.type === "select-other" ? (
        <SelectWithOther
          field={f}
          value={value || ""}
          disabled={disabled || busy}
          onChange={onChange}
        />
      ) : f.type === "select" ? (
        <select
          {...common}
          value={value ?? f.options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {f.options.map((v: string) => (
            <option key={v} value={v}>
              {v ? v.replaceAll("_", " ") : "Sin registrar"}
            </option>
          ))}
        </select>
      ) : f.type === "file" ? (
        <div className={compact ? "compact-upload-body" : ""}>
          {compact && (
            <div className="compact-upload-preview">
              {preview?.image ? (
                <img
                  src={preview.url}
                  alt={
                    f.key === "foto_perfil_id"
                      ? "Vista previa de la foto"
                      : "Vista previa de la cédula"
                  }
                />
              ) : f.key === "foto_perfil_id" ? (
                <ImagePlus size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>
          )}
          <div>
            {!disabled && uploadEnabled && (
              <input
                type="file"
                aria-label={`Subir ${f.label.toLowerCase()}`}
                accept={
                  compact && f.key === "foto_perfil_id"
                    ? "image/png,image/jpeg"
                    : "application/pdf,image/png,image/jpeg"
                }
                onChange={(e) => void upload(e.target.files?.[0])}
                disabled={busy || !child}
              />
            )}
            <small>
              {!uploadEnabled
                ? "La carga de archivos está desactivada por la plataforma."
                : busy
                  ? "Subiendo…"
                  : compact && f.key === "foto_perfil_id"
                    ? "JPG o PNG · vista previa"
                    : "PDF, JPG o PNG · hasta 10 MB"}
            </small>
            {compact && !child && (
              <small>Guarda el perfil primero para adjuntar archivos.</small>
            )}
            {value && (
              <div className="actions">
                {(!compact || preview) && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={
                      preview?.url || "/api/files/" + encodeURIComponent(value)
                    }
                  >
                    {f.viewLabel || "Ver adjunto"}
                  </a>
                )}
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
            {compact && <ErrorNote error={previewError} />}
          </div>
        </div>
      ) : ["textarea", "lines"].includes(f.type) ? (
        <textarea
          {...common}
          rows={4}
          value={value ?? ""}
          maxLength={f.maxLength || 12000}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...common}
          type={f.type === "rut" ? "text" : f.type}
          value={value ?? ""}
          inputMode={f.type === "rut" ? "text" : undefined}
          min={f.min}
          max={f.max}
          step={f.type === "number" ? "any" : undefined}
          maxLength={f.maxLength || 12000}
          onChange={(e) =>
            onChange(
              f.type === "rut" ? formatRut(e.target.value) : e.target.value,
            )
          }
          placeholder={f.placeholder}
        />
      )}
    </Container>
  );
}
export function RecordForm({
  table,
  initial = {},
  child,
  onSave,
  onCancel,
  onManagePrivacy,
  onlyFields,
}: {
  table: string;
  initial?: Row;
  child?: string;
  onSave: (v: Row) => Promise<void>;
  onCancel?: () => void;
  onManagePrivacy?: () => void;
  onlyFields?: string[];
}) {
  const config = models[table];
  const isProfile = table === "ninos";
  const formRef = useRef<HTMLFormElement>(null),
    tabPrefix = useId();
  const [activeTab, setActiveTab] = useState(0);
  const profileGroups = [
    {
      title: "Identificación",
      icon: UserRound,
      heading: "Identificación y datos básicos",
      fields: [
        "primer_nombre",
        "apellidos",
        "rut",
        "fecha_nacimiento",
        "sexo_referencia",
        "convivientes",
        "foto_perfil_id",
        "carnet_identidad_id",
      ],
    },
    {
      title: "Salud",
      icon: HeartPulse,
      heading: "Información médica y de salud",
      fields: [
        "grupo_sanguineo",
        "prevision_salud",
        "alergias",
        "diagnostico",
        "hospitalizado",
        "hospitalizacion_motivo",
        "hospitalizacion_estadia",
        "especialistas_json",
      ],
    },
    {
      title: "Cuidado",
      icon: School,
      heading: "Cuidado y entorno educativo",
      fields: ["colegio_actual", "curso_actual"],
    },
    {
      title: "Contactos",
      icon: Phone,
      heading: "Contactos de emergencia",
      fields: [
        "contacto_emergencia_principal_nombre",
        "contacto_emergencia_principal_parentesco",
        "contacto_emergencia_principal_telefono",
        "contacto_emergencia_secundario_nombre",
        "contacto_emergencia_secundario_parentesco",
        "contacto_emergencia_secundario_telefono",
      ],
    },
    {
      title: "Privacidad",
      icon: ShieldCheck,
      heading: "Credenciales y privacidad",
      fields: ["rnd_habilitado", "adjuntos_json"],
    },
  ];
  const [values, setValues] = useState<Row>(() =>
    Object.fromEntries(
      config.fields.map((f: any) => {
        let v = initial[f.key];
        if (f.key === "adjuntos_json" && !isProfile)
          v = [
            ...new Set([
              ...fileIds(v),
              ...config.fields
                .filter((field: any) => field.type === "file")
                .map((field: any) => initial[field.key])
                .filter(Boolean),
            ]),
          ];
        if (
          v &&
          f.type === "datetime-local" &&
          /(?:Z|[+-]\d{2}:\d{2})$/.test(v)
        ) {
          const d = new Date(v);
          v = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
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
              ? table === "credenciales_discapacidad" && f.key === "activo"
                ? 1
                : 0
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
    [error, setError] = useState(""),
    [calendarMinutes, setCalendarMinutes] = useState(60);
  const [uploads, setUploads] = useState<Record<string, boolean>>({});
  const uploading = Object.values(uploads).some(Boolean);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (uploading) return;
    if (isProfile && formRef.current) {
      const invalid = Array.from(
        formRef.current.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input,select,textarea"),
      ).find((el) => !el.disabled && !el.checkValidity());
      if (invalid) {
        const panel = invalid.closest<HTMLElement>("[data-profile-tab]");
        if (panel) setActiveTab(Number(panel.dataset.profileTab));
        setError("Revisa el campo señalado antes de guardar.");
        requestAnimationFrame(() => {
          invalid.focus();
          invalid.reportValidity();
        });
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const payload = { ...values };
      for (const f of config.fields) {
        if (f.type === "datetime-local" && payload[f.key])
          payload[f.key] = new Date(payload[f.key]).toISOString();
      }
      await onSave(payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function addToGoogleCalendar() {
    const start = values.fecha;
    if (!start) {
      setError(
        "Ingresa la fecha y hora antes de agregar la cita al calendario.",
      );
      return;
    }
    const begins = new Date(start);
    if (!Number.isFinite(begins.getTime())) {
      setError("La fecha y hora de la cita no es válida.");
      return;
    }
    const ends = new Date(begins.getTime() + calendarMinutes * 60000);
    const format = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
    const details = [
      ["Profesional", values.medico_nombre],
      ["Especialidad", values.especialidad],
      ["Acompañante", values.acompanante],
      ["Motivo", values.motivo_consulta],
      ["Diagnóstico informado", values.diagnostico],
      ["Plan de tratamiento", values.plan_tratamiento],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
    const title = `Consulta médica: ${values.especialidad || "Sin especialidad"} - ${values.medico_nombre || "Profesional"}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${format(begins)}/${format(ends)}`,
      details,
      ctz: "America/Santiago",
    });
    window.open(
      `https://calendar.google.com/calendar/render?${params}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  function profileField(key: string) {
    const field = config.fields.find((f: any) => f.key === key);
    if (!field || !fieldVisible(field, values)) return null;
    const contact = key.startsWith("contacto_emergencia_");
    const f = contact
      ? {
          ...field,
          displayLabel: key.endsWith("_nombre")
            ? "Nombre"
            : key.endsWith("_parentesco")
              ? "Parentesco"
              : "Teléfono",
          fullWidth: field.type === "tel",
        }
      : field;
    return (
      <Field
        key={key}
        field={f}
        value={values[key]}
        compact={f.type === "file"}
        onChange={(v) => setValues((previous) => ({ ...previous, [key]: v }))}
        onBusy={(value) =>
          setUploads((previous) => ({ ...previous, [key]: value }))
        }
        child={child}
        module={config.module}
      />
    );
  }
  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate={isProfile}
      className={isProfile ? "profile-editor-form" : ""}
    >
      {isProfile && (
        <div
          role="tablist"
          aria-label="Secciones del perfil"
          className="profile-tabs"
        >
          {profileGroups.map((group, i) => {
            const Icon = group.icon;
            return (
              <button
                type="button"
                role="tab"
                aria-label={group.title}
                key={group.title}
                id={`${tabPrefix}-tab-${i}`}
                aria-controls={`${tabPrefix}-panel-${i}`}
                aria-selected={activeTab === i}
                tabIndex={activeTab === i ? 0 : -1}
                disabled={busy}
                onClick={() => setActiveTab(i)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 4
                          : (i + (e.key === "ArrowRight" ? 1 : 4)) % 5;
                    setActiveTab(next);
                    document
                      .getElementById(`${tabPrefix}-tab-${next}`)
                      ?.focus();
                  }
                }}
              >
                <Icon size={17} />
                {group.title === "Identificación" ? (
                  <>
                    <span className="profile-tab-full">Identificación</span>
                    <span className="profile-tab-short">Datos</span>
                  </>
                ) : (
                  <span>{group.title}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <fieldset
        disabled={busy}
        className={isProfile ? "profile-editor-body" : "form-grid"}
      >
        {isProfile
          ? profileGroups.map((group, i) => (
              <section
                key={group.title}
                role="tabpanel"
                id={`${tabPrefix}-panel-${i}`}
                aria-labelledby={`${tabPrefix}-tab-${i}`}
                data-profile-tab={i}
                hidden={activeTab !== i}
                className="profile-tab-panel"
              >
                <h3>
                  <group.icon size={20} />
                  {group.heading}
                </h3>
                {i === 2 && (
                  <p className="muted">
                    Desde el cuidado en casa hasta la etapa escolar.
                  </p>
                )}
                {i === 3 ? (
                  <div className="profile-contact-cards">
                    {["principal", "secundario"].map((kind) => (
                      <section className="profile-contact-card" key={kind}>
                        <h4>Contacto {kind}</h4>
                        <div className="form-grid">
                          {group.fields
                            .filter((key) => key.includes(`_${kind}_`))
                            .map(profileField)}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="form-grid">
                    {group.fields.map(profileField)}
                  </div>
                )}
                {i === 4 && (
                  <div className="profile-privacy-note">
                    <ShieldCheck size={23} />
                    <div>
                      <h4>Visibilidad por persona</h4>
                      <p>
                        RUT, teléfonos, diagnósticos, foto y documentos se
                        controlan desde los permisos de cada usuario, para todos
                        los perfiles familiares.
                      </p>
                      {onManagePrivacy ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={onManagePrivacy}
                        >
                          Configurar visibilidad y permisos
                        </button>
                      ) : (
                        <small>
                          El administrador de tu familia gestiona estos
                          permisos.
                        </small>
                      )}
                    </div>
                  </div>
                )}
              </section>
            ))
          : config.fields
              .filter(
                (f: any) =>
                  !f.hidden &&
                  f.type !== "file" &&
                  (!onlyFields || onlyFields.includes(f.key)) &&
                  fieldVisible(f, values),
              )
              .map((f: any) => (
                <Field
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  onChange={(v) =>
                    setValues((previous) => {
                      const next: Row = { ...previous, [f.key]: v };
                      if (f.key === "adjuntos_json")
                        for (const legacy of config.fields.filter(
                          (field: any) => field.type === "file",
                        ))
                          if (
                            next[legacy.key] &&
                            !fileIds(v).includes(next[legacy.key])
                          )
                            next[legacy.key] = "";
                      return next;
                    })
                  }
                  onBusy={(value) =>
                    setUploads((previous) => ({ ...previous, [f.key]: value }))
                  }
                  child={child}
                  module={config.module}
                />
              ))}
      </fieldset>
      <div className={isProfile ? "profile-editor-footer" : ""}>
        <ErrorNote error={error} />
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
          )}
          {table === "consultas_medicas" && (
            <>
              <label className="calendar-duration">
                Duración
                <select
                  value={calendarMinutes}
                  onChange={(e) => setCalendarMinutes(Number(e.target.value))}
                >
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                onClick={addToGoogleCalendar}
              >
                Agregar a Google Calendar
              </button>
            </>
          )}
          <button className="primary" disabled={busy || uploading}>
            {uploading
              ? "Esperando archivo…"
              : busy
                ? "Guardando…"
                : isProfile
                  ? "Guardar cambios"
                  : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}
export function RecordDetails({
  table,
  row,
  onlyFields,
}: {
  table: string;
  row: Row;
  onlyFields?: string[];
}) {
  return (
    <dl className="details">
      {models[table].fields
        .filter(
          (f: any) =>
            fieldVisible(f, row) &&
            (onlyFields
              ? onlyFields.includes(f.key)
              : f.key !== "adecuaciones_adjuntos_json") &&
            !(
              f.type === "file" &&
              fileIds(row.adjuntos_json).includes(row[f.key])
            ),
        )
        .map((f: any) => {
          let v = row[f.key];
          if (f.type === "files") {
            const ids = fileIds(v);
            return ids.length ? (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  <FileGallery
                    ids={ids}
                    child={row.nino_id || row.id}
                    module={models[table].module}
                  />
                </dd>
              </div>
            ) : null;
          }
          if (v === null || v === undefined || v === "") return null;
          if (f.type === "checkbox") v = v ? "Sí" : "No";
          if (f.type === "lines") v = JSON.parse(v).join("\n");
          if (f.type === "date" || f.type === "datetime-local")
            v = dateLabel(v);
          return (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>
                {f.type === "file" ? (
                  <FileGallery
                    ids={[v]}
                    child={row.nino_id || row.id}
                    module={models[table].module}
                  />
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
    [busy, setBusy] = useState(false),
    [visitCategory, setVisitCategory] = useState("upcoming"),
    [visitNow, setVisitNow] = useState(Date.now());
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
  useEffect(() => {
    if (table !== "consultas_medicas") return;
    setVisitNow(Date.now());
    const timer = setInterval(() => setVisitNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [table, child.id]);
  const isVisit = table === "consultas_medicas";
  const upcoming = rows.filter(
    (row) =>
      Number.isFinite(Date.parse(row.fecha)) &&
      Date.parse(row.fecha) >= visitNow,
  );
  const completed = rows.filter(
    (row) =>
      !Number.isFinite(Date.parse(row.fecha)) ||
      Date.parse(row.fecha) < visitNow,
  );
  const shownRows = isVisit
    ? [...(visitCategory === "upcoming" ? upcoming : completed)].sort(
        (a, b) => {
          const da = Date.parse(a.fecha),
            db = Date.parse(b.fecha);
          if (!Number.isFinite(da)) return Number.isFinite(db) ? 1 : 0;
          if (!Number.isFinite(db)) return -1;
          return visitCategory === "upcoming" ? da - db : db - da;
        },
      )
    : rows;
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
      {isVisit && (
        <div
          className="tabs consultation-categories"
          role="group"
          aria-label="Categoría de consultas"
        >
          <button
            aria-pressed={visitCategory === "upcoming"}
            className={visitCategory === "upcoming" ? "selected" : ""}
            onClick={() => setVisitCategory("upcoming")}
          >
            Por realizar ({upcoming.length})
          </button>
          <button
            aria-pressed={visitCategory === "completed"}
            className={visitCategory === "completed" ? "selected" : ""}
            onClick={() => setVisitCategory("completed")}
          >
            Realizadas ({completed.length})
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Cargando registros…</p>
      ) : !shownRows.length ? (
        <Empty>
          {isVisit
            ? visitCategory === "upcoming"
              ? "No hay consultas por realizar."
              : "No hay consultas realizadas."
            : "Aún no hay información registrada."}
        </Empty>
      ) : (
        <div
          className={
            table === "historial_colegios" ? "timeline" : "record-list"
          }
        >
          {shownRows.map((row) => {
            const Card = "details";
            return (
              <Card
                className={
                  isVisit
                    ? "card record-card consultation-accordion"
                    : "card record-card"
                }
                key={row.id}
              >
                <summary className="consultation-summary">
                  <time>
                    {dateLabel(
                      row.fecha ||
                        row.fecha_medicion ||
                        row.fecha_inicio ||
                        row.periodo_inicio ||
                        "",
                    ) || "Registro"}
                  </time>
                  <strong title={row.especialidad || row.nombre}>
                    {row.especialidad ||
                      row.nombre ||
                      row.colegio_actual ||
                      row.estado_animo ||
                      config.title}
                  </strong>
                  <span>
                    {row.medico_nombre ||
                      row.dosis ||
                      row.tipo_comida ||
                      row.curso ||
                      ""}
                  </span>
                </summary>
                <div className="consultation-body">
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
                      {fileIds(row.paec_json).length > 0 && (
                        <>
                          <h3>PAEC</h3>
                          <ul>
                            {fileIds(row.paec_json).map((text, index) => (
                              <li key={index}>{text}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <FileGallery
                        ids={fileIds(row.adecuaciones_adjuntos_json)}
                        child={child.id}
                        module={config.module}
                      />
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
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {edit && (
        <Modal title={config.title} close={() => setEdit(null)}>
          <RecordForm
            table={table}
            initial={edit}
            child={child.id}
            onlyFields={onlyFields}
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
export function PdfPreview({ url, name }: { url: string; name: string }) {
  return (
    <div className="pdf-preview-card">
      <FileText size={30} aria-hidden="true" />
      <div>
        <strong title={name}>{name}</strong>
        <p>
          Documento PDF · Ábrelo en el visor de tu dispositivo o descárgalo.
        </p>
        <div className="actions">
          <a
            className="secondary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver PDF
          </a>
          <a
            className="secondary"
            href={url.startsWith("blob:") ? url : url + "?download=1"}
            download={name}
          >
            <Download size={16} /> Descargar PDF
          </a>
        </div>
      </div>
    </div>
  );
}
function AttachmentPreview({ file }: { file: Row }) {
  const [open, setOpen] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl = "";
    setError("");
    setUrl("");
    void fetchAttachment(file.id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, file.id]);
  return (
    <details
      className="file-preview"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Vista previa</summary>
      {open &&
        (error ? (
          <ErrorNote error={error} />
        ) : !url ? (
          <p className="muted" role="status">
            Abriendo archivo…
          </p>
        ) : String(file.mime).startsWith("image/") ? (
          <img
            src={url}
            alt={file.nombre}
            onError={() =>
              setError(
                "No se pudo mostrar la imagen. Puedes intentar descargarla.",
              )
            }
          />
        ) : (
          <PdfPreview name={file.nombre} url={url} />
        ))}
    </details>
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
              onClick={async (e) => {
                e.preventDefault();
                setError("");
                try {
                  await downloadAttachment(f.id, f.nombre);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={17} />
            </a>
            {!readonly && (
              <button
                className="link-button danger"
                aria-label={"Eliminar " + f.nombre}
                onClick={async () => {
                  if (
                    !confirm(
                      "¿Eliminar este archivo? Esta acción no se puede deshacer.",
                    )
                  )
                    return;
                  try {
                    await api("files/" + f.id, "DELETE");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
            <AttachmentPreview file={f} />
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Sin documentos adjuntos.</p>}
    </section>
  );
}
