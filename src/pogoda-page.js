import { trip as plan } from './trip.js';
import { renderPogoda, initPogoda } from './pogoda.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/practical.css';
import './styles/pogoda.css';

applyStoredTheme();

const app = document.getElementById('app');
app.innerHTML =
  renderSiteNav(plan, 'pogoda') +
  `<main class="page" id="tresc">${renderPogoda(plan.days)}</main>` +
  renderSiteFooter(plan);
initChrome();
initPogoda(plan.days, plan.meta.start_date, plan.meta.end_date);
