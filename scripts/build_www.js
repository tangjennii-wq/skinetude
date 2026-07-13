#!/usr/bin/env node
// === build_www.js — stage the Capacitor web bundle (July 2026) ===
// Runs the normal single-file build, then copies the deployable set into
// www/ (Capacitor's webDir). Keep www/ out of git — it's a build product.
//
// Usage: node scripts/build_www.js   (or: npm run cap:build)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

execSync('node build_current.js', { cwd: ROOT, stdio: 'inherit' });

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(path.join(WWW, 'icons'), { recursive: true });

const copies = [
  ['index.html', 'index.html'],
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['sw.js', 'sw.js'],
  ['icons/icon-192.png', 'icons/icon-192.png'],
  ['icons/icon-512.png', 'icons/icon-512.png'],
  ['icons/icon-1024.png', 'icons/icon-1024.png'],
  ['icons/apple-touch-icon.png', 'icons/apple-touch-icon.png'],
];
for (const [src, dst] of copies) {
  fs.copyFileSync(path.join(ROOT, src), path.join(WWW, dst));
  console.log('www/ ←', src);
}
console.log('\nStaged. Next: npx cap sync ios');
