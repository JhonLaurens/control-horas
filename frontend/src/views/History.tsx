import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { holidayName } from '../lib/holidays';
import { M, addDays, cap, dur, fmtDate, hDec, hm, parseLocal, sod, som, ymd } from '../lib/time';
import type { Session } from '../lib/types';
import { Icon } from '../components/icons';
import { TypeChips } from '../components/common';

type R = '7' | '30' | 'm' | 'all' | '';
function rangeFor(r: R) {
  const t = Date.now();
  if (r === 'all') return { from: '', to: '' };
  if (r === 'm') return { from: ymd(som(t)), to: ymd(t) };
  return { from: ymd(addDays(sod(t), -(+r - 1))), to: ymd(t) };
}

export function HistoryView() {
  const { eng, openEdit, actions } = useStore();
  const [r, setR] = useState<R>('30');
  const [{ from, to }, setRange] = useState(rangeFor('30'));
  const [q, setQ] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const a = from ? parseLocal(from, '00:00') : -Infinity, b = to ? addDays(parseLocal(to, '00:00'), 1) : Infinity;
  const ql = q.trim().toLowerCase();
  const rows = eng.sessionsIn(a, b).filter(s => !ql || s.note.toLowerCase().includes(ql) || s.tag.toLowerCase().includes(ql)).reverse();
  const fest = (s: Session) => { const n: string[] = []; for (let d = sod(s.start); d < eng.sEnd(s); d = addDays(d, 1)) { const f = holidayName(d); if (f) n.push(f); } return n.join(' / '); };
  let tw = 0, tp = 0, to2 = 0, tx = 0;
  const body = rows.map(s => {
    const br = eng.sessBreak(s), p = eng.pauseIn(s); tw += br.work; tp += p; to2 += br.ord; tx += br.extra;
    const cross = ymd(s.start) !== ymd(eng.sEnd(s)); const f = fest(s);
    return (
      <tr key={s.id}>
        <td>{cap(fmtDate.format(s.start))}{f && <> <span className="badge" style={{ color: 'var(--warn)', borderColor: 'color-mix(in srgb,var(--warn) 40%,transparent)' }} title={f}>Festivo</span></>}</td>
        <td>{hm(s.start)}</td>
        <td>{s.end ? hm(s.end) : <span className="badge live" style={{ margin: 0 }}>En curso</span>}{cross && <> <span className="badge">+1 día</span></>}</td>
        <td className="num"><b>{dur(br.work, 1)}</b></td>
        <td className="num">{br.ord >= M ? dur(br.ord, 1) : '—'}</td>
        <td className="num" style={br.extra >= M ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>{br.extra >= M ? dur(br.extra, 1) : '—'}</td>
        <td style={{ whiteSpace: 'normal', minWidth: 260 }}><TypeChips b={br} amt />{s.extra && <span className="typ x" title="Marcada manualmente">Manual</span>}</td>
        <td className="num">{p >= M ? dur(p, 1) : '—'}</td>
        <td>{s.tag && <span className="tag" style={{ margin: 0 }}>{s.tag}</span>}</td>
        <td className="note" title={s.note}>{s.note}</td>
        <td style={{ textAlign: 'right' }}>{s.end && <>
          <button className="ibtn" aria-label="Editar sesión" data-edit={s.id} onClick={() => openEdit(s.id)}>{Icon.edit}</button>
          <button className="ibtn del" aria-label="Eliminar sesión" data-del={s.id} onClick={() => actions.delSession(s.id)}>{Icon.del}</button>
        </>}</td>
      </tr>
    );
  });
  const pick = (x: R) => { setR(x); setRange(rangeFor(x)); };
  return (
    <section className="view on" id="v-historial" aria-label="Historial">
      <div className="card">
        <div className="filters">
          <label className="f">Desde<input type="date" id="hFrom" value={from} onChange={e => { setR(''); setRange({ from: e.target.value, to }); }} /></label>
          <label className="f">Hasta<input type="date" id="hTo" value={to} onChange={e => { setR(''); setRange({ from, to: e.target.value }); }} /></label>
          <label className="f" style={{ minWidth: 200 }}>Buscar<input id="hQ" placeholder="Nota o proyecto" value={q} onChange={e => setQ(e.target.value)} /></label>
          <div className="seg" role="group" aria-label="Rango rápido">
            {([['7', '7 días'], ['30', '30 días'], ['m', 'Este mes'], ['all', 'Todo']] as [R, string][]).map(([k, l]) => <button key={k} data-r={k} aria-pressed={r === k} onClick={() => pick(k)}>{l}</button>)}
          </div>
          <span className="sp" />
          <button className="btn sm" id="btnCsv" onClick={() => actions.exportCsv(from, to, q)}>{Icon.down}Exportar CSV</button>
          <button className="btn sm" id="btnJson" onClick={actions.exportJson}>{Icon.down}Respaldo JSON</button>
          <button className="btn sm" id="btnImport" onClick={() => file.current?.click()} title="Importa el respaldo JSON de la versión HTML o de esta app">{Icon.up}Importar</button>
          <input type="file" id="fileImport" ref={file} accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) actions.importFile(f); e.target.value = ''; }} />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Inicio</th><th>Fin</th><th className="num">Trabajado</th><th className="num">Ordinarias</th><th className="num">Extra</th><th>Tipo</th><th className="num">Pausas</th><th>Proyecto</th><th>Nota</th><th /></tr></thead>
            <tbody id="hBody">{rows.length ? body : <tr><td colSpan={11}><div className="empty">No hay sesiones en este rango</div></td></tr>}</tbody>
            {rows.length > 0 && <tfoot><tr><td colSpan={3}>{rows.length} sesi{rows.length > 1 ? 'ones' : 'ón'}</td><td className="num">{dur(tw, 1)}</td><td className="num">{dur(to2, 1)}</td><td className="num" style={{ color: 'var(--warn)' }}>{dur(tx, 1)}</td><td /><td className="num">{dur(tp, 1)}</td><td colSpan={3}>{hDec(tw)} h en decimal · {hDec(tx)} h extra</td></tr></tfoot>}
          </table>
        </div>
      </div>
    </section>
  );
}
