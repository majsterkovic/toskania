const CALL_TIMEOUT_MS = 15000;

async function callOnce({ baseUrl, apiKey, model, messages, tools, signal }) {
  const body = { model, messages };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`llm_http_${res.status}`);
  return res.json();
}

// Kazda proba (primary, fallback) dostaje WLASNY AbortController/timeout.
// Wczesniej oba dzielily jeden kontroler: gdy primary zjadl caly
// CALL_TIMEOUT_MS, proba fallbacku startowala z juz zaabortowanym
// sygnalem i padala natychmiast -- fallback nigdy realnie nie dzialal.
// Zweryfikowane na produkcji 2026-09-09: primary zawiesil sie na NIM,
// fallback (sprawny, ~0.5s) i tak nie odpowiedzial.
async function callWithTimeout(args) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    return await callOnce({ ...args, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function createLlmClient({ baseUrl, apiKey, model, fallbackModel }) {
  return {
    async chat(messages, tools) {
      try {
        const res = await callWithTimeout({ baseUrl, apiKey, model, messages, tools });
        res.model_used = model;
        return res;
      } catch (err) {
        if (!fallbackModel) throw err;
        const res = await callWithTimeout({ baseUrl, apiKey, model: fallbackModel, messages, tools });
        res.model_used = fallbackModel;
        return res;
      }
    },
  };
}
