#!/usr/bin/env node
// Eval do D6 (patrz docs/superpowers/specs/2026-09-09-czat-agent-router-writer-design.md):
// odpala 4 reprezentatywne prompty przez obie kombinacje przypisania ról
// (glimmer-router+gemma-writer vs. odwrotnie) na żywym LITELLM_BASE_URL,
// żeby rozstrzygnąć CHAT_MODEL/CHAT_MODEL_WRITER w sekretach.
// Uruchomienie: LITELLM_BASE_URL=... LITELLM_API_KEY=... node scripts/eval-chat-roles.js

import trip from '../trip.json' with { type: 'json' };
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
import { buildToolRegistry } from '../server/tools/index.js';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from '../server/chat/systemPrompt.js';
import { createLlmClient } from '../server/chat/llmClient.js';
import { runChatLoop } from '../server/chat/loop.js';

const GLIMMER = 'nvidia-muse-glimmer-30b';
const GEMMA = 'nvidia-gemma-4-31b-it';

const PROMPTS = [
  { label: 'proste/1 tool', text: 'Co robimy 19.09?' },
  { label: 'złożone/2+ tooli', text: 'Co robimy w dniu 8 i o której otwiera się tam pierwsza atrakcja?' },
  { label: 'bez pokrycia w danych', text: 'O której otwiera się Koloseum w Rzymie?' },
  { label: 'względne "jutro"', text: 'Co robimy jutro?' },
];

const COMBINATIONS = [
  { label: 'glimmer-router + gemma-writer', routerModel: GLIMMER, writerModel: GEMMA },
  { label: 'gemma-router + glimmer-writer', routerModel: GEMMA, writerModel: GLIMMER },
];

function client(model) {
  return createLlmClient({
    baseUrl: process.env.LITELLM_BASE_URL,
    apiKey: process.env.LITELLM_API_KEY,
    model,
  });
}

async function main() {
  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
    console.error('Wymagane LITELLM_BASE_URL i LITELLM_API_KEY w env.');
    process.exit(1);
  }

  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const today = todayIso();
  const routerSystemPrompt = buildRouterSystemPrompt({ trip, toolRegistry, today });
  const writerSystemPrompt = buildWriterSystemPrompt({ trip, toolRegistry, today });

  for (const combo of COMBINATIONS) {
    console.log(`\n=== ${combo.label} ===`);
    const routerClient = client(combo.routerModel);
    const writerClient = client(combo.writerModel);
    for (const prompt of PROMPTS) {
      process.stdout.write(`\n[${prompt.label}] "${prompt.text}"\n`);
      try {
        const result = await runChatLoop({
          routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt,
          history: [], userMessage: prompt.text,
        });
        console.log(`  modele: ${result.models.join(' -> ')}`);
        console.log(`  odpowiedź: ${result.content}`);
      } catch (err) {
        console.log(`  BŁĄD: ${err.message}`);
      }
    }
  }
}

main();
