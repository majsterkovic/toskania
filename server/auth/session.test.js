import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { requireSession } from './session.js';

async function appWithProtectedRoute() {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  app.get('/chroniona', { preHandler: requireSession }, async (req) => ({ user: req.user }));
  return app;
}

async function loginAs(app, name) {
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { new_name: name },
  });
  return whoRes.cookies.find((c) => c.name === 'session');
}

test('trasa chroniona requireSession: bez ciasteczka session daje 401', async () => {
  const app = await appWithProtectedRoute();
  const res = await app.inject({ method: 'GET', url: '/chroniona' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('trasa chroniona requireSession: z ważną sesją ustawia req.user', async () => {
  const app = await appWithProtectedRoute();
  const sessionCookie = await loginAs(app, 'Mama');
  const res = await app.inject({ method: 'GET', url: '/chroniona', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.displayName, 'Mama');
  await app.close();
});

test('trasa chroniona requireSession: wygasła sesja daje 401', async () => {
  const app = await appWithProtectedRoute();
  const sessionCookie = await loginAs(app, 'Mama');
  app.db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'").run();
  const res = await app.inject({ method: 'GET', url: '/chroniona', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 401);
  await app.close();
});
