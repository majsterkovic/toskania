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

function writerReturning(content, extra = {}) {
  return {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
      model_used: 'writer-model',
      ...extra,
    }),
  };
}

test('runChatLoop: router bez tool_calls -> writer komponuje treść od razu', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'surowy szkic routera' } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
    model_used: 'router-model',
  }) };
  const writerClient = writerReturning('Cześć!');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Cześć!');
  assert.deepEqual(result.usage, { prompt_tokens: 9, completion_tokens: 5 });
  assert.deepEqual(result.models, ['router-model', 'writer-model']);
});

test('runChatLoop: D3 -- content routera z ostatniej iteracji nie trafia do writera', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'surowy szkic routera, ktory nie powinien przeciekac' } }],
    usage: {},
  }) };
  let writerMessagesSeen;
  const writerClient = { chat: async (messages) => {
    writerMessagesSeen = messages;
    return { choices: [{ message: { role: 'assistant', content: 'Czysta odpowiedź.' } }], usage: {} };
  } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Czysta odpowiedź.');
  const hasLeakedRouterDraft = writerMessagesSeen.some((m) => m.content?.includes('nie powinien przeciekac'));
  assert.equal(hasLeakedRouterDraft, false);
});

test('runChatLoop: writer nie dostaje narzędzi (drugi argument chat() jest undefined)', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'ok' } }],
    usage: {},
  }) };
  let writerToolsArg = 'nieustawione';
  const writerClient = { chat: async (_messages, tools) => {
    writerToolsArg = tools;
    return { choices: [{ message: { role: 'assistant', content: 'Odpowiedź.' } }], usage: {} };
  } };
  await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(writerToolsArg, undefined);
});

test('runChatLoop: wykonuje tool_call routera, ślad trafia do writera', async () => {
  let call = 0;
  const routerClient = {
    chat: async () => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{}' } }] } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        };
      }
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: { prompt_tokens: 4, completion_tokens: 1 } };
    },
  };
  let writerMessagesSeen;
  const writerClient = { chat: async (messages) => {
    writerMessagesSeen = messages;
    return { choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 20, completion_tokens: 8 } };
  } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'co 19.09?',
  });
  assert.equal(result.content, 'Dzień 8 to Chianti.');
  const toolMsg = writerMessagesSeen.find((m) => m.role === 'tool');
  assert.equal(JSON.parse(toolMsg.content).title, 'Chianti');
});

test('runChatLoop: po 5 iteracjach routera bez odpowiedzi końcowej rzuca chat_loop_max_iterations', async () => {
  const routerClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't', function: { name: 'getDay', arguments: '{}' } }] } }],
      usage: {},
    }),
  };
  const writerClient = { chat: async () => { throw new Error('writer nie powinien być wołany'); } };
  await assert.rejects(
    runChatLoop({
      routerClient, writerClient, toolRegistry: fakeToolRegistry(),
      routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
      history: [], userMessage: 'x',
    }),
    /chat_loop_max_iterations/
  );
});

test('runChatLoop: nieznane narzędzie nie wywala pętli, wraca error do routera', async () => {
  let call = 0;
  const routerClient = {
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
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: {} };
    },
  };
  const writerClient = writerReturning('ok');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
});

test('runChatLoop: krzywy JSON w argumentach narzędzia nie wywala requestu, wraca invalid_tool_arguments', async () => {
  let call = 0;
  const routerClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{niepoprawny json' } }] } }],
          usage: {},
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.deepEqual(JSON.parse(toolMsg.content), { error: 'invalid_tool_arguments' });
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: {} };
    },
  };
  const writerClient = writerReturning('ok');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
  assert.equal(call, 2);
});

test('runChatLoop: narzędzie rzucające przy wykonaniu (poprawny JSON, zły kształt) nie wywala requestu, wraca tool_execution_failed', async () => {
  let call = 0;
  const throwingToolRegistry = {
    searchFood: {
      description: 'test',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: () => { throw new TypeError('args.query is undefined'); },
    },
  };
  const routerClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'searchFood', arguments: '{"q":"pizza"}' } }] } }],
          usage: {},
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.deepEqual(JSON.parse(toolMsg.content), { error: 'tool_execution_failed' });
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: {} };
    },
  };
  const writerClient = writerReturning('ok');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: throwingToolRegistry,
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
  assert.equal(call, 2);
});

test('runChatLoop: pusta/null treść od writera traktowana jak porażka writera, wraca do lastRouterContent', async () => {
  let routerCall = 0;
  const routerClient = {
    chat: async () => {
      routerCall += 1;
      if (routerCall === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{}' } }] } }],
          usage: {},
        };
      }
      return { choices: [{ message: { role: 'assistant', content: 'Awaryjna odpowiedź routera.' } }], usage: {} };
    },
  };
  const writerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: null } }], usage: {} }) };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Awaryjna odpowiedź routera.');
});

test('runChatLoop: zbiera model_used z routera i writera do result.models', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'x' } }], usage: {}, model_used: 'router-m' }) };
  const writerClient = writerReturning('ok', { model_used: 'writer-m' });
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.deepEqual(result.models, ['router-m', 'writer-m']);
});

test('runChatLoop: gdy writer zawiedzie, wraca do ostatniego content routera (awaryjnie, mimo D3)', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Awaryjna odpowiedź routera.' } }], usage: {} }) };
  const writerClient = { chat: async () => { throw new Error('llm_http_503'); } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Awaryjna odpowiedź routera.');
});

test('runChatLoop: gdy writer zawiedzie i router nie miał treści, rzuca assistant_unavailable', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: null } }], usage: {} }) };
  const writerClient = { chat: async () => { throw new Error('llm_http_503'); } };
  await assert.rejects(
    runChatLoop({
      routerClient, writerClient, toolRegistry: fakeToolRegistry(),
      routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
      history: [], userMessage: 'hej',
    }),
    /assistant_unavailable/
  );
});
