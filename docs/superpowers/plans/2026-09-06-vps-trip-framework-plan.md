# Plan: VPS + framework wycieczkowy + AI/MCP

Data: 2026-09-06 · do speca `2026-09-06-vps-trip-framework.md`
Zasada nadrzędna: **do 28.09 strona na Pages jest zamrożona** (tylko poprawki treści
planu, jak powrót przez Fischbachau). Zero migracji przed wyjazdem.

## Faza 0 — freeze (06–28.09, w trakcie wyjazdu) · effort 0
- Dozwolone: content fixes w `plan_2bazy.json`, deploy na Pages jak dziś.
- Zabronione: zmiana hostingu, backend, refaktory silnika.
- Po powrocie: przegląd „co bolało w trasie" (offline? zasięg? czego brakowało na stronie?)
  → ewentualna korekta priorytetów faz 1–4.

## Faza 1 — VPS ląduje obok, Pages nietknięte · M
1. Caddy na VPS (TLS, statyki z `/srv/www/toskania/`, `/healthz`). [S]
2. Workflow deploy równoległy: Pages jak dziś + rsync `dist/` → VPS releases + symlink. [M]
3. Parzystość wizualna VPS vs Pages (screenshot-diff 6 stron). [S]
4. Backup cron (trip.json + images) + notatka rollback (1 komenda). [S]
- Ryzyko: brak — Pages dalej produkcją. Sukces = adres na VPS działa identycznie.

## Faza 2 — asystent AI (MVP) · M/L
1. `server/` (Node): `POST /api/chat` + system prompt + kontekst z trip.json. [M]
2. Widget czatu (leniwy entry, osobny chunk, timeout + fallback bez sieci). [M]
3. Token wycieczki + rate-limit + cap tokenów; Caddy proxy `/api/*`. [S]
4. Testy: 10 pytań kontrolnych (daty/godziny/ceny z JSON — zero halucynacji). [S]
- Ryzyko: koszty LLM (mitygacja: cap + alert), jakość odpowiedzi (mitygacja: testy).

## Faza 3 — MCP (read-only) · S/M
1. `server/trip-tools.js`: 7 narzędzi na wspólnym kontrakcie z czatem. [M]
2. Transport stdio (lokalnie, Claude Code) + Streamable HTTP `/mcp` (VPS, bearer). [S]
3. Parzystość: `get_day(n)` == render dnia n (test automatyczny). [S]
- Ryzyko: brak (addytywne, nie tyka strony).

## Faza 4 — ekstrakcja frameworka · L
1. `trip.json v1` schema + walidator w buildzie (failuje CI). [M]
2. `trips/toskania-2026/` (dane) + `trip-engine/` (silnik) + `trip.config.js`. [L]
3. `npm run new-trip` scaffold + drugi przykładowy trip jako proof (bez niego framework to teoria). [M]
4. Przeniesienie `weather.js` coords i `IMAGE_SIZES`/preloadu do configu (koniec ręcznej zgodności). [S]
- Ryzyko: największy refaktor; mitygacja: Toskania buduje się bit-identycznie przed/po.

## Faza 5 — cutover (opcjonalnie, najwcześniej po fazie 4) · S
1. DNS na VPS, Pages zostaje jako mirror + rollback. [S]
2. Uptime monitoring + alerty. [S]
- W każdej chwili możliwy powrót na Pages (statyki!).

## Kolejność sugerowana
0 → 1 → 3 → 2 → 4 → 5 (MCP przed czatem: narzędzia powstają raz, czat je reużywa;
PWA/offline osobnym specem, przed kolejnym wyjazdem).

## Szacunek całości
~3–5 wieczorów (S≈1–2 h, M≈3–5 h, L≈6–10 h), bez pośpiechu między wyjazdami.
Pierwszy krok po powrocie: decyzje z pkt 8 speca (domena, VPS, LLM, notes, trip-002).
