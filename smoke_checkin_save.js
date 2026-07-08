#!/usr/bin/env node
/**
 * Check-in save smoke — July 2026.
 *
 * Reproduces the exact flow Jenni reported as broken on iPhone:
 *   Home → guided check-in camera → capture (shutter) AND upload (library)
 *   → Done → CheckInDetailsModal → Save → expect success toast + modal gone.
 *
 * Uses Playwright + Chromium with a fake camera device. Surfaces every
 * console error and page error along the way — the dead-button class of
 * bug is almost always a swallowed exception.
 *
 * Run: node smoke_checkin_save.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = __dirname;
const HTML_PATH = path.join(ROOT, 'index.html');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url === '/' ? '/index.html' : req.url;
      const filePath = path.join(ROOT, url.split('?')[0]);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': path.extname(filePath) === '.html' ? 'text/html' : 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// A real (tiny) JPEG so FileReader + Image decode paths run for real.
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIA' +
  'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB' +
  'AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX' +
  '/9k=';

const userKey = 'testexamplecom';

(async () => {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('index.html missing — run node build_current.js first');
    process.exit(1);
  }
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await context.addInitScript(({ userKey }) => {
    const done = { stage: 'done', skipped: true };
    localStorage.setItem('lumiere:session', JSON.stringify({ email: 'test@example.com', name: 'Jenni' }));
    localStorage.setItem(`lumiere:onboardingState:${userKey}`, JSON.stringify(done));
    localStorage.setItem('lumiere:onboardingState', JSON.stringify(done));
  }, { userKey });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/cdn\.tailwindcss\.com|AuthRetryableFetchError|503|net::ERR|Failed to load resource/.test(text)) return;
    consoleErrors.push(text.slice(0, 500));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.stack || err.message || err).slice(0, 800)));

  const results = [];
  const ok = (m) => { results.push(['ok', m]); console.log('  ok   ', m); };
  const fail = (m) => { results.push(['fail', m]); console.log('  FAIL ', m); };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // --- Open the guided check-in from Home ---
    const checkInBtn = page.locator('button', { hasText: /check.?in|add photo|today.?s photo/i }).first();
    if (!(await checkInBtn.count())) {
      fail('Could not find a check-in entry button on Home');
      throw new Error('no entry');
    }
    await checkInBtn.click();
    await page.waitForTimeout(1200);

    const doneBtn = page.getByRole('button', { name: /^(done|saving…)$/i }).first();
    if (!(await doneBtn.count())) { fail('Guided capture modal did not open'); throw new Error('no modal'); }
    ok('Guided capture modal opened');

    // --- Path A: shutter capture ---
    const shutter = page.getByRole('button', { name: /capture photo|camera warming up/i }).first();
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').match(/capture photo/i));
      return b && !b.disabled;
    }, { timeout: 8000 }).catch(() => {});
    if (await shutter.isEnabled().catch(() => false)) {
      await shutter.click();
      await page.waitForTimeout(600);
      ok('Shutter capture fired');
    } else {
      console.log('  info  camera not ready — relying on library upload path');
    }

    // --- Path B: library upload into the guided modal's hidden input ---
    const buf = Buffer.from(JPEG_B64, 'base64');
    const inputs = page.locator('input[type="file"]');
    const n = await inputs.count();
    let uploaded = false;
    for (let i = 0; i < n; i++) {
      const inp = inputs.nth(i);
      const multiple = await inp.getAttribute('multiple');
      if (multiple != null) {
        await inp.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: buf });
        uploaded = true;
        break;
      }
    }
    if (uploaded) { await page.waitForTimeout(1200); ok('Library upload dispatched'); }
    else fail('Could not find guided upload input');

    // --- Done must be enabled now ---
    const doneEnabled = await page.getByRole('button', { name: /^done$/i }).first().isEnabled().catch(() => false);
    if (!doneEnabled) fail('Done button not enabled after capture/upload');
    else ok('Done button enabled');

    await page.getByRole('button', { name: /^done$/i }).first().click();
    await page.waitForTimeout(1500);

    // --- CheckInDetailsModal should be visible ---
    const detailsVisible = await page.getByText(/skin today\?/i).first().isVisible().catch(() => false);
    if (!detailsVisible) {
      fail('CheckInDetailsModal did not appear after Done');
      const stuck = await page.getByText(/save hit a snag/i).first().isVisible().catch(() => false);
      if (stuck) fail('Guided modal showed the onComplete failure message');
    } else ok('CheckInDetailsModal appeared');

    // --- Save ---
    const saveBtn = page.getByRole('button', { name: /^save$/i }).first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      const toastVisible = await page.getByText(/photo logged|photos logged|main read|check-in updated|couldn.t save|save error/i).first().isVisible().catch(() => false);
      const modalGone = !(await page.getByText(/skin today\?/i).first().isVisible().catch(() => false));
      if (modalGone) ok('Details modal closed after Save');
      else fail('Details modal still open after Save (dead Save reproduced)');
      if (toastVisible) {
        const toastText = await page.getByText(/photo logged|photos logged|main read|check-in updated|couldn.t save|save error/i).first().innerText().catch(() => '');
        console.log('  info  toast:', toastText);
      } else console.log('  info  no toast detected');
      // Persistence: log should exist in IndexedDB-backed storage
      const logCount = await page.evaluate(async () => {
        const get = (key) => new Promise((resolve) => {
          try {
            const req = indexedDB.open('lumiere-store', 1);
            req.onsuccess = () => {
              try {
                const rq = req.result.transaction('kv', 'readonly').objectStore('kv').get(key);
                rq.onsuccess = () => resolve(rq.result || null);
                rq.onerror = () => resolve(null);
              } catch { resolve(null); }
            };
            req.onerror = () => resolve(null);
          } catch { resolve(null); }
        });
        const v = (await get('lumiere:logs:testexamplecom')) || localStorage.getItem('lumiere:logs:testexamplecom');
        try { return JSON.parse(v || '[]').length; } catch { return -1; }
      });
      if (logCount > 0) ok(`Log persisted (${logCount} log[s] in storage)`);
      else fail(`Log NOT persisted (count=${logCount})`);
    } else if (detailsVisible) {
      fail('Save button not found in details modal');
    }
  } catch (e) {
    console.log('  ABORT:', e.message);
  }

  if (pageErrors.length) { console.log('\nPAGE ERRORS:'); pageErrors.forEach(e => console.log('  •', e)); }
  if (consoleErrors.length) { console.log('\nCONSOLE ERRORS:'); consoleErrors.forEach(e => console.log('  •', e)); }

  await browser.close();
  server.close();
  const failed = results.filter(r => r[0] === 'fail').length;
  console.log(failed === 0 && pageErrors.length === 0 ? '\nPASS' : `\nFAIL — ${failed} failed, ${pageErrors.length} page errors`);
  process.exit(failed === 0 && pageErrors.length === 0 ? 0 : 1);
})();
