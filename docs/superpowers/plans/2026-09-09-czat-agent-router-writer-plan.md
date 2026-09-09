# Czat: podział router/writer + porządki w modelach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rozbić `runChatLoop` na dwie fazy — router (dobiera i woła narzędzia) i writer (komponuje finalną polską odpowiedź, bez dostępu do narzędzi) — na free-only modelach (glimmer/gemma przez NVIDIA NIM), dodać `searchFood` i wstrzyknięcie dzisiejszej daty, i naprawić dryf dokumentacji/configu wobec produkcji.

**Architecture:** `server/chat/loop.js` woła `routerClient` w pętli (max 5 iteracji, narzędzia z `toolRegistry`) aż model nie zwróci `tool_calls`; ten moment kończy fazę router, a jego własny `content` jest odrzucany (D3) — nigdy nie trafia do `writerClient`, który dostaje świeżą historię (user message + ślad tool_calls/wyników) i BEZ dostępu do `tools` komponuje jedną, ostateczną odpowiedź. System prompty (`buildRouterSystemPrompt`/`buildWriterSystemPrompt`) są budowane na nowo przy każdym requeście w `server/routes/chat.js`, nie raz przy starcie serwera — żeby wstrzykiwana dzisiejsza data nigdy nie była nieaktualna względem długo działającego kontenera.

**Tech Stack:** Node.js (Fastify), `node --test`, LiteLLM proxy (OpenAI-compatible) → NVIDIA NIM free tier.

**Spec:** `docs/superpowers/specs/2026-09-09-czat-agent-router-writer-design.md`

## Global Constraints

- **D1 — free-only.** Primary = `nvidia-muse-glimmer-30b` (glimmer), fallback = `nvidia-gemma-4-31b-it` (gemma), oba darmowe przez NVIDIA NIM. Żaden task w tym planie nie wprowadza płatnego modelu do automatycznego łańcucha czatu toskanii.
- **D2 — router ma `tools`, writer nigdy.** Każde wywołanie `writerClient.chat(...)` w tym planie ma pominięty drugi argument (`tools`) — nie przekazuj pustej tablicy, pomiń go całkowicie (patrz Task 1, dlaczego to ma znaczenie na żywym API).
- **D3 — content routera z ostatniej iteracji (bez `tool_calls`) jest ODRZUCANY.** Nigdy nie trafia do wiadomości przekazywanych writerowi. Wyjątek: awaryjny fallback, gdy writer sam zawiedzie (§ Obsługa błędów w spec) — to ścieżka błędu, nie normalna.
- **D5 — brak generative UI.** Odpowiedzi to zwykły tekst + opcjonalny markdown-link `[...](#/dzien-<n>)` (hash-route SPA, **nie** `/dzien/<n>`).
- **D7 — budżet czasu całej tury ~18 s.** `TOTAL_TIMEOUT_MS = 18000` w `server/chat/loop.js`, jeden wspólny budżet na całą turę (router + writer), bez podziału na pod-budżety per faza.
- **Standing env constraint:** nie da się tu odszyfrować `infra/secrets.*.enc.yaml` — wszędzie, gdzie plan wymaga nowego sekretu (Task 7), to jest ręczny krok operatora (`sops`), nie coś, co ten plan wykonuje automatycznie.

---

### Task 1: `llmClient.js` — nie wysyłaj `tools`/`tool_choice`, gdy `tools` nie podano

Dziś `callOnce` zawsze wysyła `tool_choice: 'auto'` w body, nawet gdy `tools` jest `undefined`/puste. Większość OpenAI-compatible API (w tym prawdopodobnie NVIDIA NIM) odrzuca `tool_choice` bez `tools` błędem walidacji. Router zawsze przekazuje niepustą listę narzędzi, więc problem nie ujawnił się dotąd — ale writer (Task 4) będzie wołał `chat()` bez żadnych narzędzi, więc to trzeba naprawić najpierw, inaczej faza writer będzie krzyczeć na żywym API mimo zielonych testów jednostkowych z fake-klientami.

**Files:**
- Modify: `server/chat/llmClient.js`
- Test: `server/chat/llmClient.test.js`

**Interfaces:**
- Produces: `createLlmClient({ baseUrl, apiKey, model, fallbackModel }).chat(messages, tools?)` — `tools` teraz opcjonalny; gdy pominięty/pusty, request body nie zawiera kluczy `tools` ani `tool_choice`. Kształt zwrotki (`res.model_used`, `res.choices`, `res.usage`) bez zmian.

- [ ] **Step 1: Dopisz failing test do `server/chat/llmClient.test.js`**

Dodaj na końcu pliku (po istniejących dwóch testach, przed niczym — to ostatni test w pliku):

```js
test('createLlmClient: bez narzędzi (rola writer) nie wysyła tools ani tool_choice w body', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: {} }),
  }));
  const client = createLlmClient({ baseUrl: 'http://litellm:4000/v1', apiKey: 'k', model: 'nvidia-gemma-4-31b-it' });
  await client.chat([{ role: 'user', content: 'hej' }]);
  const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
  assert.equal('tools' in body, false);
  assert.equal('tool_choice' in body, false);
  mock.restoreAll();
});
```

- [ ] **Step 2: Uruchom testy, potwierdź że nowy test PADA**

Run: `node --test server/chat/llmClient.test.js`
Expected: FAIL na nowym teście (`'tools' in body` będzie `true`, bo dziś `tools` zawsze trafia do body jako `undefined`-nie-usunięte... w praktyce `JSON.stringify` usuwa klucze o wartości `undefined`, ale `tool_choice: 'auto'` zawsze jest obecny — asercja na `'tool_choice' in body` PADNIE).

- [ ] **Step 3: Zmień `callOnce` w `server/chat/llmClient.js`**

Cały plik po zmianie:

```js
const CALL_TIMEOUT_MS = 15000;

async function callOnce({ baseUrl, apiKey, model, messages, tools, signal }) {
  const body = { model, messages };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`llm_http_${res.status}`);
  return res.json();
}

async function callWithTimeout(args) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    return await callOnce({ ...args, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function createLlmClient({ baseUrl, apiKey, model, fallbackModel }) {
  return {
    async chat(messages, tools) {
      try {
        const res = await callWithTimeout({ baseUrl, apiKey, model, messages, tools });
        res.model_used = model;
        return res;
      } catch (err) {
        if (!fallbackModel) throw err;
        const res = await callWithTimeout({ baseUrl, apiKey, model: fallbackModel, messages, tools });
        res.model_used = fallbackModel;
        return res;
      }
    },
  };
}
```

- [ ] **Step 4: Uruchom testy, potwierdź że wszystkie przechodzą**

Run: `node --test server/chat/llmClient.test.js`
Expected: PASS (3/3 — dwa istniejące testy wołają `chat(messages, [])`, pusta tablica ma `.length === 0`, więc też pomijają `tools`/`tool_choice`; żaden z nich nie asercjonuje ich obecności, więc nie psują się).

- [ ] **Step 5: Commit**

