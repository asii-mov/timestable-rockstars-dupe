import './styles.css';
import { initRouter } from './ui/router';
import { homeScreen } from './ui/screens/home';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

initRouter(app, homeScreen);

// Offline support in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}
