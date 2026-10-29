// Cook-mode timers. They live outside the Cook screen so they keep running across
// step changes and screen changes; a finished timer raises a full-screen alert.
import { createStore } from './store';
import { nowMs } from './logic/time';
import { startAlarm, stopAlarm } from './sound';

export interface CookTimer {
  key: string; // recipeId:stepIndex
  recipeId: string;
  recipeName: string;
  step: number;
  label: string;
  total: number; // seconds
  endsAt: number | null; // epoch ms while running
  remaining: number; // seconds, while paused
}

export const timers = createStore<Record<string, CookTimer>>({});
export const finished = createStore<CookTimer[]>([]);

let ticker: ReturnType<typeof setInterval> | undefined;

function ensureTicker(): void {
  if (ticker) return;
  ticker = setInterval(() => {
    const all = timers.get();
    const t = nowMs();
    const done = Object.values(all).filter((x) => x.endsAt != null && x.endsAt <= t);
    if (done.length) {
      const next = { ...all };
      for (const d of done) next[d.key] = { ...d, endsAt: null, remaining: 0 };
      timers.set(next);
      finished.set([...finished.get(), ...done]);
      startAlarm();
    }
    if (!Object.values(timers.get()).some((x) => x.endsAt != null)) { clearInterval(ticker); ticker = undefined; }
  }, 250);
}

export function remainingSec(t: CookTimer): number {
  return t.endsAt != null ? Math.max(0, (t.endsAt - nowMs()) / 1000) : t.remaining;
}

export function getTimer(base: Omit<CookTimer, 'endsAt' | 'remaining'>): CookTimer {
  return timers.get()[base.key] ?? { ...base, endsAt: null, remaining: base.total };
}

export function toggleTimer(base: Omit<CookTimer, 'endsAt' | 'remaining'>): void {
  const t = getTimer(base);
  if (t.endsAt != null) {
    timers.set({ ...timers.get(), [t.key]: { ...t, endsAt: null, remaining: remainingSec(t) } });
    return;
  }
  const rem = t.remaining > 0 ? t.remaining : t.total;
  timers.set({ ...timers.get(), [t.key]: { ...t, endsAt: nowMs() + rem * 1000, remaining: rem } });
  ensureTicker();
}

export function resetTimer(key: string): void {
  const next = { ...timers.get() };
  delete next[key];
  timers.set(next);
}

export function dismissFinished(): void {
  finished.set([]);
  stopAlarm();
}

/** Dev panel: make every running timer finish in 3 seconds. */
export function fastForwardTimers(): void {
  const all = timers.get();
  const next = { ...all };
  for (const t of Object.values(all)) if (t.endsAt != null) next[t.key] = { ...t, endsAt: nowMs() + 3000 };
  timers.set(next);
}
