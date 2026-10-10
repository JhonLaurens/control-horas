import type { Session } from '../lib/types';
import { useStore } from '../lib/store';
import { M, dur, fmtDM, hm, ymd } from '../lib/time';
import { Icon } from './icons';
import { TypeChips } from './common';

export function SessionRow({ s }: { s: Session }) {
  const { eng, openEdit, actions } = useStore();
  const live = !s.end; const e = eng.sEnd(s); const cross = ymd(s.start) !== ymd(e); const pz = eng.pauseIn(s); const b = eng.sessBreak(s);
  return (
    <div className={'sess' + (live ? ' live' : '')}>
      <span className="stripe" style={b.extra > b.ord ? { background: 'linear-gradient(var(--warn),#f97316)' } : undefined} />
      <div className="info">
        <div className="rng">{hm(s.start)} – {live ? 'ahora' : hm(s.end!)}
          {live && <span className="badge live">En curso</span>}
          {cross && <span className="badge" title="La sesión cruza la medianoche">{fmtDM.format(s.start)} → {fmtDM.format(e)}</span>}
          {s.tag && <span className="tag">{s.tag}</span>}
        </div>
        <div className="nt"><TypeChips b={b} />{s.note ? s.note : <span style={{ opacity: .6 }}>Sin nota</span>}</div>
      </div>
      <div className="dur" id={live ? 'liveDur' : undefined}>{dur(b.work, 1)}
        <small>{b.extra >= M ? <span style={{ color: 'var(--warn)' }}>{dur(b.extra, 1)} extra</span> : pz >= M ? 'pausa ' + dur(pz, 1) : 'sin pausas'}</small>
      </div>
      <div className="acts">{!live && <>
        <button className="ibtn" title="Editar" aria-label="Editar sesión" data-edit={s.id} onClick={() => openEdit(s.id)}>{Icon.edit}</button>
        <button className="ibtn del" title="Eliminar" aria-label="Eliminar sesión" data-del={s.id} onClick={() => actions.delSession(s.id)}>{Icon.del}</button>
      </>}</div>
    </div>
  );
}
