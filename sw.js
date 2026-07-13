// === Frida service worker (July 2026 — PWA layer) ===
// Strategy: NETWORK-FIRST for the app shell (index.html), falling back to
// cache when offline. The whole app is one generated file that changes on
// every deploy — cache-first would serve stale builds, which is the exact
// failure mode this repo's build step exists to prevent. Icons/manifest
// are cache-first (they rarely change).
//
// User data is untouched: it lives in IndexedDB/localStorage/Supabase,
// not in this cache.

const CACHE = 'frida-shell-v1';
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GETs. API calls (Supabase, Anthropic, OpenAI,
  // Google) pass straight through — never cache those.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isShell) {
    // Network-first: fresh build when online, cached shell when offline.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  // Static assets: cache-first.
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
