// How to word a game's start time on the Games screen. Pure function.
import { addDays, fmtTime, sameDay, startOfDay } from './time';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "Today 7:30 PM", "Tomorrow 1:00 PM", "Sat 7:30 PM" this week; "Fri, Feb 19 1:05 PM" further out.
 * ESPN lists a game with no start time yet at midnight, so midnight shows just the day.
 */
export function kickoff(start: number, now: Date): string {
  const d = new Date(start);
  const today = startOfDay(now);
  const day = sameDay(d, now) ? 'Today'
    : sameDay(d, addDays(today, 1)) ? 'Tomorrow'
    : d < addDays(today, 7) ? DOW[d.getDay()]
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const tbd = d.getHours() === 0 && d.getMinutes() === 0;
  return tbd ? day : day + ' ' + fmtTime(d);
}
