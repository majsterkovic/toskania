const ROUTER_MAX_ITERATIONS = 5;
const TOTAL_TIMEOUT_MS = 18000;

export async function runChatLoop({
  routerClient, writerClient, toolRegistry,
  routerSystemPrompt, writerSystemPrompt,
  history, userMessage, onToolCall,
}) {
  const toolDefs = Object.entries(toolRegistry).map(([name, tool]) => ({
    type: 'function',
    function: { name, description: tool.description, parameters: tool.parameters },
  }));

  const messages = [
    { role: 'system', content: routerSystemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  const models = [];
  let lastRouterContent = null;
  let routerDone = false;

  for (let i = 0; i < ROUTER_MAX_ITERATIONS; i++) {
    if (Date.now() > deadline) throw new Error('chat_loop_timeout');

    const response = await routerClient.chat(messages, toolDefs);
    if (response.model_used) models.push(response.model_used);
    const choice = response.choices[0];
    if (response.usage) {
      usage.prompt_tokens += response.usage.prompt_tokens ?? 0;
      usage.completion_tokens += response.usage.completion_tokens ?? 0;
    }
    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // D3: content routera jest odrzucany tutaj, NIGDY nie trafia do
      // `messages` — faza writer poniżej go nie zobaczy. Zachowany
      // wyłącznie jako awaryjny fallback, gdyby writer sam zawiódł
      // (patrz catch niżej) — to ścieżka błędu, nie normalna.
      lastRouterContent = msg.content;
      routerDone = true;
      break;
    }

    messages.push(msg);
    for (const call of msg.tool_calls) {
      const tool = toolRegistry[call.function.name];
      let args;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        const errorResult = { error: 'invalid_tool_arguments' };
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(errorResult) });
        await onToolCall?.(call.function.name, errorResult);
        continue;
      }
      const result = tool ? await tool.execute(args) : { error: 'unknown_tool' };
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      await onToolCall?.(call.function.name, result);
    }
  }

  if (!routerDone) throw new Error('chat_loop_max_iterations');

  const writerMessages = [
    { role: 'system', content: writerSystemPrompt },
    ...messages.slice(1),
  ];

  try {
    const writerResponse = await writerClient.chat(writerMessages);
    if (writerResponse.model_used) models.push(writerResponse.model_used);
    if (writerResponse.usage) {
      usage.prompt_tokens += writerResponse.usage.prompt_tokens ?? 0;
      usage.completion_tokens += writerResponse.usage.completion_tokens ?? 0;
    }
    const writerMsg = writerResponse.choices[0].message;
    messages.push(writerMsg);
    return { content: writerMsg.content, usage, messages, models };
  } catch {
    if (lastRouterContent) {
      return { content: lastRouterContent, usage, messages, models };
    }
    throw new Error('assistant_unavailable');
  }
}
