import plan from '../plan.json';
import { renderApp, initDayNav } from './render.js';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = renderApp(plan);
initDayNav();
