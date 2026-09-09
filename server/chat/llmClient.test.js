import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createLlmClient } from './llmClient.js';

test('createLlmClient: woła model główny, zwraca JSON odpowiedzi', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
  }));
  const client = createLlmClient({ baseUrl: 'http://litellm:4000/v1', apiKey: 'k', model: 'deepseek-v4-flash' });
  const res = await client.chat([{ role: 'user', content: 'hej' }], []);
  assert.equal(res.choices[0].message.content, 'ok');
  assert.match(fetchMock.mock.calls[0].arguments[0], /\/chat\/completions$/);
  mock.restoreAll();
});

test('createLlmClient: przy błędzie modelu głównego próbuje fallback', async () => {
  let call = 0;
  mock.method(globalThis, 'fetch', async (url, opts) => {
    call += 1;
    const body = JSON.parse(opts.body);
    if (call === 1) {
      assert.equal(body.model, 'deepseek-v4-flash');
      return { ok: false, status: 429 };
    }
    assert.equal(body.model, 'deepseek-v4-pro-free');
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'fallback ok' } }], usage: {} }) };
  });
  const client = createLlmClient({ baseUrl: 'http://litellm:4000/v1', apiKey: 'k', model: 'deepseek-v4-flash', fallbackModel: 'deepseek-v4-pro-free' });
  const res = await client.chat([{ role: 'user', content: 'hej' }], []);
  assert.equal(res.choices[0].message.content, 'fallback ok');
  assert.equal(call, 2);
  mock.restoreAll();
});
