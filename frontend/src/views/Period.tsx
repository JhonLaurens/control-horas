import { useStore } from '../lib/store';
import { type DayBreak, type Engine } from '../lib/engine';
import { holidays } from '../lib/holidays';
import { H, M, addDays, cap, dur, fmtDM, fmtLong, fmtMY, fmtWD, fmtWDM, parseLocal, sod, som, sow, ymd } from '../lib/time';
import { Icon } from '../components/icons';
import { BarChart, type ChartDay } from '../components/BarChart';
import { Big, ExtBreak, Kpis, TagBreak } from '../components/common';

function chartDay(b: DayBreak, t: number, l: string, s: string): ChartDay {
  return { v: b.work / H, ord: b.ord / H, ext: b.extra / H, goal: b.goal / H, l, s, full: fmtLong.format(b.d0), today: b.d0 === sod(t), off: !b.info.working, fest: b.info.fest };
}

function Nav({ label, onShift, reset }: { label: string; onShift: (n: number) => void; reset: string }) {
  return (
    <div className="top" style={{ marginBottom: 16 }}>
      <div className="navr">
        <button className="ibtn" aria-label="Anterior" data-shift="-1" onClick={() => onShift(-1)}>{Icon.left}</button>
        <span className="lbl">{label}</span>
        <button className="ibtn" aria-label="Siguiente" data-shift="1" onClick={() => onShift(1)}>{Icon.right}</button>
        <button className="btn sm ghost" data-shift="0" onClick={() => onShift(0)}>{reset}</button>
      </div>
    </div>
  );
}

const legend = (fest?: boolean) => (
  <span className="legend">
    <span><i style={{ background: 'var(--warn)' }} />Horas extra</span>
    {fest && <span><i style={{ background: 'color-mix(in srgb,var(--warn) 25%,transparent)' }} />Festivo</span>}
  </span>
);

export function WeekView() {
  const { eng, now: t, weekOff, setWeekOff } = useStore();
  const w0 = addDays(sow(t), weekOff * 7), w1 = addDays(w0, 7); const T = eng.rangeBreak(w0, w1);
  const days = T.days.map(b => chartDay(b, t, cap(fmtWD.format(b.d0).replace('.', '')), String(new Date(b.d0).getDate())));
  const nf = T.days.filter(b => b.info.fest).length, withRec = T.days.filter(b => b.work > 0).length;
  return (
    <section className="view on" id="v-semana" aria-label="Semana">
      <Nav label={`${fmtDM.format(w0)} – ${fmtDM.format(addDays(w0, 6))} ${new Date(addDays(w0, 6)).getFullYear()}`} reset="Esta semana" onShift={n => setWeekOff(n ? weekOff + n : 0)} />
      <Kpis id="wKpis" items={[
        { l: 'Horas extra semana', v: <Big ms={T.extra} suffix={<small>/ 12 h</small>} />, bar: T.extra / (12 * H) * 100, h: `Límite legal 12 h/semana · ${withRec} día${withRec === 1 ? '' : 's'} con extras`, c: 'var(--warn)' },
        { l: 'Extra diurna / nocturna', v: <><Big ms={T.eD} /> <small>/</small> <Big ms={T.eN} /></>, h: 'Días hábiles fuera del horario', c: 'var(--acc)' },
        { l: 'Dominical / festivo', v: <Big ms={T.df} />, h: `Diurna ${dur(T.fD, 1)} · nocturna ${dur(T.fN, 1)}${nf ? ` · ${nf} festivo${nf > 1 ? 's' : ''}` : ''}`, c: '#06b6d4' },
        { l: 'Sábado / descanso', v: <Big ms={T.sab} />, h: `Diurna ${dur(T.sD, 1)} · nocturna ${dur(T.sN, 1)}`, c: 'var(--ok)' },
      ]} />
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 18, alignItems: 'start' }} id="wGrid">
        <div className="card"><h2>Horas por día<span className="sp" />{legend()}</h2><BarChart id="wChart" days={days} animKey={'w' + w0} /></div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card"><h2>Horas por categoría</h2><ExtBreak id="wExt" T={T} /></div>
          <div className="card"><h2>Por proyecto</h2><TagBreak id="wTags" eng={eng} from={w0} to={w1} /></div>
        </div>
      </div>
    </section>
  );
}

