// Jalan service worker: app shell cached on install, assets cached on first use.
// Bump VERSION to force clients onto a new build.
const VERSION = 'jalan-v7';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './guide.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await cache.addAll(SHELL);
      // Pre-cache the hashed JS/CSS referenced by index.html so the first offline launch works.
      try {
        const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
        const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll(assets);
      } catch { /* cached on first use instead */ }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // exchange-rate API etc. go straight to network

  if (req.mode === 'navigate') {
    // Network first for the page so updates arrive; fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')).then((r) => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
    )
  );
});
