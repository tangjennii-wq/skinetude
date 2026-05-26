// Rebuilds index.html cleanly from scratch:
//   - Takes the clean HTML PREFIX (head + body + loading screen + diagnostics
//     + pre-warm + #root) up through line 311 (the "API KEY MODAL" comment)
//   - Compiles the sidecar JSX with babel
//   - Appends a single <script data-compiled> with the compiled JS, wrapped in
//     RUNTIME marker comments (so future recompiles can find it)
//   - Closes with </body></html>
//
// The previous recompile attempt corrupted the file by regex-matching a
// 'type="text/babel"' STRING LITERAL inside the JSX prompt template — that
// chopped the file mid-string and produced 21MB of garbage. This rebuild
// throws away everything past line 311 and trusts the sidecar.
const fs = require('fs');
const babel = require('@babel/core');

const HTML = '/sessions/sweet-relaxed-edison/mnt/TangSkin/index.html';
const SIDECAR = '/sessions/sweet-relaxed-edison/mnt/TangSkin/index.jsx.source';

// 1. Read current (corrupted) HTML and slice off the clean prefix.
const fullHtml = fs.readFileSync(HTML, 'utf8');
const lines = fullHtml.split('\n');
// The prefix ends right after the "<!-- API KEY MODAL — handled in React -->"
// line at line 310. Look for that marker explicitly so this is robust if line
// numbers ever shift.
const marker = '<!-- API KEY MODAL — handled in React -->';
const markerIdx = lines.findIndex(l => l.includes(marker));
if (markerIdx === -1) { console.error('Anchor not found.'); process.exit(1); }
const prefixLines = lines.slice(0, markerIdx + 1);
const prefix = prefixLines.join('\n');
console.log(`Prefix kept: ${prefix.length.toLocaleString()} chars (${prefixLines.length} lines)`);

// 2. Compile JSX from sidecar.
const jsxSource = fs.readFileSync(SIDECAR, 'utf8');
console.log(`Sidecar JSX: ${jsxSource.length.toLocaleString()} chars`);
const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled: ${compiled.code.length.toLocaleString()} chars`);

// 3. Build the runtime block. The marker comments (<!--RUNTIME-START--> etc.)
// are HTML comments; they cannot collide with JSX content because JSX is now
// inside a <script> body, not parsed as HTML.
const runtimeBlock = [
  '',
  '<!--RUNTIME-START-->',
  '<script data-compiled="jsx">',
  '/* Compiled from index.jsx.source by rebuild.js — edit the sidecar then run rebuild.js. */',
  compiled.code,
  '</script>',
  '<!--RUNTIME-END-->',
  '',
].join('\n');

// 4. Final HTML.
let html = prefix + '\n' + runtimeBlock + '\n</body>\n</html>\n';

// Drop Babel CDN — runtime no longer needs it.
html = html.replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*\n?/, '');

fs.writeFileSync(HTML, html);
console.log(`Wrote: ${HTML} (${fs.statSync(HTML).size.toLocaleString()} bytes)`);
