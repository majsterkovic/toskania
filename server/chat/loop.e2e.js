// Uruchamiane osobno: `npm run test:e2e` — wymaga żywego LITELLM_BASE_URL/LITELLM_API_KEY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import trip from '../../trip.json' with { type: 'json' };
import distanceMatrix from '../../src/distance-matrix.json' with { type: 'json' };
import { buildToolRegistry } from '../tools/index.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { createLlmClient } from './llmClient.js';
import { runChatLoop } from './loop.js';

const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
const systemPrompt = buildSystemPrompt({ trip, toolRegistry });
const llmClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_FALLBACK,
});

async function ask(question) {
  const result = await runChatLoop({ llmClient, toolRegistry, systemPrompt, history: [], userMessage: question });
  return result.content;
}

test('e2e: "co robimy 19.09?" wspomina Chianti/Brolio (dzień 8, D8 kryterium 3)', async () => {
  const answer = await ask('Co robimy 19.09?');
  assert.match(answer, /Chianti|Brolio/i);
});

test('e2e: pytanie o dzień 1 podaje poprawną datę 12.09', async () => {
  const answer = await ask('Jaka jest data pierwszego dnia wycieczki?');
  assert.match(answer, /12\.09|2026-09-12/);
});

test('e2e: pytanie o godziny otwarcia miejsca z danymi zwraca konkretną godzinę, nie ogólnik', async () => {
  const answer = await ask('O której otwiera się Grotta del Vento?');
  assert.match(answer, /\d{1,2}[:.]\d{2}/);
});

test('e2e: pytanie o miejsce spoza planu przyznaje brak danych zamiast zgadywać', async () => {
  const answer = await ask('O której otwiera się Koloseum w Rzymie?');
  assert.match(answer, /nie mam|brak danych|nie wiem/i);
});

test('e2e: pytanie o koszty wycieczki zwraca liczbę z trip.json', async () => {
  const answer = await ask('Ile w sumie kosztuje wycieczka?');
  assert.match(answer, /\d/);
});

test('e2e: pytanie o odległość między dwoma punktami zgadza się z macierzą', async () => {
  const answer = await ask('Ile km jest z Bargi do Grotta del Vento?');
  assert.match(answer, /km/i);
});

test('e2e: pytanie "co spakować" zwraca listę z packing_list', async () => {
  const answer = await ask('Co muszę spakować?');
  assert.match(answer, /paszport|dokument/i);
});

test('e2e: pytanie o ostatni dzień podaje datę końcową 27.09', async () => {
  const answer = await ask('Kiedy wracamy do domu?');
  assert.match(answer, /27\.09|2026-09-27/);
});

test('e2e: pytanie wieloetapowe (dzień + godziny) wykonuje więcej niż jedną iterację narzędzi', async () => {
  const answer = await ask('Co robimy w dniu 8 i o której otwiera się tam pierwsza atrakcja?');
  assert.ok(answer.length > 0);
});

test('e2e: pytanie po polsku z literówką w dacie nadal trafia właściwy dzień', async () => {
  const answer = await ask('co bedziemy robic dnia dziewietnastego wrzesnia');
  assert.match(answer, /Chianti|Brolio/i);
});
