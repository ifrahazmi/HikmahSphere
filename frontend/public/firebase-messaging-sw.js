// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
// Version 10.x adds iOS 16.4+ web push (APNs) support.
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-messaging-compat.js');

const CACHE_NAME = 'hikmahsphere-app-v4';
const TILE_CACHE = 'hikmahsphere-tiles-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/logo.png', '/favicon.ico'];
const OFFLINE_DOCUMENT = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>HikmahSphere Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:28rem;text-align:center}h1{margin:0 0 12px;color:#047857;font-size:1.75rem}p{margin:0;color:#475569;line-height:1.6}</style></head><body><main><h1>You're offline</h1><p>HikmahSphere could not load this page right now. Please check your connection and try again.</p></main></body></html>`;

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);

  await Promise.allSettled(
    APP_SHELL.map(async (asset) => {
      const response = await fetch(asset, { cache: 'no-cache' });
      if (response && response.ok) {
        await cache.put(asset, response.clone());
      }
    })
  );
};

const getNavigationFallback = async () => {
  const cachedIndex = await caches.match('/index.html');
  if (cachedIndex) {
    return cachedIndex;
  }

  const cachedRoot = await caches.match('/');
  if (cachedRoot) {
    return cachedRoot;
  }

  return new Response(OFFLINE_DOCUMENT, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
};

const getGenericFallback = () => new Response('', {
  status: 503,
  statusText: 'Offline'
});

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
  apiKey: "AIzaSyBNOcMgr3VPJKvNWfeXSMCg81QOEyfeEdo",
  authDomain: "finai-lab.firebaseapp.com",
  projectId: "finai-lab",
  storageBucket: "finai-lab.firebasestorage.app",
  messagingSenderId: "1074704609942",
  appId: "1:1074704609942:web:7b370c88202538cd3ac8b7",
  measurementId: "G-6EZ9QQ6XP0"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
const APP_MESSAGE_TYPE = 'HIKMAH_BACKGROUND_NOTIFICATION';
const RECENT_NOTIFICATION_TTL_MS = 60 * 1000;
const recentNotificationIds = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheAppShell().catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== TILE_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Tile requests: cache-first so offline map works after pre-cache.
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;

          return fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Let the browser handle PDF and worker files natively to avoid
  // corruption or "Failed to fetch" errors inside pdfjs / web workers.
  if (url.pathname.endsWith('.pdf') || url.pathname.endsWith('.mjs')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => getNavigationFallback())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => getGenericFallback());
    })
  );
});

self.addEventListener('message', (event) => {
  var data = event.data;
  if (!data || !event.source) return;

  if (data.type === 'PRECACHE_TILES') {
    precacheTiles(data.tiles || [], event.source);
  }

  if (data.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE).then(() => {
      event.source.postMessage({ type: 'TILE_CACHE_CLEARED' });
    });
  }

  if (data.type === 'GET_TILE_CACHE_SIZE') {
    getTileCacheSize().then((info) => {
      event.source.postMessage({ type: 'TILE_CACHE_SIZE', count: info.count, bytes: info.bytes });
    });
  }
});

async function precacheTiles(tileUrls, client) {
  var cache = await caches.open(TILE_CACHE);
  var total = tileUrls.length;
  var done = 0;
  var errors = 0;
  var batchSize = 12;

  for (var i = 0; i < total; i += batchSize) {
    var batch = tileUrls.slice(i, i + batchSize);
    var results = await Promise.allSettled(
      batch.map(async function(url) {
        var existing = await cache.match(url);
        if (existing) return;

        var response = await fetch(url);
        if (!response || !response.ok) {
          throw new Error('Tile request failed');
        }
        await cache.put(url, response);
      })
    );

    done += batch.length;
    errors += results.filter(function(result) { return result.status === 'rejected'; }).length;
    client.postMessage({ type: 'PRECACHE_PROGRESS', done: done, total: total, errors: errors });
  }

  client.postMessage({ type: 'PRECACHE_COMPLETE', total: total, errors: errors });
}

async function getTileCacheSize() {
  try {
    var cache = await caches.open(TILE_CACHE);
    var keys = await cache.keys();
    var bytes = 0;

    for (var i = 0; i < keys.length; i += 1) {
      var response = await cache.match(keys[i]);
      if (!response) continue;
      var blob = await response.clone().blob();
      bytes += blob.size;
    }

    return { count: keys.length, bytes: bytes };
  } catch (error) {
    return { count: 0, bytes: 0 };
  }
}

