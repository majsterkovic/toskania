import plan3 from '../plan.json';
import plan2 from '../plan_2bazy.json';
import { renderApp, renderVariantsSection, initDayNav, initGallery } from './render.js';
import { initAllMaps } from './maps.js';
import './style.css';

let currentPlan = plan3;

function mount(plan) {
  const app = document.getElementById('app');
  app.innerHTML = renderApp(plan);
  initDayNav();
  initGallery();
  initVariantsToggle();
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
