import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTrip } from './validate-trip.js';

const root = dirname(fileURLToPath(import.meta.url));
const minimal = JSON.parse(readFileSync(join(root, 'fixtures/trip-minimal.json'), 'utf8'));
const config = {
  id: 'test-trip',
  imageSizes: {
    'hero__figure': '(min-width: 1024px) 640px, 100vw',
    'daypage__hero': '(min-width: 900px) 860px, 100vw',
    'attraction-thumb': '96px',
  },
  imageAliases: {},
};

test('minimal trip passes', () => {
  const r = validateTrip(minimal, config);
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('missing schema_version fails', () => {
  const trip = structuredClone(minimal);
  delete trip.meta.schema_version;
  const r = validateTrip(trip, config);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /schema_version/);
});

test('base without coords fails', () => {
  const trip = structuredClone(minimal);
  delete trip.bases[0].coords;
  const r = validateTrip(trip, config);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /coords/);
});

test('unknown base_id fails', () => {
  const trip = structuredClone(minimal);
  trip.days[1].base_id = 'base9';
  const r = validateTrip(trip, config);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /base_id/);
});

test('attraction coords without drive_min fails', () => {
  const trip = structuredClone(minimal);
  delete trip.days[1].attractions[0].drive_min;
  const r = validateTrip(trip, config);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /drive_min/);
});

test('drive_min null requires drive_min_reason', () => {
  const trip = structuredClone(minimal);
  trip.days[1].attractions[0].drive_min = null;
  const r = validateTrip(trip, config);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /drive_min_reason/);
  trip.days[1].attractions[0].drive_min_reason = 'pociąg';
  assert.equal(validateTrip(trip, config).ok, true);
});

test('missing imageSizes key fails', () => {
  const r = validateTrip(minimal, { ...config, imageSizes: {} });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /imageSizes/);
});
