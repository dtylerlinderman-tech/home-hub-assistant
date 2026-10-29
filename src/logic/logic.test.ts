import { describe, expect, it } from 'vitest';
import { eligible, suggestWeek, swapDay, type PoolMeal, type Rules } from './mealRules';
import { parseDuration, timerLabel } from './timers';
import { deltaText, leaveByMin, sceneAt, trafficLevel, usualFromHistory, usualMinutes, type SchoolRunConfig } from './schoolRun';
import { matchIngredients } from './ingredients';
import { fmtCountdown, fmtWeekRange, startOfWeek } from './time';

const pool: PoolMeal[] = [
  { id: 'fajitas', name: 'Fajitas', mins: 35, tags: ['Weeknight'] },
  { id: 'spaghetti', name: 'Spaghetti', mins: 40, tags: ['Kids'] },
  { id: 'salmon', name: 'Salmon', mins: 30, tags: ['Grill'] },
  { id: 'tacos', name: 'Tacos', mins: 25, tags: ['Weeknight', 'Kids'] },
  { id: 'stirfry', name: 'Stir-fry', mins: 25, tags: ['Weeknight'] },
  { id: 'burgers', name: 'Burgers', mins: 40, tags: ['Grill', 'Kids'] },
  { id: 'roast', name: 'Pot roast', mins: 480, tags: ['Slow cooker'] },
  { id: 'pizza', name: 'Pizza', mins: 45, tags: ['Kids'] },
  { id: 'eggs', name: 'Breakfast', mins: 20, tags: ['Weeknight', 'Kids'] },
  { id: 'chili', name: 'Chili', mins: 60, tags: ['Slow cooker'] },
];
const allOn: Rules = { quick: true, grill: true, slow: true, leftovers: true };
const byId = Object.fromEntries(pool.map((m) => [m.id, m]));

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('mealRules', () => {
  it('limits Mon–Thu to quick meals', () => {
    for (const d of [0, 1, 2, 3]) expect(eligible(pool, d, allOn).every((m) => m.mins <= 35)).toBe(true);
    expect(eligible(pool, 4, allOn).some((m) => m.mins > 35)).toBe(true);
  });

  it('grill Saturday and slow cooker Sunday', () => {
    expect(eligible(pool, 5, allOn).map((m) => m.id).sort()).toEqual(['burgers', 'salmon']);
    expect(eligible(pool, 6, allOn).map((m) => m.id).sort()).toEqual(['chili', 'roast']);
  });

  it('suggests a full week with no repeats and leftovers Wednesday', () => {
    for (let s = 1; s < 30; s++) {
      const week = suggestWeek(pool, allOn, [], seeded(s));
      expect(week).toHaveLength(7);
      expect(week[2]).toBeNull();
      const ids = week.filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
      expect(byId[week[5]!].tags).toContain('Grill');
      expect(byId[week[6]!].tags).toContain('Slow cooker');
      for (const d of [0, 1, 3]) expect(byId[week[d]!].mins).toBeLessThanOrEqual(35);
    }
  });

  it('prefers meals not used last week', () => {
    const last = ['tacos', 'stirfry', null, 'eggs', 'pizza', 'salmon', 'roast'];
    const week = suggestWeek(pool, allOn, last, seeded(7));
    // Saturday and Sunday each have one fresh option left.
    expect(week[5]).toBe('burgers');
    expect(week[6]).toBe('chili');
    expect(week[0]).toBe('fajitas');
  });

  it('fills only open nights: keeps picks and skips eating-out nights', () => {
    const keep = [undefined, null, undefined, 'tacos', undefined, undefined, undefined];
    for (let s = 1; s < 30; s++) {
      const week = suggestWeek(pool, allOn, [], seeded(s), keep);
      expect(week[1]).toBeNull();
      expect(week[3]).toBe('tacos');
      expect(week.filter((x, i) => i !== 3 && x === 'tacos')).toHaveLength(0);
      for (const d of [0, 4, 5, 6]) expect(week[d]).not.toBeNull();
    }
  });

  it('swaps one day for a different eligible meal', () => {
    const week = ['tacos', 'fajitas', 'stirfry', 'eggs', 'pizza', 'salmon', 'roast'];
    const rules = { ...allOn, leftovers: false };
    const next = swapDay(pool, rules, week, 5, [], seeded(3));
    expect(next[5]).toBe('burgers');
    expect(next.filter((_, i) => i !== 5)).toEqual(week.filter((_, i) => i !== 5));
  });
});

describe('timers', () => {
  it.each([
    ['Roast for 20 minutes, stirring once', 1200],
    ['Simmer 1 hr 15 min', 4500],
    ['Bake 1 hour and 15 minutes', 4500],
    ['Cook 5–7 minutes per side', 420],
    ['Cook 5-7 minutes', 420],
    ['Cook 3 to 4 minutes', 240],
    ['Rest 30 seconds', 30],
    ['Warm them in the oven for the last 5 minutes.', 300],
    ['Let it sit for an hour', 3600],
    ['Microwave 90 secs', 90],
    ['Bake 25 mins', 1500],
  ])('%s → %i s', (text, secs) => {
    expect(parseDuration(text)).toBe(secs);
  });

  it('ignores text without a duration', () => {
    expect(parseDuration('Heat the oven to 425°F.')).toBeNull();
    expect(parseDuration('Add 2 tsp salt')).toBeNull();
    expect(parseDuration('Serve with 8 tortillas')).toBeNull();
    expect(parseDuration('In a second shallow bowl, whisk the eggs.')).toBeNull();
    expect(parseDuration('Let it rest for a minute.')).toBe(60);
  });

  it('labels a timer by its verb', () => {
    expect(timerLabel('Roast for 20 minutes')).toBe('Roast');
  });

  it('formats countdowns', () => {
    expect(fmtCountdown(1200)).toBe('20:00');
    expect(fmtCountdown(65)).toBe('1:05');
    expect(fmtCountdown(3900)).toBe('1:05:00');
  });
});

