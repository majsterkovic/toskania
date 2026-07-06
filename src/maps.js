/**
 * Leaflet.js maps module — Toskania 2026
 * Używa globalnego L (Leaflet ładowany z CDN w index.html)
 */

const OSM_ATTR   = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = '© <a href="https://carto.com/attributions">CARTO</a>, ' + OSM_ATTR;

const VOYAGER_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_TILE    = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function isDarkMode() { return document.documentElement.classList.contains('dark'); }
function activeTileUrl() { return isDarkMode() ? DARK_TILE : VOYAGER_TILE; }

// Registry of active Leaflet map instances — rebuilt on every mount
const _maps = [];

export function destroyAllMaps() {
  _maps.forEach(({ map }) => { try { map.remove(); } catch (_) {} });
  _maps.length = 0;
}

function registerMap(entry) { _maps.push(entry); return entry; }

/** Call after toggling html.dark to swap tile layers on all initialised maps */
export function swapMapTiles() {
  const tileUrl = activeTileUrl();
  _maps.forEach(({ map }) => {
    map.eachLayer(layer => {
      if (layer instanceof window.L.TileLayer) map.removeLayer(layer);
    });
    window.L.tileLayer(tileUrl, { attribution: CARTO_ATTR, maxZoom: 18, subdomains: 'abcd' }).addTo(map);
  });
}

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

/**
 * Mapa przeglądowa całej trasy (Poznań → Toskania → Poznań)
 */
export function initRouteOverviewMap(containerId, mapConfig) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el || !mapConfig?.route_overview?.length) return;

  const map = window.L.map(el, { zoomControl: true, scrollWheelZoom: false });
  window.L.tileLayer(activeTileUrl(), { attribution: CARTO_ATTR, maxZoom: 18, subdomains: 'abcd' }).addTo(map);
  registerMap({ map, type: 'route' });

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
 * Pobiera trasę drogową z OSRM z cache'owaniem w localStorage.
 * waypointsLatLon: [[lat, lon], [lat, lon], ...]
 * Zwraca Promise<{ route: [[lat,lon],...], distanceKm: number }> lub null przy błędzie.
 */
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_CACHE_KEY_PREFIX = 'osrm_v2_';

