// Vacuum screen logic: room recency and labels. Pure functions.
import { fmtTime, startOfDay } from './time';
import type { MissionResult, VacuumStatus } from '../data/adapter';

export type Recency = 'today' | 'recent' | 'due' | 'never';

const DAY = 24 * 3600e3;
/** Rooms not cleaned for more than this many days count as due. */
export const DUE_AFTER_DAYS = 3;

/** Whole calendar days between a time and today (0 = today, 1 = yesterday). */
export function daysAgo(t: number, now: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(new Date(t)).getTime()) / DAY);
}

export function recency(lastCleaned: number | null, now: Date): Recency {
  if (lastCleaned == null) return 'never';
  const d = daysAgo(lastCleaned, now);
  if (d <= 0) return 'today';
  return d <= DUE_AFTER_DAYS ? 'recent' : 'due';
}

export function lastCleanedLabel(lastCleaned: number | null, now: Date): string {
  if (lastCleaned == null) return 'Not cleaned recently';
  const d = daysAgo(lastCleaned, now);
  if (d <= 0) return 'Cleaned today ' + fmtTime(new Date(lastCleaned));
  if (d === 1) return 'Cleaned yesterday';
  return 'Cleaned ' + d + ' days ago';
}

/** "Today 9:40 AM", "Yesterday 4:10 PM", "Mon 9:00 AM" */
export function whenLabel(t: number, now: Date): string {
  const d = daysAgo(t, now);
  const time = fmtTime(new Date(t));
  if (d <= 0) return 'Today ' + time;
  if (d === 1) return 'Yesterday ' + time;
  if (d < 7) return new Date(t).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + time;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function statusLabel(status: VacuumStatus, room: string | null): string {
  switch (status) {
    case 'cleaning': return room ? 'Cleaning the ' + room.toLowerCase() : 'Cleaning';
    case 'paused': return 'Paused';
    case 'returning': return 'Heading home';
    case 'docked': return 'Docked';
    case 'charging': return 'Charging';
    case 'idle': return 'Ready';
    case 'stuck': return 'Stuck';
    case 'error': return 'Needs help';
  }
}

/** Is a run in progress (so the controls show Pause / Send home)? */
export function isRunning(status: VacuumStatus): boolean {
  return status === 'cleaning' || status === 'paused' || status === 'stuck' || status === 'error';
}

export const RESULT_LABEL: Record<MissionResult, string> = {
  completed: 'Finished',
  cancelled: 'Stopped early',
  stuck: 'Got stuck',
  error: 'Error',
};

/** Room names for a run: "Kitchen & dining room", "Kitchen, entry & hallway", or "Whole home". */
export function roomsLabel(rooms: string[] | null): string {
  if (!rooms || rooms.length === 0) return 'Whole home';
  const names = rooms.map((r, i) => (i === 0 ? r : r.toLowerCase()));
  return names.length <= 2 ? names.join(' & ') : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

export const M2_TO_SQFT = 10.7639;
