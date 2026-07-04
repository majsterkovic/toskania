import plan3 from '../plan.json';
import plan2 from '../plan_2bazy.json';
import { renderApp, renderVariantsSection, initDayNav, initGallery } from './render.js';
import { initAllMaps, swapMapTiles } from './maps.js';
import { initWeather } from './weather.js';
import './style.css';

// Apply theme before first paint to prevent FOUC
(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

let currentPlan = plan3;

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const cards = document.querySelectorAll('.day-card');
  cards.forEach((el) => el.classList.add('reveal'));
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
  cards.forEach((el) => obs.observe(el));
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.classList.contains('dark');
  btn.textContent = isDark ? '☀' : '◑';
  btn.title = isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';
  btn.addEventListener('click', () => {
    const nowDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
    btn.textContent = nowDark ? '☀' : '◑';
    btn.title = nowDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';
    swapMapTiles();
  });
}

function initTodo() {
  const STORAGE_KEY = 'todo-done-toskania-2026';
  let done = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  document.querySelectorAll('.todo-check').forEach((cb) => {
    const id = cb.dataset.todoId;
    if (done.has(id)) {
      cb.checked = true;
      cb.closest('.todo-item').classList.add('is-done');
    }
    cb.addEventListener('change', () => {
      if (cb.checked) done.add(id); else done.delete(id);
      cb.closest('.todo-item').classList.toggle('is-done', cb.checked);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
    });
  });
}

function mount(plan) {
  const app = document.getElementById('app');
  app.innerHTML = renderApp(plan);
  initDayNav();
  initGallery();
  initVariantsToggle();
  initTodo();
  initThemeToggle();
  initWeather('weather-container');
  requestAnimationFrame(initScrollReveal);
  if (typeof window !== 'undefined') {
    const initMaps = () => {
      if (window.L) {
        initAllMaps(plan);
      } else {
        setTimeout(initMaps, 100);
      }
    };
    requestAnimationFrame(() => setTimeout(initMaps, 50));
  }
}

function initVariantsToggle() {
  document.querySelectorAll('[data-plan-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.planToggle;
      currentPlan = target === '2bazy' ? plan2 : plan3;
      mount(currentPlan);
      requestAnimationFrame(() => {
        const variantsSection = document.getElementById('warianty');
        if (variantsSection) variantsSection.scrollIntoView({ behavior: 'smooth' });
      });
    });
  });
}

mount(currentPlan);
