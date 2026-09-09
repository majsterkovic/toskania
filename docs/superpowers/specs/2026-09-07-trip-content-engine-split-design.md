# Spec: podział treść wycieczki / silnik frontendu

Data: 2026-09-07
Status: do realizacji **po freeze** (nie wcześniej niż 2026-09-28)
Hosting tej zmiany: **wyłącznie GitHub Pages** (`base: '/toskania/'`, workflow bez zmian)

Zastępuje wycinek „schema + silnik” ze speca `2026-09-06-vps-trip-framework.md`.
> **Notka 2026-09-09:** tamten spec został usunięty (nie pasował do realnej infrastruktury —
> zakładał Caddy i rsync zamiast Cloudflare Tunnel i GHCR). Historia w commicie `f48d819`;
> jego następcą jest [`2026-09-09-czat-konta-vps-design.md`](2026-09-09-czat-konta-vps-design.md).
**Poza zakresem (kolejne plastry):** VPS, Cloudflare Tunnel, PWA, LiteLLM/czat, MCP, `trips/` monorepo, `npm run new-trip`, drugi trip.

## 1. Cel

Z repo „strona Toskanii” zrobić dwa jasne zbiory:

1. **Treść** — jeden plik `trip.json` (dziś `plan_2bazy.json`) + `trip.config.js` (rozmiary obrazków, aliasy plików).
2. **Silnik** — `src/*.js` + `src/styles/*`. Zero brandu, dat, timezone, kluczy localStorage i współrzędnych baz zaszytych w JS.

Strona po zmianie wygląda tak samo. Deploy jak dziś: push na `main` → Actions → Pages.

## 2. Non-goals

- Nie przenosimy katalogów do `trips/toskania-2026/` ani `trip-engine/`.
- Nie ruszamy hostingu, Caddy, GHCR, tunelu, LiteLLM.
- Nie dodajemy service workera ani manifestu.
- Nie usuwamy historycznego `plan.json` (3 bazy) ani martwego `variants` w JSON — nie są importowane.
- Nie przepisujemy 6× `<title>` w HTML shellach (zostają trip-specific aż do scaffoldu).
- Nie masowego `JSON.stringify` całego planu (hałas w diffie). Nowe pola `meta` wstawiamy w bloku na górze pliku.

## 3. Kontrakt `trip.json` v1

Dziśszy kształt zostaje (`meta`, `bases`, `transit_stops`, `days`, `practical_info`, `costs`, `todo`, `packing_list`). Dopisujemy w `meta`:

| Pole | Wartość Toskania | Po co |
|------|------------------|--------|
| `schema_version` | `1` | walidator |
| `brand` | `"Toskania"` | nav |
| `storage_key` | `"toskania-2026"` | localStorage todo (`todo-done-${storage_key}`) |
| `timezone` | `"Europe/Rome"` | Open-Meteo |
| `start_date` | `"2026-09-12"` | pogoda, odliczanie |
| `end_date` | `"2026-09-27"` | pogoda |
| `phase_labels.dojazd` | `{ label, sub }` | timeline etap I |
| `phase_labels.powrot` | `{ label, sub }` | timeline etap IV |

Istniejące `meta.title`, `meta.dates`, `meta.images` zostają. Etapy baz (II/III) nadal biorą podpis z `bases[]`.

**Walidator (failuje `npm run build`):**

- `schema_version === 1`
- wymagane pola `meta` z tabeli
- każda baza: `id`, `coords` = `[lat, lon]` (dwie liczby)
- `days[].day_num` unikalne (dni z numerem); `base_id` / `next_base_id` jeśli nie-null wskazują istniejącą bazę
- atrakcja z `coords`: `drive_min` jest liczbą albo `null` + niepusty `drive_min_reason`
- dzień `type === 'transit'`: `route_points[].coords` obecne
- `costs`, `todo`, `practical_info`, `packing_list` istnieją (obiekty)
- `config.imageSizes` ma klucze `hero__figure`, `daypage__hero`, `attraction-thumb`

## 4. Silnik

Jeden moduł `src/trip.js`:

```js
import trip from '../trip.json';
import config from '../trip.config.js';
export { trip, config };
```

`trip.config.js` (dane silnika, nie treść dni): `id`, `imageSizes` (dziś `IMAGE_SIZES` z `render.js`), `imageAliases` (dziś `IMAGE_ALIASES`).

Wszystkie entry (`main`, `short`, `mapa`, `galeria`, `praktyczne`, `packing`) importują `trip` stąd — nigdy `../plan_2bazy.json` ani `../trip.json` bezpośrednio.

Chrome: `renderSiteNav(trip, active)`, `renderSiteFooter(trip)`, `initTodo(trip)` — brand, daty, storage z `trip.meta`.

Pogoda: `initWeather(id, locs, { startDate, endDate, timezone })`. Fallback `LOCATIONS` w `weather.js` znika; `praktyczne.js` i tak składa `locs` z `trip.bases`.

`renderFooter` i stopka dnia biorą `trip.meta` (usunąć literał `'12–27 września 2026'` w `renderDayPage`).

Klucze packing zostają `packing:${itemId}` — zmiana prefiksu skasowałaby odhaczenia w przeglądarkach grupy.

## 5. Kryteria akceptacji

1. `npm run build` woła walidator i przechodzi.
2. Brak importów `plan_2bazy.json`. Brak w `src/` literałów `Toskania 2026`, `todo-done-toskania-2026`, `2026-09-12`, `Europe/Rome`, coords baz.
3. Screenshot-diff (istniejący `scripts/take-screenshots.js`, 8 ujęć) — brak regresji layoutu; dopuszczalne tylko teksty które i tak pochodzą z JSON.
4. Pages: `base` nadal `/toskania/`, workflow nietknięty.
5. `plan.json` i `notes/` nie są wymagane do buildu.

## 6. Kolejność względem freeze

Do 28.09 wolno tylko content w obecnym `plan_2bazy.json`. Ten spec wykonujemy po powrocie. Jeśli do tego czasu JSON urośnie, walidator ma złapać braki `coords`/`drive_min` zamiast je zgadywać.
