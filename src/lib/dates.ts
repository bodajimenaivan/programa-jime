// Fechas "de pared": guardamos YYYY-MM-DD y HH:MM tal cual las elige el equipo,
// así el calendario nunca se corre por zonas horarias.

export const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const WEEKDAYS_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** Hoy en la zona horaria del espacio de trabajo. */
export function todayIn(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA ya formatea YYYY-MM-DD
}

export function monthKey(s: string) {
  return s.slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 0 = lunes … 6 = domingo */
export function weekdayIndex(iso: string) {
  const { y, m, d } = parseISODate(iso);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (js + 6) % 7;
}

export function addDays(iso: string, days: number) {
  const { y, m, d } = parseISODate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Semanas (lunes a domingo) que cubren el mes. */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayIndex(first));
  const last = `${month}-${pad(daysInMonth(month))}`;
  const end = addDays(last, 6 - weekdayIndex(last));
  const weeks: string[][] = [];
  let cur = start;
  while (cur <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function weekOf(iso: string) {
  const start = addDays(iso, -weekdayIndex(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDayLong(iso: string) {
  const { m, d } = parseISODate(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]} ${d} de ${MONTHS[m - 1]}`;
}

export function formatDayShort(iso: string) {
  const { m, d } = parseISODate(iso);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

export function relativeDay(iso: string, today: string) {
  if (iso === today) return "Hoy";
  if (iso === addDays(today, 1)) return "Mañana";
  if (iso === addDays(today, -1)) return "Ayer";
  return null;
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.round((now - ts) / 1000);
  if (s < 60) return "recién";
  const min = Math.round(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  const date = new Date(ts);
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}
