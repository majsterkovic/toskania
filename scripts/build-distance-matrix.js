import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import trip from '../trip.json' with { type: 'json' };

const OUT_PATH = resolve('src/distance-matrix.json');
const OSRM_URL = 'https://router.project-osrm.org/table/v1/driving/';

export function collectPoints(trip) {
  const points = [];
  for (const base of trip.bases ?? []) {
    if (Array.isArray(base.coords)) {
      points.push({ id: base.id, name: base.name, lat: base.coords[0], lon: base.coords[1] });
    }
  }
  for (const day of trip.days ?? []) {
    (day.attractions ?? []).forEach((a, i) => {
      if (Array.isArray(a.coords)) {
        points.push({ id: `day${day.day_num}-attr${i}`, name: a.name, lat: a.coords[0], lon: a.coords[1] });
      }
    });
  }
  return points;
}

export function buildMatrixPayload(points, osrmResponse) {
  return {
    points,
    durations: osrmResponse.durations,
    distances: osrmResponse.distances,
  };
}

async function fetchOsrmTable(points) {
  const coordsPath = points.map((p) => `${p.lon},${p.lat}`).join(';');
  const res = await fetch(`${OSRM_URL}${coordsPath}?annotations=duration,distance`);
  if (!res.ok) throw new Error(`OSRM /table ${res.status}`);
  return res.json();
}

async function main() {
  const points = collectPoints(trip);
  console.log(`build-distance-matrix: ${points.length} punktów z coords`);
  try {
    const osrmResponse = await fetchOsrmTable(points);
    const payload = buildMatrixPayload(points, osrmResponse);
    await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log(`build-distance-matrix: zapisano ${OUT_PATH}`);
  } catch (err) {
    console.warn(`build-distance-matrix: OSRM nie odpowiedział (${err.message}), zostawiam poprzednią wersję pliku`);
    await readFile(OUT_PATH).catch(() => {
      console.error('build-distance-matrix: brak poprzedniej wersji pliku i OSRM padł — pierwszy build musi mieć sieć');
      process.exitCode = 1;
    });
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main();
