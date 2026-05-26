const puppeteer = require('puppeteer');
const path = require('path');

const fileUrl = 'file:///sessions/optimistic-magical-davinci/mnt/TangSkin/index.html';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errs = [];
  const consoleMsgs = [];
  page.on('pageerror', e => errs.push('PAGE: ' + e.message));
  page.on('error', e => errs.push('ERROR: ' + e.message));
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
  try {
    await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    console.log('navigation:', e.message);
  }
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.evaluate(() => document.body.innerHTML.slice(0, 800));
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 800));
  console.log('=== PAGE ERRORS ===');
  errs.slice(0, 10).forEach((e, i) => console.log(`[${i}]`, e));
  console.log('\n=== CONSOLE (last 10) ===');
  consoleMsgs.slice(-10).forEach(m => console.log(m));
  console.log('\n=== body innerHTML (first 800) ===');
  console.log(html);
  console.log('\n=== root innerHTML (first 800) ===');
  console.log(rootHtml);
  await browser.close();
})();
