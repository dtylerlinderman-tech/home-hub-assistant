// Which followed games the Home card shows, and how to word their status. Pure functions.
import type { Game } from '../data/adapter';
import { addDays, fmtTime, sameDay, startOfDay } from './time';

const FINAL_FOR_MS = 20 * 3600e3; // a final stays up until the next morning
const AHEAD_MS = 7 * 24 * 3600e3;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Live games first, then recent finals, then games in the next week by start time. At most `max`. */
export function gamesToShow(games: Game[], now: number, max = 3): Game[] {
  const rank = { in: 0, post: 1, pre: 2 } as const;
  return games
    .filter((g) => g.state === 'in'
      || (g.state === 'post' && now - g.start < FINAL_FOR_MS)
      || (g.state === 'pre' && g.start - now < AHEAD_MS && g.start > now - 6 * 3600e3))
    .sort((a, b) => rank[a.state] - rank[b.state] || (a.state === 'post' ? b.start - a.start : a.start - b.start))
    .slice(0, max);
}

/** "Today 7:30 PM", "Tomorrow 1:00 PM", "Sat 7:30 PM" */
export function kickoff(start: number, now: Date): string {
  const d = new Date(start);
  const day = sameDay(d, now) ? 'Today' : sameDay(d, addDays(startOfDay(now), 1)) ? 'Tomorrow' : DOW[d.getDay()];
  return day + ' ' + fmtTime(d);
}

/** "Final · W", "Final · L", "Final · T" */
export function finalText(g: Game): string {
  const r = g.team.winner === true ? 'W' : g.opponent.winner === true ? 'L' : g.team.score != null && g.team.score === g.opponent.score ? 'T' : null;
  return 'Final' + (r ? ' · ' + r : '');
}
