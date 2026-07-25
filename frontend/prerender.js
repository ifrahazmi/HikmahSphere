/**
 * Custom prerendering script with react-helmet-async support
 * 
 * Uses Puppeteer directly to render pages and capture Helmet meta tags
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 4567;
const BUILD_DIR = path.join(__dirname, 'build');
const SITE_ORIGIN = 'https://hikmahsphere.site';

// Public, indexable routes to prerender if the sitemap can't be read.
// Auth/protected routes (/auth, /profile, /dashboard, /salah-tracker) are
// intentionally excluded — they should not be indexed.
const FALLBACK_ROUTES = [
  '/',
  '/about',
  '/maktab',
  '/contact',
  '/hajj-guide',
  '/prayers',
  '/prayers/qibla',
  '/quran',
  '/quran/tafsir',
  '/dhikr-dua',
  '/zakat',
  '/community',
];

// Derive routes from build/sitemap.xml so the sitemap is the single source of
// truth. Falls back to FALLBACK_ROUTES when the sitemap is missing/unreadable.
function getRoutes() {
  const sitemapPath = path.join(BUILD_DIR, 'sitemap.xml');
  try {
    const xml = fs.readFileSync(sitemapPath, 'utf-8');
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    const routes = locs
      .map((loc) => loc.replace(SITE_ORIGIN, '').replace(/\/$/, '') || '/')
      .filter((route) => route.startsWith('/'));
    const unique = Array.from(new Set(['/', ...routes]));
    if (unique.length > 1) {
      console.log(`🗺  Derived ${unique.length} routes from sitemap.xml`);
      return unique;
    }
  } catch (_error) {
    console.warn('⚠ Could not read build/sitemap.xml — using fallback route list.');
  }
  return FALLBACK_ROUTES;
}

function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch (_error) {
    console.warn('⚠ Puppeteer is not installed. Skipping prerender step.');
    return null;
  }
}

// Resolve a usable Chromium executable across environments.
// Priority: explicit env vars → puppeteer's bundled browser → system default.
function resolveChromiumPath(puppeteer) {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fall back to the browser Puppeteer downloaded on install.
  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      return bundled;
    }
  } catch (_error) {
    // Ignore — will let Puppeteer pick its own default below.
  }

  return null;
}

// Start static server
function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url);
    
    if (!fs.existsSync(filePath)) {
      filePath = path.join(BUILD_DIR, 'index.html');
    }

    const extname = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(` Static server running on http://localhost:${PORT}`);
  });

  return server;
}

// Prerender a single page
async function prerenderPage(browser, route) {
  const page = await browser.newPage();
  
  try {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`📄 Prerendering: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for Helmet tags to be injected
    await page.waitForSelector('meta[name="description"]', { timeout: 5000 });
    
    // Get the full HTML after React and Helmet have rendered
    let html = await page.content();

    // Clean up duplicate meta tags - remove fallback meta description from index.html
    // Helmet injects the correct one, so we keep the last occurrence
    const descriptionMatch = html.match(/<meta name="description" content="([^"]*)"[^>]*>/g);
    if (descriptionMatch && descriptionMatch.length > 1) {
      // Remove all meta description tags
      html = html.replace(/<meta name="description" content="[^"]*"[^>]*>/g, '');
      // Insert the last (correct) one before </head>
      const lastDesc = descriptionMatch[descriptionMatch.length - 1];
      html = html.replace('</head>', `${lastDesc}</head>`);
    }

    // Create directory for route
    const routeDir = route === '/' ? BUILD_DIR : path.join(BUILD_DIR, route);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }
    
    // Save prerendered HTML
    const outputPath = path.join(routeDir, 'index.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    
    console.log(`✅ Saved: ${outputPath}`);
    
    // Extract and log meta description for verification
    const metaMatch = html.match(/<meta name="description" content="([^"]*)"/);
    if (metaMatch) {
      console.log(`   📝 Description: ${metaMatch[1].substring(0, 60)}...`);
    }
    
  } catch (error) {
    console.error(`❌ Error prerendering ${route}:`, error.message);
  } finally {
    await page.close();
  }
}

// Main prerender function
async function prerender() {
  console.log('🚀 Starting prerendering...\n');

  const puppeteer = loadPuppeteer();
  if (!puppeteer) {
    return;
  }
  
  const server = startServer();

  const executablePath = resolveChromiumPath(puppeteer);
  if (executablePath) {
    console.log(`🌐 Using Chromium at: ${executablePath}`);
  } else {
    console.log('🌐 Using Puppeteer default Chromium.');
  }

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (launchError) {
    console.error('❌ Could not launch Chromium for prerendering:', launchError.message);
    console.error('   Set PUPPETEER_EXECUTABLE_PATH to a valid Chrome/Chromium binary and rebuild.');
    server.close();
    return;
  }

  const routes = getRoutes();

  try {
    for (const route of routes) {
      try {
        await prerenderPage(browser, route);
      } catch (routeError) {
        console.error(`❌ Failed to prerender ${route}:`, routeError.message);
        // Continue with next route
      }
    }
    
    console.log('\n✅ Prerendering complete!');
  } finally {
    await browser.close();
    server.close();
  }
}

prerender().catch(console.error);
