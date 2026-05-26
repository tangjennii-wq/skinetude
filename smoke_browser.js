#!/usr/bin/env node
/**
 * Real-browser smoke for Étude — uses Playwright + Chromium so we catch the
 * class of boot/runtime issues jsdom can't reproduce (Supabase auth retry
 * hangs, CORS behavior, real timing, real fetch, real localStorage).
 *
 * Run via: node smoke_browser.js [--with-stale-auth]
 *
 * Exits with code 0 on pass, 1 on fail. Designed to plug into CI alongside
 * `npm run check`.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const HTML_PATH = path.join(__dirname, 'index.html');
const STALE_AUTH = process.argv.includes('--with-stale-auth');

// Tiny static server so we test against http:// (Supabase allows it,
// file:// is blocked by CORS).
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url === '/' ? '/index.html' : req.url;
      const filePath = path.join(__dirname, url.split('?')[0]);
      if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath).toLowerCase();
        const type = ext === '.html' ? 'text/html'
          : ext === '.js' ? 'application/javascript'
          : ext === '.css' ? 'text/css'
          : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  if (!fs.existsSync(HTML_PATH)) { console.error('index.html missing — run `node build_current.js` first'); process.exit(1); }

  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 }, // iPhone-ish (mobile-first)
  });

  // If --with-stale-auth, pre-populate localStorage with a fake Supabase
  // session token before the page loads. Reproduces the "returning user
  // with hung auth" scenario.
  if (STALE_AUTH) {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('sb-vdtmflgetzilcgtcsogt-auth-token', JSON.stringify({
          currentSession: {
            access_token: 'expired.token',
            refresh_token: 'expired.refresh',
            expires_at: Math.floor(Date.now() / 1000) - 3600,
            user: { id: 'fake-id', email: 'returning@example.test' },
          },
          expiresAt: Math.floor(Date.now() / 1000) - 3600,
        }));
        localStorage.setItem('lumiere:onboardingState', JSON.stringify({ stage: 'done', skipped: false }));
      } catch (_) {}
    });
  }

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter noise we don't care about.
      if (/cdn\.tailwindcss\.com|AuthRetryableFetchError|503|smoke-test/.test(text)) return;
      consoleErrors.push(text.slice(0, 300));
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err.message || err).slice(0, 300));
  });

  let mounted = false;
  let rootContent = 0;
  let diagnosticShown = false;
  let elapsed = 0;
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Wait up to 10s for either: #root has children, or boot-diagnostic appears.
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      const diag = document.getElementById('boot-diagnostic');
      return (root && root.children.length > 0) || diag;
    }, { timeout: 10000 });
    elapsed = Date.now() - t0;
    rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
    diagnosticShown = await page.evaluate(() => !!document.getElementById('boot-diagnostic'));
    mounted = rootContent > 0 && !diagnosticShown;
  } catch (e) {
    pageErrors.push('waitForFunction timeout: ' + (e.message || e).slice(0, 200));
  }

  await browser.close();
  server.close();

  // Report.
  const label = STALE_AUTH ? 'returning-user (stale Supabase token)' : 'fresh-user (no localStorage)';
  console.log(`\n=== Playwright real-browser smoke — ${label} ===\n`);
  console.log(`  url:             ${url}`);
  console.log(`  mount elapsed:   ${elapsed}ms`);
  console.log(`  #root chars:     ${rootContent}`);
  console.log(`  diagnostic shown: ${diagnosticShown ? 'YES (blank-page fallback fired)' : 'no'}`);
  console.log(`  console errors:  ${consoleErrors.length}`);
  consoleErrors.slice(0, 5).forEach((e, i) => console.log(`    [${i}] ${e}`));
  console.log(`  page errors:     ${pageErrors.length}`);
  pageErrors.slice(0, 5).forEach((e, i) => console.log(`    [${i}] ${e}`));

  const failed = !mounted || diagnosticShown || pageErrors.length > 0;
  console.log(`\n${failed ? 'FAIL' : 'PASS'} — ${label}\n`);
  process.exit(failed ? 1 : 0);
})();