describe('schoolRun', () => {
  const cfg: SchoolRunConfig = {
    name: 'School', days: ['tue', 'thu'], dropoff: '09:00', pickup: '14:00', leaveBufferMin: 5,
    dropoffWindow: ['07:00', '09:15'], pickupWindow: ['12:30', '14:15'],
  };
  const at = (iso: string) => new Date(iso);

  it('picks the scene from day and window', () => {
    expect(sceneAt(at('2026-10-20T08:32'), cfg)).toBe('dropoff'); // Tuesday
    expect(sceneAt(at('2026-10-20T13:00'), cfg)).toBe('pickup');
    expect(sceneAt(at('2026-10-20T17:45'), cfg)).toBe('dinner');
    expect(sceneAt(at('2026-10-21T08:32'), cfg)).toBe('dinner'); // Wednesday
    expect(sceneAt(at('2026-10-22T09:15'), cfg)).toBe('dropoff'); // window end is inclusive
    expect(sceneAt(at('2026-10-22T06:59'), cfg)).toBe('dinner');
  });

  it('computes leave-by with the buffer', () => {
    expect(leaveByMin('09:00', 14, 5)).toBe(8 * 60 + 41);
    expect(leaveByMin('14:00', 11, 5)).toBe(13 * 60 + 44);
  });

  it('grades traffic by delta', () => {
    expect(trafficLevel(12, 10)).toBe('light');
    expect(trafficLevel(16, 10)).toBe('moderate');
    expect(trafficLevel(16.5, 10)).toBe('heavy');
    expect(trafficLevel(16, null)).toBeNull();
  });

  it('describes the delta', () => {
    expect(deltaText(14, 10)).toBe('4 min slower than usual');
    expect(deltaText(11, 11.4)).toBe('About normal');
    expect(deltaText(8, 11)).toBe('3 min faster than usual');
    expect(deltaText(8, null)).toBe('');
  });

  it('computes usual from the last four same-weekday windows', () => {
    const now = new Date(2026, 9, 20, 8, 30); // Tuesday
    const pt = (y: number, mo: number, d: number, h: number, m: number, v: number) => ({ t: new Date(y, mo, d, h, m).getTime(), v });
    const win: [string, string] = ['07:00', '09:15'];
    const recent = [
      pt(2026, 8, 29, 8, 0, 10), pt(2026, 8, 29, 8, 30, 12), // Tue Sep 29: day average 11
      pt(2026, 9, 6, 8, 15, 9), // Tue Oct 6
      pt(2026, 9, 13, 8, 0, 10), pt(2026, 9, 13, 12, 0, 99), // Tue Oct 13; the noon reading is outside the window
      pt(2026, 9, 14, 8, 0, 50), // a Wednesday: ignored
      pt(2026, 9, 20, 8, 0, 40), // today: ignored
    ];
    expect(usualFromHistory(recent, now, win)).toBeNull(); // only 3 Tuesdays so far
    const withMore = [pt(2026, 8, 15, 8, 0, 30), pt(2026, 8, 22, 8, 0, 14), ...recent]; // 5 Tuesdays
    expect(usualFromHistory(withMore, now, win)).toBe((14 + 11 + 9 + 10) / 4); // Sep 15 drops off
  });

  it('averages the last four readings', () => {
    expect(usualMinutes([10, 11, 12])).toBeNull();
    expect(usualMinutes([30, 10, 11, 9, 10])).toBe(10);
  });
});

describe('ingredients', () => {
  const ings = [
    { id: 'chicken', name: 'chicken breast, thinly sliced' },
    { id: 'peppers', name: 'bell peppers, sliced' },
    { id: 'oil', name: 'olive oil' },
    { id: 'cumin', name: 'ground cumin' },
    { id: 'tortillas', name: 'flour tortillas' },
  ];
  it('matches ingredient names in step text', () => {
    expect(matchIngredients('Toss the chicken, peppers and onion with the olive oil.', ings)).toEqual(['chicken', 'peppers', 'oil']);
    expect(matchIngredients('Stir in the cumin.', ings)).toEqual(['cumin']);
    expect(matchIngredients('Warm the tortillas.', ings)).toEqual(['tortillas']);
    expect(matchIngredients('Heat the oven.', ings)).toEqual([]);
    const real = [{ id: 'breast', name: 'boneless, skinless chicken breasts, cut in half' }, { id: 'garlic', name: 'freshly minced garlic' }];
    expect(matchIngredients('Add the chicken and the garlic.', real)).toEqual(['breast', 'garlic']);
  });
});

describe('time', () => {
  it('formats a week range', () => {
    expect(fmtWeekRange(startOfWeek(new Date(2026, 9, 20)))).toBe('October 19 – 25');
    expect(fmtWeekRange(new Date(2026, 9, 26))).toBe('October 26 – November 1');
  });
});
