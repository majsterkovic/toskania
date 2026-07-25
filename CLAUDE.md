# Toskania 2026 — plan wycieczki

Statyczna strona (Vite + Leaflet) prezentująca plan wycieczki samochodowej grupy 5-osobowej po Toskanii, 12–27.09.2026. Dane trasy/dni/atrakcji żyją w `plan_2bazy.json` (ładowany przez `src/main.js`), renderowane przez `src/render.js` do `#app`.

**Decyzja: wariant 2-bazowy (Barga/Garfagnana → Chianti/Castelnuovo Berardenga) jest jedynym prezentowanym planem.** `plan.json` (stary wariant 3-bazowy) nie jest już importowany ani przełączalny na stronie — historia w git, nie w UI.

## `notes/` — baza referencyjna (nie część strony)

`notes/` to notatki Obsidian-style (`[[wikilinks]]`) budowane na bieżąco jako "second brain" tego projektu — sprawdź je PRZED szukaniem w sieci odległości/czasów dojazdu do nowych miejsc:
- `notes/odleglosci.md` — tabela czasów dojazdu (auto/pociąg) z obu baz do okolicznych miast
- `notes/miejscowosci/*.md` — karta per miejscowość (status: wdrożone / rozważane / raczej odrzucone)
- `notes/decyzje-otwarte.md` — otwarte decyzje czekające na potwierdzenie użytkownika

Aktualizuj te notatki przy każdej nowej analizie feasibility, nie zostawiaj odpowiedzi tylko w rozmowie.

## Struktura strony / deploy

- Główna strona: `index.html` + `src/main.js` (Vite entry), baza `/toskania/` (`vite.config.js`).
- **CSS jest podzielony na moduły w `src/styles/`** i importowany przez entry pointy — nie ma jednego `style.css`. Dzięki temu Vite buduje osobny arkusz per strona (`/short` nie pobiera stylów mapy ani kosztów).
  - `base.css` — reset, tokeny, dark mode, typografia i prymitywy współdzielone (`.page`, `.section`, `.day-block`, `.block-label`, `.tips-list`, `.footer`). Zawsze pierwszy, reszta na nim polega.
  - `nav.css` (nawigacja, skip-link) · `timeline.css` (plan) · `day.css` (strona dnia) · `map.css` (Leaflet) · `practical.css` (koszty/todo/pogoda) · `gallery.css` (galeria + lightbox) · `short.css` (skrót).
  - Kolejność importów w entry poincie = kolejność kaskady. Dodając regułę, wybierz moduł wg strony, która jej używa; jeśli używają jej ≥2 różne strony — idzie do `base.css`.
- Wspólne moduły JS: `src/html.js` (`esc()` — jedyne escapowanie w projekcie), `src/theme.js` (motyw przed pierwszym malowaniem), `src/site.js` (nav/stopka/todo/reveal).
- Dodatkowe statyczne podstrony (np. `public/audyt.html`) leżą w `public/` i są kopiowane 1:1 do `dist/` — dostępne jako `/toskania/<nazwa>.html`.
- Deploy: push na `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm run build` → GitHub Pages.
- Obrazy: `public/images/*.jpg` to źródła. `scripts/convert-webp.js` (krok `npm run build`) generuje z nich warianty `.webp` w szerokościach 200/400/800 + pełny (max 1600px) i zapisuje `src/image-manifest.json` z ich wymiarami. Atrybucje w `public/images/attribution.json`.
  - `src/image-manifest.json` jest **generowany, ale commitowany** — `render.js` importuje go w czasie budowania, żeby wstawić prawdziwe deskryptory `w` w `srcset` oraz `width`/`height` (rezerwacja miejsca, CLS=0). Po dodaniu/wymianie zdjęcia uruchom `npm run build` i zacommituj zmieniony manifest.
  - `sizes` per kontekst siedzi w `IMAGE_SIZES` (`src/render.js`) i w preloadzie hero (`index.html`) — te dwa muszą pozostać zgodne, inaczej preload pobierze inny wariant niż wybierze `<picture>`.
