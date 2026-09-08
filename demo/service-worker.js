const CACHE_NAME = 'kol-demo-v26';
const APP_SHELL = [
  '/demo/index.html',
  '/demo/css/customer-base.css',
  '/demo/css/customer.css',
  '/demo/js/allergen-ui.js',
  '/demo/js/customer.js',
  '/demo/js/install.js',
  '/demo/js/data.js',
  '/demo/manifest.webmanifest',
  '/demo/icons/kol-icon-192.png',
  '/demo/icons/kol-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/demo/index.html')))
  );
});
