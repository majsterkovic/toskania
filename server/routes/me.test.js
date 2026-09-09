import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { registerMeRoute } from './me.js';

test('GET /api/me bez sesji daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  registerMeRoute(app, app.db);
  const res = await app.inject({ method: 'GET', url: '/api/me' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('GET /api/me z sesją zwraca display_name i stan limitu', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  registerMeRoute(app, app.db);
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({ method: 'POST', url: '/api/auth/who', cookies: { gate: gateCookie.value }, payload: { new_name: 'Mama' } });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');

  const res = await app.inject({ method: 'GET', url: '/api/me', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { display_name: 'Mama', usage: { prompt_tokens: 0, completion_tokens: 0, requests: 0 } });
  await app.close();
});
