const MAX_TOOL_ITERATIONS = 5;
const TOTAL_TIMEOUT_MS = 30000;

export async function runChatLoop({ llmClient, toolRegistry, systemPrompt, history, userMessage, onToolCall }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];
  const toolDefs = Object.entries(toolRegistry).map(([name, tool]) => ({
    type: 'function',
    function: { name, description: tool.description, parameters: tool.parameters },
  }));

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  const models = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (Date.now() > deadline) throw new Error('chat_loop_timeout');

    const response = await llmClient.chat(messages, toolDefs);
    if (response.model_used) models.push(response.model_used);
    const choice = response.choices[0];
    if (response.usage) {
      usage.prompt_tokens += response.usage.prompt_tokens ?? 0;
      usage.completion_tokens += response.usage.completion_tokens ?? 0;
    }
    const msg = choice.message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { content: msg.content, usage, messages, models };
    }

    for (const call of msg.tool_calls) {
      const tool = toolRegistry[call.function.name];
      const result = tool
        ? await tool.execute(JSON.parse(call.function.arguments || '{}'))
        : { error: 'unknown_tool' };
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      await onToolCall?.(call.function.name, result);
    }
  }
  throw new Error('chat_loop_max_iterations');
}
