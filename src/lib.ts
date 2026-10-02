import { calendarAge } from "../shared/dates.js";
export type Row = Record<string, any>;
export async function api(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<any> {
  const res = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers:
      data instanceof FormData
        ? {}
        : data
          ? { "Content-Type": "application/json" }
          : {},
    body:
      data instanceof FormData
        ? data
        : data === undefined
          ? undefined
          : JSON.stringify(data),
  });
  const payload = await res
    .json()
    .catch(() => ({ error: "El servidor no responde. Verifica la conexión." }));
  if (!res.ok)
    throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function age(birth: string, at = today()) {
  const a = calendarAge(birth, at);
  return a
    ? `${a.years} años · ${a.months} meses · ${a.days} días`
    : "Fecha pendiente";
}
export const dateLabel = (s: string) =>
  s
    ? new Date(
        s.length === 10
          ? s + "T12:00:00"
          : s.includes("T")
            ? s
            : s.replace(" ", "T") + "Z",
      ).toLocaleString(
        "es-CL",
        s.length === 10
          ? { dateStyle: "medium" }
          : { dateStyle: "medium", timeStyle: "short" },
      )
    : "Sin registrar";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
