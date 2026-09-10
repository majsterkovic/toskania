import { trip as plan } from './trip.js';
import { renderBases } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/bases.css';

applyStoredTheme();

const app = document.getElementById('app');
app.innerHTML =
  renderSiteNav(plan, 'bazy') +
  `<main class="page" id="tresc">${renderBases(plan.bases)}</main>` +
  renderSiteFooter(plan);
initChrome();
