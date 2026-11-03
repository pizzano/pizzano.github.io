/* Responsive menu image optimizations; no live Firebase, image downloads or uploads. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productImageSources } from '../js/product-images.js';
import { renderProductCard } from '../js/customer-menu-view.js';

const unsplash = 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?ixid=example&w=1800&q=95';

test('Unsplash menu thumbnails use compact sources with responsive 1x, 2x, 3x widths', () => {
  const image = productImageSources(unsplash, 'menu');
  assert.equal(new URL(image.src).searchParams.get('w'), '160');
  assert.equal(new URL(image.src).searchParams.get('h'), '160');
  assert.equal(new URL(image.src).searchParams.get('q'), '72');
  assert.equal(new URL(image.src).searchParams.get('auto'), 'format');
  assert.equal(new URL(image.src).searchParams.get('ixid'), 'example');
  assert.deepEqual([...image.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(m => Number(m[1])), [80,160,240]);
  assert.equal(image.sizes, '(max-width: 400px) 72px, 76px');
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
  assert.match(markup, /loading="lazy" decoding="async" width="76" height="76" fetchpriority="low"/);
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
  assert.match(markup, /sizes="\(max-width: 400px\) 72px, 76px"/);
  assert.match(markup, /&amp;q=72/);
});

test('product hero and admin use image helper without changing the order or printer logic', async () => {
  const [customer, admin] = await Promise.all(
    ['customer.js', 'admin.js'].map(name =>
      readFile(new URL('../js/' + name, import.meta.url), 'utf8')));
  assert.match(customer, /productImageSources\(item\.imageUrl, 'hero'\)/);
  assert.match(customer, /photo\.removeAttribute\('srcset'\)/);
  assert.match(customer, /photo\.fetchPriority='high'/);
  assert.match(admin, /adminImageAttributes\(item\.imageUrl, 'admin'\)/);
  assert.match(admin, /adminImageAttributes\(categoryImage, 'category'\)/);
  assert.match(admin, /await printKitchenTicket\(order,/);
});
