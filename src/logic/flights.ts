// Flight status for the Home card: where a tracked flight is in its day, worded for the kitchen. Pure functions.
import type { Flight } from '../data/adapter';
import { fmtTime } from './time';

const SHOW_AFTER_LANDING_MS = 3 * 3600e3;
const SHOW_BEFORE_DEPARTURE_MS = 24 * 3600e3;
const LATE_MS = 15 * 60e3;
const LOST_AFTER_MS = 20 * 60e3;

export type FlightPhase = 'scheduled' | 'delayed' | 'air' | 'landed';

export interface FlightView {
  phase: FlightPhase;
  status: string; // "Departs 7:10 AM", "Delayed · departs 7:45 AM", "In the air · lands 9:42 AM", "Landed 9:38 AM"
  progress: number | null; // 0–1 while in the air
}

const dep = (f: Flight) => f.departed ?? f.estDeparture ?? f.schedDeparture;
const arr = (f: Flight) => f.arrived ?? f.estArrival ?? f.schedArrival;

export function flightView(f: Flight, now: number): FlightView {
  // Landed: a real arrival time, or on the ground near arrival, or (if FR24 lost the plane, e.g. "N/A" position)
  // well past the expected arrival.
  const pastDue = f.departed != null && now > (arr(f) ?? Infinity) + LOST_AFTER_MS;
  if (f.arrived != null || pastDue || (f.onGround && f.departed != null && now > (arr(f) ?? Infinity) - 30 * 60e3)) {
    return { phase: 'landed', status: 'Landed' + (f.arrived ? ' ' + fmtTime(new Date(f.arrived)) : ''), progress: 1 };
  }
  if (f.departed != null && !f.onGround) {
    const a = arr(f);
    const progress = a && a > f.departed ? Math.min(1, Math.max(0, (now - f.departed) / (a - f.departed))) : null;
    const late = a && f.schedArrival && a - f.schedArrival > LATE_MS ? ' (late)' : '';
    return { phase: 'air', status: 'In the air' + (a ? ' · lands ' + fmtTime(new Date(a)) + late : ''), progress };
  }
  const d = dep(f);
  const delayed = f.estDeparture != null && f.schedDeparture != null && f.estDeparture - f.schedDeparture > LATE_MS;
  return {
    phase: delayed ? 'delayed' : 'scheduled',
    status: (delayed ? 'Delayed · departs ' : 'Departs ') + (d ? fmtTime(new Date(d)) : 'time not set'),
    progress: null,
  };
}

// Same patterns as the HA package's kitchen_hub_track_calendar_flights automation.
const CODE_RE = /(?<![A-Z0-9])(DL|AA|UA|WN|B6|AS|NK|F9) ?#?([0-9]{1,4})(?![0-9])/g;
const DELTA_RE = /DELTA(?: AIR LINES)?(?: FLIGHT)? ?#?([0-9]{1,4})(?![0-9])/g;
const MATCH_WINDOW_MS = 3 * 3600e3;

/** Flight numbers in calendar text: "Flight 1 of 2 | DL123 | ATL to MDW" → ["DL123"]. */
export function flightNumbers(text: string): string[] {
  const t = text.toUpperCase();
  return [...new Set([...[...t.matchAll(CODE_RE)].map((m) => m[1] + m[2]), ...[...t.matchAll(DELTA_RE)].map((m) => 'DL' + m[1])])];
}

/**
 * Only flights that are on the calendar: the number appears in an event that starts within 3 hours of the
 * flight's scheduled departure. Flightradar24 tracks a number, not a date, so after landing it moves on to
 * the plane's next leg with the same number (seen live with DL123 ATL→MDW, then MDW→ATL), and a day early
 * it shows the day-before's flight. This keeps the card on your actual flight.
 */
export function onCalendar(flights: Flight[], events: { title: string; start: Date }[]): Flight[] {
  const booked = events.flatMap((e) => flightNumbers(e.title).map((n) => ({ n, at: e.start.getTime() })));
  return flights.filter((f) => {
    const sched = f.schedDeparture ?? dep(f);
    return sched != null && booked.some((b) => b.n === f.number.toUpperCase() && Math.abs(b.at - sched) < MATCH_WINDOW_MS);
  });
}

/** Flights departing within a day, in the air, or landed in the last few hours; soonest first. */
export function flightsToShow(flights: Flight[], now: number): Flight[] {
  return flights
    .filter((f) => {
      const v = flightView(f, now);
      if (v.phase === 'landed') return now - (f.arrived ?? arr(f) ?? now) < SHOW_AFTER_LANDING_MS;
      if (v.phase === 'air') return true;
      const d = dep(f);
      return d == null || d - now < SHOW_BEFORE_DEPARTURE_MS;
    })
    .sort((a, b) => (dep(a) ?? 0) - (dep(b) ?? 0));
}
