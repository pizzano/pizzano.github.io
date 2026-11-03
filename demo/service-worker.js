/* Portable app shell: the directory containing this worker is the app root.
 * Works on /demo/, /, or any relocated restaurant directory/domain.
 */
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'bestill-app-shell-';
const CACHE_NAME = CACHE_PREFIX + encodeURIComponent(APP_BASE.pathname) + '-v291';
const FILES = [
  'index.html',
  'css/startup.css',
  'css/customer-base.css',
  'css/customer.css',
  'css/cart.css',
  'css/theme.css',
  'css/shop-info.css',
  'css/customer-theme.css',
  'css/product-detail-redesign.css',
  'css/ui-controls.css',
  'css/typography.css',
  'js/customer-startup.js',
  'js/theme.js',
  'js/customer.js',
  'js/display-format.js',
  'js/customer-menu-view.js',
  'js/product-images.js',
  'js/test-simulator.js',
  'js/test-lab.js',
  'js/admin-health-policy.js',
  'js/admin-health.js',
  'test-lab.html',
  'js/dialog-focus.js',
  'js/pickup-slots.js',
  'js/order-recovery.js',
  'js/pickup-capacity.js',
  'js/performance-metrics.js',
  'js/typography-settings.js',
  'js/special-days-customer.js',
  'js/special-days.js',
  'js/system-errors.js',
  'js/order-product-summary.js',
  'js/shop-info.js',
  'js/data.js',
  'js/data-normalization.js',
  'js/order-confirmation.js',
  'js/ingredient-detection.js',
  'js/palette.js',
  'js/loyalty.js',
  'manifest.webmanifest',
  'icons/restaurant.svg',
  'config.js',
];
const APP_SHELL = FILES.map(file => new URL(file, APP_BASE).pathname);
const INDEX_PATH = new URL('index.html', APP_BASE).pathname;
const CACHEABLE_PATHS = new Set([...APP_SHELL, APP_BASE.pathname]);

// Only the minimal startup shell is downloaded during installation.
// Remaining module/CSS requests are cached as the page loads, avoiding
// dozens of redundant downloads competing with the first menu load.
const PRELOAD = [
  'index.html',
  'css/startup.css',
  'js/customer-startup.js',
  'js/theme.js',
  'config.js',
].map(file => new URL(file, APP_BASE).pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(PRELOAD.map(path => new Request(path, { cache: 'reload' })))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME && (
        key.startsWith(CACHE_PREFIX + encodeURIComponent(APP_BASE.pathname) + '-') ||
        // Remove only legacy cache names for the original /demo/ installation.
        (APP_BASE.pathname === '/demo/' &&
          (key.startsWith('bestill-demo-') || key.startsWith('kol-demo-')))
      )).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Keep restaurant-specific documents, API calls and Firebase responses out of
// the application cache. The only document alias is this app's own home path.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHEABLE_PATHS.has(url.pathname)) return;
  const key = new Request(url.origin + url.pathname);
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await (await caches.open(CACHE_NAME)).match(key);
        if (cached) return cached;
        if (url.pathname === APP_BASE.pathname || url.pathname === INDEX_PATH) {
          return (await caches.match(new URL('index.html', APP_BASE).href)) ||
            (await caches.match(INDEX_PATH)) || Response.error();
        }
        return Response.error();
      })
  );
});
