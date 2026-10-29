// App-wide singletons, set once at boot in main.tsx.
import type { HubConfig } from './config';
import type { DataAdapter } from './data/adapter';
import { createStore } from './store';

export let config: HubConfig;
export let adapter: DataAdapter;

export function initHub(cfg: HubConfig, a: DataAdapter): void {
  config = cfg;
  adapter = a;
}

/** URL flags: ?mock=1, ?scene=dropoff|pickup|dinner, ?now=ISO, ?nodev=1 */
export const params = new URLSearchParams(location.search);

/** Scene override for the Home card; the mock dev panel can change it too. */
export const sceneOverride = createStore<string | null>(params.get('scene'));

// ---- Toasts ----

export const toast = createStore<{ id: number; text: string; error?: boolean } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, error = false): void {
  toast.set({ id: Date.now(), text, error });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(null), 3500);
}

/** Run an adapter action; on failure show an error toast instead of throwing. */
export async function act<T>(p: Promise<T>, failMsg = 'That didn’t work. Try again.'): Promise<T | undefined> {
  try {
    return await p;
  } catch (e) {
    console.error(e);
    showToast(failMsg, true);
    return undefined;
  }
}

/**
 * Features that hide entirely (rather than showing "Not connected") until they're configured.
 * Mock mode shows everything.
 */
export function enabled(feature: 'tasks' | 'reminders'): boolean {
  if (adapter.isMock) return true;
  switch (feature) {
    case 'tasks': return config.kids.some((k) => !!k.todo);
    case 'reminders': return !!config.homeReminders;
  }
}
