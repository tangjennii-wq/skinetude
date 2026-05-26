// Render the App in jsdom — print any error
const fs = require('fs');
const { JSDOM } = require('jsdom');

const HTML_PATH = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html';
const html = fs.readFileSync(HTML_PATH, 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'https://example.com',
});

const errs = [];
dom.window.addEventListener('error', e => errs.push('ERR: ' + (e.error?.message || e.message) + '\n' + (e.error?.stack || '').slice(0, 500)));
dom.window.console.error = (...args) => errs.push('CON-ERR: ' + args.map(a => String(a).slice(0, 400)).join(' '));

setTimeout(() => {
  console.log('=== ERRORS ===');
  errs.slice(0, 5).forEach((e, i) => console.log(`[${i}]`, e));
  console.log('\n=== body innerHTML preview ===');
  console.log(dom.window.document.body.innerHTML.slice(0, 600));
  console.log('\n=== root innerHTML preview ===');
  const root = dom.window.document.getElementById('root');
  console.log(root?.innerHTML?.slice(0, 600) || 'no #root');
  process.exit(0);
}, 5000);
