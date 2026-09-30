/* Shared bootstrap cache helpers for firebase-messaging-sw.js */
var HS_BOOTSTRAP_CACHE_PREFIX = 'hikmahsphere-bootstrap-';
var HS_BOOTSTRAP_CACHE_DEFAULT = 'hikmahsphere-bootstrap-v1';
var HS_BOOTSTRAP_MANIFEST_PATH = '/bootstrap-manifest.json';

var hsBootstrapDebugEnabled = false;

self.enableHsBootstrapDebug = function enableHsBootstrapDebug() {
  hsBootstrapDebugEnabled = true;
};

self.isHsBootstrapFetchEnabled = function isHsBootstrapFetchEnabled(isLocalDev) {
  if (!isLocalDev) return true;
  return hsBootstrapDebugEnabled;
};

self.hsBootstrapLog = function hsBootstrapLog(message) {
  if (hsBootstrapDebugEnabled) {
    console.log('[SW]', message);
  }
};

self.normalizeBootstrapPath = function normalizeBootstrapPath(pathname) {
  if (!pathname) return '/';
  if (pathname === '/index.html') return '/index.html';
  return pathname;
};

self.isBootstrapAssetUrl = function isBootstrapAssetUrl(pathname, manifestUrls) {
  if (!Array.isArray(manifestUrls) || manifestUrls.length === 0) return false;
  var normalized = self.normalizeBootstrapPath(pathname);
  if (manifestUrls.indexOf(normalized) !== -1) return true;
  if (normalized !== '/' && manifestUrls.indexOf(pathname) !== -1) return true;
  return false;
};

self.cacheBootstrapUrls = async function cacheBootstrapUrls(cache, urls) {
  var results = await Promise.allSettled(
    (urls || []).map(async function (asset) {
      var response = await fetch(asset, { cache: 'no-cache' });
      if (!response || !response.ok) {
        throw new Error('Bootstrap fetch failed for ' + asset);
      }
      await cache.put(asset, response.clone());
      return asset;
    })
  );

  var cached = [];
  var failed = [];
  results.forEach(function (result, index) {
    if (result.status === 'fulfilled') {
      cached.push(urls[index]);
    } else {
      failed.push(urls[index]);
    }
  });

  return { cached, failed };
};

self.pruneBootstrapCaches = async function pruneBootstrapCaches(currentCacheName) {
  var keys = await caches.keys();
  var removed = [];
  await Promise.all(
    keys
      .filter(function (key) {
        return key.indexOf(HS_BOOTSTRAP_CACHE_PREFIX) === 0 && key !== currentCacheName;
      })
      .map(function (key) {
        removed.push(key);
        return caches.delete(key);
      })
  );
  if (removed.length > 0) {
    self.hsBootstrapLog('Old bootstrap cache removed: ' + removed.join(', '));
  }
  return removed;
};

self.loadBootstrapManifest = async function loadBootstrapManifest() {
  try {
    var response = await fetch(HS_BOOTSTRAP_MANIFEST_PATH, { cache: 'no-cache' });
    if (!response || !response.ok) return null;
    return await response.json();
  } catch (_error) {
    return null;
  }
};

self.installBootstrapCache = async function installBootstrapCache() {
  self.hsBootstrapLog('Bootstrap cache started');
  var manifest = await self.loadBootstrapManifest();
  if (!manifest || !Array.isArray(manifest.urls) || manifest.urls.length === 0) {
    self.hsBootstrapLog('Bootstrap cache failed: manifest missing');
    return { ready: false, cached: [], failed: [] };
  }

  var cacheName = manifest.cacheName || HS_BOOTSTRAP_CACHE_DEFAULT;
  var cache = await caches.open(cacheName);
  var manifestResponse = await fetch(HS_BOOTSTRAP_MANIFEST_PATH, { cache: 'no-cache' });
  if (manifestResponse && manifestResponse.ok) {
    await cache.put(HS_BOOTSTRAP_MANIFEST_PATH, manifestResponse.clone());
  }

  var result = await self.cacheBootstrapUrls(cache, manifest.urls);
  var required = manifest.urls.filter(function (url) {
    return url.indexOf('/static/js/main.') !== -1 || url === '/index.html';
  });
  var ready = required.every(function (url) {
    return result.cached.indexOf(url) !== -1;
  });

  if (ready) {
    self.hsBootstrapLog('Bootstrap cache completed');
  } else {
    self.hsBootstrapLog('Bootstrap cache failed: required assets missing');
  }

  return {
    ready,
    version: manifest.version || 'v1',
    cacheName,
    cached: result.cached,
    failed: result.failed,
    urls: manifest.urls,
  };
};

self.getBootstrapStatus = async function getBootstrapStatus() {
  var manifest = await self.loadBootstrapManifestFromCache();
  if (!manifest) {
    manifest = await self.loadBootstrapManifest();
  }
  if (!manifest || !Array.isArray(manifest.urls)) {
    return { ready: false, cachedCount: 0, total: 0, version: null, cacheName: HS_BOOTSTRAP_CACHE_DEFAULT };
  }

  var cacheName = manifest.cacheName || HS_BOOTSTRAP_CACHE_DEFAULT;
  var cache = await caches.open(cacheName);
  var cachedCount = 0;
  for (var i = 0; i < manifest.urls.length; i += 1) {
    var match = await cache.match(manifest.urls[i]);
    if (match) cachedCount += 1;
  }

  var required = manifest.urls.filter(function (url) {
    return url.indexOf('/static/js/main.') !== -1 || url === '/index.html';
  });
  var ready = true;
  for (var j = 0; j < required.length; j += 1) {
    var requiredMatch = await cache.match(required[j]);
    if (!requiredMatch) {
      ready = false;
      break;
    }
  }

  return {
    ready,
    cachedCount,
    total: manifest.urls.length,
    version: manifest.version || 'v1',
    cacheName,
    urls: manifest.urls,
  };
};

self.loadBootstrapManifestFromCache = async function loadBootstrapManifestFromCache() {
  var keys = await caches.keys();
  for (var i = 0; i < keys.length; i += 1) {
    if (keys[i].indexOf(HS_BOOTSTRAP_CACHE_PREFIX) !== 0) continue;
    var cache = await caches.open(keys[i]);
    var cached = await cache.match(HS_BOOTSTRAP_MANIFEST_PATH);
    if (!cached) continue;
    try {
      return await cached.json();
    } catch (_error) {
      return null;
    }
  }
  return null;
};

self.mergeBootstrapUrls = async function mergeBootstrapUrls(urls) {
  var status = await self.getBootstrapStatus();
  var cacheName = status.cacheName || HS_BOOTSTRAP_CACHE_DEFAULT;
  var cache = await caches.open(cacheName);
  self.hsBootstrapLog('Updating bootstrap cache');
  return self.cacheBootstrapUrls(cache, urls || []);
};
