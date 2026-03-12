// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
// Version 10.x adds iOS 16.4+ web push (APNs) support.
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-messaging-compat.js');

const CACHE_NAME = 'hikmahsphere-app-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/logo.png', '/favicon.ico'];

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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
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
        .catch(() => caches.match('/index.html'))
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
        .catch(() => cachedResponse);
    })
  );
});

const createNotificationPayload = (payload) => {
  const id = payload?.messageId || payload?.data?.notificationId || `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  event.waitUntil(
    Promise.all([
      broadcastToOpenClients({ type: APP_MESSAGE_TYPE, payload: normalizedPayload }).catch(() => {}),
      self.registration.showNotification(title, {
        body,
        icon: '/small_logo.jpeg',
        badge: '/small_logo.jpeg',
        vibrate: [200, 100, 200],
        data: { url: payload?.data?.url || '/', notificationPayload: normalizedPayload },
      }),
    ])
  );
});