const createNotificationPayload = (payload) => {
  const id = payload?.data?.notificationId || payload?.messageId || `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    messageId: payload?.messageId,
    title: payload?.notification?.title || payload?.data?.title || 'New Notification',
    body: payload?.notification?.body || payload?.data?.body || '',
    timestamp: new Date().toISOString(),
    type: payload?.data?.type || 'info',
    data: payload?.data || {}
  };
};

const isDuplicateNotification = (notificationId) => {
  if (!notificationId) {
    return false;
  }

  const now = Date.now();

  for (const [storedNotificationId, storedTimestamp] of recentNotificationIds.entries()) {
    if (now - storedTimestamp > RECENT_NOTIFICATION_TTL_MS) {
      recentNotificationIds.delete(storedNotificationId);
    }
  }

  if (recentNotificationIds.has(notificationId)) {
    return true;
  }

  recentNotificationIds.set(notificationId, now);
  return false;
};

const broadcastToOpenClients = async (message) => {
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  for (const client of clientList) {
    client.postMessage(message);
  }
};

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const normalizedPayload = createNotificationPayload(payload);
  if (isDuplicateNotification(normalizedPayload.id)) {
    return;
  }
  const notificationTitle = normalizedPayload.title;
  const targetUrl = payload?.data?.url || '/';

  broadcastToOpenClients({
    type: APP_MESSAGE_TYPE,
    payload: normalizedPayload
  }).catch((error) => {
    console.error('[firebase-messaging-sw.js] Failed to send message to clients:', error);
  });

  const notificationOptions = {
    body: normalizedPayload.body,
    icon: '/small_logo.jpeg',
    tag: normalizedPayload.id,
    renotify: false,
    vibrate: [200, 100, 200],
    data: {
      url: targetUrl,
      notificationPayload: normalizedPayload
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Add notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event);

  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  const notificationPayload = event.notification?.data?.notificationPayload;

  // This looks to see if the current is already open and
  // focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];

        if (notificationPayload) {
          client.postMessage({
            type: APP_MESSAGE_TYPE,
            payload: notificationPayload
          });
        }

        if ('focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then((windowClient) => {
          if (windowClient && notificationPayload) {
            windowClient.postMessage({
              type: APP_MESSAGE_TYPE,
              payload: notificationPayload
            });
          }
          return windowClient;
        });
      }

      return undefined;
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// iOS 16.4+ PWA fallback: Firebase Messaging compat (10.x) internally registers
// its own `push` listener, which should handle iOS web push notifications.
// However, if a raw `push` event is NOT handled by Firebase (e.g. the payload
// doesn't conform to FCM format), this secondary handler will catch it.
//
// We use a SharedWorker-style flag written synchronously via postMessage back
// to ourselves to avoid double-notifications; but the simpler and safer approach
// is to check `event.data` and act only if there is no `gcm_message_id` field
// (which FCM always sets – indicating Firebase did NOT handle it).
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return; // Not JSON – ignore
  }

  // FCM-handled messages always contain `gcm_message_id`; Firebase Messaging
  // compat will have already shown the notification for those.  We only handle
  // raw web-push payloads that Firebase did NOT intercept (non-FCM format).
  if (payload?.gcm_message_id || payload?.['google.c.sender.id']) return;

  const title = payload?.notification?.title || payload?.data?.title || 'HikmahSphere';
  const body  = payload?.notification?.body  || payload?.data?.body  || '';
  const normalizedPayload = createNotificationPayload(payload);

  if (isDuplicateNotification(normalizedPayload.id)) {
    return;
  }

  event.waitUntil(
    Promise.all([
      broadcastToOpenClients({ type: APP_MESSAGE_TYPE, payload: normalizedPayload }).catch(() => {}),
      self.registration.showNotification(title, {
        body,
        icon: '/small_logo.jpeg',
        badge: '/small_logo.jpeg',
        tag: normalizedPayload.id,
        renotify: false,
        vibrate: [200, 100, 200],
        data: { url: payload?.data?.url || '/', notificationPayload: normalizedPayload },
      }),
    ])
  );
});
