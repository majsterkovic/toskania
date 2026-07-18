# Toskania 2026 — plan wycieczki

Statyczna strona (Vite + Leaflet) prezentująca plan wycieczki samochodowej rodziny 4-osobowej po Toskanii, 12–27.09.2026. Dane trasy/dni/atrakcji żyją w `plan_2bazy.json` (ładowany przez `src/main.js`), renderowane przez `src/render.js` do `#app`.

**Decyzja: wariant 2-bazowy (Barga/Garfagnana → Chianti/Castelnuovo Berardenga) jest jedynym prezentowanym planem.** `plan.json` (stary wariant 3-bazowy) nie jest już importowany ani przełączalny na stronie — historia w git, nie w UI.

## `notes/` — baza referencyjna (nie część strony)

`notes/` to notatki Obsidian-style (`[[wikilinks]]`) budowane na bieżąco jako "second brain" tego projektu — sprawdź je PRZED szukaniem w sieci odległości/czasów dojazdu do nowych miejsc:
- `notes/odleglosci.md` — tabela czasów dojazdu (auto/pociąg) z obu baz do okolicznych miast
- `notes/miejscowosci/*.md` — karta per miejscowość (status: wdrożone / rozważane / raczej odrzucone)
- `notes/decyzje-otwarte.md` — otwarte decyzje czekające na potwierdzenie użytkownika

Aktualizuj te notatki przy każdej nowej analizie feasibility, nie zostawiaj odpowiedzi tylko w rozmowie.

## Struktura strony / deploy

- Główna strona: `index.html` + `src/main.js` (Vite entry), baza `/toskania/` (`vite.config.js`).
- Dodatkowe statyczne podstrony (np. `public/audyt.html`) leżą w `public/` i są kopiowane 1:1 do `dist/` — dostępne jako `/toskania/<nazwa>.html`.
- Deploy: push na `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm run build` → GitHub Pages.
- Obrazy: `public/images/*.jpg` + wygenerowany `.webp` (`scripts/convert-webp.js` w `npm run build`), atrybucje w `public/images/attribution.json`.
