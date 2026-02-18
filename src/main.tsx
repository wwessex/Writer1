import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Clean up stale caches from the old vanilla service worker (pre-Vite migration).
// The old SW used cache names like "draftharbour-v22" which Workbox won't remove.
if ('caches' in window) {
  caches.keys().then(names => {
    for (const name of names) {
      if (name.startsWith('draftharbour-')) {
        caches.delete(name);
      }
    }
  });
}

// Safety net: log unhandled promise rejections so they don't vanish silently.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker is registered automatically by VitePWA plugin via registerSW.js
