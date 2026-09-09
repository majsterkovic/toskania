import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './systemPrompt.js';
import { buildToolRegistry } from '../tools/index.js';

const trip = {
  meta: { start_date: '2026-09-12' },
  days: [{ day_num: 1, title: 'Dojazd', label: 'DZIEŃ 1', base_id: null, summary: 'Jazda.' }],
};
const distanceMatrix = { points: [], durations: [], distances: [] };

test('buildSystemPrompt: zawiera regułę "nie zgaduj" i spis dni', () => {
  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const prompt = buildSystemPrompt({ trip, toolRegistry });
  assert.match(prompt, /nie ma danych/);
  assert.match(prompt, /Dojazd/);
});
