import { ALL_CATS, CATS, ORD_CATS, typeList, type Totals } from '../lib/engine';
import { H, M, dur, hDec, p2 } from '../lib/time';
import type { Engine } from '../lib/engine';
import type { ReactNode } from 'react';

/** Número grande "8h 30m" con unidades pequeñas. */
export function Big({ ms, suffix }: { ms: number; suffix?: ReactNode }) {
  ms = Math.max(0, ms); const h = Math.floor(ms / H), m = Math.floor(ms % H / M);
  return <>{h ? <>{h}<small>h</small> {p2(m)}<small>m</small></> : <>{m}<small>m</small></>}{suffix}</>;
}

export function TypeChips({ b, amt }: { b: Totals; amt?: boolean }) {
  return <>{typeList(b).map(([l, x, v]) => <span key={l} className={`typ ${x}`} title={`${l}: ${dur(v, 1)}`}>{l}{amt ? ' ' + dur(v, 1) : ''}</span>)}</>;
}

export interface KpiItem { l: string; v: ReactNode; h?: ReactNode; c: string; bar?: number }
export function Kpis({ items, id }: { items: KpiItem[]; id?: string }) {
  return (
    <div className="kpis k4" id={id}>
      {items.map(k => (
        <div className="kpi" key={k.l} style={{ ['--c' as string]: k.c }}>
          <div className="l"><i />{k.l}</div>
          <div className="v">{k.v}</div>
          {k.bar != null && <div className="bar"><b style={{ width: Math.min(100, Math.max(0, k.bar)) + '%' }} /></div>}
          {k.h != null && <div className="h">{k.h}</div>}
        </div>
      ))}
    </div>
  );
}

/** Desglose por las 8 categorías. */
export function ExtBreak({ T, id }: { T: Totals; id?: string }) {
  const tot = T.work;
  if (tot < M) return <div className="tags" id={id}><div className="empty">Sin horas registradas en este periodo</div></div>;
  const row = ([k, l]: (typeof ALL_CATS)[number], x: boolean) => (
    <div className="tagrow" key={k}>
      <div className="tt"><span>{l}</span><span>{dur(T[k], 1)}{T[k] >= M ? ' · ' + Math.round(T[k] / tot * 100) + '%' : ''}</span></div>
      <div className={'bar' + (x ? ' xbar' : '')} style={{ marginTop: 6 }}><b style={{ width: T[k] / tot * 100 + '%' }} /></div>
    </div>
  );
  return (
    <div className="tags" id={id}>
      {ORD_CATS.map(c => row(c, false))}
      <div className="tagrow"><div className="tt" style={{ fontWeight: 650 }}><span>Total ordinarias</span><span>{dur(T.ord, 1)}</span></div></div>
      {CATS.map(c => row(c, true))}
      <div className="tagrow"><div className="tt" style={{ fontWeight: 650 }}><span>Total horas extra</span><span style={{ color: 'var(--warn)' }}>{dur(T.extra, 1)} · {hDec(T.extra)} h</span></div></div>
    </div>
  );
}

export function TagBreak({ eng, from, to, id }: { eng: Engine; from: number; to: number; id?: string }) {
  const m = new Map<string, number>(); let tot = 0;
  for (const s of eng.sessionsIn(from, to)) { const w = eng.workIn(s, from, to); const k = s.tag || 'Sin proyecto'; m.set(k, (m.get(k) || 0) + w); tot += w; }
  const arr = [...m].sort((a, b) => b[1] - a[1]);
  return (
    <div className="tags" id={id}>
      {arr.length && tot ? arr.map(([k, v]) => (
        <div className="tagrow" key={k}>
          <div className="tt"><span>{k}</span><span>{dur(v, 1)} · {Math.round(v / tot * 100)}%</span></div>
          <div className="bar" style={{ marginTop: 6 }}><b style={{ width: v / tot * 100 + '%' }} /></div>
        </div>
      )) : <div className="empty">Sin datos en este periodo</div>}
    </div>
  );
}
