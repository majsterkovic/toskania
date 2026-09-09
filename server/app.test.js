import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

test('GET /healthz zwraca 200 { ok: true }', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
  await app.close();
});

test('buildApp: dekoruje instancję bazą (app.db)', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  assert.ok(app.db);
  assert.doesNotThrow(() => app.db.prepare('SELECT 1').get());
  await app.close();
});
