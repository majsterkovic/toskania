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
