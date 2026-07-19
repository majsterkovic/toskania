/**
 * Wspólny "chrome" strony — nawigacja serwisu + inicjalizacja motywu i reveal.
 * Współdzielony przez wszystkie strony (Plan, Mapa, Galeria, Praktyczne).
 */
import { swapMapTiles } from './maps.js';

const BASE = import.meta.env.BASE_URL;

const NAV_LINKS = [
  ['plan', '', 'Plan'],
  ['mapa', 'mapa/', 'Mapa'],
  ['galeria', 'galeria/', 'Galeria'],
  ['praktyczne', 'praktyczne/', 'Praktyczne'],
  ['short', 'short/', 'Skrót'],
];

/** Nawigacja serwisu. `active` = klucz bieżącej strony (plan/mapa/galeria/praktyczne/short). */
export function renderSiteNav(active = 'plan') {
  const links = NAV_LINKS.map(
    ([key, href, label]) =>
      `<a href="${BASE}${href}"${key === active ? ' class="is-active" aria-current="page"' : ''}>${label}</a>`
  ).join('');
  return `
    <nav class="site-nav" id="site-nav" aria-label="Nawigacja strony">
      <a class="site-nav__brand" href="${BASE}">Toskania</a>
      <div class="site-nav__links">${links}</div>
      <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Przełącz tryb ciemny/jasny">◑</button>
    </nav>
  `;
}

/** Wspólna stopka stron pobocznych. */
export function renderSiteFooter() {
  return `
    <footer class="footer">
      <p>Toskania 2026 · 12–27 września 2026</p>
      <p class="footer__credit">Mapy: <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">© OpenStreetMap</a> · Zdjęcia: Wikimedia Commons</p>
    </footer>
  `;
}

/** Checkboxy todo z zapisem w localStorage (strona Praktyczne). */
export function initTodo() {
  const STORAGE_KEY = 'todo-done-toskania-2026';
  const done = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  document.querySelectorAll('.todo-check').forEach((cb) => {
    const id = cb.dataset.todoId;
    if (done.has(id)) {
      cb.checked = true;
      cb.closest('.todo-item')?.classList.add('is-done');
    }
    cb.addEventListener('change', () => {
      if (cb.checked) done.add(id); else done.delete(id);
      cb.closest('.todo-item')?.classList.toggle('is-done', cb.checked);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
    });
  });
}

/** Motyw jasny/ciemny — przycisk w nawigacji. */
export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const setLabel = (dark) => {
    btn.textContent = dark ? '☀' : '◑';
    btn.title = dark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';
  };
  setLabel(document.documentElement.classList.contains('dark'));
  btn.addEventListener('click', () => {
    const nowDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
    setLabel(nowDark);
    swapMapTiles();
  });
}

/** Delikatne wejście elementów .reveal przy scrollu (respektuje reduced-motion). */
export function initScrollReveal(selector = '.reveal') {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.05 }
  );
  els.forEach((el) => obs.observe(el));
}

/** Zamontuj wspólny chrome (motyw + reveal). Wołane po wstrzyknięciu HTML strony. */
export function initChrome(revealSelector = '.reveal') {
  initThemeToggle();
  requestAnimationFrame(() => initScrollReveal(revealSelector));
}
