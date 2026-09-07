# Spec: VPS + framework wycieczkowy + asystent AI / MCP

Data: 2026-09-06
Status: projekt do decyzji użytkownika
Kontekst: wyjazd 12–27.09.2026 — do powrotu obowiązuje **freeze migracyjny** (faza 0 w planie).

## 1. Cel

Z repo „strona jednej wycieczki" zrobić **framework**: każda przyszła wycieczka to dane
(`trip.json` + zdjęcia + notatki), a silnik (render, mapy, koszty, todo, czat AI, MCP)
jest współdzielony. Przy okazji przenieść hosting z GitHub Pages na własny VPS,
żeby mieć backend pod asystenta AI — **bez utraty prostoty statycznego frontendu**.

## 2. Stan obecny (inwentaryzacja 2026-09-06)

- Vite 6 MPA, 6 entry (`index`, `short`, `mapa`, `galeria`, `praktyczne`, `packing`),
  `base: '/toskania/'`, build `node scripts/convert-webp.js && vite build` → `dist/`.
- Deploy: push na `main` → GitHub Actions → GitHub Pages. Zero backendu, zero sekretów.
- Dane: `plan_2bazy.json` (~246 KB, 16 dni) + `src/image-manifest.json` (generowany,
  commitowany) + `public/images/*` + `notes/` (obsidian, nie część strony).
- Silnik teraz spleciony z treścią: `src/render.js` (~900+ linii) importuje plan wprost,
  `IMAGE_SIZES` + preload hero w `index.html` muszą być zgodne ręcznie, `src/weather.js`
  ma zaszyte współrzędne baz.
- Podstrony statyczne w `public/` kopiowane 1:1 do `dist/`.

## 3. Cele / non-goals

**Cele:**
1. Statyczny frontend dalej budowany Vite i serwowany jak dziś (szybki, tani, odporny).
2. VPS serwuje statyki + dwa endpointy backendowe: `/api/chat` (asystent na stronie)
   i `/mcp` (serwer MCP dla zewnętrznych asystentów).
3. Jeden schemat `trip.json v1` + walidator; Toskania 2026 staje się `trips/toskania-2026/`.
4. Silnik (`trip-engine/`) bez hardkodu Toskanii; CLI/scaffold nowej wycieczki.
5. GitHub Pages zostaje jako mirror/rollback minimum do końca 2026.

**Non-goals:**
- Brak kont użytkowników, komentarzy, edycji planu z poziomu strony (read-only + czat).
- Brak bazy danych i wektorowej (kontekst = JSON dnia, ~5–15 KB — wystarcza wprost w prompcie).
- Brak ładnych URL-i per dzień poza tym, co jest (hash zostaje).
- Brak PWA/offline w pierwszej iteracji (osobny spec, wyższy priorytet przed kolejnym wyjazdem niż część AI).

## 4. Architektura docelowa

```
trips/toskania-2026/          dane: trip.json, images/, notes/ (submoduł lub katalog)
trip-engine/                  silnik: render, maps, styles, site chrome, chat widget
  src/  styles/  scaffold/    + `trip.config.js` (tytuł, base path, motyw, IMAGE_SIZES)
server/                       backend (Node, 1 serwis):
  /api/chat  → proxy do dostawcy LLM, kontekst z trip.json + notes
  /mcp       → Streamable HTTP MCP, te same narzędzia co czat (read-only)
  /healthz   → healthcheck pod monitoring
Caddy na VPS: TLS auto (Let's Encrypt), reverse proxy, statyki z /srv/www/<trip>/
```

Zasada: **jeden parser trip.json używany przez render (build), chat (runtime) i MCP.**
Trzy drobne implementacje tego samego kontraktu to proszenie się o rozjazd.

## 5. Komponenty

### 5.1 Hosting / VPS
- Caddy jako front (TLS, gzip/zstd, cache statyków, security headers).
- Deploy: GitHub Actions po `npm run build` wysyła `dist/` na VPS (rsync przez SSH,
  klucz w GitHub Secrets) do `/srv/www/<trip>/releases/<sha>` + atomowy symlink `current`.
  Rollback = przepięcie symlinka (1 komenda, udokumentowana).
- Co najmniej: `robots.txt`, nagłówki cache (hashed assets immutable, `index.html` no-cache),
  backup `trip.json` + zdjęć (VPS → B2/S3 lub pull na domowy NAS, cron tygodniowy).
- Monitoring minimum: Uptime Kuma lub cron + `/healthz` (ostatni deploy, wersja danych).

### 5.2 Schemat `trip.json v1`
- Wydzielić z `plan_2bazy.json`: `meta`, `bases[]`, `transit_stops`, `days[]`,
  `costs`, `todo`, `practical` (dziś brak — rozproszone po dniach; scalić).
