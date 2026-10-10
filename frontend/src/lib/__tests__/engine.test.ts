import { describe, expect, it } from 'vitest';
import vectors from '../../../../shared/classification-vectors.json';
import { Engine, ALL_CATS, legalNightStart } from '../engine';
import { DEFAULT_SETTINGS, type Session } from '../types';
import { holidays } from '../holidays';

const H = 3600000;
const t = (s: string) => { const [d, hm] = s.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = hm.split(':').map(Number); return new Date(y, m - 1, dd, h, mi).getTime(); };
const NOW = t('2026-10-09T22:00');

type V = { name: string; settings?: Record<string, unknown>; sessions: { id: string; start: string; end: string; pauses?: string[][]; extra?: boolean }[];
  expectSessions?: Record<string, Record<string, number>>; expectDays?: Record<string, Record<string, number>>; expectNightStart?: Record<string, string> };

describe('vectores compartidos con el backend', () => {
  for (const c of (vectors as { cases: V[] }).cases) {
    const settings = { ...DEFAULT_SETTINGS, ...(c.settings || {}) };
    const sessions: Session[] = c.sessions.map(s => ({ id: s.id, start: t(s.start), end: t(s.end), pauses: (s.pauses || []).map(p => ({ start: t(p[0]), end: t(p[1]) })), note: '', tag: '', extra: !!s.extra }));
    const eng = new Engine(settings, sessions, null, NOW);
    for (const [id, exp] of Object.entries(c.expectSessions || {})) {
      it(`${c.name} · ${id}`, () => {
        const b = eng.sessBreak(sessions.find(s => s.id === id)!);
        for (const [k] of ALL_CATS) expect(b[k] / H, `${id}.${k}`).toBeCloseTo(exp[k] ?? 0, 9);
      });
    }
    for (const [day, exp] of Object.entries(c.expectDays || {})) {
      it(`${c.name} · día ${day}`, () => {
        const r = eng.dayBreak(t(day + 'T00:00'));
        if ('work' in exp) expect(r.work / H).toBeCloseTo(exp.work, 9);
        if ('lunchOver' in exp) expect(r.lunchOver / H).toBeCloseTo(exp.lunchOver, 9);
        if ('goal' in exp) expect(r.goal / H).toBeCloseTo(exp.goal, 9);
      });
    }
    for (const [day, v] of Object.entries(c.expectNightStart || {})) {
      it(`${c.name} · nocturna ${day}`, () => expect(eng.nightStartFor(t(day + 'T00:00'))).toBe(v));
    }
  }
});

describe('festivos y metas', () => {
  it('festivos 2026', () => {
    expect(holidays(2026).list.map(h => h.date)).toEqual(['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25']);
  });
  it('festivos 2025 (17, 20 jul cae domingo)', () => expect(holidays(2025).list.length).toBe(17));
  it('jornada por defecto 8,5 h y frontera legal', () => {
    const e = new Engine(DEFAULT_SETTINGS, [], null, NOW);
    expect(e.dailyGoalMs() / H).toBe(8.5);
    expect(e.weeklyGoalMs() / H).toBe(42.5);
    expect(legalNightStart(t('2025-12-24T00:00'))).toBe('21:00');
    expect(legalNightStart(t('2025-12-25T00:00'))).toBe('19:00');
  });
  it('sesión activa en pausa', () => {
    const a: Session = { id: 'a', start: t('2026-10-09T20:00'), end: null, pauses: [{ start: t('2026-10-09T21:00'), end: null }], note: '', tag: '', extra: false };
    const e = new Engine(DEFAULT_SETTINGS, [], a, NOW);
    expect(e.sessBreak(a).eN / H).toBeCloseTo(1, 9);
    expect(e.classNow(NOW)?.k).toBe('eN');
  });
});
