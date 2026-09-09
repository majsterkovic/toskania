# Czat: podział router/writer + porządki w modelach (free-only)

Nadbudowuje `2026-09-09-czat-konta-vps-design.md` (dalej: "spec bazowy"). Nie
powtarza tego, co tam już zdecydowane (auth, budżety, deploy) — dotyczy
wyłącznie pętli `server/chat/loop.js`, doboru modeli i zestawu narzędzi.

## Kontekst: dryf między D8 a produkcją

Spec bazowy, decyzja **D8**: "Model główny płatny i tani, darmowy jako
fallback" — uzasadnione tym, że małe/darmowe modele gubią format
function-callingu, a czat toskanii to łańcuch narzędziowy (najgorsze miejsce
na oszczędność).

Rzeczywistość na produkcji (zweryfikowane w rozmowie z userem, nie z
odszyfrowanych sekretów): **primary = `glimmer` (nvidia-muse-glimmer-30b,
darmowy NIM)**, **fallback = `gemma-4-31b-it` (darmowy NIM)** — oba darmowe,
wprost przeciwnie niż D8. Dodatkowo `infra/litellm/config.yaml` jest
nieaktualny wobec TEJ rzeczywistości: brakuje w nim wpisu dla gemmy, a
komentarze przy `nvidia-deepseek-v4-flash-0731` mylnie opisują go jako
dzisiejszy `CHAT_MODEL` toskanii.

**D1 (nadpisuje D8): zostajemy przy free-only.** Powód: budżet — koszt nie
jest tu zmienną do optymalizacji, tylko twardym zerem. Ryzyko z D8 (utrata
formatu function-callingu) adresujemy architekturą (D2-D3) i obsługą błędów
(§4), nie płatnym modelem. D8 w spec bazowym uznać za nieaktualne, zastąpione
tym dokumentem.

## Decyzje

- **D1** — free-only (glimmer primary / gemma fallback), patrz wyżej.
- **D2** — pętla czatu dzieli się na dwie role: **router** (dobiera i woła
  narzędzia, ma dostęp do `tools`) i **writer** (komponuje finalną odpowiedź
  po polsku, bez dostępu do `tools`). Na start obie role korzystają z tej
  samej pary modeli (glimmer/gemma) — który model gra którą rolę ustala się
  empirycznie (D6), nie z góry.
- **D3** — gdy router w danej iteracji zwraca `content` bez `tool_calls`
  (uznaje, że skończył), ten `content` jest **odrzucany**, nigdy nie trafia
  do usera. Writer zawsze komponuje odpowiedź od zera z surowego śladu
  tool_calls/wyników w historii wiadomości. Powód: tekst routera to
  dokładnie ten typ outputu, który u darmowych modeli bywa zanieczyszczony
  (DSML, urwane zdania — precedens: DeepSeek przez OpenRouter, opisany w
  `litellm/config.yaml`) — nie przepuszczamy tego do usera nawet jako
  wstępny szkic.
- **D4** — do zakresu wchodzą też: nowy tool `searchFood` (szuka po
  `day.food.place`/`dishes`/`price`) oraz wstrzyknięcie dzisiejszej daty do
  system promptu (rozwiązuje "co robimy jutro?" bez punktu odniesienia).
- **D5** — odrzucone: generative UI / komponenty renderowane przez agenta
  ("A2UI"). Powód: (a) `src/render.js` + reszta strony już renderuje te same
  dane bogato — duplikacja silnika prezentacji; (b) trzecia niezależna oś
  ryzyka na utratę formatu, obok tool_calls i argumentów narzędzi — dokładnie
  to, co D1/D3 starają się ograniczyć, nie mnożyć; (c) YAGNI — brak
  konkretnego zapotrzebowania, tylko hipoteza. Zamiast tego: gdy odpowiedź
  writera dotyczy konkretnego dnia, dokleja zwykły markdown-link do
  istniejącej strony `/dzien/<n>`.
- **D6** — przypisanie modeli do ról (który z {glimmer, gemma} jako router,
  który jako writer) ustalane empirycznie przez mały eval (§5), nie
  zgadywane z góry.
- **D7** — budżet czasu całej tury: ~18 s (mieści się w oczekiwanych 15-20 s
  z zapasem). Jeden wspólny `TOTAL_TIMEOUT_MS` (bez dzielenia na pod-budżety
  per faza — prostsze, a per-call ceiling już pilnuje `timeout`/
  `stream_timeout` w `litellm/config.yaml`).

## Architektura i przepływ danych

```
user_message
  │
  ▼
[faza ROUTER]  (router_model + tools, max MAX_TOOL_ITERATIONS=5 iteracji)
  pętla: model → tool_calls? → wykonaj narzędzia → wynik do messages → powtórz
  aż model nie zwróci tool_calls (jego `content` w tym momencie ODRZUCANY, D3)
  │
  ▼
[faza WRITER]  (writer_model, BEZ tools, jedno wywołanie)
  messages = [user_message, ...ślad tool_calls/wyników z fazy router]
  system prompt: buildWriterSystemPrompt (nowy)
  → finalna odpowiedź do usera (+ ew. link /dzien/<n>)
```

