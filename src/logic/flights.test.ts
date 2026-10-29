import { describe, expect, it } from 'vitest';
import { flightNumbers, flightView, flightsToShow, onCalendar } from './flights';
import type { Flight } from '../data/adapter';

const T = new Date(2026, 9, 28, 7, 0).getTime(); // Wed 7:00 AM
const M = 60e3;
const flight = (over: Partial<Flight> = {}): Flight => ({
  id: 'x', number: 'DL2290', airline: 'Delta',
  from: { code: 'ATL', city: 'Atlanta' }, to: { code: 'ORD', city: 'Chicago' },
  schedDeparture: T + 10 * M, estDeparture: T + 10 * M, departed: null,
  schedArrival: T + 115 * M, estArrival: T + 115 * M, arrived: null,
  onGround: true, altitude: 0, speed: 0, photo: null, ...over,
});

describe('flightView', () => {
  it('walks through a flight’s day', () => {
    expect(flightView(flight(), T)).toEqual({ phase: 'scheduled', status: 'Departs 7:10 AM', progress: null });
    expect(flightView(flight({ estDeparture: T + 45 * M }), T).status).toBe('Delayed · departs 7:45 AM');
    const air = flightView(flight({ departed: T + 12 * M, onGround: false }), T + 62 * M);
    expect(air.phase).toBe('air');
    expect(air.status).toBe('In the air · lands 8:55 AM');
    expect(air.progress).toBeCloseTo(50 / 103, 3);
    expect(flightView(flight({ departed: T + 12 * M, arrived: T + 112 * M }), T + 120 * M).status).toBe('Landed 8:52 AM');
  });

  it('calls it landed when the data stops well past the expected arrival', () => {
    const lost = flight({ departed: T + 12 * M, onGround: false, altitude: null, speed: null });
    expect(flightView(lost, T + 125 * M).phase).toBe('air');
    expect(flightView(lost, T + 140 * M)).toEqual({ phase: 'landed', status: 'Landed', progress: 1 });
  });

  it('flags a late arrival', () => {
    const v = flightView(flight({ departed: T + 40 * M, onGround: false, estArrival: T + 145 * M }), T + 60 * M);
    expect(v.status).toBe('In the air · lands 9:25 AM (late)');
  });
});

describe('flightsToShow', () => {
  it('keeps today’s and in-air flights, hides old and far-off ones, soonest first', () => {
    const later = flight({ id: 'home', schedDeparture: T + 30 * 3600e3, estDeparture: T + 30 * 3600e3 });
    const tomorrow = flight({ id: 'tomorrow', schedDeparture: T + 20 * 3600e3, estDeparture: T + 20 * 3600e3 });
    const landedLongAgo = flight({ id: 'old', departed: T - 6 * 3600e3, arrived: T - 4 * 3600e3 });
    const landedJustNow = flight({ id: 'just', departed: T - 2 * 3600e3, arrived: T - 30 * M });
    expect(flightsToShow([later, tomorrow, landedLongAgo, landedJustNow, flight({ id: 'now' })], T).map((f) => f.id))
      .toEqual(['just', 'now', 'tomorrow']);
  });
});

describe('flightNumbers and onCalendar', () => {
  it('reads flight numbers the way the Delta app writes them', () => {
    expect(flightNumbers('Flight 1 of 2 | DL123 | ATL to MDW')).toEqual(['DL123']);
    expect(flightNumbers('Alex | Chicago DL 2290')).toEqual(['DL2290']);
    expect(flightNumbers('Delta Flight 387 to Chicago')).toEqual(['DL387']);
    expect(flightNumbers('CLASSIC 2 HVAC')).toEqual([]);
  });

  // What happened live on 2026-10-26: DL123 ATL→MDW landed, then Flightradar24 followed the
  // same plane's MDW→ATL leg, which also flies as DL123.
  it('keeps only the flight that matches the calendar, not the next leg or another day', () => {
    const wed = new Date(2026, 9, 28, 9, 10).getTime();
    const cal = [{ title: 'Flight 1 of 2 | DL123 | ATL to MDW', start: new Date(wed) }];
    const out = flight({ id: 'out', number: 'DL123', schedDeparture: wed });
    const back = flight({ id: 'back', number: 'DL123', from: { code: 'MDW', city: 'Chicago' }, to: { code: 'ATL', city: 'Atlanta' }, schedDeparture: wed + 160 * M + 24 * 60 * M });
    const dayBefore = flight({ id: 'tue', number: 'DL123', schedDeparture: wed - 24 * 3600e3 });
    const other = flight({ id: 'other', number: 'DL456', schedDeparture: wed });
    expect(onCalendar([out, back, dayBefore, other], cal).map((f) => f.id)).toEqual(['out']);
  });
});
