import plan from '../plan_2bazy.json';
import { renderGallery, initGallery } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/gallery.css';

(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
})();

const app = document.getElementById('app');
const images = plan.meta?.images ?? plan.images;
app.innerHTML =
  renderSiteNav('galeria') +
  `<main class="page" id="tresc">${renderGallery(images)}</main>` +
  renderSiteFooter();
initGallery();
initChrome();
