import { describe, expect, it } from 'vitest';
import { itemsToAdd, staplesToShow } from './groceries';
import { toTodoItems } from '../data/ha-mappers';

const item = (summary: string, done = false) => ({ uid: summary, summary, done, due: null });

describe('itemsToAdd', () => {
  it('skips what is already on the list, ignoring case and spacing', () => {
    expect(itemsToAdd([item('Milk'), item('Bell  peppers')], ['milk', ' bell peppers ', 'Eggs'])).toEqual(['Eggs']);
  });
  it('re-adds an item that was checked off', () => {
    expect(itemsToAdd([item('Milk', true)], ['Milk'])).toEqual(['Milk']);
  });
  it('drops duplicates and blanks within the new lines', () => {
    expect(itemsToAdd([], ['1 onion', '1 Onion', '  ', 'Garlic'])).toEqual(['1 onion', 'Garlic']);
  });
});

describe('staplesToShow', () => {
  it('hides staples already on the list', () => {
    const shown = staplesToShow([item('milk'), item('Eggs', true)]);
    expect(shown).not.toContain('Milk');
    expect(shown).not.toContain('Eggs'); // checked off: already in the cart
    expect(shown).toContain('Bread');
  });
});

describe('toTodoItems', () => {
  it('maps status and puts checked items last', () => {
    expect(toTodoItems([
      { uid: 'a', summary: 'Milk', status: 'completed' },
      { uid: 'b', summary: ' Eggs ', status: 'needs_action' },
      { uid: 'c', summary: '', status: 'needs_action' },
    ])).toEqual([
      { uid: 'b', summary: 'Eggs', done: false, due: null },
      { uid: 'a', summary: 'Milk', done: true, due: null },
    ]);
  });
});
