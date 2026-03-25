const CACHE_NAME = 'qibla-compass-v2';
const TILE_CACHE = 'qibla-tiles-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Tiles: cache-first, then network (caches result for future offline use)
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Message-based tile pre-caching ──
self.addEventListener('message', e => {
  const { data } = e;
  if (!data) return;

  if (data.type === 'PRECACHE_TILES') {
    precacheTiles(data.tiles, e.source);
  }
  if (data.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE).then(() => {
      e.source.postMessage({ type: 'TILE_CACHE_CLEARED' });
    });
  }
  if (data.type === 'GET_TILE_CACHE_SIZE') {
    getTileCacheSize().then(info => {
      e.source.postMessage({ type: 'TILE_CACHE_SIZE', ...info });
    });
  }
});

async function precacheTiles(tileUrls, client) {
  const cache = await caches.open(TILE_CACHE);
  const total = tileUrls.length;
  let done = 0, errors = 0;
  const BATCH = 12;

  for (let i = 0; i < total; i += BATCH) {
    const batch = tileUrls.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async url => {
        const existing = await cache.match(url);
        if (existing) return; // skip already cached
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
        else throw new Error(res.status);
      })
    );
    done += batch.length;
    errors += results.filter(r => r.status === 'rejected').length;
    client.postMessage({ type: 'PRECACHE_PROGRESS', done, total, errors });
  }

  client.postMessage({ type: 'PRECACHE_COMPLETE', total, errors });
}

async function getTileCacheSize() {
  try {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    let bytes = 0;
    for (const req of keys) {
      const res = await cache.match(req);
      if (res) { const b = await res.clone().blob(); bytes += b.size; }
    }
    return { count: keys.length, bytes };
  } catch { return { count: 0, bytes: 0 }; }
}
