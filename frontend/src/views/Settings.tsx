import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { legalNightStart } from '../lib/engine';
import { holidays, nextHoliday } from '../lib/holidays';
import { H, cap, fmtWDM, hNum, isHM, parseLocal, sod, tmin, ymd } from '../lib/time';
import { ACCENTS } from '../lib/theme';
import { Icon } from '../components/icons';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toasts';

/**
 * Campo que guarda al salir (blur) o con Enter. Los campos de hora/color también guardan
 * 700 ms después del último cambio válido (en Chrome, Tab se mueve dentro de las partes de la hora).
 */
function Field({ id, type, value, onCommit, disabled, ...rest }: { id: string; type: string; value: string; onCommit: (v: string) => void; disabled?: boolean; min?: number; max?: number; step?: number }) {
  const [v, setV] = useState(value);
  const timer = useRef<number>();
  const last = useRef(value);
  useEffect(() => { setV(value); last.current = value; }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = (x: string) => { window.clearTimeout(timer.current); if (x !== last.current && x !== '') { last.current = x; onCommit(x); } };
  return <input id={id} type={type} value={v} disabled={disabled} {...rest}
    onChange={e => { const x = e.target.value; setV(x); if (type !== 'number') { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => commit(x), 700); } }}
    onBlur={() => commit(v)} onKeyDown={e => { if (e.key === 'Enter') commit(v); }} />;
}

