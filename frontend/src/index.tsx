import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './theme.css';

import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const message = event?.message || '';
    if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
      window.location.reload();
    }
  });

  // Capture the install prompt as early as possible. Chrome/Edge (Android & Windows)
  // can fire `beforeinstallprompt` before React mounts, so we stash it on window and
  // notify the app, enabling reliable one-click install.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.deferredInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('hs-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    window.deferredInstallPrompt = null;
    try {
      localStorage.setItem('hs_app_installed', '1');
    } catch {
      /* ignore storage errors */
    }
  });
}

const isLocalDevHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

if ('serviceWorker' in navigator && isLocalDevHost) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(async () => {
        // Clean up legacy app-shell workers to avoid stale cached bundles.
        // Keep only the Firebase messaging service worker.
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => {
              const scriptUrl = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || '';
              return !scriptUrl.includes('/firebase-messaging-sw.js');
            })
            .map((registration) => registration.unregister())
        );
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
