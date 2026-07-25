import plan from '../plan_2bazy.json';
import { renderInteractiveMap } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { initInteractiveMap } from './maps.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/map.css';

(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
})();

const app = document.getElementById('app');
app.innerHTML =
  renderSiteNav('mapa') +
  `<main class="page page--mapa" id="tresc">${renderInteractiveMap(plan.days)}</main>` +
  renderSiteFooter();
initChrome();

(function whenLeaflet() {
  if (window.L) initInteractiveMap('map-tuscany-interactive', plan);
  else setTimeout(whenLeaflet, 100);
})();
