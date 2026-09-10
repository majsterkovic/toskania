import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDoneState,
  getEffectiveDoneIds,
  defaultDoneIds,
  withoutDone,
} from '../src/done.js';

const todo = {
  categories: [
    {
      id: 'rezerwacje',
      items: [
        { id: 'grotta', label: 'Grotta', group: 'required', day_num: 3 },
        { id: 'hotel', label: 'Baza', group: 'done' },
      ],
    },
  ],
};

test('without localStorage state is empty (node/testy)', () => {
  assert.deepEqual(getDoneState('whatever'), { done: new Set(), undone: new Set() });
});

test('defaultDoneIds collects group done', () => {
  assert.deepEqual(defaultDoneIds(todo), new Set(['hotel']));
});

test('getEffectiveDoneIds without storage = data defaults', () => {
  assert.deepEqual(getEffectiveDoneIds(todo, 'whatever'), new Set(['hotel']));
});

test('withoutDone filters by id, tolerates empty input', () => {
  const bookings = [{ id: 'grotta' }, { id: 'hotel' }];
  assert.deepEqual(withoutDone(bookings, new Set(['grotta'])), [{ id: 'hotel' }]);
  assert.deepEqual(withoutDone(bookings, new Set()), bookings);
  assert.deepEqual(withoutDone(undefined, new Set(['x'])), []);
});
