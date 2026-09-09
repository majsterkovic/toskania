import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumToIsoDate, isoDateToDayNum } from './dates.js';

const trip = { meta: { start_date: '2026-09-12' } };

test('dayNumToIsoDate: dzień 1 to start_date', () => {
  assert.equal(dayNumToIsoDate(trip, 1), '2026-09-12');
});

test('dayNumToIsoDate: dzień 16 to start_date + 15 dni', () => {
  assert.equal(dayNumToIsoDate(trip, 16), '2026-09-27');
});

test('isoDateToDayNum: odwraca dayNumToIsoDate', () => {
  assert.equal(isoDateToDayNum(trip, '2026-09-19'), 8);
});

test('isoDateToDayNum: data poza zakresem daje ujemny/za duży numer, nie rzuca', () => {
  assert.equal(isoDateToDayNum(trip, '2026-09-01'), -10);
});
