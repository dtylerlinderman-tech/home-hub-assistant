// Grocery list helpers: what to add without doubling up, and the order to show items in.
import type { TodoItem } from '../data/adapter';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The lines not already on the list as open items (case- and spacing-insensitive), first spelling wins. */
export function itemsToAdd(list: TodoItem[], lines: string[]): string[] {
  const seen = new Set(list.filter((i) => !i.done).map((i) => key(i.summary)));
  const out: string[] = [];
  for (const line of lines) {
    const k = key(line);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(line.trim());
  }
  return out;
}

/** Quick-add buttons: staples that aren't on the list at all (checked-off ones are already in the cart). */
export const STAPLES = ['Milk', 'Eggs', 'Bread', 'Bananas', 'Butter', 'Cheese', 'Coffee', 'Paper towels'];

export function staplesToShow(list: TodoItem[]): string[] {
  return itemsToAdd(list.map((i) => ({ ...i, done: false })), STAPLES);
}
