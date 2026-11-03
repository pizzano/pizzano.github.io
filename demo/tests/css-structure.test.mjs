import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = name => readFile(new URL(name,root),'utf8');
const links = markup => [...markup.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/css\/([^"'?]+\.css)(?:\?[^"']*)?["']/gi)]
  .map(m=>m[1]);

test('every linked customer and admin stylesheet exists; no duplicate links', async()=>{
  for(const name of ['index.html','admin.html']) {
    const used=links(await text(name));
    assert.ok(used.length>=8,name+' stylesheet list unexpectedly short');
    assert.equal(new Set(used).size,used.length,name+' duplicate CSS links');
    for(const path of used) await access(new URL('css/'+path,root));
  }
});

test('adjacent admin category and choices CSS live in one original-order stylesheet',async()=>{
  const html=await text('admin.html');
  const css=await text('css/admin-dashboard.css');
  assert.doesNotMatch(html,/admin-choices\.css/);
  assert.match(css,/KØL premium admin dashboard/);
  assert.match(css,/Choices & addons/);
  assert.ok(css.indexOf('KØL premium admin dashboard')<css.indexOf('Choices & addons'));
});

test('group option editor and product editor styles are co-located',async()=>{
  const html=await text('admin.html');
  const css=await text('css/admin-settings.css');
  assert.doesNotMatch(html,/group-editor-modal\.css|admin-product-modal\.css/);
  assert.match(css,/\.product-editor-backdrop/);
  assert.match(css,/#modalEditor\.modal-editor/);
  assert.ok(css.indexOf('.product-editor-backdrop')<css.indexOf('#modalEditor.modal-editor'));
});

test('shared contact/profile declarations preserve both selectors and mobile overrides',async()=>{
  const css=await text('css/customer.css');
  for(const part of ['.contact-form-label','.contact-form-icon',
    '.contact-form-control .input','.contact-email-help']) {
    const checkout='#viewCheckout .checkout-contact-card '+part;
    const profile='#viewProfile .profile-contact-card '+part;
    assert.ok(css.includes(checkout+',\n'+profile),part+' lost shared declaration');
  }
  assert.match(css,/@media\s*\(max-width:\s*370px\)/);
  assert.match(css,/#viewProfile \.profile-contact-card \.err/);
});

test('original product sheet design and its responsive modes remain loaded',async()=>{
  const html=await text('index.html');
  const css=await text('css/product-detail-redesign.css');
  const items=links(html);
  assert.ok(items.indexOf('product-detail-redesign.css')>items.indexOf('order-status-cards.css'));
  assert.ok(!items.includes('ui-controls.css'));
  assert.ok(css.indexOf('Shared customer control measurements') < css.indexOf('PRODUCT DETAIL'));
  for(const selector of ['#productSheet .sheet-body','#productSheet .sheet-scroll',
    '#productSheet .sheet-foot-row','#productSheet #btnAddToCart']) {
    assert.ok(css.includes(selector),selector+' disappeared');
  }
  assert.match(css,/@media\s*\(max-width:\s*360px\)/);
});


test('customer base and main styles are co-located without changing their order', async()=> {
  const html = await text('index.html');
  const css = await text('css/customer.css');
  assert.ok(!html.includes('customer-base.css'), 'retired customer base stylesheet is still linked');
  assert.match(css,/Restaurant — kundeside/);
  assert.match(css,/Restaurant customer interface — shared mobile layout/);
  assert.ok(css.indexOf('Restaurant — kundeside') < css.indexOf('Restaurant customer interface'));
  for (const selector of [':root','[hidden]', '.app-header', '.allergen-visibility-control']) {
    assert.ok(css.includes(selector), selector + ' missing in merged customer style');
  }
});

test('merged admin product editor retains both settings and modal layers', async()=> {
  const html = await text('admin.html');
  const css = await text('css/admin-settings.css');
  assert.ok(!html.includes('admin-product-modal.css'), 'retired admin editor stylesheet is still linked');
  assert.match(css,/Restaurantinnstillinger — dedicated Soft UI layer/);
  assert.ok(css.includes('.product-editor-backdrop'), 'product editor backdrop lost');
  assert.ok(css.includes('#modalEditor.modal-editor'), 'modal editor selector lost');
  assert.ok(css.indexOf('Restaurantinnstillinger') < css.indexOf('.product-editor-backdrop'));
});

test('menu product row is rebuilt in place for all four palette modes', async () => {
  const css=await text('css/customer.css');
  const theme=await text('css/customer-theme.css');
  const dark=await text('css/theme.css');
  const typography=await text('css/typography.css');
  const from=css.indexOf('MENU PRODUCT CARDS — reference design rebuilt in place');
  const to=css.indexOf('Keep the mobile application and its fixed controls');
  assert.ok(from>=0 && to>from);
  const block=css.slice(from,to);
  assert.match(block,/grid-template-columns:var\(--menu-photo\) minmax\(0,1fr\)/);
  assert.match(block,/clip-path:polygon\(0 0,85% 0,100% 100%,0 100%\)/);
  assert.match(block,/var\(--palette-success/);
  assert.match(block,/var\(--palette-success-text/);
  assert.match(block,/var\(--palette-surface/);
  assert.match(block,/var\(--palette-button/);
  assert.match(block,/var\(--text-lg/);
  assert.ok(!block.includes('Single mobile product list for every device'));
  assert.ok(!theme.includes(':is(.saved-flash, .ingredient-chip, .prod-cart-badge)'));
  assert.ok(!dark.includes('html[data-theme="dark"] .prod-cart-badge {'));
  assert.ok(typography.includes('.prod-cart-label'));
});
