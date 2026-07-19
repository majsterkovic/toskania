# Spec: Remodel strony głównej w timeline + strony dni

Data: 2026-07-19
Status: zatwierdzony projekt (do przejrzenia przez użytkownika przed planem implementacji)

## 1. Problem i cel

Obecna strona główna (`index.html` → `renderApp`) jest przeładowana: każdy dzień renderuje pełną kartę (narracja, atrakcje, research, godziny otwarcia, las dębowy, wskazówki), a pod dniami są jeszcze galeria, koszty, pogoda, todo i praktyczne. Efekt: nie da się objąć planu całościowo i strona jest bardzo długa.

**Cel:** strona główna ma być **przeglądowym timeline'em** całego wyjazdu (rzut oka na ~1–2 ekranach). Cały głęboki detal dnia trafia na osobny widok dnia; sekcje poboczne — na osobne strony.

## 2. Zakres (co robimy) i non-goals

**Robimy:**
- Nowa strona główna = timeline pogrupowany w 4 fazy, z mapami baz.
- Widok dnia (drill-down) jako SPA hash-routing (`#/dzien-N`) — reużywa istniejący render dnia.
- Wydzielenie osobnych stron: `/mapa/` (interaktywna mapa z przełączaniem dni), `/galeria/`, `/praktyczne/` (koszty + pogoda + todo + info).
- Usunięcie mapy całej trasy Poznań→Toskania→Poznań.

