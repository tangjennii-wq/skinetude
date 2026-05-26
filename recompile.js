// Precompiles index.jsx.source into a fresh single <script> inside index.html.
//
// IMPORTANT: this script does NOT regex-match against the existing inline JSX —
// the JSX contains string literals like 'type="text/babel"' that fool naive
// regex into matching mid-string. Instead we use UNIQUE marker comments to
// delimit the runtime block, which can never collide with JSX content.
//
// Markers:
//   <!--RUNTIME-START--> ...compiled <script>... <!--RUNTIME-END-->
// On first run: if no markers exist, we strip the legacy <script type="text/babel">
// block by finding it BEFORE </body> (last script in the file by structure)
// and injecting markers + compiled JS in its place.
const fs = require('fs');
const babel = require('@babel/core');

const HTML = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html';
const JSX_SIDECAR = '/sessions/optimistic-magical-davinci/mnt/TangSkin/index.jsx.source';
const START = '<!--RUNTIME-START-->';
const END = '<!--RUNTIME-END-->';

if (!fs.existsSync(JSX_SIDECAR)) {
  console.error(`Sidecar missing: ${JSX_SIDECAR}`);
  process.exit(1);
}
const jsxSource = fs.readFileSync(JSX_SIDECAR, 'utf8');
console.log(`Loaded sidecar: ${jsxSource.length.toLocaleString()} chars`);

const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled: ${compiled.code.length.toLocaleString()} chars`);

const block = `${START}\n<script data-compiled="jsx">\n${compiled.code}\n</script>\n${END}`;

// Read HTML. If markers exist, replace between them. If not, we need to find a
// safe boundary (just before </body>) and insert there.
let html = fs.readFileSync(HTML, 'utf8');

if (html.includes(START) && html.includes(END)) {
  // Replace existing block.
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END) + END.length;
  html = html.slice(0, startIdx) + block + html.slice(endIdx);
  console.log('Replaced existing runtime block.');
} else {
  // First run on a clean HTML — inject just before </body>.
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose === -1) {
    console.error('No </body> found.');
    process.exit(1);
  }
  html = html.slice(0, bodyClose) + block + '\n' + html.slice(bodyClose);
  console.log('Injected new runtime block before </body>.');
}

// Drop Babel CDN if present.
html = html.replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*\n?/, '');

fs.writeFileSync(HTML, html);
console.log(`Wrote: ${HTML} (${fs.statSync(HTML).size.toLocaleString()} bytes)`);
