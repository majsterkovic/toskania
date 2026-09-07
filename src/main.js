import { trip as plan } from './trip.js';
import { renderTimeline, renderDayPage } from './render.js';
import { renderSiteNav, initChrome } from './site.js';
import { initBaseMaps, initDayMap, initTransitDayMap, destroyAllMaps } from './maps.js';
import { applyStoredTheme } from './theme.js';
// Strona planu renderuje oś czasu, strony dni i mapy baz — potrzebuje wszystkiego
// poza galerią i sekcją praktyczną.
import './styles/base.css';
import './styles/nav.css';
import './styles/timeline.css';
import './styles/day.css';
import './styles/map.css';

// Motyw przed pierwszym malowaniem (bez FOUC)
applyStoredTheme();

const app = document.getElementById('app');
let lastDayNum = null;

function parseHash() {
  const m = /^#\/?dzien-(\d+)/.exec(location.hash || '');
  return m ? parseInt(m[1], 10) : null;
}

function whenLeaflet(fn) {
  if (window.L) fn();
  else setTimeout(() => whenLeaflet(fn), 100);
}

function renderDayView(dayNum) {
  const day = plan.days.find((d) => d.day_num === dayNum);
  if (!day) { location.hash = ''; return; }
  lastDayNum = dayNum;
  app.innerHTML = renderSiteNav(plan, 'plan') + renderDayPage(day, plan.meta.images, plan.bases, plan.days, plan.todo, plan.meta);
  initChrome();
  window.scrollTo(0, 0);
  if (day.type === 'transit' && day.route_points?.length) {
    whenLeaflet(() => initTransitDayMap(`map-day-${dayNum}`, day.route_points));
  } else if (day.base_id) {
    const base = plan.bases.find((b) => b.id === day.base_id);
    const destBase = day.next_base_id ? plan.bases.find((b) => b.id === day.next_base_id) : null;
    whenLeaflet(() => initDayMap(`map-day-${dayNum}`, base, day.attractions, destBase));
  }
}

function renderTimelineView() {
  app.innerHTML = renderSiteNav(plan, 'plan') + renderTimeline(plan);
  initChrome();
  whenLeaflet(() => initBaseMaps(plan));
  if (lastDayNum != null) {
    const row = app.querySelector(`a.tl-row[href="#/dzien-${lastDayNum}"]`);
    if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
  }
}

function renderView() {
  destroyAllMaps();
  const dayNum = parseHash();
  if (dayNum != null) renderDayView(dayNum);
  else renderTimelineView();
}

window.addEventListener('hashchange', renderView);
renderView();
