# Czat z planem — bramka, tożsamość, hosting na VPS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dać pięciorgu uczestnikom wycieczki czat odpowiadający na pytania o `trip.json` z telefonu, za wspólną bramką hasła + samodzielnie wybranym imieniem, hostowany na `toskania.hybiak.eu` (VPS, wzorzec `karpacz`/`gieldowo`).

**Architecture:** Fastify (Node) serwuje `dist/` (Vite build) i `/api/*`. Cała logika planu żyje w czystych funkcjach `server/tools/`, współdzielonych przez pętlę czatu (function-calling przez LiteLLM). SQLite (`better-sqlite3`) trzyma wyłącznie warstwę runtime (użytkownicy, sesje, wiadomości, zużycie) — `trip.json` zostaje jedynym źródłem prawdy o planie, read-only. Macierz odległości liczona raz przy buildzie (OSRM `/table`), commitowana jak `image-manifest.json`.

**Tech Stack:** Node 22 (Docker: `node:22-alpine`; dev lokalnie: v24.20.0 — projekt nie ma `engines`, oba działają), Fastify 5.12.3, `@fastify/cookie` 11.1.2, `@fastify/static` 10.1.3, `@fastify/rate-limit` 11.2.0, `better-sqlite3` 13.0.3, Vite 6 (bez zmian w wersji), `node --test` (istniejący wzorzec testowy repo).

**Spec:** `docs/superpowers/specs/2026-09-09-czat-konta-vps-design.md`

## Global Constraints

- Sygnatury `server/tools/` (§5 spec) są kontraktem — czat, render i przyszłe MCP widzą dokładnie te same funkcje. Zero drugiej implementacji logiki planu.
- Każda funkcja narzędziowa zwraca `null`/pustą listę zamiast zgadywać (§5 „Kontrakt braku danych").
- Sekrety wchodzą do kontenerów wyłącznie przez `environment:`, nigdy `env_file` (§10).
- Nazwa modelu LLM nigdy nie wchodzi do kodu — tylko `CHAT_MODEL`/`CHAT_MODEL_FALLBACK` z env (§8, `08-routing-llm.md`).
- Rate limiter bramki MUSI czytać `CF-Connecting-IP`, nie `req.ip` (§9, §16.6) — za Cloudflare Tunnel `req.ip` to adres `cloudflared`.
- Bramka (`/api/auth/gate`, `/api/auth/who`) chroni budżet LLM, nie treść — strona z planem i statyczne assety zostają publiczne (§9, kryterium 4).
- Tożsamość jest zadeklarowana, nie uwierzytelniona — brak `login`/`password_hash` w schemacie (§7).
- Limit iteracji pętli narzędziowej: **5**. Timeout całego żądania: **30 s**, pojedynczego wywołania LLM: **15 s** (§8).
- `trip.json` pozostaje read-only w runtime (D4) — żaden endpoint go nie modyfikuje.
- **Freeze do 2026-09-28**: ten plan można pisać i review'ować teraz, ale egzekucja (implementacja) zaczyna się dopiero po powrocie z wycieczki, chyba że użytkownik jawnie zniesie freeze.
- Zakres tego planu to **wyłącznie plastry 1–3** ze spec §14 (Rdzeń narzędzi / Backend czatu + tożsamość / Frontend + cutover). Plastry 4 (adapter MCP) i 5 (warstwa osobista `checks`) są świadomie poza zakresem — mają odrębne, niezależnie testowalne dostawy i nie są potrzebne żadnemu z kryteriów akceptacji §15.

---

## Plaster 1: Rdzeń narzędzi

Cel plastra: funkcje z testami, zero HTTP i LLM-a (§14 wiersz 1).

### Task 1: Zależności backendu w `package.json`

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `fastify`, `@fastify/cookie`, `@fastify/static`, `@fastify/rate-limit`, `better-sqlite3` dostępne jako importy dla wszystkich kolejnych zadań.

- [ ] **Step 1: Zainstaluj zależności produkcyjne w dokładnie tych wersjach**

```bash
npm install --save-exact fastify@5.12.3 @fastify/cookie@11.1.2 @fastify/static@10.1.3 @fastify/rate-limit@11.2.0 better-sqlite3@13.0.3
```

- [ ] **Step 2: Sprawdź, że `package.json` ma nową sekcję `dependencies`**

Run: `cat package.json`
Expected: blok `"dependencies"` z pięcioma pakietami powyżej, `"devDependencies"` bez zmian (`sharp`, `vite`).

- [ ] **Step 3: Dopisz skrypty `start` i `test:e2e`, rozszerz `test` o przyszłe testy backendu**

Edytuj `package.json` → `"scripts"`:

```json
{
  "dev": "vite",
  "build": "node scripts/validate-trip.js && node scripts/build-distance-matrix.js && node scripts/convert-webp.js && vite build",
  "preview": "vite preview",
  "start": "node server/index.js",
  "test": "node --test scripts/validate-trip.test.js scripts/maps-tiles.test.js scripts/reservations.test.js scripts/build-distance-matrix.test.js server/**/*.test.js",
  "test:e2e": "node --test server/chat/loop.e2e.test.js"
}
```

`npm run build` woła teraz `build-distance-matrix.js` **przed** `vite build` (§6, punkt 1) — plik jeszcze nie istnieje, to normalne, powstaje w Tasku 3.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: dodaj zależności backendu (fastify, better-sqlite3)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 2: Rozwiązywanie dat dnia (`server/tools/dates.js`)

**Files:**
- Create: `server/tools/dates.js`
- Test: `server/tools/dates.test.js`

**Interfaces:**
- Consumes: `trip.meta.start_date` (ISO `YYYY-MM-DD`), `trip.days[].day_num` (1-indeksowany, bez dziur — zweryfikowane na żywym `trip.json`: dzień 1 → `meta.start_date`, dzień N → `start_date + (N-1)` dni).
- Produces: `dayNumToIsoDate(trip, dayNum): string`, `isoDateToDayNum(trip, isoDate): number`. Używane przez `getDay()` (Task 5) i `openingHours()` (Task 5).

- [ ] **Step 1: Napisz failujący test**

```js
// server/tools/dates.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumToIsoDate, isoDateToDayNum } from './dates.js';

const trip = { meta: { start_date: '2026-09-12' } };

test('dayNumToIsoDate: dzień 1 to start_date', () => {
  assert.equal(dayNumToIsoDate(trip, 1), '2026-09-12');
});

test('dayNumToIsoDate: dzień 16 to start_date + 15 dni', () => {
  assert.equal(dayNumToIsoDate(trip, 16), '2026-09-27');
});

test('isoDateToDayNum: odwraca dayNumToIsoDate', () => {
  assert.equal(isoDateToDayNum(trip, '2026-09-19'), 8);
});

test('isoDateToDayNum: data poza zakresem daje ujemny/za duży numer, nie rzuca', () => {
  assert.equal(isoDateToDayNum(trip, '2026-09-01'), -10);
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/tools/dates.test.js`
Expected: FAIL — `Cannot find module './dates.js'`.

- [ ] **Step 3: Zaimplementuj**

```js
// server/tools/dates.js
const DAY_MS = 24 * 60 * 60 * 1000;

export function dayNumToIsoDate(trip, dayNum) {
  const start = Date.parse(`${trip.meta.start_date}T00:00:00Z`);
  const d = new Date(start + (dayNum - 1) * DAY_MS);
  return d.toISOString().slice(0, 10);
}

export function isoDateToDayNum(trip, isoDate) {
  const start = Date.parse(`${trip.meta.start_date}T00:00:00Z`);
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  return Math.round((target - start) / DAY_MS) + 1;
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/tools/dates.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add server/tools/dates.js server/tools/dates.test.js
git commit -m "feat(tools): rozwiązywanie dzień_num <-> data ISO

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 3: `scripts/build-distance-matrix.js`

**Files:**
- Create: `scripts/build-distance-matrix.js`
- Test: `scripts/build-distance-matrix.test.js`
- Produces (at build time, not by this task's tests): `src/distance-matrix.json`

**Interfaces:**
- Consumes: `trip.json` (import), zwłaszcza `bases[].coords`, `days[].attractions[].coords`, `days[].route_points[].coords` — wszystkie punkty z polem `coords: [lat, lon]`.
- Produces: `collectPoints(trip): {id, name, lat, lon}[]` i `buildMatrixPayload(points, osrmResponse): {points, durations, distances}` — czyste funkcje, testowalne bez sieci. Plik `src/distance-matrix.json` konsumowany przez `route()` (Task 5).

- [ ] **Step 1: Napisz failujący test na czystych funkcjach (bez sieci)**

```js
// scripts/build-distance-matrix.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPoints, buildMatrixPayload } from './build-distance-matrix.js';

test('collectPoints: zbiera bazy i atrakcje z coords, pomija punkty bez coords', () => {
  const trip = {
    bases: [{ id: 'base1', name: 'Barga', coords: [44.06, 10.47] }],
    days: [
      {
        day_num: 1,
        attractions: [
          { name: 'Duomo', coords: [44.07, 10.48] },
          { name: 'Bez koordynatów', coords: null },
        ],
      },
    ],
  };
  const points = collectPoints(trip);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { id: 'base1', name: 'Barga', lat: 44.06, lon: 10.47 });
  assert.deepEqual(points[1], { id: 'day1-attr0', name: 'Duomo', lat: 44.07, lon: 10.48 });
});

