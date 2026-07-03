#!/usr/bin/env node
/**
 * Poll enrichment/dzien-*.json co INTERVAL_MS, scalaj do plan.json przez max DURATION_MS.
 */
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHMENT_DIR = join(ROOT, 'enrichment');
const MERGE_SCRIPT = join(ROOT, 'scripts', 'merge-enrichment.mjs');

const INTERVAL_MS = 30_000;
const DURATION_MS = 25 * 60 * 1000;

function listEnrichmentFiles() {
  try {
    return readdirSync(ENRICHMENT_DIR)
      .filter((f) => /^dzien-\d{2}\.json$/.test(f))
      .sort();
  } catch {
    return [];
  }
}

function fingerprint(files) {
  return files
    .map((f) => {
      const p = join(ENRICHMENT_DIR, f);
      const st = statSync(p);
      return `${f}:${st.mtimeMs}:${st.size}`;
    })
    .join('|');
}

function runMerge() {
  const result = spawnSync(process.execPath, [MERGE_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const out = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0) {
    console.log(`[merge] exit ${result.status}: ${out.trim()}`);
    return false;
  }
  console.log(`[merge] ${out.trim()}`);
  return true;
}

const started = Date.now();
const deadline = started + DURATION_MS;
let lastFp = '';
let iteration = 0;

console.log(`Polling enrichment co ${INTERVAL_MS / 1000}s, max ${DURATION_MS / 60000} min`);

while (Date.now() < deadline) {
  iteration++;
  const files = listEnrichmentFiles();
  const fp = fingerprint(files);
  const elapsed = Math.round((Date.now() - started) / 1000);

  if (files.length === 0) {
    console.log(`[${elapsed}s] #${iteration} brak plików dzien-*.json`);
  } else if (fp !== lastFp) {
    console.log(`[${elapsed}s] #${iteration} zmiana: ${files.join(', ')}`);
    runMerge();
    lastFp = fp;
  } else {
    console.log(`[${elapsed}s] #${iteration} bez zmian (${files.length} plików)`);
  }

  const remaining = deadline - Date.now();
  if (remaining <= 0) break;
  await new Promise((r) => setTimeout(r, Math.min(INTERVAL_MS, remaining)));
}

console.log(`Koniec pollingu po ${Math.round((Date.now() - started) / 1000)}s, ${iteration} iteracji`);
