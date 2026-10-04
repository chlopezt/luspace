import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { type Row } from "./lib";
export function months(birth: string, date: string) {
  return (
    (Date.parse(date + "T12:00:00Z") - Date.parse(birth + "T12:00:00Z")) /
    86400000 /
    30.4375
  );
}
export function zValue(l: number, m: number, s: number, z: number) {
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}
export function percentile(value: number, row: number[]) {
  const [, l, m, s] = row;
  const z =
    l === 0 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
  if (Math.abs(z) > 3) return z < 0 ? "< 0,2" : "> 99,8";
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp((-z * z) / 2);
  const p =
    1 -
    d *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return ((z < 0 ? 1 - p : p) * 100).toFixed(1).replace(".", ",");
}
export default function Growth({ child, rows }: { child: Row; rows: Row[] }) {
  const [metric, setMetric] = useState("peso_kg"),
    [reference, setReference] = useState<Row>({}),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/data/who.json")
      .then((r) => {
        if (!r.ok) throw Error("Referencia OMS no disponible.");
        return r.json();
      })
      .then(setReference)
      .catch((e) => setError(e.message));
  }, []);
  const key =
    (metric === "peso_kg" ? "weight" : "height") + "_" + child.sexo_referencia;
  const refs: number[][] = reference[key] || [];
  const measured = rows
    .filter((r) => r[metric])
    .map((r) => ({
      month: months(child.fecha_nacimiento, r.fecha_medicion),
      observed: Number(r[metric]),
      date: r.fecha_medicion,
    }))
    .sort((a, b) => a.month - b.month);
  const low = measured.length
      ? Math.max(0, Math.floor(measured[0].month) - 3)
      : 0,
    high = measured.length
      ? Math.ceil(measured[measured.length - 1].month) + 3
      : 12;
  const data: Row[] = refs
    .filter((r) => r[0] >= low && r[0] <= high)
    .map((r) => ({
      month: r[0],
      p3: zValue(r[1], r[2], r[3], -1.880793608),
      p50: r[2],
      p97: zValue(r[1], r[2], r[3], 1.880793608),
    }));
  for (const r of measured) {
    const existing = data.find((x) => Math.abs(x.month - r.month) < 0.001);
    if (existing) Object.assign(existing, r);
    else data.push(r);
  }
  data.sort((a, b) => a.month - b.month);
  const last = measured.at(-1),
    ref = last && refs.find((r) => r[0] === Math.round(last.month)),
    p = ref && last ? percentile(last.observed, ref) : null;
  const growthTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const observed = payload.find((item: any) => item.dataKey === "observed")?.value;
    const row = refs.find((item) => Math.abs(item[0] - Number(label)) < 0.51);
    return <div className="growth-tooltip"><b>{Number(label).toFixed(1)} meses</b>{observed != null && <><span>{Number(observed).toFixed(2)} {metric === "peso_kg" ? "kg" : "cm"}</span>{row && <small>Percentil estimado: {percentile(Number(observed), row)}</small>}</>} </div>;
  };
  return (
    <article className="card growth">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CRECIMIENTO</p>
          <h2><Activity size={20} /> Evolución de {child.primer_nombre}</h2>
        </div>
        <select
          aria-label="Medida del gráfico"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          <option value="peso_kg">Peso · kg</option>
          <option value="talla_cm">Talla · cm</option>
        </select>
      </div>
      {measured.length ? (
        <>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="month"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(n) => `${Math.round(n)} m`}
                />
                <YAxis domain={["auto", "auto"]} width={45} />
                <Tooltip content={growthTooltip} />
                <Legend />
                <Line
                  dataKey="p3"
                  name="OMS P3"
                  stroke="#9aaeb0"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="p50"
                  name="OMS P50"
                  stroke="#9b7ac9"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="p97"
                  name="OMS P97"
                  stroke="#9aaeb0"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="observed"
                  name="Mediciones"
                  stroke="#0d9488"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">
            Última medición: {last?.observed}{" "}
            {metric === "peso_kg" ? "kg" : "cm"}
            {p
              ? ` · Percentil estimado ${p}`
              : " · Sin percentil para esta edad o sexo de referencia"}
            .
          </p>
        </>
      ) : (
        <p className="empty-state">
          Agrega una medición para ver su evolución.
        </p>
      )}
      <p className="muted chart-note">
        {error ||
          "Referencias OMS 2006/2007: peso de 0 a 10 años, longitud/talla de 0 a 19 años. Percentil aproximado al mes más cercano; no es un diagnóstico. Antes de 2 años registra longitud acostado; después, talla de pie."}{" "}
        <a
          href="https://www.who.int/tools/child-growth-standards"
          target="_blank"
          rel="noreferrer"
        >
          Estándares OMS
        </a>{" "}
        ·{" "}
        <a
          href="https://www.who.int/tools/growth-reference-data-for-5to19-years"
          target="_blank"
          rel="noreferrer"
        >
          Referencia 5–19 años
        </a>
      </p>
    </article>
  );
}
