import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const META_REQUIRED = [
  'schema_version', 'brand', 'storage_key', 'timezone',
  'start_date', 'end_date', 'title', 'dates', 'phase_labels',
];
const IMAGE_SIZE_KEYS = ['hero__figure', 'daypage__hero', 'attraction-thumb'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCoords(v) {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function validateTrip(trip, config) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!trip || typeof trip !== 'object') err('trip is not an object');
  if (!trip?.meta || typeof trip.meta !== 'object') err('meta missing');
  else {
    if (trip.meta.schema_version !== 1) err('meta.schema_version must be 1');
    for (const k of META_REQUIRED) {
      if (trip.meta[k] == null || trip.meta[k] === '') err(`meta.${k} missing`);
    }
    if (trip.meta.start_date && !DATE.test(trip.meta.start_date)) err('meta.start_date must be YYYY-MM-DD');
    if (trip.meta.end_date && !DATE.test(trip.meta.end_date)) err('meta.end_date must be YYYY-MM-DD');
    const pl = trip.meta.phase_labels;
    if (pl) {
      for (const key of ['dojazd', 'powrot']) {
        if (!pl[key]?.label || !pl[key]?.sub) err(`meta.phase_labels.${key}.{label,sub} missing`);
      }
    }
  }

  if (!config?.imageSizes) err('config.imageSizes missing');
  else {
    for (const k of IMAGE_SIZE_KEYS) {
      if (!config.imageSizes[k]) err(`config.imageSizes.${k} missing`);
    }
  }

  for (const key of ['costs', 'todo', 'practical_info', 'packing_list']) {
    if (trip[key] == null || typeof trip[key] !== 'object') err(`${key} missing`);
  }

  const bases = Array.isArray(trip.bases) ? trip.bases : [];
  if (!bases.length) err('bases empty');
  const baseIds = new Set();
  for (const b of bases) {
    if (!b?.id) err('base without id');
    else if (baseIds.has(b.id)) err(`duplicate base id ${b.id}`);
    else baseIds.add(b.id);
    if (!isCoords(b?.coords)) err(`base ${b?.id} missing coords [lat, lon]`);
  }

  const days = Array.isArray(trip.days) ? trip.days : [];
  const nums = new Set();
  for (const d of days) {
    if (d.day_num == null) continue;
    if (nums.has(d.day_num)) err(`duplicate day_num ${d.day_num}`);
    nums.add(d.day_num);
    if (d.base_id != null && !baseIds.has(d.base_id)) err(`day ${d.day_num} unknown base_id ${d.base_id}`);
    if (d.next_base_id != null && !baseIds.has(d.next_base_id)) {
      err(`day ${d.day_num} unknown next_base_id ${d.next_base_id}`);
    }
    if (d.type === 'transit') {
      const pts = d.route_points || [];
      if (!pts.length) err(`day ${d.day_num} transit without route_points`);
      pts.forEach((p, i) => {
        if (!isCoords(p.coords)) err(`day ${d.day_num} route_points[${i}] missing coords`);
      });
    }
    for (const a of d.attractions || []) {
      if (!a.coords) continue;
      if (!isCoords(a.coords)) err(`day ${d.day_num} attraction "${a.name}" bad coords`);
      if (typeof a.drive_min === 'number' && Number.isFinite(a.drive_min)) continue;
      if (a.drive_min === null && typeof a.drive_min_reason === 'string' && a.drive_min_reason.trim()) continue;
      err(`day ${d.day_num} attraction "${a.name}" needs drive_min (number) or null + drive_min_reason`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const trip = JSON.parse(await readFile(resolve('trip.json'), 'utf8'));
  const { default: config } = await import(pathToFileURL(resolve('trip.config.js')).href);
  const r = validateTrip(trip, config);
  if (!r.ok) {
    console.error(r.errors.map((e) => `• ${e}`).join('\n'));
    process.exit(1);
  }
  console.log('trip.json OK');
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