```bash
git add server/chat/llmClient.js server/chat/llmClient.test.js
git commit -m "fix(chat): nie wysyłaj tool_choice bez tools w llmClient (przygotowanie pod rolę writer)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Nowy tool `searchFood`

**Files:**
- Create: `server/tools/searchFood.js`
- Modify: `server/tools/index.js`
- Test: `server/tools/index.test.js`

**Interfaces:**
- Produces: `searchFoodTool(trip)` → `{ description, parameters, execute({ query }) }`; `execute` zwraca `Array<{ day_num: number, food: object }>`, przeszukując `day.food.place`, `day.food.dishes[]`, `day.food.price` (case-insensitive substring match). Dni bez `food` (falsy) są pomijane, nigdy nie rzuca.
- Consumes: `trip.days[].food` z `trip.json` (kształt: `{ place, address, dishes: string[], note, price, phone?, opening_hours? }` — potwierdzone w `trip.json`, wszystkie 16 dni mają niepuste `food`).

- [ ] **Step 1: Napisz `server/tools/searchFood.js`**

```js
export function searchFoodTool(trip) {
  return {
    description: 'Szuka restauracji/miejsc na jedzenie po nazwie miejsca, potrawie albo cenie. Przeszukuje day.food z trip.json, zwraca dopasowane dni z pełnym opisem jedzenia.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Fraza do wyszukania (np. nazwa restauracji, potrawa, "pizza")' } },
      required: ['query'],
    },
    execute({ query }) {
      const needle = query.toLowerCase();
      return trip.days
        .filter((day) => day.food)
        .filter((day) => {
          const haystack = [
            day.food.place ?? '',
            ...(day.food.dishes ?? []),
            day.food.price ?? '',
          ].join(' ').toLowerCase();
          return haystack.includes(needle);
        })
        .map((day) => ({ day_num: day.day_num, food: day.food }));
    },
  };
}
```

- [ ] **Step 2: Zarejestruj w `server/tools/index.js`**

Cały plik po zmianie:

```js
import { dayNumToIsoDate, isoDateToDayNum } from './dates.js';
import { listDaysTool } from './listDays.js';
import { getDayTool } from './getDay.js';
import { searchPlanTool } from './searchPlan.js';
import { searchFoodTool } from './searchFood.js';
import { routeTool } from './route.js';
import { openingHoursTool } from './openingHours.js';
import { costsTool, todoTool, packingTool } from './costsAndLists.js';

export function buildToolRegistry({ trip, distanceMatrix }) {
  const dateHelpers = { dayNumToIsoDate, isoDateToDayNum };
  return {
    listDays: listDaysTool(trip, dateHelpers),
    getDay: getDayTool(trip, dateHelpers),
    searchPlan: searchPlanTool(trip),
    searchFood: searchFoodTool(trip),
    route: routeTool(distanceMatrix),
    openingHours: openingHoursTool(trip, dateHelpers),
    costs: costsTool(trip),
    todo: todoTool(trip),
    packing: packingTool(trip),
  };
}
```

- [ ] **Step 3: Dodaj `food` do fixture dnia 8 i testy w `server/tools/index.test.js`**

W bloku `days: [...]` w `server/tools/index.test.js`, w obiekcie dnia `day_num: 8` dodaj po `opening_hours: {...}` pole:

```js
      food: {
        place: 'Osteria Il Rifugio del Chianti',
        address: 'Via Roma 6, 53017 Radda in Chianti SI',
        dishes: ['pici al ragù toscano', 'tagliata di manzo'],
        note: 'Lokalna osteria w centrum Raddy.',
        price: '~€18–28/os',
      },
```

Dzień `day_num: 1` zostaw bez pola `food` (celowo — testuje domyślne pomijanie dni bez danych o jedzeniu).

Na końcu pliku, po ostatnim teście (`packing: zwraca packing_list...`), dodaj:

```js

test('searchFood: trafia frazę w nazwie miejsca, zwraca day_num i pełny obiekt food', () => {
  const hits = tools.searchFood.execute({ query: 'Rifugio' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].day_num, 8);
  assert.equal(hits[0].food.place, 'Osteria Il Rifugio del Chianti');
});

test('searchFood: trafia frazę w liście dishes', () => {
  const hits = tools.searchFood.execute({ query: 'tagliata' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].day_num, 8);
});

test('searchFood: dzień bez pola food jest pomijany, nie rzuca', () => {
  const hits = tools.searchFood.execute({ query: 'jazda' });
  assert.deepEqual(hits, []);
});

test('searchFood: brak trafień zwraca pustą listę', () => {
  assert.deepEqual(tools.searchFood.execute({ query: 'sushi' }), []);
});
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `node --test server/tools/index.test.js`
Expected: PASS (wszystkie istniejące + 4 nowe).

- [ ] **Step 5: Commit**

```bash
git add server/tools/searchFood.js server/tools/index.js server/tools/index.test.js
git commit -m "feat(tools): dodaj searchFood (D4)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `systemPrompt.js` — split router/writer + dzisiejsza data

**Files:**
- Modify: `server/chat/systemPrompt.js`
- Modify: `server/chat/systemPrompt.test.js`

**Interfaces:**
- Produces: `todayIso()` → `string` (`YYYY-MM-DD`, `new Date()` w chwili wywołania — celowo bez argumentów, żeby wołający decydował KIEDY ją odczytać; patrz Task 5, dlaczego to musi być per-request, nie raz przy starcie serwera).
- Produces: `buildRouterSystemPrompt({ trip, toolRegistry, today })` → `string`. Zastępuje dzisiejszy `buildSystemPrompt` — ta sama treść + wzmianka o `searchFood` wśród narzędzi + wstrzyknięta `today`.
- Produces: `buildWriterSystemPrompt({ trip, today })` → `string`. Nowa — instruuje pisanie PO POLSKU na podstawie wiadomości `role: 'tool'` w historii, zakaz zgadywania, zasada dokładania linku `#/dzien-<n>` (D5) gdy odpowiedź dotyczy konkretnego dnia. Nie wspomina o narzędziach (writer ich nie ma, D2).
- Consumes: `toolRegistry.listDays.execute()` (bez zmian względem dzisiejszego `buildSystemPrompt`).

- [ ] **Step 1: Zastąp `server/chat/systemPrompt.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from './systemPrompt.js';
import { buildToolRegistry } from '../tools/index.js';

const trip = {
  meta: { start_date: '2026-09-12' },
  days: [{ day_num: 1, title: 'Dojazd', label: 'DZIEŃ 1', base_id: null, summary: 'Jazda.' }],
};
const distanceMatrix = { points: [], durations: [], distances: [] };

test('buildRouterSystemPrompt: zawiera regułę "nie zgaduj", spis dni i dzisiejszą datę', () => {
  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const prompt = buildRouterSystemPrompt({ trip, toolRegistry, today: '2026-09-15' });
  assert.match(prompt, /nie ma danych/);
  assert.match(prompt, /Dojazd/);
  assert.match(prompt, /2026-09-15/);
});

test('buildRouterSystemPrompt: wymienia searchFood wśród dostępnych narzędzi', () => {
  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const prompt = buildRouterSystemPrompt({ trip, toolRegistry, today: '2026-09-15' });
  assert.match(prompt, /searchFood/);
});

test('buildWriterSystemPrompt: instruuje pisanie po polsku, link #/dzien-<n> i dzisiejszą datę', () => {
  const prompt = buildWriterSystemPrompt({ trip, today: '2026-09-15' });
  assert.match(prompt, /PO POLSKU/);
  assert.match(prompt, /#\/dzien-<n>/);
  assert.match(prompt, /2026-09-15/);
});

test('todayIso: zwraca datę w formacie YYYY-MM-DD', () => {
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Uruchom testy, potwierdź że PADAJĄ**

Run: `node --test server/chat/systemPrompt.test.js`
Expected: FAIL z `buildRouterSystemPrompt is not a function` (dzisiejszy eksport to `buildSystemPrompt`).

- [ ] **Step 3: Zastąp `server/chat/systemPrompt.js`**

```js
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildRouterSystemPrompt({ trip, toolRegistry, today }) {
  const days = toolRegistry.listDays.execute();
  const toc = days.map((d) => `${d.day_num}. ${d.date} — ${d.title}`).join('\n');
  return `Jesteś asystentem grupy jadącej na wycieczkę do Toskanii (${trip.meta.start_date} – wyjazd).
Dzisiejsza data: ${today}. Używaj jej, gdy user pyta względnie ("jutro", "dzisiaj", "za dwa dni").
Odpowiadasz WYŁĄCZNIE na podstawie danych z narzędzi (getDay, searchPlan, searchFood, route, openingHours, costs, todo, packing).
Jeśli narzędzie nie ma danych (null albo pusta lista), powiedz wprost że nie masz tej informacji — nigdy nie zgaduj godzin otwarcia ani cen.
Spis dni:
${toc}`;
}

