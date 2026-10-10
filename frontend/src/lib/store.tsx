import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, downloadFrom, ApiError, type SessionInput } from './api';
import { Engine, openPause } from './engine';
import { DEFAULT_SETTINGS, type AppState, type Session, type Settings } from './types';
import { M, dur, hm, ymd, addDays, parseLocal } from './time';
import { applyTheme } from './theme';
import { useToast } from '../components/Toasts';

export type View = 'hoy' | 'semana' | 'mes' | 'historial' | 'ajustes';
export const VIEWS: View[] = ['hoy', 'semana', 'mes', 'historial', 'ajustes'];
export interface Draft { note: string; tag: string; extra: boolean }

interface Store {
  state: AppState; loaded: boolean; offline: string | null; now: number; eng: Engine;
  view: View; setView: (v: View) => void;
  weekOff: number; setWeekOff: (n: number) => void; monthOff: number; setMonthOff: (n: number) => void;
  draft: Draft; setDraft: (d: Partial<Draft>) => void;
  edit: { open: boolean; id: string | null; seq: number }; openEdit: (id?: string | null) => void; closeEdit: () => void;
  actions: {
    refresh: () => Promise<void>; start: () => void; togglePause: () => void; stop: () => void; startStop: () => void;
    toggleExtra: () => void; syncMeta: () => void; delSession: (id: string) => void;
    saveSettings: (patch: Partial<Settings>, okMsg?: string) => Promise<boolean>; toggleTheme: () => void; toggleHint: () => void;
    saveSession: (input: SessionInput, editId: string | null) => Promise<boolean>;
    importFile: (f: File) => void; wipe: () => Promise<void>;
    exportCsv: (from: string, to: string, q: string) => void; exportJson: () => void;
  };
}

const Ctx = createContext<Store | null>(null);
export function useStore() { const s = useContext(Ctx); if (!s) throw new Error('Store'); return s; }

