import { useState } from 'preact/hooks';
import { act, adapter, config, showToast } from '../hub';
import { useStore } from '../store';
import { useAsync } from '../useAsync';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { Toggle } from '../components/Toggle';
import { EATING_OUT, RULE_DEFS, isLeftoversDay, suggestWeek, swapDay, type PlanDay, type PoolMeal } from '../logic/mealRules';
import { addDays, fmtMins, fmtWeekRange, isoDate, now, sameDay, startOfWeek } from '../logic/time';
import type { MealPlanDay, RecipeSummary } from '../data/adapter';
import './meals.css';

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Meals() {
  const today = now();
  // Sunday is planning day, so open on next week.
  const [offset, setOffset] = useState(() => (today.getDay() === 0 ? 1 : 0));
  const week = addDays(startOfWeek(today), offset * 7);
  const weekKey = isoDate(week);
  const title = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : fmtWeekRange(week);
  const rules = useStore(adapter.state).mealRules;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const [data, reload] = useAsync(async () => {
    const [plan, last, recipes] = await Promise.all([
      adapter.getMealPlan(week, addDays(week, 7)),
      adapter.getMealPlan(addDays(week, -7), week),
      adapter.getRecipes(),
    ]);
    return { plan, last, recipes };
  }, [weekKey]);

  const recipes = data.value?.recipes ?? null;
  const tags = config.mealie?.mealTags ?? [];
  const pool: PoolMeal[] = (recipes ?? [])
    .filter((r) => r.tags.some((t) => tags.includes(t)))
    .map((r) => ({ id: r.id, name: r.name, mins: r.mins ?? Infinity, tags: r.tags }));
  const byId = new Map<string, RecipeSummary>((recipes ?? []).map((r) => [r.id, r]));

  const days = DOWS.map((_, i) => isoDate(addDays(week, i)));
  const planByDate = new Map<string, MealPlanDay>((data.value?.plan ?? []).map((p) => [p.date, p]));
  const current: PlanDay[] = days.map((d) => planByDate.get(d)?.recipeId ?? null);
  // What Suggest keeps: picked meals, plus note nights like Eating out. Undefined = open night.
  const keep = days.map((d) => (planByDate.has(d) ? planByDate.get(d)!.recipeId : undefined));
  const lastWeek: PlanDay[] = (data.value?.last ?? []).map((p) => p.recipeId);
  const planned = days.filter((d) => planByDate.has(d)).length;
  const [picking, setPicking] = useState<number | null>(null);

  const flash = (text: string) => { setNote(text); setTimeout(() => setNote(''), 3000); };

  async function save(changes: { date: string; recipeId: PlanDay; note?: string }[]) {
    setBusy(true);
    await act(adapter.setMealPlan(changes), 'Couldn’t save the meal plan.');
    setBusy(false);
    reload();
  }

  async function write(next: PlanDay[], only?: number) {
    // Save only days that changed. "No meal" (null) is saved only for an open Leftovers Wednesday;
    // otherwise null just means the rules found nothing to pick, so leave that day alone.
    const changes = next
      .map((recipeId, i) => ({ i, date: days[i], recipeId }))
      .filter(({ i, date, recipeId }) => (only === undefined || i === only)
        && (recipeId !== null ? recipeId !== current[i] : isLeftoversDay(i, rules) && !planByDate.has(date)));
    if (!changes.length) {
      showToast(!pool.length ? 'Tag some recipes Weeknight, Kids, Grill or Slow cooker first.'
        : only !== undefined ? 'No other meal fits that day’s rules.'
        : 'Every night already has a plan. Use swap to change one.');
      return;
    }
    await save(changes.map(({ date, recipeId }) => ({ date, recipeId })));
  }

  const shuffle = () => write(suggestWeek(pool, rules, lastWeek, Math.random, keep));
  const swap = (i: number) => write(swapDay(pool, rules, current, i, lastWeek), i);
  const choose = (i: number, recipeId: PlanDay, noteTitle?: string) => {
    setPicking(null);
    void save([{ date: days[i], recipeId, note: noteTitle }]);
  };

  async function sendList() {
    const ids = current.filter((x): x is string => !!x);
    const ok = await act(adapter.sendGroceryList(ids).then(() => true), 'Couldn’t send the grocery list.');
    if (ok) flash('Grocery list sent to your phone');
  }

  const connected = data.value?.plan !== null && recipes !== null;
  const status = note || (data.loading ? '' : !connected ? 'Meal plan not connected' : planned === 7 ? '7 dinners planned' : planned + ' of 7 dinners planned');

  return (
    <main class="screen meals">
      <header class="meals-head">
        <div class="meals-nav">
          <button type="button" class="btn meals-arrow" aria-label="Previous week" onClick={() => setOffset(offset - 1)}><Icon name="left" size={24} stroke={2.2} /></button>
          <button type="button" class="btn meals-arrow" aria-label="Next week" onClick={() => setOffset(offset + 1)}><Icon name="right" size={24} stroke={2.2} /></button>
          <div class="meals-title">
            <span class="page-title">{title}</span>
            <span class="page-sub">{fmtWeekRange(week)}{status ? ' · ' + status : ''}</span>
          </div>
          {offset !== 0 && <button type="button" class="btn meals-today" onClick={() => setOffset(0)}>This week</button>}
        </div>
        <div class="meals-actions">
          <button type="button" class="btn meals-btn" onClick={sendList} disabled={!connected || busy}><Icon name="cart" size={22} />Grocery list</button>
          <button type="button" class="btn meals-btn primary" onClick={shuffle} disabled={!connected || busy || !pool.length}><Icon name="shuffle" size={22} stroke={2.2} />Suggest open nights</button>
        </div>
      </header>

      <div class="meals-body">
        <section class="meals-week" aria-label="Meal plan">
          {days.map((date, i) => {
            const d = addDays(week, i);
            const isToday = sameDay(d, today);
            const entry = planByDate.get(date);
            const r = entry?.recipeId ? byId.get(entry.recipeId) : undefined;
            const noteNight = !!entry && !entry.recipeId;
            const out = noteNight && entry!.title === EATING_OUT;
            const locked = isLeftoversDay(i, rules);
            const name = r?.name ?? entry?.title ?? 'Nothing planned';
            const meta = r ? [r.mins ? fmtMins(r.mins) : null, ...r.tags].filter(Boolean).join(' · ')
              : out ? 'No cooking · Suggest skips this night' : noteNight ? 'Clean out the fridge' : 'Tap to pick a meal';
            return (
              <div key={date} class={'meals-day' + (isToday ? ' today' : '')}>
                <button type="button" class="btn meals-pick" aria-label={`Choose ${DOWS[i]} ${d.getDate()} dinner: ${name}`} disabled={busy || !connected} onClick={() => setPicking(i)}>
                  <span class="meals-date">
                    <span class="meals-dow">{DOWS[i]}</span>
                    <span class="meals-num">{d.getDate()}</span>
                  </span>
                  <span class="meals-name-wrap">
                    <span class="meals-name" style={{ color: entry ? 'var(--text)' : 'var(--subtle)' }}>{name}</span>
                    <span class="meals-meta">{meta}</span>
                  </span>
                </button>
                {isToday && r && <a href={href('/cook/' + encodeURIComponent(r.id))} class="btn meals-cook">Tonight · Cook</a>}
                <button type="button" class="btn meals-swap" aria-label={'Swap ' + DOWS[i] + ' meal'} disabled={locked || out || busy || !connected}
                  style={{ color: locked || out ? 'var(--faint)' : 'var(--text)' }} onClick={() => swap(i)}>
                  <Icon name="swap" size={22} />
                </button>
              </div>
            );
          })}
        </section>

        <aside class="card meals-rules">
          <span class="eyebrow">Suggestion rules</span>
          {RULE_DEFS.map((r) => (
            <button key={r.key} type="button" class="btn meals-rule" role="switch" aria-checked={rules[r.key]} onClick={() => act(adapter.setMealRule(r.key, !rules[r.key]))}>
              <span class="meals-rule-text"><span class="meals-rule-label">{r.label}</span><span class="meals-rule-sub">{r.sub}</span></span>
              <Toggle on={rules[r.key]} />
            </button>
          ))}
          <div class="spacer" />
          <div class="meals-pool">
            <span class="meals-pool-count">{recipes ? 'Picking from ' + pool.length + ' family meals' : 'Meal list not connected'}</span>
            <span class="meals-pool-sub">Rules apply when you suggest or swap.</span>
          </div>
          <a href={href('/recipes')} class="btn meals-manage">Manage meal list</a>
        </aside>
      </div>

      {picking !== null && (
        <MealPicker
          day={`${DOWS[picking]} ${addDays(week, picking).getDate()}`}
          recipes={recipes ?? []}
          current={planByDate.get(days[picking])}
          onPick={(recipeId, noteTitle) => choose(picking, recipeId, noteTitle)}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}

/** Pick any recipe for one night, or mark it Eating out / Leftovers. */
function MealPicker({ day, recipes, current, onPick, onClose }: {
  day: string;
  recipes: RecipeSummary[];
  current: MealPlanDay | undefined;
  onPick: (recipeId: PlanDay, note?: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = recipes.filter((r) => !q || r.name.toLowerCase().includes(q));
  const isNote = (title: string) => !!current && !current.recipeId && current.title === title;
  return (
    <div class="meals-picker" role="dialog" aria-modal="true" aria-label={'Choose dinner for ' + day} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="meals-picker-card">
        <header class="meals-picker-head">
          <span class="meals-picker-title">Dinner for {day}</span>
          <button type="button" class="btn meals-picker-close" onClick={onClose}>Cancel</button>
        </header>
        <div class="meals-picker-notes">
          <button type="button" class={'btn meals-picker-note' + (isNote(EATING_OUT) ? ' on' : '')} onClick={() => onPick(null, EATING_OUT)}>
            <span class="meals-picker-name">{EATING_OUT}</span><span class="meals-picker-sub">No dinner needed</span>
          </button>
          <button type="button" class={'btn meals-picker-note' + (isNote('Leftovers night') ? ' on' : '')} onClick={() => onPick(null)}>
            <span class="meals-picker-name">Leftovers night</span><span class="meals-picker-sub">Clean out the fridge</span>
          </button>
        </div>
        <label class="meals-picker-search">
          <Icon name="search" size={22} />
          <span class="sr-only">Search meals</span>
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder="Search meals" />
        </label>
        <div class="meals-picker-list">
          {list.map((r) => (
            <button key={r.id} type="button" class={'btn meals-picker-item' + (current?.recipeId === r.id ? ' on' : '')} onClick={() => onPick(r.id)}>
              <span class="meals-picker-name">{r.name}</span>
              <span class="meals-picker-sub">{[r.mins ? fmtMins(r.mins) : null, ...r.tags].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
          {!list.length && <span class="meals-picker-empty">No meals match “{query}”.</span>}
        </div>
      </div>
    </div>
  );
}
