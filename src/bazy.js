import { trip as plan } from './trip.js';
import { renderBases } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/map.css';
import './styles/bases.css';

applyStoredTheme();

const app = document.getElementById('app');
app.innerHTML =
  renderSiteNav(plan, 'bazy') +
  `<main class="page" id="tresc">${renderBases(plan.bases, plan.days)}</main>` +
  renderSiteFooter(plan);
initChrome();
initBaseTabs();

function whenLeaflet(fn) {
  if (window.L) fn();
  else setTimeout(() => whenLeaflet(fn), 100);
}

/** Taby baz + mapka okolicy + kopiowanie adresu. */
function initBaseTabs() {
  const tabs = [...document.querySelectorAll('[data-base-tab]')];
  const panels = [...document.querySelectorAll('.base-card[role="tabpanel"]')];
  if (!tabs.length) return;

  let map = null;
  let marker = null;
  function showMap(lat, lon, name) {
    if (!window.L || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!map) {
      map = window.L.map('base-map', { scrollWheelZoom: false }).setView([lat, lon], 12);
      window.L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      setTimeout(() => { try { map.invalidateSize(); } catch (_) {} }, 100);
    } else {
      map.setView([lat, lon], 12);
    }
    if (marker) map.removeLayer(marker);
    marker = window.L.marker([lat, lon]).bindPopup(`<b>${name}</b>`).addTo(map);
  }

  function select(tab) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((p) => {
      p.hidden = p.id !== `panel-${tab.dataset.baseTab}`;
    });
    showMap(Number(tab.dataset.lat), Number(tab.dataset.lon), tab.dataset.name || '');
  }

  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  select(tabs[0]);
  whenLeaflet(() => {
    const active = document.querySelector('[data-base-tab].is-active') || tabs[0];
    showMap(Number(active.dataset.lat), Number(active.dataset.lon), active.dataset.name || '');
  });

  document.querySelectorAll('[data-copy-addr]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copyAddr || '';
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
      }
      const label = btn.textContent;
      btn.textContent = ok ? 'Skopiowano ✓' : 'Nie udało się skopiować';
      setTimeout(() => { btn.textContent = label; }, 1600);
    });
  });
}
