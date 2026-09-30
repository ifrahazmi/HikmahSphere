/**
 * Post-build: emit bootstrap-manifest.json for offline PWA startup caching.
 * Run after `react-scripts build`.
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PUBLIC_INDEX = path.join(__dirname, '..', 'public', 'index.html');
const ASSET_MANIFEST = path.join(BUILD_DIR, 'asset-manifest.json');
const OUTPUT = path.join(BUILD_DIR, 'bootstrap-manifest.json');

const BOOTSTRAP_VERSION = 'v1';

const STATIC_URLS = [
  '/',
  '/index.html',
  '/bootstrap-manifest.json',
  '/manifest.json',
  '/logo.png',
  '/disconnect.png',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

const collectAppleSplashUrls = () => {
  const html = fs.readFileSync(PUBLIC_INDEX, 'utf8');
  const matches = html.match(/href="(\/apple-splash-[^"]+\.png)"/g) || [];
  return matches.map((m) => m.replace(/^href="/, '').replace(/"$/, ''));
};

const normalizeUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return null;
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
};

const collectWebpackUrls = (manifest) => {
  const urls = new Set();
  const entrypoints = Array.isArray(manifest.entrypoints) ? manifest.entrypoints : [];
  entrypoints.forEach((entry) => {
    const normalized = normalizeUrl(entry);
    if (normalized) urls.add(normalized);
  });

  const files = manifest.files || {};
  Object.values(files).forEach((value) => {
    const normalized = normalizeUrl(value);
    if (!normalized) return;
    if (
      normalized.includes('/static/js/')
      || normalized.includes('/static/css/')
    ) {
      urls.add(normalized);
    }
  });

  return urls;
};

const main = () => {
  if (!fs.existsSync(ASSET_MANIFEST)) {
    console.error('asset-manifest.json not found. Run react-scripts build first.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(ASSET_MANIFEST, 'utf8'));
  const urls = new Set(STATIC_URLS);
  collectAppleSplashUrls().forEach((url) => urls.add(url));
  collectWebpackUrls(manifest).forEach((url) => urls.add(url));

  const payload = {
    version: BOOTSTRAP_VERSION,
    cacheName: 'hikmahsphere-bootstrap-v1',
    generatedAt: new Date().toISOString(),
    urls: Array.from(urls).sort(),
  };

  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT} (${payload.urls.length} urls)`);
};

main();
