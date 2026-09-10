import { trip as plan } from './trip.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import { esc } from './html.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/pamiatki.css';

applyStoredTheme();

const app = document.getElementById('app');
const souvenirsData = plan.souvenirs || { categories: [], regions: [], items: [], guides: [] };
const STORAGE_KEY = `souvenirs-checked-${plan.meta?.storage_key || 'toskania-2026'}`;

let checkedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
let activeCategory = 'all';
let activeRegion = 'all';
let searchQuery = '';
let filterOnlyChecked = false;

function saveChecked() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedIds]));
}

function getFilteredItems() {
  return (souvenirsData.items || []).filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (activeRegion !== 'all' && item.region !== activeRegion && item.region !== 'all') return false;
    if (filterOnlyChecked && !checkedIds.has(item.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchItalian = (item.italian_name || '').toLowerCase().includes(q);
      const matchWhere = (item.where || '').toLowerCase().includes(q);
      const matchTip = (item.tip || '').toLowerCase().includes(q);
      const matchRegion = (item.region_label || '').toLowerCase().includes(q);
      if (!matchName && !matchItalian && !matchWhere && !matchTip && !matchRegion) return false;
    }
    return true;
  });
}

function categoryOrder() {
  return (souvenirsData.categories || []).filter((c) => c.id !== 'all');
}

function groupFilteredItems(items) {
  const groups = categoryOrder().map((cat) => ({
    cat,
    items: items.filter((item) => item.category === cat.id),
  }));
  const known = new Set(groups.map((g) => g.cat.id));
  const leftover = items.filter((item) => !known.has(item.category));
  if (leftover.length) {
    groups.push({
      cat: { id: 'inne', name: 'Inne', icon: '✨' },
      items: leftover,
    });
  }
  return groups.filter((g) => g.items.length);
}

function renderItem(item) {
  const isChecked = checkedIds.has(item.id);
  return `
    <li class="souvenir-item${isChecked ? ' souvenir-item--checked' : ''}">
      <label>
        <input
          type="checkbox"
          class="souvenir-checkbox"
          data-item-id="${esc(item.id)}"
          ${isChecked ? 'checked' : ''}
          aria-label="Kupione: ${esc(item.name)}"
        />
        <span class="souvenir-item__name">${esc(item.name)}</span>
      </label>
      ${item.italian_name ? `<p class="souvenir-item__italian">${esc(item.italian_name)}</p>` : ''}
      ${
        item.price || item.region_label
          ? `<p class="souvenir-item__meta">${item.price ? `<span class="souvenir-item__price">${esc(item.price)}</span>` : ''}${item.region_label ? `<span class="souvenir-item__region">${esc(item.region_label)}</span>` : ''}</p>`
          : ''
      }
      ${item.where ? `<p class="souvenir-item__note"><span>Gdzie</span> ${esc(item.where)}</p>` : ''}
      ${item.tip ? `<p class="souvenir-item__note"><span>Wskazówka</span> ${esc(item.tip)}</p>` : ''}
      ${item.transport ? `<p class="souvenir-item__note"><span>Transport</span> ${esc(item.transport)}</p>` : ''}
    </li>
  `;
}

function updateStatsUI() {
  const total = (souvenirsData.items || []).length;
  const checkedCount = checkedIds.size;
  const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const bar = document.getElementById('souvenirs-progress-bar');
  const countLabel = document.getElementById('souvenirs-count-label');
  if (bar) bar.style.width = `${percent}%`;
  if (countLabel) {
    countLabel.innerHTML = `Kupiono <strong>${checkedCount} z ${total}</strong> pamiątek (${percent}%)`;
  }
}

