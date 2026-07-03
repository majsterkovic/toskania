const BASE_COLORS = {
  base1: 'var(--olive)',
  base2: 'var(--terracotta)',
  base3: 'var(--terracotta-deep)',
};

const ATTRACTION_LABELS = {
  medieval: 'średniowiecze',
  nature: 'natura',
  cultural: 'kultura',
  popular: 'popularne',
};

const BASE_URL = import.meta.env.BASE_URL;

/** Mapowanie ścieżek z plan.json na faktyczne pliki w public/images/ */
const IMAGE_ALIASES = {
  'images/radda.jpg': 'images/radda-chianti.jpg',
  'images/monte-oliveto.jpg': 'images/monte-oliveto-maggiore.jpg',
  'images/asciano.jpg': 'images/asciano-crete.jpg',
  'images/lamone.jpg': 'images/selva-del-lamone.jpg',
};

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function imgSrc(relativePath) {
  if (!relativePath) return '';
  const path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const resolved = IMAGE_ALIASES[path] || path;
  return `${BASE_URL}${resolved}`;
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
  return `
    <figure class="${className}">
      <img src="${esc(src)}" alt="${esc(alt)}" loading="${loading}" decoding="async" />
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

function renderSiteNav() {
  return `
    <nav class="site-nav" id="site-nav" aria-label="Nawigacja strony">
      <a class="site-nav__brand" href="#start">Toskania</a>
      <div class="site-nav__links">
        <a href="#mapy">Mapy</a>
        <a href="#bazy">Bazy</a>
        <a href="#dni">Harmonogram</a>
        <a href="#galeria">Galeria</a>
        <a href="#info">Info</a>
      </div>
    </nav>
  `;
}

function renderHeader(meta, images) {
  const hero = images?.hero;
  const heroImg = hero ? renderImg({ src: imgSrc(hero.src), alt: hero.alt, credit: hero.credit }, 'hero__figure', 'eager') : '';
  const rs = meta.route_summary;

  return `
    <header class="hero" id="start">
      ${heroImg}
      <div class="hero__content">
        <p class="hero__eyebrow">Podróż samochodowa · wrzesień 2026</p>
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

function renderBases(bases, images) {
  const cards = bases
    .map((base, i) => {
      const colorVar = `--base${i + 1}`;
      const placeImg = resolvePlaceImage(images, base.image);
      const imgHtml = placeImg ? renderImg(placeImg, 'base-card__img') : '';

      return `
        <article class="base-card" style="--accent: var(${colorVar})">
          ${imgHtml}
          <div class="base-card__body">
            <p class="base-label">${esc(base.label)}</p>
            <h3>${esc(base.name)}</h3>
            <p class="base-region">${esc(base.region)} · ${esc(base.nights)}</p>
            <p class="base-desc">${esc(base.description)}</p>
            <p class="base-accommodation"><strong>Nocleg:</strong> ${esc(base.accommodation)}</p>
            <p class="base-tip">→ ${esc(base.booking_tip)}</p>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <section class="section" id="bazy">
      <h2 class="section-title">Bazy noclegowe</h2>
      <p class="section-lead">Trzy regiony — Garfagnana, Chianti i Maremma — po 3–4 noce w każdym.</p>
      <div class="bases-grid">${cards}</div>
    </section>
  `;
}

function renderDayNav(days) {
  const chips = activeDays(days)
    .map(
      (day) => `
        <a href="#dzien-${day.day_num}" class="day-chip" data-day="${day.day_num}" style="--chip-accent: ${dayAccent(day)}">
          <span class="day-chip__num">${day.day_num}</span>
          <span class="day-chip__date">${esc(shortDate(day.date))}</span>
        </a>
      `
    )
    .join('');

  return `<nav class="day-nav" id="day-nav" aria-label="Nawigacja po dniach">${chips}</nav>`;
}

function renderFood(food) {
  if (!food) return '';
  const dishes =
    food.dishes?.length > 0
      ? `<ul class="dish-list">${food.dishes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
      : '';
  return `
    <div class="day-block day-block--food">
      <h4 class="block-label">Kulinaria</h4>
      <p class="food-place"><strong>${esc(food.place)}</strong></p>
      ${food.address ? `<p class="muted">${esc(food.address)}</p>` : ''}
      ${dishes}
      ${food.note ? `<p>${esc(food.note)}</p>` : ''}
      ${food.price ? `<p class="price">${esc(food.price)}</p>` : ''}
    </div>
  `;
}

function renderAccommodation(acc) {
  if (!acc) return '';
  const options = renderAccommodationOptions(acc.options);
  return `
    <div class="day-block">
      <h4 class="block-label">Nocleg</h4>
      <p><strong>${esc(acc.place)}</strong></p>
      ${acc.note ? `<p>${esc(acc.note)}</p>` : ''}
      ${acc.booking_tip ? `<p class="muted">${esc(acc.booking_tip)}</p>` : ''}
      ${acc.price ? `<p class="price">${esc(acc.price)}</p>` : ''}
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
  return `
    <div class="day-block oak-block">
      <h4 class="block-label">Las dębowy</h4>
      <p><strong>${esc(oak.spot)}</strong></p>
      <p class="muted">${esc(oak.species)}</p>
      <p>${esc(oak.note)}</p>
    </div>
  `;
}

function renderTips(tips) {
  if (!tips?.length) return '';
  return `
    <div class="day-block">
      <h4 class="block-label">Wskazówki</h4>
      <ul class="tips-list">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  `;
}

function renderPracticalTips(tips) {
  if (!tips?.length) return '';
  return `
    <div class="day-block day-block--practical">
      <h4 class="block-label">Wskazówki praktyczne</h4>
      <ul class="tips-list tips-list--practical">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  `;
}

function renderWebResearch(items) {
  if (!items?.length) return '';
  const cards = items
    .map(
      (item) => `
        <details class="research-item">
          <summary class="research-item__summary">
            <span class="research-item__topic">${esc(item.topic)}</span>
            ${item.checked ? `<span class="research-item__checked">spr. ${esc(item.checked)}</span>` : ''}
          </summary>
          <div class="research-item__body">
            <p>${esc(item.summary)}</p>
            ${item.source ? `<a class="research-item__source" href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Źródło</a>` : ''}
          </div>
        </details>
      `
    )
    .join('');

  return `
    <div class="day-block day-block--research">
      <h4 class="block-label">Research</h4>
      <div class="research-list">${cards}</div>
    </div>
  `;
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

function renderParking(parking) {
  if (!parking) return '';
  const rows = Object.entries(parking)
    .filter(([, v]) => v)
    .map(
      ([key, value]) => `
        <div class="parking-row">
          <span class="parking-label">${esc(key.replace(/_/g, ' '))}</span>
          <p>${esc(value)}</p>
        </div>
      `
    )
    .join('');

  return `
    <div class="day-block">
      <h4 class="block-label">Parking</h4>
      ${rows}
    </div>
  `;
}

function renderFuelStops(stops) {
  if (!stops?.length) return '';
  const items = stops
    .map(
      (s) => `
        <li class="fuel-stop">
          <strong>${esc(s.name)}</strong>
          ${s.location ? `<span class="muted">${esc(s.location)}</span>` : ''}
          ${s.road ? `<span class="fuel-stop__road">${esc(s.road)}</span>` : ''}
          ${s.opening_hours ? `<span class="fuel-stop__hours">${esc(s.opening_hours)}</span>` : ''}
          ${s.note ? `<p>${esc(s.note)}</p>` : ''}
        </li>
      `
    )
    .join('');

  return `
    <div class="day-block">
      <h4 class="block-label">Postoje / tankowanie</h4>
      <ul class="fuel-stops-list">${items}</ul>
    </div>
  `;
}

function renderAccommodationOptions(options) {
  if (!options?.length) return '';
  const items = options
    .map(
      (o) => `
        <li class="acc-option">
          <div class="acc-option__head">
            <strong>${esc(o.name)}</strong>
            ${o.type ? `<span class="type-badge">${esc(o.type)}</span>` : ''}
          </div>
          ${o.address ? `<p class="muted">${esc(o.address)}</p>` : ''}
          <p class="acc-option__meta">
            ${o.price ? `<span class="price">${esc(o.price)}</span>` : ''}
            ${o.parking ? `<span>🅿 ${esc(o.parking)}</span>` : ''}
          </p>
          ${o.note ? `<p>${esc(o.note)}</p>` : ''}
          ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer" class="acc-option__link">Strona obiektu</a>` : ''}
        </li>
      `
    )
    .join('');

  return `<ul class="acc-options-list">${items}</ul>`;
}

function renderTransit(day, images) {
  const dayImg = day.image ? resolvePlaceImage(images, day.image) : null;
  const heroImg = dayImg ? renderImg(dayImg, 'transit-hero') : '';

  return `
    ${heroImg}
    ${day.depart ? `<p class="meta-row"><span class="meta-label">Wyjazd</span> ${esc(day.depart)}</p>` : ''}
    ${day.drive_km ? `<p class="meta-row"><span class="meta-label">Dystans</span> ${day.drive_km} km · ${esc(day.drive_h)}</p>` : ''}
    ${day.route ? `<p class="meta-row"><span class="meta-label">Trasa</span> ${esc(day.route)}</p>` : ''}
    ${day.arrival ? `<p class="meta-row"><span class="meta-label">Przyjazd</span> ${esc(day.arrival)}</p>` : ''}
    ${renderRouteSegments(day.route_segments)}
    ${renderFood(day.food)}
    ${renderAccommodation(day.accommodation)}
    ${renderParking(day.parking)}
    ${renderFuelStops(day.fuel_stops)}
    ${renderPracticalTips(day.practical_tips)}
    ${renderWebResearch(day.web_research)}
    ${renderTips(day.tips)}
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
    ${transfer}
    ${renderPracticalTips(day.practical_tips)}
    ${renderWebResearch(day.web_research)}
    ${renderTips(day.tips)}
  `;
}

function renderBuffer(day) {
  return `<p class="buffer-note">${esc(day.note)}</p>`;
}

function renderDay(day, images, bases) {
  const accent = dayAccent(day);

  if (day.type === 'buffer') {
    return `
      <article class="day-card day-card--buffer" id="bufor" style="--day-accent: ${accent}">
        <div class="day-card-header">
          <span class="day-date">${esc(day.date)}</span>
          <span class="day-label">${esc(day.label)}</span>
        </div>
        <h3 class="day-title">${esc(day.title)}</h3>
        <div class="day-body">${renderBuffer(day)}</div>
      </article>
    `;
  }

  const body =
    day.type === 'transit' ? renderTransit(day, images) : renderTuscany(day, images);

  const popularClass = day.popular ? ' day-card--popular' : '';
  const typeClass = ` day-card--${day.type}`;

  const base = bases?.find((b) => b.id === day.base_id);
  const thumbKey = day.image || base?.image;
  const placeImg = thumbKey ? resolvePlaceImage(images, thumbKey) : null;
  const thumbHtml = placeImg ? renderImg(placeImg, 'day-card__thumb') : '';

  const hasMiniMap = (day.type === 'tuscany' || day.type === 'tuscany_transfer') && day.base_id;
  const miniMap = hasMiniMap
    ? `<div id="map-day-${day.day_num}" class="leaflet-map leaflet-map--mini" aria-label="Mini mapa dnia ${day.day_num}"></div>`
    : '';
  const warning = day.warning
    ? `<div class="day-warning">${esc(day.warning)}</div>`
    : '';

  return `
    <article
      class="day-card${popularClass}${typeClass}"
      id="dzien-${day.day_num}"
      data-day="${day.day_num}"
      style="--day-accent: ${accent}"
    >
      ${thumbHtml}
      <div class="day-card__inner">
        <div class="day-card-header">
          <span class="day-date">${esc(day.date)}</span>
          <span class="day-label">${esc(day.label)}</span>
        </div>
        <h3 class="day-title">${esc(day.title)}</h3>
        ${warning}
        ${miniMap}
        <div class="day-body">${body}</div>
      </div>
    </article>
  `;
}

function renderDays(days, images, bases) {
  const cards = days.map((d) => renderDay(d, images, bases)).join('');
  return `
    <section class="section" id="dni">
      <h2 class="section-title">Harmonogram</h2>
      <p class="section-lead">15 dni aktywnej podróży — tranzyt, trzy bazy toskańskie i powrót.</p>
      <div class="days-list">${cards}</div>
    </section>
  `;
}

function renderGallery(images) {
  const places = images?.places;
  if (!places || !Object.keys(places).length) return '';

  const items = Object.entries(places)
    .map(([key, place]) => {
      const src = imgSrc(place.src);
      return `
        <button
          type="button"
          class="gallery-item"
          data-src="${esc(src)}"
          data-alt="${esc(place.alt || key)}"
          aria-label="${esc(place.alt || key)}"
        >
          <img src="${esc(src)}" alt="${esc(place.alt || key)}" loading="lazy" decoding="async" />
          <span class="gallery-item__caption">${esc(place.alt || key)}</span>
        </button>
      `;
    })
    .join('');

  return `
    <section class="section" id="galeria">
      <h2 class="section-title">Galeria miejsc</h2>
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

function renderPractical(info) {
  const climate = Object.entries(info.climate || {})
    .map(([region, desc]) => `<li><strong>${esc(region)}:</strong> ${esc(desc)}</li>`)
    .join('');

  const crowdTips = info.crowd_avoidance?.tips?.length
    ? `<ul class="tips-list">${info.crowd_avoidance.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';

  return `
    <section class="section" id="info">
      <h2 class="section-title">Informacje praktyczne</h2>
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
        ${crowdTips ? `<div class="day-block practical-card"><h4 class="block-label">Unikanie tłumów</h4>${crowdTips}</div>` : ''}
      </div>
    </section>
  `;
}

export function renderApp(plan) {
  const images = plan.meta?.images ?? plan.images;
  return `
    ${renderSiteNav()}
    <div class="page">
      ${renderHeader(plan.meta, images)}
      <section class="section section--maps" id="mapy">
        <h2 class="section-title">Mapy trasy</h2>
        <div class="maps-row">
          <div class="map-card">
            <h3 class="map-card__title">Cała trasa</h3>
            <div id="map-route-overview" class="leaflet-map" aria-label="Mapa trasy Poznań–Toskania–Poznań"></div>
          </div>
          <div class="map-card">
            <h3 class="map-card__title">Toskania — bazy i atrakcje</h3>
            <div id="map-tuscany-overview" class="leaflet-map" aria-label="Mapa Toskanii z bazami i atrakcjami"></div>
          </div>
        </div>
      </section>
      ${renderBases(plan.bases, images)}
      <div class="schedule-wrap">
        ${renderDayNav(plan.days)}
        ${renderDays(plan.days, images, plan.bases)}
      </div>
      ${renderGallery(images)}
      ${renderPractical(plan.practical_info)}
      <footer class="footer">
        <p>Toskania 2026 · ${esc(plan.meta.dates)}</p>
        <p class="footer__credit">Mapy: <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">© OpenStreetMap</a> · Zdjęcia: Wikimedia Commons</p>
      </footer>
    </div>
  `;
}

export function initDayNav() {
  const nav = document.getElementById('day-nav');
  if (!nav) return;

  const chips = nav.querySelectorAll('.day-chip');
  const cards = document.querySelectorAll('.day-card[data-day]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const dayNum = entry.target.dataset.day;
          chips.forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.day === dayNum);
          });
        }
      });
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
  );

  cards.forEach((card) => observer.observe(card));

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

export function initGallery() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const img = lightbox.querySelector('.lightbox__img');
  const caption = lightbox.querySelector('.lightbox__caption');
  const closeBtn = lightbox.querySelector('.lightbox__close');

  function open(src, alt) {
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
  }

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      open(item.dataset.src, item.dataset.alt);
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
