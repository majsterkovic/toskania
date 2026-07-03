/**
 * Leaflet.js maps module — Toskania 2026
 * Używa globalnego L (Leaflet ładowany z CDN w index.html)
 */

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// CartoDB Positron — darmowe, bez klucza API, pastelowe tło idealne dla toskańskiej palety
const CARTO_TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTR = '© <a href="https://carto.com/attributions">CARTO</a>, ' + OSM_ATTR;

const ICON_COLORS = {
  home: '#5c6b45',
  base: '#b85c38',
  transit_night: '#9a8f82',
  transit: '#9a8f82',
  attraction: '#b85c38',
  nature: '#5c6b45',
  popular: '#c4860a',
};

const ICON_SIZE = {
  home: 14,
  base: 18,
  transit_night: 12,
  transit: 10,
  attraction: 12,
  nature: 12,
  popular: 14,
};

function makeIcon(type) {
  const color = ICON_COLORS[type] || '#9a8f82';
  const size = ICON_SIZE[type] || 12;
  const border = type === 'base' || type === 'home' ? '#fff' : color;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">
      <circle cx="${size}" cy="${size}" r="${size - 2}" fill="${color}" stroke="${border}" stroke-width="2"/>
    </svg>`;
  return window.L.divIcon({
    html: svg,
    className: '',
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -(size + 4)],
  });
}

function tileLayer() {
  return window.L.tileLayer(CARTO_TILE, {
    attribution: CARTO_ATTR,
    maxZoom: 19,
    subdomains: 'abcd',
  });
}

/**
 * Mapa przeglądowa całej trasy (Poznań → Toskania → Poznań)
 */
export function initRouteOverviewMap(containerId, mapConfig) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el || !mapConfig?.route_overview?.length) return;

  const map = window.L.map(el, { zoomControl: true, scrollWheelZoom: false });
  tileLayer(el).addTo(map);

  const points = mapConfig.route_overview;
  const latLngs = points.map(p => p.coords);

  // Linia trasy (tam + powrót jako jedna pętla)
  window.L.polyline(latLngs, {
    color: '#b85c38',
    weight: 2.5,
    opacity: 0.7,
    dashArray: '6 4',
  }).addTo(map);

  // Markery
  points.forEach(p => {
    window.L.marker(p.coords, { icon: makeIcon(p.type) })
      .bindPopup(`<strong>${p.label}</strong>`, { maxWidth: 180 })
      .addTo(map);
  });

  map.fitBounds(window.L.latLngBounds(latLngs), { padding: [24, 24] });
  return map;
}

/**
 * Mapa Toskanii — wszystkie bazy i atrakcje
 */
export function initTuscanyOverviewMap(containerId, mapConfig) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el || !mapConfig?.tuscany_overview?.length) return;

  const map = window.L.map(el, { zoomControl: true, scrollWheelZoom: false });
  tileLayer(el).addTo(map);

  const points = mapConfig.tuscany_overview;
  const bases = points.filter(p => p.type === 'base');
  const others = points.filter(p => p.type !== 'base');

  // Połącz bazy linią przejazdu
  if (bases.length > 1) {
    window.L.polyline(bases.map(b => b.coords), {
      color: '#b85c38',
      weight: 2,
      opacity: 0.6,
      dashArray: '8 5',
    }).addTo(map);
  }

  // Markery
  points.forEach(p => {
    const icon = makeIcon(p.type);
    const popup = p.days
      ? `<strong>${p.label}</strong><br><em>${p.days}</em>`
      : `<strong>${p.label}</strong>`;
    window.L.marker(p.coords, { icon })
      .bindPopup(popup, { maxWidth: 200 })
      .addTo(map);
  });

  const latLngs = points.map(p => p.coords);
  map.fitBounds(window.L.latLngBounds(latLngs), { padding: [32, 32] });
  return map;
}

/**
 * Mini mapa dnia — baza + atrakcje dnia
 */
export function initDayMap(containerId, base, attractions) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el) return;

  const map = window.L.map(el, { zoomControl: false, scrollWheelZoom: false });
  window.L.tileLayer(OSM_TILE, { attribution: OSM_ATTR, maxZoom: 18 }).addTo(map);

  const latLngs = [];

  if (base?.coords) {
    window.L.marker(base.coords, { icon: makeIcon('base') })
      .bindPopup(`<strong>${base.name}</strong><br><em>baza</em>`, { maxWidth: 160 })
      .addTo(map);
    latLngs.push(base.coords);
  }

  (attractions || []).forEach(a => {
    if (!a.coords) return;
    latLngs.push(a.coords);
    window.L.marker(a.coords, { icon: makeIcon(a.type === 'nature' ? 'nature' : 'attraction') })
      .bindPopup(`<strong>${a.name}</strong>${a.drive_min ? `<br><em>${a.drive_min} min od bazy</em>` : ''}`, { maxWidth: 180 })
      .addTo(map);
  });

  if (base?.coords && latLngs.length > 1) {
    window.L.polyline(
      [base.coords, ...latLngs.slice(1)],
      { color: '#9a8f82', weight: 1.5, dashArray: '4 3', opacity: 0.5 }
    ).addTo(map);
  }

  if (latLngs.length === 1) {
    map.setView(latLngs[0], 12);
  } else if (latLngs.length > 1) {
    map.fitBounds(window.L.latLngBounds(latLngs), { padding: [28, 28] });
  }

  return map;
}

/**
 * Inicjalizuje wszystkie mapy na stronie po wyrenderowaniu HTML
 */
export function initAllMaps(plan) {
  if (!window.L) return;

  // Mapa overview trasy
  initRouteOverviewMap('map-route-overview', plan.meta?.map_config);

  // Mapa Toskanii
  initTuscanyOverviewMap('map-tuscany-overview', plan.meta?.map_config);

  // Mini mapy per dzień
  const basesById = {};
  (plan.bases || []).forEach(b => { basesById[b.id] = b; });

  (plan.days || []).forEach(day => {
    if (!day.day_num) return;
    const mapId = `map-day-${day.day_num}`;
    const el = document.getElementById(mapId);
    if (!el) return;

    const base = basesById[day.base_id];
    initDayMap(mapId, base, day.attractions);
  });
}
