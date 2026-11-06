/* Responsive menu image optimizations; no live Firebase, image downloads or uploads. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productImageSources } from '../js/product-images.js';
import { renderProductCard } from '../js/customer-menu-view.js';

const unsplash = 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?ixid=example&w=1800&q=95';

test('Unsplash menu thumbnails use compact sources with responsive 1x, 2x, 3x widths', () => {
  const image = productImageSources(unsplash, 'menu');
  assert.equal(new URL(image.src).searchParams.get('w'), '216');
  assert.equal(new URL(image.src).searchParams.get('h'), '216');
  assert.equal(new URL(image.src).searchParams.get('q'), '72');
  assert.equal(new URL(image.src).searchParams.get('auto'), 'format');
  assert.equal(new URL(image.src).searchParams.get('ixid'), 'example');
  assert.deepEqual([...image.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(m => Number(m[1])), [108,216,324]);
  assert.equal(image.sizes, '(max-width: 360px) 84px, (max-width: 400px) 84px, 108px');
});

test('hero photo requests larger images only when the dialog is opened', () => {
  const image = productImageSources(unsplash, 'hero');
  assert.equal(new URL(image.src).searchParams.get('w'), '800');
  assert.deepEqual([...image.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(m => Number(m[1])), [480,800,1200]);
  assert.equal(image.sizes, '(max-width: 520px) 100vw, 520px');
});

test('admin and category previews get compact independent resolutions', () => {
  const admin = productImageSources(unsplash, 'admin');
  const category = productImageSources(unsplash, 'category');
  assert.deepEqual([...admin.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(m => Number(m[1])), [56,112,168]);
  assert.deepEqual([...category.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(m => Number(m[1])), [80,160,240]);
});

test('other hosts, relative files, data images and untrusted URL forms remain exactly unchanged', () => {
  const urls = [
    '/demo/images/pizza.webp',
    'https://firebasestorage.googleapis.com/v0/b/example/o/pizza.jpg?token=abc&w=300',
    'https://example.com/pizza.png?w=200',
    'data:image/webp;base64,AAAA',
    'https://images.unsplash.com.evil.test/photo-999',
    'http://images.unsplash.com/photo-1234',
    'https://images.unsplash.com.evil.test/photo-1234',
    'not a URL',
  ];
  for (const url of urls) {
    assert.deepEqual(productImageSources(url), {src:url,srcset:'',sizes:''});
  }
});

test('unsupported image URLs remain untouched in rendered menu markup', () => {
  const item = {id:'p1',name:'Pizza & ost',imageUrl:'https://example.com/a.jpg?x=1&y=2',sizes:[]};
  const markup = renderProductCard(item, {title:'Pizza'}, {
    getItemBasePrice:()=>210,
    getItemOptionGroups:()=>[],
    getItemIngredientRules:()=>[],
    allergenLabels:()=>[],
    formatPrice:n=>n+' kr',
    productCartBadgeHtml:()=>'',
    ingredientCustomizationEnabled:true,
    showAllergens:false,
  });
  assert.match(markup, /src="https:\/\/example\.com\/a\.jpg\?x=1&amp;y=2"/);
  assert.doesNotMatch(markup, /srcset=/);
  assert.match(markup, /loading="lazy" decoding="async" width="108" height="108" fetchpriority="low"/);
});

test('Unsplash image URLs are HTML-escaped and have responsive source candidates', () => {
  const item = {id:'p1',name:'Pizza',imageUrl:unsplash,sizes:[]};
  const markup = renderProductCard(item, {title:'Pizza'}, {
    getItemBasePrice:()=>210,
    getItemOptionGroups:()=>[],
    getItemIngredientRules:()=>[],
    allergenLabels:()=>[],
    formatPrice:n=>n+' kr',
    productCartBadgeHtml:()=>'',
    ingredientCustomizationEnabled:true,
    showAllergens:false,
  });
  assert.match(markup, /srcset="/);
  assert.match(markup, /sizes="\(max-width: 360px\) 84px, \(max-width: 400px\) 84px, 108px"/);
  assert.match(markup, /&amp;q=72/);
});

test('product hero and admin use image helper without changing the order or printer logic', async () => {
  const [customer, admin] = await Promise.all(
    ['customer.js', 'admin.js'].map(name =>
      readFile(new URL('../js/' + name, import.meta.url), 'utf8')));
  assert.match(customer, /renderProductHeroImage\(heroHeader, item\.imageUrl\)/);
  assert.match(customer, /productImageSources\(imageUrl,'hero'\)/);
  assert.match(customer, /previous\?\.remove\(\)/);
  assert.match(customer, /photo\.style\.visibility='hidden'/);
  assert.match(customer, /photo\.fetchPriority='high'/);
  assert.match(admin, /adminImageAttributes\(item\.imageUrl, 'admin'\)/);
  assert.match(admin, /adminImageAttributes\(categoryImage, 'category'\)/);
  assert.match(admin, /await printKitchenTicket\(order,/);
});


test('service worker cache-first loads each customer menu photo once and refreshes changed URLs', async () => {
  const {runInNewContext} = await import('node:vm');
  const code = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const events = {};
  const stores = new Map();
  let downloads = 0;
  const makeCache = () => {
    const map = new Map();
    return {
      async match(req) { return map.get(typeof req === 'string' ? req : req.url)?.clone(); },
      async put(req, res) { map.set(typeof req === 'string' ? req : req.url, res.clone()); },
      async keys() { return [...map.keys()].map(url => new Request(url)); },
      async delete(req) { return map.delete(typeof req === 'string' ? req : req.url); }
    };
  };
  const customerUrl = 'https://bestill.online/demo/index.html';
  const context = {
    URL, Request, Response, console,
    self: {
      location: { href:'https://bestill.online/demo/service-worker.js',
                  origin:'https://bestill.online' },
      clients: { async get(id) {
        return id === 'admin' ? {url:'https://bestill.online/demo/admin.html'}
          : {url:customerUrl};
      }},
      addEventListener(type, callback) { events[type] = callback; },
      skipWaiting() {},
      clientsClaimCalled:false
    },
    caches: {
      async open(name) { if (!stores.has(name)) stores.set(name, makeCache()); return stores.get(name); },
      async keys() { return [...stores.keys()]; },
      async match(req) { for (const cache of stores.values()) {
        const item = await cache.match(req); if (item) return item;
      } return undefined; },
      async delete(name) { return stores.delete(name); }
    },
    fetch: async request => {
      downloads++;
      return new Response('image-' + downloads, {
        headers: {'Content-Type':'image/jpeg'}
      });
    }
  };
  runInNewContext(code, context, {timeout:2000});
  async function message(version, urls) {
    const pending = [];
    events.message({
      source: {url:customerUrl},
      data: {type:'KOL_CUSTOMER_IMAGES_V1',version,urls},
      waitUntil(promise) {pending.push(promise);}
    });
    await Promise.all(pending);
  }
  async function image(url, clientId='customer') {
    const req = new Request(url);
    Object.defineProperty(req, 'destination', {value:'image'});
    const pending = [];
    let promise;
    events.fetch({
      request:req,clientId,
      respondWith(value) {promise=value;},
      waitUntil(value) {pending.push(value);}
    });
    assert.ok(promise, 'photo request handled by worker');
    const response = await promise;
    await Promise.all(pending);
    return response.text();
  }
  const first = 'https://images.unsplash.com/photo-one?ixid=test&w=216&h=216&q=72&auto=format&fit=crop';
  const hero = 'https://images.unsplash.com/photo-one?ixid=test&w=800&h=480&q=78&auto=format&fit=crop';
  const second = 'https://images.unsplash.com/photo-two?ixid=test&w=216&h=216&q=72&auto=format&fit=crop';
  const baseFirst = 'https://images.unsplash.com/photo-one?ixid=test';
  const baseSecond = 'https://images.unsplash.com/photo-two?ixid=test';
  await message(100, [baseFirst]);
  assert.equal(await image(first), 'image-1');
  assert.equal(await image(first), 'image-1');
  assert.equal(downloads,1,'repeated menu visit never downloads the same picture again');
  assert.equal(await image(hero),'image-2','large sheet image is cached separately when opened');
  assert.equal(await image(hero),'image-2');
  await message(101, [baseFirst]); // Price-only edit must retain photos.
  assert.equal(await image(first),'image-1');
  await message(102, [baseSecond]); // Replaced photo removes old cache entries.
  assert.equal(await image(second),'image-3');
  assert.equal(await image(second),'image-3');
  assert.equal(await image(first),'image-4','photo removed from menu is not served from old cache');
  await message(100, [baseFirst]); // Old offline tab cannot overwrite.
  assert.equal(await image(second),'image-3');
  assert.equal(await image(second, 'admin'),'image-5','admin photo requests are unmodified');
  assert.equal(downloads,5);
});

test('photo cache does not intercept Firebase JSON or order requests', async () => {
  const worker = await readFile(new URL('../service-worker.js', import.meta.url),'utf8');
  const customer = await readFile(new URL('../js/customer.js', import.meta.url),'utf8');
  assert.match(worker, /request\.destination === 'image'/);
  assert.match(worker, /customerPageUrl\(client\?\.url\)/);
  assert.match(worker, /MAX_CACHED_IMAGES = 120/);
  assert.match(worker, /event\.waitUntil\(updatePublicImageManifest/);
  assert.match(customer, /sharePublicMenuImagesWithWorker\(\)/);
  assert.match(customer, /lastPublicImageManifestVersion/);
  assert.doesNotMatch(customer.slice(customer.indexOf('function sharePublicMenuImagesWithWorker()'),
    customer.indexOf('document.addEventListener(\'error\'', customer.indexOf('function sharePublicMenuImagesWithWorker()'))),
    /profile\.phone|profile\.name|orders\/|customers\//);
});
