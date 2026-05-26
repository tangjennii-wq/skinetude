// Builds a fully self-contained index.html. ZERO external script dependencies
// (Tailwind stays — it's a runtime CSS-in-JS so still loaded from cdn.tailwindcss.com).
// React, ReactDOM, Lucide, Supabase are read from node_modules and inlined as
// <script> blocks. Means the file works in any sandbox that blocks external
// scripts — including Cowork preview, file://, etc.
const fs = require('fs');
const babel = require('@babel/core');

const ROOT = '/sessions/optimistic-magical-davinci/mnt/TangSkin';
const SIDECAR = `${ROOT}/index.jsx.source`;
const OUT = `${ROOT}/index.html`;

// 1. Compile JSX
const jsxSource = fs.readFileSync(SIDECAR, 'utf8');
const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled: ${compiled.code.length.toLocaleString()} chars`);

// 2. Read all library bundles
const reactJs = fs.readFileSync(`${ROOT}/node_modules/react/umd/react.production.min.js`, 'utf8');
const reactDomJs = fs.readFileSync(`${ROOT}/node_modules/react-dom/umd/react-dom.production.min.js`, 'utf8');
const lucideJs = fs.readFileSync(`${ROOT}/node_modules/lucide/dist/umd/lucide.min.js`, 'utf8');
const supabaseJs = fs.readFileSync(`${ROOT}/node_modules/@supabase/supabase-js/dist/umd/supabase.js`, 'utf8');
console.log(`React: ${(reactJs.length/1024).toFixed(0)}KB · ReactDOM: ${(reactDomJs.length/1024).toFixed(0)}KB · Lucide: ${(lucideJs.length/1024).toFixed(0)}KB · Supabase: ${(supabaseJs.length/1024).toFixed(0)}KB`);

// 3. Reuse existing styles
const oldHtml = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const styleMatch = oldHtml.match(/<style>[\s\S]*?<\/style>/);
const styleBlock = styleMatch ? styleMatch[0] : '<style>:root{--cream:#fafaf6;--cream-deep:#f2efe8;--ink:#2a2520;--ink-soft:#786a5e;--line:#e6dfd0;--sage:#8a9b7e;--rose:#c9a094;--accent:#c25e3c}body{background:var(--cream);margin:0}</style>';

// 4. Wrap the compiled app code with the same boot diagnostics
const instrumentedCode = `
try {
  (function(s){var el=document.getElementById('loading-status'); if(el) el.textContent=s;})('Starting app…');
  ${compiled.code}
  setTimeout(function(){
    var root = document.getElementById('root');
    if (root && root.innerHTML.length > 0) {
      var ls = document.getElementById('loading-screen');
      if (ls) ls.style.display = 'none';
    }
  }, 800);
} catch(_err) {
  var box = document.getElementById('loading-error');
  if (box) {
    box.style.display = 'block';
    box.textContent = (_err && _err.message ? _err.message : String(_err)) + '\\n\\n' + ((_err && _err.stack) ? String(_err.stack).split('\\n').slice(0,6).join('\\n') : '');
  }
  var st = document.getElementById('loading-status');
  if (st) st.textContent = 'BOOT FAILED — see error below';
  console.error('[boot]', _err);
}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Étude — A Study in Your Skin</title>
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#fafaf6" />

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">

<!-- Tailwind is the only external script. Loads CSS classes at runtime.
     Everything else (React, ReactDOM, Lucide, Supabase) is inlined below. -->
<script src="https://cdn.tailwindcss.com"></script>

${styleBlock}
</head>
<body>

<div id="loading-screen" style="position:fixed;inset:0;background:var(--cream);display:flex;align-items:center;justify-content:center;z-index:100;">
  <div style="text-align:center;max-width:340px;padding:20px;">
    <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:32px;color:var(--ink);">Étude</div>
    <div id="loading-status" style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px;">Loading…</div>
    <div id="loading-error" style="display:none;margin-top:14px;font-family:ui-monospace,monospace;font-size:11px;line-height:1.4;color:#a04555;background:#fdf6f0;border:1px solid #e9c8b8;border-radius:10px;padding:10px 12px;text-align:left;word-break:break-word;white-space:pre-wrap;"></div>
  </div>
</div>

<script>
window.addEventListener('error', function(e){
  var box = document.getElementById('loading-error');
  if (!box) return;
  box.style.display = 'block';
  box.textContent = 'window.onerror: ' + (e.message||'?') + (e.filename?' · '+e.filename.split('/').pop():'') + (e.lineno?':'+e.lineno:'');
});
</script>

<div id="root"></div>

<!-- ===== INLINED LIBRARIES ===== -->
<script>
${reactJs}
</script>
<script>
${reactDomJs}
</script>
<script>
${lucideJs}
</script>
<script>
${supabaseJs}
</script>

<!-- ===== APP ===== -->
<script>
${instrumentedCode}
</script>

</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`Wrote: ${OUT} (${(fs.statSync(OUT).size/1024).toFixed(0)}KB)`);
