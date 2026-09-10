import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservationGroups, todoForChecklist } from '../src/reservations.js';

const todo = {
  note: 'x',
  categories: [
    { id: 'dokumenty', name: 'Dokumenty', items: [{ id: 'ekuz', label: 'EKUZ' }] },
    {
      id: 'rezerwacje',
      name: 'Rezerwacje',
      items: [
        { id: 'grotta', label: 'Grotta', group: 'required', day_num: 3 },
        { id: 'pisa', label: 'Wieża', group: 'required', day_num: 4 },
        { id: 'siena', label: 'Siena', group: 'optional', day_num: 11 },
        { id: 'hotel', label: 'Baza', group: 'done' },
        { id: 'loose', label: 'Bez grupy' },
      ],
    },
  ],
};

test('reservationGroups splits required / optional / done in that order', () => {
  const groups = reservationGroups(todo);
  assert.deepEqual(groups.map((g) => g.id), ['required', 'optional', 'done']);
  assert.deepEqual(groups[0].items.map((i) => i.id), ['grotta', 'pisa']);
  assert.deepEqual(groups[1].items.map((i) => i.id), ['siena', 'loose']);
  assert.deepEqual(groups[2].items.map((i) => i.id), ['hotel']);
});

test('todoForChecklist drops the rezerwacje category', () => {
  const rest = todoForChecklist(todo);
  assert.deepEqual(rest.categories.map((c) => c.id), ['dokumenty']);
  assert.equal(todo.categories.length, 2);
});

test('empty todo yields no reservation groups', () => {
  assert.deepEqual(reservationGroups({ categories: [] }), []);
  assert.deepEqual(reservationGroups(null), []);
});

test('reservationGroups with state: checked move to done, unchecked default to optional', () => {
  const groups = reservationGroups(todo, new Set(['pisa', 'hotel']));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)]));
  assert.deepEqual(byId.required, ['grotta']);
  assert.deepEqual(byId.optional, ['siena', 'loose']);
  assert.deepEqual(byId.done, ['pisa', 'hotel']);
});

test('reservationGroups with state: unchecked default-done falls back to optional', () => {
  const groups = reservationGroups(todo, new Set());
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)]));
  assert.deepEqual(byId.done ?? [], []);
  assert.deepEqual(byId.optional, ['siena', 'hotel', 'loose']);
});
