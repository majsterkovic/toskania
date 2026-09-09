import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function loggedGate() {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  return { app, gateCookie };
}

test('GET /api/auth/who bez ciasteczka gate daje 401 (lista imion nie wycieka)', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  const res = await app.inject({ method: 'GET', url: '/api/auth/who' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('GET /api/auth/who z ciasteczkiem gate zwraca listę użytkowników', async () => {
  const { app, gateCookie } = await loggedGate();
  app.db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama');
  const res = await app.inject({
    method: 'GET', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().users.map((u) => u.display_name), ['Mama']);
  await app.close();
});

test('POST /api/auth/who {new_name} zakłada wiersz i daje sesję 90 dni', async () => {
  const { app, gateCookie } = await loggedGate();
  const res = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { new_name: 'Teściowa' },
  });
  assert.equal(res.statusCode, 200);
  const sessionCookie = res.cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie);
  assert.ok(sessionCookie.maxAge >= 89 * 24 * 60 * 60);
  const row = app.db.prepare('SELECT * FROM users WHERE display_name = ?').get('Teściowa');
  assert.ok(row);
  await app.close();
});

test('POST /api/auth/who {user_id} loguje na istniejące konto bez duplikatu', async () => {
  const { app, gateCookie } = await loggedGate();
  const { lastInsertRowid: userId } = app.db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Tata');
  const res = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { user_id: userId },
  });
  assert.equal(res.statusCode, 200);
  const count = app.db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  assert.equal(count, 1);
  await app.close();
});
