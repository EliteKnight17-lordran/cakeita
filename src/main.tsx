import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// After a new release, a page that was already open may ask for a file from the old build
// (for example the map) that no longer exists. Reload once to pick up the new build instead
// of showing a broken page.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('cakeita.reloadedAt') ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem('cakeita.reloadedAt', String(Date.now()));
  } catch {
    /* storage blocked: still reload once */
  }
  e.preventDefault();
  window.location.reload();
});

// Installable, works offline after the first visit. Skipped in development and for test robots.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