export function buildWriterSystemPrompt({ trip, today }) {
  return `Jesteś asystentem grupy jadącej na wycieczkę do Toskanii (${trip.meta.start_date} – wyjazd). Dzisiejsza data: ${today}.
Twoje jedyne zadanie: sformułuj PO POLSKU finalną odpowiedź na podstawie danych narzędzi widocznych w historii rozmowy (wiadomości z rolą "tool"). Nie masz dostępu do żadnych narzędzi — nie próbuj ich wołać.
Nic nie zgaduj: jeśli w historii nie ma danych na dany temat, powiedz wprost że ich nie masz.
Jeśli odpowiedź dotyczy konkretnego dnia wycieczki, dołącz na końcu link w formacie markdown do strony tego dnia: [Zobacz dzień <n>](#/dzien-<n>).`;
}
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `node --test server/chat/systemPrompt.test.js`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add server/chat/systemPrompt.js server/chat/systemPrompt.test.js
git commit -m "feat(chat): split systemPrompt na router/writer + wstrzyknięcie dzisiejszej daty (D2, D4)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `loop.js` — dwufazowa pętla router/writer

**Files:**
- Modify: `server/chat/loop.js`
- Test: `server/chat/loop.test.js` (pełne zastąpienie)

**Interfaces:**
- Consumes: `routerClient.chat(messages, toolDefs)` / `writerClient.chat(messages)` (Task 1 — writer wywołuje `chat` z jednym argumentem, więc `tools` jest `undefined` po stronie `llmClient`, co pomija `tool_choice`).
- Consumes: `toolRegistry` — kształt bez zmian: `{ [name]: { description, parameters, execute(args) } }` (Task 2 dodał `searchFood`, nie zmienia kształtu).
- Produces: `runChatLoop({ routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt, history, userMessage, onToolCall? })` → `Promise<{ content: string, usage: { prompt_tokens, completion_tokens }, messages: array, models: string[] }>`. **Zastępuje** dzisiejszy `runChatLoop({ llmClient, toolRegistry, systemPrompt, history, userMessage, onToolCall })` — sygnatura się zmienia, wszyscy wołający (Task 5, Task 6, Task 9) muszą użyć nowej.
- Rzuca: `chat_loop_timeout` (budżet D7 przekroczony w trakcie fazy router), `chat_loop_max_iterations` (5 iteracji routera bez zakończenia), `assistant_unavailable` (writer zawiódł I router nie zostawił żadnego `content` do awaryjnego użycia).

- [ ] **Step 1: Zastąp `server/chat/loop.test.js` w całości**

```js
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

function writerReturning(content, extra = {}) {
  return {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
      model_used: 'writer-model',
      ...extra,
    }),
  };
}

test('runChatLoop: router bez tool_calls -> writer komponuje treść od razu', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'surowy szkic routera' } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
    model_used: 'router-model',
  }) };
  const writerClient = writerReturning('Cześć!');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Cześć!');
  assert.deepEqual(result.usage, { prompt_tokens: 9, completion_tokens: 5 });
  assert.deepEqual(result.models, ['router-model', 'writer-model']);
});

test('runChatLoop: D3 -- content routera z ostatniej iteracji nie trafia do writera', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'surowy szkic routera, ktory nie powinien przeciekac' } }],
    usage: {},
  }) };
  let writerMessagesSeen;
  const writerClient = { chat: async (messages) => {
    writerMessagesSeen = messages;
    return { choices: [{ message: { role: 'assistant', content: 'Czysta odpowiedź.' } }], usage: {} };
  } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Czysta odpowiedź.');
  const hasLeakedRouterDraft = writerMessagesSeen.some((m) => m.content?.includes('nie powinien przeciekac'));
  assert.equal(hasLeakedRouterDraft, false);
});

test('runChatLoop: writer nie dostaje narzędzi (drugi argument chat() jest undefined)', async () => {
  const routerClient = { chat: async () => ({
    choices: [{ message: { role: 'assistant', content: 'ok' } }],
    usage: {},
  }) };
  let writerToolsArg = 'nieustawione';
  const writerClient = { chat: async (_messages, tools) => {
    writerToolsArg = tools;
    return { choices: [{ message: { role: 'assistant', content: 'Odpowiedź.' } }], usage: {} };
  } };
  await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(writerToolsArg, undefined);
});

test('runChatLoop: wykonuje tool_call routera, ślad trafia do writera', async () => {
  let call = 0;
  const routerClient = {
    chat: async () => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{}' } }] } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        };
      }
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: { prompt_tokens: 4, completion_tokens: 1 } };
    },
  };
  let writerMessagesSeen;
  const writerClient = { chat: async (messages) => {
    writerMessagesSeen = messages;
    return { choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }], usage: { prompt_tokens: 20, completion_tokens: 8 } };
  } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'co 19.09?',
  });
  assert.equal(result.content, 'Dzień 8 to Chianti.');
  const toolMsg = writerMessagesSeen.find((m) => m.role === 'tool');
  assert.equal(JSON.parse(toolMsg.content).title, 'Chianti');
});

test('runChatLoop: po 5 iteracjach routera bez odpowiedzi końcowej rzuca chat_loop_max_iterations', async () => {
  const routerClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't', function: { name: 'getDay', arguments: '{}' } }] } }],
      usage: {},
    }),
  };
  const writerClient = { chat: async () => { throw new Error('writer nie powinien być wołany'); } };
  await assert.rejects(
    runChatLoop({
      routerClient, writerClient, toolRegistry: fakeToolRegistry(),
      routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
      history: [], userMessage: 'x',
    }),
    /chat_loop_max_iterations/
  );
});

test('runChatLoop: nieznane narzędzie nie wywala pętli, wraca error do routera', async () => {
  let call = 0;
  const routerClient = {
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
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: {} };
    },
  };
  const writerClient = writerReturning('ok');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
});

test('runChatLoop: krzywy JSON w argumentach narzędzia nie wywala requestu, wraca invalid_tool_arguments', async () => {
  let call = 0;
  const routerClient = {
    chat: async (messages) => {
      call += 1;
      if (call === 1) {
        return {
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', function: { name: 'getDay', arguments: '{niepoprawny json' } }] } }],
          usage: {},
        };
      }
      const toolMsg = messages.find((m) => m.role === 'tool');
      assert.deepEqual(JSON.parse(toolMsg.content), { error: 'invalid_tool_arguments' });
      return { choices: [{ message: { role: 'assistant', content: null } }], usage: {} };
    },
  };
  const writerClient = writerReturning('ok');
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'x',
  });
  assert.equal(result.content, 'ok');
  assert.equal(call, 2);
});

test('runChatLoop: zbiera model_used z routera i writera do result.models', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'x' } }], usage: {}, model_used: 'router-m' }) };
  const writerClient = writerReturning('ok', { model_used: 'writer-m' });
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.deepEqual(result.models, ['router-m', 'writer-m']);
});

test('runChatLoop: gdy writer zawiedzie, wraca do ostatniego content routera (awaryjnie, mimo D3)', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: 'Awaryjna odpowiedź routera.' } }], usage: {} }) };
  const writerClient = { chat: async () => { throw new Error('llm_http_503'); } };
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry: fakeToolRegistry(),
    routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
    history: [], userMessage: 'hej',
  });
  assert.equal(result.content, 'Awaryjna odpowiedź routera.');
});

test('runChatLoop: gdy writer zawiedzie i router nie miał treści, rzuca assistant_unavailable', async () => {
  const routerClient = { chat: async () => ({ choices: [{ message: { role: 'assistant', content: null } }], usage: {} }) };
  const writerClient = { chat: async () => { throw new Error('llm_http_503'); } };
  await assert.rejects(
    runChatLoop({
      routerClient, writerClient, toolRegistry: fakeToolRegistry(),
      routerSystemPrompt: 'sys-router', writerSystemPrompt: 'sys-writer',
      history: [], userMessage: 'hej',
    }),
    /assistant_unavailable/
  );
});
```

