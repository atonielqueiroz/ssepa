export function toUtcStartOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function addDaysUtc(d: Date, days: number) {
  const x = toUtcStartOfDay(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function diffDaysUtc(a: Date, b: Date) {
  const aa = toUtcStartOfDay(a).getTime();
  const bb = toUtcStartOfDay(b).getTime();
  return Math.floor((bb - aa) / 86400000);
}

export function clampDate(d: Date, min: Date, max: Date) {
  const t = d.getTime();
  return new Date(Math.min(Math.max(t, min.getTime()), max.getTime()));
}
