import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  HardDrive,
  Files,
  ShieldCheck,
  RefreshCw,
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api, dateLabel, type Row } from "./lib";
import { ErrorNote } from "./components";
import PlatformFamilyManager from "./PlatformFamilyManager";
import StorageMigration from "./StorageMigration";
import PlatformConsumption from './PlatformConsumption';
import PlatformBackups from './PlatformBackups';
import PlatformPayments from './PlatformPayments';
import PlatformMfa from './PlatformMfa';
export const platformSections = [
  ["overview", "Resumen"],
  ["families", "Familias"],
  ["subscriptions", "Pruebas y suscripciones"],
  ["storage", "Almacenamiento"],
  ["security", "Seguridad y actividad"],
  ["consumption", "Consumo y alertas"],
  ["backups", "Respaldos y recuperación"],
  ["payments", "Pagos y acceso"],
  ["account-security", "Seguridad de mi cuenta"],
] as const;
const colors = ["#14b8a6", "#8b5cf6", "#60a5fa", "#f59e0b", "#ef7183"];
const labels: Record<string, string> = {
  trial: "En prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  expired: "Vencida",
  superadmin: "Administrador de la familia",
  editor: "Editor",
  lector: "Solo lectura",
};
const bytes = (n: number) =>
  n >= 1073741824
    ? (n / 1073741824).toFixed(2) + " GiB"
    : n >= 1048576
      ? (n / 1048576).toFixed(2) + " MiB"
      : n >= 1024
        ? (n / 1024).toFixed(1) + " KiB"
        : n + " bytes";
