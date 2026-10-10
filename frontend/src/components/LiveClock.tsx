import { useStore } from '../lib/store';
import { openPause } from '../lib/engine';
import { atMin, bogotaParts, cap, hms, sod, tmin } from '../lib/time';

const fmtDay = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Reloj en tiempo real del encabezado: hora de Colombia, fecha, categoría vigente y tiempo hasta la salida. */
export function LiveClock() {
  const { eng, now: t, state } = useStore();
  const st = state.settings; const a = state.active; const paused = openPause(a);
  const { h, m, s, ap } = bogotaParts(t);
  const d0 = sod(t), info = eng.dayInfo(d0);
  const ws = atMin(d0, tmin(st.schedStart)), we = atMin(d0, tmin(st.schedEnd));
  const cls = eng.classAt(t, !!a?.extra);
  const inSched = info.working && t >= ws && t < we;
  const left = inSched ? hms(we - t) : null;
  const night = cls.k.endsWith('N');
  return (
    <div className="clock" id="liveClock" role="timer" aria-live="off" aria-label={`Hora actual ${h}:${m}:${s} ${ap}`}>
      <div className="clock-main">
        <span className="clock-hm">{h}<span className="clock-colon">:</span>{m}</span>
        <span className="clock-sec" key={s}>{s}</span>
        <span className="clock-ap">{ap}</span>
      </div>
      <div className="clock-date">{cap(fmtDay.format(t))} · Bogotá</div>
      <div className="clock-meta">
        <span className={'clock-cat ' + (cls.x ? 'x' : 'o') + (night ? ' n' : '')} id="clockCat"
          title={a ? (paused ? 'Jornada en pausa: así se clasificaría el tiempo ahora' : 'Categoría del tiempo que estás registrando') : 'Así se clasificaría el trabajo en este momento'}>
          <i />{cls.l}
        </span>
        <span className={'clock-left' + (inSched ? '' : ' off')} id="clockLeft">
          {inSched && left ? <>Salida {st.schedEnd} en <b>{left[0]}:{left[1]}:{left[2]}</b></> : 'Fuera de horario'}
        </span>
      </div>
    </div>
  );
}
