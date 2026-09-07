# Trip content / engine split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oddzielić treść wycieczki (`trip.json` + `trip.config.js`) od silnika frontendu, bez zmiany wyglądu i bez zmiany hostingu (GitHub Pages).

**Architecture:** Ten sam Vite 6 MPA, `base: '/toskania/'`. Dane z `plan_2bazy.json` stają się `trip.json` z `meta.schema_version: 1`. JS czyta je wyłącznie przez `src/trip.js`. Walidator w `npm run build` failuje CI przy złamaniu kontraktu. Żadnego VPS, PWA, czatu, CLI, ani katalogu `trips/`.

**Tech Stack:** Vite 6, vanilla ESM, Node 22 (`node:test` + `node scripts/validate-trip.js`). Weryfikacja wizualna: `npm run build` + `scripts/take-screenshots.js` (Puppeteer, już w repo).

**Spec:** `docs/superpowers/specs/2026-09-07-trip-content-engine-split-design.md`

## Global Constraints

- Nie wykonywać przed **2026-09-28** (freeze strony na czas wyjazdu 12–27.09).
- Hosting: GitHub Pages; **nie** zmieniać `.github/workflows/deploy.yml` ani `vite.config.js` `base`.
- JSON: nowe pola tylko w `meta` (ew. `drive_min_reason` przy konkretnej atrakcji). Nie robić `JSON.stringify` całego planu — psuje 4000-liniowy diff.
- Zapis JSON jeśli już ruszamy plik ręcznie: UTF-8, `indent: 2`, `ensure_ascii` nie dotyczy (plik jest UTF-8).
- localStorage todo musi zostać `todo-done-toskania-2026`. Packing: prefiks `packing:` bez zmian.
- `plan.json` (3 bazy) nie importować i nie kasować.
- Commit po każdym tasku; push na `main` tylko po jawnym OK użytkownika (to prywatny plan grupy).
- Testy: `node --test` (wbudowane w Node 22, bez Jesta).

---

## File Structure

- Create: `trip.config.js` — `id`, `imageSizes`, `imageAliases` (to, co dziś w `render.js`).
- Create: `src/trip.js` — jedyny import `trip.json` + re-export `config`.
- Create: `scripts/validate-trip.js` — `validateTrip(trip, config) → { ok, errors }`; CLI czyta `trip.json` + `trip.config.js`.
- Create: `scripts/validate-trip.test.js` — fixture’y, `node:test`.
- Create: `scripts/fixtures/trip-minimal.json` — najmniejszy legalny trip do testów.
- Rename: `plan_2bazy.json` → `trip.json` (`git mv`).
- Modify: `src/site.js`, `src/weather.js`, `src/render.js`, `src/main.js`, `src/short.js`, `src/mapa.js`, `src/galeria.js`, `src/praktyczne.js`, `src/packing.js`.
- Modify: `package.json` (`build` zaczyna się od walidatora; dodać `test`).
- Modify: `CLAUDE.md`, `README.md` — nowa nazwa pliku danych.
- Nie ruszać: `vite.config.js` (base, inputs), `deploy.yml`, HTML shelli poza komentarzem przy preload hero, `src/styles/*`, `plan.json`.

---

### Task 1: Walidator + testy (czerwone, potem zielone na fixture)

**Files:**
- Create: `scripts/validate-trip.js`
- Create: `scripts/validate-trip.test.js`
- Create: `scripts/fixtures/trip-minimal.json`
- Modify: `package.json` (skrypt `test`)

**Interfaces:**
- Produces: `export function validateTrip(trip, config): { ok: boolean, errors: string[] }`
- Produces: `export function loadConfigForTest(): object` nie jest potrzebne — testy podają `config` inline.
- `config` shape: `{ id: string, imageSizes: Record<string,string>, imageAliases: Record<string,string> }`

- [ ] **Step 1: Napisz fixture minimalnego tripa**

`scripts/fixtures/trip-minimal.json`:

