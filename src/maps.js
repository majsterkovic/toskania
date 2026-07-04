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

// CartoDB Voyager — bardziej kartograficzny styl, bez klucza API
const VOYAGER_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

const BASE_ACCENT = {
  base1: '#5c6b45',
  base2: '#b85c38',
  base3: '#8f3f28',
};

/**
 * Duża interaktywna mapa Toskanii z filtrami po dniach
 */
export function initInteractiveMap(containerId, plan) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el) return;

  const L = window.L;

  const map = L.map(el, {
    zoomControl: true,
    scrollWheelZoom: false,
    tap: false,
  });

  L.tileLayer(VOYAGER_TILE, {
    attribution: CARTO_ATTR,
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(map);

  // Collect all days with attractions that have coords
  const tuscanyDays = (plan.days || []).filter(d =>
    ['tuscany', 'tuscany_transfer', 'tuscany_popular'].includes(d.type) &&
    d.day_num != null
  );

  const basesById = {};
  (plan.bases || []).forEach(b => { basesById[b.id] = b; });

  // Layer groups per day + "all"
  const layerGroups = {};      // day_num → L.LayerGroup
  const allMarkers = L.layerGroup().addTo(map);
  const allLatLngs = [];

  // Base markers (always visible as anchors)
  const baseMarkers = {};
  (plan.bases || []).forEach(base => {
    if (!base.coords) return;
    const accent = BASE_ACCENT[base.id] || '#b85c38';
    const icon = makePinIcon(accent, 20, true);
    const m = L.marker(base.coords, { icon })
      .bindPopup(`<strong>${base.name}</strong><br><span style="color:${accent};font-size:0.8em">● baza noclegowa</span>`, { maxWidth: 200 });
    baseMarkers[base.id] = m;
    allLatLngs.push(base.coords);
  });

  tuscanyDays.forEach(day => {
    const group = L.layerGroup();
    layerGroups[day.day_num] = group;

    const base = basesById[day.base_id];
    const accent = BASE_ACCENT[day.base_id] || '#9a8f82';

    // Add base marker to this day's layer
    if (base?.coords) {
      const icon = makePinIcon(accent, 18, true);
      L.marker(base.coords, { icon })
        .bindPopup(`<strong>${base.name}</strong><br><span style="opacity:.7;font-size:.85em">baza Dnia ${day.day_num}</span>`, { maxWidth: 200 })
        .addTo(group);
    }

    (day.attractions || []).forEach(att => {
      if (!att.coords) return;
      allLatLngs.push(att.coords);
      const typeColor = att.type === 'nature' ? '#5c6b45' : att.type === 'popular' ? '#c4860a' : accent;
      const icon = makePinIcon(typeColor, 13, false);
      const popup = buildPopup(att, day);
      L.marker(att.coords, { icon })
        .bindPopup(popup, { maxWidth: 240 })
        .addTo(group);

      // Also add to "all" layer
      L.marker(att.coords, { icon: makePinIcon(typeColor, 13, false) })
        .bindPopup(popup, { maxWidth: 240 })
        .addTo(allMarkers);
    });
  });

  // Add all base markers to "all" view
  Object.values(baseMarkers).forEach(m => m.addTo(allMarkers));

  // Draw base-to-base route
  const baseCoords = (plan.bases || []).filter(b => b.coords).map(b => b.coords);
  if (baseCoords.length > 1) {
    L.polyline(baseCoords, {
      color: '#b85c38', weight: 2.5, opacity: 0.5, dashArray: '8 6',
    }).addTo(allMarkers);
  }

  if (allLatLngs.length) {
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [36, 36] });
  }

  // ── Filter wiring (buttons already in DOM, wired via JS) ──
  const filterBtns = document.querySelectorAll(`[data-imap-day]`);
  let activeDayNum = 'all';

  function showDay(dayNum) {
    activeDayNum = dayNum;

    // Remove all layers
    Object.values(layerGroups).forEach(g => map.removeLayer(g));
    map.removeLayer(allMarkers);

    if (dayNum === 'all') {
      allMarkers.addTo(map);
      if (allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs), { padding: [36, 36] });
    } else {
      const group = layerGroups[dayNum];
      if (group) {
        group.addTo(map);
        const lls = [];
        group.eachLayer(l => {
          if (l.getLatLng) lls.push(l.getLatLng());
        });
        if (lls.length === 1) map.setView(lls[0], 13);
        else if (lls.length > 1) map.fitBounds(L.latLngBounds(lls), { padding: [48, 48] });
      }
    }

    filterBtns.forEach(btn => {
      const isActive = btn.dataset.imapDay === String(dayNum);
      btn.classList.toggle('map-filter--active', isActive);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.imapDay;
      showDay(val === 'all' ? 'all' : Number(val));
    });
  });

  return map;
}

function buildPopup(att, day) {
  const typeLabel = { medieval: 'średniowiecze', nature: 'natura', cultural: 'kultura', popular: 'popularne' }[att.type] || att.type || '';
  return `
    <div style="font-family:'Outfit',sans-serif;font-size:0.82rem;min-width:160px">
      <div style="font-weight:600;font-size:0.95rem;margin-bottom:2px">${att.name}</div>
      <div style="color:#6b6258;margin-bottom:4px">Dzień ${day.day_num} · ${typeLabel}</div>
      ${att.drive_min ? `<div style="color:#9a8f82">${att.drive_min} min od bazy</div>` : ''}
      ${att.description ? `<div style="margin-top:4px;color:#2a2420;line-height:1.4">${att.description.slice(0, 120)}${att.description.length > 120 ? '…' : ''}</div>` : ''}
    </div>`;
}

function makePinIcon(color, r, isBase) {
  const size = r * 2;
  const svg = isBase
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 6}" viewBox="0 0 ${size} ${size + 6}">
        <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#fff" stroke-width="2"/>
        <line x1="${r}" y1="${size - 1}" x2="${r}" y2="${size + 5}" stroke="${color}" stroke-width="2"/>
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${color}" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/>
       </svg>`;
  return window.L.divIcon({
    html: svg,
    className: '',
    iconSize: isBase ? [size, size + 6] : [size, size],
    iconAnchor: [r, isBase ? size + 6 : r],
    popupAnchor: [0, isBase ? -(size + 6) : -(r + 4)],
  });
}

/**
 * Inicjalizuje wszystkie mapy na stronie po wyrenderowaniu HTML
 */
export function initAllMaps(plan) {
  if (!window.L) return;

  // Duża interaktywna mapa Toskanii
  initInteractiveMap('map-tuscany-interactive', plan);

  // Mapa overview całej trasy
  initRouteOverviewMap('map-route-overview', plan.meta?.map_config);

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
