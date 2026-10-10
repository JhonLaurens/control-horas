import type { Settings } from './types';

export const ACCENTS: [string, string][] = [['#4f8cff', '#8b5cf6'], ['#0ea5e9', '#22d3ee'], ['#10b981', '#06b6d4'], ['#8b5cf6', '#ec4899'], ['#f97316', '#ef4444'], ['#e11d48', '#a855f7'], ['#64748b', '#94a3b8']];

export function shade(hex: string, deg: number) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return `hsl(${Math.round(h + deg) % 360} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

export function applyTheme(st: Settings) {
  const root = document.documentElement; root.dataset.theme = st.theme;
  const pair = ACCENTS[st.accent] || ACCENTS[0];
  root.style.setProperty('--acc', st.customAccent || pair[0]);
  root.style.setProperty('--acc2', st.customAccent ? shade(st.customAccent, 40) : pair[1]);
}
