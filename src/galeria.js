import plan from '../plan_2bazy.json';
import { renderGallery, initGallery } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import './style.css';

(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
})();

const app = document.getElementById('app');
const images = plan.meta?.images ?? plan.images;
app.innerHTML = renderSiteNav('galeria') + `<div class="page">${renderGallery(images)}</div>` + renderSiteFooter();
initGallery();
initChrome();