const EMPTY: AppState = { sessions: [], active: null, settings: DEFAULT_SETTINGS };
const toInput = (s: Session): SessionInput => ({ id: s.id, start: s.start, end: s.end!, pauses: s.pauses.map(p => ({ start: p.start, end: p.end ?? s.end! })), note: s.note, tag: s.tag, extra: s.extra });

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<AppState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<View>('hoy');
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [draft, setDraftState] = useState<Draft>({ note: '', tag: '', extra: false });
  const [edit, setEdit] = useState({ open: false, id: null as string | null, seq: 0 });
  const busy = useRef(false);
  const stRef = useRef(state); stRef.current = state;
  const draftRef = useRef(draft); draftRef.current = draft;

  const setDraft = useCallback((d: Partial<Draft>) => setDraftState(o => ({ ...o, ...d })), []);
  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    toast(msg, 'bad');
    if (e instanceof ApiError && e.status === 0) setOffline(msg);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState({ sessions: s.sessions, active: s.active, settings: s.settings });
      setOffline(null);
      return;
    } catch (e) {
      setOffline(e instanceof Error ? e.message : 'Sin conexión');
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        const s = await api.state();
        setState({ sessions: s.sessions, active: s.active, settings: s.settings });
        if (s.active) {
          setDraftState({ note: s.active.note, tag: s.active.tag, extra: s.active.extra });
          toast('Jornada en curso recuperada (desde las ' + hm(s.active.start) + ')', 'ok');
        }
      } catch (e) {
        setOffline(e instanceof Error ? e.message : 'Sin conexión');
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  // Reloj en vivo + resincronización periódica (otras pestañas / reinicios)
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const i = setInterval(() => { if (!document.hidden && !busy.current) refresh(); }, 30000);
    const v = () => { if (!document.hidden) { setNow(Date.now()); refresh(); } };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', v); };
  }, [refresh]);

  useEffect(() => { applyTheme(state.settings); }, [state.settings]);

  const eng = useMemo(() => new Engine(state.settings, state.sessions, state.active, now), [state, now]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    try { return await fn(); }
    catch (e) { fail(e); if (e instanceof ApiError && e.status === 409) await refresh(); return undefined; }
    finally { busy.current = false; }
  }, [fail, refresh]);

  const start = useCallback(() => {
    if (stRef.current.active) return;
    const d = draftRef.current;
    run(async () => {
      const a = await api.start({ note: d.note.trim(), tag: d.tag.trim(), extra: d.extra });
      setState(s => ({ ...s, active: a }));
      toast('Jornada iniciada a las ' + hm(a.start), 'ok');
    });
  }, [run, toast]);

  const togglePause = useCallback(() => {
    const a = stRef.current.active;
    if (!a) { toast('Inicia una jornada para poder pausar'); return; }
    const paused = !!openPause(a);
    run(async () => {
      const r = paused ? await api.resume() : await api.pause();
      setState(s => ({ ...s, active: r }));
      toast(paused ? 'Trabajo reanudado' : 'Pausa iniciada', paused ? 'ok' : '');
    });
  }, [run, toast]);

  const stop = useCallback(() => {
    if (!stRef.current.active) return;
    const d = draftRef.current;
    run(async () => {
      const r = await api.stop({ note: d.note.trim(), tag: d.tag.trim() });
      const cur = stRef.current;
      if (r.discarded || !r.session) {
        setState({ ...cur, active: null });
        toast('Sesión demasiado corta, descartada');
        return;
      }
      const sessions = [...cur.sessions, r.session];
      setState({ ...cur, sessions, active: null });
      const b = new Engine(cur.settings, sessions, null, Date.now()).sessBreak(r.session);
      toast('Sesión guardada: ' + dur(b.work) + (b.extra >= M ? ` (${dur(b.extra, 1)} extra)` : ''), 'ok');
      setDraftState(o => ({ ...o, note: '', extra: false }));
    });
  }, [run, toast]);

  const startStop = useCallback(() => { stRef.current.active ? stop() : start(); }, [start, stop]);

  const toggleExtra = useCallback(() => {
    const v = !draftRef.current.extra;
    setDraftState(o => ({ ...o, extra: v }));
    if (stRef.current.active) {
      api.patchActive({ extra: v }).then(a => setState(s => ({ ...s, active: a }))).catch(fail);
    }
    toast(v ? 'La sesión se contará como horas extra' : 'La sesión se clasificará según tu horario');
  }, [toast, fail]);

  const syncMeta = useCallback(() => {
    const a = stRef.current.active; if (!a) return;
    const d = draftRef.current; const note = d.note.trim(), tag = d.tag.trim();
    if (note === a.note && tag === a.tag) return;
    api.patchActive({ note, tag }).then(r => setState(s => ({ ...s, active: r }))).catch(fail);
  }, [fail]);

  const delSession = useCallback((id: string) => {
    const s = stRef.current.sessions.find(x => x.id === id); if (!s) return;
    run(async () => {
      await api.remove(id);
      setState(st => ({ ...st, sessions: st.sessions.filter(x => x.id !== id) }));
      toast('Sesión eliminada', '', {
        label: 'Deshacer', fn: () => {
          api.create(toInput(s)).then(r => { setState(st => ({ ...st, sessions: [...st.sessions, r] })); toast('Sesión restaurada', 'ok'); }).catch(fail);
        },
      });
    });
  }, [run, toast, fail]);

  const saveSettings = useCallback(async (patch: Partial<Settings>, okMsg?: string) => {
    const prev = stRef.current.settings; const next = { ...prev, ...patch };
    setState(s => ({ ...s, settings: next }));
    try {
      const saved = await api.saveSettings(next);
      setState(s => ({ ...s, settings: saved }));
      if (okMsg) toast(okMsg, 'ok');
      return true;
    } catch (e) {
      setState(s => ({ ...s, settings: prev }));
      fail(e);
      return false;
    }
  }, [toast, fail]);

  const toggleTheme = useCallback(() => {
    const t = stRef.current.settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings({ theme: t }); toast(t === 'dark' ? 'Tema oscuro' : 'Tema claro');
  }, [saveSettings, toast]);
  const toggleHint = useCallback(() => { saveSettings({ hint: !stRef.current.settings.hint }); }, [saveSettings]);

  const saveSession = useCallback(async (input: SessionInput, editId: string | null) => {
    const r = await run(async () => {
      const saved = editId ? await api.update(editId, input) : await api.create(input);
      setState(st => ({ ...st, sessions: editId ? st.sessions.map(x => (x.id === editId ? saved : x)) : [...st.sessions, saved] }));
      toast(editId ? 'Sesión actualizada' : 'Sesión agregada', 'ok');
      const cur = stRef.current;
      const ovl = cur.sessions.some(x => x.id !== saved.id && x.end != null && x.start < input.end && x.end > input.start) || (cur.active && cur.active.start < input.end);
      if (ovl) toast('Atención: esta sesión se solapa con otra', 'bad');
      return true;
    });
    return !!r;
  }, [run, toast]);

  const importFile = useCallback((f: File) => {
    const rd = new FileReader();
    rd.onload = () => {
      let data: unknown;
      try { data = JSON.parse(String(rd.result)); } catch { toast('Archivo de respaldo no válido', 'bad'); return; }
      run(async () => {
        const r = await api.importBackup(data);
        await refresh();
        toast(`Importadas ${r.imported} sesiones nuevas` + (r.skipped ? ` · ${r.skipped} omitidas (repetidas o inválidas)` : ''), 'ok', null, 5000);
        if (r.activeIgnored) toast('La jornada en curso del respaldo no se importó; agrégala como sesión manual si la necesitas', '', null, 6000);
      });
    };
    rd.readAsText(f);
  }, [run, refresh, toast]);

  const wipe = useCallback(async () => {
    await run(async () => {
      await api.wipe(); await refresh();
      setDraftState({ note: '', tag: '', extra: false }); toast('Datos borrados');
    });
  }, [run, refresh, toast]);

  const exportCsv = useCallback((from: string, to: string, q: string) => {
    const a = from ? parseLocal(from, '00:00') : -Infinity, b = to ? addDays(parseLocal(to, '00:00'), 1) : Infinity;
    const e = new Engine(stRef.current.settings, stRef.current.sessions, stRef.current.active, Date.now());
    const ql = q.trim().toLowerCase();
    const n = e.sessionsIn(a, b).filter(s => !ql || s.note.toLowerCase().includes(ql) || s.tag.toLowerCase().includes(ql)).length;
    if (!n) { toast('No hay sesiones para exportar', 'bad'); return; }
    const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); if (ql) p.set('q', q.trim());
    downloadFrom('/export/csv?' + p.toString(), `horas_${from || 'inicio'}_a_${to || ymd(Date.now())}.csv`)
      .then(() => toast(`CSV exportado (${n} sesiones)`, 'ok')).catch(fail);
  }, [toast, fail]);

  const exportJson = useCallback(() => {
    downloadFrom('/export/json', `control-horas_respaldo_${ymd(Date.now())}.json`).then(() => toast('Respaldo descargado', 'ok')).catch(fail);
  }, [toast, fail]);

  // Sincroniza el borrador con la jornada activa cuando cambia (otra pestaña / recarga)
  const activeId = state.active?.id;
  useEffect(() => {
    const a = stRef.current.active;
    if (a) setDraftState({ note: a.note, tag: a.tag, extra: a.extra });
  }, [activeId]);

  const openEdit = useCallback((id?: string | null) => setEdit(e => ({ open: true, id: id ?? null, seq: e.seq + 1 })), []);
  const closeEdit = useCallback(() => setEdit(e => ({ ...e, open: false })), []);

  const value: Store = {
    state, loaded, offline, now, eng, view, setView, weekOff, setWeekOff, monthOff, setMonthOff, draft, setDraft, edit, openEdit, closeEdit,
    actions: { refresh, start, togglePause, stop, startStop, toggleExtra, syncMeta, delSession, saveSettings, toggleTheme, toggleHint, saveSession, importFile, wipe, exportCsv, exportJson },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
