import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastKind = '' | 'ok' | 'bad';
interface ToastAction { label: string; fn: () => void }
interface T { id: number; msg: string; kind: ToastKind; action?: ToastAction; out?: boolean }
type Push = (msg: string, kind?: ToastKind, action?: ToastAction | null, ms?: number) => void;

const Ctx = createContext<Push>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => {
    setList(l => l.map(t => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 300);
  }, []);
  const push = useCallback<Push>((msg, kind = '', action, ms) => {
    const id = ++seq.current;
    setList(l => [...l, { id, msg, kind, action: action || undefined }]);
    setTimeout(() => close(id), ms || (action ? 6000 : 3200));
  }, [close]);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map(t => (
          <div key={t.id} className={`toast ${t.kind}${t.out ? ' out' : ''}`}>
            <i /><span>{t.msg}</span>
            {t.action && <button className="btn sm" onClick={() => { t.action!.fn(); close(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
