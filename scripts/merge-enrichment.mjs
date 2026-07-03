#!/usr/bin/env node
/**
 * Scal enrichment/dzien-NN.json do plan.json
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = join(ROOT, 'plan.json');
const ENRICHMENT_DIR = join(ROOT, 'enrichment');

const ENRICHMENT_FIELDS = [
  'web_research',
  'practical_tips',
  'parking',
  'fuel_stops',
  'opening_hours',
  'route',
  'route_segments',
];

function mergeArrays(existing, incoming, keyFn) {
  if (!incoming?.length) return existing ?? [];
  const base = [...(existing ?? [])];
  const seen = new Set(base.map(keyFn));
  for (const item of incoming) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      base.push(item);
      seen.add(k);
    }
  }
  return base;
}

function mergeObject(existing, incoming) {
  if (!incoming || typeof incoming !== 'object') return existing;
  if (!existing || typeof existing !== 'object') return { ...incoming };
  return { ...existing, ...incoming };
}

function mergeDay(planDay, enrichedDay) {
  const merged = { ...planDay };

  for (const field of ENRICHMENT_FIELDS) {
    if (enrichedDay[field] === undefined) continue;

    if (field === 'web_research') {
      merged.web_research = mergeArrays(
        planDay.web_research,
        enrichedDay.web_research,
        (x) => x.topic ?? JSON.stringify(x)
      );
    } else if (field === 'practical_tips') {
      merged.practical_tips = mergeArrays(
        planDay.practical_tips,
        enrichedDay.practical_tips,
        (x) => x
      );
    } else if (field === 'fuel_stops') {
      merged.fuel_stops = mergeArrays(
        planDay.fuel_stops,
        enrichedDay.fuel_stops,
        (x) => x.name ?? JSON.stringify(x)
      );
    } else if (field === 'route_segments') {
      merged.route_segments = mergeArrays(
        planDay.route_segments,
        enrichedDay.route_segments,
        (x) => x.segment ?? JSON.stringify(x)
      );
    } else if (field === 'parking' || field === 'opening_hours') {
      merged[field] = mergeObject(planDay[field], enrichedDay[field]);
    } else {
      // route — prefer enriched if longer/more detailed
      if (!planDay[field] || (enrichedDay[field]?.length ?? 0) > (planDay[field]?.length ?? 0)) {
        merged[field] = enrichedDay[field];
      }
    }
  }

  // Merge nested objects (accommodation, food) without overwriting
  for (const nested of ['accommodation', 'food']) {
    if (enrichedDay[nested]) {
      merged[nested] = mergeObject(planDay[nested], enrichedDay[nested]);
      if (enrichedDay[nested].options && enrichedDay[nested].options.length) {
        merged[nested].options = mergeArrays(
          planDay[nested]?.options,
          enrichedDay[nested].options,
          (x) => x.name ?? JSON.stringify(x)
        );
      }
    }
  }

  if (enrichedDay.tips?.length) {
    merged.tips = mergeArrays(planDay.tips, enrichedDay.tips, (x) => x);
  }

  return merged;
}

const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const files = readdirSync(ENRICHMENT_DIR)
  .filter((f) => /^dzien-\d{2}\.json$/.test(f))
  .sort();

if (files.length === 0) {
  console.log('Brak plików enrichment.');
  process.exit(1);
}

const mergedDays = [];

for (const file of files) {
  const dayNum = parseInt(file.match(/dzien-(\d{2})/)[1], 10);
  const enriched = JSON.parse(readFileSync(join(ENRICHMENT_DIR, file), 'utf8'));
  const idx = plan.days.findIndex((d) => d.day_num === dayNum);
  if (idx === -1) {
    console.warn(`Ostrzeżenie: brak dnia ${dayNum} w plan.json`);
    continue;
  }
  plan.days[idx] = mergeDay(plan.days[idx], enriched);
  mergedDays.push(dayNum);
}

plan.meta.last_enriched = new Date().toISOString();
plan.meta.enrichment_days = mergedDays.sort((a, b) => a - b);

const out = JSON.stringify(plan, null, 2) + '\n';
JSON.parse(out); // validate
writeFileSync(PLAN_PATH, out, 'utf8');

console.log(`Scalono ${mergedDays.length} dni: ${mergedDays.join(', ')}`);
console.log(`meta.last_enriched = ${plan.meta.last_enriched}`);
