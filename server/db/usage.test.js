import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './index.js';
import { getUsageToday, recordUsage, budgetExceeded } from './usage.js';

function makeUser(db, name) {
  return db.prepare('INSERT INTO users (display_name) VALUES (?)').run(name).lastInsertRowid;
}

test('getUsageToday: brak wpisów zwraca zera', () => {
  const db = openDb();
  const userId = makeUser(db, 'A');
  assert.deepEqual(getUsageToday(db, userId), { prompt_tokens: 0, completion_tokens: 0, requests: 0 });
});

test('recordUsage: kumuluje w ramach jednego dnia (ON CONFLICT)', () => {
  const db = openDb();
  const userId = makeUser(db, 'B');
  recordUsage(db, userId, 100, 50);
  recordUsage(db, userId, 30, 20);
  const usage = getUsageToday(db, userId);
  assert.equal(usage.prompt_tokens, 130);
  assert.equal(usage.completion_tokens, 70);
  assert.equal(usage.requests, 2);
});

test('budgetExceeded: null, gdy oba limity mają zapas', () => {
  const db = openDb();
  const userId = makeUser(db, 'C');
  recordUsage(db, userId, 100, 100);
  assert.equal(budgetExceeded(db, userId, { perUserLimit: 10000, globalLimit: 100000 }), null);
});

test('budgetExceeded: "user", gdy przekroczony limit per osoba', () => {
  const db = openDb();
  const userId = makeUser(db, 'D');
  recordUsage(db, userId, 6000, 5000);
  assert.equal(budgetExceeded(db, userId, { perUserLimit: 10000, globalLimit: 100000 }), 'user');
});

test('budgetExceeded: "global", gdy suma wszystkich użytkowników przekracza sufit globalny', () => {
  const db = openDb();
  const u1 = makeUser(db, 'E1');
  const u2 = makeUser(db, 'E2');
  recordUsage(db, u1, 6000, 0);
  recordUsage(db, u2, 6000, 0);
  assert.equal(budgetExceeded(db, u2, { perUserLimit: 10000, globalLimit: 10000 }), 'global');
});
