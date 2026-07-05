/**
 * Pogoda — Open-Meteo archive API (klimatologia) + forecast (16 dni przed wyjazdem)
 * Bez klucza API, CORS OK
 */

const TRIP_START = '2026-09-12';
const TRIP_END   = '2026-09-27';

const LOCATIONS = [
  { id: 'base1', name: 'Garfagnana', sub: 'okolice Barga', lat: 44.073, lon: 10.484 },
  { id: 'base2', name: 'Val d\'Orcia', sub: 'okolice Castiglione d\'Orcia', lat: 43.062, lon: 11.618 },
  { id: 'base3', name: 'Maremma',   sub: 'okolice Pitigliano', lat: 42.636, lon: 11.669 },
];

const WMO_ICON = {
  0: '☀', 1: '🌤', 2: '⛅', 3: '☁',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  80: '🌦', 81: '🌧', 82: '⛈',
  95: '⛈', 96: '⛈', 99: '⛈',
};

function avg(arr) {
  const valid = (arr || []).filter(v => v != null);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
}

function round1(v) { return v != null ? Math.round(v * 10) / 10 : null; }

async function fetchArchive(loc, year) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${year}-09-01&end_date=${year}-09-30&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=Europe%2FRome`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchForecast(loc) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&start_date=${TRIP_START}&end_date=${TRIP_END}&timezone=Europe%2FRome`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getClimateNormals(loc) {
  const [r2022, r2023] = await Promise.all([fetchArchive(loc, 2022), fetchArchive(loc, 2023)]);
  const maxTemps  = [...(r2022.daily.temperature_2m_max || []), ...(r2023.daily.temperature_2m_max || [])];
  const minTemps  = [...(r2022.daily.temperature_2m_min || []), ...(r2023.daily.temperature_2m_min || [])];
  const precip    = [...(r2022.daily.precipitation_sum  || []), ...(r2023.daily.precipitation_sum  || [])];
  const sunshine  = [...(r2022.daily.sunshine_duration  || []), ...(r2023.daily.sunshine_duration  || [])]; // seconds
  return {
    mode: 'normals',
    tMax: round1(avg(maxTemps)),
    tMin: round1(avg(minTemps)),
    precipDay: round1(avg(precip)),
    sunshineH: round1(avg(sunshine) / 3600),
    icon: avg(sunshine) / 3600 > 6 ? '☀' : avg(sunshine) / 3600 > 3 ? '🌤' : '⛅',
  };
}

async function getForecast(loc) {
  const data = await fetchForecast(loc);
  const d = data.daily;
  return {
    mode: 'forecast',
    days: (d.temperature_2m_max || []).map((_, i) => ({
      date: d.time[i],
      tMax: Math.round(d.temperature_2m_max[i]),
      tMin: Math.round(d.temperature_2m_min[i]),
      precip: d.precipitation_probability_max[i],
      wmo: d.weathercode[i],
      icon: WMO_ICON[d.weathercode[i]] || '⛅',
    })),
  };
}

function daysUntilTrip() {
  return Math.floor((new Date(TRIP_START) - new Date()) / 86400000);
}

function renderNormals(loc, w) {
  return `
    <div class="weather-card">
      <div class="weather-card__head">
        <span class="weather-card__icon">${w.icon}</span>
        <div>
          <div class="weather-card__name">${loc.name}</div>
          <div class="weather-card__sub">${loc.sub}</div>
        </div>
      </div>
      <div class="weather-card__temps">
        <span class="weather-card__tmax">${w.tMax !== null ? w.tMax + '°' : '—'}</span>
        <span class="weather-card__sep">/</span>
        <span class="weather-card__tmin">${w.tMin !== null ? w.tMin + '°' : '—'}</span>
      </div>
      <div class="weather-card__stats">
        <div class="weather-stat"><span>💧</span><span>${w.precipDay !== null ? w.precipDay + ' mm/dzień' : '—'}</span></div>
        <div class="weather-stat"><span>☀</span><span>${w.sunshineH !== null ? w.sunshineH + ' h słońca/dzień' : '—'}</span></div>
      </div>
    </div>`;
}

function renderForecast(loc, w) {
  const dayItems = w.days.slice(0, 8).map(d => {
    const dateStr = new Date(d.date).toLocaleDateString('pl', { weekday: 'short', day: 'numeric', month: 'numeric' });
    return `
      <div class="fc-day">
        <div class="fc-day__date">${dateStr}</div>
        <div class="fc-day__icon">${d.icon}</div>
        <div class="fc-day__temps"><b>${d.tMax}°</b> <span>${d.tMin}°</span></div>
        ${d.precip != null ? `<div class="fc-day__precip">${d.precip}%</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="weather-forecast-card">
      <div class="weather-card__name">${loc.name} <span class="weather-card__sub">— ${loc.sub}</span></div>
      <div class="fc-days">${dayItems}</div>
    </div>`;
}

function renderError(loc) {
  return `<div class="weather-card weather-card--error"><div class="weather-card__name">${loc.name}</div><p class="weather-card__sub">Brak danych</p></div>`;
}

export async function initWeather(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const until = daysUntilTrip();
  const isForecast = until <= 14;

  const label = isForecast
    ? `Prognoza na wyjazd (${until} dni do startu)`
    : `Klimatologia września (dane historyczne 2022–2023)`;

  el.innerHTML = `
    <p class="weather-mode">${label}</p>
    <div class="weather-grid" id="weather-grid">
      ${LOCATIONS.map(l => `<div class="weather-loading" id="w-${l.id}">⏳ ${l.name}…</div>`).join('')}
    </div>`;

  await Promise.all(LOCATIONS.map(async loc => {
    const slot = document.getElementById(`w-${loc.id}`);
    try {
      const w = isForecast ? await getForecast(loc) : await getClimateNormals(loc);
      slot.outerHTML = isForecast ? renderForecast(loc, w) : renderNormals(loc, w);
    } catch {
      if (slot) slot.outerHTML = renderError(loc);
    }
  }));
}