```json
{
  "meta": {
    "schema_version": 1,
    "brand": "Test",
    "storage_key": "test-trip",
    "timezone": "Europe/Rome",
    "start_date": "2026-09-12",
    "end_date": "2026-09-27",
    "title": "Test",
    "dates": "12–27 września 2026",
    "phase_labels": {
      "dojazd": { "label": "Dojazd", "sub": "A → B" },
      "powrot": { "label": "Powrót", "sub": "B → A" }
    },
    "images": { "hero": { "src": "images/hero.jpg", "alt": "", "credit": "" }, "places": {} }
  },
  "bases": [
    { "id": "base1", "name": "Baza", "coords": [44.0, 10.5] }
  ],
  "transit_stops": {},
  "days": [
    {
      "day_num": 1,
      "type": "transit",
      "title": "Tam",
      "base_id": null,
      "route_points": [{ "label": "Start", "coords": [52.4, 16.9], "kind": "home" }]
    },
    {
      "day_num": 2,
      "type": "tuscany",
      "title": "Dzień",
      "base_id": "base1",
      "attractions": [
        { "name": "X", "coords": [44.1, 10.6], "drive_min": 12 }
      ]
    }
  ],
  "practical_info": {},
  "costs": {},
  "todo": {},
  "packing_list": {}
}
```

- [ ] **Step 2: Napisz testy (walidator jeszcze nie istnieje — mają paść)**

`scripts/validate-trip.test.js`:

```js
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
```

- [ ] **Step 3: Uruchom testy — mają paść (brak modułu)**

```bash
node --test scripts/validate-trip.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` dla `./validate-trip.js`.

- [ ] **Step 4: Zaimplementuj walidator**

Cały plik `scripts/validate-trip.js` (importy na górze, CLI na dole):

```js
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
```

CLI ładuje `trip.json` i `trip.config.js` z CWD repo (nie z `scripts/`). Na końcu Task 1 tych plików jeszcze nie ma — `node scripts/validate-trip.js` padnie do Task 3; to zamierzone.

- [ ] **Step 5: Uruchom testy na fixture**

```bash
node --test scripts/validate-trip.test.js
```

Expected: PASS (wszystkie 7). CLI `node scripts/validate-trip.js` na tym etapie padnie — brak `trip.json` / `trip.config.js`. To OK, CLI podpinamy w Task 3.

- [ ] **Step 6: Dodaj skrypt test w package.json**

W `"scripts"`:

```json
"test": "node --test scripts/validate-trip.test.js"
```

Nie zmieniaj jeszcze `build`.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-trip.js scripts/validate-trip.test.js scripts/fixtures/trip-minimal.json package.json
git commit -m "$(cat <<'EOF'
test: walidator trip.json v1 (node:test)

