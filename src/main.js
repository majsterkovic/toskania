import plan from '../plan.json';
import { renderApp, initDayNav, initGallery } from './render.js';
import { initAllMaps } from './maps.js';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = renderApp(plan);
initDayNav();
initGallery();

// Leaflet maps — po wyrenderowaniu HTML, z małym opóźnieniem
// żeby DOM był w pełni gotowy (szczególnie przy lazy-load sekcji)
if (typeof window !== 'undefined') {
  const initMaps = () => {
    if (window.L) {
      initAllMaps(plan);
    } else {
      // Leaflet jeszcze się ładuje z CDN
      setTimeout(initMaps, 100);
    }
  };
  // Użyj requestAnimationFrame żeby odczekać na pełny render
  requestAnimationFrame(() => setTimeout(initMaps, 50));
}
