export function calendarAge(birth, at) {
  const b = new Date(birth + "T00:00:00Z"),
    d = new Date(at + "T00:00:00Z");
  if (!Number.isFinite(+b) || !Number.isFinite(+d) || d < b) return null;
  let months =
    (d.getUTCFullYear() - b.getUTCFullYear()) * 12 +
    d.getUTCMonth() -
    b.getUTCMonth();
  const anchor = (n) => {
    const target = new Date(
      Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + n, 1),
    );
    const max = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return new Date(
      Date.UTC(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        Math.min(b.getUTCDate(), max),
      ),
    );
  };
  if (anchor(months) > d) months--;
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days: Math.floor((d - anchor(months)) / 86400000),
  };
}
