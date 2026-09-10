import { trip as plan } from './trip.js';
import { renderCosts, renderReservations, renderTodo, renderPractical } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome, initTodo } from './site.js';
import { doneStorageKey } from './done.js';
import { applyStoredTheme } from './theme.js';
import { esc } from './html.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/practical.css';

applyStoredTheme();

const app = document.getElementById('app');
// Strona zbiera trzy równorzędne sekcje (koszty, todo, info), więc żadna
// z nich nie jest naturalnym h1 — tytuł strony jest tylko dla czytników ekranu.
// Pogoda mieszka na osobnej zakładce /pogoda/.
app.innerHTML =
  renderSiteNav(plan, 'praktyczne') +
  `<main class="page" id="tresc">
    <h1 class="visually-hidden">Informacje praktyczne — ${esc(plan.meta.title)}</h1>
    ${renderReservations(plan.todo, doneStorageKey(plan))}${renderCosts(plan.costs)}${renderTodo(plan.todo)}${renderPractical(plan.practical_info)}
  </main>` +
  renderSiteFooter(plan);

initTodo(plan);
initChrome();
