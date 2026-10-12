import { useStore } from '../lib/store';
import { extraHint, openPause } from '../lib/engine';
import { H, M, addDays, atMin, dur, hNum, hm, hms, p2, sod, sow, tmin } from '../lib/time';
import { Icon } from '../components/icons';
import { Big } from '../components/common';
import { SessionRow } from '../components/SessionRow';

const C1 = 2 * Math.PI * 128, C2 = 2 * Math.PI * 108;

export function Notice() {
  const { eng, now: t, state } = useStore();
  const a = state.active; const st = state.settings; const d0 = sod(t); const info = eng.dayInfo(d0); const B = eng.dayBreak(d0);
  const paused = openPause(a); const cn = paused ? null : eng.classNow(t); const endT = atMin(d0, tmin(st.schedEnd)); const goal = info.goal;
  let note: React.ReactNode = null;
  if (a && !info.working) note = <><b>{info.fest ? 'Hoy es festivo (' + info.fest + ')' : info.kind === 'sab' ? 'Hoy es sábado' : 'Hoy no es día laboral'}.</b> Todo el tiempo trabajado cuenta como hora extra {info.kind === 'sab' || info.kind === 'desc' ? 'de sábado/descanso' : 'dominical/festiva'} (diurna hasta las {eng.nightStartFor(d0)}, nocturna después).</>;
  else if (a && t >= endT) note = <><b>Ya pasaste tu hora de salida ({st.schedEnd}).</b> Desde ahora cuenta como hora extra ({cn ? cn.l.toLowerCase() : 'extra'}; nocturna desde las {eng.nightStartFor(d0)}).</>;
  else if (a && t < atMin(d0, tmin(st.schedStart))) note = <><b>Aún no es tu hora de entrada ({st.schedStart}).</b> Este tiempo cuenta como hora extra.</>;
  else if (a && B.ord >= goal && !a.extra) note = <><b>Ya cumpliste tu jornada ordinaria de {hNum(goal / H)} h.</b> El tiempo adicional cuenta como hora extra.</>;
  else if (a && a.extra) note = <>Esta sesión está marcada manualmente como <b>horas extra</b>.</>;
  if (!note) return null;
  return <div className="notice" id="notice" role="status">{Icon.notice}<div>{note}</div></div>;
}

function Timeline() {
  const { eng, now: t, state } = useStore();
  const st = state.settings; const d0 = sod(t), d1 = addDays(d0, 1); const ss = eng.sessionsIn(d0, d1);
  let from = Math.min(6, Math.floor(tmin(st.schedStart) / 60)), to = Math.max(20, Math.ceil(tmin(st.schedEnd) / 60) + 1);
  for (const s of ss) { from = Math.min(from, Math.floor((Math.max(s.start, d0) - d0) / H)); to = Math.max(to, Math.ceil((Math.min(eng.sEnd(s), d1) - d0) / H)); }
  to = Math.min(24, Math.max(to, from + 4));
  const A = d0 + from * H, span = (to - from) * H, pc = (x: number) => ((Math.min(Math.max(x, A), A + span) - A) / span * 100);
  const info = eng.dayInfo(d0); const ws = atMin(d0, tmin(st.schedStart)), we = atMin(d0, tmin(st.schedEnd));
  const segs: React.ReactNode[] = [];
  if (info.working) segs.push(<div key="w" className="tl-seg" style={{ left: pc(ws) + '%', width: (pc(we) - pc(ws)) + '%', background: 'color-mix(in srgb,var(--fg) 7%,transparent)' }} title={`Horario ${st.schedStart} – ${st.schedEnd}`} />);
  for (const s of ss) {
    eng.workInts(s).forEach(([x, y], j) => {
      const a = Math.max(x, d0), b = Math.min(y, d1); if (b <= a) return;
      const allX = !info.working || s.extra;
      const parts: [number, number, number][] = allX ? [[a, b, 1]] : [[a, Math.min(b, ws), 1], [Math.max(a, ws), Math.min(b, we), 0], [Math.max(a, we), b, 1]];
      parts.forEach(([p, q, xx], k) => { if (q > p) segs.push(<div key={`${s.id}-${j}-${k}`} className="tl-seg" style={{ left: pc(p) + '%', width: (pc(q) - pc(p)) + '%', ...(xx ? { background: 'linear-gradient(90deg,var(--warn),#f97316)' } : {}) }} title={`${xx ? 'Extra' : 'Ordinaria'} ${hm(p)} – ${hm(q)}`} />); });
    });
    s.pauses.forEach((p, j) => { const pa = Math.max(p.start, d0), pb = Math.min(p.end ?? t, d1); if (pb > pa) segs.push(<div key={`${s.id}-p${j}`} className="tl-seg p" style={{ left: pc(pa) + '%', width: (pc(pb) - pc(pa)) + '%' }} title={`Pausa ${hm(p.start)} – ${p.end ? hm(p.end) : 'ahora'}`} />); });
  }
  const step = (to - from) > 12 ? 3 : 2; const ticks: number[] = []; for (let x = from; x <= to; x += step) ticks.push(x);
  return (
    <div className="tl" id="timeline">
      <div className="tl-track">{segs}</div>
      {t >= A && t <= A + span && <div className="tl-now" style={{ left: pc(t) + '%' }} />}
      <div className="tl-ticks">{ticks.map(x => <span key={x}>{p2(x)}:00</span>)}</div>
    </div>
  );
}

