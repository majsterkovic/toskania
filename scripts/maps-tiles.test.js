import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/maps.js'),
  'utf8'
);

test('basemap is not unauthenticated CARTO raster', () => {
  const usesCarto = /basemaps\.cartocdn\.com/.test(src);
  const hasKey = /cartocdn\.com[^'"\n]*[?&]key=/.test(src);
  assert.equal(
    usesCarto && !hasKey,
    false,
    'CARTO raster tiles watermark without ?key=; use OSM (or pass a key)'
  );
});
