import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeSafeModeSession, installGlobalErrorHandlers } from '@/lib/errors';
import { detectRuntimePlatform, isDesktopRuntime } from '@/lib/runtimePlatform';

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

initializeSafeModeSession();
installGlobalErrorHandlers();


const rootElement = document.documentElement;
rootElement.dataset.runtime = isDesktopRuntime() ? 'desktop' : 'web';
rootElement.dataset.platform = detectRuntimePlatform();


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker is registered automatically by VitePWA plugin via registerSW.js
