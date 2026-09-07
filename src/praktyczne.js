import { trip as plan } from './trip.js';
import { renderCosts, renderTodo, renderPractical } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome, initTodo } from './site.js';
import { initWeather } from './weather.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/practical.css';

applyStoredTheme();

const app = document.getElementById('app');
const weather = `
  <section class="section" id="pogoda">
    <h2 class="section-title">Pogoda we wrześniu</h2>
    <div id="weather-container"></div>
  </section>`;
// Strona zbiera cztery równorzędne sekcje (koszty, pogoda, todo, info), więc żadna
// z nich nie jest naturalnym h1 — tytuł strony jest tylko dla czytników ekranu.
app.innerHTML =
  renderSiteNav('praktyczne') +
  `<main class="page" id="tresc">
    <h1 class="visually-hidden">Informacje praktyczne — Toskania 2026</h1>
    ${renderCosts(plan.costs)}${weather}${renderTodo(plan.todo)}${renderPractical(plan.practical_info)}
  </main>` +
  renderSiteFooter();

const weatherLocs = (plan.bases || [])
  .filter((b) => Array.isArray(b.coords) && b.coords.length === 2)
  .map((b) => ({
    id: b.id,
    name: (b.region || b.name).split('·')[0].trim(),
    sub: b.name,
    lat: b.coords[0],
    lon: b.coords[1],
  }));
initWeather('weather-container', weatherLocs.length ? weatherLocs : undefined);
initTodo();
initChrome();
