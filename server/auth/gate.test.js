import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function appWithPassphrase(passphrase = 'oliwa-cyprys-42') {
  return buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase });
}

test('POST /api/auth/gate: poprawne hasło ustawia ciasteczko gate', async () => {
  const app = await appWithPassphrase();
  const res = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /gate=/);
  await app.close();
});

test('POST /api/auth/gate: złe hasło daje 401, bez ciasteczka', async () => {
  const app = await appWithPassphrase();
  const res = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'zle-haslo' } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['set-cookie'], undefined);
  await app.close();
});

test('POST /api/auth/gate: rate limit liczy po CF-Connecting-IP, nie po req.ip', async () => {
  const app = await appWithPassphrase();
  for (let i = 0; i < 5; i++) {
    await app.inject({
      method: 'POST', url: '/api/auth/gate',
      headers: { 'cf-connecting-ip': '1.2.3.4' },
      payload: { password: 'zle-haslo' },
    });
  }
  const sixth = await app.inject({
    method: 'POST', url: '/api/auth/gate',
    headers: { 'cf-connecting-ip': '1.2.3.4' },
    payload: { password: 'oliwa-cyprys-42' },
  });
  assert.equal(sixth.statusCode, 429);

  const otherIp = await app.inject({
    method: 'POST', url: '/api/auth/gate',
    headers: { 'cf-connecting-ip': '5.6.7.8' },
    payload: { password: 'oliwa-cyprys-42' },
  });
  assert.equal(otherIp.statusCode, 200, 'inny CF-Connecting-IP nie powinien być zablokowany');
  await app.close();
});

test('POST /api/auth/gate: hasło z białymi znakami na końcach przechodzi (trim)', async () => {
  const app = await appWithPassphrase();
  const res = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: '  oliwa-cyprys-42 ' } });
  assert.equal(res.statusCode, 200);
  await app.close();
});
