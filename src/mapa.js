import { trip as plan } from './trip.js';
import { renderInteractiveMap } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { initInteractiveMap } from './maps.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/map.css';

applyStoredTheme();

const app = document.getElementById('app');
app.innerHTML =
  renderSiteNav(plan, 'mapa') +
  `<main class="page page--mapa" id="tresc">${renderInteractiveMap(plan.days)}</main>` +
  renderSiteFooter(plan);
initChrome();

(function whenLeaflet() {
  if (window.L) initInteractiveMap('map-tuscany-interactive', plan);
  else setTimeout(whenLeaflet, 100);
})();
