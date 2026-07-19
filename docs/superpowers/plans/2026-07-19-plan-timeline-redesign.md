# Timeline Redesign Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute task-by-task; commit after each task.

**Goal:** Zamienić przeładowaną stronę główną w przeglądowy timeline z fazami i mapami baz, a pełen detal dnia przenieść do widoku dnia (SPA hash-routing); mapę interaktywną, galerię i sekcje praktyczne wynieść na osobne strony; usunąć mapę całej trasy.

**Architecture:** Vite multi-page (statyczne, GitHub Pages `/toskania/`). Strona główna = SPA z routerem czytającym `location.hash` (`#/` timeline, `#/dzien-N` dzień). Reużycie istniejących renderów dnia (`renderTransit`/`renderTuscany`) i map Leaflet (`initDayMap`, `initInteractiveMap`). Nowe: `renderTimeline`, `renderDayPage`, `initBaseMaps`. Wspólny „chrome" (nav, theme, reveal) wydzielony do `src/site.js`.

**Tech Stack:** Vite 6, Leaflet (global `window.L`), vanilla JS ESM, CSS. Brak frameworka testowego → weryfikacja = `npm run build` + Node smoke-render ze stubem `import.meta.env.BASE_URL`.

## Global Constraints
- Format JSON `plan_2bazy.json`: BEZ zmian danych (poza ewentualnym uzupełnieniem brakujących `coords`). Zapis zawsze `json.dumps(..., ensure_ascii=False, indent=2)` bez końcowego newline.
- Base URL: wszystkie linki wewnętrzne przez `import.meta.env.BASE_URL`.
- Nawigacja serwisu wspólna: `Plan · Mapa · Galeria · Praktyczne · Skrót`.
- Wygląd (kolory faz/baz, piny, typografia, dark mode, responsywność) realizowany skillem **frontend-design** — brak horyzontalnego scrolla body, style light+dark.
- Deploy tylko po jawnym OK użytkownika (commit/push po każdej ukończonej fazie jest OK — repo to prywatny plan).

---

## File Structure
- `src/site.js` — NOWE: `renderSiteNav(active)`, `initChrome()` (theme toggle, scroll reveal, tile swap, active nav). DRY dla wszystkich stron.
- `src/render.js` — MODYFIKACJA: dodać `renderTimeline(plan)`, `renderDayPage(day, images, bases)`, wydzielić `renderDayBody(day, images, bases)`; zachować i wyeksportować `renderGallery/renderCosts/renderTodo/renderPractical` + sub-renderery. `renderSiteNav` przenieść do `site.js`.
- `src/maps.js` — MODYFIKACJA: dodać `initBaseMaps(plan)`; usunąć `initRouteOverviewMap` i jego wywołanie; zachować `initDayMap`, `initInteractiveMap`, helpery ikon, `destroyAllMaps`, `swapMapTiles`.
- `src/main.js` — MODYFIKACJA: router hash (timeline ↔ dzień), `initChrome`, mapy per widok.
- `mapa/index.html` + `src/mapa.js` — NOWE: interaktywna mapa.
- `galeria/index.html` + `src/galeria.js` — NOWE: galeria.
- `praktyczne/index.html` + `src/praktyczne.js` — NOWE: koszty+pogoda+todo+info.
- `vite.config.js` — MODYFIKACJA: inputs `main, short, mapa, galeria, praktyczne`.
- `src/style.css` — MODYFIKACJA: style timeline/faz/wierszy/map baz/strony dnia/nav (frontend-design).

---

### Task 1: Wydzielenie wspólnego chrome (`src/site.js`) + eksporty render.js
**Files:** Create `src/site.js`; Modify `src/render.js` (przenieś `renderSiteNav`, upewnij eksporty), `src/main.js` (import z site.js).
**Interfaces — Produces:** `renderSiteNav(active: string): string`, `initChrome(): void` (montuje theme toggle + scroll reveal + tile swap).
- [ ] Utworzyć `site.js` z `renderSiteNav(active)` (linki Plan/Mapa/Galeria/Praktyczne/Skrót przez `BASE_URL`, klasa `is-active` dla `active`) i `initChrome()` (przeniesione `initThemeToggle`, `initScrollReveal`, `swapMapTiles` hook).
- [ ] Zaktualizować `render.js`/`main.js` by używały `site.js`; usunąć duplikat `renderSiteNav` z render.js.
- [ ] Weryfikacja: `npm run build` przechodzi.
- [ ] Commit: „refactor: wspólny chrome strony (site.js) + eksporty render".

### Task 2: `renderTimeline` + style + główna renderuje timeline
**Files:** Modify `src/render.js` (+`renderTimeline`, `renderDayBody`), `src/main.js` (render timeline), `src/style.css` (frontend-design).
**Interfaces — Produces:** `renderTimeline(plan): string` (hero + 4 fazy + wiersze dni + kontenery `#map-base-1/2`), `renderDayBody(day, images, bases): string`.
- [ ] `renderTimeline`: hero (`meta.images.hero`), pasek liczb, 4 fazy (reguła: dojazd=wiodące transit; garfagnana=base1; chianti=transfer+base2; powrót=zamykające transit+buffer), wiersze dni (data+dzień tyg., `title`, znaczniki ★tłumy/`drive_h`|`daily_km_estimate`, akcent `dayAccent`), link wiersza `href="#/dzien-N"`; bufor nieklikalny (inline `note`); kontener mapy bazy w nagłówku faz baz.
- [ ] Wydzielić `renderDayBody` z `renderDay`.
- [ ] Style timeline (frontend-design): kompaktowe wiersze, nagłówki faz, akcenty baz, hero; light+dark; brak poziomego scrolla.
- [ ] Weryfikacja: Node smoke — `renderTimeline` zawiera 4 nagłówki faz, 15 linków `#/dzien-`, 2 kontenery `map-base-`.
- [ ] Commit: „feat: timeline strony głównej (fazy + wiersze dni)".

