import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Ask = (title: string, msg: string, yes?: string) => Promise<boolean>;
const Ctx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<{ title: string; msg: string; yes: string; res: (v: boolean) => void } | null>(null);
  const ask = useCallback<Ask>((title, msg, yes = 'Confirmar') => new Promise(res => setQ({ title, msg, yes, res })), []);
  useEffect(() => { if (q && ref.current && !ref.current.open) ref.current.showModal(); }, [q]);
  const done = (v: boolean) => { ref.current?.close(); q?.res(v); setQ(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <dialog ref={ref} id="confirm" style={{ width: 'min(420px,94vw)' }} onCancel={e => { e.preventDefault(); done(false); }}>
        <div className="dlg-h">{q?.title}</div>
        <div style={{ padding: '8px 22px', color: 'var(--fg2)' }}>{q?.msg}</div>
        <div className="dlg-f"><button className="btn" onClick={() => done(false)}>Cancelar</button><button className="btn danger" id="cYes" onClick={() => done(true)}>{q?.yes}</button></div>
      </dialog>
    </Ctx.Provider>
  );
}
