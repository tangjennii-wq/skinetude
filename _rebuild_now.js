// One-shot rebuild — slices prefix at the <script data-compiled="jsx"> opener,
// compiles the sidecar with Babel, re-emits the script body, then closes tags.
const fs = require('fs');
const babel = require('@babel/core');

const ROOT = '/sessions/sweet-relaxed-edison/mnt/TangSkin';
const HTML = `${ROOT}/index.html`;
const SIDECAR = `${ROOT}/index.jsx.source`;

const lines = fs.readFileSync(HTML, 'utf8').split('\n');

// Find the line that opens the compiled-app script.
const openIdx = lines.findIndex(l => l.includes('<script data-compiled="jsx"'));
if (openIdx === -1) { console.error('Could not find <script data-compiled="jsx"> opener'); process.exit(1); }
console.log(`Found script opener at L${openIdx + 1}`);

const prefix = lines.slice(0, openIdx + 1).join('\n');
console.log(`Prefix kept: ${prefix.length.toLocaleString()} chars (${openIdx + 1} lines)`);

const jsxSource = fs.readFileSync(SIDECAR, 'utf8');
console.log(`Sidecar JSX: ${jsxSource.length.toLocaleString()} chars`);

const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled: ${compiled.code.length.toLocaleString()} chars`);

const out = prefix + '\n' + compiled.code + '\n</script>\n\n</body>\n</html>\n';
fs.writeFileSync(HTML, out);
console.log(`Wrote: ${HTML} (${fs.statSync(HTML).size.toLocaleString()} bytes)`);
