import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './theme.css';

import App from './App';
import reportWebVitals from './reportWebVitals';
import { disableBrowserScrollRestoration, pinWindowToTop } from './components/ScrollManager';
import { registerPwaServiceWorker } from './utils/pwaBootstrap';

if (typeof window !== 'undefined') {
  disableBrowserScrollRestoration();
  window.addEventListener('beforeunload', () => {
    pinWindowToTop();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      pinWindowToTop();
    }
  });
}

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
      if (!navigator.onLine) {
        return;
      }
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

registerPwaServiceWorker();