### Task 3: Mapy baz (`initBaseMaps`)
**Files:** Modify `src/maps.js` (+`initBaseMaps`), `src/main.js` (wywołanie na timeline), `src/style.css` (legenda).
**Interfaces — Consumes:** kontenery `#map-base-1/2`, `bases[].coords`, `day.attractions[].coords`, `dayAccent`. **Produces:** `initBaseMaps(plan): void`.
- [ ] `initBaseMaps`: dla base1 (atrakcje D3–D6) i base2 (D8–D13): pin bazy w kolorze głównym (duży, `makePinIcon(main,22,true)`), atrakcje w kolorze wg dnia (`dayAccent`), `fitBounds`, legenda „Dzień N: tytuł". Pomijać atrakcje bez `coords`.
- [ ] Weryfikacja: build; Node smoke że funkcja istnieje i nie rzuca przy stubie danych.
- [ ] Commit: „feat: mapy baz z pinami baza(główny)/atrakcje(wg dnia)".

### Task 4: SPA hash-router + widok dnia (`renderDayPage`)
**Files:** Modify `src/main.js` (router), `src/render.js` (+`renderDayPage`), `src/style.css`.
**Interfaces — Produces:** `renderDayPage(day, images, bases): string` (feature img + nagłówek + `renderDayBody` + nawigacja ← Plan/‹prev/next›).
- [ ] Router w `main.js`: na `load`+`hashchange` parsuj hash; `#/dzien-N`→`renderDayPage`+`initDayMap('map-day-N', base, day.attractions)`+scroll top; inaczej→`renderTimeline`+`initBaseMaps`. `destroyAllMaps()` przy zmianie. Zapamiętaj `lastDay` i przewiń do niego po powrocie.
- [ ] `renderDayPage`: nagłówek (data, tytuł, badge fazy), `renderDayBody`, prev/next w zakresie day_num 1..15, „← Plan"=`#/`.
- [ ] Weryfikacja: Node smoke — `renderDayPage(dzień 5)` zawiera narrację, `map-day-5`, linki prev/next.
- [ ] Commit: „feat: hash-routing timeline↔dzień + widok dnia".

### Task 5: Strona `/mapa`
**Files:** Create `mapa/index.html`, `src/mapa.js`; Modify `vite.config.js`.
- [ ] `mapa.js`: `renderSiteNav('mapa')` + kontener `#map-tuscany-interactive` + nagłówek + footer; `initChrome()`; `initInteractiveMap('map-tuscany-interactive', plan)`.
- [ ] Dodać input `mapa` w vite.config.
- [ ] Weryfikacja: `npm run build` produkuje `dist/mapa/index.html`.
- [ ] Commit: „feat: strona /mapa (interaktywna mapa przeniesiona)".

### Task 6: Strona `/galeria`
**Files:** Create `galeria/index.html`, `src/galeria.js`; Modify `vite.config.js`.
- [ ] `galeria.js`: nav('galeria') + `renderGallery(images)` + `initGallery()` + `initChrome()`.
- [ ] input `galeria`.
- [ ] Weryfikacja: build produkuje `dist/galeria/index.html`.
- [ ] Commit: „feat: strona /galeria".

### Task 7: Strona `/praktyczne`
**Files:** Create `praktyczne/index.html`, `src/praktyczne.js`; Modify `vite.config.js`.
- [ ] `praktyczne.js`: nav('praktyczne') + `renderCosts(costs)` + sekcja pogody (`initWeather('weather-container', locs)`) + `renderTodo(todo)`+`initTodo()` + `renderPractical(practical_info)` + `initChrome()`.
- [ ] input `praktyczne`.
- [ ] Weryfikacja: build produkuje `dist/praktyczne/index.html`; smoke że sekcje obecne.
- [ ] Commit: „feat: strona /praktyczne (koszty+pogoda+todo+info)".

### Task 8: Sprzątanie + finalizacja
**Files:** Modify `src/maps.js` (usuń `initRouteOverviewMap`/martwy `initAllMaps`), `src/render.js` (usuń stary `renderApp` jeśli nieużywany), `index.html`.
- [ ] Usunąć „Mapę trasy" i `initRouteOverviewMap`; usunąć nieużywany `renderApp`/`renderInteractiveMap` z głównej.
- [ ] Zaktualizować nav aktywny na każdej stronie; sprawdzić linki `BASE_URL`.
- [ ] Weryfikacja: pełny `npm run build`; Node smoke wszystkich 5 stron; grep bundla że brak `map-route-overview`.
- [ ] Commit + push: „chore: usunięcie mapy całej trasy + finalizacja remodelu".

---

## Self-Review
- **Pokrycie specu:** timeline (T2), mapy baz (T3), widok dnia+router (T4), /mapa (T5), /galeria (T6), /praktyczne (T7), usunięcie route-map (T8), wspólny chrome (T1). ✔ wszystkie sekcje specu mają zadanie.
- **Placeholdery:** brak „TODO/TBD"; każdy task ma pliki, interfejsy, weryfikację.
- **Spójność typów:** `renderTimeline`, `renderDayPage`, `renderDayBody`, `initBaseMaps`, `renderSiteNav(active)`, `initChrome()` — nazwy spójne między zadaniami.