**Non-goals (YAGNI):**
- Brak zmian w danych `plan_2bazy.json` (poza ewentualnym uzupełnieniem brakujących `coords` atrakcji, jeśli mapa bazy tego wymaga).
- Brak ładnych URL-i per dzień (świadomie — użytkownik zaakceptował „brzydki" hash).
- Brak nowego backendu / API. Wszystko statyczne (GitHub Pages).
- Nie ruszamy strony `/short` ani `public/audyt.html`.

## 3. Struktura stron (site map)

| Strona | Wejście Vite | URL | Zawartość |
|---|---|---|---|
| Timeline (główna) | `index.html` → `src/main.js` | `/toskania/` | hero + timeline 4 faz + mapy baz |
| Widok dnia | ta sama (SPA) | `/toskania/#/dzien-N` | pełen detal dnia |
| Mapa | `mapa/index.html` → `src/mapa.js` | `/toskania/mapa/` | interaktywna mapa Toskanii z przełączaniem dni |
| Galeria | `galeria/index.html` → `src/galeria.js` | `/toskania/galeria/` | galeria zdjęć |
| Praktyczne | `praktyczne/index.html` → `src/praktyczne.js` | `/toskania/praktyczne/` | koszty + pogoda + todo + info |
| Skrót | `short/index.html` | `/toskania/short/` | bez zmian |

Nawigacja serwisu (`renderSiteNav`, wspólna dla wszystkich stron): **Plan · Mapa · Galeria · Praktyczne · Skrót**. Aktywna pozycja podświetlona wg bieżącej strony.

`vite.config.js` `rollupOptions.input`: `main, short, mapa, galeria, praktyczne`.

## 4. Strona główna — timeline

### 4.1 Kompozycja (od góry)
1. `renderSiteNav()` (wspólna nawigacja).
2. **Hero**: główne zdjęcie (`meta.images.hero`) + tytuł + daty + pasek liczb: „16 dni · 2 bazy · 12–27.09.2026" + link „budżet →" do `/praktyczne/`.
3. **Timeline** pogrupowany w 4 fazy (patrz 4.2).
4. Footer (jak dziś).

### 4.2 Fazy i przypisanie dni
Deterministyczna reguła z listy `plan.days`:
- **Dojazd** — wiodące dni `type==='transit'` (D1, D2). Bez mapy bazy.
- **Garfagnana · baza 1** — dni `base_id==='base1'` (D3–D6). Nagłówek fazy + **mapa bazy 1**.
- **Chianti · baza 2** — dzień `type==='tuscany_transfer'` (D7) + dni `base_id==='base2'` (D8–D13). Nagłówek fazy + **mapa bazy 2**.
- **Powrót** — zamykające dni `type==='transit'` (D14, D15) + `type==='buffer'` (27.09). Bez mapy bazy.

### 4.3 Wiersz dnia (kompaktowy)
Każdy dzień (poza buforem) = klikalny wiersz prowadzący do `#/dzien-N`:
- **Data + dzień tygodnia** (z `day.date`, np. „15.09 (wt)").
- **Tytuł** (`day.title`) — to jest główny tekst wiersza. Pełne zdanie `summary` NIE trafia do wiersza (zostaje na `/short` i na stronie dnia) — to klucz do zwięzłości.
- **Znaczniki**: `★ tłumy` gdy `type` kończy się na `popular` lub jest `crowd_tip`; czas jazdy (`drive_h` dla transit, `daily_km_estimate` km dla dni toskańskich) jako mały tag.
- **Akcent bazy**: lewa krawędź / kropka w kolorze `dayAccent(day)`.
- **Bufor** (27.09): wiersz nieklikalny, pokazuje `day.note` inline (brak osobnego widoku — brak głębokiej treści).

### 4.4 Mapa bazy (komponent)
Kontenery `#map-base-1`, `#map-base-2` w nagłówkach faz baz. Inicjalizacja: nowa `initBaseMaps(plan)` w `maps.js`, reużywa istniejące helpery ikon z `initInteractiveMap` (`makePinIcon`, `dayAccent`).
- **Baza**: pin w **głównym kolorze** (primary/accent aplikacji), większy, wyróżniony (np. `makePinIcon(mainColor, 22, true)`).
- **Atrakcje**: piny w kolorze **wg dnia** (`dayAccent(day)`), mniejsze — dla bazy 1 z dni D3–D6, dla bazy 2 z dni D8–D13. Źródło współrzędnych: `day.attractions[].coords` (pomijamy atrakcje bez `coords`).
- **Legenda** pod mapą: kropka koloru → „Dzień N: <tytuł skrócony>".
- `fitBounds` do bazy + wszystkich pinów. `scrollWheelZoom: false`.
- Uwaga: D12 (Florencja) leży daleko na północ — pin i tak pokazujemy (to atrakcja programu bazy 2), `fitBounds` to obejmie.

## 5. Widok dnia (`#/dzien-N`)

### 5.1 Routing (SPA hash)
`src/main.js` dostaje mały router:
- Na `load` i `hashchange` parsuje `location.hash`.
  - `#/dzien-N` (N = `day_num` 1..15) → render widoku dnia do `#app`, init mini-mapy dnia, scroll na górę.
  - puste / `#/` → render timeline, init map baz.
- Router czyści poprzednie mapy (`destroyAllMaps()`) przy każdej zmianie widoku.
- Powrót na timeline: przewinięcie do klikniętego wcześniej dnia (zapamiętany `lastDay`) — nice-to-have.

### 5.2 Zawartość
Reużywa istniejący render dnia. Wydzielamy **`renderDayBody(day, images, bases)`** (narracja + `renderTransit`/`renderTuscany`/`renderBuffer`) z obecnego `renderDay`, żeby widok dnia i (ew.) inne miejsca współdzieliły logikę.
- Nagłówek strony dnia: feature-zdjęcie (`day.image` → `resolvePlaceImage`), data, tytuł, badge fazy/bazy.
- Body: narracja + atrakcje + **mini-mapa dnia** (`#map-day-N` → `initDayMap(base, day.attractions)`) — otwarte; jedzenie, wino, ostrzeżenia — otwarte.
- Zwinięte (istniejące collapsible): research, godziny otwarcia, las dębowy, wskazówki.
- **Nawigacja**: „← Plan" (`#/`) oraz „‹ poprzedni" / „następny ›" (`#/dzien-(N∓1)`), zakres 1..15 (bufor pomijany).

## 6. Strony poboczne

- **`/mapa/`** (`src/mapa.js`): przenosimy `initInteractiveMap('map-tuscany-interactive', plan)` (mapa z przełączaniem dni + filtrami/km — bez zmian funkcjonalnych). Kontener + nagłówek + wspólna nawigacja/stopka.
- **`/galeria/`** (`src/galeria.js`): `renderGallery(images)` + `initGallery()`.
- **`/praktyczne/`** (`src/praktyczne.js`): `renderCosts(plan.costs)` + sekcja „Pogoda" (`initWeather('weather-container', locs)`) + `renderTodo(plan.todo)` + `initTodo()` + `renderPractical(plan.practical_info)`.
- Każda strona: `renderSiteNav()` na górze, `initThemeToggle()`, `swapMapTiles`/`initScrollReveal` wg potrzeb, footer.

## 7. Co usuwamy z kodu

- Sekcja „Mapa trasy" (`renderApp` linie ~920–928) — **usunięta**.
- `initRouteOverviewMap` + wywołanie w `initAllMaps` — usunięte (funkcja może zostać w `maps.js` jako martwy kod do skasowania).
- Ze strony głównej znika bezpośrednie renderowanie: `renderInteractiveMap`/interaktywnej mapy (→ `/mapa`), `renderGallery` (→ `/galeria`), `renderCosts`/pogoda/`renderTodo`/`renderPractical` (→ `/praktyczne`).
- `renderApp` przestaje być używany jako „wszystko na jednej stronie" — zastąpiony przez `renderTimeline(plan)` (główna) + router.

## 8. Refaktor `render.js` (granice modułów)

- `renderTimeline(plan)` — NOWE: hero + fazy + wiersze dni + kontenery map baz.
- `renderDayPage(day, images, bases)` — NOWE: nagłówek dnia + `renderDayBody` + nawigacja prev/next.
- `renderDayBody(day, images, bases)` — wydzielone z `renderDay` (współdzielone).
- Bez zmian (reużyte): `renderTransit`, `renderTuscany`, `renderBuffer`, `renderAttractions`, `renderOakForest`, `renderFood`, `renderWineTasting`, `renderOpeningHours`, `renderLogistics`, `renderWebResearch`, `renderEtaTimeline`, `renderGallery`, `renderCosts`, `renderTodo`, `renderPractical`, `resolvePlaceImage`, `dayAccent`, collapsible helpers.
- `maps.js`: NOWE `initBaseMaps(plan)`; zachowane `initDayMap`, `initInteractiveMap`, `destroyAllMaps`, `swapMapTiles`, helpery ikon; usunięte `initRouteOverviewMap`/`initAllMaps` (lub `initAllMaps` okrojone).

## 9. Dane (co zasila co)

- Timeline: `day.date`, `day.title`, `day.type`, `day.base_id`, `day.crowd_tip`, `day.drive_h`, `day.daily_km_estimate`, `dayAccent`.
- Mapy baz: `bases[].coords` (są: base1 `[44.073,10.483]`, base2 `[43.365,11.513]`), `day.attractions[].coords`.
- Widok dnia: pełny obiekt dnia (jak dziś).
- Strony poboczne: `plan.costs`, `plan.todo`, `plan.practical_info`, `bases` (pogoda), `meta.images` (galeria), `meta.map_config` (mapa interaktywna).

## 10. Weryfikacja

- `npm run build` przechodzi (5 wejść Vite + webp).
- Node smoke-test (stub `import.meta.env.BASE_URL`): `renderTimeline` produkuje 4 nagłówki faz i 15 klikalnych wierszy + 2 kontenery map baz; `renderDayPage` dla przykładowego dnia zawiera narrację, mini-mapę i nawigację prev/next; strony `/mapa`, `/galeria`, `/praktyczne` renderują swoje sekcje.
- Ograniczenie: brak przeglądarki w sandboxie — weryfikacja hash-routingu i Leaflet statycznie (struktura HTML + grep bundla), render wizualny do sprawdzenia przez użytkownika po deployu.

## 11. Ryzyka / decyzje

- **Tytuł jako tekst wiersza** (nie `summary`) — świadome, dla zwięzłości. Gdyby brakowało kontekstu, można później dodać krótkie `tagline` (osobna decyzja, nie teraz).
- **Wygląd** (kolory faz/baz, styl pinów, typografia, responsywność, dark mode) — celowo NIE rozstrzygany w tym specu; to zadanie dla skilla **frontend-design** na etapie implementacji.
- SPA hash-routing na GitHub Pages: `#`-URL działa bez konfiguracji serwera (brak potrzeby `404.html`).
