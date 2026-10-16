const CACHE_NAME = 'kol-demo-v212-cleanall1';
const APP_SHELL = [
  '/demo/index.html',
  '/demo/css/customer-base.css',
  '/demo/css/customer.css',
  '/demo/css/cart.css',
  '/demo/css/theme.css',
  '/demo/css/shop-info.css',
  '/demo/css/customer-theme.css',
  '/demo/js/theme.js',
  '/demo/js/customer.js',
  '/demo/js/cart-order.js',
  '/demo/js/shop-info.js',
  '/demo/js/install.js',
  '/demo/js/data.js',
  '/demo/js/order-confirmation.js',
  '/demo/js/ingredient-detection.js',
  '/demo/js/palette.js',
  '/demo/js/order-comments.js',
  '/demo/js/loyalty.js',
  '/demo/manifest.webmanifest',
  '/demo/icons/restaurant.svg',
  '/demo/config.js',
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

// Only cache the app shell and the /demo/ home alias, not arbitrary API pages.
const CACHEABLE_PATHS = new Set([...APP_SHELL, '/demo/']);

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHEABLE_PATHS.has(url.pathname)) return;
  const key = new Request(url.origin + url.pathname);

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(key);
        if (cached) return cached;
        if (url.pathname === '/demo/' || url.pathname === '/demo/index.html') {
          return (await caches.match('/demo/index.html')) || Response.error();
        }
        return Response.error();
      })
  );
});