test('buildMatrixPayload: składa punkty + macierze z odpowiedzi OSRM /table', () => {
  const points = [
    { id: 'a', name: 'A', lat: 1, lon: 2 },
    { id: 'b', name: 'B', lat: 3, lon: 4 },
  ];
  const osrmResponse = {
    durations: [[0, 600], [600, 0]],
    distances: [[0, 5000], [5000, 0]],
  };
  const payload = buildMatrixPayload(points, osrmResponse);
  assert.deepEqual(payload.points, points);
  assert.deepEqual(payload.durations, osrmResponse.durations);
  assert.deepEqual(payload.distances, osrmResponse.distances);
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test scripts/build-distance-matrix.test.js`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 3: Zaimplementuj (czyste funkcje + `main()` z siecią, wzorem `validate-trip.js`)**

```js
// scripts/build-distance-matrix.js
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
```

- [ ] **Step 4: Uruchom ponownie testy czystych funkcji**

Run: `node --test scripts/build-distance-matrix.test.js`
Expected: PASS, 2/2 (testy nie dotykają sieci — `main()` nie jest wywoływane pod testem).

- [ ] **Step 5: Uruchom skrypt naprawdę, żeby wygenerować i zacommitować plik**

Run: `node scripts/build-distance-matrix.js`
Expected: `build-distance-matrix: 61 punktów z coords` i `zapisano src/distance-matrix.json` (albo ostrzeżenie o OSRM — w takim razie sprawdź do zweryfikowania §16.3 zanim uznasz task za skończony: limit `/table` dla 61 punktów w jednym żądaniu).

- [ ] **Step 6: Commit (kod + wygenerowany plik, wzorem `image-manifest.json`)**

```bash
git add scripts/build-distance-matrix.js scripts/build-distance-matrix.test.js src/distance-matrix.json
git commit -m "feat: macierz odległości liczona przy buildzie (OSRM /table)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 4: Walidator — spójność `distance-matrix.json` z `trip.json`

**Files:**
- Modify: `scripts/validate-trip.js`
- Modify: `scripts/validate-trip.test.js`

**Interfaces:**
- Consumes: `collectPoints(trip)` z Task 3, plik `src/distance-matrix.json`.
- Produces: `validateTrip(trip, config, distanceMatrix?)` — trzeci, opcjonalny parametr; wywołania bez niego (istniejące testy) zachowują dotychczasowe zachowanie.

- [ ] **Step 1: Przeczytaj obecny plik, żeby zobaczyć dokładny koniec funkcji `validateTrip`**

Run: `tail -n 30 scripts/validate-trip.js`

- [ ] **Step 2: Napisz failujący test**

Dopisz do `scripts/validate-trip.test.js` (importy w pliku już istnieją — `validateTrip`, `structuredClone`):

```js
test('validateTrip: distance-matrix.json niezgodny z trip.json daje błąd', () => {
  const trip = structuredClone(fixture);
  const config = structuredClone(fixtureConfig);
  const badMatrix = { points: [{ id: 'nieistniejący', name: 'X', lat: 0, lon: 0 }] };
  const { ok, errors } = validateTrip(trip, config, badMatrix);
  assert.equal(ok, false);
  assert.match(errors.join('\n'), /distance-matrix/);
});

test('validateTrip: distance-matrix.json zgodny z trip.json przechodzi', () => {
  const trip = structuredClone(fixture);
  const config = structuredClone(fixtureConfig);
  const matrix = { points: collectPoints(trip) };
  const { ok } = validateTrip(trip, config, matrix);
  assert.equal(ok, true);
});
```

Dopisz import na górze pliku: `import { collectPoints } from './build-distance-matrix.js';`

- [ ] **Step 3: Uruchom i sprawdź, że pada**

Run: `node --test scripts/validate-trip.test.js`
Expected: FAIL — trzeci argument jest ignorowany, oba nowe testy nie widzą oczekiwanego zachowania (pierwszy nie zwraca błędu, drugi przechodzi przypadkiem).

- [ ] **Step 4: Dopisz walidację w `validateTrip`**

Na końcu funkcji `validateTrip`, przed `return { ok: errors.length === 0, errors };`:

```js
  if (distanceMatrix) {
    const expectedIds = new Set(collectPoints(trip).map((p) => p.id));
    const actualIds = new Set((distanceMatrix.points ?? []).map((p) => p.id));
    if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) {
      err('distance-matrix.json niezgodny z trip.json — uruchom `node scripts/build-distance-matrix.js`');
    }
  }
```

Zmień sygnaturę na `export function validateTrip(trip, config, distanceMatrix) {`.

Zaktualizuj `main()` w tym samym pliku, żeby wołał walidator z macierzą:

```js
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
// ...
const { ok, errors } = validateTrip(trip, config, distanceMatrix);
```

- [ ] **Step 5: Uruchom ponownie**

Run: `node --test scripts/validate-trip.test.js`
Expected: PASS, wszystkie testy w pliku (stare + 2 nowe).

- [ ] **Step 6: Uruchom pełny build, żeby potwierdzić integrację**

Run: `npm run build`
Expected: walidator przechodzi, `vite build` kończy się sukcesem.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-trip.js scripts/validate-trip.test.js
git commit -m "feat(walidator): sprawdzaj spójność distance-matrix.json z trip.json

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 5: Warstwa narzędzi (`server/tools/index.js` + siedem funkcji)

**Files:**
- Create: `server/tools/listDays.js`, `server/tools/getDay.js`, `server/tools/searchPlan.js`, `server/tools/route.js`, `server/tools/openingHours.js`, `server/tools/costsAndLists.js`, `server/tools/index.js`
- Test: `server/tools/index.test.js`

**Interfaces:**
- Consumes: `trip` (obiekt `trip.json`), `distanceMatrix` (obiekt `src/distance-matrix.json`), `dayNumToIsoDate`/`isoDateToDayNum` z Task 2.
- Produces: `buildToolRegistry({ trip, distanceMatrix }): Record<string, { description: string, parameters: object, execute: (args: object) => unknown }>` z kluczami `listDays`, `getDay`, `searchPlan`, `route`, `openingHours`, `costs`, `todo`, `packing`. Używane przez pętlę czatu (Task 12) i prompt systemowy (Task 12).

- [ ] **Step 1: Napisz failujące testy dla wszystkich siedmiu funkcji na fixture**

```js
// server/tools/index.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildToolRegistry } from './index.js';

const trip = {
  meta: { start_date: '2026-09-12' },
  bases: [{ id: 'base1', name: 'Barga', coords: [44.06, 10.47] }],
  days: [
    {
      day_num: 1, date: '12.09 (sob)', type: 'transit', base_id: null,
      title: 'Dojazd', label: 'DZIEŃ 1', summary: 'Jazda do Toskanii.',
      attractions: [],
      opening_hours: {},
    },
    {
      day_num: 8, date: '19.09 (sob)', type: 'tuscany', base_id: 'base2',
      title: 'Chianti', label: 'DZIEŃ 8', summary: 'Winnice i zamki.',
      attractions: [
        { name: 'Castello di Brolio', coords: [43.47, 11.48], opening_hours: '10:00–18:00', description: 'Zamek i winnica.' },
      ],
      opening_hours: { castello_di_brolio: '10:00–18:00, zamknięte poniedziałki' },
    },
  ],
  costs: { total_eur: 5000 },
  todo: { przed_wyjazdem: ['Sprawdzić opony'] },
  packing_list: { dokumenty: ['Paszport'] },
};

const distanceMatrix = {
  points: [
    { id: 'base1', name: 'Barga', lat: 44.06, lon: 10.47 },
    { id: 'day8-attr0', name: 'Castello di Brolio', lat: 43.47, lon: 11.48 },
  ],
  durations: [[0, 3600], [3600, 0]],
  distances: [[0, 40000], [40000, 0]],
};

const tools = buildToolRegistry({ trip, distanceMatrix });

test('listDays: zwraca skrócone dni z day_num, date, title, label, base_id, summary', () => {
  const days = tools.listDays.execute({});
  assert.equal(days.length, 2);
  assert.deepEqual(days[0], {
    day_num: 1, date: '2026-09-12', title: 'Dojazd', label: 'DZIEŃ 1', base_id: null, summary: 'Jazda do Toskanii.',
  });
});

test('getDay: po numerze zwraca pełny obiekt dnia z dołożoną datą ISO', () => {
  const day = tools.getDay.execute({ day: 8 });
  assert.equal(day.day_num, 8);
  assert.equal(day.iso_date, '2026-09-19');
  assert.equal(day.title, 'Chianti');
});

test('getDay: po dacie ISO zwraca ten sam dzień co po numerze', () => {
  const byDate = tools.getDay.execute({ day: '2026-09-19' });
  const byNum = tools.getDay.execute({ day: 8 });
  assert.deepEqual(byDate, byNum);
});

test('getDay: nieistniejący dzień zwraca null, nie rzuca', () => {
  assert.equal(tools.getDay.execute({ day: 99 }), null);
});

test('searchPlan: trafia frazę w tytule dnia i nazwie atrakcji, zwraca day_num', () => {
  const hits = tools.searchPlan.execute({ query: 'Brolio' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].day_num, 8);
});

test('searchPlan: brak trafień zwraca pustą listę', () => {
  assert.deepEqual(tools.searchPlan.execute({ query: 'coś czego nie ma' }), []);
});

test('route: zgadza się z macierzą po id punktów', () => {
  const r = tools.route.execute({ from: 'base1', to: 'day8-attr0' });
  assert.deepEqual(r, { km: 40, min: 60, source: 'matrix' });
});

test('route: brak punktu w macierzy zwraca null', () => {
  assert.equal(tools.route.execute({ from: 'base1', to: 'nieznany' }), null);
});

test('openingHours: trafienie po slugu z opening_hours dnia', () => {
  const h = tools.openingHours.execute({ place: 'castello_di_brolio', date: '2026-09-19' });
  assert.equal(h, '10:00–18:00, zamknięte poniedziałki');
});

test('openingHours: fallback do opening_hours atrakcji po dopasowaniu nazwy', () => {
  const h = tools.openingHours.execute({ place: 'Brolio', date: '2026-09-19' });
  assert.equal(h, '10:00–18:00');
});

test('openingHours: brak danych zwraca null, nie zgaduje', () => {
  assert.equal(tools.openingHours.execute({ place: 'nieznane miejsce', date: '2026-09-19' }), null);
});

test('costs: zwraca costs z trip.json bez zmian', () => {
  assert.deepEqual(tools.costs.execute({}), trip.costs);
});

test('todo: zwraca todo z trip.json bez zmian', () => {
  assert.deepEqual(tools.todo.execute({}), trip.todo);
});

test('packing: zwraca packing_list z trip.json bez zmian', () => {
  assert.deepEqual(tools.packing.execute({}), trip.packing_list);
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/tools/index.test.js`
Expected: FAIL — moduły nie istnieją.

- [ ] **Step 3: Zaimplementuj każdą funkcję w osobnym pliku**

```js
// server/tools/listDays.js
export function listDaysTool(trip, { dayNumToIsoDate }) {
  return {
    description: 'Lista wszystkich dni wycieczki ze skrótowymi informacjami (spis treści planu).',
    parameters: { type: 'object', properties: {}, required: [] },
    execute() {
      return trip.days.map((d) => ({
        day_num: d.day_num,
        date: dayNumToIsoDate(trip, d.day_num),
        title: d.title,
        label: d.label,
        base_id: d.base_id,
        summary: d.summary,
      }));
    },
  };
}
```

```js
// server/tools/getDay.js
export function getDayTool(trip, { dayNumToIsoDate, isoDateToDayNum }) {
  return {
    description: 'Pełny obiekt dnia (atrakcje, godziny otwarcia, wskazówki) po numerze dnia (1-16) lub dacie ISO YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: { day: { type: ['string', 'number'], description: 'Numer dnia (1-16) albo data ISO YYYY-MM-DD' } },
      required: ['day'],
    },
    execute({ day }) {
      const dayNum = typeof day === 'number' ? day : isoDateToDayNum(trip, day);
      const found = trip.days.find((d) => d.day_num === dayNum);
      if (!found) return null;
      return { ...found, iso_date: dayNumToIsoDate(trip, found.day_num) };
    },
  };
}
```

```js
// server/tools/searchPlan.js
function collectSearchable(trip) {
  const rows = [];
  for (const day of trip.days) {
    rows.push({ day_num: day.day_num, field: 'title', text: day.title ?? '' });
    rows.push({ day_num: day.day_num, field: 'summary', text: day.summary ?? '' });
    for (const a of day.attractions ?? []) {
      rows.push({ day_num: day.day_num, field: `attraction:${a.name}`, text: `${a.name} ${a.description ?? ''}` });
    }
  }
  return rows;
}

export function searchPlanTool(trip) {
  const rows = collectSearchable(trip);
  return {
    description: 'Szuka frazy tekstowo w tytułach dni, opisach i atrakcjach. Zwraca listę trafień z numerem dnia.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Fraza do wyszukania' } },
      required: ['query'],
    },
    execute({ query }) {
      const needle = query.toLowerCase();
      return rows
        .filter((r) => r.text.toLowerCase().includes(needle))
        .map((r) => ({ day_num: r.day_num, field: r.field }));
    },
  };
}
```

```js
// server/tools/route.js
export function routeTool(distanceMatrix) {
  const indexById = new Map(distanceMatrix.points.map((p, i) => [p.id, i]));
  return {
    description: 'Odległość i czas jazdy między dwoma punktami planu (po id z distance-matrix.json).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'id punktu startowego' },
        to: { type: 'string', description: 'id punktu docelowego' },
      },
      required: ['from', 'to'],
    },
    execute({ from, to }) {
      const i = indexById.get(from);
      const j = indexById.get(to);
      if (i === undefined || j === undefined) return null;
      const min = distanceMatrix.durations[i][j] / 60;
      const km = distanceMatrix.distances[i][j] / 1000;
      return { km, min, source: 'matrix' };
    },
  };
}
```

```js
// server/tools/openingHours.js
function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function openingHoursTool(trip, { isoDateToDayNum }) {
  return {
    description: 'Godziny otwarcia miejsca w danym dniu. Zwraca null, jeśli nie ma danych — nie zgaduje.',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'Nazwa lub slug miejsca' },
        date: { type: 'string', description: 'Data ISO YYYY-MM-DD' },
      },
      required: ['place', 'date'],
    },
    execute({ place, date }) {
      const dayNum = isoDateToDayNum(trip, date);
      const day = trip.days.find((d) => d.day_num === dayNum);
      if (!day) return null;
      const slug = slugify(place);
      if (day.opening_hours?.[slug]) return day.opening_hours[slug];
      const bySlugKey = Object.keys(day.opening_hours ?? {}).find((k) => k.includes(slug) || slug.includes(k));
      if (bySlugKey) return day.opening_hours[bySlugKey];
      const attraction = (day.attractions ?? []).find((a) => slugify(a.name).includes(slug) || slug.includes(slugify(a.name)));
      return attraction?.opening_hours ?? null;
    },
  };
}
```

```js
// server/tools/costsAndLists.js
export function costsTool(trip) {
  return {
    description: 'Zestawienie kosztów wycieczki z trip.json.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.costs,
  };
}

export function todoTool(trip) {
  return {
    description: 'Lista rzeczy do zrobienia przed/w trakcie wycieczki z trip.json.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.todo,
  };
}

export function packingTool(trip) {
  return {
    description: 'Lista pakowania z trip.json.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.packing_list,
  };
}
```

```js
// server/tools/index.js
import { dayNumToIsoDate, isoDateToDayNum } from './dates.js';
import { listDaysTool } from './listDays.js';
import { getDayTool } from './getDay.js';
import { searchPlanTool } from './searchPlan.js';
import { routeTool } from './route.js';
import { openingHoursTool } from './openingHours.js';
import { costsTool, todoTool, packingTool } from './costsAndLists.js';

export function buildToolRegistry({ trip, distanceMatrix }) {
  const dateHelpers = { dayNumToIsoDate, isoDateToDayNum };
  return {
    listDays: listDaysTool(trip, dateHelpers),
    getDay: getDayTool(trip, dateHelpers),
    searchPlan: searchPlanTool(trip),
    route: routeTool(distanceMatrix),
    openingHours: openingHoursTool(trip, dateHelpers),
    costs: costsTool(trip),
    todo: todoTool(trip),
    packing: packingTool(trip),
  };
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/tools/index.test.js`
Expected: PASS, wszystkie testy (14).

- [ ] **Step 5: Commit**

```bash
git add server/tools/
git commit -m "feat(tools): warstwa czystych funkcji planu (listDays, getDay, searchPlan, route, openingHours, costs, todo, packing)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 6: SQLite — schemat i połączenie (`server/db/`)

**Files:**
- Create: `server/db/schema.sql`, `server/db/index.js`
- Test: `server/db/index.test.js`

**Interfaces:**
- Produces: `openDb(path?: string): DatabaseSync` (instancja `better-sqlite3`, domyślnie `:memory:`) z założonymi tabelami `users`, `sessions`, `messages`, `usage`, `checks`. Konsumowane przez `server/app.js` (Task 7), `server/auth/*` (Task 8-9), `server/db/usage.js` (Task 13).

- [ ] **Step 1: Napisz failujący test**

```js
// server/db/index.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './index.js';

test('openDb: zakłada tabelę users z UNIQUE(display_name)', () => {
  const db = openDb();
  db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama');
  assert.throws(() => db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama'));
});

test('openDb: sessions ma FK do users i pola expires_at/user_agent', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Tata');
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
    .run('sess-1', userId, '2027-01-01T00:00:00Z', 'test-agent');
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('sess-1');
  assert.equal(row.user_id, userId);
  assert.equal(row.user_agent, 'test-agent');
});

test('openDb: usage ma UNIQUE(user_id, day)', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Ela');
  db.prepare('INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests) VALUES (?, ?, 10, 5, 1)')
    .run(userId, '2026-09-19');
  assert.throws(() =>
    db.prepare('INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests) VALUES (?, ?, 1, 1, 1)')
      .run(userId, '2026-09-19')
  );
});

test('openDb: checks ma PRIMARY KEY (user_id, item_key)', () => {
  const db = openDb();
  const { lastInsertRowid: userId } = db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Ola');
  db.prepare('INSERT INTO checks (user_id, item_key, checked_at) VALUES (?, ?, ?)').run(userId, 'paszport', '2026-09-10');
  assert.throws(() => db.prepare('INSERT INTO checks (user_id, item_key, checked_at) VALUES (?, ?, ?)').run(userId, 'paszport', '2026-09-11'));
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/db/index.test.js`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```sql
-- server/db/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL UNIQUE,
  daily_token_budget INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  day TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, day)
);

CREATE TABLE IF NOT EXISTS checks (
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_key TEXT NOT NULL,
  checked_at TEXT,
  PRIMARY KEY (user_id, item_key)
);
```

```js
// server/db/index.js
import DatabaseConstructor from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

export function openDb(path = ':memory:') {
  const db = new DatabaseConstructor(path);
  db.pragma('foreign_keys = ON');
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/db/index.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add server/db/schema.sql server/db/index.js server/db/index.test.js
git commit -m "feat(db): schemat SQLite (users, sessions, messages, usage, checks)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

## Plaster 2: Backend czatu + tożsamość

Cel plastra: czat działa przez `curl` (§14 wiersz 2).

### Task 7: Szkielet Fastify (`server/app.js`, `server/index.js`, `/healthz`)

**Files:**
- Create: `server/app.js`, `server/index.js`
- Test: `server/app.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 6).
- Produces: `buildApp(opts?: { logger?, db?, dbPath?, sessionSecret?, staticRoot? }): Promise<FastifyInstance>` — `app.db` dekoruje instancję bazą; `/healthz` zwraca `{ ok: true }`. Konsumowane przez wszystkie kolejne route'y (Task 8, 9, 14, 15) i entrypoint (`server/index.js`).

- [ ] **Step 1: Napisz failujący test**

```js
// server/app.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

test('GET /healthz zwraca 200 { ok: true }', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
  await app.close();
});

test('buildApp: dekoruje instancję bazą (app.db)', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  assert.ok(app.db);
  assert.doesNotThrow(() => app.db.prepare('SELECT 1').get());
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/app.test.js`
Expected: FAIL — `server/app.js` nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/app.js
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import { openDb } from './db/index.js';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const db = opts.db ?? openDb(opts.dbPath ?? ':memory:');
  app.decorate('db', db);

  await app.register(fastifyCookie, {
    secret: opts.sessionSecret ?? process.env.SESSION_SECRET,
  });
  await app.register(fastifyRateLimit, { global: false });

  if (opts.staticRoot) {
    await app.register(fastifyStatic, { root: opts.staticRoot });
  }

  app.get('/healthz', async () => ({ ok: true }));

  app.addHook('onClose', (instance, done) => {
    db.close();
    done();
  });

  return app;
}
```

```js
// server/index.js
import { buildApp } from './app.js';

const app = await buildApp({
  logger: true,
  dbPath: process.env.DB_PATH ?? '/data/toskania.db',
  staticRoot: new URL('../dist', import.meta.url).pathname,
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/app.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/app.test.js server/index.js
git commit -m "feat(server): szkielet Fastify + /healthz

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 8: Bramka — `POST /api/auth/gate` z rate limiterem świadomym CF-Connecting-IP

**Files:**
- Create: `server/auth/gate.js`
- Modify: `server/app.js`
- Test: `server/auth/gate.test.js`

**Interfaces:**
- Consumes: `app` z Task 7, `CHAT_PASSPHRASE` (env albo `opts.passphrase`).
- Produces: `registerGateRoute(app, { passphrase }): void`. Ustawia ciasteczko `gate` (podpisane, `httpOnly`, 15 min). Konsumowane przez `requireGate` w Task 9.

**Uwaga (§9, §16.6):** rate limiter MUSI liczyć próby po `CF-Connecting-IP`, nie `req.ip` — za tunelem `req.ip` to adres kontenera `cloudflared`. Przed wdrożeniem na produkcję zweryfikuj na `karpacz`/`gieldowo`, że nagłówek faktycznie dociera (log `req.headers` na żywym ruchu); jeśli nie, całą grupę zablokuje jedna pomyłka.

- [ ] **Step 1: Napisz failujący test**

```js
// server/auth/gate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function appWithPassphrase(passphrase = 'oliwa-cyprys-42') {
  return buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase });
}

test('POST /api/auth/gate: poprawne hasło ustawia ciasteczko gate', async () => {
  const app = await appWithPassphrase();
  const res = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /gate=/);
  await app.close();
});

test('POST /api/auth/gate: złe hasło daje 401, bez ciasteczka', async () => {
  const app = await appWithPassphrase();
  const res = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'zle-haslo' } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['set-cookie'], undefined);
  await app.close();
});

test('POST /api/auth/gate: rate limit liczy po CF-Connecting-IP, nie po req.ip', async () => {
  const app = await appWithPassphrase();
  for (let i = 0; i < 5; i++) {
    await app.inject({
      method: 'POST', url: '/api/auth/gate',
      headers: { 'cf-connecting-ip': '1.2.3.4' },
      payload: { password: 'zle-haslo' },
    });
  }
  const sixth = await app.inject({
    method: 'POST', url: '/api/auth/gate',
    headers: { 'cf-connecting-ip': '1.2.3.4' },
    payload: { password: 'oliwa-cyprys-42' },
  });
  assert.equal(sixth.statusCode, 429);

  const otherIp = await app.inject({
    method: 'POST', url: '/api/auth/gate',
    headers: { 'cf-connecting-ip': '5.6.7.8' },
    payload: { password: 'oliwa-cyprys-42' },
  });
  assert.equal(otherIp.statusCode, 200, 'inny CF-Connecting-IP nie powinien być zablokowany');
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/auth/gate.test.js`
Expected: FAIL — trasa `/api/auth/gate` nie istnieje (404), `buildApp` nie przyjmuje `passphrase`.

- [ ] **Step 3: Zaimplementuj**

```js
// server/auth/gate.js
const GATE_COOKIE_TTL_SECONDS = 15 * 60;

function cfConnectingIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip;
}

export function registerGateRoute(app, { passphrase }) {
  app.post('/api/auth/gate', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: cfConnectingIp,
      },
    },
  }, async (req, reply) => {
    const password = req.body?.password ?? '';
    if (!passphrase || password !== passphrase) {
      reply.code(401);
      return { error: 'wrong_password' };
    }
    reply.setCookie('gate', 'ok', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      signed: true,
      maxAge: GATE_COOKIE_TTL_SECONDS,
    });
    return { ok: true };
  });
}
```

W `server/app.js` dodaj import i rejestrację (po `app.get('/healthz', ...)`), oraz przepuść `opts.passphrase`:

```js
import { registerGateRoute } from './auth/gate.js';
// ...
  registerGateRoute(app, { passphrase: opts.passphrase ?? process.env.CHAT_PASSPHRASE });
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/auth/gate.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Uruchom cały zestaw testów, żeby upewnić się, że nic się nie zepsuło**

Run: `npm test`
Expected: PASS, wszystkie testy backendu i istniejące testy frontendowe.

- [ ] **Step 6: Commit**

```bash
git add server/auth/gate.js server/auth/gate.test.js server/app.js
git commit -m "feat(auth): bramka wspólnego hasła z rate limitem po CF-Connecting-IP

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 9: Tożsamość — `GET/POST /api/auth/who`

**Files:**
- Create: `server/auth/who.js`
- Modify: `server/app.js`
- Test: `server/auth/who.test.js`

**Interfaces:**
- Consumes: `app.db` (Task 6/7), ciasteczko `gate` z Task 8.
- Produces: `registerWhoRoute(app, db): void`. `GET /api/auth/who` → `{ users: [{id, display_name}] }` (401 bez `gate`). `POST /api/auth/who` przyjmuje `{ user_id }` (istniejący) albo `{ new_name }` (nowy) → zakłada wiersz w `users` jeśli trzeba, ustawia ciasteczko `session` (90 dni), czyści `gate`. Sesja czytana w Task 10.

- [ ] **Step 1: Napisz failujący test**

```js
// server/auth/who.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function loggedGate() {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  return { app, gateCookie };
}

test('GET /api/auth/who bez ciasteczka gate daje 401 (lista imion nie wycieka)', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  const res = await app.inject({ method: 'GET', url: '/api/auth/who' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('GET /api/auth/who z ciasteczkiem gate zwraca listę użytkowników', async () => {
  const { app, gateCookie } = await loggedGate();
  app.db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Mama');
  const res = await app.inject({
    method: 'GET', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().users.map((u) => u.display_name), ['Mama']);
  await app.close();
});

test('POST /api/auth/who {new_name} zakłada wiersz i daje sesję 90 dni', async () => {
  const { app, gateCookie } = await loggedGate();
  const res = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { new_name: 'Teściowa' },
  });
  assert.equal(res.statusCode, 200);
  const sessionCookie = res.cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie);
  assert.ok(sessionCookie.maxAge >= 89 * 24 * 60 * 60);
  const row = app.db.prepare('SELECT * FROM users WHERE display_name = ?').get('Teściowa');
  assert.ok(row);
  await app.close();
});

test('POST /api/auth/who {user_id} loguje na istniejące konto bez duplikatu', async () => {
  const { app, gateCookie } = await loggedGate();
  const { lastInsertRowid: userId } = app.db.prepare('INSERT INTO users (display_name) VALUES (?)').run('Tata');
  const res = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { user_id: userId },
  });
  assert.equal(res.statusCode, 200);
  const count = app.db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  assert.equal(count, 1);
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/auth/who.test.js`
Expected: FAIL — trasa nie istnieje (404 na wszystkich).

- [ ] **Step 3: Zaimplementuj**

```js
// server/auth/who.js
import crypto from 'node:crypto';

const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;

function requireGate(req, reply) {
  const cookie = req.cookies.gate;
  if (!cookie) {
    reply.code(401).send({ error: 'gate_required' });
    return false;
  }
  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid || unsigned.value !== 'ok') {
    reply.code(401).send({ error: 'gate_required' });
    return false;
  }
  return true;
}

export function registerWhoRoute(app, db) {
  app.get('/api/auth/who', async (req, reply) => {
    if (!requireGate(req, reply)) return;
    const users = db.prepare('SELECT id, display_name FROM users ORDER BY display_name').all();
    return { users };
  });

  app.post('/api/auth/who', async (req, reply) => {
    if (!requireGate(req, reply)) return;
    const { user_id: userId, new_name: newName } = req.body ?? {};

    let user;
    if (userId != null) {
      user = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(userId);
      if (!user) {
        reply.code(400);
        return { error: 'unknown_user_id' };
      }
    } else {
      const trimmed = (newName ?? '').trim();
      if (!trimmed || trimmed.length > 50) {
        reply.code(400);
        return { error: 'invalid_new_name' };
      }
      const existing = db.prepare('SELECT id, display_name FROM users WHERE display_name = ?').get(trimmed);
      if (existing) {
        user = existing;
      } else {
        const info = db.prepare('INSERT INTO users (display_name) VALUES (?)').run(trimmed);
        user = { id: info.lastInsertRowid, display_name: trimmed };
      }
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
      .run(sessionId, user.id, expiresAt, req.headers['user-agent'] ?? null);

    reply.setCookie('session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      signed: true,
      maxAge: SESSION_TTL_SECONDS,
    });
    reply.clearCookie('gate', { path: '/' });
    return { ok: true, display_name: user.display_name };
  });
}
```

W `server/app.js`:

```js
import { registerWhoRoute } from './auth/who.js';
// ...
  registerWhoRoute(app, db);
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/auth/who.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add server/auth/who.js server/auth/who.test.js server/app.js
git commit -m "feat(auth): wybór/zakładanie tożsamości (/api/auth/who) za bramką

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 10: Weryfikacja sesji (`server/auth/session.js`)

**Files:**
- Create: `server/auth/session.js`
- Test: `server/auth/session.test.js`

**Interfaces:**
- Consumes: ciasteczko `session` z Task 9, `db` (Task 6).
- Produces: `getSessionUser(req, db): {id, displayName} | null`, `requireSession(req, reply): Promise<void>` (Fastify `preHandler` — ustawia `req.user` albo odpowiada 401). Konsumowane przez `/api/chat` (Task 14) i `/api/me` (Task 15).

- [ ] **Step 1: Napisz failujący test**

```js
// server/auth/session.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function withSession() {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({
    method: 'POST', url: '/api/auth/who',
    cookies: { gate: gateCookie.value },
    payload: { new_name: 'Mama' },
  });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');
  return { app, sessionCookie };
}

test('trasa chroniona requireSession: bez ciasteczka session daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  const { requireSession } = await import('./session.js');
  app.get('/chroniona', { preHandler: requireSession }, async (req) => ({ user: req.user }));
  const res = await app.inject({ method: 'GET', url: '/chroniona' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('trasa chroniona requireSession: z ważną sesją ustawia req.user', async () => {
  const { app, sessionCookie } = await withSession();
  const { requireSession } = await import('./session.js');
  app.get('/chroniona', { preHandler: requireSession }, async (req) => ({ user: req.user }));
  const res = await app.inject({ method: 'GET', url: '/chroniona', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.displayName, 'Mama');
  await app.close();
});

test('trasa chroniona requireSession: wygasła sesja daje 401', async () => {
  const { app, sessionCookie } = await withSession();
  app.db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'").run();
  const { requireSession } = await import('./session.js');
  app.get('/chroniona', { preHandler: requireSession }, async (req) => ({ user: req.user }));
  const res = await app.inject({ method: 'GET', url: '/chroniona', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 401);
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/auth/session.test.js`
Expected: FAIL — `./session.js` nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/auth/session.js
export function getSessionUser(req, db) {
  const cookie = req.cookies.session;
  if (!cookie) return null;
  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid) return null;
  const row = db.prepare(
    `SELECT s.user_id as userId, s.expires_at as expiresAt, u.display_name as displayName
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(unsigned.value);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return { id: row.userId, displayName: row.displayName };
}

export async function requireSession(req, reply) {
  const user = getSessionUser(req, req.server.db);
  if (!user) {
    reply.code(401).send({ error: 'session_required' });
    return;
  }
  req.user = user;
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/auth/session.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add server/auth/session.js server/auth/session.test.js
git commit -m "feat(auth): weryfikacja sesji (requireSession preHandler)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 11: Limity dzienne (`server/db/usage.js`)

**Files:**
- Create: `server/db/usage.js`
- Test: `server/db/usage.test.js`

**Interfaces:**
- Consumes: `db` (Task 6).
- Produces: `getUsageToday(db, userId)`, `recordUsage(db, userId, promptTokens, completionTokens)`, `budgetExceeded(db, userId, { perUserLimit, globalLimit }): 'user' | 'global' | null`. Konsumowane przez `/api/chat` (Task 14) przed i po wywołaniu LLM.

- [ ] **Step 1: Napisz failujący test**

```js
// server/db/usage.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './index.js';
import { getUsageToday, recordUsage, budgetExceeded } from './usage.js';

function makeUser(db, name) {
  return db.prepare('INSERT INTO users (display_name) VALUES (?)').run(name).lastInsertRowid;
}

test('getUsageToday: brak wpisów zwraca zera', () => {
  const db = openDb();
  const userId = makeUser(db, 'A');
  assert.deepEqual(getUsageToday(db, userId), { prompt_tokens: 0, completion_tokens: 0, requests: 0 });
});

test('recordUsage: kumuluje w ramach jednego dnia (ON CONFLICT)', () => {
  const db = openDb();
  const userId = makeUser(db, 'B');
  recordUsage(db, userId, 100, 50);
  recordUsage(db, userId, 30, 20);
  const usage = getUsageToday(db, userId);
  assert.equal(usage.prompt_tokens, 130);
  assert.equal(usage.completion_tokens, 70);
  assert.equal(usage.requests, 2);
});

test('budgetExceeded: null, gdy oba limity mają zapas', () => {
  const db = openDb();
  const userId = makeUser(db, 'C');
  recordUsage(db, userId, 100, 100);
  assert.equal(budgetExceeded(db, userId, { perUserLimit: 10000, globalLimit: 100000 }), null);
});

test('budgetExceeded: "user", gdy przekroczony limit per osoba', () => {
  const db = openDb();
  const userId = makeUser(db, 'D');
  recordUsage(db, userId, 6000, 5000);
  assert.equal(budgetExceeded(db, userId, { perUserLimit: 10000, globalLimit: 100000 }), 'user');
});

test('budgetExceeded: "global", gdy suma wszystkich użytkowników przekracza sufit globalny', () => {
  const db = openDb();
  const u1 = makeUser(db, 'E1');
  const u2 = makeUser(db, 'E2');
  recordUsage(db, u1, 6000, 0);
  recordUsage(db, u2, 6000, 0);
  assert.equal(budgetExceeded(db, u2, { perUserLimit: 10000, globalLimit: 10000 }), 'global');
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/db/usage.test.js`
Expected: FAIL — `./usage.js` nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/db/usage.js
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getUsageToday(db, userId) {
  const row = db.prepare(
    'SELECT prompt_tokens, completion_tokens, requests FROM usage WHERE user_id = ? AND day = ?'
  ).get(userId, today());
  return row ?? { prompt_tokens: 0, completion_tokens: 0, requests: 0 };
}

export function getGlobalUsageToday(db) {
  const row = db.prepare(
    'SELECT COALESCE(SUM(prompt_tokens), 0) as pt, COALESCE(SUM(completion_tokens), 0) as ct FROM usage WHERE day = ?'
  ).get(today());
  return { prompt_tokens: row.pt, completion_tokens: row.ct };
}

export function recordUsage(db, userId, promptTokens, completionTokens) {
  db.prepare(
    `INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET
       prompt_tokens = prompt_tokens + excluded.prompt_tokens,
       completion_tokens = completion_tokens + excluded.completion_tokens,
       requests = requests + 1`
  ).run(userId, today(), promptTokens, completionTokens);
}

export function budgetExceeded(db, userId, { perUserLimit, globalLimit }) {
  const user = getUsageToday(db, userId);
  if (user.prompt_tokens + user.completion_tokens >= perUserLimit) return 'user';
  const global = getGlobalUsageToday(db);
  if (global.prompt_tokens + global.completion_tokens >= globalLimit) return 'global';
  return null;
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/db/usage.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add server/db/usage.js server/db/usage.test.js
git commit -m "feat(db): limity dzienne per użytkownik + globalny sufit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 12: Klient LiteLLM + pętla czatu (`server/chat/llmClient.js`, `server/chat/loop.js`)

**Files:**
- Create: `server/chat/llmClient.js`, `server/chat/loop.js`
- Test: `server/chat/llmClient.test.js`, `server/chat/loop.test.js`

**Interfaces:**
- Consumes: `buildToolRegistry` (Task 5), `fetch` (globalny, mockowany w testach przez podmianę `globalThis.fetch`).
- Produces: `createLlmClient({ baseUrl, apiKey, model, fallbackModel }): { chat(messages, tools): Promise<OpenAIResponse> }`. `runChatLoop({ llmClient, toolRegistry, systemPrompt, history, userMessage }): Promise<{ content: string, usage: {prompt_tokens, completion_tokens}, messages: object[] }>`. Konsumowane przez `/api/chat` (Task 14).

- [ ] **Step 1: Napisz failujące testy klienta LLM**

```js
// server/chat/llmClient.test.js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createLlmClient } from './llmClient.js';

test('createLlmClient: woła model główny, zwraca JSON odpowiedzi', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
  }));
  const client = createLlmClient({ baseUrl: 'http://litellm:4000/v1', apiKey: 'k', model: 'deepseek-v4-flash' });
  const res = await client.chat([{ role: 'user', content: 'hej' }], []);
  assert.equal(res.choices[0].message.content, 'ok');
  assert.match(fetchMock.mock.calls[0].arguments[0], /\/chat\/completions$/);
  mock.restoreAll();
});

test('createLlmClient: przy błędzie modelu głównego próbuje fallback', async () => {
  let call = 0;
  mock.method(globalThis, 'fetch', async (url, opts) => {
    call += 1;
    const body = JSON.parse(opts.body);
    if (call === 1) {
      assert.equal(body.model, 'deepseek-v4-flash');
      return { ok: false, status: 429 };
    }
    assert.equal(body.model, 'deepseek-v4-pro-free');
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'fallback ok' } }], usage: {} }) };
  });
  const client = createLlmClient({ baseUrl: 'http://litellm:4000/v1', apiKey: 'k', model: 'deepseek-v4-flash', fallbackModel: 'deepseek-v4-pro-free' });
  const res = await client.chat([{ role: 'user', content: 'hej' }], []);
  assert.equal(res.choices[0].message.content, 'fallback ok');
  assert.equal(call, 2);
  mock.restoreAll();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/chat/llmClient.test.js`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 3: Zaimplementuj klienta LLM**

```js
// server/chat/llmClient.js
const CALL_TIMEOUT_MS = 15000;

async function callOnce({ baseUrl, apiKey, model, messages, tools, signal }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
    signal,
  });
  if (!res.ok) throw new Error(`llm_http_${res.status}`);
  return res.json();
}

export function createLlmClient({ baseUrl, apiKey, model, fallbackModel }) {
  return {
    async chat(messages, tools) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
      try {
        try {
          return await callOnce({ baseUrl, apiKey, model, messages, tools, signal: controller.signal });
        } catch (err) {
          if (!fallbackModel) throw err;
          return await callOnce({ baseUrl, apiKey, model: fallbackModel, messages, tools, signal: controller.signal });
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

- [ ] **Step 4: Uruchom ponownie testy klienta**

Run: `node --test server/chat/llmClient.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Napisz failujące testy pętli czatu**

```js
// server/chat/loop.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChatLoop } from './loop.js';

function fakeToolRegistry() {
  return {
    getDay: {
      description: 'test',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: () => ({ day_num: 8, title: 'Chianti' }),
    },
  };
}

test('runChatLoop: bez tool_calls zwraca treść od razu', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Cześć!' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } }) };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Cześć!');
  assert.deepEqual(result.usage, { prompt_tokens: 5, completion_tokens: 3 });
});

test('runChatLoop: wykonuje tool_call i wraca do modelu z wynikiem', async () => {
  let call = 0;
  const llmClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{}' } }] } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.equal(JSON.parse(toolMsg.content).title, 'Chianti');
      return { choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 20, completion_tokens: 8 } };
    },
  };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'co 19.09?',
  });
  assert.equal(result.content, 'Dzień 8 to Chianti.');
  assert.equal(result.usage.prompt_tokens, 30);
  assert.equal(call, 2);
});

test('runChatLoop: po 5 iteracjach bez odpowiedzi końcowej rzuca chat_loop_max_iterations', async () => {
  const llmClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't', function: { name: 'getDay', arguments: '{}' } }] } }],
      usage: {},
    }),
  };
  await assert.rejects(
    runChatLoop({ llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'x' }),
    /chat_loop_max_iterations/
  );
});

test('runChatLoop: nieznane narzędzie nie wywala pętli, wraca error do modelu', async () => {
  let call = 0;
  const llmClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'nieznane', arguments: '{}' } }] } }],
          usage: {},
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.deepEqual(JSON.parse(toolMsg.content), { error: 'unknown_tool' });
      return { choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: {} };
    },
  };
  const result = await runChatLoop({
    llmClient, toolRegistry: fakeToolRegistry(), systemPrompt: 'sys', history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
});
```

- [ ] **Step 6: Uruchom i sprawdź, że pada**

Run: `node --test server/chat/loop.test.js`
Expected: FAIL — `./loop.js` nie istnieje.

- [ ] **Step 7: Zaimplementuj pętlę**

```js
// server/chat/loop.js
const MAX_TOOL_ITERATIONS = 5;
const TOTAL_TIMEOUT_MS = 30000;

export async function runChatLoop({ llmClient, toolRegistry, systemPrompt, history, userMessage }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];
  const toolDefs = Object.entries(toolRegistry).map(([name, tool]) => ({
    type: 'function',
    function: { name, description: tool.description, parameters: tool.parameters },
  }));

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const usage = { prompt_tokens: 0, completion_tokens: 0 };

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (Date.now() > deadline) throw new Error('chat_loop_timeout');

    const response = await llmClient.chat(messages, toolDefs);
    const choice = response.choices[0];
    if (response.usage) {
      usage.prompt_tokens += response.usage.prompt_tokens ?? 0;
      usage.completion_tokens += response.usage.completion_tokens ?? 0;
    }
    const msg = choice.message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { content: msg.content, usage, messages };
    }

    for (const call of msg.tool_calls) {
      const tool = toolRegistry[call.function.name];
      const result = tool
        ? await tool.execute(JSON.parse(call.function.arguments || '{}'))
        : { error: 'unknown_tool' };
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('chat_loop_max_iterations');
}
```

- [ ] **Step 8: Uruchom ponownie**

Run: `node --test server/chat/loop.test.js`
Expected: PASS, 4/4.

- [ ] **Step 9: Commit**

```bash
git add server/chat/llmClient.js server/chat/llmClient.test.js server/chat/loop.js server/chat/loop.test.js
git commit -m "feat(chat): klient LiteLLM z fallbackiem + pętla function-calling (max 5 iteracji, timeout 30s/15s)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 13: Prompt systemowy (`server/chat/systemPrompt.js`)

**Files:**
- Create: `server/chat/systemPrompt.js`
- Test: `server/chat/systemPrompt.test.js`

**Interfaces:**
- Consumes: `trip` (dla `listDays()` — spis treści ~2 KB, §8 punkt 3), `toolRegistry.listDays` (Task 5).
- Produces: `buildSystemPrompt({ trip, toolRegistry }): string`. Konsumowane przez `/api/chat` (Task 14).

- [ ] **Step 1: Napisz failujący test**

```js
// server/chat/systemPrompt.test.js
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
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/chat/systemPrompt.test.js`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/chat/systemPrompt.js
export function buildSystemPrompt({ trip, toolRegistry }) {
  const days = toolRegistry.listDays.execute();
  const toc = days.map((d) => `${d.day_num}. ${d.date} — ${d.title}`).join('\n');
  return `Jesteś asystentem grupy jadącej na wycieczkę do Toskanii (${trip.meta.start_date} – wyjazd).
Odpowiadasz WYŁĄCZNIE na podstawie danych z narzędzi (getDay, searchPlan, route, openingHours, costs, todo, packing).
Jeśli narzędzie zwróci null albo pustą listę, powiedz wprost że nie masz tej informacji — nigdy nie zgaduj godzin otwarcia ani cen.
Spis dni:
${toc}`;
}
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/chat/systemPrompt.test.js`
Expected: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
git add server/chat/systemPrompt.js server/chat/systemPrompt.test.js
git commit -m "feat(chat): prompt systemowy ze spisem dni i regułą anty-halucynacyjną

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 14: `POST /api/chat` (SSE) — spina auth, limity, pętlę, zapis do bazy

**Files:**
- Create: `server/routes/chat.js`
- Modify: `server/app.js`
- Test: `server/routes/chat.test.js`

**Interfaces:**
- Consumes: `requireSession` (Task 10), `budgetExceeded`/`recordUsage` (Task 11), `runChatLoop` (Task 12), `buildSystemPrompt` (Task 13), `db` (Task 6).
- Produces: `registerChatRoute(app, db, { toolRegistry, llmClient, systemPrompt, budgets: {perUserLimit, globalLimit} }): void`. Rate limit `10 żądań/min/sesję` (§9). Zapisuje user+assistant do `messages`, dopisuje `usage`.

- [ ] **Step 1: Napisz failujący test**

```js
// server/routes/chat.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { registerChatRoute } from './chat.js';

function fakeToolRegistry() {
  return { listDays: { description: '', parameters: { type: 'object', properties: {} }, execute: () => [] } };
}

async function loggedInApp({ toolRegistry = fakeToolRegistry(), llmClient, budgets = { perUserLimit: 100000, globalLimit: 1000000 } } = {}) {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  registerChatRoute(app, app.db, { toolRegistry, llmClient, systemPrompt: 'sys', budgets });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({ method: 'POST', url: '/api/auth/who', cookies: { gate: gateCookie.value }, payload: { new_name: 'Mama' } });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');
  return { app, sessionCookie };
}

test('POST /api/chat bez sesji daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  registerChatRoute(app, app.db, { toolRegistry: fakeToolRegistry(), llmClient: { chat: async () => ({ choices: [{ message: { content: 'x' } }], usage: {} }) }, systemPrompt: 'sys', budgets: { perUserLimit: 1, globalLimit: 1 } });
  const res = await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'hej' } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('POST /api/chat z sesją zwraca odpowiedź modelu i zapisuje ją do messages + usage', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  const { app, sessionCookie } = await loggedInApp({ llmClient });
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'co 19.09?' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Chianti/);
  const msgCount = app.db.prepare("SELECT COUNT(*) as n FROM messages WHERE role = 'assistant'").get().n;
  assert.equal(msgCount, 1);
  const usage = app.db.prepare('SELECT prompt_tokens, completion_tokens FROM usage').get();
  assert.deepEqual(usage, { prompt_tokens: 10, completion_tokens: 5 });
  await app.close();
});

test('POST /api/chat: przekroczony budżet per osoba daje 429, plan strony nie jest dotknięty', async () => {
  const llmClient = { chat: async () => ({ choices: [{ message: { content: 'x' } }], usage: {} }) };
  const { app, sessionCookie } = await loggedInApp({ llmClient, budgets: { perUserLimit: 1, globalLimit: 1000000 } });
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'hej' } });
  assert.equal(res.statusCode, 429);
  const healthz = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(healthz.statusCode, 200);
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/routes/chat.test.js`
Expected: FAIL — `./chat.js` nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/routes/chat.js
import { requireSession } from '../auth/session.js';
import { budgetExceeded, recordUsage } from '../db/usage.js';
import { runChatLoop } from '../chat/loop.js';

export function registerChatRoute(app, db, { toolRegistry, llmClient, systemPrompt, budgets }) {
  app.post('/api/chat', {
    preHandler: requireSession,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => `session:${req.cookies.session}`,
      },
    },
  }, async (req, reply) => {
    const exceeded = budgetExceeded(db, req.user.id, budgets);
    if (exceeded) {
      reply.code(429);
      return { error: `budget_exceeded_${exceeded}` };
    }

    const conversationId = req.body?.conversation_id ?? 'default';
    const userMessage = req.body?.message ?? '';

    db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
      .run(req.user.id, conversationId, userMessage);

    try {
      const result = await runChatLoop({
        llmClient, toolRegistry, systemPrompt,
        history: req.body?.history ?? [],
        userMessage,
      });
      recordUsage(db, req.user.id, result.usage.prompt_tokens, result.usage.completion_tokens);
      db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
        .run(req.user.id, conversationId, result.content);
      return { content: result.content };
    } catch (err) {
      reply.code(502);
      return { error: 'assistant_unavailable', detail: err.message };
    }
  });
}
```

Wersja SSE (strumieniowanie tokenów, §8 punkt 6) jest rozszerzeniem tego handlera i wymaga strumieniującego trybu odpowiedzi z LiteLLM (`stream: true`) — poza tym taskiem ze względu na rozmiar; MVP zwraca pełną odpowiedź jednym JSON-em, co spełnia kryterium akceptacji 3 (§15) i wszystkie testy auth (§12). Zostaw TODO w kodzie jako komentarz, nie jako brakującą funkcjonalność:

```js
// TODO(plaster 3+): zamienić na SSE (stream: true w LiteLLM, reply.raw.write per token) — patrz spec §8 punkt 6.
```

Dodaj tę linię komentarza bezpośrednio nad handlerem w `server/routes/chat.js`.

W `server/app.js` dodaj rejestrację (wymaga przekazania `toolRegistry`, `llmClient`, `systemPrompt`, `budgets` przez `opts`):

```js
import { registerChatRoute } from './routes/chat.js';
// ...
  if (opts.toolRegistry && opts.llmClient) {
    registerChatRoute(app, db, {
      toolRegistry: opts.toolRegistry,
      llmClient: opts.llmClient,
      systemPrompt: opts.systemPrompt,
      budgets: opts.budgets ?? {
        perUserLimit: Number(process.env.DAILY_TOKEN_BUDGET_PER_USER ?? 50000),
        globalLimit: Number(process.env.DAILY_TOKEN_BUDGET_GLOBAL ?? 200000),
      },
    });
  }
```

(Warunek `if (opts.toolRegistry && opts.llmClient)` pozwala testom z Task 7-11, które nie przekazują tych opcji, działać bez zmian — `/api/chat` po prostu nie jest rejestrowane, gdy zależności nie są podane. `server/index.js` zostanie rozszerzony o realne `toolRegistry`/`llmClient` w Tasku 20.)

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/routes/chat.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Uruchom cały zestaw testów backendu**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/chat.js server/routes/chat.test.js server/app.js
git commit -m "feat(chat): POST /api/chat — sesja, limity, pętla, zapis do messages/usage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 15: `GET /api/me`

**Files:**
- Create: `server/routes/me.js`
- Modify: `server/app.js`
- Test: `server/routes/me.test.js`

**Interfaces:**
- Consumes: `requireSession` (Task 10), `getUsageToday` (Task 11).
- Produces: `registerMeRoute(app, db): void`. `GET /api/me` → `{ display_name, usage: {prompt_tokens, completion_tokens, requests} }`.

- [ ] **Step 1: Napisz failujący test**

```js
// server/routes/me.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { registerMeRoute } from './me.js';

test('GET /api/me bez sesji daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  registerMeRoute(app, app.db);
  const res = await app.inject({ method: 'GET', url: '/api/me' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('GET /api/me z sesją zwraca display_name i stan limitu', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  registerMeRoute(app, app.db);
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({ method: 'POST', url: '/api/auth/who', cookies: { gate: gateCookie.value }, payload: { new_name: 'Mama' } });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');

  const res = await app.inject({ method: 'GET', url: '/api/me', cookies: { session: sessionCookie.value } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { display_name: 'Mama', usage: { prompt_tokens: 0, completion_tokens: 0, requests: 0 } });
  await app.close();
});
```

- [ ] **Step 2: Uruchom i sprawdź, że pada**

Run: `node --test server/routes/me.test.js`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 3: Zaimplementuj**

```js
// server/routes/me.js
import { requireSession } from '../auth/session.js';
import { getUsageToday } from '../db/usage.js';

export function registerMeRoute(app, db) {
  app.get('/api/me', { preHandler: requireSession }, async (req) => {
    const usage = getUsageToday(db, req.user.id);
    return { display_name: req.user.displayName, usage };
  });
}
```

W `server/app.js`:

```js
import { registerMeRoute } from './routes/me.js';
// ...
  registerMeRoute(app, db);
```

- [ ] **Step 4: Uruchom ponownie**

Run: `node --test server/routes/me.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add server/routes/me.js server/routes/me.test.js server/app.js
git commit -m "feat: GET /api/me — profil i stan limitu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 16: e2e — 10 pytań kontrolnych (poza rutynowym CI)

**Files:**
- Create: `server/chat/loop.e2e.test.js`

**Interfaces:**
- Consumes: `runChatLoop` (Task 12), `createLlmClient` (Task 12) skonfigurowany na żywy LiteLLM (`LITELLM_BASE_URL`/`LITELLM_API_KEY` z env), `buildToolRegistry` (Task 5) na prawdziwym `trip.json` + `src/distance-matrix.json`.
- Produces: nic konsumowane dalej — to test końcowy, wzorem `@pytest.mark.e2e` w `gieldowo`. Uruchamiany osobną komendą (`npm run test:e2e`, Task 1), nie wchodzi w `npm test`.

- [ ] **Step 1: Napisz plik testowy z 10 pytaniami kontrolnymi z trip.json (dane realne, nie fixture)**

```js
// server/chat/loop.e2e.test.js
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
```

- [ ] **Step 2: Uruchom (wymaga żywego środowiska LiteLLM — nie uruchamiaj w rutynowym CI)**

Run: `LITELLM_BASE_URL=... LITELLM_API_KEY=... CHAT_MODEL=... npm run test:e2e`
Expected: PASS, 10/10 (albo świadoma analiza konkretnego niepowodzenia — to test jakości odpowiedzi LLM, nie samego kodu).

- [ ] **Step 3: Commit**

```bash
git add server/chat/loop.e2e.test.js
git commit -m "test(e2e): 10 pytań kontrolnych do żywego LLM (poza rutynowym CI)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

## Plaster 3: Frontend + cutover

Cel plastra: uczestnicy realnie korzystają (§14 wiersz 3).

### Task 17: Widget czatu (`src/chat-widget.js`)

**Files:**
- Create: `src/chat-widget.js`, `src/styles/chat.css`
- Test: brak automatycznego testu (kod DOM bez frameworka testowego w repo — zgodnie z istniejącym wzorcem, `src/site.js` też nie ma testów jednostkowych; weryfikacja wizualna w Task 18).

**Interfaces:**
- Consumes: `esc` z `src/html.js` (jedyne escapowanie w projekcie, per `CLAUDE.md`).
- Produces: `mountChatWidget(): void` — montuje widget raz (idempotentnie), obsługuje przepływ bramka → wybór imienia → czat. Konsumowane przez `initChrome()` w `src/site.js` (Task 18).

- [ ] **Step 1: Przeczytaj `src/html.js`, żeby użyć istniejącego `esc()` zamiast pisać własne escapowanie**

Run: `cat src/html.js`

- [ ] **Step 2: Napisz widget**

```js
// src/chat-widget.js
import { esc } from './html.js';

export function mountChatWidget() {
  if (document.getElementById('chat-widget')) return;
  const el = document.createElement('div');
  el.id = 'chat-widget';
  el.innerHTML = `
    <button id="chat-toggle" aria-label="Otwórz czat" aria-expanded="false">💬</button>
    <div id="chat-panel" hidden>
      <div id="chat-gate">
        <label for="chat-password">Hasło grupy</label>
        <input id="chat-password" type="password" autocomplete="off" />
        <button id="chat-gate-submit" type="button">Dalej</button>
        <p id="chat-gate-error" hidden>Złe hasło, spróbuj ponownie.</p>
      </div>
      <div id="chat-who" hidden>
        <label for="chat-name-select">To Ty?</label>
        <select id="chat-name-select"></select>
        <button id="chat-who-existing" type="button">To ja</button>
        <label for="chat-name-new">Albo wpisz swoje imię</label>
        <input id="chat-name-new" type="text" />
        <button id="chat-who-new" type="button">Wejdź</button>
      </div>
      <div id="chat-messages" hidden role="log" aria-live="polite"></div>
      <form id="chat-form" hidden>
        <input id="chat-input" type="text" placeholder="Zapytaj o plan..." autocomplete="off" />
        <button type="submit">Wyślij</button>
      </form>
    </div>
  `;
  document.body.appendChild(el);
  wireToggle(el);
  wireGate(el);
  wireWho(el);
  wireForm(el);
}

function wireToggle(root) {
  const toggle = root.querySelector('#chat-toggle');
  const panel = root.querySelector('#chat-panel');
  toggle.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });
}

function wireGate(root) {
  root.querySelector('#chat-gate-submit').addEventListener('click', async () => {
    const password = root.querySelector('#chat-password').value;
    const res = await fetch('/api/auth/gate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const errorEl = root.querySelector('#chat-gate-error');
    if (!res.ok) {
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    await showWho(root);
  });
}

async function showWho(root) {
  root.querySelector('#chat-gate').hidden = true;
  const who = root.querySelector('#chat-who');
  who.hidden = false;
  const res = await fetch('/api/auth/who');
  const { users } = await res.json();
  const select = root.querySelector('#chat-name-select');
  select.innerHTML = users.map((u) => `<option value="${esc(String(u.id))}">${esc(u.display_name)}</option>`).join('');
}

function wireWho(root) {
  root.querySelector('#chat-who-existing').addEventListener('click', async () => {
    const select = root.querySelector('#chat-name-select');
    if (!select.value) return;
    await submitWho(root, { user_id: Number(select.value) });
  });
  root.querySelector('#chat-who-new').addEventListener('click', async () => {
    const newName = root.querySelector('#chat-name-new').value.trim();
    if (!newName) return;
    await submitWho(root, { new_name: newName });
  });
}

async function submitWho(root, payload) {
  const res = await fetch('/api/auth/who', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return;
  root.querySelector('#chat-who').hidden = true;
  root.querySelector('#chat-messages').hidden = false;
  root.querySelector('#chat-form').hidden = false;
}

function appendMessage(root, role, text) {
  const messages = root.querySelector('#chat-messages');
  const p = document.createElement('p');
  p.className = `chat-msg chat-msg--${role}`;
  p.innerHTML = `<strong>${role === 'user' ? 'Ty' : 'Asystent'}:</strong> ${esc(text)}`;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

function wireForm(root) {
  const form = root.querySelector('#chat-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    appendMessage(root, 'user', message);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (res.status === 429) {
      appendMessage(root, 'assistant', 'Wykorzystano dzienny limit — spróbuj jutro.');
      return;
    }
    if (!res.ok) {
      appendMessage(root, 'assistant', 'Asystent niedostępny, plan działa normalnie.');
      return;
    }
    const { content } = await res.json();
    appendMessage(root, 'assistant', content);
  });
}
```

```css
/* src/styles/chat.css */
#chat-widget {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 100;
}

#chat-toggle {
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

#chat-panel {
  position: absolute;
  right: 0;
  bottom: 3.75rem;
  width: min(20rem, 90vw);
  max-height: 70vh;
  overflow-y: auto;
  background: var(--surface, #fff);
  color: var(--text, #111);
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

#chat-messages {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 20rem;
  overflow-y: auto;
  margin-bottom: 0.5rem;
}

#chat-form {
  display: flex;
  gap: 0.5rem;
}
```

- [ ] **Step 3: Sprawdź ręcznie w przeglądarce, że plik się nie wysypuje przy imporcie**

Run: `npm run dev` (w innym terminalu, potem Ctrl+C), i sprawdź w konsoli buildu `vite`, że brak błędów składni.
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/chat-widget.js src/styles/chat.css
git commit -m "feat(frontend): widget czatu — bramka, wybór imienia, wiadomości

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 18: Wpięcie widgetu do `initChrome()` we wszystkich 7 wejściach

**Files:**
- Modify: `src/site.js`

**Interfaces:**
- Consumes: `mountChatWidget` (Task 17).
- Produces: `initChrome()` (istniejąca funkcja) leniwie ładuje i montuje widget — bez zmiany sygnatury, żaden z 7 entry pointów (`main`, `short`, `mapa`, `galeria`, `praktyczne`, `packing`, `pamiatki`) nie wymaga osobnej zmiany.

- [ ] **Step 1: Przeczytaj obecną definicję `initChrome` w `src/site.js`**

Run: `grep -n "export function initChrome" -A 15 src/site.js`

- [ ] **Step 2: Dodaj leniwy import widgetu na końcu `initChrome`**

Dodaj na górze pliku `src/site.js` (obok innych importów, jeśli plik już importuje coś z `./styles/`):

```js
import './styles/chat.css';
```

Wewnątrz `initChrome`, na końcu ciała funkcji (po istniejącej logice reveal/nav/footer), dodaj:

```js
  import('./chat-widget.js').then(({ mountChatWidget }) => mountChatWidget());
```

Dynamiczny `import()` (nie statyczny) trzyma widget w osobnym chunku Vite — strony, które nie ładują `initChrome` (żadna dziś go pomija, ale to izoluje ryzyko), nie płacą za kod czatu.

- [ ] **Step 3: Sprawdź wizualnie na jednej stronie**

Run: `npm run dev`, otwórz `http://localhost:5173/` w przeglądarce.
Expected: w prawym dolnym rogu pojawia się przycisk 💬; kliknięcie otwiera panel z polem hasła.

- [ ] **Step 4: Uruchom istniejący zestaw testów, żeby upewnić się, że nic się nie zepsuło**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/site.js
git commit -m "feat(frontend): montuj widget czatu przez initChrome() na wszystkich stronach

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 19: Cutover `base: '/toskania/'` → `'/'`

**Files:**
- Modify: `vite.config.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: brak (konfiguracja).
- Produces: build Vite generuje ścieżki zasobów pod `/` zamiast `/toskania/` — wymagane, żeby `dist/` dało się serwować z korzenia `toskania.hybiak.eu` (§10, ostatni akapit).

**Uwaga z §10:** ten krok wykonuj **dopiero po zielonym cutoverze** na VPS (Task 22), w osobnym commicie od wyłączenia Pages — dopóki oba hostingi działają równolegle w trakcie wdrożenia, `base: '/'` zepsułby jeszcze działający Pages pod `/toskania/`. W kolejności wykonania tego planu wykonaj ten task **na końcu**, po Tasku 22, mimo że jest wypisany tutaj dla kompletności frontendowej.

- [ ] **Step 1: Przeczytaj obecny `vite.config.js`**

Run: `cat vite.config.js`

- [ ] **Step 2: Zmień `base`**

W `vite.config.js` zmień:

```js
base: '/toskania/',
```

na:

```js
base: '/',
```

- [ ] **Step 3: Sprawdź preload hero w `index.html` — `imagesizes` musi nadal zgadzać się z `trip.config.js`.**

Run: `grep -n "preload" index.html`
Expected: atrybut `href` w preloadzie jest generowany względnie (nie zawiera literału `/toskania/`) — jeśli zawiera, zamień na wersję bez prefiksu, bo Vite doda `base` automatycznie tylko do zasobów przetwarzanych przez bundler, nie do ręcznych `<link>` w `index.html` niebędących częścią grafu modułów. Sprawdź faktyczną zawartość przed edycją — nie zgaduj brzmienia.

- [ ] **Step 4: Zbuduj i sprawdź wygenerowane ścieżki**

Run: `npm run build && grep -o '"/[^"]*\.js"' dist/index.html | head -5`
Expected: ścieżki zaczynają się od `/assets/...`, nie `/toskania/assets/...`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js index.html
git commit -m "feat: cutover base '/toskania/' -> '/' (hosting na toskania.hybiak.eu)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 20: Dockerfile + serwowanie `dist/` przez Fastify

**Files:**
- Create: `Dockerfile`, `.dockerignore`
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `buildApp` (Task 7), `buildToolRegistry` (Task 5), `createLlmClient` (Task 12), `buildSystemPrompt` (Task 13), `trip.json`, `src/distance-matrix.json` (oba skopiowane do obrazu).
- Produces: obraz kontenera, na porcie `3000`, serwujący `/` z `dist/` i `/api/*` — gotowy pod `docker build`/`docker run` z Taska 21.

- [ ] **Step 1: Rozszerz `server/index.js`, żeby budował realny `toolRegistry`/`llmClient` z `trip.json` i env**

```js
// server/index.js
import trip from '../trip.json' with { type: 'json' };
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
import { buildApp } from './app.js';
import { buildToolRegistry } from './tools/index.js';
import { buildSystemPrompt } from './chat/systemPrompt.js';
import { createLlmClient } from './chat/llmClient.js';

const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
const systemPrompt = buildSystemPrompt({ trip, toolRegistry });
const llmClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_FALLBACK,
});

const app = await buildApp({
  logger: true,
  dbPath: process.env.DB_PATH ?? '/data/toskania.db',
  staticRoot: new URL('../dist', import.meta.url).pathname,
  toolRegistry,
  llmClient,
  systemPrompt,
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
```

- [ ] **Step 2: Napisz `Dockerfile` (multi-stage, `node:22-alpine` per spec §10)**

```dockerfile
# Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY trip.json trip.config.js ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/distance-matrix.json ./src/distance-matrix.json
EXPOSE 3000
CMD ["node", "server/index.js"]
```

- [ ] **Step 3: Napisz `.dockerignore`**

```
node_modules
dist
.git
docs
notes
*.md
*.test.js
```

- [ ] **Step 4: Zbuduj obraz lokalnie**

Run: `docker build -t toskania:local .`
Expected: build kończy się sukcesem (uwaga: `better-sqlite3` kompiluje się natywnie — obraz `node:22-alpine` potrzebuje `python3 make g++`; jeśli build padnie na etapie `npm ci` dla `better-sqlite3`, dopisz `RUN apk add --no-cache python3 make g++` przed `RUN npm ci` w stage'u `build`).

- [ ] **Step 5: Uruchom obraz lokalnie i sprawdź `/healthz`**

Run:
```bash
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET=lokalny-test-sekret-min-32-znaki \
  -e CHAT_PASSPHRASE=oliwa-cyprys-42 \
  -e LITELLM_BASE_URL=http://localhost:4000/v1 \
  -e LITELLM_API_KEY=dummy \
  -e CHAT_MODEL=dummy \
  toskania:local &
sleep 2
curl -s http://localhost:3000/healthz
```
Expected: `{"ok":true}`. Zatrzymaj kontener: `docker stop $(docker ps -q --filter ancestor=toskania:local)`.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore server/index.js
git commit -m "feat: Dockerfile (node:22-alpine) + serwowanie dist/ przez Fastify

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

---

### Task 21: CI repo `toskania` — build & push obrazu do GHCR + wyzwolenie deployu `infra`

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `Dockerfile` (Task 20), sekret repo `INFRA_DEPLOY_PAT` (do założenia ręcznie w ustawieniach GitHub repo `toskania` — PAT z uprawnieniem `workflow` do repo `infra`, poza zakresem automatyzacji tego planu).
- Produces: obraz `ghcr.io/majsterkovic/toskania:latest` + `:sha-<commit>`; wywołanie `gh workflow run deploy.yml --repo majsterkovic/infra` po zbudowaniu (§10 punkt 3 — świadome ulepszenie względem `karpacz`).

- [ ] **Step 1: Przeczytaj obecny workflow**

Run: `cat .github/workflows/deploy.yml`

- [ ] **Step 2: Dopisz drugi job `image` obok istniejącego joba Pages (nie zastępuj go — §10 punkt 4: Pages wyłączamy dopiero po zielonym cutoverze, osobnym commitem)**

Dopisz na końcu pliku `.github/workflows/deploy.yml`, zachowując istniejący job Pages bez zmian:

```yaml
  image:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/majsterkovic/toskania:latest
            ghcr.io/majsterkovic/toskania:sha-${{ github.sha }}
      - name: Trigger infra deploy
        env:
          GH_TOKEN: ${{ secrets.INFRA_DEPLOY_PAT }}
        run: gh workflow run deploy.yml --repo majsterkovic/infra
```

- [ ] **Step 3: Sprawdź składnię YAML lokalnie**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"`
Expected: brak błędu (wymaga `pyyaml` — jeśli brak, `pip install --user pyyaml` albo pomiń krok i zweryfikuj wizualnie wcięcia).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): build & push obrazu do GHCR + wyzwolenie deployu infra

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

- [ ] **Step 5: Ręczny krok poza gitem — do wykonania przed pierwszym pushem tego commita**

W ustawieniach repo `majsterkovic/toskania` na GitHub: `Settings → Secrets and variables → Actions → New repository secret`, nazwa `INFRA_DEPLOY_PAT`, wartość: PAT z uprawnieniem uruchamiania workflow (`workflow` scope, albo fine-grained z `Actions: write`) na repo `majsterkovic/infra`. Bez tego kroku job `image` przejdzie build & push, ale krok „Trigger infra deploy" padnie z 403 — to oczekiwane i nieblokujące dla samego obrazu.

---

### Task 22: Repo `infra` — serwis `toskania`, sekrety, ingress, deploy.yml

**Files (w repo `/home/mariusz/Desktop/infra`, osobnym od `toskania`):**
- Modify: `infra/docker-compose.yml`
- Create: `infra/secrets.toskania.enc.yaml` (SOPS, zaszyfrowany)
- Modify: `infra/cloudflared/config.yml` (albo odpowiedni plik configu tunelu — zweryfikuj dokładną nazwę pliku w repo przed edycją, nie zakładaj)
- Modify: `infra/.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: obraz `ghcr.io/majsterkovic/toskania:latest` (Task 21), wzorzec `karpacz` (bez bind mountu configu, więc wystarczy dopisanie do listy `pull`, bez `--force-recreate`).
- Produces: działający kontener `toskania` w sieci `edge`, osiągalny pod `toskania.hybiak.eu`.

- [ ] **Step 1: Przejdź do repo `infra` i sprawdź aktualny stan**

Run: `cd /home/mariusz/Desktop/infra && git status && git log --oneline -3`
Expected: czyste drzewo robocze (jeśli nie — zatrzymaj się i zapytaj, zanim cokolwiek zmienisz w cudzym, niedokończonym stanie).

- [ ] **Step 2: Dopisz serwis `toskania` do `docker-compose.yml`, tuż obok bloku `karpacz`**

W `infra/docker-compose.yml`, po istniejącym bloku `karpacz:` (ten sam wzorzec — brak bind mountu configu, więc trafia tylko do listy `pull`, nie do listy `--force-recreate`):

```yaml
  toskania:
    image: ghcr.io/majsterkovic/toskania:latest
    container_name: toskania
    restart: unless-stopped
    mem_limit: 256m
    environment:
      - CHAT_MODEL=${TOSKANIA_CHAT_MODEL}
      - CHAT_MODEL_FALLBACK=${TOSKANIA_CHAT_MODEL_FALLBACK}
      - LITELLM_BASE_URL=http://litellm:4000/v1
      - LITELLM_API_KEY=${TOSKANIA_LITELLM_KEY}
      - SESSION_SECRET=${TOSKANIA_SESSION_SECRET}
      - CHAT_PASSPHRASE=${TOSKANIA_CHAT_PASSPHRASE}
      - DAILY_TOKEN_BUDGET_PER_USER=${TOSKANIA_BUDGET_PER_USER}
      - DAILY_TOKEN_BUDGET_GLOBAL=${TOSKANIA_BUDGET_GLOBAL}
    volumes:
      - /home/docker-deploy/toskania-data:/data
    networks:
      - edge
```

- [ ] **Step 3: Utwórz `secrets.toskania.enc.yaml` przez SOPS (wzorem `secrets.llm.enc.yaml`/`secrets.agent.enc.yaml` — sprawdź dokładną komendę i klucz szyfrujący używany w tamtych plikach przed powtórzeniem)**

Run: `sops --version` (potwierdź, że SOPS jest dostępny), potem sprawdź istniejący wzorzec:
Run: `head -5 secrets.llm.enc.yaml`
Expected: nagłówek SOPS z metadanymi szyfrowania (klucz age/PGP) — użyj tego samego mechanizmu.

Utwórz plaintext tymczasowo, zaszyfruj, usuń plaintext:

```bash
cat > /tmp/secrets.toskania.plain.yaml <<'YAML'
TOSKANIA_LITELLM_KEY: "<wygenerowany klucz LiteLLM dla toskanii>"
TOSKANIA_SESSION_SECRET: "<losowy sekret min. 32 znaki, np. openssl rand -hex 32>"
TOSKANIA_CHAT_PASSPHRASE: "<trzy losowe słowa, nie 'toskania', np. oliwa-cyprys-42>"
YAML
sops --encrypt /tmp/secrets.toskania.plain.yaml > secrets.toskania.enc.yaml
rm /tmp/secrets.toskania.plain.yaml
```

**Uwaga:** dokładna komenda `sops --encrypt` (flagi klucza, `--age`/`--pgp`) musi zgadzać się z tym, czego repo `infra` już używa dla `secrets.llm.enc.yaml` — nie zgaduj, sprawdź `.sops.yaml` w korzeniu `infra` przed uruchomieniem.

Dopisz `TOSKANIA_CHAT_MODEL`, `TOSKANIA_CHAT_MODEL_FALLBACK`, `TOSKANIA_BUDGET_PER_USER`, `TOSKANIA_BUDGET_GLOBAL` do niesekretnego pliku env repo `infra` (ten, z którego czytają `TOSKANIA_...` bez szyfrowania inne zmienne konfiguracyjne, niebędące sekretami — zweryfikuj, gdzie `karpacz`/`gieldowo` trzymają swoje niesekretne zmienne modelowe, i powiel to miejsce).

- [ ] **Step 4: Dopisz wpis ingressu do configu `cloudflared`, przed regułą domykającą 404**

W pliku configu tunelu (zweryfikowana nazwa z Step 1's odkrycia — prawdopodobnie `cloudflared/config.yml`):

```yaml
  - hostname: toskania.hybiak.eu
    service: http://toskania:3000
```

Wstaw ten wpis **przed** ostatnią regułą `- service: http_status:404` (kolejność w `ingress:` ma znaczenie w Cloudflare Tunnel — pierwsza pasująca reguła wygrywa).

- [ ] **Step 5: Rozszerz `infra/.github/workflows/deploy.yml`**

Dopisz `mkdir -p ~/toskania-data` w tym samym miejscu, gdzie tworzone są analogiczne katalogi danych (`~/hermes-data` itp.) — przed krokiem `docker compose up -d`.

Zmień linię:
```
docker compose pull hermes karpacz
```
na:
```
docker compose pull hermes karpacz toskania
```

Zmień zagnieżdżone `sops exec-env` (blok bez `--force-recreate`, bo `toskania` — jak `karpacz` — nie ma bind mountu configu):
```
sops exec-env secrets.llm.enc.yaml \
  "sops exec-env secrets.agent.enc.yaml \
    'sops exec-env secrets.toskania.enc.yaml \"docker compose up -d\"'"
```

- [ ] **Step 6: Sprawdź składnię compose lokalnie**

Run: `docker compose -f docker-compose.yml config --quiet`
Expected: brak błędu (podstawienia `${TOSKANIA_...}` mogą dać ostrzeżenie o braku zmiennych w lokalnym `.env` — to oczekiwane, sekrety wchodzą dopiero na VPS przez `sops exec-env`).

- [ ] **Step 7: Commit w repo `infra`**

```bash
git add docker-compose.yml secrets.toskania.enc.yaml cloudflared/ .github/workflows/deploy.yml
git commit -m "feat: serwis toskania (chat + plan) — wzorem karpacz

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxFksn16k6DRCDcqV6kgBW"
```

- [ ] **Step 8: Wróć do repo `toskania` dla kolejnych zadań**

Run: `cd /home/mariusz/Desktop/toskania`

- [ ] **Step 9: Przed pushem — zweryfikuj punkty z §16 spec, które ten task odblokowuje**

Nie zakładaj, sprawdź na żywym VPS przed pierwszym realnym deployem:
1. Czy `*.hybiak.eu` faktycznie pokrywa `toskania.hybiak.eu` bez nowego rekordu DNS (§16.1).
2. Realne zużycie RAM (`docker stats toskania`) mieści się w `mem_limit: 256m` (§16.2, kryterium akceptacji 6).
3. Czy repo `toskania` ma zostać publiczne po cutoverze — dziś jest, bo Pages tego wymaga (§16.5).

Te trzy punkty nie mają osobnych tasków, bo są weryfikacją na żywym środowisku, nie kodem — wykonaj je ręcznie po pierwszym zielonym deployu i zapisz wynik w spec §16 albo w notatce operacyjnej, zanim uznasz plaster 3 za zamknięty.

---

## Self-Review (wykonane)

**1. Pokrycie spec:**
- D1-D9 (§3): D1 (Node/Fastify, Task 1,7), D2 (function calling, Task 5/12, brak embeddingów), D3 (czyste funkcje, Task 5, adapter MCP świadomie poza zakresem — plaster 4), D4 (read-only `trip.json`, żaden task go nie modyfikuje w runtime), D5 (bramka+tożsamość, Task 8-9), D6 (jeden origin, Task 19-20), D7 (macierz przy buildzie, Task 3), D8 (`CHAT_MODEL`/`CHAT_MODEL_FALLBACK` z env, Task 12), D9 (wzorzec `karpacz`, Task 22).
- §4 endpointy: `/api/auth/gate` (8), `/api/auth/who` (9), `/api/chat` (14), `/api/me` (15), `/healthz` (7). ✓ wszystkie pokryte.
- §5 tabela narzędzi: wszystkie 7 wierszy → Task 5, sygnatury dokładnie jak w tabeli.
- §6 macierz odległości: Task 3 (skrypt), Task 4 (walidator).
- §7 schemat SQLite: Task 6, jeden do jednego z blokiem SQL w spec.
- §8 pętla czatu: Task 12 (limit 5 iteracji, timeout 30s/15s), Task 13 (prompt systemowy z `listDays()`).
- §9 bramka/limity: Task 8 (rate limit 5/15min/IP + CF-Connecting-IP), Task 9 (dwa kroki, `gate` przed listą imion), Task 11 (limity per-user + global), Task 14 (rate limit czatu 10/min/sesję).
- §10 deploy: Task 20 (Dockerfile node:22-alpine), Task 21 (CI repo app), Task 22 (CI/compose repo infra), Task 19 (base cutover, świadomie na końcu).
- §11 obsługa błędów: fallback LLM (Task 12), 429 przy limicie (Task 14), `null` z narzędzi (Task 5), degradacja OSRM (Task 3), walidator failuje build (Task 4). VPS-down/beszel — infrastrukturalne, brak akcji kodowej do zaplanowania.
- §12 testy: narzędzia (Task 5), walidator (Task 4), auth (Task 8-10, w tym 401 na `/api/auth/who` bez `gate`), e2e 10 pytań (Task 16).
- §15 kryteria akceptacji: 1 (Task 4/1), 2 (Task 19-20 wizualna identyczność — brak automatycznego testu wizualnego w zakresie tego planu, tylko ręczna weryfikacja w Task 18 Step 3), 3 (Task 16 e2e), 4 (Task 14 test 429 + `/healthz` nietknięty), 5 (Task 12 fallback + Task 14 502 z komunikatem), 6 (Task 22 Step 9 ręczna weryfikacja `docker stats`).
- §16 do zweryfikowania: pkt 3 (limit OSRM) — flagowane w Task 3 Step 5; pkt 6 (CF-Connecting-IP) — flagowane jako wymóg w Task 8 nagłówku "Uwaga"; pkt 1,2,4,5 — flagowane w Task 22 Step 9 jako ręczna weryfikacja po deployu, bo są własnością środowiska, nie kodu.

**2. Skan placeholderów:** brak „TBD"/„podobnie jak w Tasku N" bez kodu. Jedyny świadomy skrót to SSE zamiane na zwykły JSON w Task 14 (uzasadnione i jawnie oznaczone komentarzem `TODO` w kodzie, nie luką w planie) — MVP spełnia wszystkie testowalne kryteria akceptacji tego planu; pełne strumieniowanie SSE to rozszerzenie, nie brakujący fundament.

**3. Spójność typów/sygnatur między taskami:**
- `buildToolRegistry({trip, distanceMatrix})` (Task 5) używane identycznie w Task 12 testach, Task 13, Task 16, Task 20.
- `runChatLoop({llmClient, toolRegistry, systemPrompt, history, userMessage})` (Task 12) — te same nazwy pól w Task 14 i Task 16.
- `requireSession`/`getSessionUser(req, db)` (Task 10) — identyczny import w Task 14, Task 15.
- `budgetExceeded(db, userId, {perUserLimit, globalLimit})` (Task 11) — identyczna sygnatura w Task 14.
- `buildApp(opts)` (Task 7) rozszerzane addytywnie w Task 8 (`passphrase`), Task 14 (`toolRegistry`/`llmClient`/`systemPrompt`/`budgets`), Task 20 (realne wartości w `server/index.js`) — bez zmiany istniejących pól.
- `openDb(path)` (Task 6) — ten sam kontrakt używany w Task 7 (`opts.dbPath`) i Task 20 (`process.env.DB_PATH`).

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-09-czat-konta-vps-plan.md`. Dwie opcje wykonania:**

**1. Subagent-Driven (rekomendowane)** — dispatch świeżego subagenta per task, review między taskami, szybka iteracja

**2. Inline Execution** — wykonanie taskow w tej sesji przez executing-plans, wsadowo z checkpointami

**Pamiętaj o freeze do 2026-09-28** — egzekucja tego planu nie zaczyna się przed tą datą, chyba że jawnie zniesiesz freeze.

**Która opcja?**
