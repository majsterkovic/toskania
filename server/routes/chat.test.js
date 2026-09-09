import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { registerChatRoute } from './chat.js';
import { recordUsage } from '../db/usage.js';

function fakeToolRegistry() {
  return { listDays: { description: '', parameters: { type: 'object', properties: {} }, execute: () => [] } };
}

async function loggedInApp({ toolRegistry = fakeToolRegistry(), llmClient, budgets = { perUserLimit: 100000, globalLimit: 1000000 } } = {}) {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  registerChatRoute(app, app.db, { toolRegistry, llmClient, systemPrompt: 'sys', budgets });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({ method: 'POST', url: '/api/auth/who', cookies: { gate: gateCookie.value }, payload: { new_name: 'Mama' } });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');
  return { app, sessionCookie };
}

test('POST /api/chat bez sesji daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  registerChatRoute(app, app.db, { toolRegistry: fakeToolRegistry(), llmClient: { chat: async () => ({ choices: [{ message: { content: 'x' } }], usage: {} }) }, systemPrompt: 'sys', budgets: { perUserLimit: 1, globalLimit: 1 } });
  const res = await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'hej' } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('POST /api/chat z sesją zwraca odpowiedź modelu i zapisuje ją do messages + usage', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  const { app, sessionCookie } = await loggedInApp({ llmClient });
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'co 19.09?' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Chianti/);
  const msgCount = app.db.prepare("SELECT COUNT(*) as n FROM messages WHERE role = 'assistant'").get().n;
  assert.equal(msgCount, 1);
  const usage = app.db.prepare('SELECT prompt_tokens, completion_tokens FROM usage').get();
  assert.deepEqual(usage, { prompt_tokens: 10, completion_tokens: 5 });
  await app.close();
});

test('POST /api/chat: przekroczony budżet per osoba daje 429, plan strony nie jest dotknięty', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { content: 'x' } }], usage: {} }) };
  const { app, sessionCookie } = await loggedInApp({ llmClient, budgets: { perUserLimit: 50, globalLimit: 1000000 } });
  const uid = app.db.prepare("SELECT id FROM users WHERE display_name = 'Mama'").get().id;
  recordUsage(app.db, uid, 60, 0);
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'hej' } });
  assert.equal(res.statusCode, 429);
  const healthz = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(healthz.statusCode, 200);
  await app.close();
});

test('POST /api/chat z Accept: text/event-stream zwraca SSE z eventem content', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  const { app, sessionCookie } = await loggedInApp({ llmClient });
  const res = await app.inject({
    method: 'POST', url: '/api/chat',
    headers: { accept: 'text/event-stream' },
    cookies: { session: sessionCookie.value },
    payload: { message: 'co 19.09?' },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.match(res.body, /event: content/);
  assert.match(res.body, /Chianti/);
  assert.match(res.body, /event: done/);
  await app.close();
});
