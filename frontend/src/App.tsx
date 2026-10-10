import { useEffect, useRef } from 'react';
import { useStore, VIEWS, type View } from './lib/store';
import { openPause } from './lib/engine';
import { H, M, addDays, atMin, cap, fmtLong, fmtWDM, hNum, hms, parseLocal, sod, tmin, ymd, dur } from './lib/time';
import { nextHoliday } from './lib/holidays';
import { Icon } from './components/icons';
import { useToast } from './components/Toasts';
import { SessionDialog } from './components/SessionDialog';
import { TodayView } from './views/Today';
import { MonthView, WeekView } from './views/Period';
import { HistoryView } from './views/History';
import { SettingsView } from './views/Settings';

const NAV: [View, string, JSX.Element][] = [['hoy', 'Hoy', Icon.navHoy], ['semana', 'Semana', Icon.navSemana], ['mes', 'Mes', Icon.navMes], ['historial', 'Historial', Icon.navHist], ['ajustes', 'Ajustes', Icon.navAjustes]];
const TITLES: Partial<Record<View, string>> = { semana: 'Resumen semanal', mes: 'Resumen mensual', historial: 'Historial', ajustes: 'Ajustes' };

function DayChips() {
  const { eng, now: t, state } = useStore(); const st = state.settings; const info = eng.dayInfo(sod(t)); const nh = nextHoliday(addDays(sod(t), 1));
  return (
    <div className="daychips" id="dayChips">
      {info.working ? <span className="chip"><i />Día laboral · {st.schedStart} – {st.schedEnd} · almuerzo {st.lunch} min</span>
        : <span className="chip fest"><i />{info.fest ? 'Hoy es festivo: ' + info.fest : info.kind === 'sab' ? 'Hoy es sábado' : info.kind === 'dom' ? 'Hoy es domingo' : 'Día de descanso'} · no laboral, todo cuenta como extra</span>}
      {nh && <span className="chip" style={{ ['--c' as string]: 'var(--warn)' }}><i />Próximo festivo: {fmtWDM.format(parseLocal(nh.date, '00:00'))} · {nh.name}</span>}
    </div>
  );
}

function SideStatus() {
  const { eng, now: t, state } = useStore(); const a = state.active; const paused = openPause(a);
  const B = eng.dayBreak(sod(t)); const [h, m, s] = hms(a ? eng.workIn(a) : B.work);
  return (
    <div className="side-status" id="sideStatus">
      <div>{a ? (paused ? 'En pausa' : 'Jornada en curso') : 'Sin jornada activa'}</div>
      <div className="t">{h}:{m}:{s}</div>
      <div style={{ marginTop: 6 }}>Hoy: {dur(B.work, 1)}{B.extra >= M && <> · <span style={{ color: 'var(--warn)' }}>{dur(B.extra, 1)} extra</span></>}</div>
    </div>
  );
}

export function App() {
  const store = useStore(); const toast = useToast();
  const { state, loaded, offline, now: t, eng, view, setView, actions, openEdit } = store;
  const st = state.settings; const a = state.active;

  // Título de la pestaña
  useEffect(() => {
    const paused = openPause(a); const cn = paused ? null : eng.classNow(t);
    const [h, m, s] = hms(a ? eng.workIn(a) : 0);
    document.title = a ? `${paused ? '❚❚ ' : '● '}${h}:${m}:${s}${cn && cn.x ? ' · Extra' : ''} · Control de Horas` : 'Control de Horas';
  }, [t, a, eng]);

  // Avisos: hora de salida y jornada cumplida (una vez por día)
  useEffect(() => {
    if (!a || !loaded) return;
    const d0 = sod(t), info = eng.dayInfo(d0), B = eng.dayBreak(d0), day = ymd(t);
    if (info.working && t >= atMin(d0, tmin(st.schedEnd)) && st.endNotified !== day) {
      actions.saveSettings({ endNotified: day }); toast('Ya pasaste tu hora de salida, desde ahora cuenta como hora extra', '', null, 7000);
    }
    if (info.working && B.ord >= info.goal && st.goalNotified !== day) {
      actions.saveSettings({ goalNotified: day }); toast(`Jornada ordinaria de ${hNum(info.goal / H)} h cumplida`, 'ok');
    }
  }, [t, a, eng, st, loaded, actions, toast]);

  // Atajos de teclado
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target as HTMLElement; const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable;
    if (typing || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); actions.startStop(); }
    else if (k === 'p') actions.togglePause();
    else if (k === 'x') actions.toggleExtra();
    else if (k === 'n') { e.preventDefault(); openEdit(); }
    else if (k === 't') actions.toggleTheme();
    else if (k === '?') actions.toggleHint();
    else if (k.length === 1 && '12345'.includes(k)) setView(VIEWS[+k - 1]);
  };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => keyRef.current(e);
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' && (e.target as HTMLElement).tagName === 'BUTTON' && !document.querySelector('dialog[open]')) e.preventDefault(); };
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    return () => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); };
  }, []);

  const hr = new Date(t).getHours();
  const title = TITLES[view] || (hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches');

  if (!loaded) return <div className="boot"><div className="spin" />Cargando…</div>;

  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="grain" aria-hidden="true" />
      {offline && <div className="offline" role="alert"><b>Sin conexión con el servidor.</b> {offline}. Verifica que los contenedores estén en ejecución (<code>docker compose ps</code>). <button className="btn sm" onClick={actions.refresh}>Reintentar</button></div>}
      <div className="app">
        <nav className="side" aria-label="Navegación principal">
          <div className="brand"><div className="logo">{Icon.logo}</div><div><b>Control de Horas</b><small>Tiempo de trabajo</small></div></div>
          {NAV.map(([v, l, ic], i) => <button key={v} className="nav" data-view={v} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>{ic}{l}<kbd>{i + 1}</kbd></button>)}
          <SideStatus />
        </nav>
        <main>
          <header className="top">
            <div><h1 id="greet">{title}</h1><div className="sub" id="today-date">{cap(fmtLong.format(t))}</div><DayChips /></div>
            <div className="sp" />
            <button className="btn" id="btnManual" title="Agregar sesión manual (N)" onClick={() => openEdit()}>{Icon.plus}Sesión manual</button>
            <button className="ibtn" id="btnTheme" title="Cambiar tema (T)" aria-label="Cambiar tema" onClick={actions.toggleTheme}>{st.theme === 'dark' ? Icon.sun : Icon.moon}</button>
            <button className="ibtn" id="btnKeys" title="Mostrar u ocultar atajos (?)" aria-label="Atajos de teclado" onClick={actions.toggleHint}>{Icon.keys}</button>
          </header>
          {view === 'hoy' && <TodayView />}
          {view === 'semana' && <WeekView />}
          {view === 'mes' && <MonthView />}
          {view === 'historial' && <HistoryView />}
          {view === 'ajustes' && <SettingsView />}
        </main>
      </div>
      {st.hint && <div className="hint" id="hint"><span><kbd>Espacio</kbd>Iniciar/Finalizar</span><span><kbd>P</kbd>Pausa</span><span><kbd>N</kbd>Manual</span><span><kbd>1-5</kbd>Vistas</span><span><kbd>?</kbd>Ocultar</span></div>}
      <SessionDialog />
    </>
  );
}
