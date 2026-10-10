import { ymd } from './time';

/** Festivos de Colombia (Ley 51 de 1983 / Ley Emiliani + festivos basados en la Pascua). */
export interface Holiday { date: string; name: string }

export function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
function nextMonday(dt: Date) { const d = new Date(dt); d.setDate(d.getDate() + ((8 - d.getDay()) % 7)); return d; }

const cache = new Map<number, { list: Holiday[]; map: Map<string, string> }>();
export function holidays(y: number) {
  const hit = cache.get(y); if (hit) return hit;
  const list: Holiday[] = []; const add = (d: Date, name: string) => list.push({ date: ymd(d.getTime()), name });
  ([[1, 1, 'Año Nuevo'], [5, 1, 'Día del Trabajo'], [7, 20, 'Día de la Independencia'], [8, 7, 'Batalla de Boyacá'], [12, 8, 'Inmaculada Concepción'], [12, 25, 'Navidad']] as const)
    .forEach(([m, d, n]) => add(new Date(y, m - 1, d), n));
  ([[1, 6, 'Día de los Reyes Magos'], [3, 19, 'Día de San José'], [6, 29, 'San Pedro y San Pablo'], [8, 15, 'Asunción de la Virgen'], [10, 12, 'Día de la Raza'], [11, 1, 'Todos los Santos'], [11, 11, 'Independencia de Cartagena']] as const)
    .forEach(([m, d, n]) => add(nextMonday(new Date(y, m - 1, d)), n));
  const E = easter(y); const ed = (n: number) => { const d = new Date(E); d.setDate(d.getDate() + n); return d; };
  add(ed(-3), 'Jueves Santo'); add(ed(-2), 'Viernes Santo'); add(ed(43), 'Ascensión del Señor'); add(ed(64), 'Corpus Christi'); add(ed(71), 'Sagrado Corazón');
  const map = new Map<string, string>();
  for (const h of list) map.set(h.date, map.has(h.date) ? map.get(h.date) + ' / ' + h.name : h.name);
  const sorted = [...map].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, name]) => ({ date, name }));
  const res = { list: sorted, map }; cache.set(y, res); return res;
}
export function holidayName(t: number) { return holidays(new Date(t).getFullYear()).map.get(ymd(t)) || null; }
export function nextHoliday(t: number) {
  const k = ymd(t), y = new Date(t).getFullYear();
  for (const yy of [y, y + 1]) for (const h of holidays(yy).list) if (h.date >= k) return h;
  return null;
}
