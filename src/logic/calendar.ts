// Which events fall on a day, and how to label them, including events that run across several days
// (a trip from Wed 6 AM to Thu 4 PM shows on both days). Pure functions.
import type { CalendarEvent } from '../data/adapter';
import { addDays, fmtTime, startOfDay } from './time';

export interface DayItem {
  ev: CalendarEvent;
  time: string; // "6:00 AM", "All day", "Until 4:00 PM"
  note: string | null; // "Day 1 of 2" for multi-day events
}

/** The calendar days an event touches. All-day ends are exclusive (HA gives the day after). */
function span(ev: CalendarEvent): { first: Date; last: Date; days: number } {
  const first = startOfDay(ev.start);
  const endInclusive = ev.end.getTime() > ev.start.getTime() ? new Date(ev.end.getTime() - 1) : ev.start;
  const last = startOfDay(endInclusive);
  const days = Math.round((last.getTime() - first.getTime()) / 864e5) + 1;
  return { first, last, days };
}

/** Events on `day`, labelled and sorted: all-day and ongoing first, then by time. */
export function eventsOnDay(events: CalendarEvent[], day: Date): DayItem[] {
  const d0 = startOfDay(day).getTime();
  const items: (DayItem & { key: number })[] = [];
  for (const ev of events) {
    const { first, last, days } = span(ev);
    if (d0 < first.getTime() || d0 > last.getTime()) continue;
    const n = Math.round((d0 - first.getTime()) / 864e5) + 1;
    const isFirst = n === 1, isLast = d0 === last.getTime();
    const time = ev.allDay || (!isFirst && !isLast) ? 'All day'
      : isFirst ? fmtTime(ev.start)
      : 'Until ' + fmtTime(ev.end);
    items.push({ ev, time, note: days > 1 ? `Day ${n} of ${days}` : null, key: time === 'All day' || !isFirst ? -1 : ev.start.getTime() });
  }
  return items.sort((a, b) => a.key - b.key).map(({ key: _, ...it }) => it);
}

/** The next `days` days from `from`, keeping only days with something on them. */
export function agenda(events: CalendarEvent[], from: Date, days = 7): { day: Date; items: DayItem[] }[] {
  return Array.from({ length: days }, (_, i) => addDays(startOfDay(from), i))
    .map((day) => ({ day, items: eventsOnDay(events, day) }))
    .filter((d) => d.items.length > 0);
}
