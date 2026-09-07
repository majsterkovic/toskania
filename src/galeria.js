import { trip as plan } from './trip.js';
import { renderGallery, initGallery } from './render.js';
import { renderSiteNav, renderSiteFooter, initChrome } from './site.js';
import { applyStoredTheme } from './theme.js';
import './styles/base.css';
import './styles/nav.css';
import './styles/gallery.css';

applyStoredTheme();

const app = document.getElementById('app');
const images = plan.meta?.images ?? plan.images;
app.innerHTML =
  renderSiteNav(plan, 'galeria') +
  `<main class="page" id="tresc">${renderGallery(images)}</main>` +
  renderSiteFooter(plan);
initGallery();
initChrome();