function Heat({ eng, days, m0, today }: { eng: Engine; days: DayBreak[]; m0: number; today: number }) {
  const g = eng.dailyGoalMs() || H; const lead = (new Date(m0).getDay() + 6) % 7;
  return (
    <div className="heat" id="mHeat">
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <div className="hd" key={'h' + i}>{x}</div>)}
      {Array.from({ length: lead }, (_, i) => <div className="c x" key={'x' + i} />)}
      {days.map(b => {
        const k = Math.min(1, b.work / g);
        const bg = b.work && b.info.working ? `color-mix(in srgb,var(--acc) ${Math.round(18 + k * 72)}%,transparent)` : b.work ? `color-mix(in srgb,var(--warn) ${Math.round(25 + k * 55)}%,transparent)` : undefined;
        const cls = b.info.fest ? ' fest' : !b.info.working ? ' off' : '';
        return (
          <div key={b.d0} className={'c' + cls + (b.d0 === today ? ' td' : '')}
            style={{ background: bg, boxShadow: b.info.working && b.extra >= 15 * M ? 'inset 0 0 0 2px var(--warn)' : undefined, color: k > .6 ? '#fff' : undefined }}
            title={`${cap(fmtLong.format(b.d0))}${b.info.fest ? ' · Festivo: ' + b.info.fest : !b.info.working ? ' · No laboral' : ''}: ${dur(b.work, 1)}${b.extra >= M ? ' (' + dur(b.extra, 1) + ' extra)' : ''}`}>
            {b.info.fest ? <span className="hn">{b.info.fest}</span> : <span />}<span>{new Date(b.d0).getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthView() {
  const { eng, now: t, monthOff, setMonthOff } = useStore();
  const d = new Date(som(t)); d.setMonth(d.getMonth() + monthOff); const m0 = d.getTime(); const m1 = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const T = eng.rangeBreak(m0, m1); const days = T.days.map(b => { const dt = new Date(b.d0).getDate(); return chartDay(b, t, dt % 2 === 1 ? String(dt) : '', ''); });
  const today = sod(t); const nf = T.days.filter(b => b.info.fest).length, withRec = T.days.filter(b => b.work > 0).length;
  const mk = ymd(m0).slice(0, 7); const fl = holidays(new Date(m0).getFullYear()).list.filter(h => h.date.startsWith(mk));
  return (
    <section className="view on" id="v-mes" aria-label="Mes">
      <Nav label={cap(fmtMY.format(m0))} reset="Este mes" onShift={n => setMonthOff(n ? monthOff + n : 0)} />
      <Kpis id="mKpis" items={[
        { l: 'Horas extra mes', v: <Big ms={T.extra} />, h: `${withRec} días con extras · promedio ${dur(withRec ? T.extra / withRec : 0, 1)}`, c: 'var(--warn)' },
        { l: 'Extra diurna / nocturna', v: <><Big ms={T.eD} /> <small>/</small> <Big ms={T.eN} /></>, h: 'Días hábiles fuera del horario', c: 'var(--acc)' },
        { l: 'Dominical / festivo', v: <Big ms={T.df} />, h: `Diurna ${dur(T.fD, 1)} · nocturna ${dur(T.fN, 1)}${nf ? ` · ${nf} festivo${nf > 1 ? 's' : ''}` : ''}`, c: '#06b6d4' },
        { l: 'Sábado / descanso', v: <Big ms={T.sab} />, h: `Diurna ${dur(T.sD, 1)} · nocturna ${dur(T.sN, 1)}`, c: 'var(--ok)' },
      ]} />
      <div className="card" style={{ marginTop: 18 }}><h2>Horas por día<span className="sp" />{legend(true)}</h2><BarChart id="mChart" days={days} animKey={'m' + m0} /></div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }} id="mGrid">
        <div className="card"><h2>Calendario del mes<span className="sp" /><span className="legend"><span><i style={{ border: '1px dashed var(--warn)' }} />Festivo</span><span><i style={{ border: '1px dashed var(--fg3)' }} />No laboral</span></span></h2><Heat eng={eng} days={T.days} m0={m0} today={today} /></div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card"><h2>Horas por categoría</h2><ExtBreak id="mExt" T={T} /></div>
          <div className="card"><h2>Festivos del mes</h2>
            <div className="hlist" id="mFest">{fl.length ? fl.map(h => { const dd = parseLocal(h.date, '00:00'); return <div key={h.date} className={'hi' + (dd < today ? ' past' : '')}><span>{cap(fmtWDM.format(dd))}</span><span>{h.name}</span></div>; }) : <div className="empty">No hay festivos este mes</div>}</div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}><h2>Por proyecto</h2><TagBreak id="mTags" eng={eng} from={m0} to={m1} /></div>
    </section>
  );
}
