const BASE_COLORS = {
  base1: 'var(--base1)',
  base2: 'var(--base2)',
  base3: 'var(--base3)',
};

const ATTRACTION_LABELS = {
  medieval: 'średniowiecze',
  nature: 'natura',
  cultural: 'kultura',
  popular: 'popularne',
};

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dayAccent(day) {
  if (day.type === 'transit') return 'var(--transit)';
  if (day.base_id && BASE_COLORS[day.base_id]) return BASE_COLORS[day.base_id];
  return 'var(--muted)';
}

function shortDate(dateStr) {
  return dateStr.split(' ')[0];
}

function renderHeader(meta) {
  return `
    <header class="hero">
      <h1>${esc(meta.title)}</h1>
      <p class="hero-dates">${esc(meta.dates)}</p>
      <p class="hero-subtitle">${esc(meta.subtitle)}</p>
      ${meta.participants_note ? `<p class="hero-note">${esc(meta.participants_note)}</p>` : ''}
    </header>
  `;
}

function renderBases(bases) {
  const cards = bases
    .map((base, i) => {
      const colorVar = `--base${i + 1}`;
      return `
        <article class="base-card" style="--accent: var(${colorVar})">
          <p class="base-label">${esc(base.label)}</p>
          <h3>${esc(base.name)}</h3>
          <p class="base-region">${esc(base.region)} · ${esc(base.nights)}</p>
          <p>${esc(base.description)}</p>
          <p class="base-accommodation"><strong>Nocleg:</strong> ${esc(base.accommodation)}</p>
          <p class="base-tip">→ ${esc(base.booking_tip)}</p>
        </article>
      `;
    })
    .join('');

  return `
    <section class="section" id="bazy">
      <h2>Bazy noclegowe</h2>
      <div class="bases-grid">${cards}</div>
    </section>
  `;
}

