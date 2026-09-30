/**
 * Offline PWA bootstrap coordination (client ↔ firebase-messaging-sw.js).
 *
 * Manual QA (production build): `npm run build && npx serve -s build -l 3000`
 * 1. First online visit → readiness → app; Application tab shows hikmahsphere-bootstrap-v1.
 * 2. Reopen online → cache hits in SW (enable hsBootstrapDebug in localStorage).
 * 3. Offline after first visit → StartupReadinessScreen offline UI, no blank screen.
 * 4–6. Airplane mode on installed PWA; retry on online; deploy bumps manifest version.
 */

export const BOOTSTRAP_CACHE_KEY = 'hikmahsphere-bootstrap-v1';
export const BOOTSTRAP_READY_LS_KEY = 'offlineBootstrapReady';
const BOOTSTRAP_MANIFEST_PATH = '/bootstrap-manifest.json';

export type BootstrapStatus = {
  ready: boolean;
  cachedCount: number;
  total: number;
  version: string | null;
  cacheName: string;
  urls?: string[];
};

const isDebugLogging = (): boolean => {
  if (process.env.NODE_ENV === 'development') return true;
  try {
    return localStorage.getItem('hsBootstrapDebug') === '1';
  } catch {
    return false;
  }
};

export const logBootstrapDev = (...args: unknown[]): void => {
  if (isDebugLogging()) {
    console.log('[PWA bootstrap]', ...args);
  }
};

export const fetchBootstrapManifest = async (): Promise<{
  version: string;
  cacheName: string;
  urls: string[];
} | null> => {
  try {
    const response = await fetch(BOOTSTRAP_MANIFEST_PATH, { cache: 'no-cache' });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.urls)) return null;
    return payload;
  } catch {
    return null;
  }
};

const waitForSwMessage = <T>(
  type: string,
  timeoutMs = 8_000
): Promise<T | null> => {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== type) return;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(event.data as T);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
  });
};

export const queryBootstrapStatusFromSw = async (): Promise<BootstrapStatus | null> => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'GET_BOOTSTRAP_STATUS' });
    const response = await waitForSwMessage<{ type: string; status: BootstrapStatus }>(
      'BOOTSTRAP_STATUS'
    );
    return response?.status ?? null;
  } catch {
    return null;
  }
};

export const isBootstrapReady = async (): Promise<boolean> => {
  const status = await queryBootstrapStatusFromSw();
  if (status?.ready) {
    markBootstrapReady();
    return true;
  }
  try {
    return localStorage.getItem(BOOTSTRAP_READY_LS_KEY) === '1';
  } catch {
    return false;
  }
};

export const markBootstrapReady = (failedUrls?: string[]): void => {
  try {
    localStorage.setItem(BOOTSTRAP_READY_LS_KEY, '1');
  } catch {
    /* ignore */
  }
  if (failedUrls && failedUrls.length > 0) {
    logBootstrapDev('bootstrap partial failure', failedUrls);
  }
};

export const postCacheBootstrapToSw = async (urls: string[]): Promise<boolean> => {
  if (!urls.length || !('serviceWorker' in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'CACHE_BOOTSTRAP', urls });

  const response = await waitForSwMessage<{
    type: string;
    ready?: boolean;
    failed?: string[];
  }>('BOOTSTRAP_CACHE_RESULT');

  if (response?.ready) {
    markBootstrapReady(response.failed);
    return true;
  }
  return false;
};

export const warmBootstrapCache = async (): Promise<void> => {
  logBootstrapDev('warming bootstrap cache');
  const manifest = await fetchBootstrapManifest();
  if (!manifest?.urls?.length) {
    logBootstrapDev('manifest missing; skip warm');
    return;
  }
  await postCacheBootstrapToSw(manifest.urls);
  const status = await queryBootstrapStatusFromSw();
  if (status?.ready) {
    markBootstrapReady();
  }
};

export const enableBootstrapDebugInSw = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  try {
    localStorage.setItem('hsBootstrapDebug', '1');
  } catch {
    /* ignore */
  }
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'BOOTSTRAP_DEBUG_ON' });
};

export const registerPwaServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('hsBootstrapDebug') === '1') {
      void enableBootstrapDebugInSw();
    }

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => {
              const scriptUrl =
                registration.active?.scriptURL
                || registration.installing?.scriptURL
                || registration.waiting?.scriptURL
                || '';
              return !scriptUrl.includes('/firebase-messaging-sw.js');
            })
            .map((registration) => registration.unregister())
        );
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
};