- [ ] **Step 2: Uruchom testy, potwierdź że PADAJĄ**

Run: `node --test server/chat/loop.test.js`
Expected: FAIL — dzisiejszy `runChatLoop` nie zna parametrów `routerClient`/`writerClient`/`routerSystemPrompt`/`writerSystemPrompt`, więc `routerClient.chat is not a function` albo podobne od pierwszego testu.

- [ ] **Step 3: Zastąp `server/chat/loop.js` w całości**

```js
const ROUTER_MAX_ITERATIONS = 5;
const TOTAL_TIMEOUT_MS = 18000;

export async function runChatLoop({
  routerClient, writerClient, toolRegistry,
  routerSystemPrompt, writerSystemPrompt,
  history, userMessage, onToolCall,
}) {
  const toolDefs = Object.entries(toolRegistry).map(([name, tool]) => ({
    type: 'function',
    function: { name, description: tool.description, parameters: tool.parameters },
  }));

  const messages = [
    { role: 'system', content: routerSystemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  const models = [];
  let lastRouterContent = null;
  let routerDone = false;

  for (let i = 0; i < ROUTER_MAX_ITERATIONS; i++) {
    if (Date.now() > deadline) throw new Error('chat_loop_timeout');

    const response = await routerClient.chat(messages, toolDefs);
    if (response.model_used) models.push(response.model_used);
    const choice = response.choices[0];
    if (response.usage) {
      usage.prompt_tokens += response.usage.prompt_tokens ?? 0;
      usage.completion_tokens += response.usage.completion_tokens ?? 0;
    }
    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // D3: content routera jest odrzucany tutaj, NIGDY nie trafia do
      // `messages` — faza writer poniżej go nie zobaczy. Zachowany
      // wyłącznie jako awaryjny fallback, gdyby writer sam zawiódł
      // (patrz catch niżej) — to ścieżka błędu, nie normalna.
      lastRouterContent = msg.content;
      routerDone = true;
      break;
    }

    messages.push(msg);
    for (const call of msg.tool_calls) {
      const tool = toolRegistry[call.function.name];
      let args;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        const errorResult = { error: 'invalid_tool_arguments' };
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(errorResult) });
        await onToolCall?.(call.function.name, errorResult);
        continue;
      }
      const result = tool ? await tool.execute(args) : { error: 'unknown_tool' };
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      await onToolCall?.(call.function.name, result);
    }
  }

  if (!routerDone) throw new Error('chat_loop_max_iterations');

  const writerMessages = [
    { role: 'system', content: writerSystemPrompt },
    ...messages.slice(1),
  ];

  try {
    const writerResponse = await writerClient.chat(writerMessages);
    if (writerResponse.model_used) models.push(writerResponse.model_used);
    if (writerResponse.usage) {
      usage.prompt_tokens += writerResponse.usage.prompt_tokens ?? 0;
      usage.completion_tokens += writerResponse.usage.completion_tokens ?? 0;
    }
    const writerMsg = writerResponse.choices[0].message;
    messages.push(writerMsg);
    return { content: writerMsg.content, usage, messages, models };
  } catch {
    if (lastRouterContent) {
      return { content: lastRouterContent, usage, messages, models };
    }
    throw new Error('assistant_unavailable');
  }
}
```

Uwaga: `messages.slice(1)` odcina system prompt routera (pierwszy element), zostawia `...history, user_message, ...ślad tool_calls/wyników` — dokładnie to, co diagram w spec nazywa `[user_message, ...ślad tool_calls/wyników z fazy router]`.

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `node --test server/chat/loop.test.js`
Expected: PASS (10/10).

- [ ] **Step 5: Commit**

```bash
git add server/chat/loop.js server/chat/loop.test.js
git commit -m "feat(chat): rozbij runChatLoop na fazę router + writer (D2, D3, D7); fix JSON.parse bez try/catch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wiring — `server/index.js`, `server/app.js`, `server/routes/chat.js`

System prompty budowane są **per request** wewnątrz handlera `/api/chat`, nie raz przy starcie serwera — inaczej wstrzyknięta `today` (Task 3) zamrażałaby się na dacie ostatniego deployu, co jest dokładnie tym, czemu D4 miało zapobiec.

**Files:**
- Modify: `server/index.js`
- Modify: `server/app.js`
- Modify: `server/routes/chat.js`
- Test: `server/routes/chat.test.js` (pełne zastąpienie)

**Interfaces:**
- Consumes: `runChatLoop({ routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt, history, userMessage, onToolCall })` z Task 4.
- Consumes: `buildRouterSystemPrompt({ trip, toolRegistry, today })`, `buildWriterSystemPrompt({ trip, today })`, `todayIso()` z Task 3.
- Produces: `registerChatRoute(app, db, { toolRegistry, trip, routerClient, writerClient, budgets })` — **zastępuje** dzisiejsze `{ toolRegistry, llmClient, systemPrompt, budgets }`.
- Produces: `buildApp(opts)` — gate warunkowej rejestracji trasy czatu to teraz `opts.toolRegistry && opts.routerClient && opts.writerClient` (zamiast `opts.toolRegistry && opts.llmClient`); `opts.trip` przekazywane dalej do `registerChatRoute`.

- [ ] **Step 1: Zastąp `server/routes/chat.test.js` w całości**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { registerChatRoute } from './chat.js';
import { recordUsage } from '../db/usage.js';

const fakeTrip = { meta: { start_date: '2026-09-12' } };

function fakeToolRegistry() {
  return { listDays: { description: '', parameters: { type: 'object', properties: {} }, execute: () => [] } };
}

function fakeClient(content, extra = {}) {
  return { chat: async () => ({ choices: [{ message: { role: 'assistant', content } }], usage: {}, ...extra }) };
}

async function loggedInApp({
  toolRegistry = fakeToolRegistry(),
  routerClient = fakeClient('x'),
  writerClient = fakeClient('x'),
  budgets = { perUserLimit: 100000, globalLimit: 1000000 },
} = {}) {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci', passphrase: 'oliwa-cyprys-42' });
  registerChatRoute(app, app.db, { toolRegistry, trip: fakeTrip, routerClient, writerClient, budgets });
  const gateRes = await app.inject({ method: 'POST', url: '/api/auth/gate', payload: { password: 'oliwa-cyprys-42' } });
  const gateCookie = gateRes.cookies.find((c) => c.name === 'gate');
  const whoRes = await app.inject({ method: 'POST', url: '/api/auth/who', cookies: { gate: gateCookie.value }, payload: { new_name: 'Mama' } });
  const sessionCookie = whoRes.cookies.find((c) => c.name === 'session');
  return { app, sessionCookie };
}

test('POST /api/chat bez sesji daje 401', async () => {
  const app = await buildApp({ sessionSecret: 'test-secret-min-32-znaki-dlugosci' });
  registerChatRoute(app, app.db, {
    toolRegistry: fakeToolRegistry(), trip: fakeTrip,
    routerClient: fakeClient('x'), writerClient: fakeClient('x'),
    budgets: { perUserLimit: 1, globalLimit: 1 },
  });
  const res = await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'hej' } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('POST /api/chat z sesją zwraca odpowiedź modelu i zapisuje ją do messages + usage', async () => {
  const routerClient = fakeClient(null, { model_used: 'router-model' });
  const writerClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      model_used: 'writer-model',
    }),
  };
  const { app, sessionCookie } = await loggedInApp({ routerClient, writerClient });
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'co 19.09?' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Chianti/);
  assert.deepEqual(res.json().models, ['router-model', 'writer-model']);
  const msgCount = app.db.prepare("SELECT COUNT(*) as n FROM messages WHERE role = 'assistant'").get().n;
  assert.equal(msgCount, 1);
  const usage = app.db.prepare('SELECT prompt_tokens, completion_tokens FROM usage').get();
  assert.deepEqual(usage, { prompt_tokens: 10, completion_tokens: 5 });
  await app.close();
});

test('POST /api/chat: przekroczony budżet per osoba daje 429, plan strony nie jest dotknięty', async () => {
  const { app, sessionCookie } = await loggedInApp({ budgets: { perUserLimit: 50, globalLimit: 1000000 } });
  const uid = app.db.prepare("SELECT id FROM users WHERE display_name = 'Mama'").get().id;
  recordUsage(app.db, uid, 60, 0);
  const res = await app.inject({ method: 'POST', url: '/api/chat', cookies: { session: sessionCookie.value }, payload: { message: 'hej' } });
  assert.equal(res.statusCode, 429);
  const healthz = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(healthz.statusCode, 200);
  await app.close();
});

test('POST /api/chat z Accept: text/event-stream zwraca SSE z eventem content', async () => {
  const routerClient = fakeClient(null);
  const writerClient = {
    chat: async () => ({
      choices: [{ message: { role: 'assistant', content: 'Dzień 8 to Chianti.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  };
  const { app, sessionCookie } = await loggedInApp({ routerClient, writerClient });
  const res = await app.inject({
    method: 'POST', url: '/api/chat',
    headers: { accept: 'text/event-stream' },
    cookies: { session: sessionCookie.value },
    payload: { message: 'co 19.09?' },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.match(res.body, /event: content/);
  assert.match(res.body, /Chianti/);
  assert.match(res.body, /event: done/);
  await app.close();
});
```

