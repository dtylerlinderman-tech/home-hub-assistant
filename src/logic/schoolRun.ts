// School-run card logic (HANDOFF §7 Home). Pure functions.
import { dowKey, hmToMin, minutesOfDay, type DowKey } from './time';

export interface SchoolRunConfig {
  name: string;
  address?: string;
  travelSensor?: string;
  days: DowKey[];
  dropoff: string;
  pickup: string;
  leaveBufferMin: number;
  dropoffWindow: [string, string];
  pickupWindow: [string, string];
}

export type Scene = 'dropoff' | 'pickup' | 'dinner';
export type Traffic = 'light' | 'moderate' | 'heavy';

export function sceneAt(d: Date, cfg: SchoolRunConfig | undefined): Scene {
  if (!cfg || !cfg.days.includes(dowKey(d))) return 'dinner';
  const m = minutesOfDay(d);
  const inWin = (w: [string, string]) => m >= hmToMin(w[0]) && m <= hmToMin(w[1]);
  if (inWin(cfg.dropoffWindow)) return 'dropoff';
  if (inWin(cfg.pickupWindow)) return 'pickup';
  return 'dinner';
}

/** Minutes since midnight to leave by: event time − drive − buffer. */
export function leaveByMin(eventHm: string, driveMin: number, bufferMin: number): number {
  return hmToMin(eventHm) - Math.round(driveMin) - bufferMin;
}

/** Light ≤2 min over usual, Moderate ≤6, Heavy beyond. Null without a usual time. */
export function trafficLevel(driveMin: number, usualMin: number | null): Traffic | null {
  if (usualMin == null) return null;
  const delta = driveMin - usualMin;
  if (delta <= 2) return 'light';
  if (delta <= 6) return 'moderate';
  return 'heavy';
}

export function deltaText(driveMin: number, usualMin: number | null): string {
  if (usualMin == null) return '';
  const d = Math.round(driveMin - usualMin);
  if (Math.abs(d) <= 1) return 'About normal';
  return Math.abs(d) + ' min ' + (d > 0 ? 'slower' : 'faster') + ' than usual';
}

/**
 * "Usual" drive time for a window: for each of the last 4 same-weekday days before today that have
 * readings inside the window, take that day's average, then average those. Null until 4 such days exist.
 */
export function usualFromHistory(points: { t: number; v: number }[], now: Date, window: [string, string]): number | null {
  const lo = hmToMin(window[0]);
  const hi = hmToMin(window[1]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const byDay = new Map<number, number[]>();
  for (const p of points) {
    const d = new Date(p.t);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const m = minutesOfDay(d);
    if (day >= today || d.getDay() !== now.getDay() || m < lo || m > hi || !Number.isFinite(p.v)) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), p.v]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return usualMinutes(days.map((d) => { const v = byDay.get(d)!; return v.reduce((a, b) => a + b, 0) / v.length; }));
}

/** Average of the last 4 readings; null until 4 exist. */
export function usualMinutes(readings: number[]): number | null {
  if (readings.length < 4) return null;
  const last = readings.slice(-4);
  return last.reduce((a, b) => a + b, 0) / last.length;
}
