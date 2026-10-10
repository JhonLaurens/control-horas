import { useEffect, useId, useRef, useState } from 'react';
import { H, cap, dur, hNum } from '../lib/time';

export interface ChartDay { v: number; ord: number; ext: number; goal: number; l: string; s: string; full: string; today: boolean; off: boolean; fest: string | null }

function rtop(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null); const [size, setSize] = useState({ w: 600, h: 280 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 600, h: el.clientHeight || 280 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Barras apiladas ordinarias + extra con meta diaria y fondo para festivos / días no laborales. */
export function BarChart({ days, animKey, id }: { days: ChartDay[]; animKey: string; id?: string }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const gid = 'bg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = Math.max(300, w), Hh = h, pl = 34, pr = 8, pt = 18, pb = 44;
  const max = Math.max(...days.map(d => Math.max(d.goal * 1.2, d.v)), 1); const step = max > 16 ? 4 : max > 8 ? 2 : 1; const top = Math.ceil(max / step) * step;
  const iw = W - pl - pr, ih = Hh - pt - pb, n = days.length, cw = iw / n, bw = Math.min(46, cw * .62); const y = (v: number) => pt + ih - (v / top) * ih;
  const grid = []; for (let v = 0; v <= top; v += step) grid.push(v);
  const d = tip ? days[tip.i] : null;
  return (
    <div className="chart" ref={ref} id={id}>
      <svg key={animKey} viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Gráfico de horas por día">
        <defs><linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1={pt + ih} x2="0" y2={pt}><stop offset="0" stopColor="var(--acc)" /><stop offset="1" stopColor="var(--acc2)" /></linearGradient></defs>
        {grid.map(v => <g key={v}><line className="gl" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text className="ax" x={pl - 8} y={y(v) + 4} textAnchor="end">{v}h</text></g>)}
        {days.map((d, i) => {
          const x = pl + i * cw + (cw - bw) / 2, cx = pl + i * cw; const r = Math.min(6, bw / 3);
          const hb = d.ord > 0 ? Math.max(2, (d.ord / top) * ih) : 0, he = d.ext > 0 ? Math.max(2, (d.ext / top) * ih) : 0;
          const delay = (i * (n > 10 ? 15 : 50)) + 'ms';
          return (
            <g key={i} className={'col' + (d.today ? ' today' : '')}
              onMouseMove={e => { const rc = ref.current!.getBoundingClientRect(); setTip({ i, x: e.clientX - rc.left, y: e.clientY - rc.top }); }}
              onMouseLeave={() => setTip(null)}>
              {d.fest ? <rect className="festbg" x={cx + 1} y={pt} width={cw - 2} height={ih} rx="6" /> : d.off ? <rect className="offbg" x={cx + 1} y={pt} width={cw - 2} height={ih} rx="6" /> : null}
              <rect className="hover" x={cx} y={pt} width={cw} height={ih} rx="6" />
              {hb > 0 && <path className="b" d={rtop(x, y(d.ord), bw, hb, he ? 0 : r)} fill={`url(#${gid})`} style={{ animationDelay: delay }} />}
              {he > 0 && <path className="b" d={rtop(x, y(d.ord + d.ext), bw, he + (hb ? 1 : 0), r)} fill="var(--warn)" style={{ animationDelay: delay }} />}
              {d.goal > 0 && <line className="dgoal" x1={x - 4} x2={x + bw + 4} y1={y(d.goal)} y2={y(d.goal)} />}
              {d.v > 0 && n <= 10 && <text className="ax" x={x + bw / 2} y={y(d.v) - 7} textAnchor="middle" style={{ fill: 'var(--fg2)', fontWeight: 600 }}>{d.v.toFixed(1).replace('.', ',')}</text>}
              {d.l !== '' && <text className="axd" x={x + bw / 2} y={Hh - pb + 18} textAnchor="middle">{d.l}</text>}
              {d.fest && n <= 10 ? <text className="festtx" x={x + bw / 2} y={Hh - pb + 33} textAnchor="middle">Festivo</text> : d.s ? <text className="ax" x={x + bw / 2} y={Hh - pb + 33} textAnchor="middle">{d.s}</text> : null}
              {d.fest && n > 10 && <circle cx={x + bw / 2} cy={Hh - pb + 30} r="2.5" fill="var(--warn)" />}
            </g>
          );
        })}
      </svg>
      <div className={'tip' + (tip ? ' on' : '')} style={tip ? { left: tip.x, top: tip.y } : undefined}>
        {d && <>
          <div style={{ color: 'var(--fg2)' }}>{cap(d.full)}</div>
          {d.fest ? <div style={{ color: 'var(--warn)', fontWeight: 600 }}>Festivo: {d.fest}</div> : d.off ? <div style={{ color: 'var(--fg3)' }}>Día no laboral</div> : null}
          <b>{dur(d.v * H, 1)}</b>{d.ext > 0 && <span style={{ color: 'var(--warn)' }}> · {dur(d.ext * H, 1)} extra</span>}
          {d.goal > 0 && <div style={{ color: 'var(--fg3)' }}>Meta {hNum(d.goal)} h · ordinarias {dur(d.ord * H, 1)}</div>}
        </>}
      </div>
    </div>
  );
}
