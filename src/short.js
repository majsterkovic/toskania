import plan from '../plan_2bazy.json';
import './style.css';
import './short.css';

// Apply theme before first paint to prevent FOUC (mirrors main.js)
(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

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
  const title = plan.meta?.title || 'Toskania 2026';
  const subtitle = plan.meta?.subtitle || '';
  const rows = (plan.days || []).map(dayItem).join('');

  app.innerHTML = `
    <header class="short-header">
      <a class="short-header__back" href="../">← Pełny plan</a>
      <h1 class="short-header__title">${esc(title)} — skrót</h1>
      ${subtitle ? `<p class="short-header__sub">${esc(subtitle)}</p>` : ''}
    </header>
    <ol class="short-list">${rows}</ol>
  `;
}

render(plan);
