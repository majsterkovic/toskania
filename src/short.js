import { trip as plan } from './trip.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import { esc } from './html.js';
import './styles/base.css';
import './styles/nav.css';
import './short.css';

applyStoredTheme();

const TYPE_LABELS = {
  transit: 'Tranzyt',
  tuscany: 'Toskania',
  tuscany_transfer: 'Toskania · przejazd',
  tuscany_popular: 'Toskania · popularne',
  buffer: 'Bufor',
};

function dayItem(day) {
  const isBuffer = day.day_num == null;
  const typeLabel = TYPE_LABELS[day.type] || day.type;
  const dayBadge = isBuffer ? '' : `<span class="short-day__num">D${day.day_num}</span>`;
  const baseLabel = day.base_label
    ? `<span class="short-day__base">${esc(day.base_label)}</span>`
    : '';
  return `
    <li class="short-day short-day--${esc(day.type)}">
      <div class="short-day__meta">
        ${dayBadge}
        <span class="short-day__date">${esc(day.date)}</span>
        <span class="short-day__type">${esc(typeLabel)}</span>
      </div>
      <h2 class="short-day__title">${esc(day.title)}</h2>
      ${baseLabel}
      <p class="short-day__summary">${esc(day.summary || '')}</p>
    </li>
  `;
}

function render(plan) {
  const app = document.getElementById('app');
  const title = plan.meta.title;
  const subtitle = plan.meta?.subtitle || '';
  const rows = (plan.days || []).map(dayItem).join('');

  app.innerHTML =
    renderSiteNav(plan, 'short') +
    `<main class="short-page-container" id="tresc">
      <header class="short-header">
        <a class="short-header__back" href="../">← Pełny plan</a>
        <h1 class="short-header__title">${esc(title)} — skrót</h1>
        ${subtitle ? `<p class="short-header__sub">${esc(subtitle)}</p>` : ''}
      </header>
      <ol class="short-list">${rows}</ol>
    </main>` +
    renderSiteFooter(plan);

  initChrome();
}

render(plan);
