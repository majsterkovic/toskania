import { trip as plan } from './trip.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import { esc } from './html.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/packing.css';

applyStoredTheme();

const STORAGE_PREFIX = 'packing:';
const app = document.getElementById('app');
const packingList = plan.packing_list;

function itemId(cat, item, idx) {
  return item.id || `${cat.id}-${idx}`;
}

function isPacked(id) {
  return localStorage.getItem(STORAGE_PREFIX + id) === '1';
}

function setPacked(id, packed) {
  if (packed) localStorage.setItem(STORAGE_PREFIX + id, '1');
  else localStorage.removeItem(STORAGE_PREFIX + id);
}

function clearPacked() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function allItemIds(list) {
  return (list?.categories || []).flatMap((cat) =>
    (cat.items || []).map((item, idx) => itemId(cat, item, idx)),
  );
}

function countPacked(list) {
  const ids = allItemIds(list);
  const checked = ids.filter(isPacked).length;
  const total = ids.length;
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  return { checked, total, percent };
}

function renderPackingList(list) {
  if (!list?.categories?.length) return '';

  return list.categories
    .map((cat) => {
      const itemsHtml = (cat.items || [])
        .map((item, idx) => {
          const id = itemId(cat, item, idx);
          const checked = isPacked(id);
          return `
        <li class="packing-item${checked ? ' packing-item--checked' : ''}">
          <label>
            <input
              type="checkbox"
              class="packing-checkbox"
              data-item-id="${esc(id)}"
              ${checked ? 'checked' : ''}
            />
            <span class="packing-item__name">${esc(item.item)}</span>
          </label>
          ${item.note ? `<p class="packing-item__note">${esc(item.note)}</p>` : ''}
        </li>
      `;
        })
        .join('');

      return `
      <section class="packing-category">
        <h2 class="packing-category__title">
          <span class="packing-category__icon">${esc(cat.icon || '')}</span>
          ${esc(cat.name)}
        </h2>
        <ul class="packing-list">${itemsHtml}</ul>
      </section>
    `;
    })
    .join('');
}

function renderStats(list) {
  const { checked, total, percent } = countPacked(list);
  return `
    <div class="packing-stats">
      <div class="packing-stats__progress">
        <div class="packing-stats__bar" style="width: ${percent}%"></div>
      </div>
      <p class="packing-stats__text">${checked} z ${total} rzeczy spakowane (${percent}%)</p>
      <button class="packing-stats__reset" type="button">Wyczyść odhaczenia</button>
    </div>
  `;
}

function refreshStats(list) {
  const { checked, total, percent } = countPacked(list);
  const bar = document.querySelector('.packing-stats__bar');
  const text = document.querySelector('.packing-stats__text');
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${checked} z ${total} rzeczy spakowane (${percent}%)`;
}

const title = packingList?.title || 'Pakowanie';
const lead =
  packingList?.note ||
  'Rzeczy wspólne, o których grupa łatwo zapomina. Odhaczaj przy pakowaniu samochodu.';

app.innerHTML = `
  ${renderSiteNav(plan, 'packing')}
  <main class="page" id="tresc">
    <article class="section">
      <h1 class="section-title">${esc(title)}</h1>
      <p class="section-lead">${esc(lead)}</p>

      ${renderStats(packingList)}

      <div class="packing-container">
        ${renderPackingList(packingList)}
      </div>
    </article>
  </main>
  ${renderSiteFooter(plan)}
`;

initChrome();

document.querySelectorAll('.packing-checkbox').forEach((cb) => {
  cb.addEventListener('change', (e) => {
    const id = e.target.dataset.itemId;
    setPacked(id, e.target.checked);
    e.target.closest('.packing-item')?.classList.toggle('packing-item--checked', e.target.checked);
    refreshStats(packingList);
  });
});

document.querySelector('.packing-stats__reset')?.addEventListener('click', () => {
  if (!confirm('Odznaczyć wszystkie rzeczy na liście?')) return;
  clearPacked();
  location.reload();
});
