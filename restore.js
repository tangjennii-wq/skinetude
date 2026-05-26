// Restores the inline-JSX + Babel-in-browser approach that was working
// before the precompile experiment. We do this because:
// (a) The compiled JS executes cleanly in headless tests, but the user
//     reports it isn't loading on multiple targets — meaning something in
//     the browser (cache, CSP, missing global) is breaking that I can't
//     reproduce from the sandbox.
// (b) The original setup was slow on mobile (~10–15s Babel compile) but
//     it WORKED. Reliability beats speed.
//
// Steps:
//   1. Take the clean HTML prefix (lines 1..API-KEY-MODAL comment) + ensure
//      the Babel CDN script is back in the <head>.
//   2. Drop in <script type="text/babel" data-presets="react">JSX</script>
//      using the sidecar JSX as the body.
//   3. Close </body></html>.
const fs = require('fs');
const HTML = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html';
const SIDECAR = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.jsx.source';

let html = fs.readFileSync(HTML, 'utf8');
const lines = html.split('\n');
const markerIdx = lines.findIndex(l => l.includes('<!-- API KEY MODAL'));
if (markerIdx === -1) { console.error('Anchor not found'); process.exit(1); }
let prefix = lines.slice(0, markerIdx + 1).join('\n');

// Re-insert Babel CDN script if it was removed during the precompile experiment.
if (!prefix.includes('@babel/standalone/babel.min.js')) {
  prefix = prefix.replace(
    /<script src="https:\/\/unpkg\.com\/lucide@latest[^>]+><\/script>/,
    match => match + '\n<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>'
  );
  console.log('Re-inserted Babel CDN.');
}

const jsxSource = fs.readFileSync(SIDECAR, 'utf8');
console.log(`Sidecar: ${jsxSource.length.toLocaleString()} chars`);

const runtimeBlock = [
  '',
  '<script type="text/babel" data-presets="react">',
  jsxSource,
  '</script>',
  '',
].join('\n');

const finalHtml = prefix + '\n' + runtimeBlock + '\n</body>\n</html>\n';
fs.writeFileSync(HTML, finalHtml);
console.log(`Wrote: ${HTML} (${fs.statSync(HTML).size.toLocaleString()} bytes)`);