function auditDescription(value: string) {
  try {
    const detail = JSON.parse(value);
    return (
      <>
        <p>
          {detail.motivo || "Cambio administrativo"}
          {detail.familia_id && <small>Familia: {detail.familia_id}</small>}
        </p>
        <details>
          <summary>Ver detalle del cambio</summary>
          <pre className="platform-audit-detail">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </details>
      </>
    );
  } catch {
    return value;
  }
}
function Donut({
  title,
  items,
  byteValues = false,
}: {
  title: string;
  items: Row[];
  byteValues?: boolean;
}) {
  const total = items.reduce((n, r) => n + Number(r.value), 0);
  return (
    <article className="card platform-chart-card">
      <h2>{title}</h2>
      {total > 0 ? (
        <>
          <div className="platform-donut">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {items.map((r, i) => (
                    <Cell key={r.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) =>
                    byteValues ? bytes(Number(v)) : Number(v)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="platform-donut-center">
              <strong>{byteValues ? bytes(total) : total}</strong>
              <small>Total</small>
            </div>
          </div>
          <ul className="platform-chart-key">
            {items.map((r, i) => (
              <li key={r.name}>
                <span style={{ background: colors[i % colors.length] }} />
                <b>{r.name}</b>
                <small>
                  {byteValues ? bytes(r.value) : r.value} ·{" "}
                  {((Number(r.value) / total) * 100).toFixed(2)}%
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="empty-state">Sin datos registrados.</p>
      )}
    </article>
  );
}
export default function PlatformAdmin({
  section = "overview",
}: {
  section?: string;
}) {
  const [managedFamily, setManagedFamily] = useState<string | null>(null);
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [days, setDays] = useState(30);
  useEffect(() => {
    if(['consumption','backups','payments','account-security'].includes(section)) return;
    let live = true;
    setBusy(true);
    setError("");
    api("platform/overview?days=" + days)
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [days,section]);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setData(await api("platform/overview?days=" + days));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if(section === 'consumption') return <section className="platform-dashboard"><div className="platform-page-heading"><div><p className="eyebrow">CONTROL DE PLATAFORMA</p><h1>Consumo y alertas</h1><p className="muted">Capacidad y protección de todas las familias.</p></div></div><PlatformConsumption/></section>;
  if(section === 'backups') return <PlatformBackups/>;
  if(section === 'payments') return <PlatformPayments/>;
  if(section === 'account-security') return <PlatformMfa/>;
  const t = data?.totals;
  const familyList = (data?.families || []).filter(
    (f: Row) =>
      f.nombre.toLowerCase().includes(search.toLowerCase()) &&
      (!status || f.subscription_status === status),
  );
  const familyStatus = (data?.statuses || []).map((r: Row) => ({
    ...r,
    name: labels[r.name] || r.name,
  }));
  const roleData = (data?.roles || []).map((r: Row) => ({
    ...r,
    name: labels[r.name] || r.name,
  }));
  const loginMap = new Map<string, Row>();
  for (const row of data?.logins || []) {
    if (!loginMap.has(row.day)) loginMap.set(row.day, { day: row.day });
    loginMap.get(row.day)![row.role] = row.count;
  }
  const loginData = Array.from(loginMap.values());
  const monthly = (data?.monthly_files || []).map((r: Row) => ({
    ...r,
    mb: Number((r.bytes / 1048576).toFixed(3)),
  }));
  const average = t?.archivos ? bytes(t.storage_used_bytes / t.archivos) : "—";
  const table = (
    <article className="card platform-family-card">
      <div className="platform-card-title">
        <h2>
          <Building2 size={20} /> Familias registradas
        </h2>
        <small>
          {familyList.length} de {t?.familias || 0}
        </small>
      </div>
      <div className="platform-filters">
        <label>
          Buscar familia
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre de la familia"
          />
        </label>
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(labels)
              .filter(([key]) =>
                ["trial", "active", "past_due", "canceled", "expired"].includes(
                  key,
                ),
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Listado de hasta 200 familias recientes. Los gráficos globales incluyen
        todas las familias.
      </p>
      <div
        className="platform-table"
        tabIndex={0}
        aria-label="Familias: tabla con desplazamiento horizontal"
      >
        <table>
          <thead>
            <tr>
              <th>Familia / registro</th>
              <th>Estado</th>
              <th>Prueba</th>
              <th>Miembros</th>
              <th>Archivos</th>
              <th>Espacio / cuota</th>
            </tr>
          </thead>
          <tbody>
            {familyList.map((f: Row) => {
              const remaining = Math.max(
                0,
                Math.ceil(
                  (Date.parse(f.trial_ends_at) - Date.now()) / 86400000,
                ),
              );
              return (
                <tr key={f.id}>
                  <td>
                    <strong>{f.nombre}</strong>
                    <small>{dateLabel(f.created_at)}</small>
                  </td>
                  <td>
                    <span
                      className={
                        "platform-state state-" + f.subscription_status
                      }
                    >
                      {labels[f.subscription_status] || f.subscription_status}
                    </span>
                    {!!f.commercial_exempt && (
                      <small>Excepción de continuidad</small>
                    )}
                  </td>
                  <td>
                    {f.commercial_exempt
                      ? "Sin vencimiento"
                      : f.subscription_status === "trial"
                        ? remaining + " días restantes"
                        : f.trial_ends_at
                          ? dateLabel(f.trial_ends_at)
                          : "No aplica"}
                  </td>
                  <td>{f.miembros_activos}</td>
                  <td>{f.archivos}</td>
                  <td>
                    {bytes(f.storage_used_bytes)}
                    <small>
                      {f.commercial_exempt
                        ? "Cuota no aplicada"
                        : bytes(f.storage_limit_bytes) + " de cuota"}
                    </small>
                    {!f.commercial_exempt && (
                      <progress
                        max={f.storage_limit_bytes || 1}
                        value={f.storage_used_bytes}
                        aria-label={"Uso de cuota de " + f.nombre}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!familyList.length && (
        <p className="empty-state">
          No hay familias que coincidan con el filtro.
        </p>
      )}
    </article>
  );
  const security = (
    <>
      <div className="platform-chart-grid">
        <Donut title="Roles familiares activos" items={roleData} />
        <article className="card platform-chart-card">
          <h2>
            <Activity size={20} /> Inicios de sesión familiares
          </h2>
          <p className="muted">
            Conteos anónimos por rol, últimos {days} días. No incluye consultas
            clínicas.
          </p>
          {loginData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={loginData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {["superadmin", "editor", "lector"].map((role, i) => (
                  <Bar
                    isAnimationActive={false}
                    key={role}
                    dataKey={role}
                    name={labels[role]}
                    stackId="roles"
                    fill={colors[i]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">
              Sin inicios de sesión en este período.
            </p>
          )}
        </article>
      </div>
      <article className="card">
        <h2>
          <ShieldCheck size={20} /> Actividad de administración
        </h2>
        <p className="muted">
          Solo eventos del panel de plataforma; no contiene la bitácora clínica
          de ninguna familia.
        </p>
        <ul className="platform-activity">
          {(data?.activity || []).map((r: Row, i: number) => (
            <li key={i}>
              <span className="platform-state">{r.accion}</span>
              <div>
                {auditDescription(r.descripcion)}
                <small>{dateLabel(r.created_at)}</small>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </>
  );
  return (
    <section className="platform-dashboard">
      <div className="platform-page-heading">
        <div>
          <p className="eyebrow">CONTROL DE PLATAFORMA</p>
          <h1>
            {platformSections.find(([key]) => key === section)?.[1] ||
              "Resumen"}
          </h1>
          <p className="muted">Una mirada clara al estado de LuSpace.</p>
        </div>
        <div className="platform-tools">
          <label>
            Período
            <select
              aria-label="Período de estadísticas"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={365}>365 días</option>
            </select>
          </label>
          <button disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={17} /> Actualizar
          </button>
        </div>
      </div>
      <ErrorNote error={error} />
      {busy && <p role="status">Actualizando estadísticas…</p>}
      {t && (
        <>
          <div className="platform-kpis">
            {[
              [Building2, "Familias", t.familias],
              [Users, "Miembros activos", t.miembros_activos],
              [Files, "Archivos", t.archivos],
              [HardDrive, "Almacenamiento", bytes(t.storage_used_bytes)],
              [Clock, "Pruebas por vencer", t.trials_ending_soon],
              [
                ShieldCheck,
                "Sesiones activas",
                Number(t.family_sessions) + Number(t.platform_sessions),
              ],
            ].map(([Icon, label, value]: any) => (
              <article className="card" key={label}>
                <div className="platform-kpi-icon">
                  <Icon size={22} />
                </div>
                <p>{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="platform-notice">
            <ShieldCheck size={20} />
            <p>
              Solo datos administrativos. Sin acceso a perfiles ni archivos
              sensibles. Registro público habilitado; pagos pendientes. No se presentan
              ingresos estimados.
            </p>
          </div>
          {!!t.trials_ending_soon && (
            <div className="subscription-banner">
              <AlertTriangle size={18} /> {t.trials_ending_soon} pruebas vencen
              dentro de los próximos 3 días.
            </div>
          )}
          {section === "storage" && <StorageMigration />}
          {["overview", "subscriptions"].includes(section) && (
            <div className="platform-chart-grid">
              <Donut title="Estado de las familias" items={familyStatus} />
              <article className="card platform-chart-card">
                <h2>
                  <TrendingUp size={20} /> Registro de familias
                </h2>
                <p className="muted">
                  Nuevas familias por día, últimos {days} días.
                </p>
                {data!.registrations.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data!.registrations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="count"
                        name="Familias nuevas"
                        stroke="#14b8a6"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">Sin registros en el período.</p>
                )}
              </article>
            </div>
          )}
          {["overview", "storage"].includes(section) && (
            <>
              <div className="platform-chart-grid">
                <Donut
                  title="Cuota aplicada: usado y disponible"
                  items={[
                    { name: "Usado", value: Number(t.enforced_used_bytes) },
                    {
                      name: "Disponible",
                      value: Math.max(
                        0,
                        Number(t.enforced_quota_bytes) -
                          Number(t.enforced_used_bytes),
                      ),
                    },
                  ]}
                  byteValues
                />
                <article className="card platform-chart-card">
                  <h2>Espacio por familia</h2>
                  <p className="muted">
                    Ocho familias con más uso dentro del listado de las 200
                    recientes. No muestra nombres de archivos.
                  </p>
                  {data!.families.some((f: Row) => f.storage_used_bytes > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        layout="vertical"
                        data={[...data!.families]
                          .sort(
                            (a: Row, b: Row) =>
                              b.storage_used_bytes - a.storage_used_bytes,
                          )
                          .slice(0, 8)
                          .map((f: Row) => ({
                            name: f.nombre,
                            bytes: f.storage_used_bytes,
                          }))}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={(v: any) => bytes(Number(v))} />
                        <Bar
                          isAnimationActive={false}
                          dataKey="bytes"
                          name="Almacenamiento"
                          fill="#14b8a6"
                          radius={[0, 5, 5, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="empty-state">Sin archivos registrados.</p>
                  )}
                  <p className="muted">
                    La dona excluye a las familias exentas de cuota. Sin
                    familias sujetas a límites no habrá datos de capacidad
                    aplicada.
                  </p>
                </article>
              </div>
              <div className="platform-chart-grid">
                <Donut
                  title="Espacio por formato de archivo"
                  items={data!.file_types.map((r: Row) => ({
                    name: r.name,
                    value: r.bytes,
                  }))}
                  byteValues
                />
                <article className="card platform-chart-card">
                  <h2>
                    <HardDrive size={20} /> Archivos almacenados por mes de
                    carga
                  </h2>
                  <p className="muted">
                    MiB de archivos que permanecen guardados, últimos 12 meses
                    con datos. No es un histórico de archivos eliminados.
                  </p>
                  {monthly.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip
                          formatter={(v: any) => Number(v).toFixed(3) + " MiB"}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="mb"
                          name="MiB guardados"
                          fill="#8b5cf6"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="empty-state">Sin archivos almacenados.</p>
                  )}
                </article>
              </div>
              <article className="card platform-storage-detail">
                <h2>Detalle de almacenamiento</h2>
                <div>
                  <p>
                    Tamaño promedio<strong>{average}</strong>
                  </p>
                  <p>
                    Cuotas asignadas de referencia
                    <strong>{bytes(t.reference_quota_bytes)}</strong>
                  </p>
                  <p>
                    Familias exentas<strong>{t.exempt_families}</strong>
                  </p>
                  <p>
                    Motor de adjuntos actual<strong>{data!.storage_backend || 'D1'}</strong>
                  </p>
                </div>
                <p className="muted">
                  Las cuotas de familias exentas no se aplican. Estas cifras no
                  representan la facturación de R2 ni el tamaño de los respaldos
                  conservados en D1; muestran los bytes lógicos de adjuntos vigentes.
                </p>
                <ul className="platform-chart-key">
                  {data!.file_types.map((r: Row, i: number) => (
                    <li key={r.name}>
                      <span style={{ background: colors[i % colors.length] }} />
                      <b>{r.name}</b>
                      <small>
                        {r.count} archivos · {bytes(r.bytes)}
                      </small>
                    </li>
                  ))}
                </ul>
              </article>
            </>
          )}
          {["overview", "families", "subscriptions", "storage"].includes(
            section,
          ) && (
            <>
              {table}
              <article className="card">
                <h2>
                  <Building2 size={20} /> Gestión manual de familias
                </h2>
                <p className="muted">
                  Abre parámetros administrativos y cuentas de una familia. Sin
                  acceso a perfiles ni documentos clínicos.
                </p>
                <div className="platform-manager-list">
                  {familyList.map((f: Row) => (
                    <button
                      key={f.id}
                      onClick={() => setManagedFamily(f.id)}
                      aria-label={"Gestionar " + f.nombre}
                    >
                      <strong>{f.nombre}</strong>
                      <span>Gestionar parámetros y accesos →</span>
                    </button>
                  ))}
                </div>
              </article>
            </>
          )}
          {["overview", "security"].includes(section) && security}
          <p className="muted platform-updated">
            Actualizado: {dateLabel(data!.generated_at)} · Fechas agrupadas en
            UTC.
          </p>
        </>
      )}
      {managedFamily && (
        <PlatformFamilyManager
          key={managedFamily}
          id={managedFamily}
          close={() => setManagedFamily(null)}
          changed={() => void refresh()}
        />
      )}
    </section>
  );
}
