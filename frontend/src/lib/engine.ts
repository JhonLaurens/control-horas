import type { CatKey, Session, Settings } from './types';
import { H, M, addDays, atMin, sod, tmin, dur } from './time';
import { holidayName } from './holidays';

/**
 * Motor de clasificación (mismo algoritmo que el backend: co.jhonjara.controlhoras.engine.HourClassifier).
 * Se usa para el cronómetro en vivo y las vistas; ambos lados se validan con shared/classification-vectors.json.
 */
export const ORD_CATS: [CatKey, string][] = [['oD', 'Ordinaria diurna'], ['oN', 'Ordinaria nocturna']];
export const CATS: [CatKey, string][] = [['eD', 'Extra diurna'], ['eN', 'Extra nocturna'], ['fD', 'Dominical/festivo diurna'], ['fN', 'Dominical/festivo nocturna'], ['sD', 'Sábado/descanso diurna'], ['sN', 'Sábado/descanso nocturna']];
export const ALL_CATS = [...ORD_CATS, ...CATS];
export const CAT_LABEL = Object.fromEntries(ALL_CATS) as Record<CatKey, string>;
export const SHORT: Record<CatKey, string> = { oD: 'Ord. diurna', oN: 'Ord. nocturna', eD: 'Ext. diurna', eN: 'Ext. nocturna', fD: 'Dom/fest diurna', fN: 'Dom/fest nocturna', sD: 'Sáb/desc diurna', sN: 'Sáb/desc nocturna' };
const KEYS = ['work', ...ALL_CATS.map(c => c[0])] as const;
type Key = typeof KEYS[number];

export type Totals = Record<Key, number> & { ord: number; extra: number; sab: number; df: number };
export interface DayInfo { d0: number; dow: number; fest: string | null; working: boolean; kind: 'fest' | 'lab' | 'dom' | 'sab' | 'desc'; goal: number; label: string }
export interface DayBreak extends Totals { d0: number; info: DayInfo; goal: number; pause: number; lunchOver: number; per: Record<string, Totals> }
export interface RangeBreak extends Totals { goal: number; pause: number; days: DayBreak[] }

export const LAW_2466 = new Date(2025, 11, 25).getTime();
/** Ley 2466 de 2025: nocturno 19:00-06:00 desde el 25-dic-2025; antes, Ley 1846 de 2017: 21:00-06:00. */
export function legalNightStart(d0: number) { return d0 >= LAW_2466 ? '19:00' : '21:00'; }

function zero(): Totals { const z: Record<string, number> = {}; for (const k of KEYS) z[k] = 0; return fin(z as Totals); }
function fin<T extends Totals>(T: T): T { T.ord = T.oD + T.oN; T.extra = T.eD + T.eN + T.fD + T.fN + T.sD + T.sN; T.sab = T.sD + T.sN; T.df = T.fD + T.fN; return T; }
function overlap(a: number, b: number, c: number, d: number) { return Math.max(0, Math.min(b, d) - Math.max(a, c)); }
export function openPause(s: Session | null) { const p = s?.pauses[s.pauses.length - 1]; return p && p.end == null ? p : null; }

