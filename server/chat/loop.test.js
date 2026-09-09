import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChatLoop } from './loop.js';

function fakeToolRegistry() {
  return {
    getDay: {
      description: 'test',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: () => ({ day_num: 8, title: 'Chianti' }),
    },
  };
}

test('runChatLoop: bez tool_calls zwraca treść od razu', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Cześć!' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } }) };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Cześć!');
  assert.deepEqual(result.usage, { prompt_tokens: 5, completion_tokens: 3 });
});

test('runChatLoop: wykonuje tool_call i wraca do modelu z wynikiem', async () => {
  let call = 0;
  const llmClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{}' } }] } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.equal(JSON.parse(toolMsg.content).title, 'Chianti');
      return { choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 20, completion_tokens: 8 } };
    },
  };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'co 19.09?',
  });
  assert.equal(result.content, 'Dzień 8 to Chianti.');
  assert.equal(result.usage.prompt_tokens, 30);
  assert.equal(call, 2);
});

test('runChatLoop: po 5 iteracjach bez odpowiedzi końcowej rzuca chat_loop_max_iterations', async () => {
  const llmClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't', function: { name: 'getDay', arguments: '{}' } }] } }],
      usage: {},
    }),
  };
  await assert.rejects(
    runChatLoop({ llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'x' }),
    /chat_loop_max_iterations/
  );
});

test('runChatLoop: nieznane narzędzie nie wywala pętli, wraca error do modelu', async () => {
  let call = 0;
  const llmClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'nieznane', arguments: '{}' } }] } }],
          usage: {},
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.deepEqual(JSON.parse(toolMsg.content), { error: 'unknown_tool' });
      return { choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: {} };
    },
  };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
});

test('runChatLoop: zbiera model_used z odpowiedzi LLM do result.models', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: {}, model_used: 'm1' }) };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'hej',
  });
  assert.deepEqual(result.models, ['m1']);
});