export function TodayView() {
  const { eng, now: t, state, draft, setDraft, actions } = useStore();
  const a = state.active; const st = state.settings; const paused = openPause(a);
  const d0 = sod(t), d1 = addDays(d0, 1); const B = eng.dayBreak(d0), info = B.info, goal = info.goal, ref = goal || eng.dailyGoalMs() || H;
  const cur = a ? eng.workIn(a) : 0; const [h, m, s] = hms(a ? cur : B.work);
  const pr = goal ? Math.min(1, B.ord / goal) : 0, ex = Math.min(1, B.extra / ref); const pct = goal ? Math.round(B.ord / goal * 100) : 0;
  const cn = paused ? null : eng.classNow(t); const endT = atMin(d0, tmin(st.schedEnd));
  let ordH = !info.working ? info.label : B.ord >= goal ? 'Jornada ordinaria cumplida' : t >= endT ? `Horario terminado · faltaron ${dur(goal - B.ord, 1)}`
    : a && !paused && cn && !cn.x ? `Completarías a las ${hm(Math.min(t + goal - B.ord, endT))}` : `Faltan ${dur(goal - B.ord, 1)} · salida ${st.schedEnd}`;
  if (B.oN >= M) ordH += ` · nocturna ${dur(B.oN, 1)}`;
  const np = eng.sessionsIn(d0, d1).reduce((n, x) => n + x.pauses.filter(p => (p.end ?? t) > d0 && p.start < d1).length, 0);
  const w0 = sow(t), WB = eng.rangeBreak(w0, addDays(w0, 7));
  const list = eng.sessionsIn(d0, d1).reverse();
  const tags = [...new Set(eng.all.map(x => x.tag).filter(Boolean))];

  return (
    <section className="view on" id="v-hoy" aria-label="Hoy">
      <div className="grid g-hero">
        <div className="card hero">
          <div className="ringwrap">
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <defs>
                <linearGradient id="rg" gradientUnits="userSpaceOnUse" x1="22" y1="22" x2="278" y2="278"><stop offset="0" stopColor={cn?.x ? 'var(--warn)' : 'var(--acc)'} /><stop offset="1" stopColor={cn?.x ? '#f97316' : 'var(--acc2)'} /></linearGradient>
              </defs>
              <g transform="rotate(-90 150 150)">
                <circle className="ring-track" cx="150" cy="150" r="128" fill="none" strokeWidth="14" />
                <circle className="ring-prog" cx="150" cy="150" r="128" fill="none" stroke={pr >= 1 ? 'var(--ok)' : 'url(#rg)'} strokeWidth="14" strokeLinecap="round" strokeDasharray={C1} strokeDashoffset={C1 * (1 - Math.min(1, Math.max(0, pr)))} opacity={pr > 0 ? 1 : 0} />
                <circle className="ring-track" cx="150" cy="150" r="108" fill="none" strokeWidth="4" opacity=".55" />
                <circle className="ring-extra" cx="150" cy="150" r="108" fill="none" stroke="var(--warn)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C2} strokeDashoffset={C2 * (1 - Math.min(1, Math.max(0, ex)))} opacity={ex > 0 ? 1 : 0} />
              </g>
            </svg>
            <div className="ring-center">
              <div className="timer" id="timer"><span className="hm">{h}:{m}</span><span className="sec">:{s}</span></div>
              <div className="ring-sub" id="ringSub">
                {!info.working ? <>{info.fest ? 'Festivo' : 'Día no laboral'} · <b>{dur(B.extra, 1)}</b> extra</>
                  : a ? <>Ordinarias <b>{dur(B.ord, 1)}</b> · {pct}% de {hNum(goal / H)} h</>
                    : B.work ? `Hoy ${dur(B.work, 1)} · ${pct}% de la jornada` : `Jornada de hoy: ${hNum(goal / H)} h`}
              </div>
              <div className={'pausetimer' + (paused ? ' on' : '')}>{paused ? `Pausa actual ${hms(t - paused.start).join(':')}` : a ? `Sesión iniciada a las ${hm(a.start)}` : ''}</div>
            </div>
          </div>
          <div className="pills hero-pills">
              <span className={'pill ' + (a ? (paused ? 'pau' : 'run') : '')} id="statusPill"><i /><span>{a ? (paused ? 'En pausa' : 'En curso') : 'Detenido'}</span></span>
              {cn && <span className={'pill ' + (cn.x ? 'ext' : 'ord')} id="classPill"><i /><span>{cn.l}</span></span>}
            </div>
          <div className="controls" id="controls">
            {!a ? <button className="btn pri xl" id="bStart" title="Iniciar (Espacio)" onClick={actions.start}>{Icon.play}Iniciar</button> : <>
              <button className={'btn xl ' + (paused ? 'pri' : 'warn')} id="bPause" title={(paused ? 'Reanudar' : 'Pausar') + ' (P)'} onClick={actions.togglePause}>{paused ? <>{Icon.play}Reanudar</> : <>{Icon.pause}Pausar</>}</button>
              <button className="btn stop xl" id="bStop" title="Finalizar (Espacio)" onClick={actions.stop}>{Icon.stop}Finalizar</button>
            </>}
          </div>
          <Notice />
          <div className="meta">
            <input id="inNote" placeholder="¿En qué estás trabajando?" maxLength={200} aria-label="Nota de la sesión" value={draft.note}
              onChange={e => setDraft({ note: e.target.value })} onBlur={actions.syncMeta}
              onKeyDown={e => { if (e.key === 'Enter') { actions.syncMeta(); if (!a) actions.start(); (e.target as HTMLInputElement).blur(); } }} />
            <input id="inTag" placeholder="Proyecto" maxLength={40} list="tagList" style={{ maxWidth: 140 }} aria-label="Proyecto o etiqueta" value={draft.tag}
              onChange={e => setDraft({ tag: e.target.value })} onBlur={actions.syncMeta}
              onKeyDown={e => { if (e.key === 'Enter') { actions.syncMeta(); if (!a) actions.start(); (e.target as HTMLInputElement).blur(); } }} />
            <button className="chipbtn" id="inExtra" aria-pressed={draft.extra} title="Marcar toda la sesión como horas extra" onClick={actions.toggleExtra}><i />Extra</button>
            <datalist id="tagList">{tags.map(x => <option key={x} value={x} />)}</datalist>
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="kpis">
            <div className="kpi" style={{ ['--c' as string]: 'var(--acc)' }}><div className="l"><i />Ordinarias hoy</div><div className="v" id="kOrd"><Big ms={B.ord} suffix={goal ? <small>/ {hNum(goal / H)} h</small> : null} /></div><div className="h" id="kOrdH">{ordH}</div><div className="bar"><b style={{ width: (goal ? Math.min(100, B.ord / goal * 100) : 0) + '%' }} /></div></div>
            <div className="kpi" style={{ ['--c' as string]: 'var(--warn)' }}><div className="l"><i />Horas extra hoy</div><div className="v" id="kExt"><Big ms={B.extra} /></div><div className="h" id="kExtH">{extraHint(B)}</div></div>
            <div className="kpi" style={{ ['--c' as string]: 'var(--pause)' }}><div className="l"><i />Pausas / almuerzo</div><div className="v" id="kPause"><Big ms={B.pause} suffix={info.working && st.lunch ? <small>/ {st.lunch} m</small> : null} /></div>
              {B.lunchOver >= M ? <div className="h warn" id="kPauseH">Almuerzo excedido en {dur(B.lunchOver, 1)} (máx. {st.lunch} min)</div>
                : <div className="h" id="kPauseH">{np ? (info.working ? `${np} pausa${np > 1 ? 's' : ''} · dentro del almuerzo` : `${np} pausa${np > 1 ? 's' : ''}`) : 'Sin pausas'}</div>}
            </div>
            <div className="kpi" style={{ ['--c' as string]: '#06b6d4' }}><div className="l"><i />Esta semana</div><div className="v" id="kWeek"><Big ms={WB.work} suffix={<small>/ {hNum(WB.goal / H)} h</small>} /></div><div className="bar"><b style={{ width: (WB.goal ? Math.min(100, WB.ord / WB.goal * 100) : 0) + '%' }} /></div></div>
          </div>
          <div className="card">
            <h2>Línea de tiempo de hoy<span className="sp" /><span className="legend"><span><i style={{ background: 'linear-gradient(90deg,var(--acc),var(--acc2))' }} />Trabajo</span><span><i style={{ background: 'var(--warn)' }} />Extra</span><span><i style={{ background: 'repeating-linear-gradient(45deg,var(--pause) 0 3px,transparent 3px 6px)' }} />Pausa</span></span></h2>
            <Timeline />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Sesiones de hoy<span className="sp" /><span>{list.length ? `${list.length} sesi${list.length > 1 ? 'ones' : 'ón'}` : ''}</span></h2>
        <div className="list" id="todayList">
          {list.length ? list.map(x => <SessionRow key={x.id} s={x} />) : <div className="empty">{Icon.clock}<div>Aún no hay sesiones hoy. Pulsa <b>Iniciar</b> o la tecla <kbd>Espacio</kbd>.</div></div>}
        </div>
      </div>
    </section>
  );
}