async function fetchOSRMRoute(waypointsLatLon) {
  if (!waypointsLatLon || waypointsLatLon.length < 2) return null;
  const roundedKey = waypointsLatLon.map(([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`).join(';');
  const cacheKey = OSRM_CACHE_KEY_PREFIX + roundedKey;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // OSRM: lon,lat order
  const coordStr = waypointsLatLon.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `${OSRM_BASE}/${coordStr}?overview=full&geometries=geojson`;

  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const routeData = data.routes?.[0];
    if (!routeData?.geometry?.coordinates) return null;
    const route = routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const distanceKm = Math.round((routeData.distance || 0) / 1000);
    const result = { route, distanceKm };
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch (_) {}
    return result;
  } catch (_) {
    return null;
  }
}

/**
 * Mini mapa dnia — baza + atrakcje dnia
 */
export function initDayMap(containerId, base, attractions) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el) return;

  const map = window.L.map(el, { zoomControl: false, scrollWheelZoom: false });
  window.L.tileLayer(activeTileUrl(), { attribution: CARTO_ATTR, maxZoom: 18, subdomains: 'abcd' }).addTo(map);
  registerMap({ map, type: 'day' });

  const latLngs = [];
  const atts = (attractions || []).filter(a => a.coords);

  if (base?.coords) {
    window.L.marker(base.coords, { icon: makeIcon('base') })
      .bindPopup(`<strong>${base.name}</strong><br><em>baza</em>`, { maxWidth: 160 })
      .addTo(map);
    latLngs.push(base.coords);
  }

  atts.forEach(a => {
    latLngs.push(a.coords);
    window.L.marker(a.coords, { icon: makeIcon(a.type === 'nature' ? 'nature' : 'attraction') })
      .bindPopup(`<strong>${a.name}</strong>${a.drive_min ? `<br><em>${a.drive_min} min od bazy</em>` : ''}`, { maxWidth: 180 })
      .addTo(map);
  });

  // Fallback: prosta linia (zastąpiona trasą drogową gdy OSRM odpowie)
  let routeLayer = null;
  if (base?.coords && latLngs.length > 1) {
    routeLayer = window.L.polyline(
      [base.coords, ...latLngs.slice(1)],
      { color: '#9a8f82', weight: 1.5, dashArray: '4 3', opacity: 0.4 }
    ).addTo(map);
  }

  if (latLngs.length === 1) {
    map.setView(latLngs[0], 12);
  } else if (latLngs.length > 1) {
    map.fitBounds(window.L.latLngBounds(latLngs), { padding: [28, 28] });
  }

  // Async: pobierz trasę drogową + km (z cache lub OSRM)
  if (base?.coords && atts.length > 0) {
    // Round trip: base → attractions → base
    const waypoints = [base.coords, ...atts.map(a => a.coords), base.coords];
    fetchOSRMRoute(waypoints).then(result => {
      if (!result || !map._container) return;
      const { route, distanceKm } = result;
      if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
      window.L.polyline(route, { color: '#9a8f82', weight: 2.5, opacity: 0.75 }).addTo(map);
      // Km badge (Leaflet custom control)
      if (distanceKm > 0) {
        const kmCtrl = window.L.control({ position: 'bottomleft' });
        kmCtrl.onAdd = () => {
          const div = window.L.DomUtil.create('div', 'map-km-badge');
          div.innerHTML = `🚗 ${distanceKm} km`;
          return div;
        };
        kmCtrl.addTo(map);
      }
    });
  }

  return map;
}

const BASE_ACCENT = {
  base1: '#5c6b45',
  base2: '#b85c38',
  base3: '#8f3f28',
};

const TYPE_COLOR = {
  nature: '#5c6b45',
  popular: '#c4860a',
  medieval: '#7a5c3a',
  cultural: '#4a6b8a',
};

const TYPE_LABEL = { medieval: 'średniowiecze', nature: 'natura', cultural: 'kultura', popular: 'popularne' };

/**
 * Duża interaktywna mapa Toskanii z filtrami po dniach, numerowanymi markerami i panelem bocznym
 */
export function initInteractiveMap(containerId, plan) {
  if (!window.L) return;
  const el = document.getElementById(containerId);
  if (!el) return;

  const L = window.L;
  const panel = document.getElementById('imap-panel');

  const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, tap: false });
  L.tileLayer(activeTileUrl(), { attribution: CARTO_ATTR, maxZoom: 18, subdomains: 'abcd' }).addTo(map);
  registerMap({ map, type: 'interactive' });

  const tuscanyDays = (plan.days || []).filter(d =>
    ['tuscany', 'tuscany_transfer', 'tuscany_popular'].includes(d.type) && d.day_num != null
  );

  const basesById = {};
  (plan.bases || []).forEach(b => { basesById[b.id] = b; });

  const layerGroups = {};
  const allGroup = L.layerGroup().addTo(map);
  const allLatLngs = [];

  // "All" view: base markers + small dots for attractions
  const allBaseMarkers = {};
  (plan.bases || []).forEach(base => {
    if (!base.coords) return;
    const color = BASE_ACCENT[base.id] || '#b85c38';
    allBaseMarkers[base.id] = L.marker(base.coords, { icon: makePinIcon(color, 20, true) })
      .bindPopup(`<strong>${base.name}</strong><br><span style="color:${color};font-size:.8em">● baza noclegowa</span>`, { maxWidth: 200 })
      .addTo(allGroup);
    allLatLngs.push(base.coords);
  });

  tuscanyDays.forEach(day => {
    const group = L.layerGroup();
    layerGroups[day.day_num] = group;

    const base = basesById[day.base_id];
    const accentColor = BASE_ACCENT[day.base_id] || '#9a8f82';
    const atts = (day.attractions || []).filter(a => a.coords);

    // Base marker for this day
    if (base?.coords) {
      L.marker(base.coords, { icon: makePinIcon(accentColor, 20, true) })
        .bindPopup(`<b>${base.name}</b><br><span style="opacity:.7;font-size:.85em">baza · Dzień ${day.day_num}</span>`)
        .addTo(group);
    }

    // Numbered markers + route polyline
    const routeCoords = base?.coords ? [base.coords] : [];
    atts.forEach((att, idx) => {
      allLatLngs.push(att.coords);
      routeCoords.push(att.coords);

      const typeColor = TYPE_COLOR[att.type] || accentColor;
      const num = idx + 1;

      // numbered icon for day view
      L.marker(att.coords, { icon: makeNumberedIcon(num, typeColor) })
        .bindPopup(buildPopup(att, day, num), { maxWidth: 260 })
        .addTo(group);

      // small dot for "all" view
      L.marker(att.coords, { icon: makePinIcon(typeColor, 11, false) })
        .bindPopup(buildPopup(att, day, null), { maxWidth: 260 })
        .addTo(allGroup);
    });

    // Route polyline: prosta linia jako fallback, zastąpiona trasą drogową z OSRM
    let dayPolyline = null;
    const roundTripCoords = base?.coords ? [...routeCoords, base.coords] : routeCoords;
    if (routeCoords.length > 1) {
      dayPolyline = L.polyline(routeCoords, {
        color: accentColor, weight: 2, opacity: 0.45, dashArray: '7 5',
      }).addTo(group);

      fetchOSRMRoute(roundTripCoords).then(result => {
        if (!result || !map._container) return;
        const { route, distanceKm } = result;
        if (dayPolyline) { group.removeLayer(dayPolyline); dayPolyline = null; }
        L.polyline(route, { color: accentColor, weight: 2.5, opacity: 0.8 }).addTo(group);
        // Store distanceKm for panel display
        if (distanceKm > 0) layerGroups[day.day_num]._distanceKm = distanceKm;
      });
    }
  });

  // Base-to-base line in "all" view
  const baseCoords = (plan.bases || []).filter(b => b.coords).map(b => b.coords);
  if (baseCoords.length > 1) {
    L.polyline(baseCoords, { color: '#b85c38', weight: 2, opacity: 0.4, dashArray: '10 7' }).addTo(allGroup);
  }

  if (allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs), { padding: [36, 36] });

  // ── Panel update ──────────────────────────────────────────
  function updatePanel(dayNum) {
    if (!panel) return;
    if (dayNum === 'all') {
      panel.innerHTML = `<div class="imap-panel__placeholder"><span class="imap-panel__hint">Wszystkie dni</span><p>Wybierz konkretny dzień żeby zobaczyć numerowaną trasę i szczegóły.</p></div>`;
      return;
    }
    const day = tuscanyDays.find(d => d.day_num === dayNum);
    const base = day ? basesById[day.base_id] : null;
    if (!day) { panel.innerHTML = ''; return; }

    const atts = (day.attractions || []).filter(a => a.coords);
    const accentColor = BASE_ACCENT[day.base_id] || '#9a8f82';

    const attItems = atts.map((att, idx) => {
      const num = idx + 1;
      const typeColor = TYPE_COLOR[att.type] || accentColor;
      const isCar = att.drive_min > 0;
      const modeHtml = isCar
        ? `<span class="imap-att__mode imap-att__mode--car">🚗 ${att.drive_min} min od bazy</span>`
        : `<span class="imap-att__mode imap-att__mode--walk">🚶 pieszo od bazy</span>`;
      const typeLabel = TYPE_LABEL[att.type] || att.type || '';

      return `
        <li class="imap-att">
          <div class="imap-att__num" style="background:${typeColor}">${num}</div>
          <div class="imap-att__body">
            <div class="imap-att__name">${att.name}</div>
            <div class="imap-att__meta">
              ${typeLabel ? `<span class="imap-att__type">${typeLabel}</span>` : ''}
              ${modeHtml}
            </div>
            ${att.description ? `<div class="imap-att__desc">${att.description.slice(0, 110)}${att.description.length > 110 ? '…' : ''}</div>` : ''}
          </div>
        </li>`;
    }).join('');

    const foodHtml = day.food?.place ? `
      <div class="imap-panel__food">
        <span class="imap-panel__food-icon">🍽</span>
        <div>
          <div class="imap-panel__food-name">${day.food.place}</div>
          ${day.food.price ? `<div class="imap-panel__food-price">${day.food.price}</div>` : ''}
        </div>
      </div>` : '';

    const distKm = layerGroups[day.day_num]?._distanceKm;
    const kmHtml = distKm ? `<div class="imap-panel__km">🚗 ${distKm} km dzienny objazd</div>` : '';

    panel.innerHTML = `
      <div class="imap-panel__head">
        <div class="imap-panel__day">Dzień ${day.day_num}</div>
        <div class="imap-panel__date">${day.date || ''}</div>
        <div class="imap-panel__title">${day.title || ''}</div>
        ${base ? `<div class="imap-panel__base">📍 ${base.name}</div>` : ''}
        ${kmHtml}
      </div>
      <ul class="imap-att-list">${attItems || '<li class="imap-att imap-att--empty">Brak atrakcji z współrzędnymi</li>'}</ul>
      ${foodHtml}
    `;
  }

  // ── Filter wiring ──────────────────────────────────────────
  const filterBtns = document.querySelectorAll('[data-imap-day]');

  function showDay(dayNum) {
    Object.values(layerGroups).forEach(g => map.removeLayer(g));
    map.removeLayer(allGroup);

    if (dayNum === 'all') {
      allGroup.addTo(map);
      if (allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs), { padding: [36, 36] });
    } else {
      const group = layerGroups[dayNum];
      if (group) {
        group.addTo(map);
        const lls = [];
        group.eachLayer(l => { if (l.getLatLng) lls.push(l.getLatLng()); });
        if (lls.length === 1) map.setView(lls[0], 13);
        else if (lls.length > 1) map.fitBounds(L.latLngBounds(lls), { padding: [52, 52] });
      }
    }

    filterBtns.forEach(btn => {
      btn.classList.toggle('map-filter--active', btn.dataset.imapDay === String(dayNum));
    });

    updatePanel(dayNum);
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.imapDay;
      showDay(val === 'all' ? 'all' : Number(val));
    });
  });

  updatePanel('all');
  return map;
}

function buildPopup(att, day, num) {
  const typeLabel = TYPE_LABEL[att.type] || att.type || '';
  const numBadge = num != null ? `<span style="display:inline-block;background:${TYPE_COLOR[att.type]||'#9a8f82'};color:#fff;border-radius:50%;width:18px;height:18px;text-align:center;line-height:18px;font-size:0.72rem;font-weight:700;margin-right:4px">${num}</span>` : '';
  const mode = att.drive_min > 0 ? `🚗 ${att.drive_min} min od bazy` : '🚶 pieszo od bazy';
  return `
    <div style="font-family:'Outfit',sans-serif;font-size:0.82rem;min-width:170px">
      <div style="font-weight:600;font-size:0.9rem;margin-bottom:3px">${numBadge}${att.name}</div>
      <div style="color:#6b6258;margin-bottom:3px">Dzień ${day.day_num} · ${typeLabel}</div>
      <div style="color:#9a8f82;font-size:0.78rem;margin-bottom:4px">${mode}</div>
      ${att.description ? `<div style="color:#2a2420;line-height:1.4">${att.description.slice(0, 130)}${att.description.length > 130 ? '…' : ''}</div>` : ''}
    </div>`;
}

function makeNumberedIcon(num, color) {
  const size = 28;
  const r = 14;
  const fontSize = num > 9 ? 9 : 11;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
    <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="${r}" y="${r}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="'Outfit',sans-serif" font-size="${fontSize}" font-weight="700">${num}</text>
    <line x1="${r}" y1="${size - 1}" x2="${r}" y2="${size + 7}" stroke="${color}" stroke-width="2"/>
  </svg>`;
  return window.L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [r, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
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
 * Inicjalizuje mapy przeglądowe natychmiast, a mini mapy dnia leniwie —
 * dopiero po zakończeniu animacji scroll-reveal karty (opacity:0→1, 0.4s).
 * Dzięki temu Leaflet zawsze dostaje kontener o prawidłowych wymiarach
 * i nie potrzebuje invalidateSize.
 */
export function initAllMaps(plan) {
  if (!window.L) return;

  const basesById = {};
  (plan.bases || []).forEach(b => { basesById[b.id] = b; });

  // Mapy przeglądowe są poza animowanymi kartami — init od razu
  initInteractiveMap('map-tuscany-interactive', plan);
  initRouteOverviewMap('map-route-overview', plan.meta?.map_config);

  // Mini mapy dnia: leniwa inicjalizacja — dopiero gdy karta staje się widoczna
  (plan.days || []).forEach(day => {
    if (!day.day_num) return;
    const mapId = `map-day-${day.day_num}`;
    const mapEl = document.getElementById(mapId);
    if (!mapEl) return;
    const card = mapEl.closest('.day-card');

    function doInit() {
      initDayMap(mapId, basesById[day.base_id], day.attractions);
    }

    // Karta bez scroll-reveal: init natychmiast
    if (!card || !card.classList.contains('reveal')) {
      setTimeout(doInit, 50);
      return;
    }

    // Karta już widoczna gdy initAllMaps odpali (np. góra strony):
    // czekamy 450ms na ewentualne resztki animacji
    if (card.classList.contains('is-visible')) {
      setTimeout(doInit, 450);
      return;
    }

    // Czekamy na dodanie is-visible przez scroll-reveal, potem init po transition (0.4s)
    const mo = new MutationObserver(() => {
      if (card.classList.contains('is-visible')) {
        mo.disconnect();
        setTimeout(doInit, 420);
      }
    });
    mo.observe(card, { attributes: true, attributeFilter: ['class'] });

    // Zabezpieczenie przed race condition: is-visible mogło być dodane między
    // sprawdzeniem wyżej a ustawieniem MutationObserver
    if (card.classList.contains('is-visible')) {
      mo.disconnect();
      setTimeout(doInit, 450);
    }
  });
}
