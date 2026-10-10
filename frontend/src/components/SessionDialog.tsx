import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { H, M, atMin, dur, hm, parseLocal, sod, tmin, ymd } from '../lib/time';

/** Diálogo para agregar o editar una sesión (misma lógica que la versión HTML). */
export function SessionDialog() {
  const { edit, closeEdit, state, eng, actions } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const stRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ sd: '', st: '', ed: '', et: '', p: '0', tag: '', note: '', extra: false });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const s = edit.id ? state.sessions.find(x => x.id === edit.id) || null : null;

  useEffect(() => {
    if (!edit.open) { if (ref.current?.open) ref.current.close(); return; }
    const t = Date.now(); let a: number, b: number;
    if (s) { a = s.start; b = s.end!; } else { b = Math.floor(t / M / 5) * M * 5; a = b - H; }
    setF({ sd: ymd(a), st: hm(a), ed: ymd(b), et: hm(b), p: String(s ? Math.round(eng.pauseIn(s) / M) : 0), tag: s?.tag || '', note: s?.note || '', extra: !!s?.extra });
    setErr('');
    if (ref.current && !ref.current.open) ref.current.showModal();
    setTimeout(() => stRef.current?.focus(), 50);
  }, [edit.open, edit.seq]);

  const a = parseLocal(f.sd, f.st), b = parseLocal(f.ed, f.et), p = Math.max(0, Math.round(+f.p || 0)) * M;
  let v = '';
  if (isNaN(a) || isNaN(b)) v = 'Completa fechas y horas';
  else if (b <= a) v = 'La hora de fin debe ser posterior al inicio';
  else if (p >= b - a) v = 'Las pausas superan la duración';
  else if (b - a > 48 * H) v = 'Una sesión no puede superar 48 h';
  else if (b > Date.now() + M) v = 'La sesión no puede terminar en el futuro';
  let cls = '—';
  if (!v) {
    const info = eng.dayInfo(sod(a)); const ws = atMin(sod(a), tmin(state.settings.schedStart)), we = atMin(sod(a), tmin(state.settings.schedEnd));
    cls = f.extra ? 'Toda la sesión como extra' : !info.working ? (info.fest ? 'Festivo (' + info.fest + '): todo es extra' : 'Día no laboral: todo es extra')
      : (a >= ws && b <= we && ymd(a) === ymd(b)) ? 'Dentro del horario (ordinaria hasta completar la jornada)' : 'Incluye tiempo fuera del horario (extra)';
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = k === 'extra' ? e.target.checked : e.target.value; setErr('');
    setF(o => { const n = { ...o, [k]: val }; if (k === 'sd' && n.ed < n.sd) n.ed = n.sd; return n; });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (v) { setErr(v); return; }
    const oldP = s ? Math.round(eng.pauseIn(s) / M) : -1;
    const keep = s && oldP === Math.round(p / M) && s.pauses.every(x => x.start >= a && (x.end ?? 0) <= b);
    let pauses: { start: number; end: number }[];
    if (keep && s) pauses = s.pauses.map(x => ({ start: x.start, end: x.end! }));
    else { const mid = a + (b - a - p) / 2; pauses = p ? [{ start: Math.round(mid), end: Math.round(mid + p) }] : []; }
    setSaving(true);
    const ok = await actions.saveSession({ start: a, end: b, pauses, note: f.note.trim(), tag: f.tag.trim(), extra: f.extra }, s ? s.id : null);
    setSaving(false);
    if (ok) closeEdit();
  }

  return (
    <dialog ref={ref} id="dlg" onClose={closeEdit}>
      <form method="dialog" noValidate onSubmit={submit}>
        <div className="dlg-h">{s ? 'Editar sesión' : 'Agregar sesión manual'}</div>
        <div className="dlg-b">
          <label className="f">Fecha de inicio<input type="date" id="fSD" value={f.sd} onChange={set('sd')} required /></label>
          <label className="f">Hora de inicio<input type="time" id="fST" ref={stRef} value={f.st} onChange={set('st')} required /></label>
          <label className="f">Fecha de fin<input type="date" id="fED" value={f.ed} onChange={set('ed')} required /></label>
          <label className="f">Hora de fin<input type="time" id="fET" value={f.et} onChange={set('et')} required /></label>
          <label className="f">Pausas (minutos)<input type="number" id="fP" min="0" step="1" value={f.p} onChange={set('p')} /></label>
          <label className="f">Proyecto<input id="fTag" list="tagList" maxLength={40} value={f.tag} onChange={set('tag')} /></label>
          <label className="f full">Nota<input id="fNote" maxLength={200} placeholder="Opcional" value={f.note} onChange={set('note')} /></label>
          <label className="check full"><input type="checkbox" id="fExtra" checked={f.extra} onChange={set('extra')} />Marcar toda la sesión como horas extra</label>
          <div className="dlg-calc"><span>Tiempo trabajado</span><b id="fCalc">{v ? '—' : dur(b - a - p) + (ymd(a) !== ymd(b) ? ' · cruza medianoche' : '')}</b></div>
          <div className="dlg-calc" style={{ marginTop: -6 }}><span>Clasificación</span><b id="fClass">{cls}</b></div>
        </div>
        <div className="dlg-f"><span className="err" id="fErr">{err}</span>
          <button className="btn" type="button" onClick={closeEdit}>Cancelar</button>
          <button className="btn pri" type="submit" id="dlgOk" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </dialog>
  );
}
