import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from './systemPrompt.js';
import { buildToolRegistry } from '../tools/index.js';

const trip = {
  meta: { start_date: '2026-09-12' },
  days: [{ day_num: 1, title: 'Dojazd', label: 'DZIEŃ 1', base_id: null, summary: 'Jazda.' }],
};
const distanceMatrix = { points: [], durations: [], distances: [] };

test('buildRouterSystemPrompt: zawiera regułę "nie zgaduj", spis dni i dzisiejszą datę', () => {
  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const prompt = buildRouterSystemPrompt({ trip, toolRegistry, today: '2026-09-15' });
  assert.match(prompt, /nie ma danych/);
  assert.match(prompt, /Dojazd/);
  assert.match(prompt, /2026-09-15/);
});

test('buildRouterSystemPrompt: wymienia searchFood wśród dostępnych narzędzi', () => {
  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const prompt = buildRouterSystemPrompt({ trip, toolRegistry, today: '2026-09-15' });
  assert.match(prompt, /searchFood/);
});

test('buildWriterSystemPrompt: instruuje pisanie po polsku, link #/dzien-<n> i dzisiejszą datę', () => {
  const prompt = buildWriterSystemPrompt({ trip, today: '2026-09-15' });
  assert.match(prompt, /PO POLSKU/);
  assert.match(prompt, /#\/dzien-<n>/);
  assert.match(prompt, /2026-09-15/);
});

test('todayIso: zwraca datę w formacie YYYY-MM-DD', () => {
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});
