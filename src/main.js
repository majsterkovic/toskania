import plan from '../plan.json';
import { renderApp, initDayNav, initGallery } from './render.js';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = renderApp(plan);
initDayNav();
initGallery();
