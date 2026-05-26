// Try to actually instantiate the App component server-side to find errors
const fs = require('fs');
const babel = require('@babel/core');

const html = fs.readFileSync('/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html', 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
const code = m[1];

const transformed = babel.transformSync(code, {
  presets: ['@babel/preset-react'],
  filename: 'index.jsx',
}).code;

// Save the transformed JS for inspection
fs.writeFileSync('/sessions/optimistic-magical-davinci/mnt/TangSkin/transformed.js', transformed);
console.log('saved transformed JS, length:', transformed.length);

// Now try to find runtime errors by syntax checking
try {
  // Use new Function — strict mode
  const fn = new Function('React', 'ReactDOM', 'window', 'document', 'console', '"use strict"; ' + transformed);
  console.log('strict-mode parse OK');
} catch (e) {
  console.log('strict-mode parse error:', e.message);
}