- [ ] **Step 2: Uruchom testy, potwierdź że PADAJĄ**

Run: `node --test server/routes/chat.test.js`
Expected: FAIL — `registerChatRoute` dziś oczekuje `llmClient`/`systemPrompt`, nie `trip`/`routerClient`/`writerClient`.

- [ ] **Step 3: Zastąp `server/routes/chat.js` w całości**

```js
import { requireSession } from '../auth/session.js';
import { budgetExceeded, recordUsage } from '../db/usage.js';
import { runChatLoop } from '../chat/loop.js';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from '../chat/systemPrompt.js';

function sseSend(raw, event, data) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function registerChatRoute(app, db, { toolRegistry, trip, routerClient, writerClient, budgets }) {
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

    const today = todayIso();
    const routerSystemPrompt = buildRouterSystemPrompt({ trip, toolRegistry, today });
    const writerSystemPrompt = buildWriterSystemPrompt({ trip, today });

    const wantsSse = (req.headers.accept ?? '').includes('text/event-stream');

    try {
      if (!wantsSse) {
        const result = await runChatLoop({
          routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt,
          history: req.body?.history ?? [],
          userMessage,
        });
        recordUsage(db, req.user.id, result.usage.prompt_tokens, result.usage.completion_tokens);
        db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
          .run(req.user.id, conversationId, result.content);
        req.log.info({ user: req.user.displayName, models: result.models, usage: result.usage }, 'chat completed');
        return { content: result.content, models: result.models };
      }

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      try {
        const result = await runChatLoop({
          routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt,
          history: req.body?.history ?? [],
          userMessage,
          onToolCall: (name) => sseSend(raw, 'status', { tool: name }),
        });
        recordUsage(db, req.user.id, result.usage.prompt_tokens, result.usage.completion_tokens);
        db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
          .run(req.user.id, conversationId, result.content);
        req.log.info({ user: req.user.displayName, models: result.models, usage: result.usage }, 'chat completed');
        sseSend(raw, 'content', { content: result.content });
        sseSend(raw, 'done', { usage: result.usage, models: result.models });
      } catch (err) {
        sseSend(raw, 'error', { error: 'assistant_unavailable', detail: err.message });
      }
      raw.end();
      return reply;
    } catch (err) {
      reply.code(502);
      return { error: 'assistant_unavailable', detail: err.message };
    }
  });
}
```

- [ ] **Step 4: Zastąp gate + parametry w `server/app.js`**

Cały plik po zmianie:

```js
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import { openDb } from './db/index.js';
import { registerGateRoute } from './auth/gate.js';
import { registerWhoRoute } from './auth/who.js';
import { registerChatRoute } from './routes/chat.js';
import { registerMeRoute } from './routes/me.js';

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
  registerGateRoute(app, { passphrase: opts.passphrase ?? process.env.CHAT_PASSPHRASE });
  registerWhoRoute(app, db);
  registerMeRoute(app, db);
  if (opts.toolRegistry && opts.routerClient && opts.writerClient) {
    registerChatRoute(app, db, {
      toolRegistry: opts.toolRegistry,
      trip: opts.trip,
      routerClient: opts.routerClient,
      writerClient: opts.writerClient,
      budgets: opts.budgets ?? {
        perUserLimit: Number(process.env.DAILY_TOKEN_BUDGET_PER_USER ?? 50000),
        globalLimit: Number(process.env.DAILY_TOKEN_BUDGET_GLOBAL ?? 200000),
      },
    });
  }

  app.addHook('onClose', (instance, done) => {
    db.close();
    done();
  });

  return app;
}
```

- [ ] **Step 5: Zastąp `server/index.js`**

```js
import trip from '../trip.json' with { type: 'json' };
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
import { buildApp } from './app.js';
import { buildToolRegistry } from './tools/index.js';
import { createLlmClient } from './chat/llmClient.js';

const toolRegistry = buildToolRegistry({ trip, distanceMatrix });

const routerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_FALLBACK,
});

const writerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL_WRITER ?? process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_WRITER_FALLBACK ?? process.env.CHAT_MODEL_FALLBACK,
});

const app = await buildApp({
  logger: true,
  dbPath: process.env.DB_PATH ?? '/data/toskania.db',
  staticRoot: new URL('../dist', import.meta.url).pathname,
  toolRegistry,
  trip,
  routerClient,
  writerClient,
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
```

- [ ] **Step 6: Uruchom pełny zestaw testów, potwierdź że przechodzą**

Run: `npm test`
Expected: PASS — wszystkie pliki (`scripts/*.test.js`, `server/**/*.test.js`).

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/app.js server/routes/chat.js server/routes/chat.test.js
git commit -m "feat(chat): wpięcie routerClient/writerClient + trip do wiring (server/index.js, app.js, routes/chat.js)

