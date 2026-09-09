// Podniesione 2026-09-09 z 15000 -> 30000 po zywym tescie na VPS:
// glimmer (model rozumujacy) potrzebuje ~7-10s na trywialny prompt przez
// wewnetrzny reasoning_content, wiec realny prompt z pelnym system promptem
// (spis dni + narzedzia) latwo przekraczal stary limit i byl abortowany
// zanim model zdazyl odpowiedziec. Patrz docs/superpowers/specs
// 2026-09-09-czat-agent-router-writer-design.md, D7.
const CALL_TIMEOUT_MS = 30000;

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
        res.model_used = res.model ?? model;
        return res;
      } catch (err) {
        if (!fallbackModel) throw err;
        const res = await callWithTimeout({ baseUrl, apiKey, model: fallbackModel, messages, tools });
        res.model_used = res.model ?? fallbackModel;
        return res;
      }
    },
  };
}