function renderItemsGrid() {
  const container = document.getElementById('souvenirs-lists');
  if (!container) return;

  const items = getFilteredItems();
  if (!items.length) {
    container.innerHTML = `
      <div class="souvenirs-empty">
        <p class="souvenirs-empty__text">Brak pamiątek spełniających wybrane kryteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = groupFilteredItems(items)
    .map(
      ({ cat, items: groupItems }) => `
      <section class="souvenir-group" id="souvenir-group-${esc(cat.id)}">
        <h2 class="souvenir-group__title">
          <span class="souvenir-group__icon">${esc(cat.icon || '')}</span>
          ${esc(cat.name)}
          <span class="souvenir-group__count">${groupItems.length}</span>
        </h2>
        <ul class="souvenir-list">${groupItems.map(renderItem).join('')}</ul>
      </section>
    `,
    )
    .join('');
  attachCheckboxListeners();
}

function attachCheckboxListeners() {
  const checkboxes = document.querySelectorAll('.souvenir-checkbox');
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const itemId = e.target.dataset.itemId;
      const checked = e.target.checked;
      if (checked) {
        checkedIds.add(itemId);
      } else {
        checkedIds.delete(itemId);
      }
      saveChecked();

      const row = e.target.closest('.souvenir-item');
      if (row) {
        row.classList.toggle('souvenir-item--checked', checked);
      }

      updateStatsUI();

      if (filterOnlyChecked && !checked) {
        renderItemsGrid();
      }
    });
  });
}

function renderGuides(guides) {
  if (!guides || !guides.length) return '';
  const cardsHtml = guides.map((guide) => {
    const listHtml = (guide.items || []).map((it) => `
      <li class="guide-card__item">
        <span class="guide-card__phrase">${esc(it.phrase)}</span>
        <span class="guide-card__meaning">${esc(it.meaning)}</span>
      </li>
    `).join('');

    return `
      <div class="guide-card">
        <h3 class="guide-card__title">
          <span>${guide.icon || '📌'}</span>
          ${esc(guide.title)}
        </h3>
        <ul class="guide-card__list">${listHtml}</ul>
      </div>
    `;
  }).join('');

  return `
    <section class="section souvenirs-guides-section">
      <h2 class="section-title">Poradnik zakupowy i słowniczek</h2>
      <div class="souvenirs-guides-grid">
        ${cardsHtml}
      </div>
    </section>
  `;
}

function init() {
  const title = souvenirsData.title || 'Pamiątki i smaki z Toskanii';
  const lead = souvenirsData.lead || 'Regionalne sery, kawa specialty, wina, wędliny i rzemiosło.';

  const categoryButtons = (souvenirsData.categories || []).map((cat) => `
    <button
      type="button"
      class="souvenir-cat-btn ${cat.id === activeCategory ? 'is-active' : ''}"
      data-category="${esc(cat.id)}"
    >
      <span>${cat.icon}</span> ${esc(cat.name)}
    </button>
  `).join('');

  const regionOptions = (souvenirsData.regions || []).map((reg) => `
    <option value="${esc(reg.id)}">${esc(reg.name)}</option>
  `).join('');

  app.innerHTML = `
    ${renderSiteNav(plan, 'pamiatki')}
    <main class="page" id="tresc">
      <article class="section">
        <h1 class="section-title">${esc(title)}</h1>
        <p class="section-lead">${esc(lead)}</p>

        <div class="souvenirs-container">
          <div class="souvenirs-stats">
            <div class="souvenirs-stats__progress-wrap">
              <div class="souvenirs-stats__progress-bar" id="souvenirs-progress-bar"></div>
            </div>
            <div class="souvenirs-stats__row">
              <span class="souvenirs-stats__count" id="souvenirs-count-label"></span>
              <div class="souvenirs-stats__actions">
                <button type="button" class="souvenirs-btn-filter-checked" id="btn-filter-checked">
                  Pokaż tylko kupione
                </button>
                <button type="button" class="souvenirs-btn-reset" id="btn-reset-souvenirs">
                  Wyczyść zaznaczenia
                </button>
              </div>
            </div>
          </div>

          <div class="souvenirs-controls">
            <div class="souvenirs-search-row">
              <input
                type="search"
                class="souvenirs-search-input"
                id="souvenirs-search"
                placeholder="Szukaj: np. pecorino, kawa, wino, dzik, Pienza..."
                aria-label="Wyszukaj pamiątkę lub produkt"
              />
              <select class="souvenirs-region-select" id="souvenirs-region" aria-label="Wybierz region">
                ${regionOptions}
              </select>
            </div>
            <div class="souvenirs-categories" id="souvenirs-cat-list" role="tablist" aria-label="Kategorie pamiątek">
              ${categoryButtons}
            </div>
          </div>

          <div class="souvenirs-groups" id="souvenirs-lists"></div>
        </div>

        ${renderGuides(souvenirsData.guides)}
      </article>
    </main>
    ${renderSiteFooter(plan)}
  `;

  updateStatsUI();
  renderItemsGrid();

  // Search input
  const searchInput = document.getElementById('souvenirs-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderItemsGrid();
    });
  }

  // Region select
  const regionSelect = document.getElementById('souvenirs-region');
  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
      activeRegion = e.target.value;
      renderItemsGrid();
    });
  }

  // Category buttons
  const catList = document.getElementById('souvenirs-cat-list');
  if (catList) {
    catList.addEventListener('click', (e) => {
      const btn = e.target.closest('.souvenir-cat-btn');
      if (!btn) return;
      activeCategory = btn.dataset.category;
      catList.querySelectorAll('.souvenir-cat-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderItemsGrid();
    });
  }

  // Filter only checked toggle
  const filterCheckedBtn = document.getElementById('btn-filter-checked');
  if (filterCheckedBtn) {
    filterCheckedBtn.addEventListener('click', () => {
      filterOnlyChecked = !filterOnlyChecked;
      filterCheckedBtn.classList.toggle('is-active', filterOnlyChecked);
      filterCheckedBtn.textContent = filterOnlyChecked ? 'Pokaż wszystkie' : 'Pokaż tylko kupione';
      renderItemsGrid();
    });
  }

  // Reset button
  const resetBtn = document.getElementById('btn-reset-souvenirs');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (checkedIds.size === 0) return;
      if (confirm('Czy na pewno chcesz wyczyścić wszystkie oznaczenia kupionych pamiątek?')) {
        checkedIds.clear();
        saveChecked();
        updateStatsUI();
        renderItemsGrid();
      }
    });
  }

  initChrome();
}

init();