System prompty budowane per-request w routes/chat.js, nie raz przy starcie
serwera -- inaczej wstrzyknięta dzisiejsza data (D4) zamrażałaby się na
dacie ostatniego deployu.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `loop.e2e.js` — dwufazowa sygnatura + nowe przypadki

To osobny, ręcznie odpalany zestaw (`npm run test:e2e`), wymaga żywego `LITELLM_BASE_URL`/`LITELLM_API_KEY` — nie da się go uruchomić z tej maszyny (brak dostępu sieciowego do VPS/litellm). Krok "uruchom" w tym tasku jest więc opisany jako operacja do wykonania z dostępem do VPS, nie jako coś ten plan sam zweryfikuje.

**Files:**
- Modify: `server/chat/loop.e2e.js`

**Interfaces:**
- Consumes: `runChatLoop` z Task 4 (dwufazowa sygnatura), `buildRouterSystemPrompt`/`buildWriterSystemPrompt`/`todayIso` z Task 3, `buildToolRegistry` z Task 2 (rejestr zawiera już `searchFood`).

- [ ] **Step 1: Zastąp `server/chat/loop.e2e.js` w całości**

```js
// Uruchamiane osobno: `npm run test:e2e` — wymaga żywego LITELLM_BASE_URL/LITELLM_API_KEY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import trip from '../../trip.json' with { type: 'json' };
import distanceMatrix from '../../src/distance-matrix.json' with { type: 'json' };
import { buildToolRegistry } from '../tools/index.js';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from './systemPrompt.js';
import { createLlmClient } from './llmClient.js';
import { runChatLoop } from './loop.js';

const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
const today = todayIso();
const routerSystemPrompt = buildRouterSystemPrompt({ trip, toolRegistry, today });
const writerSystemPrompt = buildWriterSystemPrompt({ trip, today });

const routerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_FALLBACK,
});

const writerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL_WRITER ?? process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_WRITER_FALLBACK ?? process.env.CHAT_MODEL_FALLBACK,
});

async function ask(question) {
  const result = await runChatLoop({
    routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt,
    history: [], userMessage: question,
  });
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

test('e2e: pytanie o restaurację/jedzenie zwraca konkretne miejsce z trip.json (D4, searchFood)', async () => {
  const answer = await ask('Gdzie zjemy w Chianti, dzień 8?');
  assert.match(answer, /Rifugio|Chianti|osteria/i);
});

test('e2e: odpowiedź o konkretnym dniu zawiera link w formacie #/dzien-<n> (D5)', async () => {
  const answer = await ask('Co robimy 19.09? Podaj proszę też link do strony tego dnia.');
  assert.match(answer, /#\/dzien-8/);
});
```

- [ ] **Step 2: Sprawdź składnię lokalnie (bez żywego API)**

Run: `node --check server/chat/loop.e2e.js`
Expected: brak outputu (plik jest poprawnym JS-em; import `trip.json`/`distance-matrix.json` sprawdza się tylko przy faktycznym imporcie, nie przy `--check`).

- [ ] **Step 3: Uruchom pełny e2e (wymaga VPS/LITELLM — operator, nie ten plan)**

Run: `LITELLM_BASE_URL=... LITELLM_API_KEY=... CHAT_MODEL=nvidia-muse-glimmer-30b CHAT_MODEL_FALLBACK=nvidia-gemma-4-31b-it npm run test:e2e`
Expected: 12/12 PASS. Ten krok wykonuje operator z maszyny mającej sieciowy dostęp do VPS/litellm — nie da się go zweryfikować stąd.

- [ ] **Step 4: Commit**

```bash
git add server/chat/loop.e2e.js
git commit -m "test(chat): zaktualizuj loop.e2e.js pod dwufazową sygnaturę + searchFood/link #/dzien-<n>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `docker-compose.yml` (repo toskania) — nowe zmienne writer

Ten plik żyje w repo **toskania**, nie w `infra` — to własny, samodzielny stos compose (patrz nagłówek pliku: "Wlasny stos toskania... NIE serwis wewnatrz `infra`"). `infra` daje tylko wspólną sieć `edge` i zaszyfrowane sekrety (`secrets.toskania.enc.yaml`).

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: kontener `toskania` dostaje `CHAT_MODEL_WRITER`/`CHAT_MODEL_WRITER_FALLBACK` w środowisku, źródło: `${TOSKANIA_CHAT_MODEL_WRITER}`/`${TOSKANIA_CHAT_MODEL_WRITER_FALLBACK}` wstrzykiwane przez `sops exec-env` z `infra/secrets.toskania.enc.yaml` (ten sam wzorzec co istniejące `CHAT_MODEL`/`CHAT_MODEL_FALLBACK`). Gdy sekrety nie ustawione, zmienna w kontenerze będzie pustym stringiem — `server/index.js` (Task 5) już to obsługuje przez `?? process.env.CHAT_MODEL` (pusty string jest falsy tylko dla `??` gdy `undefined`/`null`; **uwaga**: pusty string `''` NIE jest `undefined`, więc `'' ?? X` da `''`, nie `X` — patrz Step 1, dlaczego to wymaga uwagi przy braku sekretu).

- [ ] **Step 1: Dodaj dwie linie env w `docker-compose.yml`**

W bloku `environment:`, zaraz po `- CHAT_MODEL_FALLBACK=${TOSKANIA_CHAT_MODEL_FALLBACK}`, dodaj:

```yaml
      - CHAT_MODEL_WRITER=${TOSKANIA_CHAT_MODEL_WRITER}
      - CHAT_MODEL_WRITER_FALLBACK=${TOSKANIA_CHAT_MODEL_WRITER_FALLBACK}
```

Pełny blok `environment:` po zmianie:

```yaml
    environment:
      # Wstrzykiwane przez `sops exec-env` w deploy.yml
      # (secrets.toskania.enc.yaml z repo `infra` -- ZERO kopii sekretow
      # w tym repo, patrz komentarz w deploy.yml).
      - CHAT_MODEL=${TOSKANIA_CHAT_MODEL}
      - CHAT_MODEL_FALLBACK=${TOSKANIA_CHAT_MODEL_FALLBACK}
      - CHAT_MODEL_WRITER=${TOSKANIA_CHAT_MODEL_WRITER}
      - CHAT_MODEL_WRITER_FALLBACK=${TOSKANIA_CHAT_MODEL_WRITER_FALLBACK}
      - LITELLM_BASE_URL=http://litellm:4000/v1
      - LITELLM_API_KEY=${TOSKANIA_LITELLM_KEY}
      - SESSION_SECRET=${TOSKANIA_SESSION_SECRET}
      - CHAT_PASSPHRASE=${TOSKANIA_CHAT_PASSPHRASE}
      - DAILY_TOKEN_BUDGET_PER_USER=${TOSKANIA_BUDGET_PER_USER}
      - DAILY_TOKEN_BUDGET_GLOBAL=${TOSKANIA_BUDGET_GLOBAL}
