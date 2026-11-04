// Meal suggestion rules (HANDOFF §7 Meals). Pure functions; days are 0 = Monday … 6 = Sunday.

export interface PoolMeal {
  id: string;
  name: string;
  mins: number;
  tags: string[];
}

export type RuleKey = 'quick' | 'grill' | 'slow' | 'leftovers';
export type Rules = Record<RuleKey, boolean>;

export const RULE_DEFS: { key: RuleKey; label: string; sub: string }[] = [
  { key: 'quick', label: 'Quick weeknights', sub: 'Mon–Thu: Weeknight meals, or 35 min or less' },
  { key: 'grill', label: 'Grill Saturday', sub: 'Saturday picks from grill meals' },
  { key: 'slow', label: 'Slow cooker Sunday', sub: 'Sunday picks from slow cooker meals' },
  { key: 'leftovers', label: 'Leftovers Wednesday', sub: 'Skip cooking midweek' },
];

export const QUICK_MAX_MINS = 35;
export const LEFTOVERS_DAY = 2;

/** A planned day: a recipe id, or null for a leftovers night. */
export type PlanDay = string | null;

export function isLeftoversDay(day: number, rules: Rules): boolean {
  return rules.leftovers && day === LEFTOVERS_DAY;
}

/** The rule that limits this day, if it's on: Mon–Thu quick, Saturday grill, Sunday slow cooker. */
function dayRule(day: number, rules: Rules): ((m: PoolMeal) => boolean) | null {
  if (rules.quick && day <= 3) return (m) => m.tags.includes('Weeknight') || m.mins <= QUICK_MAX_MINS;
  if (rules.grill && day === 5) return (m) => m.tags.includes('Grill');
  if (rules.slow && day === 6) return (m) => m.tags.includes('Slow cooker');
  return null;
}

/** Meals a rule allows on this day. A rule no meal fits yet (say, nothing tagged Slow cooker) is ignored for that day. */
export function eligible(pool: PoolMeal[], day: number, rules: Rules): PoolMeal[] {
  const ok = dayRule(day, rules);
  const fits = ok ? pool.filter(ok) : pool;
  return fits.length ? fits : pool;
}

/** Rules that are on but match no meal in the pool, so they're being ignored. */
export function unmatchedRules(pool: PoolMeal[], rules: Rules): RuleKey[] {
  const days: [RuleKey, number][] = [['quick', 0], ['grill', 5], ['slow', 6]];
  return days.filter(([k, d]) => rules[k] && pool.length > 0 && !pool.some(dayRule(d, rules)!)).map(([k]) => k);
}

/**
 * Pick from `list`, never repeating anything in `usedThisWeek` if avoidable,
 * and preferring meals not in `lastWeek`.
 */
export function pick(list: PoolMeal[], usedThisWeek: string[], lastWeek: string[], rng: () => number): PoolMeal | null {
  if (!list.length) return null;
  const noRepeat = list.filter((m) => !usedThisWeek.includes(m.id));
  const fresh = noRepeat.filter((m) => !lastWeek.includes(m.id));
  const from = fresh.length ? fresh : noRepeat.length ? noRepeat : list;
  return from[Math.floor(rng() * from.length)] ?? null;
}

function ids(days: PlanDay[]): string[] {
  return days.filter((x): x is string => !!x);
}

/** Note title for a night that needs no dinner. Suggest and Swap leave it alone. */
export const EATING_OUT = 'Eating out';

/**
 * Fill the open nights. `keep[d]` is what's already planned: a recipe id (kept, and counts as used),
 * null for a note night like Eating out (skipped), or undefined for an open night.
 */
export function suggestWeek(pool: PoolMeal[], rules: Rules, lastWeek: PlanDay[], rng: () => number = Math.random, keep: (PlanDay | undefined)[] = []): PlanDay[] {
  const week: PlanDay[] = [0, 1, 2, 3, 4, 5, 6].map((d) => keep[d] ?? null);
  // Fill the most constrained days first so Friday can't take Saturday's only grill meal.
  const order = [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => keep[d] === undefined && !isLeftoversDay(d, rules))
    .map((d) => ({ d, options: eligible(pool, d, rules) }))
    .sort((a, b) => a.options.length - b.options.length || a.d - b.d);
  for (const { d, options } of order) week[d] = pick(options, ids(week), ids(lastWeek), rng)?.id ?? null;
  return week;
}

/** Replace one day with a different eligible meal. */
export function swapDay(pool: PoolMeal[], rules: Rules, week: PlanDay[], day: number, lastWeek: PlanDay[] = [], rng: () => number = Math.random): PlanDay[] {
  const next = week.slice();
  if (isLeftoversDay(day, rules)) { next[day] = null; return next; }
  const others = ids(week.filter((_, i) => i !== day));
  const options = eligible(pool, day, rules).filter((m) => m.id !== week[day]);
  const choice = pick(options, others, ids(lastWeek), rng);
  if (choice) next[day] = choice.id;
  return next;
}
