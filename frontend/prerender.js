/**
 * Custom prerendering script with react-helmet-async support
 * 
 * Uses Puppeteer directly to render pages and capture Helmet meta tags
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROUTES = [
  '/',
  '/home',
  '/about',
  '/about-us',
  '/contact',
  '/hajj-guide',
  '/auth',
  '/prayers',
  '/prayers/qibla',
  '/quran',
  '/quran/tafsir',
  '/dhikr-dua',
  '/zakat',
  '/community',
  '/profile',
  '/salah-tracker',
  '/dashboard'
];

const PORT = 4567;
const BUILD_DIR = path.join(__dirname, 'build');

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
  
  const server = startServer();
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/lpdrfl6n16q5zdf8acp4bni7yczzcx3h-idx-builtins/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  try {
    for (const route of ROUTES) {
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