function renderDayNav(days) {
  const chips = days
    .map(
      (day) => `
        <a href="#dzien-${day.day_num}" class="day-chip" data-day="${day.day_num}" style="--chip-accent: ${dayAccent(day)}">
          ${esc(shortDate(day.date))}
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
    <div class="day-block">
      <h4>Jedzenie</h4>
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
  return `
    <div class="day-block">
      <h4>Nocleg</h4>
      <p><strong>${esc(acc.place)}</strong></p>
      ${acc.note ? `<p>${esc(acc.note)}</p>` : ''}
      ${acc.price ? `<p class="price">${esc(acc.price)}</p>` : ''}
    </div>
  `;
}

function renderAttractions(attractions) {
  if (!attractions?.length) return '';
  const items = attractions
    .map((a) => {
      const typeLabel = ATTRACTION_LABELS[a.type] || a.type;
      const drive = a.drive_min != null ? `<span class="drive-min">${a.drive_min} min</span>` : '';
      return `
        <li class="attraction">
          <div class="attraction-head">
            <strong>${esc(a.name)}</strong>
            ${drive}
            <span class="type-badge">${esc(typeLabel)}</span>
          </div>
          <p>${esc(a.description)}</p>
        </li>
      `;
    })
    .join('');

  return `
    <div class="day-block">
      <h4>Atrakcje</h4>
      <ul class="attraction-list">${items}</ul>
    </div>
  `;
}

function renderOakForest(oak) {
  if (!oak) return '';
  return `
    <div class="day-block oak-block">
      <h4>Las dębowy</h4>
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
      <h4>Wskazówki</h4>
      <ul class="tips-list">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  `;
}

function renderTransit(day) {
  return `
    ${day.depart ? `<p class="meta-row"><span class="meta-label">Wyjazd</span> ${esc(day.depart)}</p>` : ''}
    ${day.drive_km ? `<p class="meta-row"><span class="meta-label">Dystans</span> ${day.drive_km} km · ${esc(day.drive_h)}</p>` : ''}
    ${day.route ? `<p class="meta-row"><span class="meta-label">Trasa</span> ${esc(day.route)}</p>` : ''}
    ${day.arrival ? `<p class="meta-row"><span class="meta-label">Przyjazd</span> ${esc(day.arrival)}</p>` : ''}
    ${renderFood(day.food)}
    ${renderAccommodation(day.accommodation)}
    ${renderTips(day.tips)}
  `;
}

function renderTuscany(day) {
  const driveLimit = day.drive_limit_min
    ? `<p class="meta-row"><span class="meta-label">Limit dojazdu</span> max ${day.drive_limit_min} min od bazy</p>`
    : '';

  const transfer =
    day.type === 'tuscany_transfer'
      ? `
        <div class="day-block transfer-block">
          <h4>Zmiana bazy</h4>
          ${day.transfer_depart ? `<p><span class="meta-label">Wyjazd</span> ${esc(day.transfer_depart)}</p>` : ''}
          ${day.transfer_km ? `<p>${day.transfer_km} km · ${esc(day.transfer_h)}</p>` : ''}
          ${day.transfer_route ? `<p>${esc(day.transfer_route)}</p>` : ''}
        </div>
      `
      : '';

  const crowdTip = day.crowd_tip
    ? `<div class="day-block crowd-tip"><h4>★ Unikaj tłumów</h4><p>${esc(day.crowd_tip)}</p></div>`
    : '';

  return `
    ${driveLimit}
    ${crowdTip}
    ${renderAttractions(day.attractions)}
    ${renderOakForest(day.oak_forest)}
    ${renderFood(day.food)}
    ${transfer}
    ${renderTips(day.tips)}
  `;
}

function renderDay(day) {
  const accent = dayAccent(day);
  const body = day.type === 'transit' ? renderTransit(day) : renderTuscany(day);
  const popularClass = day.popular ? ' day-card--popular' : '';

  return `
    <article
      class="day-card${popularClass}"
      id="dzien-${day.day_num}"
      data-day="${day.day_num}"
      style="--day-accent: ${accent}"
    >
      <div class="day-card-header">
        <span class="day-date">${esc(day.date)}</span>
        <span class="day-label">${esc(day.label)}</span>
      </div>
      <h3 class="day-title">${esc(day.title)}</h3>
      <div class="day-body">${body}</div>
    </article>
  `;
}

function renderDays(days) {
  const cards = days.map(renderDay).join('');
  return `
    <section class="section" id="dni">
      <h2>Plan dnia po dniu</h2>
      <div class="days-list">${cards}</div>
    </section>
  `;
}

function renderPractical(info) {
  const climate = Object.entries(info.climate || {})
    .map(([region, desc]) => `<li><strong>${esc(region)}:</strong> ${esc(desc)}</li>`)
    .join('');

  return `
    <section class="section" id="info">
      <h2>Informacje praktyczne</h2>
      <div class="practical-grid">
        <div class="day-block">
          <h4>Winiety</h4>
          <p><strong>Austria:</strong> ${esc(info.vignettes?.austria)}</p>
          <p><strong>Włochy:</strong> ${esc(info.vignettes?.italy)}</p>
        </div>
        <div class="day-block">
          <h4>Klimat we wrześniu</h4>
          <ul class="tips-list">${climate}</ul>
        </div>
        ${info.vendemmia ? `<div class="day-block"><h4>Winobranie</h4><p>${esc(info.vendemmia)}</p></div>` : ''}
        ${info.ztl_warning ? `<div class="day-block ztl-warning"><h4>ZTL</h4><p>${esc(info.ztl_warning)}</p></div>` : ''}
      </div>
    </section>
  `;
}

export function renderApp(plan) {
  return `
    <div class="page">
      ${renderHeader(plan.meta)}
      ${renderBases(plan.bases)}
      ${renderDayNav(plan.days)}
      ${renderDays(plan.days)}
      ${renderPractical(plan.practical_info)}
      <footer class="footer">
        <p>Toskania 2026 · ${esc(plan.meta.dates)}</p>
      </footer>
    </div>
  `;
}

export function initDayNav() {
  const nav = document.getElementById('day-nav');
  if (!nav) return;

  const chips = nav.querySelectorAll('.day-chip');
  const cards = document.querySelectorAll('.day-card');

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
    { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
  );

  cards.forEach((card) => observer.observe(card));
}
