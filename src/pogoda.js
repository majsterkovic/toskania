/**
 * Zakładka Pogoda: prognoza godzinowa Open-Meteo per dzień (dzień → miejscowość
 * z trip.json `day.weather`). Bez klucza API, CORS OK.
 */
import { WMO_ICON } from './weather.js';
import { esc } from './html.js';

const SAMPLE_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const TRIP_TZ = 'Europe/Rome';

function isoDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD z daty dnia w trip.json ("12.09 (sob)" + meta.start_date jako kotwica). */
export function tripDayIso(dayNum, startIso) {
  const d = new Date(startIso + 'T12:00:00');
  d.setDate(d.getDate() + (dayNum - 1));
  return isoDay(d);
}

function locKey(coords) {
  return `${coords[0].toFixed(3)},${coords[1].toFixed(3)}`;
}

async function fetchHourly(lat, lon, start, end) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,weathercode` +
    `&timezone=${encodeURIComponent(TRIP_TZ)}&start_date=${start}&end_date=${end}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function rainVerdict(maxPrecip) {
  if (maxPrecip == null) return { cls: '', text: 'Brak danych o deszczu' };
  if (maxPrecip >= 60) return { cls: 'is-rain', text: `Deszcz prawie pewny (do ${maxPrecip}%)` };
  if (maxPrecip >= 30) return { cls: 'is-maybe', text: `Możliwy deszcz (do ${maxPrecip}%)` };
  return { cls: 'is-dry', text: 'Bez deszczu' };
}

function renderHourSample(h) {
  return `
    <div class="wx-hour">
      <div class="wx-hour__h">${h.hour}:00</div>
      <div class="wx-hour__icon">${h.icon}</div>
      <div class="wx-hour__t">${h.temp}°</div>
      <div class="wx-hour__p${h.precip >= 30 ? ' is-wet' : ''}">${h.precip != null ? h.precip + '%' : '—'}</div>
    </div>`;
}

function renderDayCard(day, iso) {
  return `
    <article class="wx-day" id="wx-day-${day.day_num}">
      <header class="wx-day__head">
        <span class="wx-day__date">${esc(day.date)}</span>
        <h2 class="wx-day__title">${esc(day.title)}</h2>
        <p class="wx-day__place">📍 ${esc(day.weather.label)}</p>
      </header>
      <div class="wx-day__body" data-wx-day="${day.day_num}" data-wx-date="${iso}">
        <p class="wx-loading">⏳ Pobieram prognozę…</p>
      </div>
    </article>`;
}

export function renderPogoda(days) {
  const withWx = (days || []).filter((d) => d.day_num != null && d.weather?.coords);
  return `
    <section class="section" id="pogoda">
      <h1 class="section-title">Pogoda na wyjazd</h1>
      <p class="section-lead">Prognoza godzinowa na każdy dzień — tam, gdzie faktycznie będziemy. Próbki co 2 h (6:00–22:00).</p>
      <div class="wx-list">${withWx.map((d) => renderDayCard(d, '')).join('')}</div>
      <div class="day-block practical-card wx-sources">
        <h4 class="block-label">Lokalne źródła włoskie</h4>
        <p><a href="https://www.cfr.toscana.it/" target="_blank" rel="noopener">CFR Toscana</a> — biuletyny i alerty Protezione Civile dla Toskanii.</p>
        <p><a href="https://www.meteoam.it/" target="_blank" rel="noopener">Meteo Aeronautica Militare</a> — państwowa służba meteo (odpowiednik IMGW).</p>
      </div>
    </section>
  `;
}

export async function initPogoda(days, startIso, endIso) {
  const withWx = (days || []).filter((d) => d.day_num != null && d.weather?.coords);
  if (!withWx.length) return;

  // Zakres prognozy: od startu wyjazdu do min(koniec, dziś+15). Dni poza
  // oknem API dostają adnotację zamiast liczb.
  const max = new Date();
  max.setDate(max.getDate() + 15);
  const maxStr = isoDay(max);
  const start = startIso > maxStr ? maxStr : startIso;
  const end = endIso > maxStr ? maxStr : endIso;
  const inRange = start <= end;

  // Jedno zapytanie na unikalną lokalizację (bazy się powtarzają).
  const locs = new Map();
  for (const d of withWx) {
    const k = locKey(d.weather.coords);
    if (!locs.has(k)) locs.set(k, { coords: d.weather.coords, data: null, error: false });
  }
  await Promise.all([...locs.values()].map(async (loc) => {
    if (!inRange) { loc.error = true; return; }
    try {
      loc.data = await fetchHourly(loc.coords[0], loc.coords[1], start, end);
    } catch {
      loc.error = true;
    }
  }));

  for (const d of withWx) {
    const body = document.querySelector(`[data-wx-day="${d.day_num}"]`);
    if (!body) continue;
    const iso = tripDayIso(d.day_num, startIso);
    if (!inRange || iso < start || iso > end) {
      body.innerHTML = '<p class="wx-out">Poza zasięgiem 16-dniowej prognozy — sprawdź bliżej wyjazdu.</p>';
      continue;
    }
    const loc = locs.get(locKey(d.weather.coords));
    const h = loc?.data?.hourly;
    if (!h?.time) {
      body.innerHTML = '<p class="wx-out">Brak danych o pogodzie.</p>';
      continue;
    }
    const samples = [];
    h.time.forEach((t, i) => {
      if (!t.startsWith(iso)) return;
      const hour = Number(t.slice(11, 13));
      if (!SAMPLE_HOURS.includes(hour)) return;
      samples.push({
        hour,
        temp: Math.round(h.temperature_2m[i]),
        precip: h.precipitation_probability?.[i],
        icon: WMO_ICON[h.weathercode?.[i]] || '⛅',
      });
    });
    if (!samples.length) {
      body.innerHTML = '<p class="wx-out">Brak danych o pogodzie.</p>';
      continue;
    }
    const temps = samples.map((s) => s.temp);
    const precips = samples.map((s) => s.precip).filter((v) => v != null);
    const verdict = rainVerdict(precips.length ? Math.max(...precips) : null);
    body.innerHTML = `
      <div class="wx-summary">
        <span class="wx-summary__temps">${Math.min(...temps)}° / ${Math.max(...temps)}°</span>
        <span class="wx-verdict ${verdict.cls}">${esc(verdict.text)}</span>
      </div>
      <div class="wx-hours">${samples.map(renderHourSample).join('')}</div>`;
  }
}