export function SettingsView() {
  const { state, eng, now, actions } = useStore();
  const confirm = useConfirm(); const toast = useToast();
  const st = state.settings; const [fy, setFy] = useState(new Date().getFullYear());
  const g = eng.dailyGoalMs(); const today = ymd(now); const nh = nextHoliday(now);

  const setTime = (key: 'schedStart' | 'schedEnd' | 'nightStart' | 'nightEnd', label: string) => (v: string) => {
    if (!isHM(v)) { toast('Hora no válida', 'bad'); return; }
    const next = { ...st, [key]: v };
    if ((key === 'schedStart' || key === 'schedEnd') && tmin(next.schedEnd) <= tmin(next.schedStart)) { toast('La hora de salida debe ser posterior a la de entrada', 'bad'); return; }
    actions.saveSettings({ [key]: v }, label + ': ' + v);
  };
  const names = ['D', 'L', 'M', 'M', 'J', 'V', 'S'], full = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  return (
    <section className="view on" id="v-ajustes" aria-label="Ajustes">
      <div className="set">
        <div className="card"><h2>Horario laboral</h2>
          <div className="row"><div className="d"><b>Hora de entrada</b><span>Inicio de la jornada ordinaria</span></div><Field id="sStart" type="time" value={st.schedStart} onCommit={setTime('schedStart', 'Hora de entrada')} /></div>
          <div className="row"><div className="d"><b>Hora de salida</b><span>Después de esta hora cuenta como extra</span></div><Field id="sEnd" type="time" value={st.schedEnd} onCommit={setTime('schedEnd', 'Hora de salida')} /></div>
          <div className="row"><div className="d"><b>Almuerzo / pausa no remunerada</b><span>Minutos máximos dentro del horario (0 = sin almuerzo)</span></div>
            <Field id="sLunch" type="number" min={0} max={240} step={5} value={String(st.lunch)} onCommit={v => {
              const n = Math.round(+v); const span = tmin(st.schedEnd) - tmin(st.schedStart);
              if (v !== '' && n >= 0 && n <= 240 && n < span) actions.saveSettings({ lunch: n }, 'Almuerzo: ' + n + ' min'); else toast('Valor de almuerzo no válido', 'bad');
            }} /></div>
          <div className="row"><div className="d"><b>Días laborales</b><span>Sábados, domingos y festivos no marcados cuentan como extra</span></div>
            <div className="seg" id="sDays" role="group" aria-label="Días laborales">
              {[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} data-wd={d} aria-label={full[d]} aria-pressed={st.workdays.includes(d)} onClick={() => actions.saveSettings({ workdays: st.workdays.includes(d) ? st.workdays.filter(x => x !== d) : [...st.workdays, d] })}>{names[d]}</button>)}
            </div></div>
          <div className="row"><div className="d"><b>Inicio de jornada nocturna</b><span>Según la ley: 19:00 desde el 25-dic-2025 (Ley 2466 de 2025); 21:00 antes (Ley 1846 de 2017)</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select id="sNightMode" style={{ width: 'auto' }} value={st.nightStart ? 'custom' : 'auto'} onChange={e => {
                const ns = e.target.value === 'custom' ? '19:00' : null;
                actions.saveSettings({ nightStart: ns }, ns ? 'Inicio nocturno personalizado: ' + ns : 'Inicio nocturno según la ley');
              }}><option value="auto">Según la ley</option><option value="custom">Personalizado</option></select>
              <Field id="sNight" type="time" value={st.nightStart || legalNightStart(sod(now))} disabled={!st.nightStart} onCommit={setTime('nightStart', 'Inicio jornada nocturna')} />
            </div></div>
          <div className="row"><div className="d"><b>Fin de jornada nocturna</b><span>Desde esta hora el trabajo vuelve a ser diurno (ley: 06:00)</span></div><Field id="sNightEnd" type="time" value={st.nightEnd} onCommit={setTime('nightEnd', 'Fin jornada nocturna')} /></div>
          <div className="derived" id="sDerived">
            Jornada ordinaria: <b>{hNum(g / H)} h por día</b> ({st.schedStart} – {st.schedEnd} menos {st.lunch} min de almuerzo) · Meta semanal base: <b>{hNum(eng.weeklyGoalMs() / H)} h</b> ({st.workdays.length} días). Las semanas con festivos ajustan su meta automáticamente.<br />
            Jornada nocturna aplicada hoy: <b>{eng.nightStartFor(sod(now))} – {st.nightEnd}</b>{st.nightStart ? ' (personalizada)' : ' (según la ley)'}. Solo se cuentan horas; no se calculan pagos ni recargos.
          </div>
        </div>
        <div className="card"><h2>Apariencia</h2>
          <div className="row"><div className="d"><b>Tema</b><span>Oscuro por defecto</span></div>
            <div className="seg" id="sTheme" role="group" aria-label="Tema">
              <button data-t="dark" aria-pressed={st.theme === 'dark'} onClick={() => actions.saveSettings({ theme: 'dark' })}>Oscuro</button>
              <button data-t="light" aria-pressed={st.theme === 'light'} onClick={() => actions.saveSettings({ theme: 'light' })}>Claro</button>
            </div></div>
          <div className="row"><div className="d"><b>Color de acento</b><span>Personaliza la interfaz</span></div>
            <div className="sws" id="sAccent">
              {ACCENTS.map((c, i) => <button key={i} className="sw" style={{ background: `linear-gradient(135deg,${c[0]},${c[1]})` }} aria-label={`Color de acento ${i + 1}`} aria-pressed={!st.customAccent && st.accent === i} onClick={() => actions.saveSettings({ accent: i, customAccent: null })} />)}
              <Field id="sCustom" type="color" value={st.customAccent || ACCENTS[st.accent][0]} onCommit={v => actions.saveSettings({ customAccent: v })} />
            </div></div>
        </div>
        <div className="card"><h2>Festivos en Colombia<span className="sp" />
          <span className="navr"><button className="ibtn" aria-label="Año anterior" onClick={() => setFy(fy - 1)}>{Icon.left}</button><b style={{ color: 'var(--fg)', minWidth: 44, textAlign: 'center' }}>{fy}</b><button className="ibtn" aria-label="Año siguiente" onClick={() => setFy(fy + 1)}>{Icon.right}</button></span></h2>
          <div className="hlist" id="fyList">{holidays(fy).list.map(h => { const d = parseLocal(h.date, '00:00'); return <div key={h.date} className={'hi' + (h.date < today ? ' past' : '') + (nh && nh.date === h.date ? ' next' : '')}><span>{cap(fmtWDM.format(d))}</span><span>{h.name}</span></div>; })}</div>
        </div>
        <div className="card"><h2>Atajos de teclado</h2>
          <div className="kb"><kbd>Espacio</kbd><span>Iniciar / finalizar jornada</span><kbd>P</kbd><span>Pausar / reanudar</span><kbd>X</kbd><span>Marcar la sesión actual como extra</span><kbd>N</kbd><span>Agregar sesión manual</span><kbd>T</kbd><span>Cambiar tema</span><kbd>1 – 5</kbd><span>Cambiar de vista</span><kbd>?</kbd><span>Mostrar u ocultar la barra de atajos</span><kbd>Esc</kbd><span>Cerrar diálogos</span></div>
        </div>
        <div className="card"><h2>Datos</h2>
          <div className="row"><div className="d"><b>Base de datos PostgreSQL</b><span id="sInfo">{state.sessions.length} sesiones guardadas en el servidor local{state.active ? ' · 1 jornada en curso' : ''}. Haz respaldos JSON desde Historial.</span></div></div>
          <div className="row"><div className="d"><b>Borrar todo</b><span>Elimina sesiones y ajustes. Haz un respaldo antes.</span></div>
            <button className="btn sm danger" id="btnWipe" onClick={async () => { if (await confirm('¿Borrar todos los datos?', 'Se eliminarán todas las sesiones y ajustes guardados en la base de datos. Esta acción no se puede deshacer.', 'Borrar todo')) await actions.wipe(); }}>Borrar datos</button></div>
        </div>
      </div>
    </section>
  );
}
