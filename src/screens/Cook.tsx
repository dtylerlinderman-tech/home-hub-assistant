import { useEffect, useMemo, useState } from 'preact/hooks';
import { adapter } from '../hub';
import { useStore, useTick } from '../store';
import { useAsync } from '../useAsync';
import { goBack, href, type Route } from '../router';
import { Icon } from '../components/Icon';
import { Checkbox } from '../components/Checkbox';
import { parseDuration, timerLabel } from '../logic/timers';
import { matchIngredients } from '../logic/ingredients';
import { fmtCountdown } from '../logic/time';
import { getTimer, remainingSec, resetTimer, timers, toggleTimer } from '../cookTimers';
import type { Recipe } from '../data/adapter';
import './cook.css';

const MAX_CHIPS = 5;

/** Keep the screen on while cooking (needs HTTPS or localhost; Fully Kiosk covers the tablet). */
function useWakeLock(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (!alive) { void sentinel.release(); return; }
        setHeld(true);
        sentinel.addEventListener('release', () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    const onVis = () => { if (document.visibilityState === 'visible' && alive) void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); void sentinel?.release(); };
  }, []);
  return held;
}

export function Cook({ route }: { route: Route }) {
  const id = route.param ?? '';
  const [recipe] = useAsync(() => adapter.getRecipe(id), [id]);
  const awake = useWakeLock();

  if (recipe.loading) return <main class="screen cook" />;
  if (!recipe.value) {
    return (
      <main class="screen cook">
        <CookHeader title="Recipe not found" sub={recipe.value === null ? 'Recipes aren’t connected, or this recipe was removed.' : ''} />
        <div class="not-connected" style={{ fontSize: '18px' }}>
          <a href={href('/recipes')}>Back to recipes</a>
        </div>
      </main>
    );
  }
  const startStep = Math.max(0, (Number(route.query.get('step')) || 1) - 1);
  // A recipe saved without steps (just a name and tags) still opens, with a note in place of step 1.
  const r = recipe.value.steps.length ? recipe.value
    : { ...recipe.value, steps: [{ text: 'No steps yet. Add them to this recipe in Mealie and they’ll show up here.' }] };
  return <CookBody key={id} recipe={r} awake={awake} startStep={startStep} />;
}

function CookHeader({ title, sub, step }: { title: string; sub: string; step?: string }) {
  return (
    <header class="cook-head">
      <button type="button" class="btn cook-back" onClick={() => goBack('/recipes')}><Icon name="left" size={22} stroke={2.2} />Recipes</button>
      <div class="cook-head-text">
        <span class="cook-title">{title}</span>
        <span class="cook-sub">{sub}</span>
      </div>
      {step && <span class="cook-step-count tnum">{step}</span>}
      <a href={href('/')} class="btn cook-done">Done</a>
    </header>
  );
}