```

**Ważne (blokuje `??` fallback w `server/index.js`):** dopóki `TOSKANIA_CHAT_MODEL_WRITER` nie jest ustawione w `infra/secrets.toskania.enc.yaml`, `docker compose` wstrzyknie do kontenera `CHAT_MODEL_WRITER=` (pusty string), a `process.env.CHAT_MODEL_WRITER ?? process.env.CHAT_MODEL` w `server/index.js` zwróci `''`, NIE `CHAT_MODEL` — bo `''` nie jest `null`/`undefined`. Skutek: writer dostałby model `''` (błąd na żywym API), dopóki Step 2 nie zostanie wykonany przez operatora. To świadomie fail-fast, nie ciche zepsucie — ale deploy tego obrazu przed Step 2 zepsuje czat.

- [ ] **Step 2 (operator, nie ten plan): dodaj sekrety w `infra/secrets.toskania.enc.yaml`**

Nie da się tego wykonać z tej sesji (brak deszyfrowania `secrets.*.enc.yaml`, standing constraint). Operator uruchamia ręcznie, z maszyny z dostępem do klucza `sops`:

```bash
cd /home/mariusz/Desktop/infra
sops secrets.toskania.enc.yaml
# w edytorze dodać:
#   TOSKANIA_CHAT_MODEL_WRITER: nvidia-gemma-4-31b-it
#   TOSKANIA_CHAT_MODEL_WRITER_FALLBACK: nvidia-muse-glimmer-30b
# (albo odwrotnie -- rozstrzyga eval z Task 9 / D6)
```

- [ ] **Step 3: Sprawdź składnię YAML lokalnie**

Run: `python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml')); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(deploy): dodaj CHAT_MODEL_WRITER/_FALLBACK env passthrough (D6)

Wymaga ręcznego dopisania TOSKANIA_CHAT_MODEL_WRITER/_WRITER_FALLBACK w
infra/secrets.toskania.enc.yaml przed deployem -- patrz Task 7 Step 2 tego
planu (krok operatora, poza zasięgiem tej sesji).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `infra/litellm/config.yaml` — brakujący gemma + poprawki komentarzy

**Files:**
- Modify: `infra/litellm/config.yaml`

**Interfaces:**
- Produces: nowy `model_name: nvidia-gemma-4-31b-it` w `model_list`, wołalny przez LiteLLM proxy pod tą nazwą (to jest dokładnie wartość, jaką `TOSKANIA_CHAT_MODEL_WRITER`/`_FALLBACK` z Task 7 powinny przyjąć).

- [ ] **Step 1: Popraw komentarz przy `nvidia-deepseek-v4-flash-0731`**

Zamień (linie 147-150 dzisiejszego pliku):

```yaml
  # DeepSeek-V4-Flash-0731 przez NVIDIA NIM (free tier) -- model GLOWNY
  # czatu toskanii (CHAT_MODEL). Ten sam checkpoint co platny primary
  # (openrouter/deepseek/deepseek-v4-flash-0731), ale za darmo przez
  # integrate.api.nvidia.com. Function calling: supported (NVIDIA docs).
```

na:

```yaml
  # DeepSeek-V4-Flash-0731 przez NVIDIA NIM (free tier). Ten sam checkpoint
  # co platny primary (openrouter/deepseek/deepseek-v4-flash-0731), ale za
  # darmo przez integrate.api.nvidia.com. Function calling: supported (NVIDIA
  # docs). UWAGA (poprawione 2026-09-09): NIE jest to CHAT_MODEL toskanii --
  # ten komentarz byl nieaktualny. Prawdziwy CHAT_MODEL to
  # nvidia-muse-glimmer-30b, fallback to nvidia-gemma-4-31b-it (patrz nizej) --
  # zweryfikowane wprost z userem, nie z odszyfrowanych sekretow. Ten model
  # zostaje w configu jako dostepny na zadanie, poza automatycznym lancuchem
  # czatu toskanii.
```

- [ ] **Step 2: Popraw komentarz przy `nvidia-muse-glimmer-30b` i dodaj `nvidia-gemma-4-31b-it` zaraz po nim**

Zamień (linie 158-165 dzisiejszego pliku):

```yaml
  # Meta Muse Glimmer 30B przez NVIDIA NIM (free tier) -- fallback czatu
  # toskanii. Natiwny tool-calling, 120K kontekstu, multimodalny.
  - model_name: nvidia-muse-glimmer-30b
    litellm_params:
      model: nvidia_nim/meta/muse-glimmer-30b
      api_key: os.environ/NVIDIA_API_KEY
      timeout: 300
      stream_timeout: 90
```

na:

```yaml
  # Meta Muse Glimmer 30B przez NVIDIA NIM (free tier) -- PRAWDZIWY model
  # GLOWNY czatu toskanii (CHAT_MODEL), nie fallback (poprawione 2026-09-09 --
  # patrz komentarz przy nvidia-deepseek-v4-flash-0731 wyzej). Natiwny
  # tool-calling, 120K kontekstu, multimodalny.
  - model_name: nvidia-muse-glimmer-30b
    litellm_params:
      model: nvidia_nim/meta/muse-glimmer-30b
      api_key: os.environ/NVIDIA_API_KEY
      timeout: 300
      stream_timeout: 90

  # Google Gemma-4-31B-IT przez NVIDIA NIM (free tier) -- PRAWDZIWY fallback
  # czatu toskanii (CHAT_MODEL_FALLBACK). Brakowalo tego wpisu mimo ze model
  # jest juz uzywany na produkcji -- dodane 2026-09-09, zweryfikowane wprost
  # z userem, nie z odszyfrowanych sekretow. Model ID z
  # https://build.nvidia.com/google/gemma-4-31b-it.
  - model_name: nvidia-gemma-4-31b-it
    litellm_params:
      model: nvidia_nim/google/gemma-4-31b-it
      api_key: os.environ/NVIDIA_API_KEY
      timeout: 300
      stream_timeout: 90
```

- [ ] **Step 3: Popraw łańcuch fallbacków czatu toskanii w `router_settings`**

Zamień (linie 184-195 dzisiejszego pliku):

```yaml
router_settings:
  # deepseek-v4-flash jest modelem glownym. W razie awarii / błędu OpenRoutera
  # router probuje darmowego hetzner-qwen3.6-35b jako awaryjnego fallbacku.
  # nvidia-kimi-k3 celowo POZA fallbackami -- dostepny na zadanie
  # (model_name w wywolaniu), nie bierze udzialu w automatycznym lancuchu.
  fallbacks:
    - deepseek-v4-flash: [hetzner-qwen3.6-35b]
    # Lancuch czatu toskanii (free tier NIM): glimmer jest tez
    # CHAT_MODEL_FALLBACK po stronie aplikacji (server/chat/llmClient.js),
    # wiec awaria jest kryta dwuwarstwowo.
    - nvidia-deepseek-v4-flash-0731: [nvidia-muse-glimmer-30b, hetzner-qwen3.6-35b]
    - nvidia-muse-glimmer-30b: [hetzner-qwen3.6-35b]
```

na:

```yaml
router_settings:
  # deepseek-v4-flash jest modelem glownym. W razie awarii / błędu OpenRoutera
  # router probuje darmowego hetzner-qwen3.6-35b jako awaryjnego fallbacku.
  # nvidia-kimi-k3 celowo POZA fallbackami -- dostepny na zadanie
  # (model_name w wywolaniu), nie bierze udzialu w automatycznym lancuchu.
  fallbacks:
    - deepseek-v4-flash: [hetzner-qwen3.6-35b]
    # Lancuch czatu toskanii (free tier NIM). Poprawione 2026-09-09: glimmer
    # jest PRIMARY (CHAT_MODEL) a gemma FALLBACKIEM (CHAT_MODEL_FALLBACK) po
    # stronie aplikacji (server/chat/llmClient.js / server/index.js), nie
    # odwrotnie -- ten blok byl nieaktualny wobec tej rzeczywistosci.
    - nvidia-muse-glimmer-30b: [nvidia-gemma-4-31b-it, hetzner-qwen3.6-35b]
    - nvidia-gemma-4-31b-it: [hetzner-qwen3.6-35b]
    - nvidia-deepseek-v4-flash-0731: [nvidia-muse-glimmer-30b, hetzner-qwen3.6-35b]
```