export class Engine {
  private memo = new Map<number, DayBreak>();
  readonly all: Session[];
  constructor(readonly settings: Settings, sessions: Session[], readonly active: Session | null, readonly now: number) {
    this.all = active ? [...sessions, active] : sessions;
  }
  lunchMs() { return Math.max(0, +this.settings.lunch || 0) * M; }
  dailyGoalMs() { return Math.max(0, (tmin(this.settings.schedEnd) - tmin(this.settings.schedStart)) * M - this.lunchMs()); }
  weeklyGoalMs() { return this.dailyGoalMs() * this.settings.workdays.length; }
  nightStartFor(d0: number) { return this.settings.nightStart || legalNightStart(d0); }
  nightEndMin() { return tmin(this.settings.nightEnd || '06:00'); }
  dayInfo(d0: number): DayInfo {
    const dow = new Date(d0).getDay(), fest = holidayName(d0); const working = !fest && this.settings.workdays.includes(dow);
    const kind = fest ? 'fest' : working ? 'lab' : dow === 0 ? 'dom' : dow === 6 ? 'sab' : 'desc';
    return { d0, dow, fest, working, kind, goal: working ? this.dailyGoalMs() : 0,
      label: fest ? 'Festivo · ' + fest : kind === 'dom' ? 'Domingo · día no laboral' : kind === 'sab' ? 'Sábado · día no laboral' : kind === 'desc' ? 'Día de descanso' : 'Día laboral' };
  }
  sEnd(s: Session) { return s.end ?? this.now; }
  pauseIn(s: Session, from = -Infinity, to = Infinity) {
    const e = this.sEnd(s); let t = 0;
    for (const p of s.pauses || []) t += overlap(Math.max(p.start, s.start), Math.min(p.end ?? e, e), from, to);
    return t;
  }
  workIn(s: Session, from = -Infinity, to = Infinity) { return Math.max(0, overlap(s.start, this.sEnd(s), from, to) - this.pauseIn(s, from, to)); }
  workInts(s: Session): [number, number][] {
    const e = this.sEnd(s); let cur = s.start; const out: [number, number][] = [];
    const ps = (s.pauses || []).map(p => [Math.max(p.start, s.start), Math.min(p.end ?? e, e)] as [number, number]).filter(p => p[1] > p[0]).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of ps) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
    if (e > cur) out.push([cur, e]);
    return out;
  }
  sessionsIn(from: number, to: number) { return this.all.filter(s => s.start < to && this.sEnd(s) > from).sort((a, b) => a.start - b.start); }
  nightWin(d0: number): [number, number][] { const d1 = addDays(d0, 1); return [[d0, atMin(d0, this.nightEndMin())], [atMin(d0, tmin(this.nightStartFor(d0))), d1]]; }
  isNight(t: number) { return this.nightWin(sod(t)).some(([a, b]) => t >= a && t < b); }

  dayBreak(d0: number): DayBreak {
    const hit = this.memo.get(d0); if (hit) return hit;
    const d1 = addDays(d0, 1), info = this.dayInfo(d0), goal = info.goal, st = this.settings;
    const W = [atMin(d0, tmin(st.schedStart)), atMin(d0, tmin(st.schedEnd))]; const N = this.nightWin(d0);
    const ovN = (a: number, b: number) => N.reduce((x, n) => x + overlap(a, b, n[0], n[1]), 0);
    const split = (P: Totals, k: 'o' | 'e' | 'f' | 's', a: number, b: number) => { if (b <= a) return; const n = ovN(a, b); P[(k + 'N') as CatKey] += n; P[(k + 'D') as CatKey] += b - a - n; };
    const R = { ...zero(), d0, info, goal, pause: 0, lunchOver: 0, per: {} as Record<string, Totals> } as DayBreak;
    const pieces: { s: Session; a: number; b: number }[] = [];
    for (const s of this.sessionsIn(d0, d1)) {
      R.per[s.id] = zero(); R.pause += this.pauseIn(s, d0, d1);
      for (const [a, b] of this.workInts(s)) { const x = Math.max(a, d0), y = Math.min(b, d1); if (y > x) pieces.push({ s, a: x, b: y }); }
    }
    pieces.sort((p, q) => p.a - q.a); let used = 0;
    for (const { s, a, b } of pieces) {
      const P = R.per[s.id]; P.work += b - a;
      if (!info.working) { split(P, info.kind === 'fest' || info.kind === 'dom' ? 'f' : 's', a, b); continue; }
      if (s.extra) { split(P, 'e', a, b); continue; }
      const w0 = Math.max(a, W[0]), w1 = Math.min(b, W[1]);
      if (w1 > w0) { const take = Math.min(w1 - w0, Math.max(0, goal - used)); used += take; split(P, 'o', w0, w0 + take); split(P, 'e', w0 + take, w1); }
      split(P, 'e', a, Math.min(b, W[0])); split(P, 'e', Math.max(a, W[1]), b);
    }
    for (const id in R.per) { fin(R.per[id]); for (const k of KEYS) R[k] += R.per[id][k]; }
    fin(R); if (info.working) R.lunchOver = Math.max(0, R.pause - this.lunchMs());
    this.memo.set(d0, R); return R;
  }
  rangeBreak(from: number, to: number): RangeBreak {
    const T = { ...zero(), goal: 0, pause: 0, days: [] as DayBreak[] } as RangeBreak;
    for (let d = sod(from); d < to; d = addDays(d, 1)) { const b = this.dayBreak(d); T.days.push(b); for (const k of KEYS) T[k] += b[k]; T.goal += b.goal; T.pause += b.pause; }
    return fin(T);
  }
  sessBreak(s: Session): Totals {
    const T = zero();
    for (let d = sod(s.start); d < this.sEnd(s); d = addDays(d, 1)) { const p = this.dayBreak(d).per[s.id]; if (p) for (const k of KEYS) T[k] += p[k]; }
    return fin(T);
  }
  /** Categoría del tiempo que corre ahora mismo en la jornada activa. */
  classNow(t: number) {
    const a = this.active; if (!a) return null;
    const d0 = sod(t), info = this.dayInfo(d0); const n = this.isNight(t) ? 'N' : 'D'; let k: string;
    if (!info.working) k = (info.kind === 'fest' || info.kind === 'dom' ? 'f' : 's') + n;
    else if (a.extra) k = 'e' + n;
    else {
      const inW = t >= atMin(d0, tmin(this.settings.schedStart)) && t < atMin(d0, tmin(this.settings.schedEnd));
      k = (inW && this.dayBreak(d0).ord < this.dailyGoalMs() ? 'o' : 'e') + n;
    }
    return { x: k[0] !== 'o', k: k as CatKey, l: CAT_LABEL[k as CatKey] };
  }
}

export function typeList(b: Totals): [string, string, number][] {
  const out: [string, string, number][] = [];
  for (const [k, l] of ORD_CATS) if (b[k] >= M) out.push([l, '', b[k]]);
  for (const [k, l] of CATS) if (b[k] >= M) out.push([l, 'x', b[k]]);
  return out;
}
export function extraHint(b: Totals) {
  const parts = CATS.filter(([k]) => b[k] >= M).map(([k]) => `${SHORT[k]} ${dur(b[k], 1)}`);
  return parts.length ? parts.join(' · ') : 'Sin horas extra';
}
export { H, M };
