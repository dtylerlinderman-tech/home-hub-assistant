import { act, adapter } from '../hub';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Checkbox } from '../components/Checkbox';
import { dowKey, fmtLongDate, now } from '../logic/time';
import type { KidTask, KidTasks, TaskSection } from '../data/adapter';
import './tasks.css';

const SECTIONS: [TaskSection, string][] = [['morning', 'Morning'], ['after_school', 'After school'], ['evening', 'Evening']];

/** See-through tint of a kid's color for the "All done" banner. */
function tintOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.17)`;
}

export function Tasks() {
  const kids = useStore(adapter.state).kids;
  const today = now();
  return (
    <main class="screen tasks">
      <header class="tasks-head">
        <span class="page-title">Tasks</span>
        <span class="page-sub">{fmtLongDate(today)} · Lists reset every morning</span>
      </header>
      <div class="tasks-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, kids.length)}, minmax(0, 1fr))` }}>
        {kids.map((k) => <KidColumn key={k.name} kid={k} />)}
      </div>
    </main>
  );
}

function KidColumn({ kid }: { kid: KidTasks }) {
  const today = dowKey(now());
  const items = (kid.items ?? []).filter((t) => !t.days || t.days.includes(today));
  const done = items.filter((t) => t.done).length;
  const total = items.length;
  const allDone = total > 0 && done === total;

  return (
    <section class="card tasks-kid" aria-label={kid.name + "'s tasks"}>
      <div class="tasks-kid-head">
        <span class="tasks-avatar" style={{ background: kid.color }}>{kid.name.charAt(0)}</span>
        <div class="tasks-kid-info">
          <div class="tasks-kid-row">
            <span class="tasks-kid-name">{kid.name}</span>
            {kid.items && <span class="tasks-progress-text">{done} of {total} done</span>}
          </div>
          <span class="tasks-bar"><span style={{ width: (total ? Math.round((done / total) * 100) : 0) + '%', background: kid.color }} /></span>
        </div>
      </div>

      {allDone && (
        <div class="tasks-done" style={{ background: tintOf(kid.color) }}>
          <Icon name="star" size={28} color={kid.color} class="tasks-star" />
          <span>All done today, {kid.name}!</span>
        </div>
      )}

      {kid.items === null ? (
        <div class="not-connected">{kid.name}’s list isn’t connected</div>
      ) : total === 0 ? (
        <div class="not-connected">Nothing on the list today</div>
      ) : (
        <div class="tasks-sections">
          {SECTIONS.map(([key, label]) => {
            const list = items.filter((t) => t.section === key);
            if (!list.length) return null;
            return (
              <div key={key} class="tasks-section">
                <span class="eyebrow" style={{ paddingTop: '2px' }}>{label}</span>
                {list.map((t) => <TaskRow key={t.uid} kid={kid} t={t} />)}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskRow({ kid, t }: { kid: KidTasks; t: KidTask }) {
  return (
    <button type="button" class="btn tasks-item" aria-pressed={t.done} style={{ background: t.done ? 'rgba(255, 250, 255, 0.03)' : 'var(--raised)' }}
      onClick={() => act(adapter.setKidTaskDone(kid.name, t.uid, !t.done))}>
      <Checkbox done={t.done} size={34} radius={11} border={2.5} check={20} checkStroke={3.2} color={kid.color} />
      <span class="tasks-label" style={{ color: t.done ? 'var(--subtle)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.summary}</span>
    </button>
  );
}
