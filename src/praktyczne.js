import plan from '../plan_2bazy.json';
import { renderCosts, renderTodo, renderPractical } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome, initTodo } from './site.js';
import { initWeather } from './weather.js';
import './style.css';

(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
})();

const app = document.getElementById('app');
const weather = `
  <section class="section" id="pogoda">
    <h2 class="section-title">Pogoda we wrześniu</h2>
    <div id="weather-container"></div>
  </section>`;
app.innerHTML =
  renderSiteNav('praktyczne') +
  `<div class="page">${renderCosts(plan.costs)}${weather}${renderTodo(plan.todo)}${renderPractical(plan.practical_info)}</div>` +
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
