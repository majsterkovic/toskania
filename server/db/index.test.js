import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './index.js';

test('openDb: zakłada tabelę users z UNIQUE(display_name)', () => {
  const db = openDb();
  db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama');
  assert.throws(() => db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama'));
});

test('openDb: sessions ma FK do users i pola expires_at/user_agent', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Tata');
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
    .run('sess-1', userId, '2027-01-01T00:00:00Z', 'test-agent');
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('sess-1');
  assert.equal(row.user_id, userId);
  assert.equal(row.user_agent, 'test-agent');
});

test('openDb: usage ma UNIQUE(user_id, day)', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Ela');
  db.prepare('INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests) VALUES (?, ?, 10, 5, 1)')
    .run(userId, '2026-09-19');
  assert.throws(() =>
    db.prepare('INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests) VALUES (?, ?, 1, 1, 1)')
      .run(userId, '2026-09-19')
  );
});

test('openDb: checks ma PRIMARY KEY (user_id, item_key)', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Ola');
  db.prepare('INSERT INTO checks (user_id, item_key, checked_at) VALUES (?, ?, ?)').run(userId, 'paszport', '2026-09-10');
  assert.throws(() => db.prepare('INSERT INTO checks (user_id, item_key, checked_at) VALUES (?, ?, ?)').run(userId, 'paszport', '2026-09-11'));
});
