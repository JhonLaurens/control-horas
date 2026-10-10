export interface Pause { start: number; end: number | null }
export interface Session {
  id: string; start: number; end: number | null; pauses: Pause[];
  note: string; tag: string; extra: boolean;
}
export interface Settings {
  schedStart: string; schedEnd: string; lunch: number;
  nightStart: string | null; nightEnd: string;
  workdays: number[]; theme: 'dark' | 'light'; accent: number; customAccent: string | null;
  hint: boolean; goalNotified: string | null; endNotified: string | null;
}
export interface AppState { sessions: Session[]; active: Session | null; settings: Settings }
export type CatKey = 'oD' | 'oN' | 'eD' | 'eN' | 'fD' | 'fN' | 'sD' | 'sN';
export const DEFAULT_SETTINGS: Settings = {
  schedStart: '07:30', schedEnd: '17:30', lunch: 90, nightStart: null, nightEnd: '06:00',
  workdays: [1, 2, 3, 4, 5], theme: 'dark', accent: 0, customAccent: null, hint: true,
  goalNotified: null, endNotified: null,
};