function CookBody({ recipe, awake, startStep }: { recipe: Recipe; awake: boolean; startStep: number }) {
  useTick(250);
  useStore(timers);
  const [step, setStep] = useState(Math.min(startStep, recipe.steps.length - 1));
  const [got, setGot] = useState<Record<string, boolean>>({});

  const steps = useMemo(() => recipe.steps.map((s, i) => {
    const total = parseDuration(s.text);
    return {
      ...s,
      uses: s.uses ?? matchIngredients(s.text, recipe.ingredients),
      timer: total ? { key: recipe.id + ':' + i, recipeId: recipe.id, recipeName: recipe.name, step: i, label: s.title ?? timerLabel(s.text), total } : null,
    };
  }), [recipe]);

  const cur = steps[step];
  const byId = Object.fromEntries(recipe.ingredients.map((x) => [x.id, x]));
  const used = new Set(cur.uses);
  const last = step === steps.length - 1;
  const go = (i: number) => setStep(Math.max(0, Math.min(steps.length - 1, i)));

  const sub = [recipe.servings ? 'Serves ' + recipe.servings : null, recipe.mins ? recipe.mins + ' min' : null, awake ? 'Screen stays on while cooking' : null]
    .filter(Boolean).join(' · ');

  const t = cur.timer ? getTimer(cur.timer) : null;
  const rem = t ? remainingSec(t) : 0;
  const running = t?.endsAt != null;
  const finishedNow = t != null && t.remaining === 0 && !running;
  const others = steps.filter((s, i) => i !== step && s.timer && timers.get()[s.timer.key]?.endsAt != null);

  return (
    <main class="screen cook">
      <CookHeader title={recipe.name} sub={sub} step={'Step ' + (step + 1) + ' of ' + steps.length} />
      <div class="cook-body">
        <section class="cook-main">
          <div class="cook-segs">
            {steps.map((_, i) => (
              <button key={i} type="button" class="btn cook-seg" aria-label={'Go to step ' + (i + 1)} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
                <span style={{ background: i < step ? 'var(--accent-done)' : i === step ? 'var(--accent)' : 'var(--border-strong)' }} />
              </button>
            ))}
          </div>

          <div class="cook-step-label">
            <span>Step {step + 1}{cur.section ? ' · ' + cur.section : ''}</span>
            {others.map((s) => {
              const ot = timers.get()[s.timer!.key];
              return (
                <button key={s.timer!.key} type="button" class="btn cook-other-timer" onClick={() => go(s.timer!.step)}>
                  <Icon name="timer" size={16} />{ot.label} {fmtCountdown(remainingSec(ot))}
                </button>
              );
            })}
          </div>
          <p class={'cook-text' + textSize(cur.text)}>{cur.text}</p>

          {cur.uses.length > 0 && (() => {
            // Up to 5 chips; the rest are still highlighted in the ingredient list.
            const shown = cur.uses.filter((u) => byId[u]);
            const extra = shown.length - MAX_CHIPS;
            return (
              <div class="cook-uses">
                {shown.slice(0, MAX_CHIPS).map((u) => (
                  <span key={u} class="cook-use">{(byId[u].qty ? byId[u].qty + ' ' : '') + byId[u].name}</span>
                ))}
                {extra > 0 && <span class="cook-use more">+{extra} more</span>}
              </div>
            );
          })()}

          <div class="spacer" />

          {cur.timer && t && (
            <div class="card cook-timer">
              <Icon name="timer" size={36} color="var(--accent)" />
              <div class="cook-timer-text">
                <span class="cook-timer-time tnum" style={{ color: finishedNow ? 'var(--ok)' : 'var(--text)' }}>
                  {finishedNow ? 'Done!' : fmtCountdown(rem)}
                </span>
                <span class="cook-timer-label">{cur.timer.label}{running ? ' · running' : ''}</span>
              </div>
              <button type="button" class="btn cook-timer-reset" onClick={() => resetTimer(cur.timer!.key)}>Reset</button>
              <button type="button" class="btn cook-timer-go" onClick={() => toggleTimer(cur.timer!)}>
                {running ? 'Pause' : finishedNow ? 'Restart' : rem < cur.timer.total ? 'Resume' : 'Start'}
              </button>
            </div>
          )}

          <div class="cook-nav">
            <button type="button" class="btn cook-prev" style={{ color: step === 0 ? 'var(--faint)' : 'var(--text)' }} onClick={() => go(step - 1)} disabled={step === 0}>
              <Icon name="left" size={26} stroke={2.4} />Back
            </button>
            <button type="button" class="btn cook-next" onClick={() => go(step + 1)}>
              {last ? 'Last step' : 'Next step'}<Icon name="right" size={26} stroke={2.4} />
            </button>
          </div>
        </section>

        <aside class="cook-ings" aria-label="Ingredients">
          <div class="cook-ings-head">
            <span class="eyebrow">Ingredients</span>
            {recipe.ingredients.length > 0 && (
              <span class="cook-ings-count">{recipe.ingredients.filter((x) => got[x.id]).length} of {recipe.ingredients.length} ready</span>
            )}
          </div>
          {recipe.ingredients.length === 0 && (
            <span class="cook-ings-empty">{recipe.placeholder ? 'Ingredients will show up here once this recipe is added to Mealie.' : 'No ingredients yet. Add them in Mealie.'}</span>
          )}
          {recipe.ingredients.map((ing) => {
            const g = !!got[ing.id];
            return (
              <button key={ing.id} type="button" class="btn cook-ing" aria-pressed={g} style={{ background: used.has(ing.id) ? 'var(--accent-soft)' : 'transparent' }}
                onClick={() => setGot({ ...got, [ing.id]: !g })}>
                <Checkbox done={g} size={26} radius={8} border={2} check={15} />
                <span class="cook-ing-text" style={{ color: g ? 'var(--subtle)' : 'var(--text)' }}><strong>{ing.qty}</strong> {ing.name}</span>
              </button>
            );
          })}
        </aside>
      </div>
    </main>
  );
}

/** Step text steps down in size for long instructions so the controls stay on screen. */
function textSize(text: string): string {
  const n = text.length;
  return n > 330 ? ' xxlong' : n > 200 ? ' xlong' : n > 120 ? ' long' : '';
}
