import plan from '../plan_2bazy.json';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import { esc } from './html.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/packing.css';

applyStoredTheme();

const app = document.getElementById('app');

function renderPackingList(packingList) {
  if (!packingList || !packingList.categories) return '';

  const HTML = packingList.categories.map(cat => {
    const itemsHtml = cat.items.map((item, idx) => {
      const itemId = `${cat.id}-${idx}`;
      const isChecked = localStorage.getItem(`packing:${itemId}`) === '1';
      return `
        <li class="packing-item ${isChecked ? 'packing-item--checked' : ''}">
          <label>
            <input
              type="checkbox"
              class="packing-checkbox"
              data-item-id="${itemId}"
              ${isChecked ? 'checked' : ''}
            />
            <span class="packing-item__name">${esc(item.item)}</span>
            ${item.shared ? '<span class="packing-item__badge">wspólne</span>' : ''}
          </label>
          ${item.note ? `<p class="packing-item__note">${esc(item.note)}</p>` : ''}
        </li>
      `;
    }).join('');

    return `
      <section class="packing-category">
        <h3 class="packing-category__title">
          <span class="packing-category__icon">${cat.icon}</span>
          ${esc(cat.name)}
        </h3>
        <ul class="packing-list">${itemsHtml}</ul>
      </section>
    `;
  }).join('');

  return HTML;
}

function initPackingCheckboxes() {
  const checkboxes = document.querySelectorAll('.packing-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const itemId = e.target.dataset.itemId;
      const isChecked = e.target.checked;
      if (isChecked) {
        localStorage.setItem(`packing:${itemId}`, '1');
      } else {
        localStorage.removeItem(`packing:${itemId}`);
      }
      e.target.closest('.packing-item').classList.toggle('packing-item--checked', isChecked);
    });
  });
}

function renderStats() {
  const checkboxes = document.querySelectorAll('.packing-checkbox');
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  const total = checkboxes.length;
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

  return `
    <div class="packing-stats">
      <div class="packing-stats__progress">
        <div class="packing-stats__bar" style="width: ${percent}%"></div>
      </div>
      <p class="packing-stats__text">${checked} z ${total} rzeczy spakowane (${percent}%)</p>
      <button class="packing-stats__reset" type="button">Wyczyść listę</button>
    </div>
  `;
}

app.innerHTML = `
  ${renderSiteNav(plan.meta)}
  <main class="page" id="tresc">
    <article class="section">
      <h1 class="section-title">📦 Lista do spakowania</h1>
      <p class="section-lead">Wrzesień 2026, 16 dni Poznań–Toskania–Poznań. Odhaczaj przed wyjazdem — postęp zapisywany w przeglądarce.</p>

      ${renderStats()}

      <div class="packing-container">
        ${renderPackingList(plan.packing_list)}
      </div>
    </article>
  </main>
  ${renderSiteFooter()}
`;

initChrome();
initPackingCheckboxes();

// Odśwież stats po każdym change
document.querySelectorAll('.packing-checkbox').forEach(cb => {
  cb.addEventListener('change', () => {
    const statsSection = document.querySelector('.packing-stats');
    statsSection.innerHTML = renderStats().replace('<div class="packing-stats">', '').replace('</div>', '').trim();
    initPackingResetButton();
  });
});

function initPackingResetButton() {
  const resetBtn = document.querySelector('.packing-stats__reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Wyczyścić listę? (Odznaczysz wszystko)')) {
        localStorage.clear();
        location.reload();
      }
    });
  }
}

initPackingResetButton();