- Walidator w buildzie (skrypt node, failuje CI): wymagane `coords` baz i atrakcji
  mapowanych, `drive_min` albo jawny `null` z powodem (pociąg), spójność
  `base_id`/`next_base_id`, zgodność `IMAGE_SIZES` z manifestem.
- Wersjonowanie: `schema_version: 1`; migracje skryptem przy zmianie schematu.

### 5.3 Silnik `trip-engine/`
- Z `render.js`/`maps.js`/`site.js`/`theme.js`/`html.js` wydzielić API:
  `renderTimeline(trip)`, `renderDay(trip, n)`, `initBaseMaps(trip)`, `renderPractical(trip)`,
  widget czatu jako osobny entry (ładowany leniwie, nie blokuje pierwszego malowania).
- Theming per trip: `trip.config.js` (nazwa, base path, kolory faz, `IMAGE_SIZES`, preload hero).
- Style: zachować podział `src/styles/*.css`, reguła „≥2 strony = base.css" zostaje.
- Scaffold: `npm run new-trip -- <nazwa>` kopiuje szkielet (przykładowy 1 dzień, puste koszty/todo).

### 5.4 Backend `/api/chat` (MVP)
- `POST /api/chat { trip, day?, messages[] }` → system prompt: „odpowiadasz wyłącznie
  na podstawie trip.json + notes; daty/godziny/ceny tylko z danych; jak nie ma w danych —
  mów wprost". Dołączany kontekst: dzień bieżący (lub cała oś dla pytań ogólnych).
- Auth: stały token wycieczki w nagłówku (losowany, w env na VPS + wstrzyknięty do buildu
  danej wycieczki jako publiczny „klucz gościa" — akceptowalne, bo dane i tak publiczne;
  token chroni przed cudzymi rachunkami za LLM, nie przed odczytem).
- Limity: max N wiadomości/min na IP, cap tokenów odpowiedzi, timeout 30 s, brak historii
  po stronie serwera (historię trzyma localStorage w przeglądarce).
- Model: tani/mały, konfigurowalny env (`CHAT_MODEL`); fallback: czytelny błąd zamiast halucynacji.
- Koszt: przy takim użyciu grosze/miesiąc; alert przy przekroczeniu progu w panelu dostawcy.

### 5.5 Serwer MCP (read-only)
- Transporty: **stdio** (lokalnie, do Claude Code/Desktop — zero wystawiania do sieci)
  i **Streamable HTTP** na VPS pod `/mcp` (telefon, współdzielenie).
- Narzędzia (kontrakt wspólny z czatem): `list_days`, `get_day`, `get_bases`,
  `get_transit`, `get_costs`, `get_todo`, `search_notes`.
- Auth dla HTTP: bearer token (osobny od czatu), tylko odczyt, logowanie wywołań.
- Jeden kod narzędzi (`server/trip-tools.js`) importowany przez chat i MCP.

### 5.6 PWA/offline (poza MVP, ale przed kolejnym wyjazdem)
- Service worker: app-shell + trip.json + zdjęcia dnia offline; mapy Leaflet z pakietem
  kafelków na dni bez zasięgu (Garfagnana!). To realnie ważniejsze w trasie niż czat.

## 6. Bezpieczeństwo i prywatność
- Sekrety (klucz LLM, token MCP) wyłącznie w env na VPS — nigdy w repo ani w bundlu.
- Adresy noclegów są w publicznych danych już dziś (Pages) — MCP/czat tego nie zmienia;
  nie dodawać do danych niczego nowego wrażliwego (telefony gospodarzy do notes, nie do JSON).
- CORS: tylko własne domeny; rate-limit na `/api/*` i `/mcp`.

## 7. Kryteria akceptacji
1. `npm run build` + walidator przechodzą; strona Toskanii na VPS identyczna z Pages (diff wizualny).
2. Rollback do poprzedniego release'a < 2 min jedną komendą.
3. Czat odpowiada na „co robimy 19.09?" danymi z D8 (Brolio/Radda), z datą/godziną z JSON.
4. MCP `get_day(8)` zwraca to samo co render dnia 8.
5. Scaffold nowej wycieczki buduje się i deployuje bez zmian w silniku.
6. Pages działa jako mirror do odwołania.

## 8. Otwarte decyzje (do użytkownika)
1. Domena: subdomena na własnej domenie vs nowa domena vs IP + ścieżka?
2. VPS: jaki OS/dostęp (SSH już jest?), Caddy vs Nginx?
3. Dostawca LLM do czatu (preferencje/konto już masz?).
4. Czy `notes/` wchodzą do repo frameworka (publiczne!) czy zostają prywatne (a MCP dostaje kopię)?
5. Drugi trip-przykład do proof of concept — jaki (żeby scaffold nie był teorią)?
