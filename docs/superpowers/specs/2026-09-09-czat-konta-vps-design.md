# Spec: czat z planem, dostęp dla uczestników, hosting na `toskania.hybiak.eu`

Data: 2026-09-09
Status: projekt do akceptacji
Zastępuje: `2026-09-06-vps-trip-framework.md` wraz z planem — **usunięty** w tym samym
commicie, bo opisywał infrastrukturę, której nie mamy (Caddy, rsync, `/srv/www`, symlinki
release'ów) i wykluczał to, czego dziś chcemy (czat, bazę danych). Historia zostaje
w gicie, commit `f48d819`. Wszystko, co z tamtego dokumentu nadal obowiązuje, przeniesione
tutaj: zasada jednej implementacji kontraktu (§4), 10 pytań kontrolnych (§12), uwaga
o priorytecie PWA (§13) i roadmapa frameworka (§17).
Buduje na: [`2026-09-07-trip-content-engine-split-design.md`](2026-09-07-trip-content-engine-split-design.md) — **zrealizowany**
(`trip.json` + `trip.config.js` + `src/trip.js` są w `main`).

> **Freeze.** Do 28.09 obowiązuje zakaz migracji: dozwolone są wyłącznie poprawki treści
> planu i deploy na Pages jak dziś. Ten dokument jest projektem, nie wdrożeniem — pisanie
> speca freeze'u nie narusza. Implementacja startuje po powrocie. Użytkownik świadomie
> zrezygnował z gotowości na 12.09: na wyjazd jedzie strona na Pages plus Hermes czytający
> repo, tak jak dziś. Pierwszy krok po powrocie: przegląd „co bolało w trasie" — czego
> realnie brakowało na stronie, czy problemem był zasięg, czy wiedza. To może przestawić
> kolejność plastrów i jest tańsze niż zgadywanie teraz.

## 1. Cel

Dać **pięciorgu uczestnikom wycieczki** czat, który odpowiada na pytania o plan
na podstawie `trip.json`, dostępny z telefonu pod jednym adresem, bez Claude Code
i bez Telegrama. Przy okazji przenieść hosting z GitHub Pages na VPS, bo czat
za bramką wymaga backendu i jednego originu.

Powód wyjściowy: autor planował i odpytywał wycieczkę przez Claude Code. W trasie
ma tylko telefon. Hermes na Telegramie rozwiązuje to **dla jednej osoby** — reszta
grupy nie ma żadnej drogi do tej wiedzy.

## 2. Stan wyjściowy (2026-09-09)

- `toskania`: Vite 6, MPA, `base: '/toskania/'`, deploy push na `main` → Actions → Pages.
- Treść: `trip.json` (276 KB, 5018 linii, `schema_version: 1`, 16 dni, 61 punktów
  z koordynatami), `trip.config.js`, walidator `scripts/validate-trip.js` w buildzie.
- Jeden konsument danych: `src/trip.js` (3 linijki, `import trip from '../trip.json'`).
- `src/maps.js:90` woła **publiczny serwer demo** `router.project-osrm.org`
  z przeglądarki, wynik cache'owany w `localStorage` (`osrm_v3_`).
- Kafelki: `tile.openstreetmap.de`, bez klucza.
- VPS: Hetzner CX33 (4 vCPU, 8 GB RAM), repo `infra` = źródło prawdy dla compose
  i ingressu. Działają: `cloudflared`, `hermes`, `litellm`, `searxng`, `karpacz`,
  `beszel`, `gieldowo` (`gateway`/`backend`/`portfolio`).
- `toskania` jest w `infra/repos.txt` — sklonowane na VPS, montowane `:ro` do Hermesa.
- `notes/grupa-prywatne.md` jest w `.gitignore`, więc fizycznie nie trafia na VPS.

## 3. Decyzje (rozstrzygnięte, z uzasadnieniem)

| # | Decyzja | Uzasadnienie |
|---|---|---|
| D1 | Backend w **Node** (Fastify), nie FastAPI | `trip.json` i jego walidator już żyją w Node; backend w Pythonie rozdzieliłby schemat na dwa języki, a to duplikacja, która rozjeżdża się cicho. LiteLLM to proxy zgodne z OpenAI, więc język nie ma znaczenia dla integracji z LLM. |
| D2 | **Function calling**, nie RAG | Plan jest mały i strukturalny (16 dni, 61 punktów). Spis treści mieści się w prompcie systemowym, getter dowozi resztę. Embedding gubi to, że „dzień 5 *jest* dniem 5" — przy pytaniu o czwartek getter po dacie jest dokładny, podobieństwo tylko prawdopodobne. |
| D3 | Narzędzia jako **czyste funkcje**; MCP to cienki adapter, nie fundament | Przy jednym kliencie (własny czat) MCP byłby protokołem i granicą procesu tam, gdzie wystarcza wywołanie funkcji. Adapter (~30 linii) zostawia otwartą drogę dla Hermesa i Claude Desktop bez przepisywania czegokolwiek, a testy piszemy na funkcjach — milisekundy zamiast handshake'u. |
| D4 | Plan **read-only**, źródłem prawdy zostaje git | Walidator z builda dalej rządzi, strona i baza nie mogą się rozjechać. Baza trzyma wyłącznie warstwę osobistą. |
| D5 | **Jedno wspólne hasło** na bramce + **zadeklarowana tożsamość** (wybór imienia z listy) | Plan nie jest tajemnicą, więc bramka broni budżetu LLM przed obcymi, a nie treści przed grupą. Skoro nikt z piątki nie ma motywu podszywać się pod teścia, uwierzytelnienie i tożsamość można rozdzielić: jeden łatwy sekret na wejściu, imię wybierane samodzielnie. Limit per osoba i personalizacja zostają. Kluczowe: odzyskanie dostępu (wyczyszczone ciasteczka, nowy telefon) nie wymaga administratora — wystarczy wpisać to samo słowo. |
| D6 | **Jeden origin** na `toskania.hybiak.eu`, bez mirrora na Pages | Ciasteczko sesyjne `SameSite=Lax` bez CORS-a, bez preflightów, bez ITP w Safari. Logowanie robi się nudne, a nudne to dobrze. |
| D7 | **Macierz odległości liczona przy buildzie** | `router.project-osrm.org` to serwer demo bez SLA. Z przeglądarki ruch rozkłada się na wiele IP; z backendu zbiega się w jedno IP datacenter i prosi o throttling — akurat wtedy, gdy jesteś w trasie. Prekalkulacja przenosi awarię z Toskanii do CI. |
| D8 | Model główny **płatny i tani**, darmowy jako fallback | `docs/08-routing-llm.md` w `vps-as-a-code`: małe/darmowe modele gubią format function-calling i agent się zacina. Nasz czat jest łańcuchem narzędziowym, więc to najgorsze miejsce na oszczędność. Przy limitach per osoba sufit kosztu jest twardy. |
| D9 | Wzorzec deployu **`karpacz`/`gieldowo`**, nie Caddy | Spec z 06.09 zakładał Caddy + rsync + symlink release'ów. Realna infrastruktura to Cloudflare Tunnel (TLS terminuje Cloudflare), obraz w GHCR i `docker compose` sterowany z repo `infra`. Caddy byłby trzecim frontem przed dwoma istniejącymi. |

**Odrzucone warianty logowania** (D5), żeby nie wracały:

- *Konta na sztywno w repo* — `majsterkovic/toskania` jest **publiczne**, a dodatkowo
  figuruje w `infra/repos.txt`, więc jest sklonowane na VPS i czytelne dla Hermesa
  osiągalnego z Telegrama. Hasło w tym repo to hasło opublikowane.
- *Jednorazowe linki zapraszające* — link kliknięty w Messengerze otwiera się
  w przeglądarce wbudowanej w komunikator; ciasteczko zostaje w jej piaskownicy,
  a token jest już zużyty. Osoba otwiera stronę w Chrome i nie jest zalogowana.
  Awaria jest cicha, a naprawić ją może tylko administrator — z telefonu, w trasie.
- *Rejestracja mailem* — wysyłka poczty to osobna usługa, nowy sekret, SPF/DKIM
  i problem dostarczalności. Link logowania w spamie jest gorszy niż brak logowania.
- *Sign in with Google* — wymaga projektu w Google Cloud (darmowego, ale jednak),
  zwraca `client_secret` do SOPS, wymusza konto Google u każdego uczestnika,
  a w trybie „Testing" grozi ekranem „Google nie zweryfikowało tej aplikacji" —
  najbardziej odstraszającym elementem całej trójki dla osoby nietechnicznej.

## 4. Architektura

```
toskania.hybiak.eu  (cloudflared → kontener `toskania` w sieci `edge`, bez portów na hoście)
  │
  ├─ /                     statyk z `dist/` (Vite build, base '/')
  ├─ /api/auth/gate        wspólne hasło → krótkie cookie `gate` (15 min)
  ├─ /api/auth/who         GET: lista imion (za bramką) · POST: wybór → sesja 90 dni
  ├─ /api/chat             SSE, pętla function-calling → LiteLLM
  ├─ /api/me               profil + stan limitu
  └─ /healthz              healthcheck pod beszel

server/                    Fastify (Node 22)
  ├─ tools/                CZYSTE FUNKCJE — jedyne miejsce, gdzie żyje logika planu
  │    get_day, list_days, search_plan, route, opening_hours, costs, packing, todo
  ├─ chat/                 pętla narzędziowa + prompt systemowy + routing modelu
  ├─ auth/                 sesje, hashowanie, limity
  ├─ db/                   SQLite (better-sqlite3), migracje
  └─ mcp/                  (plaster 4, opcjonalny) adapter tych samych funkcji po MCP

src/                       silnik frontendu bez zmian + nowy leniwy entry `chat`
trip.json                  ŹRÓDŁO PRAWDY, read-only w runtime
src/distance-matrix.json   GENEROWANY, COMMITOWANY (wzorem `image-manifest.json`)
```

Zasada nieprzekraczalna: **jedna implementacja kontraktu `trip.json`.** Render (build),
czat (runtime) i MCP (opcjonalnie) korzystają z tych samych funkcji z `server/tools/`.
Trzy drobne implementacje tego samego kontraktu to proszenie się o rozjazd — ta zasada
przechodzi ze speca z 06.09 bez zmian i jest jedynym powodem, dla którego D1 wypadło na Node.

## 5. Warstwa narzędzi (`server/tools/`)

Sygnatury są kontraktem — czat i MCP widzą dokładnie to samo.

| Funkcja | Wejście | Wyjście | Uwagi |
|---|---|---|---|
| `listDays()` | — | 16 × `{day_num, date, label, title, base_id, summary}` | ~2 KB, idzie do promptu systemowego jako spis treści |
| `getDay(n \| date)` | numer albo data ISO | pełny obiekt dnia (~7–11 KB) | akceptuje „czwartek" po stronie promptu, nie funkcji |
| `searchPlan(query)` | fraza | trafienia z `day_num` i ścieżką pola | proste dopasowanie tekstowe, bez embeddingów (D2) |
| `route(from, to)` | nazwy punktów albo koordynaty | `{km, min, source}` | najpierw macierz; `source: 'live'` tylko dla punktów spoza planu |
| `openingHours(place, date)` | nazwa + data | godziny z `opening_hours` dnia | zwraca `null` zamiast zgadywać |
| `costs()` | — | `costs` z `trip.json` | |
| `todo()` / `packing()` | — | listy z `trip.json` | w plastrze 5 wzbogacone o stan per osoba |

**Kontrakt braku danych:** każda funkcja zwraca `null`/pustą listę zamiast przybliżenia.
Prompt systemowy mówi wprost: „jeśli narzędzie nie ma danych, powiedz że nie ma".
To jest główna obrona przed halucynowaniem godzin otwarcia i cen.

## 6. Macierz odległości

Nowy `scripts/build-distance-matrix.js`, uruchamiany w `npm run build` przed `vite build`:

1. Zbiera wszystkie punkty z koordynatami z `trip.json` (dziś 61).
2. **Jedno** żądanie do `router.project-osrm.org/table/v1/driving/...`
   (serwer demo przyjmuje zwykle do 100 lokalizacji — 61 mieści się z zapasem).
3. Zapisuje `src/distance-matrix.json`: `{ points: [...], durations: [[...]], distances: [[...]] }`.
4. Plik jest **commitowany**, dokładnie jak `src/image-manifest.json`.

Korzyści poza `route()`: `src/maps.js` może przestać wołać OSRM przy każdym otwarciu
dnia i czytać z macierzy — mniej zależności od cudzego serwera także na froncie.

**Degradacja:** jeśli OSRM nie odpowie przy buildzie, skrypt zostawia poprzednią wersję
pliku i wypisuje ostrzeżenie. Build nie może paść przez cudzy serwer demo; walidator
`trip.json` to inna sprawa i **musi** failować CI.

## 7. Model danych — SQLite

Plik na bind mouncie `~/toskania-data/app.db` (wzorem `~/hermes-data`), tworzony przez
deploy przed `up -d`, żeby Docker nie założył go jako root.

```sql
users     (id, display_name, daily_token_budget, created_at)               -- UNIQUE(display_name)
sessions  (id, user_id, expires_at, user_agent, created_at)
messages  (id, user_id, conversation_id, role, content, tool_calls_json, created_at)
usage     (id, user_id, day, prompt_tokens, completion_tokens, requests)   -- UNIQUE(user_id, day)
checks    (user_id, item_key, checked_at)                                  -- plaster 5
```

- **Brak `login` i `password_hash`.** Jedyny sekret to wspólne hasło bramki i żyje
  w env (SOPS), nigdy w bazie. Nie ma czego wykraść ani resetować.
- `users` **startuje pusta i zapełnia się sama**: po przejściu bramki widać listę
  istniejących imion oraz pole „to ktoś nowy". Dopisanie osoby nie wymaga skryptu,
  sekretu ani deployu — a imiona uczestników nie trafiają do publicznego repo.
- `messages` służy historii i debugowaniu jakości odpowiedzi. Retencja: 90 dni, cron.
- `usage` jest źródłem prawdy dla limitu; sprawdzane **przed** wywołaniem LLM.

## 8. Pętla czatu

```
POST /api/chat  { conversation_id?, message }   → SSE
  1. sesja z ciasteczka → user_id            (401, jeśli brak)
  2. limit dzienny z `usage`                 (429 z czytelnym komunikatem, jeśli przekroczony)
  3. prompt systemowy = reguły + listDays()  (~2 KB, stały)
  4. historia rozmowy z `messages`           (ostatnie N tur, przycinane po tokenach)
  5. pętla: model → tool_calls → wykonaj funkcje → wynik → model  (max 5 iteracji)
  6. stream tokenów do przeglądarki, zapis do `messages`, dopisanie do `usage`
```

- **Model:** `CHAT_MODEL` ze zmiennej środowiskowej (zasada z `08-routing-llm.md` — po
  deprecacji `deepseek-chat` w lipcu nazwa modelu nigdy nie wchodzi do kodu).
  Domyślnie `deepseek-v4-flash` przez LiteLLM. Fallback `CHAT_MODEL_FALLBACK` przy
  402/429/5xx — z jawną informacją w UI, że odpowiada model zapasowy.
- **Limit iteracji 5** chroni przed pętlą narzędziową, w której model woła `getDay`
  w kółko. Po przekroczeniu: odpowiedź częściowa plus komunikat, nigdy cisza.
- **Timeout 30 s** na całe żądanie, 15 s na pojedyncze wywołanie LLM.

## 9. Bramka, tożsamość, sesje, limity

**Bramka obejmuje wyłącznie `/api/chat` i `/api/auth/who`.** Strona z planem zostaje
publiczna, tak jak dziś na Pages — chronimy budżet LLM, nie treść (D5). Osoba bez hasła
widzi pełny plan i zamknięty widget czatu; to również warunek kryterium 4 (§15), gdzie
plan ma działać, gdy czat nie działa.

Dwa kroki, bo sama lista imion jest już informacją i ma siedzieć za bramką.

1. `POST /api/auth/gate {passphrase}` — porównanie w **stałym czasie** z `CHAT_PASSPHRASE`.
   Sukces daje krótkie (15 min) ciasteczko `gate`.
2. `GET /api/auth/who` (wymaga `gate`) — lista `display_name` z `users`.
3. `POST /api/auth/who {user_id}` albo `{new_name}` — zakłada wiersz, jeśli trzeba,
   i wymienia `gate` na sesję: `HttpOnly; Secure; SameSite=Lax`, **90 dni**.

- **Hasło nie może być słowem z domeny.** `toskania` to pierwsze zgadnięcie. Trzy człony,
  np. `oliwa-cyprys-42`; wpisywane raz na 90 dni, więc długość nie uwiera.
- **Rate limit bramki: 5 prób / 15 min / IP.** To jedyna realna obrona przed zgadywaniem
  wspólnego hasła. **Uwaga: za Cloudflare Tunnel `req.ip` to adres `cloudflared`,
  nie klienta** — bez czytania `CF-Connecting-IP` jedna osoba myląca hasło zablokuje
  całą grupę. To pułapka, nie detal.
- Tożsamość jest **zadeklarowana, nie uwierzytelniona**: ktoś zza bramki może kliknąć
  cudze imię. Świadome — służy limitowi per osoba i personalizacji, nie ochronie.
- Limit: `daily_token_budget` per użytkownik + **globalny dzienny sufit** na wypadek,
  gdyby limity per osoba zawiodły. Oba w env, oba sprawdzane przed wywołaniem LLM.
- Rate limit czatu `10 żądań / min / sesję` — obrona przed pętlą w kliencie, nie przed człowiekiem.
- **Odebranie dostępu = wymiana hasła**, i dotyka wszystkich naraz. To cena wspólnego
  sekretu (D5). Istniejące sesje wymianę **przeżywają**, więc rotacja nie wyrzuca grupy
  w trasie; żeby wyrzuciła, trzeba wymienić także `SESSION_SECRET`.

## 10. Deploy — wzorzec `karpacz`/`gieldowo`

**W repo `toskania`** (`.github/workflows/deploy.yml`, dziś publikuje na Pages):

1. `npm ci && npm test && npm run build` (walidator `trip.json` failuje CI).
2. `docker build` → `ghcr.io/majsterkovic/toskania:sha-<commit>` **i** `:latest`.
   Obraz: Node 22 alpine, `dist/` skopiowane do obrazu, Fastify serwuje statyk i `/api`.
3. Wyzwolenie deployu `infra` przez `gh workflow run` z PAT-em.
   *Świadome ulepszenie względem `karpacz`,* gdzie ten krok jest ręcznym `workflow_dispatch` —
   push do repo aplikacji nie dotyka `infra`, więc bez tego nowy obraz czeka na przypadek.
4. Publikacja na Pages **zostaje wyłączona** dopiero po zielonym cutoverze (D6),
   nie w tym samym commicie.

**W repo `infra`:**

1. `docker-compose.yml` — nowy serwis wzorem `karpacz`:
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
2. `cloudflared/config.yml` — wpis ingressu **przed** regułą domykającą 404:
   ```yaml
   - hostname: toskania.hybiak.eu
     service: http://toskania:3000
   ```
3. `secrets.toskania.enc.yaml` (SOPS) — trzy pozycje: klucz LiteLLM, sekret sesji,
   wspólne hasło bramki. Żadnych haseł per osoba. Wchodzą przez `environment:`, nie `env_file` — na dysku
   serwera nie ma plaintextu (wzorzec z punktu D roadmapy `vps-as-a-code`).
4. `deploy.yml` — `mkdir -p ~/toskania-data` przed `up -d` (Docker inaczej założy
   katalog jako root) i objęcie nowego pliku sekretów zagnieżdżonym `sops exec-env`.

**DNS:** `*.hybiak.eu` jest już wpięte w tunel (Krok 1.7), więc `toskania.hybiak.eu`
najprawdopodobniej **nie wymaga nowego rekordu** — tak samo jak `karpacz.hybiak.eu`.
Do potwierdzenia przed wdrożeniem, nie zakładać.

**`base` w Vite:** dziś `'/toskania/'` pod Pages, po cutoverze `'/'`. To dotyka
wszystkich URL-i zasobów i preloadu hero w `index.html` — osobny, sprawdzalny krok planu.

## 11. Obsługa błędów

| Sytuacja | Zachowanie |
|---|---|
| LiteLLM nie odpowiada | fallback na `CHAT_MODEL_FALLBACK`; gdy i on padnie — komunikat „asystent niedostępny, plan działa normalnie" |
| Limit dzienny wyczerpany | 429 z informacją, kiedy się odnowi; strona z planem **nie jest** dotknięta |
| Narzędzie nie ma danych | `null` → model mówi wprost, że nie ma; zero zgadywania |
| OSRM padł przy buildzie | ostrzeżenie, poprzednia macierz zostaje, build przechodzi |
| `trip.json` nie przechodzi walidacji | **build failuje**, deploy nie startuje |
| VPS leży | strona z planem też leży — świadoma cena D6; ryzyko przyjęte, mitygacja to monitoring `beszel`, który już działa |

## 12. Testy

- **Narzędzia** (`node --test`, jak dziś): `getDay(8)` zwraca to samo, co render dnia 8;
  `route()` zgadza się z macierzą; `openingHours()` zwraca `null` dla brakujących danych.
- **Walidator**: rozszerzony o obecność i spójność `distance-matrix.json` z `trip.json`.
- **Auth**: złe hasło, wyczerpany rate limit bramki, wygasła sesja, przekroczony limit
  tokenów. Osobno: `POST /api/auth/who` bez ciasteczka `gate` musi dawać 401 — inaczej
  lista imion wycieka przed bramkę.
- **Czat, 10 pytań kontrolnych** (przechodzi ze speca 06.09): daty, godziny i ceny
  muszą pochodzić z JSON-a. To jedyny test, który wymaga żywego LLM-a — oznaczony
  jako e2e, poza rutynowym CI, wzorem `@pytest.mark.e2e` w `gieldowo`.

## 13. Poza zakresem (świadomie)

- Edycja planu z poziomu strony (D4).
- Hasła per osoba, rejestracja, reset, role, uprawnienia (D5).
- Ochrona przed podszyciem się w obrębie grupy — tożsamość jest zadeklarowana (§9).
- RAG, embeddingi, baza wektorowa (D2).
- Self-hosted OSRM — publiczny endpoint plus prekalkulacja wystarczają (D7).
- Integracja z Hermesem — plaster 4, opcjonalny.
- PWA/offline — **osobny spec**. Uwaga ze speca 06.09 zostaje w mocy: w Garfagnanie
  offline jest realnie ważniejsze od czatu. To nie jest część tego dokumentu, ale
  nie powinno zniknąć z radaru.
- `trips/` monorepo, `npm run new-trip`, drugi trip — Faza 4 speca 06.09, nietknięta.

## 14. Plastry

| # | Plaster | Zawartość | Dowozi |
|---|---|---|---|
| 1 | Rdzeń narzędzi | `server/tools/` + `build-distance-matrix.js` + testy + `AGENTS.md` | funkcje z testami, zero HTTP i LLM-a |
| 2 | Backend czatu + tożsamość | Fastify, SQLite, bramka + wybór imienia, limity, pętla LiteLLM | czat działa przez `curl` |
| 3 | Frontend + cutover | widget czatu, `base: '/'`, obraz GHCR, compose, ingress, DNS | uczestnicy realnie korzystają |
| 4 | *(opc.)* Adapter MCP | te same funkcje po MCP | Hermes i Claude Desktop wracają do gry |
| 5 | *(opc.)* Warstwa osobista | `checks` — todo i pakowanie per osoba | personalizacja, po którą była tożsamość |

## 15. Kryteria akceptacji

1. `npm test` i walidator przechodzą; `distance-matrix.json` zgodny z `trip.json`.
2. `toskania.hybiak.eu` serwuje stronę wizualnie identyczną z dzisiejszą wersją z Pages.
3. Piątka uczestników wchodzi wspólnym hasłem, wybiera swoje imię i dostaje odpowiedź na
   „co robimy 19.09?" z danymi z D8 (Chianti, Brolio/Radda) — data i godziny z JSON-a.
4. Przekroczenie limitu daje 429, a strona z planem działa dalej.
5. Awaria LiteLLM nie wywraca strony — czat degraduje się z komunikatem.
6. `docker stats` po wdrożeniu mieści się w `mem_limit: 256m`.

## 16. Do zweryfikowania przed wdrożeniem (nie zakładać)

1. Czy `*.hybiak.eu` faktycznie pokrywa `toskania.hybiak.eu` bez nowego rekordu DNS.
2. Realne zużycie RAM na CX33 (`docker stats`) — czy 256 MB to właściwy limit.
3. Czy `router.project-osrm.org` przyjmuje `/table` dla 61 lokalizacji w jednym żądaniu
   i jaki ma limit — jeśli nie, dzielimy na bloki albo bierzemy OpenRouteService z kluczem.
4. Aktualna nazwa modelu w LiteLLM (`docs/08-routing-llm.md` oznacza ten obszar
   jako „⚠️ do weryfikacji" — nazwy modeli zmieniają się szybciej niż dokumentacja).
5. Czy repo `toskania` ma zostać publiczne po cutoverze (dziś jest, bo Pages).
   Publiczny obraz w GHCR = deploy bez `docker login`, wzorem `karpacz`.
6. Czy `CF-Connecting-IP` dociera przez tunel do kontenera — od tego zależy, czy rate
   limit bramki działa per osoba, czy blokuje całą grupę naraz (§9). Sprawdzić na
   `karpacz`/`gieldowo` **przed** pisaniem limitera, nie po.

## 17. Po tym specu — ekstrakcja frameworka (przeniesione z usuniętego speca 06.09)

Nie jest częścią tego dokumentu i nie dostaje tu planu, ale nie może zniknąć razem
z dokumentem, który kasujemy. Cel: każda przyszła wycieczka to **dane**, a silnik jest
współdzielony. Zakres, gdy przyjdzie na to czas:

1. `trips/toskania-2026/` (dane: `trip.json`, obrazy, notatki) + `trip-engine/` (silnik).
2. `npm run new-trip -- <nazwa>` — scaffold z jednym przykładowym dniem.
3. **Drugi trip jako proof** — bez niego framework pozostaje teorią.
4. Domknięcie hardkodów: współrzędne baz w `src/weather.js` oraz zgodność `IMAGE_SIZES`
   z preloadem hero w `index.html`, dziś pilnowana ręcznie.

Kolejność względem tego speca jest **otwarta**. Argument za frameworkiem najpierw:
czat i narzędzia pisane pod jedną wycieczkę trzeba będzie potem uogólnić. Argument za
czatem najpierw: framework bez drugiej wycieczki jest spekulacją, a czat ma konkretnego
odbiorcę. Rozstrzygnąć po powrocie, razem z przeglądem „co bolało w trasie".
