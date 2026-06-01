#!/usr/bin/env node
/**
 * Navigation smoke for Étude.
 *
 * Exercises the high-risk handoffs that have regressed before:
 * Home ⇄ Journal ⇄ Compare ⇄ Regimen ⇄ Insights, major sub-tabs,
 * and opening the guided check-in camera after tab switching.
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

const onePx = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const userKey = 'testexamplecom';
const logs = [
  { id: 101, date: '2026-05-24', area: 'full-face', rating: 7, photo: onePx, metricSnapshot: { redness: 'Low', hydration: 'Good', texture: 'Even', breakouts: 'Clear', barrier: 'Steady', sensitivity: 'Settled' }, concerns: [] },
  { id: 102, date: '2026-05-20', area: 'full-face', rating: 6, photo: onePx, metricSnapshot: { redness: 'Mild', hydration: 'Balanced', texture: 'Uneven', breakouts: 'Few', barrier: 'Holding', sensitivity: 'Tender' }, concerns: ['redness'] },
];

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
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, permissions: ['camera'] });
  await context.addInitScript(({ logs, userKey }) => {
    const done = { stage: 'done', skipped: true };
    localStorage.setItem('lumiere:session', JSON.stringify({ email: 'test@example.com', name: 'Jenni' }));
    localStorage.setItem(`lumiere:logs:${userKey}`, JSON.stringify(logs));
    localStorage.setItem(`lumiere:onboardingState:${userKey}`, JSON.stringify(done));
    localStorage.setItem('lumiere:onboardingState', JSON.stringify(done));
  }, { logs, userKey });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/cdn\.tailwindcss\.com|AuthRetryableFetchError|503|smoke-test/.test(text)) return;
    consoleErrors.push(text.slice(0, 500));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err).slice(0, 500)));

  const tapTab = async (label) => {
    await page.getByRole('button', { name: new RegExp(label, 'i') }).last().click();
    await page.waitForTimeout(120);
  };
  const tapText = async (label) => {
    const loc = page.getByText(new RegExp(label, 'i')).first();
    if (await loc.count()) {
      await loc.click();
      await page.waitForTimeout(120);
    }
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 10000 });
    await page.getByRole('button', { name: /home/i }).last().waitFor({ timeout: 10000 });

    const initialPhotoButton = page.locator('button[aria-label="Check in today"], button[aria-label*="Upload photo"], button[aria-label*="Add a new photo"]').first();
    await initialPhotoButton.evaluate((el) => el.click());
    await page.getByText(/Done/i).first().waitFor({ timeout: 5000 });
    await tapText('Focus areas');
    await tapText('Core set');
    await page.getByRole('button', { name: /close camera/i }).click();
    await page.waitForTimeout(200);

    await tapTab('Journal');
    await tapText('Timeline');
    await tapText('Library');
    await tapText('Today');

    await tapTab('Compare');
    await tapText('Product');
    await tapText('Procedure');
    await tapText('Quick');

    await tapTab('Regimen');
    await tapTab('Insights');
    await tapText('Picks');
    await tapText('Budget');
    await tapText('Ask');
    await tapText('Learn');
    await tapTab('Home');
  } catch (err) {
    pageErrors.push(`navigation script failed: ${err.message || err}`);
  }

  await browser.close();
  server.close();

  console.log('\n=== Playwright navigation smoke ===\n');
  console.log(`  url:             ${url}`);
  console.log(`  console errors:  ${consoleErrors.length}`);
  consoleErrors.forEach((e, i) => console.log(`    [${i}] ${e}`));
  console.log(`  page errors:     ${pageErrors.length}`);
  pageErrors.forEach((e, i) => console.log(`    [${i}] ${e}`));
  const failed = consoleErrors.length > 0 || pageErrors.length > 0;
  console.log(`\n${failed ? 'FAIL' : 'PASS'} — navigation smoke\n`);
  process.exit(failed ? 1 : 0);
})();
