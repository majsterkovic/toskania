const BASE_COLORS = {
  base1: 'var(--olive)',
  base2: 'var(--terracotta)',
  base3: 'var(--terracotta-deep)',
};

// Etykiety i akcenty 4 etapów podróży (oś czasu + odznaka na stronie dnia).
// --olive-light zamiast --olive: w dark mode zwykłe --olive ma za niski
// kontrast na (prawie czarnym) tle (ten sam problem rozwiązuje już .oak-block).
const PHASE_EYEBROWS = { dojazd: 'Etap I', base1: 'Etap II', base2: 'Etap III', powrot: 'Etap IV' };
const PHASE_ACCENTS = {
  dojazd: 'var(--stone-dark)',
  base1: 'var(--olive-light)',
  base2: 'var(--terracotta)',
  powrot: 'var(--stone-dark)',
};

/**
 * Jedyne źródło prawdy dla przypisania dnia do etapu — używane zarówno przez
 * groupPhases (oś czasu) jak i dayPhaseInfo (odznaka na stronie dnia), żeby
 * obie klasyfikacje nigdy się nie rozjechały.
 */
function classifyDayPhases(days) {
  const map = new Map();
  let seenBase1 = false;
  let seenBase2 = false;
  days.forEach((day) => {
    let key;
    if (day.base_id === 'base1') {
      key = 'base1';
      seenBase1 = true;
    } else if (day.base_id === 'base2' || day.type === 'tuscany_transfer') {
      key = 'base2';
      seenBase2 = true;
    } else if (day.type === 'transit' && !seenBase1 && !seenBase2) {
      key = 'dojazd';
    } else {
      key = 'powrot';
    }
    map.set(day.day_num, key);
  });
  return map;
}

/** Etap + etykieta bazy/kierunku dla odznagi na stronie dnia. */
function dayPhaseInfo(day, days, meta, bases) {
  const key = classifyDayPhases(days).get(day.day_num);
  const eyebrow = PHASE_EYEBROWS[key];
  const accent = PHASE_ACCENTS[key];
  if (key === 'dojazd') return { eyebrow, label: meta.phase_labels.dojazd.label, accent };
  if (key === 'powrot') return { eyebrow, label: meta.phase_labels.powrot.label, accent };
  const base = (bases || []).find((b) => b.id === key);
  const label = base ? (base.region ? base.region.split('·')[0].trim() : base.name) : '';
  return { eyebrow, label, accent };
}

const ATTRACTION_LABELS = {
  medieval: 'średniowiecze',
  nature: 'natura',
  cultural: 'kultura',
  popular: 'popularne',
};

const BASE_URL = import.meta.env.BASE_URL;

// Generowany przez scripts/convert-webp.js (krok `npm run build`): { nazwa: {w, h, widths} }
import IMAGE_MANIFEST from './image-manifest.json';
import { esc } from './html.js';
import { config } from './trip.js';
import { reservationGroups, todoForChecklist } from './reservations.js';
import { doneStorageKey, getDoneIds, withoutDone } from './done.js';

function imgSrc(relativePath) {
  if (!relativePath) return '';
  const path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const resolved = config.imageAliases[path] || path;
  return `${BASE_URL}${resolved}`;
}

/** Klucz w image-manifest.json = nazwa pliku bez katalogu i rozszerzenia. */
function imageKey(src) {
  const file = src.split('/').pop() || '';
  return file.replace(/\.[a-z0-9]+$/i, '');
}