EOF
)"
```

---

### Task 2: Pola `meta` w danych + rename na `trip.json`

**Files:**
- Rename: `plan_2bazy.json` → `trip.json`
- Modify: blok `meta` na początku `trip.json` (tylko wstawka, bez dumpa całości)

**Interfaces:**
- Consumes: kontrakt z Task 1 (`schema_version`, `brand`, `storage_key`, `timezone`, `start_date`, `end_date`, `phase_labels`)
- Produces: `trip.json` spełniający walidator **gdy** pojawi się `trip.config.js` (Task 3). Po tym tasku sam JSON ma pola; CLI jeszcze nie musi przechodzić.

- [ ] **Step 1: `git mv`**

```bash
git mv plan_2bazy.json trip.json
```

- [ ] **Step 2: Wstaw pola w `meta` zaraz po `{` / `"meta": {`**

Dokładna wstawka (nie ruszając reszty pliku):

```json
    "schema_version": 1,
    "brand": "Toskania",
    "storage_key": "toskania-2026",
    "timezone": "Europe/Rome",
    "start_date": "2026-09-12",
    "end_date": "2026-09-27",
    "phase_labels": {
      "dojazd": { "label": "Dojazd", "sub": "Poznań → Toskania" },
      "powrot": { "label": "Powrót", "sub": "Toskania → Poznań" }
    },
```

zostaw istniejące `"title": "Toskania 2026"` itd. zaraz pod spodem.

Jeśli jakaś atrakcja z `coords` nie ma `drive_min`: dopisz `"drive_min": null` i `"drive_min_reason": "pociąg"` (albo inną prawdę z notatek dnia — nie zgaduj minut). Znajdź je grepem:

```bash
node -e "
import t from './trip.json' with { type: 'json' };
for (const d of t.days) {
  for (const a of d.attractions || []) {
    if (a.coords && typeof a.drive_min !== 'number' && a.drive_min !== null)
      console.log('D'+d.day_num, a.name);
  }
}
"
```

Expected: pusta lista. Jeśli nie — uzupełnij w JSON tylko te atrakcje.

- [ ] **Step 3: Sprawdź, że plik jest legalnym JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('trip.json','utf8')); console.log('json ok')"
```

Albo w ESM: `node --input-type=module -e "import t from './trip.json' with { type: 'json' }; console.log(t.meta.schema_version, t.days.length)"`

Expected: `1 16` (albo 15+bufor — liczba elementów `days` jak przed zmianą).

- [ ] **Step 4: Commit**

```bash
git add trip.json
git commit -m "$(cat <<'EOF'
refactor: plan_2bazy.json → trip.json v1 (meta kontraktu)

EOF
)"
```

Build na tym etapie jest **czerwony** (entry wciąż importują `plan_2bazy.json`). Nie pushuj. Następny task przywraca build.

---

### Task 3: `trip.config.js` + `src/trip.js` + podpięcie entry pointów

**Files:**
- Create: `trip.config.js`
- Create: `src/trip.js`
- Modify: `src/main.js`, `src/short.js`, `src/mapa.js`, `src/galeria.js`, `src/praktyczne.js`, `src/packing.js`
- Modify: `package.json` (`build`)
- Modify: `src/render.js` — przenieś `IMAGE_SIZES` / `IMAGE_ALIASES` do configu (czytane z `config`)

**Interfaces:**
- Produces: `trip.config.js` default export:

```js
export default {
  id: 'toskania-2026',
  imageSizes: {
    'hero__figure': '(min-width: 1024px) 640px, 100vw',
    'daypage__hero': '(min-width: 900px) 860px, 100vw',
    'attraction-thumb': '96px',
  },
  imageAliases: {
    'images/radda.jpg': 'images/radda-chianti.jpg',
    'images/monte-oliveto.jpg': 'images/monte-oliveto-maggiore.jpg',
    'images/asciano.jpg': 'images/asciano-crete.jpg',
    'images/lamone.jpg': 'images/selva-del-lamone.jpg',
  },
};
```

- Produces: `src/trip.js`:

```js
import trip from '../trip.json';
import config from '../trip.config.js';
export { trip, config };
```

- Consumes: `validateTrip(trip, config)` z Task 1
- `render.js` `imgSrc` / `imgSources` używają `config.imageAliases` i `config.imageSizes` zamiast stałych. Import: `import { config } from './trip.js'` **w render.js jest OK** (jedna para JSON+config, bez cyklu: `trip.js` nie importuje `render.js`).

- [ ] **Step 1: Dodaj `trip.config.js` i `src/trip.js`** (treść jak w Interfaces).

- [ ] **Step 2: W `render.js` usuń `const IMAGE_SIZES` i `const IMAGE_ALIASES`; użyj `config`**

Było:

```js
const resolved = IMAGE_ALIASES[path] || path;
const sizes = IMAGE_SIZES[className];
```

Ma być:

```js
import { config } from './trip.js';
// ...
const resolved = config.imageAliases[path] || path;
const sizes = config.imageSizes[className];
```

- [ ] **Step 3: We wszystkich 6 entry zamień import JSON na `import { trip } from './trip.js'`**

Wzorzec `src/main.js`:

Było:

```js
import plan2 from '../plan_2bazy.json';
const plan = plan2;
```

Ma być:

```js
import { trip as plan } from './trip.js';
```

(albo `import { trip } from './trip.js'` i rename użyć `trip` — wtedy zamień `plan.` na `trip.` w tym pliku). Nie mieszaj obu nazw w jednym pliku.

To samo: `short.js`, `mapa.js`, `galeria.js`, `praktyczne.js`, `packing.js`.

`packing.js` dziś woła `renderSiteNav(plan.meta)` — to bug (meta nie jest kluczem `active`). W tym tasku zostaw wywołanie jak w innych plikach: `renderSiteNav('packing')`. Podmianę sygnatury na `(trip, active)` robi Task 4.

- [ ] **Step 4: Podłącz walidator do buildu**

`package.json`:

```json
"build": "node scripts/validate-trip.js && node scripts/convert-webp.js && vite build",
"test": "node --test scripts/validate-trip.test.js"
```

- [ ] **Step 5: Testy + walidator na prawdziwym JSON + build**

```bash
npm test
node scripts/validate-trip.js
npm run build
```

Expected: testy PASS; `trip.json OK`; Vite kończy się kodem 0; `dist/index.html` istnieje. Jeśli walidator krzyczy o `drive_min` — wróć do Task 2 i uzupełnij JSON, nie wyłączaj reguły.

- [ ] **Step 6: Grep że stary import zniknął**

```bash
rg "plan_2bazy" --glob '!docs/**' --glob '!notes/**' --glob '!public/audyt.html' --glob '!*.md'
```

Expected: zero trafień w `src/` i `*.html` entry. `notes/` i `audyt.html` wolno zostawić (historia).

- [ ] **Step 7: Commit**

```bash
git add trip.config.js src/trip.js src/render.js src/main.js src/short.js src/mapa.js src/galeria.js src/praktyczne.js src/packing.js package.json
git commit -m "$(cat <<'EOF'
refactor: jeden import trip.json przez src/trip.js + walidator w buildzie

EOF
)"
```

---

### Task 4: Chrome, pogoda i copy z `trip.meta` (koniec hardkodu Toskanii w `src/`)

**Files:**
- Modify: `src/site.js`, `src/weather.js`, `src/render.js`, `src/praktyczne.js`, `src/packing.js`, `src/short.js`
- Modify: `index.html` — komentarz przy preload: `imagesizes` musi = `trip.config.js` `imageSizes.hero__figure` (nie zmieniaj samych URL-i hero)

**Interfaces:**
- Consumes: `trip.meta.brand`, `.title`, `.dates`, `.storage_key`, `.timezone`, `.start_date`, `.end_date`, `.phase_labels`
- Produces:

```js
export function renderSiteNav(trip, active = 'plan'): string
export function renderSiteFooter(trip): string
export function initTodo(trip): void
export async function initWeather(containerId, locs, opts): Promise<void>
// opts = { startDate: string, endDate: string, timezone: string }
```

- [ ] **Step 1: `site.js` — brand, stopka, storage z tripa**

`renderSiteNav(trip, active)`:

```js
export function renderSiteNav(trip, active = 'plan') {
  const brand = trip?.meta?.brand || trip?.meta?.title || '';
  const links = NAV_LINKS.map(
    ([key, href, label]) =>
      `<a href="${BASE}${href}"${key === active ? ' class="is-active" aria-current="page"' : ''}>${label}</a>`
  ).join('');
  return `
    <a class="skip-link" href="#tresc">Przejdź do treści</a>
    <nav class="site-nav" id="site-nav" aria-label="Nawigacja strony">
      <a class="site-nav__brand" href="${BASE}">${brand}</a>
      <div class="site-nav__links">${links}</div>
      <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Przełącz tryb ciemny/jasny">◑</button>
    </nav>
  `;
}
```

Brand jest tekstem z JSON (zaufany, nasz plik). Nie potrzeba `esc` jeśli nigdy nie wklejasz HTML w `brand`; i tak użyj `esc(brand)` — zaimportuj `esc` z `html.js` (uwaga cykl: `html.js` nie importuje `site.js`, OK).

`renderSiteFooter(trip)`:

```js
export function renderSiteFooter(trip) {
  const title = trip?.meta?.title || '';
  const dates = trip?.meta?.dates || '';
  return `
    <footer class="footer">
      <p>${esc(title)} · ${esc(dates)}</p>
      <p class="footer__credit">Mapy: <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">© OpenStreetMap</a> · Zdjęcia: Wikimedia Commons</p>
    </footer>
  `;
}
```

`initTodo(trip)`:

```js
export function initTodo(trip) {
  const STORAGE_KEY = `todo-done-${trip.meta.storage_key}`;
  // reszta funkcji bez zmian
}
```

Dla Toskanii `storage_key` = `toskania-2026` → klucz identyczny jak dziś.

- [ ] **Step 2: Zaktualizuj wszystkie wywołania chrome**

Było: `renderSiteNav('plan')`  
Ma być: `renderSiteNav(plan, 'plan')` (albo `renderSiteNav(trip, 'plan')`).

Pliki: `main.js` (2 miejsca), `short.js`, `mapa.js`, `galeria.js`, `praktyczne.js`, `packing.js`.

Było: `renderSiteFooter()` → `renderSiteFooter(plan)`.  
Było: `initTodo()` → `initTodo(plan)`.

- [ ] **Step 3: `weather.js` — zero `LOCATIONS` / `TRIP_START` / `Europe/Rome`**

Usuń stałe `TRIP_START`, `TRIP_END`, `LOCATIONS`.

```js
export async function initWeather(containerId, locs, opts) {
  const el = document.getElementById(containerId);
  if (!el || !locs?.length) return;
  const { startDate, endDate, timezone } = opts;
  const until = Math.floor((new Date(startDate) - new Date()) / 86400000);
  // fetchForecast: start_date=startDate, end_date=endDate, timezone z opts (URL-encode)
  // fetchArchive: miesiąc z startDate (np. 2026-09-12 → 09-01..09-30 tego miesiąca), timezone z opts
}
```

`fetchForecast` URL: `timezone=${encodeURIComponent(timezone)}&start_date=${startDate}&end_date=${endDate}`.

`fetchArchive(loc, year, month, timezone)`: `month` to `'09'` z `startDate.slice(5, 7)`; zakres `${year}-${month}-01` … koniec miesiąca (dla września 30). Nie hardcoduj `Europe/Rome`.

Label klimatologii: nie „września” na sztywno — `new Date(startDate).toLocaleDateString('pl', { month: 'long' })`.

`praktyczne.js` woła:

```js
initWeather('weather-container', weatherLocs, {
  startDate: plan.meta.start_date,
  endDate: plan.meta.end_date,
  timezone: plan.meta.timezone,
});
```

Nagłówki na stronie praktycznej: `plan.meta.title` zamiast `Toskania 2026`; tytuł pogody np. `Pogoda — ${monthName}` z `start_date`. Nie zostawiaj fallbacku `locs = LOCATIONS`.

- [ ] **Step 4: `render.js` — fazy i stopka dnia z meta**

`groupPhases(days, meta)`:

```js
function groupPhases(days, meta) {
  const dojazd = meta.phase_labels.dojazd;
  const powrot = meta.phase_labels.powrot;
  const phases = [
    { key: 'dojazd', eyebrow: 'Etap I', label: dojazd.label, sub: dojazd.sub, days: [] },
    { key: 'base1', eyebrow: 'Etap II', baseId: 'base1', mapIndex: 1, days: [] },
    { key: 'base2', eyebrow: 'Etap III', baseId: 'base2', mapIndex: 2, days: [] },
    { key: 'powrot', eyebrow: 'Etap IV', label: powrot.label, sub: powrot.sub, days: [] },
  ];
  // reszta pętli bez zmian
}
```

`renderTimeline`: `groupPhases(plan.days, plan.meta)`.

`renderDayPage(...)` — ostatnia linia stopki:

Było: `renderFooter({ dates: '12–27 września 2026' })`  
Ma być: `renderFooter(plan.meta)` — **ale** `renderDayPage` nie dostaje całego `plan`. Dodaj argument `meta` na końcu:

```js
export function renderDayPage(day, images, bases, days, todo, meta)
```

i w `main.js` przekaż `plan.meta`. Wewnątrz: `renderFooter(meta)`.

`renderFooter(meta)` już używa `meta.dates` — zmień literał tytułu:

```js
<p>${esc(meta.title)} · ${esc(meta.dates)}</p>
```

(było `Toskania 2026 · …`).

- [ ] **Step 5: `packing.js` i `short.js` copy z meta**

Packing lead: `${esc(plan.meta.dates)}, ${plan.meta.duration_days} dni. Odhaczaj…` albo po prostu `plan.meta.subtitle`. Zero „Wrzesień 2026, 16 dni Poznań–Toskania”.

`short.js`: usuń `|| 'Toskania 2026'` — walidator gwarantuje `meta.title`.

- [ ] **Step 6: Grep hardkodu w `src/`**

```bash
rg -n "Toskania 2026|todo-done-toskania|2026-09-12|Europe/Rome|44\\.073|plan_2bazy" src/
```

Expected: pusto. Komentarz w `maps.js` „Toskania 2026” w nagłówku pliku — zmień na „trip maps (Leaflet)”. `TYPE_LABELS` w `short.js` (`tuscany: 'Toskania'`) zostają: to etykiety `day.type` w schemacie v1, nie brand.

- [ ] **Step 7: `npm test && npm run build`**

Expected: 0.

- [ ] **Step 8: Commit**

```bash
git add src/site.js src/weather.js src/render.js src/main.js src/praktyczne.js src/packing.js src/short.js src/mapa.js src/galeria.js src/maps.js index.html
git commit -m "$(cat <<'EOF'
refactor: chrome, pogoda i fazy timeline czytają trip.meta

EOF
)"
```

---

### Task 5: Docs, smoke wizualny, zamknięcie

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Modify: `notes/decyzje-otwarte.md` — pierwsza wzmianka `plan_2bazy.json` → `trip.json` (jedna linia, bez przepisywania historii decyzji)
- Test: `scripts/take-screenshots.js` (wymaga `npm run dev` + Puppeteer; skrypt ma twarde `localhost:5173/toskania/`)

- [ ] **Step 1: Zaktualizuj `CLAUDE.md`**

Zamień `plan_2bazy.json` na `trip.json`. Dopisz:

- dane: `trip.json` (`schema_version: 1`), knoby silnika: `trip.config.js`
- import wyłącznie przez `src/trip.js`
- `npm run build` = walidator + webp + vite
- `IMAGE_SIZES` żyją w `trip.config.js` i muszą być zgodne z preloadem hero w `index.html`

- [ ] **Step 2: `README.md`**

Sekcja Edycja: zmień `plan.json` na `trip.json` (README i tak kłamał — od dawna źródłem jest wariant 2-bazowy).

- [ ] **Step 3: `npm test && npm run build`** (jeszcze raz)

- [ ] **Step 4: Screenshot-diff**

Terminal 1: `npm run dev`  
Terminal 2:

```bash
node scripts/take-screenshots.js
```

Porównaj `screenshots/` z poprzednimi ujęciami jeśli są w drzewie; jeśli nie — przejrzyj 8 plików (timeline light/dark, dzień, mapa, galeria, praktyczne, skrót). Regresja = zły nav/brand, zła stopka, brak mapy. Inny hash assetów Vite jest OK.

Skrypt ma hardcoded `ARTIFACTS_DIR` pod ścieżką Antigravity — **nie naprawiaj tego w tym plasterze**, chyba że skrypt przez to pada. Jeśli pada na `executablePath: '/snap/bin/chromium'`, uruchom z systemowym Chrome albo pomiń ten krok i zanotuj w commicie że weryfikacja = `npm run build` + ręczne `npm run preview`.

- [ ] **Step 5: Commit docs**

```bash
git add CLAUDE.md README.md notes/decyzje-otwarte.md
git commit -m "$(cat <<'EOF'
docs: trip.json jako źródło treści, silnik bez hardkodu Toskanii

EOF
)"
```

- [ ] **Step 6: Nie pushuj** aż użytkownik powie OK. Wtedy: `git push origin main` (Pages jak dotychczas).

---

## Self-Review

**1. Spec coverage**

| Wymaganie spec | Task |
|----------------|------|
| `trip.json` v1 + pola meta | T2 |
| Walidator failuje build | T1, T3 |
| `src/trip.js` jedyny import JSON | T3 |
| `trip.config.js` IMAGE_SIZES/aliases | T3 |
| Chrome/weather/fazy z meta | T4 |
| Brak VPS/PWA/CLI/`trips/` | global constraints |
| Pages `base` / workflow nienaruszone | global + T3 nie rusza vite base |
| Screenshot / ten sam UI | T5 |
| Freeze do 28.09 | global |
| Packing localStorage bez migracji | T4 (nie ruszamy prefiksu) |
| `plan.json` zostaje | T2 tylko `git mv` 2-bazowego pliku |

**2. Placeholdery:** brak TBD. CLI walidatora i sygnatury funkcji są w taskach.

**3. Spójność nazw:** `validateTrip(trip, config)`, `renderSiteNav(trip, active)`, `renderSiteFooter(trip)`, `initTodo(trip)`, `initWeather(id, locs, opts)`, `renderDayPage(..., meta)`, `config.imageSizes` / `imageAliases`. `storage_key` → `todo-done-${storage_key}`.
