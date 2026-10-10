import type { AppState, Session, Settings } from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const p = await res.json(); if (p?.detail) msg = p.detail; } catch { /* sin cuerpo */ }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SessionInput { id?: string; start: number; end: number; pauses: { start: number; end: number }[]; note: string; tag: string; extra: boolean }
export interface ImportResult { imported: number; skipped: number; settingsApplied: boolean; activeIgnored: boolean }

export const api = {
  state: () => req<AppState & { serverTime: number; zone: string }>('GET', '/state'),
  start: (b: { note: string; tag: string; extra: boolean }) => req<Session>('POST', '/active/start', b),
  pause: () => req<Session>('POST', '/active/pause'),
  resume: () => req<Session>('POST', '/active/resume'),
  stop: (b: { note: string; tag: string }) => req<{ session: Session | null; discarded: boolean }>('POST', '/active/stop', b),
  patchActive: (b: Partial<{ note: string; tag: string; extra: boolean }>) => req<Session>('PATCH', '/active', b),
  create: (b: SessionInput) => req<Session>('POST', '/sessions', b),
  update: (id: string, b: SessionInput) => req<Session>('PUT', '/sessions/' + encodeURIComponent(id), b),
  remove: (id: string) => req<void>('DELETE', '/sessions/' + encodeURIComponent(id)),
  saveSettings: (s: Settings) => req<Settings>('PUT', '/settings', s),
  importBackup: (data: unknown) => req<ImportResult>('POST', '/import', data),
  wipe: () => req<void>('DELETE', '/data'),
};

/** Descarga un archivo generado por el backend (CSV o respaldo JSON). */
export async function downloadFrom(path: string, fallbackName: string) {
  const res = await fetch('/api' + path);
  if (!res.ok) throw new ApiError('No se pudo generar el archivo', res.status);
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^";]+)"?/.exec(cd);
  const blob = await res.blob();
  const u = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = u; a.download = m ? m[1] : fallbackName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}
