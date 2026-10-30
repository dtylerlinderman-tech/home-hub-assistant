import { useState } from 'preact/hooks';
import { act, adapter, config, showToast } from '../hub';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Checkbox } from '../components/Checkbox';
import { staplesToShow } from '../logic/groceries';
import type { TodoItem } from '../data/adapter';
import './groceries.css';

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

export function Groceries() {
  const items = useStore(adapter.state).groceries;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendTo = config.mealie?.sendListTo;

  const open = items?.filter((i) => !i.done) ?? [];
  const checked = items?.filter((i) => i.done) ?? [];
  const staples = items ? staplesToShow(items) : [];

  function add(summary: string) {
    if (!summary.trim()) return;
    void act(adapter.addGrocery(summary), 'Couldn’t add that. Try again.');
  }

  async function send() {
    setSending(true);
    const ok = await act(adapter.sendGroceries().then(() => true), 'Couldn’t send the list.');
    setSending(false);
    if (ok) showToast(`Emailed ${plural(open.length, 'item')}${sendTo ? ' to ' + sendTo : ''}`);
  }

  return (
    <main class="screen groceries">
      <header class="groceries-head">
        <div class="groceries-title">
          <span class="page-title">Groceries</span>
          <span class="page-sub">
            {items === null ? 'Grocery list not connected' : plural(open.length, 'item') + ' to get' + (checked.length ? ' · ' + checked.length + ' in the cart' : '')}
          </span>
        </div>
        <div class="groceries-actions">
          {checked.length > 0 && (
            <button type="button" class="btn groceries-btn" onClick={() => act(adapter.clearCheckedGroceries())}>Clear checked</button>
          )}
          <button type="button" class="btn groceries-btn primary" onClick={send} disabled={!items || !open.length || sending}>
            <Icon name="mail" size={22} />{sending ? 'Sending…' : sendTo ? 'Send to ' + sendTo : 'Email list'}
          </button>
        </div>
      </header>

      {items === null ? (
        <div class="card groceries-card"><div class="not-connected">The grocery list isn’t connected</div></div>
      ) : (
        <>
          <form class="groceries-add" onSubmit={(e) => { e.preventDefault(); add(text); setText(''); }}>
            <Icon name="plus" size={22} color="var(--accent)" stroke={2.2} />
            <label class="groceries-add-field">
              <span class="sr-only">Add an item</span>
              <input type="text" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Add an item" enterKeyHint="done" autoComplete="off" />
            </label>
            <button type="submit" class="btn groceries-add-go" disabled={!text.trim()}>Add</button>
          </form>

          {staples.length > 0 && (
            <div role="group" aria-label="Quick add" class="groceries-staples">
              {staples.map((s) => (
                <button key={s} type="button" class="btn groceries-staple" onClick={() => add(s)}><Icon name="plus" size={16} stroke={2.4} />{s}</button>
              ))}
            </div>
          )}

          <section class="card groceries-card" aria-label="Grocery list">
            {items.length === 0 ? (
              <div class="not-connected">The list is empty. Add items above, or add this week’s ingredients from Meals.</div>
            ) : (
              <div class="groceries-scroll">
                <div class="groceries-grid">{open.map((i) => <Row key={i.uid} item={i} />)}</div>
                {checked.length > 0 && (
                  <>
                    <span class="eyebrow groceries-cart-label">In the cart</span>
                    <div class="groceries-grid">{checked.map((i) => <Row key={i.uid} item={i} />)}</div>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Row({ item }: { item: TodoItem }) {
  return (
    <button type="button" class={'btn groceries-item' + (item.done ? ' done' : '')} aria-pressed={item.done}
      onClick={() => act(adapter.setGroceryDone(item.uid, !item.done))}>
      <Checkbox done={item.done} size={32} radius={10} border={2.5} check={19} checkStroke={3.2} color="var(--accent)" />
      <span class="groceries-label">{item.summary}</span>
    </button>
  );
}