## Komponenty do zmiany

| Plik | Zmiana |
|---|---|
| `server/chat/loop.js` | rozbicie `runChatLoop` na fazę router + fazę writer; `MAX_TOOL_ITERATIONS` dotyczy tylko fazy router; **fix**: `JSON.parse(call.function.arguments || '{}')` (dziś linia 39) owinąć w try/catch — bez tego krzywy JSON od darmowego modelu wywala cały request zamiast zdegradować się do `{error: 'invalid_tool_arguments'}` |
| `server/chat/systemPrompt.js` | split: `buildRouterSystemPrompt` (dzisiejsza treść) + `buildWriterSystemPrompt` (nowy — "sformułuj PO POLSKU na podstawie danych narzędzi poniżej; nic nie zgaduj; jeśli dotyczy dnia, dodaj link `/dzien/<n>`"); oba dostają dzisiejszą datę (D4) |
| `server/chat/llmClient.js` | bez zmian w kształcie (`createLlmClient` już generyczny) — instancjonowany 2x w `server/index.js` (router/writer) |
| `server/index.js` | dwie instancje `createLlmClient`: `routerClient` (`CHAT_MODEL`/`CHAT_MODEL_FALLBACK`, jak dziś) i `writerClient` (`CHAT_MODEL_WRITER`/`CHAT_MODEL_WRITER_FALLBACK`, domyślnie = router's gdy env brak) |
| `server/tools/searchFood.js` **(nowy)** | search po `day.food` (`place`/`dishes`/`price`), rejestrowany w `buildToolRegistry` (`server/tools/index.js`) |
| `infra/litellm/config.yaml` | dodać brakujący `nvidia-gemma-4-31b-it`; poprawić nieaktualne komentarze przy `nvidia-deepseek-v4-flash-0731` (dziś mylnie opisany jako CHAT_MODEL toskanii) |
| `docker-compose.yml` (toskania) + `infra/secrets.toskania.enc.yaml` | nowe opcjonalne `TOSKANIA_CHAT_MODEL_WRITER` / `_WRITER_FALLBACK` |
| `2026-09-09-czat-konta-vps-design.md` | dopisek przy D8: nadpisane przez ten dokument (D1) |

## Obsługa błędów

- **Router**: patrz fix `JSON.parse` wyżej — narzędzie z krzywymi argumentami
  zwraca błąd do modelu (`{error: 'invalid_tool_arguments'}`) zamiast crashować
  request.
- **Writer**: korzysta z istniejącego mechanizmu primary/fallback wewnątrz
  `llmClient.chat` (już 2 próby). Jeśli obie zawiodą: fallback na ostatni
  `content` routera, jeśli jakikolwiek istnieje (lepsze niż nic, mimo D3 —
  D3 dotyczy normalnej ścieżki, nie awaryjnej). Gdy i tego brak — dzisiejszy
  `assistant_unavailable`.

## Testing / rollout (D6)

Przed usztywnieniem przypisania modeli do ról: mały eval, 4 reprezentatywne
prompty (proste pytanie/1 tool; złożone/2+ tooli; pytanie bez pokrycia w
danych; pytanie względne "jutro") odpalone przez obie kombinacje
(glimmer-router+gemma-writer vs. odwrotnie) na żywym NIM. Kryteria: router
poprawnie emituje `tool_calls` (nie surowy tekst/DSML); writer daje
gramatyczną polską prozę bez halucynacji. Wynik rozstrzyga `CHAT_MODEL`/
`CHAT_MODEL_WRITER` w sekretach.

Istniejące `server/chat/loop.test.js` i `loop.e2e.js` wymagają aktualizacji
pod nową dwufazową strukturę (asercje na to, że writer nie dostaje `tools`,
że content routera z ostatniej iteracji nie przecieka do odpowiedzi).

## Poza zakresem (odrzucone / odłożone)

- **A2UI / generative UI** — odrzucone, patrz D5.
- **Redundancja jakości** (oba modele odpowiadają równolegle, wybór
  lepszej odpowiedzi) — odrzucone na etapie wyboru podejść: kupuje jakość
  kosztem 2x wywołań bez twardej gwarancji poprawy, przy już ciasnym
  budżecie czasu (D7).
- **Warunkowy writer** ("polish pass" tylko gdy heurystyka wykryje problem)
  — odrzucone: wprowadza kruchą heurystykę do strojenia i nie daje twardej
  gwarancji rozdziału ról, którą D2/D3 mają zapewnić.
- **Powrót do płatnego primary** (odwrócenie D1) — odłożone; jeśli eval
  (§5) pokaże, że oba darmowe modele realnie gubią `tool_calls` mimo
  podziału ról, to pierwszy kandydat do rewizji tego spec.
