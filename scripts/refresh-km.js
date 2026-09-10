/**
 * refresh-km.js — opcja A (jedno źródło prawdy): przelicza dzienne kilometry
 * przez publiczny OSRM i wpisuje je do trip.json jako cache.
 *
 * - live OSRM w przeglądarce koryguje kafelki/panel na bieżąco (maps.js),
 * - ten skrypt dba, żeby cache w trip.json nie gnił (kafelki, oś czasu, fallback offline).
 * - przy braku sieci lub błędzie API stare wartości zostają (exit 0).
 * - dni z `km_lock: true` są pomijane (ręczna wartość — np. część trasy pociągiem,
 *   skrypt liczyłby ją jak przejazd autem).
 *
 * Użycie: npm run km:refresh
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OSRM_ROUTE = 'https://router.project-osrm.org/route/v1/driving/';

/**
 * Punkty trasy dnia — ta sama logika co maps.js:
 * - transit: route_points,
 * - transfer (inna baza docelowa): baza → atrakcje → baza docelowa (w jedną stronę),
 * - zwykły dzień: baza → atrakcje → baza (pętla).
 * Zwraca tablicę [lat, lon].
 */
export function dayRouteCoords(day, basesById) {
  if (day.type === 'transit') {
    return (day.route_points || []).filter((p) => Array.isArray(p.coords)).map((p) => p.coords);
  }
  const base = basesById[day.base_id];
  const destBase = day.next_base_id ? basesById[day.next_base_id] : null;
  const isTransfer = destBase?.coords && destBase.id !== base?.id;
  const atts = (day.attractions || []).filter((a) => Array.isArray(a.coords)).map((a) => a.coords);
  const out = [];
  if (base?.coords) out.push(base.coords);
  out.push(...atts);
  if (isTransfer) {
    if (destBase?.coords) out.push(destBase.coords);
  } else if (base?.coords && atts.length) {
    out.push(base.coords);
  }
  return out;
}

/** Które pole cache'uje kilometry danego dnia. */
export function kmFieldFor(day) {
  if (typeof day.drive_km === 'number') return 'drive_km';
  if (typeof day.daily_km_estimate === 'number') return 'daily_km_estimate';
  return day.type === 'transit' ? 'drive_km' : 'daily_km_estimate';
}

export async function fetchRouteKm(coords, fetchFn = fetch) {
  if (!coords || coords.length < 2) return null;
  const coordStr = coords.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const res = await fetchFn(`${OSRM_ROUTE}${coordStr}?overview=false`);
  if (!res.ok) return null;
  const data = await res.json();
  const meters = data.routes?.[0]?.distance;
  return typeof meters === 'number' && meters > 0 ? Math.round(meters / 1000) : null;
}

async function main() {
  const tripPath = resolve('trip.json');
  const trip = JSON.parse(await readFile(tripPath, 'utf8'));
  const basesById = {};
  for (const b of trip.bases || []) basesById[b.id] = b;

  let updated = 0;
  let skipped = 0;
  for (const day of trip.days || []) {
    if (day.day_num == null) continue;
    if (day.km_lock) {
      console.log(`D${day.day_num}: km_lock — pomijam (ręczna wartość)`);
      skipped++;
      continue;
    }
    const coords = dayRouteCoords(day, basesById);
    if (coords.length < 2) {
      skipped++;
      continue;
    }
    let km = null;
    try {
      km = await fetchRouteKm(coords);
    } catch (err) {
      console.warn(`D${day.day_num}: OSRM nie odpowiedział (${err.message}) — zostawiam starą wartość`);
    }
    if (km == null) {
      skipped++;
      continue;
    }
    const field = kmFieldFor(day);
    const old = day[field];
    if (old !== km) {
      console.log(`D${day.day_num} ${field}: ${old ?? '—'} → ${km} km`);
      day[field] = km;
      updated++;
    }
  }
  if (updated) {
    await writeFile(tripPath, JSON.stringify(trip, null, 2) + '\n');
    console.log(`refresh-km: zaktualizowano ${updated} dni, pominięto ${skipped}`);
  } else {
    console.log(`refresh-km: brak zmian (pominięto ${skipped})`);
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main();
