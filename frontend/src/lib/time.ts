export const H = 3600000, M = 60000;
export const p2 = (n: number) => String(n).padStart(2, '0');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function sod(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(t: number, n: number) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
export function sow(t: number) { const d = sod(t); return addDays(d, -((new Date(d).getDay() + 6) % 7)); }
export function som(t: number) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
export function ymd(t: number) { const d = new Date(t); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
export function hm(t: number) { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
export function tmin(str: string | null | undefined) { const [h, m] = String(str || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); }
export function atMin(d0: number, min: number) { const d = new Date(d0); d.setHours(0, min, 0, 0); return d.getTime(); }
export function parseLocal(date: string, time: string) {
  if (!date || !time) return NaN;
  const [y, m, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0).getTime();
}
export function hms(ms: number) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); return [p2(Math.floor(s / 3600)), p2(Math.floor(s % 3600 / 60)), p2(s % 60)]; }
export function dur(ms: number, short?: boolean | 1) {
  ms = Math.max(0, Math.round(ms / M) * M); const h = Math.floor(ms / H), m = Math.round(ms % H / M);
  if (short) return h ? `${h} h ${p2(m)} m` : `${m} m`;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
export const hDec = (ms: number) => (ms / H).toFixed(2).replace('.', ',');
export const hNum = (h: number) => String(+h.toFixed(2)).replace('.', ',');
export const isHM = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
export const fmtLong = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDM = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
export const fmtWD = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
export const fmtMY = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
export const fmtDate = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
export const fmtWDM = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

const ZONE = 'America/Bogota';
const fmtTime = new Intl.DateTimeFormat('es-CO', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

/** Partes de la hora en Bogotá: "08", "39", "12", "a. m." */
export function bogotaParts(t: number) {
  const p = Object.fromEntries(fmtTime.formatToParts(t).map(x => [x.type, x.value]));
  const ap = (p.dayPeriod || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return { h: p.hour, m: p.minute, s: p.second, ap: ap.startsWith('p') ? 'p. m.' : 'a. m.' };
}

