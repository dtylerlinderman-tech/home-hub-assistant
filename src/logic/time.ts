// Clock with an optional ?now= override so screenshots and tests are repeatable.
// The override sets a starting point; the clock keeps ticking from there.

let offsetMs = 0;

export function setNowOverride(iso: string | null): void {
  if (!iso) { offsetMs = 0; return; }
  const t = new Date(iso).getTime();
  if (!Number.isNaN(t)) offsetMs = t - Date.now();
}

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export function nowMs(): number {
  return Date.now() + offsetMs;
}

export const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DowKey = (typeof DOW_KEYS)[number];

export function dowKey(d: Date): DowKey {
  return DOW_KEYS[d.getDay()];
}

/** 0 = Monday … 6 = Sunday */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -mondayIndex(d));
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isoDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** "HH:MM" → minutes since midnight */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function clockParts(d: Date): { time: string; ampm: string } {
  const h = d.getHours();
  return { time: (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0'), ampm: h >= 12 ? 'PM' : 'AM' };
}

/** "8:46 AM" */
export function fmtTime(d: Date): string {
  const p = clockParts(d);
  return p.time + ' ' + p.ampm;
}

/** minutes since midnight → "8:46 AM" */
export function fmtMinOfDay(min: number): string {
  return fmtTime(new Date(2000, 0, 1, Math.floor(min / 60), min % 60));
}

/** "9:00", no AM/PM, as in "to arrive for 9:00 drop-off" */
export function fmtShortHm(min: number): string {
  const h = Math.floor(min / 60);
  return (h % 12 || 12) + ':' + String(min % 60).padStart(2, '0');
}

export function fmtLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function monthName(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long' });
}

/** "October 19 – 25" or "October 26 – November 1" */
export function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6);
  return monthName(start) === monthName(end)
    ? monthName(start) + ' ' + start.getDate() + ' – ' + end.getDate()
    : monthName(start) + ' ' + start.getDate() + ' – ' + monthName(end) + ' ' + end.getDate();
}

export function fmtMins(m: number): string {
  return m >= 120 ? Math.round(m / 60) + ' hr' : m + ' min';
}

/** seconds → "20:00" / "1:05:00" */
export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
}
