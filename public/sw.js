const SHELL_CACHE = 'herbiq-shell-v3';
const ASSET_CACHE = 'herbiq-assets-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Cache-first with background refresh for plant photos, 3D models, PDFs, and static assets
  const isPlantAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.includes('/storage/v1/object/public/herbiq-images/');

  if (isPlantAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) {
              cache.put(req, resp.clone());
            }
            return resp;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Network-first with cache fallback for app shell & JS/CSS bundles
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/index.html'))
        )
    );
  }
});