/** Pełny wariant WebP (bez sufiksu szerokości) — używany jako `src` i w lightboxie. */
function webpSrc(src) {
  return src.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * srcset + intrinsic wymiary dla obrazu. Warianty generuje scripts/convert-webp.js,
 * a image-manifest.json niesie ich faktyczne szerokości — dzięki temu deskryptory `w`
 * są prawdziwe, a przeglądarka pobiera 200px miniaturę zamiast pliku 1600px.
 */
function imgSources(src) {
  const meta = IMAGE_MANIFEST[imageKey(src)];
  const full = webpSrc(src);
  if (!meta) return { full, srcset: '', width: null, height: null };
  const base = full.replace(/\.webp$/i, '');
  const srcset = meta.widths
    .map((w) => `${w === meta.w ? full : `${base}-${w}.webp`} ${w}w`)
    .join(', ');
  return { full, srcset, width: meta.w, height: meta.h };
}

function resolvePlaceImage(images, key) {
  if (!key || !images?.places?.[key]) return null;
  const place = images.places[key];
  return {
    src: imgSrc(place.src),
    alt: place.alt || '',
    credit: place.credit || '',
  };
}

function renderImg({ src, alt, credit }, className = 'img', loading = 'lazy') {
  if (!src) return '';
  const { full, srcset, width, height } = imgSources(src);
  const sizes = config.imageSizes[className];
  const dims = width ? ` width="${width}" height="${height}"` : '';
  const priority = loading === 'eager' ? ' fetchpriority="high"' : '';
  return `
    <figure class="${className}">
      <picture>
        <source
          type="image/webp"
          srcset="${esc(srcset || full)}"${sizes ? `\n          sizes="${esc(sizes)}"` : ''} />
        <img src="${esc(src)}" alt="${esc(alt)}" loading="${loading}" decoding="async"${dims}${priority} />
      </picture>
      ${credit ? `<figcaption class="img-credit">${esc(credit)}</figcaption>` : ''}
    </figure>
  `;
}

function dayAccent(day) {
  if (day.type === 'transit') return 'var(--stone-dark)';
  if (day.type === 'buffer') return 'var(--muted)';
  if (day.base_id && BASE_COLORS[day.base_id]) return BASE_COLORS[day.base_id];
  return 'var(--muted)';
}

function shortDate(dateStr) {
  return dateStr.split(' ')[0];
}

function activeDays(days) {
  return days.filter((d) => d.day_num != null);
}

function renderHeader(meta, images) {
  const hero = images?.hero;
  const heroImg = hero ? renderImg({ src: imgSrc(hero.src), alt: hero.alt, credit: hero.credit }, 'hero__figure', 'eager') : '';
  const rs = meta.route_summary;
  const monthName = new Date(meta.start_date).toLocaleDateString('pl', { month: 'long' });
  const year = meta.start_date.slice(0, 4);

  return `
    <header class="hero" id="start">
      ${heroImg}
      <div class="hero__content">
        <p class="hero__eyebrow">Podróż samochodowa · ${esc(monthName)} ${esc(year)}</p>
        <h1>${esc(meta.title)}</h1>
        <p class="hero-dates">${esc(meta.dates)}</p>
        <p class="hero-subtitle">${esc(meta.subtitle)}</p>
        ${meta.participants_note ? `<p class="hero-note">${esc(meta.participants_note)}</p>` : ''}
        ${rs ? `
          <dl class="route-stats">
            <div class="route-stat">
              <dt>Łącznie</dt>
              <dd>${esc(rs.total_km)}</dd>
            </div>
            <div class="route-stat">
              <dt>Toskania</dt>
              <dd>${rs.tuscany_days} dni · ${rs.tuscany_bases} bazy</dd>
            </div>
            <div class="route-stat">
              <dt>Wyjazd</dt>
              <dd>${esc(rs.outbound_km)}</dd>
            </div>
            <div class="route-stat">
              <dt>Powrót</dt>
              <dd>${esc(rs.return_km)}</dd>
            </div>
          </dl>
        ` : ''}
      </div>
    </header>
  `;
}

export function renderInteractiveMap(days) {
  const mapDays = days.filter(d =>
    (['tuscany', 'tuscany_transfer', 'tuscany_popular'].includes(d.type) && d.day_num != null) ||
    (d.type === 'transit' && d.day_num != null && d.route_points?.length > 0)
  );

  const filterBtns = mapDays.map(day => {
    const km = day.daily_km_estimate ?? day.drive_km;
    const level = driveLevel(km);
    const kmSpan = km ? `<span class="map-filter__km" data-drive="${level}">~${km}km</span>` : '';
    return `
    <button type="button" class="map-filter" data-imap-day="${day.day_num}">
      <span class="map-filter__num">${day.day_num}</span>
      <span class="map-filter__date">${esc(day.date.split(' ')[0])}</span>
      ${kmSpan}
    </button>
  `;
  }).join('');

  return `
    <section class="section" id="mapa">
      <h1 class="section-title">Mapa Toskanii</h1>
      <p class="section-lead">Wybierz dzień — markery ponumerowane, linia trasy i lista atrakcji pojawią się obok.</p>
      <div class="imap-filters">
        <button type="button" class="map-filter map-filter--active" data-imap-day="all">
          <span class="map-filter__num">Wszystkie</span>
        </button>
        ${filterBtns}
      </div>
      <div class="imap-wrap">
        <div id="map-tuscany-interactive" class="leaflet-map leaflet-map--big" aria-label="Interaktywna mapa Toskanii z atrakcjami"></div>
        <aside id="imap-panel" class="imap-panel">
          <div class="imap-panel__placeholder">
            <span class="imap-panel__hint">Wybierz dzień</span>
            <p>Numerowane atrakcje i szczegóły trasy pojawią się tutaj.</p>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function driveLevel(km) {
  if (!km) return null;
  if (km >= 60) return 'high';
  if (km >= 40) return 'medium';
  return 'low';
}

// Zwijana sekcja (domyślnie zamknięta) — dla treści referencyjnej, którą
// czyta się dopiero na miejscu (kulinaria, las, logistyka). Kręgosłup dnia
// (atrakcje, crowd tip, ostrzeżenie) zostaje zawsze widoczny.
// Treść <summary> współdzielona przez wszystkie zwijane bloki: ikona + etykieta,
// a pod spodem jednolinijkowa zajawka widoczna tylko gdy panel jest zwinięty
// (ukrywana przez CSS na details[open]) — ten sam wzorzec co .research-item__preview.
function collapseSummaryInner(label, icon, teaser) {
  const iconHtml = icon ? `<span class="collapse-summary__icon" aria-hidden="true">${icon}</span>` : '';
  const teaserHtml = teaser ? `<span class="collapse-summary__teaser">${esc(teaser)}</span>` : '';
  return `
    <span class="collapse-summary__inner">
      <span class="collapse-summary__text">${iconHtml}${esc(label)}</span>
      ${teaserHtml}
    </span>
  `;
}

function collapsibleBlock(label, innerHtml, extraClass = '', { icon = '', teaser = '' } = {}) {
  if (!innerHtml) return '';
  const cls = ['day-block', 'collapse-block', extraClass].filter(Boolean).join(' ');
  return `
    <details class="${cls}">
      <summary class="block-label collapse-summary">${collapseSummaryInner(label, icon, teaser)}</summary>
      <div class="collapse-body">${innerHtml}</div>
    </details>
  `;
}

function renderFood(food) {
  if (!food) return '';
  const dishes =
    food.dishes?.length > 0
      ? `<ul class="dish-list">${food.dishes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
      : '';

  const optionsHtml = food.options?.length > 0
    ? `<div class="food-options">
        ${food.options.map(o => `
          <div class="food-option">
            <div class="food-option__head">
              <strong>${esc(o.name)}</strong>
              ${o.type ? `<span class="type-badge">${esc(o.type)}</span>` : ''}
            </div>
            ${o.address ? `<p class="food-option__note muted">${esc(o.address)}</p>` : ''}
            ${o.note ? `<p class="food-option__note">${esc(o.note)}</p>` : ''}
            ${o.price ? `<span class="price">${esc(o.price)}</span>` : ''}
          </div>`).join('')}
      </div>`
    : '';

  const gpsHtml = food.gps_hint && food.gps_hint !== food.address
    ? `<p class="food-gps muted">📍 ${esc(food.gps_hint)}</p>`
    : '';

  const inner = `
    <p class="food-place"><strong>${esc(food.place)}</strong></p>
    ${food.address ? `<p class="muted">${esc(food.address)}</p>` : ''}
    ${food.phone ? `<p class="food-phone muted">📞 <a href="tel:${esc(food.phone)}">${esc(food.phone)}</a></p>` : ''}
    ${food.opening_hours ? `<p class="food-hours muted">🕐 ${esc(food.opening_hours)}</p>` : ''}
    ${dishes}
    ${food.note ? `<p>${esc(food.note)}</p>` : ''}
    ${food.price ? `<p class="price">${esc(food.price)}</p>` : ''}
    ${gpsHtml}
    ${optionsHtml}
  `;
  return collapsibleBlock('Kulinaria', inner, 'day-block--food', { icon: '🍽️', teaser: food.place });
}

function renderAccommodation(acc) {
  if (!acc) return '';
  const options = renderAccommodationOptions(acc.options);
  return `
    <div class="day-block">
      <h4 class="block-label">Nocleg</h4>
      <p><strong>${esc(acc.place)}</strong></p>
      ${acc.note ? `<p>${esc(acc.note)}</p>` : ''}
      ${acc.local_shop ? `<p class="acc-shop">🥩 <strong>Sklep w okolicy (~10 min autem):</strong> ${esc(acc.local_shop)}</p>` : ''}
      ${acc.booking_tip ? `<p class="muted">${esc(acc.booking_tip)}</p>` : ''}
      ${acc.price ? `<p class="price">${esc(acc.price)}</p>` : ''}
      ${acc.gps_hint ? `<p class="food-gps muted">📍 ${esc(acc.gps_hint)}</p>` : ''}
      ${acc.contact ? `<p class="muted">☎ ${esc(acc.contact)}</p>` : ''}
      ${options}
    </div>
  `;
}

function renderAttractions(attractions, images) {
  if (!attractions?.length) return '';
  const items = attractions
    .map((a) => {
      const typeLabel = ATTRACTION_LABELS[a.type] || a.type;
      const drive = a.drive_min != null ? `<span class="drive-min">${a.drive_min} min od bazy</span>` : '';
      const imgKey = a.image_key || a.image;
      const placeImg = resolvePlaceImage(images, imgKey);
      const thumb = placeImg ? renderImg(placeImg, 'attraction-thumb') : '';
      const ticketPrice = a.entry_fee || a.ticket_price;
      const bookingUrl = a.url || a.booking_url;
      const metaItems = [
        a.opening_hours ? `🕐 ${esc(a.opening_hours)}` : '',
        ticketPrice ? `🎟 ${esc(ticketPrice)}` : '',
        bookingUrl ? `↗ <a href="${esc(bookingUrl)}" target="_blank" rel="noopener noreferrer" class="attraction-link">Rezerwacja online</a>` : '',
        a.parking_price ? `🅿 ${esc(a.parking_price)}` : '',
        a.duration_h ? `⏱ ok. ${a.duration_h}h` : '',
        a.gps_hint ? `📍 ${esc(a.gps_hint)}` : '',
      ].filter(Boolean);
      const metaHtml = metaItems.length
        ? `<div class="attraction-meta">${metaItems.map(m => `<span>${m}</span>`).join('')}</div>`
        : '';
      return `
        <li class="attraction">
          ${thumb}
          <div class="attraction-content">
            <div class="attraction-head">
              <strong>${esc(a.name)}</strong>
              ${drive}
              <span class="type-badge type-badge--${esc(a.type)}">${esc(typeLabel)}</span>
            </div>
            <p>${esc(a.description)}</p>
            ${metaHtml}
          </div>
        </li>
      `;
    })
    .join('');

  return `
    <div class="day-block">
      <h4 class="block-label">Atrakcje</h4>
      <ul class="attraction-list">${items}</ul>
    </div>
  `;
}

function renderOakForest(oak) {
  if (!oak) return '';
  const inner = `
    <p><strong>${esc(oak.spot)}</strong></p>
    <p class="muted">${esc(oak.species)}</p>
    <p>${esc(oak.note)}</p>
    ${oak.gps_hint ? `<p class="logistics-gps">📍 ${esc(oak.gps_hint)}</p>` : ''}
  `;
  return collapsibleBlock('Las dębowy', inner, 'oak-block', { icon: '🌳', teaser: oak.spot });
}

function renderWineTasting(wt) {
  if (!wt) return '';
  return `
    <div class="day-block day-block--wine">
      <h4 class="block-label">🍷 Degustacja wina</h4>
      <p><strong>${esc(wt.place)}</strong></p>
      ${wt.address ? `<p class="muted">${esc(wt.address)}</p>` : ''}
      ${wt.time ? `<p><span class="meta-label">Termin</span> ${esc(wt.time)}</p>` : ''}
      ${wt.price ? `<p class="price">${esc(wt.price)}</p>` : ''}
      ${wt.note ? `<p>${esc(wt.note)}</p>` : ''}
      ${wt.gps_hint ? `<p class="muted">📍 ${esc(wt.gps_hint)}</p>` : ''}
    </div>
  `;
}

function renderOpeningHours(day) {
  const hours = day.opening_hours;
  const entries = hours ? Object.entries(hours) : [];
  if (!entries.length) return '';
  const rows = entries.map(([k, v]) =>
    `<li><span class="oh-key">${esc(k.replace(/_/g, ' '))}</span> <span class="oh-val">${esc(v)}</span></li>`
  ).join('');
  const [firstKey, firstVal] = entries[0];
  const teaser = `${firstKey.replace(/_/g, ' ')}: ${firstVal}`;
  return `
    <details class="day-block oh-block">
      <summary class="block-label oh-summary">${collapseSummaryInner('Godziny otwarcia', '🕐', teaser)}</summary>
      <div class="collapse-body"><ul class="oh-list">${rows}</ul></div>
    </details>
  `;
}

function renderLogistics(day) {
  const tips = day.practical_tips || [];
  const p = day.parking;
  const parkingStrings = p && typeof p === 'object'
    ? Object.entries(p)
        .filter(([k, v]) => v && typeof v === 'string' && k !== 'options')
        .map(([k, v]) => `🅿 ${k.replace(/_/g, ' ')}: ${v}`)
    : [];
  const parkingOptions = (p?.options || []).map((o) => {
    const parts = [
      `🅿 <strong>${esc(o.name)}</strong>`,
      o.price ? `— ${esc(o.price)}` : '',
      o.gps_hint ? `<span class="logistics-gps">📍 ${esc(o.gps_hint)}</span>` : '',
      o.note ? `<span class="logistics-note">${esc(o.note)}</span>` : '',
    ].filter(Boolean);
    return parts.join(' ');
  });
  const fuelItems = (day.fuel_stops || []).map((s) => {
    const parts = [
      `⛽ <strong>${esc(s.name)}</strong>`,
      s.location ? `(${esc(s.location)})` : '',
      s.note ? `— ${esc(s.note)}` : '',
    ].filter(Boolean);
    return parts.join(' ');
  });
  const allTips = tips.map((t) => esc(t));
  const allLogistics = [...parkingStrings, ...parkingOptions, ...fuelItems];
  if (!allTips.length && !allLogistics.length) return '';
  const tipItems = allTips.map((t) => `<li class="logistics-tip">${t}</li>`).join('');
  const logItems = allLogistics.map((t) => `<li>${t}</li>`).join('');
  const inner = `<ul class="tips-list">${tipItems}${logItems}</ul>`;
  return collapsibleBlock('Logistyka i wskazówki', inner, 'day-block--practical', { icon: '🧭', teaser: tips[0] || '' });
}

function renderRouteSegments(segments) {
  if (!segments?.length) return '';
  const rows = segments
    .map(
      (s) => `
        <tr>
          <td class="route-seg__name">${esc(s.segment)}</td>
          <td class="route-seg__road"><code>${esc(s.road)}</code></td>
          <td class="route-seg__km">${esc(s.km)}</td>
          <td class="route-seg__note">${esc(s.note)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <div class="day-block">
      <h4 class="block-label">Etapy trasy</h4>
      <div class="route-segments-wrap">
        <table class="route-segments">
          <thead>
            <tr>
              <th>Odcinek</th>
              <th>Droga</th>
              <th>km</th>
              <th>Uwagi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}


function renderAccommodationOptions(options) {
  if (!options?.length) return '';
  const items = options.map((o) => `
    <div class="acc-card">
      <div class="acc-card__head">
        <strong class="acc-card__name">${esc(o.name)}</strong>
        ${o.type ? `<span class="type-badge">${esc(o.type)}</span>` : ''}
      </div>
      ${o.area ? `<p class="acc-card__area muted">📍 ${esc(o.area)}</p>` : ''}
      ${o.address ? `<p class="acc-card__address">${esc(o.address)}</p>` : ''}
      <div class="acc-card__meta">
        ${o.price ? `<span class="acc-card__price">${esc(o.price)}</span>` : ''}
        ${o.parking ? `<span class="acc-card__parking">🅿 ${esc(o.parking)}</span>` : ''}
        ${o.check_in ? `<span class="acc-card__checkin">🔑 ${esc(o.check_in)}</span>` : ''}
      </div>
      ${o.note ? `<p class="acc-card__note">${esc(o.note)}</p>` : ''}
      ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer" class="acc-card__link">↗ strona obiektu</a>` : ''}
    </div>`).join('');

  return `<div class="acc-cards">${items}</div>`;
}

function renderRouteWaypoints(routeStr) {
  if (!routeStr) return '';
  const waypoints = routeStr.split(' → ').map(s => s.trim()).filter(Boolean);
  if (waypoints.length < 2) return `<p class="meta-row">${esc(routeStr)}</p>`;
  const items = waypoints.map((wp, i) => {
    const isFirst = i === 0;
    const isLast = i === waypoints.length - 1;
    return `<li class="route-wp${isFirst ? ' route-wp--start' : isLast ? ' route-wp--end' : ''}">${esc(wp)}</li>`;
  }).join('');
  return `<ul class="route-waypoints">${items}</ul>`;
}

function renderWebResearch(webResearch) {
  if (!webResearch?.length) return '';
  const items = webResearch.map(item => {
    const summary = item.summary || '';
    const preview = summary.length > 100
      ? summary.slice(0, 97).replace(/\s+\S*$/, '') + '…'
      : summary;
    return `
    <details class="research-item">
      <summary class="research-item__summary">
        <div class="research-item__summary-inner">
          <div class="research-item__main">
            <span class="research-item__topic">${esc(item.topic)}</span>
            ${item.checked ? `<span class="research-item__checked">✓ ${esc(item.checked)}</span>` : ''}
          </div>
          ${preview ? `<span class="research-item__preview">${esc(preview)}</span>` : ''}
        </div>
      </summary>
      <div class="research-item__body">
        <p>${esc(summary)}</p>
        ${item.source ? `<a class="research-item__source" href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">↗ źródło</a>` : ''}
      </div>
    </details>
  `;
  }).join('');
  return `
    <details class="day-block collapse-block day-block--research">
      <summary class="block-label collapse-summary">
        <span class="collapse-summary__inner">
          <span class="collapse-summary__text"><span class="collapse-summary__icon" aria-hidden="true">🔎</span>Research <span class="research-count">${webResearch.length}</span></span>
        </span>
      </summary>
      <div class="collapse-body"><div class="research-list">${items}</div></div>
    </details>
  `;
}

function renderEtaTimeline(etaList, openByDefault = false) {
  if (!etaList?.length) return '';
  const rows = etaList.map(item =>
    `<li class="eta-row"><span class="eta-time">${esc(item.time)}</span><span class="eta-event">${esc(item.event)}</span></li>`
  ).join('');
  const teaser = `${etaList[0].time} · ${etaList[0].event}`;
  return `
    <details class="day-block eta-block"${openByDefault ? ' open' : ''}>
      <summary class="block-label oh-summary">${collapseSummaryInner('Harmonogram godzinowy', '⏱️', teaser)}</summary>
      <div class="collapse-body"><ul class="eta-list">${rows}</ul></div>
    </details>
  `;
}

function renderTransit(day, images) {
  const stats = [
    day.depart ? `<div class="transit-stat"><span class="transit-stat__label">Wyjazd</span><span>${esc(day.depart)}</span></div>` : '',
    day.drive_km ? `<div class="transit-stat"><span class="transit-stat__label">Dystans</span><span>${day.drive_km} km · ${esc(day.drive_h)}</span></div>` : '',
    day.arrival ? `<div class="transit-stat"><span class="transit-stat__label">Przyjazd</span><span>${esc(day.arrival)}</span></div>` : '',
  ].filter(Boolean).join('');

  return `
    ${stats ? `<div class="transit-stats">${stats}</div>` : ''}
    ${day.route ? `<div class="day-block day-block--route"><h4 class="block-label">Trasa</h4>${renderRouteWaypoints(day.route)}</div>` : ''}
    ${renderEtaTimeline(day.eta_timeline, true)}
    ${renderRouteSegments(day.route_segments)}
    ${renderFood(day.food)}
    ${renderAccommodation(day.accommodation)}
    ${renderLogistics(day)}
    ${renderOpeningHours(day)}
    ${renderWebResearch(day.web_research)}
  `;
}

function renderTuscany(day, images) {
  const driveLimit = day.drive_limit_min
    ? `<p class="meta-row"><span class="meta-label">Limit dojazdu</span> max ${day.drive_limit_min} min od bazy</p>`
    : '';

  const baseLabel = day.base_label
    ? `<p class="meta-row"><span class="meta-label">Baza</span> ${esc(day.base_label)}</p>`
    : '';

  const transfer =
    day.type === 'tuscany_transfer'
      ? `
        <div class="day-block transfer-block">
          <h4 class="block-label">Zmiana bazy</h4>
          ${day.transfer_depart ? `<p><span class="meta-label">Wyjazd</span> ${esc(day.transfer_depart)}</p>` : ''}
          ${day.transfer_km ? `<p>${day.transfer_km} km · ${esc(day.transfer_h)}</p>` : ''}
          ${day.transfer_route ? `<p>${esc(day.transfer_route)}</p>` : ''}
          ${renderAccommodation(day.accommodation)}
        </div>
      `
      : '';

  const crowdTip = day.crowd_tip
    ? `<div class="day-block crowd-tip"><h4 class="block-label">★ Unikaj tłumów</h4><p>${esc(day.crowd_tip)}</p></div>`
    : '';

  return `
    ${baseLabel}
    ${driveLimit}
    ${crowdTip}
    ${renderAttractions(day.attractions, images)}
    ${renderOakForest(day.oak_forest)}
    ${renderFood(day.food)}
    ${renderWineTasting(day.wine_tasting)}
    ${renderEtaTimeline(day.eta_timeline)}
    ${transfer}
    ${renderLogistics(day)}
    ${renderOpeningHours(day)}
    ${renderWebResearch(day.web_research)}
  `;
}

function renderBuffer(day) {
  return `<p class="buffer-note">${esc(day.note)}</p>`;
}

/** Ciało dnia: narracja + bloki (transit / tuscany / buffer). Współdzielone przez kartę i stronę dnia. */
function renderDayBody(day, images) {
  if (day.type === 'buffer') return renderBuffer(day);
  const narrativeHtml = day.narrative ? `<p class="day-narrative">${esc(day.narrative)}</p>` : '';
  return narrativeHtml + (day.type === 'transit' ? renderTransit(day, images) : renderTuscany(day, images));
}

export function renderGallery(images) {
  const places = images?.places;
  if (!places || !Object.keys(places).length) return '';

  // Kafelek to max ~310px (4 kolumny w kontenerze 1280px) — nie ma powodu
  // pobierać tu wariantu 1600px; ten idzie dopiero do lightboxa.
  const GRID_SIZES = '(min-width: 1024px) 310px, (min-width: 768px) 33vw, 50vw';

  const items = Object.entries(places)
    .map(([key, place]) => {
      const src = imgSrc(place.src);
      const { full, srcset, width, height } = imgSources(src);
      const label = place.alt || key;
      const dims = width ? ` width="${width}" height="${height}"` : '';
      return `
        <button
          type="button"
          class="gallery-item"
          data-src="${esc(full)}"
          data-alt="${esc(label)}"
          aria-label="Powiększ: ${esc(label)}"
        >
          <picture>
            <source type="image/webp" srcset="${esc(srcset || full)}" sizes="${esc(GRID_SIZES)}" />
            <img src="${esc(src)}" alt="${esc(label)}" loading="lazy" decoding="async"${dims} />
          </picture>
          <span class="gallery-item__caption">${esc(label)}</span>
        </button>
      `;
    })
    .join('');

  return `
    <section class="section" id="galeria">
      <h1 class="section-title">Galeria miejsc</h1>
      <p class="section-lead">Miejsca z planu podróży — tranzyty, bazy i atrakcje.</p>
      <div class="gallery-grid">${items}</div>
    </section>
    <div class="lightbox" id="lightbox" hidden aria-hidden="true">
      <button type="button" class="lightbox__close" aria-label="Zamknij">×</button>
      <figure class="lightbox__figure">
        <img class="lightbox__img" src="" alt="" />
        <figcaption class="lightbox__caption"></figcaption>
      </figure>
    </div>
  `;
}

export function renderCosts(costs) {
  if (!costs) return '';

  const categories = costs.categories
    .map((cat) => {
      const items = cat.items
        .filter((item) => item.per_person_min > 0 || item.per_person_max > 0)
        .map((item) => `
          <tr class="costs-item">
            <td class="costs-item__label">${esc(item.label)}</td>
            <td class="costs-item__detail muted">${esc(item.detail || '')}</td>
            <td class="costs-item__range">
              ${item.per_person_min === item.per_person_max
                ? `€${item.per_person_min}`
                : `€${item.per_person_min}–${item.per_person_max}`}
            </td>
          </tr>
        `)
        .join('');

      const subtotalRange = cat.per_person_min === cat.per_person_max
        ? `€${cat.per_person_min}`
        : `€${cat.per_person_min}–${cat.per_person_max}`;

      return `
        <div class="costs-category">
          <div class="costs-category__header">
            <span class="costs-category__icon">${esc(cat.icon || '')}</span>
            <h4 class="costs-category__name">${esc(cat.name)}</h4>
            <span class="costs-category__subtotal">${subtotalRange} <span class="costs-per-label">/os</span></span>
          </div>
          ${cat.note ? `<p class="costs-category__note muted">${esc(cat.note)}</p>` : ''}
          <table class="costs-table">
            <tbody>${items}</tbody>
          </table>
        </div>
      `;
    })
    .join('');

  const notIncluded = costs.not_included?.length
    ? `<div class="costs-not-included">
        <h4 class="block-label">Nie uwzględniono</h4>
        <ul class="tips-list">${costs.not_included.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </div>`
    : '';

  return `
    <section class="section" id="koszty">
      <h2 class="section-title">Szacunkowe koszty</h2>
      <p class="section-lead">${esc(costs.note)}</p>

      <div class="costs-summary-banner">
        <div class="costs-summary-item">
          <span class="costs-summary-label">Na osobę</span>
          <span class="costs-summary-value">€${costs.total_per_person_min}–${costs.total_per_person_max}</span>
        </div>
        <div class="costs-summary-divider"></div>
        <div class="costs-summary-item">
          <span class="costs-summary-label">Razem ${costs.persons} osoby</span>
          <span class="costs-summary-value">€${costs.total_group_min}–${costs.total_group_max}</span>
        </div>
      </div>

      <div class="costs-categories">${categories}</div>
      ${notIncluded}
    </section>
  `;
}

const PRIORITY_LABEL = { high: 'pilne', medium: 'warto', low: 'opcjonalnie' };

function renderTodoItem(item) {
  return `
      <li class="todo-item todo-item--${esc(item.priority || 'medium')}" id="todo-${esc(item.id)}">
        <label class="todo-item__label">
          <input type="checkbox" class="todo-check" data-todo-id="${esc(item.id)}" />
          <span class="todo-item__text">${esc(item.label)}</span>
          <span class="todo-item__priority">${esc(PRIORITY_LABEL[item.priority] || '')}</span>
        </label>
        ${item.deadline ? `<div class="todo-item__deadline${item.deadline.includes('PILNIE') ? ' todo-item__deadline--overdue' : ''}">⏰ ${esc(item.deadline)}</div>` : ''}
        ${item.detail ? `<div class="todo-item__detail">${esc(item.detail)}</div>` : ''}
        ${item.url ? `<a class="todo-item__link" href="${esc(item.url)}" target="_blank" rel="noopener">↗ otwórz</a>` : ''}
      </li>
    `;
}

export function renderReservations(todo) {
  const groups = reservationGroups(todo);
  if (!groups.length) return '';
  const cards = groups
    .map(
      (g) => `
      <div class="todo-category reservations-group reservations-group--${esc(g.id)}">
        <h3 class="todo-category__title">${esc(g.name)}</h3>
        <ul class="todo-list">${g.items.map(renderTodoItem).join('')}</ul>
      </div>`
    )
    .join('');
  return `
    <section class="section" id="rezerwacje">
      <h2 class="section-title">Do zarezerwowania</h2>
      <p class="section-lead">Bilety i sloty z godziną. Noclegi są w „Już zrobione”.</p>
      <div class="todo-grid">${cards}</div>
    </section>
  `;
}

export function renderTodo(todo) {
  const checklist = todoForChecklist(todo);
  if (!checklist?.categories?.length) return '';

  const categories = checklist.categories.map((cat) => {
    const items = cat.items.map(renderTodoItem).join('');

    return `
      <div class="todo-category">
        <h3 class="todo-category__title">
          <span class="todo-category__icon">${esc(cat.icon || '')}</span>
          ${esc(cat.name)}
        </h3>
        <ul class="todo-list">${items}</ul>
      </div>
    `;
  }).join('');

  return `
    <section class="section" id="todo">
      <h2 class="section-title">Lista zadań przed wyjazdem</h2>
      <p class="section-lead">${esc(todo.note)}</p>
      <div class="todo-grid">${categories}</div>
    </section>
  `;
}

const CLIMATE_LABELS = {
  garfagnana: 'Garfagnana',
  chianti: 'Chianti',
  maremma: 'Maremma',
  val_dorcia: "Val d'Orcia",
  orcia: "Val d'Orcia",
};

function fmtClimateKey(key) {
  return CLIMATE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderPractical(info) {
  const climate = Object.entries(info.climate || {})
    .map(([region, desc]) => `<li><strong>${esc(fmtClimateKey(region))}:</strong> ${esc(desc)}</li>`)
    .join('');

  const ca = info.crowd_avoidance;
  const crowdCard = ca
    ? (() => {
        const places = ca.popular_places?.length
          ? `<p class="muted">${esc(ca.popular_places.join(', '))}</p>`
          : '';
        const tips = ca.tips?.length
          ? `<ul class="tips-list">${ca.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
          : '';
        return places || tips
          ? `<div class="day-block practical-card"><h4 class="block-label">Unikanie tłumów</h4>${places}${tips}</div>`
          : '';
      })()
    : '';

  return `
    <section class="section" id="info">
      <h2 class="section-title">Informacje praktyczne</h2>
      ${info.plan_note ? `<p class="plan-note">${esc(info.plan_note)}</p>` : ''}
      <div class="practical-grid">
        <div class="day-block practical-card">
          <h4 class="block-label">Winiety</h4>
          <p><strong>Austria:</strong> ${esc(info.vignettes?.austria)}</p>
          <p><strong>Włochy:</strong> ${esc(info.vignettes?.italy)}</p>
        </div>
        <div class="day-block practical-card">
          <h4 class="block-label">Klimat we wrześniu</h4>
          <ul class="tips-list">${climate}</ul>
        </div>
        ${info.vendemmia ? `<div class="day-block practical-card"><h4 class="block-label">Winobranie</h4><p>${esc(info.vendemmia)}</p></div>` : ''}
        ${info.ztl_warning ? `<div class="day-block practical-card ztl-warning"><h4 class="block-label">ZTL</h4><p>${esc(info.ztl_warning)}</p></div>` : ''}
        ${crowdCard}
      </div>
    </section>
  `;
}

function renderFooter(meta) {
  return `
    <footer class="footer">
      <p>${esc(meta.title)} · ${esc(meta.dates)}</p>
      <p class="footer__credit">Mapy: <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">© OpenStreetMap</a> · Zdjęcia: Wikimedia Commons</p>
    </footer>
  `;
}

function dayDateParts(dateStr) {
  const m = /^(\S+)\s*(?:\(([^)]+)\))?/.exec(dateStr || '');
  return { d: m ? m[1] : (dateStr || ''), wd: m && m[2] ? m[2] : '' };
}

function trimText(text, max = 155) {
  if (!text) return '';
  const t = String(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** day_num -> [{label, detail}] z plan.todo (rezerwacje/bilety powiązane z konkretnym dniem) */
export function bookingsByDay(todo) {
  const map = {};
  (todo?.categories || []).forEach((cat) => {
    (cat.items || []).forEach((item) => {
      if (item.day_num == null) return;
      (map[item.day_num] ||= []).push(item);
    });
  });
  return map;
}

const SHORT_BOOKING_NAMES = {
  'grotta-vento': 'Grotta del Vento',
  'krzywa-wieza': 'Krzywa Wieża',
  'duomo-firenze': 'Kopuła Duomo',
  'uffizi-firenze': 'Galeria Uffizi',
  'siena-duomo': 'Siena Duomo',
  'brolio-wino': 'Castello di Brolio',
  'badia-coltibuono': 'Badia a Coltibuono',
  'trenitalia-xgo': 'Trenitalia X-GO',
};

function timelineMarkers(day, bookings, doneSet) {
  const pending = withoutDone(bookings, doneSet);
  const marks = [];
  const req = pending.filter((b) => b.group === 'required');
  const opt = pending.filter((b) => b.group !== 'required');

  if (req.length) {
    const names = req.map((b) => SHORT_BOOKING_NAMES[b.id] || b.label).join(', ');
    const titleText = req.map((b) => b.label).join(' · ');
    marks.push(`<span class="tl-mark tl-mark--booking-required" title="${esc(titleText)}">🔴 Rezerwacja: <strong>${esc(names)}</strong></span>`);
  }
  if (opt.length) {
    const names = opt.map((b) => SHORT_BOOKING_NAMES[b.id] || b.label).join(', ');
    const titleText = opt.map((b) => b.label).join(' · ');
    marks.push(`<span class="tl-mark tl-mark--booking-opt" title="${esc(titleText)}">📅 Rezerwacja: ${esc(names)}</span>`);
  }
  if (/popular$/.test(day.type)) {
    marks.push('<span class="tl-mark tl-mark--crowd" title="Popularne / spodziewane tłumy">★ tłumy</span>');
  }
  let drive = '';
  if (day.type === 'transit' && day.drive_h) drive = day.drive_h;
  else if ((day.type === 'tuscany' || day.type === 'tuscany_popular') && day.daily_km_estimate) drive = `${day.daily_km_estimate} km`;
  if (drive) marks.push(`<span class="tl-mark tl-mark--drive" title="Przejazd">🚗 ~${esc(drive)}</span>`);
  return marks.join('');
}

function timelineRow(day, bookings, doneSet) {
  const { d, wd } = dayDateParts(day.date);
  const dateHtml = `<span class="tl-row__date"><span class="tl-row__d">${esc(d)}</span><span class="tl-row__wd">${esc(wd)}</span></span>`;
  if (day.type === 'buffer') {
    return `
      <div class="tl-row tl-row--buffer reveal" style="--accent: ${dayAccent(day)}">
        ${dateHtml}
        <span class="tl-row__main">
          <span class="tl-row__title">${esc(day.title)}</span>
          <span class="tl-row__sub">${esc(day.note || '')}</span>
        </span>
      </div>`;
  }
  // Jeden sygnał rezerwacji: marker z nazwami pod spodem (titleBadge usunięty
  // jako duplikat). Czerwone podświetlenie wiersza gaśnie po odhaczeniu.
  const hasReqBooking = withoutDone(bookings, doneSet).some((b) => b.group === 'required');
  const rowClasses = [
    'tl-row',
    'reveal',
    hasReqBooking ? 'tl-row--booking-required' : '',
  ].filter(Boolean).join(' ');

  return `
    <a class="${rowClasses}" href="#/dzien-${day.day_num}" style="--accent: ${dayAccent(day)}">
      ${dateHtml}
      <span class="tl-row__main">
        <span class="tl-row__head">
          <span class="tl-row__title">${esc(day.title)}</span>
        </span>
        ${day.summary ? `<span class="tl-row__desc">${esc(trimText(day.summary, 155))}</span>` : ''}
        <span class="tl-row__markers">${timelineMarkers(day, bookings, doneSet)}</span>
      </span>
      <span class="tl-row__chev" aria-hidden="true">›</span>
    </a>`;
}

function groupPhases(days, meta) {
  const dojazd = meta.phase_labels.dojazd;
  const powrot = meta.phase_labels.powrot;
  const phases = {
    dojazd: { key: 'dojazd', eyebrow: PHASE_EYEBROWS.dojazd, label: dojazd.label, sub: dojazd.sub, days: [] },
    base1: { key: 'base1', eyebrow: PHASE_EYEBROWS.base1, baseId: 'base1', mapIndex: 1, days: [] },
    base2: { key: 'base2', eyebrow: PHASE_EYEBROWS.base2, baseId: 'base2', mapIndex: 2, days: [] },
    powrot: { key: 'powrot', eyebrow: PHASE_EYEBROWS.powrot, label: powrot.label, sub: powrot.sub, days: [] },
  };
  const dayPhase = classifyDayPhases(days);
  days.forEach((day) => phases[dayPhase.get(day.day_num)].days.push(day));
  return [phases.dojazd, phases.base1, phases.base2, phases.powrot];
}

function renderBaseInfo(base) {
  if (!base) return '';
  // Na osi czasu tylko skrót — pełny opis noclegu (adres, sklep, GPS)
  // mieszka na osobnej zakładce Bazy.
  return `
    <div class="tl-baseinfo">
      <p class="tl-baseinfo__label">${esc(base.label)}${base.region ? ` · ${esc(base.region)}` : ''}</p>
      <h3 class="tl-baseinfo__name">${esc(base.name)}</h3>
      ${base.nights ? `<p class="tl-baseinfo__nights">${esc(base.nights)}</p>` : ''}
      <p class="tl-baseinfo__more"><a href="${BASE_URL}bazy/">Szczegóły noclegu →</a></p>
    </div>`;
}

/** Dni spędzone z danej bazy (bez dnia transferu między bazami). */
function baseDays(days, baseId) {
  return (days || []).filter(
    (d) => d.day_num != null && d.base_id === baseId && d.type !== 'tuscany_transfer'
  );
}

function renderBasePanel(base, days) {
  if (!base) return '';
  const mapsUrl = Array.isArray(base.coords) && base.coords.length === 2
    ? `https://www.google.com/maps/search/?api=1&query=${base.coords[0]},${base.coords[1]}`
    : '';
  const chips = baseDays(days, base.id)
    .map((d) => `<a class="base-chip" href="${BASE_URL}#/dzien-${d.day_num}" title="${esc(d.title)}">D${d.day_num}</a>`)
    .join('');
  return `
    <article class="base-card" id="panel-${esc(base.id)}" role="tabpanel" hidden>
      <p class="base-card__eyebrow">${esc(base.label)}${base.region ? ` · ${esc(base.region)}` : ''}</p>
      <h2 class="base-card__name">${esc(base.name)}</h2>
      ${base.description ? `<p class="base-card__desc">${esc(base.description)}</p>` : ''}
      <div class="base-blocks">
        <section class="base-block">
          <h3 class="base-block__title">Pobyt</h3>
          ${base.nights ? `<p class="base-block__term">${esc(base.nights)}</p>` : ''}
          ${chips ? `<p class="base-block__label">Dni z tej bazy:</p><div class="base-chips">${chips}</div>` : ''}
        </section>
        <section class="base-block">
          <h3 class="base-block__title">Nocleg</h3>
          ${base.address ? `<p class="base-block__addr">${esc(base.address)}</p>` : ''}
          <div class="base-actions">
            ${base.address ? `<button type="button" class="base-btn" data-copy-addr="${esc(base.address)}">Kopiuj adres</button>` : ''}
            ${mapsUrl ? `<a class="base-btn base-btn--link" href="${esc(mapsUrl)}" target="_blank" rel="noopener">Mapy Google ↗</a>` : ''}
          </div>
          ${base.accommodation ? `<p class="base-block__row">${esc(base.accommodation)}</p>` : ''}
          ${base.booking_tip ? `<p class="base-block__row muted">→ ${esc(base.booking_tip)}</p>` : ''}
        </section>
        ${base.local_shop ? `
        <section class="base-block">
          <h3 class="base-block__title">Sklep w okolicy</h3>
          <p class="base-block__row">🥩 ${esc(base.local_shop)}</p>
        </section>` : ''}
      </div>
    </article>`;
}

export function renderBases(bases, days) {
  const list = bases || [];
  const tabs = list
    .map(
      (b, i) => `
      <button type="button" role="tab" class="base-tab" data-base-tab="${esc(b.id)}"
        data-lat="${b.coords?.[0] ?? ''}" data-lon="${b.coords?.[1] ?? ''}" data-name="${esc(b.name)}"
        aria-selected="${i === 0 ? 'true' : 'false'}">${esc(b.label)} · ${esc((b.region || '').split('·')[0].trim())}</button>`
    )
    .join('');
  return `
    <section class="section" id="bazy">
      <h1 class="section-title">Bazy noclegowe</h1>
      <p class="section-lead">Wybierz bazę — adres do skopiowania, dni, sklep i mapa.</p>
      <div class="base-tabs" role="tablist">${tabs}</div>
      <div class="base-panels">${list.map((b) => renderBasePanel(b, days)).join('')}</div>
      <div id="base-map" class="leaflet-map leaflet-map--base" aria-label="Mapa okolicy bazy"></div>
    </section>
  `;
}

export function renderTimeline(plan) {
  const images = plan.meta?.images ?? plan.images;
  const phases = groupPhases(plan.days, plan.meta);
  const bookings = bookingsByDay(plan.todo);
  const doneSet = getDoneIds(doneStorageKey(plan));
  const timelineHtml = phases.map((phase) => {
    const rows = phase.days.map((day) => timelineRow(day, bookings[day.day_num], doneSet)).join('');
    const base = phase.baseId ? (plan.bases || []).find((b) => b.id === phase.baseId) : null;
    if (base) {
      phase.label = base.region ? base.region.split('·')[0].trim() : base.name;
      phase.sub = `${base.label} · ${base.name}`;
    }
    const baseMap = phase.baseId
      ? `<div class="tl-basemap">
           <div class="tl-basemap__map">
             <div id="map-base-${phase.mapIndex}" class="leaflet-map leaflet-map--base" aria-label="Mapa bazy: ${esc(phase.label)}"></div>
             <div class="tl-basemap__legend" id="basemap-legend-${phase.baseId}"></div>
           </div>
           ${renderBaseInfo(base)}
         </div>`
      : '';
    return `
      <section class="tl-phase tl-phase--${phase.key}">
        <header class="tl-phase__head">
          <span class="tl-phase__eyebrow">${esc(phase.eyebrow)}</span>
          <h2 class="tl-phase__label">${esc(phase.label)}</h2>
          <span class="tl-phase__sub">${esc(phase.sub)}</span>
        </header>
        ${baseMap}
        <div class="tl-rows">${rows}</div>
      </section>`;
  }).join('');

  return `
    <main class="page page--timeline" id="tresc">
      ${renderHeader(plan.meta, images)}
      <div class="timeline">${timelineHtml}</div>
      ${renderFooter(plan.meta)}
    </main>
  `;
}

export function renderDayPage(day, images, bases, days, todo, meta) {
  const base = bases?.find((b) => b.id === day.base_id);
  // days nieprzefiltrowane (surowe plan.days) — ta sama sekwencja co w groupPhases,
  // żeby klasyfikacja etapu nigdy się nie rozjechała z osią czasu.
  const phase = dayPhaseInfo(day, days || [], meta, bases);
  const thumbKey = day.image || base?.image;
  const placeImg = thumbKey ? resolvePlaceImage(images, thumbKey) : null;
  const hero = placeImg ? renderImg(placeImg, 'daypage__hero', 'eager') : '';
  const { d, wd } = dayDateParts(day.date);

  const list = activeDays(days || []);
  const idx = list.findIndex((x) => x.day_num === day.day_num);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const navLink = (target, dir, label) =>
    target
      ? `<a class="daypage-nav__link daypage-nav__link--${dir}" href="#/dzien-${target.day_num}"><span class="daypage-nav__dir">${label}</span><span class="daypage-nav__t">${esc(target.title)}</span></a>`
      : `<span class="daypage-nav__link is-disabled"><span class="daypage-nav__dir">${label}</span></span>`;

  const hasMiniMap =
    ((day.type === 'tuscany' || day.type === 'tuscany_popular' || day.type === 'tuscany_transfer') && day.base_id) ||
    (day.type === 'transit' && day.route_points?.length > 0);
  const miniMap = hasMiniMap
    ? `<div id="map-day-${day.day_num}" class="leaflet-map leaflet-map--mini" aria-label="Mapa dnia ${day.day_num}"></div>`
    : '';
  const warning = day.warning ? `<div class="day-warning">${esc(day.warning)}</div>` : '';
  const doneSet = getDoneIds(doneStorageKey({ meta }));
  const dayBookings = withoutDone(bookingsByDay(todo)[day.day_num], doneSet);
  const hasReqBooking = dayBookings?.some((b) => b.group === 'required');
  const bookingBanner = dayBookings?.length
    ? `<div class="day-booking${hasReqBooking ? ' day-booking--required' : ''}">
        <span class="day-booking__icon">${hasReqBooking ? '🔴' : '●'}</span>
        <ul class="day-booking__list">
          ${dayBookings
            .map(
              (b) =>
                `<li><label class="day-booking__row"><input type="checkbox" class="booking-check" data-booking-id="${esc(b.id)}" title="Oznacz jako zrobione" /><span>${b.group === 'required' ? '<span class="day-booking__badge">WYMAGANA REZERWACJA</span> ' : ''}<strong>${esc(b.label)}</strong>${b.deadline ? ` — ${esc(b.deadline)}` : ''}${b.url ? ` · <a class="day-booking__link" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">↗ rezerwuj online</a>` : ''}</span></label></li>`
            )
            .join('')}
        </ul>
      </div>`
    : '';

  return `
    <main class="page page--day" id="tresc" style="--day-accent: ${dayAccent(day)}">
      <a class="daypage-back" href="#/">← Plan</a>
      <article class="daypage day-card--${day.type}">
        ${hero}
        <div class="daypage__head">
          <span class="day-date">${esc(d)} <span class="daypage__wd">${esc(wd)}</span></span>
          <span class="phase-badge" style="--phase-accent: ${phase.accent}">${esc(phase.eyebrow)} · ${esc(phase.label)}</span>
          <span class="day-label">${esc(day.label)}</span>
        </div>
        <h1 class="daypage__title">${esc(day.title)}</h1>
        ${warning}
        ${bookingBanner}
        ${miniMap}
        <div class="day-body">${renderDayBody(day, images)}</div>
      </article>
      <nav class="daypage-nav" aria-label="Nawigacja między dniami">
        ${navLink(prev, 'prev', '‹ Poprzedni')}
        ${navLink(next, 'next', 'Następny ›')}
      </nav>
      ${renderFooter(meta)}
    </main>
  `;
}

export function initGallery() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const img = lightbox.querySelector('.lightbox__img');
  const caption = lightbox.querySelector('.lightbox__caption');
  const closeBtn = lightbox.querySelector('.lightbox__close');
  let lastActiveElement = null;

  function open(src, alt, triggerEl) {
    lastActiveElement = triggerEl || document.activeElement;
    img.src = src;
    img.alt = alt;
    caption.textContent = alt;
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    closeBtn.focus();
  }

  function close() {
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    img.src = '';
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      open(item.dataset.src, item.dataset.alt, item);
    });
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.hidden) close();
  });
}
