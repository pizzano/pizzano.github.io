/* Portable app shell: the directory containing this worker is the app root.
 * Works on /demo/, /, or any relocated restaurant directory/domain.
 */
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'bestill-app-shell-';
const CACHE_NAME = CACHE_PREFIX + encodeURIComponent(APP_BASE.pathname) + '-v304';
const FILES = [
  'index.html',
  'css/startup.css',
  'css/customer.css',
  'css/cart.css',
  'css/theme.css',
  'css/shop-info.css',
  'css/customer-theme.css',
  'css/product-detail-redesign.css',
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


// Image files are fetched from the URLs in the Firebase menu, often external
// CDNs rather than Firebase RTDB. Only public customer-menu images are cached.
// The cache survives normal app-shell deployments; no orders or customer data.
const IMAGE_CACHE_NAME = 'bestill-public-images-' + encodeURIComponent(APP_BASE.pathname) + '-v1';
const IMAGE_META_URL = new URL('__kol_public_image_manifest_v1__', APP_BASE).href;
const MAX_CACHED_IMAGES = 120;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
let imageManifestPromise = null;

function customerPageUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_BASE.origin &&
      (url.pathname === APP_BASE.pathname || url.pathname === INDEX_PATH);
  } catch { return false; }
}

function publicImageIdentity(value) {
  try {
    const url = new URL(value, APP_BASE);
    if (url.username || url.password ||
        (url.protocol !== 'https:' && url.origin !== APP_BASE.origin)) return '';
    // Unsplash's responsive srcset variants differ only by resize parameters.
    // Keep any other query parameters as part of the image identity.
    if (url.hostname === 'images.unsplash.com' &&
        /^\/photo-[\w-]+$/.test(url.pathname)) {
      for (const key of ['w','h','q','auto','fit']) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

async function publicImageManifest() {
  if (!imageManifestPromise) {
    imageManifestPromise = caches.open(IMAGE_CACHE_NAME).then(async cache => {
      const response = await cache.match(IMAGE_META_URL);
      if (!response) return null;
      const value = await response.json();
      return value && Array.isArray(value.urls) ? value : null;
    }).catch(() => null);
  }
  return imageManifestPromise;
}

async function updatePublicImageManifest(data) {
  const version = Number(data.version);
  if (!Number.isSafeInteger(version) || version <= 0 ||
      !Array.isArray(data.urls)) return;
  const previous = await publicImageManifest();
  // An older tab or a stale offline menu must never replace newer image data.
  if (previous && version < Number(previous.version)) return;
  const urls = [...new Set(data.urls.slice(0, 500)
    .map(publicImageIdentity).filter(Boolean))].slice(0, 400);
  if (previous && previous.version === version &&
      JSON.stringify(previous.urls) === JSON.stringify(urls)) return;
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const next = { version, urls };
  await cache.put(IMAGE_META_URL, new Response(JSON.stringify(next), {
    headers: { 'Content-Type': 'application/json' }
  }));
  imageManifestPromise = Promise.resolve(next);
  // Keep old image copies when unrelated prices/settings change. Evict only
  // images whose URL was removed/replaced in the new menu.
  const allowed = new Set(urls);
  for (const request of await cache.keys()) {
    if (request.url !== IMAGE_META_URL &&
        !allowed.has(publicImageIdentity(request.url))) {
      await cache.delete(request);
    }
  }
}

self.addEventListener('message', event => {
  if (!customerPageUrl(event.source?.url)) return;
  const data = event.data || {};
  if (data.type === 'KOL_CUSTOMER_IMAGES_V1') {
    event.waitUntil(updatePublicImageManifest(data).catch(() => {}));
  } else if (data.type === 'KOL_CUSTOMER_IMAGE_FAILED_V1') {
    // Opaque cross-origin responses hide status codes; remove an image that
    // actually fails decoding so a broken response cannot poison the cache.
    event.waitUntil((async () => {
      const current = await publicImageManifest();
      const identity = publicImageIdentity(data.url);
      if (!identity || !current?.urls?.includes(identity)) return;
      await (await caches.open(IMAGE_CACHE_NAME)).delete(data.url);
    })().catch(() => {}));
  }
});

async function servePublicCustomerImage(event) {
  const request = event.request;
  const client = event.clientId
    ? await self.clients.get(event.clientId).catch(() => null) : null;
  if (!customerPageUrl(client?.url)) return fetch(request);
  const manifest = await publicImageManifest();
  const identity = publicImageIdentity(request.url);
  if (!identity || !manifest?.urls?.includes(identity)) return fetch(request);
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const saved = await cache.match(request);
  if (saved) return saved;
  const result = await fetch(request);
  // An opaque response is normal for <img> without crossorigin. It may be
  // cached, but decoding failures are removed by the customer-side error event.
  const size = Number(result.headers?.get('Content-Length')) || 0;
  if ((result.ok || result.type === 'opaque') && size <= MAX_IMAGE_BYTES) {
    const save = (async () => {
      try {
        await cache.put(request, result.clone());
        const keys = (await cache.keys()).filter(key => key.url !== IMAGE_META_URL);
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_IMAGES))) {
          await cache.delete(old);
        }
      } catch { /* private mode / quota / provider restrictions are non-fatal */ }
    })();
    event.waitUntil(save);
  }
  return result;
}

// Keep restaurant-specific documents, API calls and Firebase responses out of
// the application cache. The only document alias is this app's own home path.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // This route applies only to image files on the customer page. Firebase
  // JSON, credentials, checkout and all admin requests are never cached here.
  if (request.destination === 'image' && url.protocol === 'https:') {
    event.respondWith(servePublicCustomerImage(event));
    return;
  }
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