- [ ] **Step 4: Sprawdź składnię YAML lokalnie**

Run: `python3 -c "import yaml; yaml.safe_load(open('infra/litellm/config.yaml')); print('OK')"`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
cd /home/mariusz/Desktop/infra
git add litellm/config.yaml
git commit -m "fix(litellm): dodaj brakujący nvidia-gemma-4-31b-it, popraw nieaktualne komentarze o CHAT_MODEL toskanii

glimmer jest PRIMARY, gemma FALLBACKIEM -- odwrotnie niz sugerowaly stare
komentarze. Zweryfikowane wprost z userem 2026-09-09, nie z odszyfrowanych
sekretow. Patrz docs/superpowers/specs/2026-09-09-czat-agent-router-writer-design.md
w repo toskania.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Eval script dla D6 (przypisanie modeli do ról)

Manualne narzędzie, NIE część `npm test`/`npm run test:e2e` — odpalane ręcznie z dostępem do żywego LITELLM_BASE_URL, żeby rozstrzygnąć które z {glimmer, gemma} gra router a które writer (D6 w spec).

**Files:**
- Create: `scripts/eval-chat-roles.js`

**Interfaces:**
- Consumes: `buildToolRegistry` (Task 2), `buildRouterSystemPrompt`/`buildWriterSystemPrompt`/`todayIso` (Task 3), `createLlmClient` (Task 1), `runChatLoop` (Task 4).

- [ ] **Step 1: Napisz `scripts/eval-chat-roles.js`**

```js
#!/usr/bin/env node
// Eval do D6 (patrz docs/superpowers/specs/2026-09-09-czat-agent-router-writer-design.md):
// odpala 4 reprezentatywne prompty przez obie kombinacje przypisania ról
// (glimmer-router+gemma-writer vs. odwrotnie) na żywym LITELLM_BASE_URL,
// żeby rozstrzygnąć CHAT_MODEL/CHAT_MODEL_WRITER w sekretach.
// Uruchomienie: LITELLM_BASE_URL=... LITELLM_API_KEY=... node scripts/eval-chat-roles.js

import trip from '../trip.json' with { type: 'json' };
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
import { buildToolRegistry } from '../server/tools/index.js';
import { buildRouterSystemPrompt, buildWriterSystemPrompt, todayIso } from '../server/chat/systemPrompt.js';
import { createLlmClient } from '../server/chat/llmClient.js';
import { runChatLoop } from '../server/chat/loop.js';

const GLIMMER = 'nvidia-muse-glimmer-30b';
const GEMMA = 'nvidia-gemma-4-31b-it';

const PROMPTS = [
  { label: 'proste/1 tool', text: 'Co robimy 19.09?' },
  { label: 'złożone/2+ tooli', text: 'Co robimy w dniu 8 i o której otwiera się tam pierwsza atrakcja?' },
  { label: 'bez pokrycia w danych', text: 'O której otwiera się Koloseum w Rzymie?' },
  { label: 'względne "jutro"', text: 'Co robimy jutro?' },
];

const COMBINATIONS = [
  { label: 'glimmer-router + gemma-writer', routerModel: GLIMMER, writerModel: GEMMA },
  { label: 'gemma-router + glimmer-writer', routerModel: GEMMA, writerModel: GLIMMER },
];

function client(model) {
  return createLlmClient({
    baseUrl: process.env.LITELLM_BASE_URL,
    apiKey: process.env.LITELLM_API_KEY,
    model,
  });
}

async function main() {
  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
    console.error('Wymagane LITELLM_BASE_URL i LITELLM_API_KEY w env.');
    process.exit(1);
  }

  const toolRegistry = buildToolRegistry({ trip, distanceMatrix });
  const today = todayIso();
  const routerSystemPrompt = buildRouterSystemPrompt({ trip, toolRegistry, today });
  const writerSystemPrompt = buildWriterSystemPrompt({ trip, today });

  for (const combo of COMBINATIONS) {
    console.log(`\n=== ${combo.label} ===`);
    const routerClient = client(combo.routerModel);
    const writerClient = client(combo.writerModel);
    for (const prompt of PROMPTS) {
      process.stdout.write(`\n[${prompt.label}] "${prompt.text}"\n`);
      try {
        const result = await runChatLoop({
          routerClient, writerClient, toolRegistry, routerSystemPrompt, writerSystemPrompt,
          history: [], userMessage: prompt.text,
        });
        console.log(`  modele: ${result.models.join(' -> ')}`);
        console.log(`  odpowiedź: ${result.content}`);
      } catch (err) {
        console.log(`  BŁĄD: ${err.message}`);
      }
    }
  }
}

main();
```

- [ ] **Step 2: Sprawdź składnię lokalnie**

Run: `node --check scripts/eval-chat-roles.js`
Expected: brak outputu.

- [ ] **Step 3: Odpal ręcznie z dostępem do VPS/litellm (operator, nie ten plan)**

Run: `LITELLM_BASE_URL=... LITELLM_API_KEY=... node scripts/eval-chat-roles.js`
Expected: dla obu kombinacji, dla wszystkich 4 promptów — router poprawnie emituje `tool_calls` (widoczne pośrednio: `result.models` zawiera oba modele, a odpowiedź zawiera konkretne dane z `trip.json`, nie ogólnik), writer daje gramatyczną polską prozę bez halucynacji. Wynik rozstrzyga wartości `TOSKANIA_CHAT_MODEL_WRITER`/`_WRITER_FALLBACK` z Task 7 Step 2.

- [ ] **Step 4: Commit**

```bash
git add scripts/eval-chat-roles.js
git commit -m "feat(scripts): eval-chat-roles.js do rozstrzygnięcia D6 (przypisanie glimmer/gemma do router/writer)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Dopisek w spec bazowym — D8 nieaktualne

**Files:**
- Modify: `docs/superpowers/specs/2026-09-09-czat-konta-vps-design.md`

- [ ] **Step 1: Dodaj notkę zaraz po tabeli decyzji, przed sekcją "Odrzucone warianty logowania"**

Zamień:

```markdown
| D9 | Wzorzec deployu **`karpacz`/`gieldowo`**, nie Caddy | Spec z 06.09 zakładał Caddy + rsync + symlink release'ów. Realna infrastruktura to Cloudflare Tunnel (TLS terminuje Cloudflare), obraz w GHCR i `docker compose` sterowany z repo `infra`. Caddy byłby trzecim frontem przed dwoma istniejącymi. |

**Odrzucone warianty logowania** (D5), żeby nie wracały:
```

na:

```markdown
| D9 | Wzorzec deployu **`karpacz`/`gieldowo`**, nie Caddy | Spec z 06.09 zakładał Caddy + rsync + symlink release'ów. Realna infrastruktura to Cloudflare Tunnel (TLS terminuje Cloudflare), obraz w GHCR i `docker compose` sterowany z repo `infra`. Caddy byłby trzecim frontem przed dwoma istniejącymi. |

> **Aktualizacja 2026-09-09:** D8 uznane za nieaktualne, nadpisane decyzją D1
> w `2026-09-09-czat-agent-router-writer-design.md` — czat toskanii zostaje
> na modelach free-only (glimmer primary / gemma fallback), nie płatny
> primary. Uzasadnienie i pełny kontekst dryfu wobec produkcji: patrz ten
> dokument, sekcja "Kontekst: dryf między D8 a produkcją".

**Odrzucone warianty logowania** (D5), żeby nie wracały:
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-09-czat-konta-vps-design.md
git commit -m "docs(spec): dopisz że D8 jest nadpisane przez router-writer-design D1

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
