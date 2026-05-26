// Builds index.fast.html — a precompiled version of the app for fast mobile
// loads. Same content as index.html but with the JSX block already compiled
// to JS (no Babel needed at runtime). The original index.html is left
// untouched as the always-working fallback.
//
// To regenerate after editing the JSX in index.jsx.source: node buildfast.js
const fs = require('fs');
const babel = require('@babel/core');

const HTML = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html';
const SIDECAR = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.jsx.source';
const OUT = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.fast.html';

let html = fs.readFileSync(HTML, 'utf8');
const lines = html.split('\n');
const markerIdx = lines.findIndex(l => l.includes('<!-- API KEY MODAL'));
if (markerIdx === -1) { console.error('Anchor not found'); process.exit(1); }
let prefix = lines.slice(0, markerIdx + 1).join('\n');

// Remove all Babel-related <script> tags from prefix (cdnjs, jsdelivr, unpkg).
prefix = prefix.replace(/^.*babel-standalone.*\n/gmi, '');
prefix = prefix.replace(/^.*@babel\/standalone.*\n/gmi, '');

// Patch the loading-screen diagnostic so it doesn't check for Babel anymore.
prefix = prefix.replace(
  /if\s*\(typeof Babel === 'undefined'\)\s*setStatus\([^)]+\);\s*else\s*if/,
  "if (typeof React === 'undefined') setStatus('Waiting for React CDN…'); else if (false)"
);
prefix = prefix.replace(
  /if\s*\(typeof Babel === 'undefined'\)\s*showError\([^;]+\);\s*else\s*if/,
  "if (false) showError('','');\n      else if"
);
// Drop the fallback loader block's Babel entry too — it's harmless but clean.

// Compile sidecar.
const jsxSource = fs.readFileSync(SIDECAR, 'utf8');
const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled ${jsxSource.length.toLocaleString()} → ${compiled.code.length.toLocaleString()} chars`);

const runtimeBlock = [
  '',
  '<script>',
  '/* Compiled from index.jsx.source by buildfast.js. To regen: node buildfast.js */',
  compiled.code,
  '</script>',
  '',
].join('\n');

fs.writeFileSync(OUT, prefix + '\n' + runtimeBlock + '\n</body>\n</html>\n');
console.log(`Wrote: ${OUT} (${fs.statSync(OUT).size.toLocaleString()} bytes)`);
