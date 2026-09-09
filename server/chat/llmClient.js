const CALL_TIMEOUT_MS = 15000;

async function callOnce({ baseUrl, apiKey, model, messages, tools, signal }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
    signal,
  });
  if (!res.ok) throw new Error(`llm_http_${res.status}`);
  return res.json();
}

export function createLlmClient({ baseUrl, apiKey, model, fallbackModel }) {
  return {
    async chat(messages, tools) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
      try {
        try {
          return await callOnce({ baseUrl, apiKey, model, messages, tools, signal: controller.signal });
        } catch (err) {
          if (!fallbackModel) throw err;
          return await callOnce({ baseUrl, apiKey, model: fallbackModel, messages, tools, signal: controller.signal });
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
