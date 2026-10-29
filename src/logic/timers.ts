// Duration parsing for cook-mode timers (HANDOFF §7 Cook).
// "20 minutes", "1 hr 15 min", "5–7 minutes" (a range uses the upper bound), "30 seconds".

const NUM = String.raw`(\d+(?:\.\d+)?|an?|one|half)`;
const RANGE = String.raw`${NUM}(?:\s*(?:-|–|—|to|or)\s*${NUM})?`;
const UNIT = String.raw`(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b`;
const PART = new RegExp(String.raw`\b${RANGE}\s*(?:an?\s+)?${UNIT}`, 'gi');

function num(s: string | undefined): number {
  if (!s) return NaN;
  const t = s.toLowerCase();
  if (t === 'a' || t === 'an' || t === 'one') return 1;
  if (t === 'half') return 0.5;
  return parseFloat(t);
}

function unitSeconds(u: string): number {
  const c = u.toLowerCase()[0];
  return c === 'h' ? 3600 : c === 'm' ? 60 : 1;
}

/**
 * Total seconds of the first duration in the text, or null.
 * Adjacent parts ("1 hr 15 min", "1 hour and 15 minutes") are summed.
 */
export function parseDuration(text: string): number | null {
  // "a"/"one"/"half" only count with hours or minutes: "in a second bowl" is not a 1-second timer.
  const matches = [...text.matchAll(PART)].filter((m) => /\d/.test(m[1]) || /^[hm]/i.test(m[3]));
  if (!matches.length) return null;
  let total = 0;
  let end = -1;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (end >= 0 && !/^\s*(?:,|and)?\s*$/i.test(text.slice(end, start))) break;
    const lo = num(m[1]);
    const hi = num(m[2]);
    const value = Number.isNaN(hi) ? lo : Math.max(lo, hi);
    if (Number.isNaN(value)) break;
    total += value * unitSeconds(m[3]);
    end = start + m[0].length;
  }
  return total > 0 ? Math.round(total) : null;
}

/** A short label for a step's timer: the leading verb, e.g. "Roast". */
export function timerLabel(text: string): string {
  const w = text.trim().match(/^[A-Za-z]+/);
  return w ? w[0][0].toUpperCase() + w[0].slice(1).toLowerCase() : 'Timer';
}
