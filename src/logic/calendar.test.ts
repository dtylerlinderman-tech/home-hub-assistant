import { describe, expect, it } from 'vitest';
import { agenda, eventsOnDay } from './calendar';
import type { CalendarEvent } from '../data/adapter';

const ev = (title: string, start: Date, end: Date, allDay = false): CalendarEvent => ({ title, start, end, allDay, person: 'Family' });
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m); // October 2026

// Shaped like the real calendar on 2026-10-26.
const chicago = ev('Alex | Chicago Event', at(28, 6), at(29, 16));
const science = ev('Science Day Help', at(29, 10), at(29, 12, 30));
const dinner = ev('Sam Dinner', at(27, 18), at(27, 21));
const fall = ev('Fall break', at(29, 0), at(31, 0), true); // all day Thu–Fri; HA's end date is exclusive

describe('eventsOnDay', () => {
  it('shows a trip that crosses midnight on both days', () => {
    expect(eventsOnDay([chicago], at(28, 0))).toEqual([{ ev: chicago, time: '6:00 AM', note: 'Day 1 of 2' }]);
    expect(eventsOnDay([chicago], at(29, 0))).toEqual([{ ev: chicago, time: 'Until 4:00 PM', note: 'Day 2 of 2' }]);
    expect(eventsOnDay([chicago], at(30, 0))).toEqual([]);
  });

  it('labels the middle of a long event All day', () => {
    const week = ev('Beach week', at(26, 15), at(28, 10));
    expect(eventsOnDay([week], at(27, 0))[0]).toMatchObject({ time: 'All day', note: 'Day 2 of 3' });
  });

  it('treats an all-day end date as exclusive', () => {
    expect(eventsOnDay([fall], at(29, 0))[0]).toMatchObject({ time: 'All day', note: 'Day 1 of 2' });
    expect(eventsOnDay([fall], at(30, 0))[0]).toMatchObject({ time: 'All day', note: 'Day 2 of 2' });
    expect(eventsOnDay([fall], at(31, 0))).toEqual([]);
    const oneDay = ev('Pajama day', at(29, 0), at(30, 0), true);
    expect(eventsOnDay([oneDay], at(29, 0))[0]).toMatchObject({ time: 'All day', note: null });
  });

  it('puts all-day and continuing events before timed ones', () => {
    expect(eventsOnDay([science, chicago, fall], at(29, 0)).map((i) => i.ev.title))
      .toEqual(['Alex | Chicago Event', 'Fall break', 'Science Day Help']);
  });
});

describe('agenda', () => {
  it('lists the week from today, skipping empty days', () => {
    const days = agenda([chicago, science, dinner], at(26, 9), 7);
    expect(days.map((d) => d.day.getDate())).toEqual([27, 28, 29]);
    expect(days[2].items.map((i) => i.ev.title)).toEqual(['Alex | Chicago Event', 'Science Day Help']);
  });
});
