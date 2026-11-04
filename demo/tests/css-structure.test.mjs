import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CUSTOMER_PALETTES } from '../js/palette.js';

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

test('menu product card has one reference layout without cascade overrides', async () => {
  const css=await text('css/customer.css');
  const theme=await text('css/customer-theme.css');
  const dark=await text('css/theme.css');
  const typography=await text('css/typography.css');
  const renderer=await text('js/customer-menu-view.js');
  const start=css.indexOf('MENU PRODUCT CARDS — sole layout owner');
  const end=css.indexOf('Keep the mobile application and its fixed controls');
  assert.ok(start>=0 && end>start);
  const block=css.slice(start,end);
  assert.equal((block.match(/\.prod-card \{/g)||[]).length,1,'only one base card definition');
  assert.match(block,/grid-template-columns:var\(--menu-photo\) minmax\(0,1fr\) var\(--menu-side\)/);
  assert.match(block,/grid-template-areas:"photo details actions"/);
  assert.match(block,/justify-content:space-between/);
  assert.match(block,/border-radius:100%/);
  for(const token of ['--palette-success','--palette-success-text','--palette-surface','--palette-button','--palette-ink','--text-lg']){
    assert.ok(block.includes('var('+token),token+' should inherit the theme');
  }
  assert.doesNotMatch(block,/!important|@import|\.add-btn::(?:before|after)/);
  assert.doesNotMatch(theme,/\.prod-(?:grid|card|desc|price|side)/,'customer palette must not override product layout');
  assert.doesNotMatch(dark,/\.prod-(?:grid|card|desc|price|side|name)/,'dark mode must use palette variables');
  assert.match(typography,/--text-xl: 22px/,'fifth typography tier must exist');
  assert.match(typography,/\.prod-name,.prod-price/,'menu text must use semantic font tiers');
  assert.doesNotMatch(typography,/body \*:not\(/,'old blanket font-size override must not return');
  assert.match(renderer, /class="prod-side"/);
  assert.match(renderer, /data-open="/);
  assert.match(renderer, /data-quick-add="/);
  const side=renderer.slice(renderer.indexOf('<div class="prod-side">'));
  assert.ok(side.indexOf('class="prod-price"') < side.indexOf('data-open="'));
  assert.match(side, /<svg viewBox="0 0 24 24"/);
});

test('all five typography tiers are editable and shared by customer and admin', async () => {
  const admin=await text('admin.html');
  const customer=await text('index.html');
  const typography=await text('css/typography.css');
  const settings=await text('js/typography-settings.js');
  const data=await text('js/data.js');
  const normalization=await text('js/data-normalization.js');
  const keys=['uiFontXs','uiFontSm','uiFontMd','uiFontLg','uiFontXl'];
  const vars=['--text-xs','--text-sm','--text-md','--text-lg','--text-xl'];
  for (let i=0; i<5; i++) {
    assert.match(admin,new RegExp('data-ui-font="' + keys[i] + '"'));
    assert.match(admin,new RegExp('data-ui-preview="' + keys[i] + '"'));
    assert.ok(typography.includes(vars[i] + ':'),vars[i]);
    assert.ok(settings.includes("key: '" + keys[i] + "'"),keys[i]);
    assert.ok(settings.includes("css: '" + vars[i] + "'"),vars[i]);
    assert.ok(data.includes(keys[i] + ':'),keys[i]+' must survive Firebase normalization');
  }
  assert.match(admin,/id="btnSaveUiTypography"/);
  assert.match(settings,/mutate\(state =>/);
  assert.match(settings,/await saveNow\(\)/);
  assert.match(settings,/subscribe\(\(\) =>/);
  assert.match(normalization,/\['uiFontXs', 'uiFontSm', 'uiFontMd', 'uiFontLg', 'uiFontXl'\]/);
  for(const page of [admin,customer]){
    assert.match(page,/css\/typography\.css\?v=/);
    assert.match(page,/js\/typography-settings\.js\?v=/);
  }
});

test('four customer palettes keep cart ribbon text readable in light and dark modes', () => {
  const luminance = hex => {
    const rgb=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255)
      .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  };
  const contrast=(a,b)=>{
    const x=luminance(a), y=luminance(b);
    return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
  };
  const mix=(a,b,weight)=>'#'+[1,3,5].map(i=>
    Math.round(Number.parseInt(a.slice(i,i+2),16)*weight+
      Number.parseInt(b.slice(i,i+2),16)*(1-weight))
      .toString(16).padStart(2,'0')).join('');
  assert.equal(Object.keys(CUSTOMER_PALETTES).length,4);
  for(const [key,palette] of Object.entries(CUSTOMER_PALETTES)){
    for(const mode of ['light','dark']){
      const [,,surface,,,success]=palette[mode];
      const foreground=contrast(success,'#000000')>=contrast(success,'#FFFFFF')
        ?'#000000':'#FFFFFF';
      const gradientStart=mix(success,surface,0.97);
      assert.ok(contrast(success,foreground)>=4.5,key+' '+mode+' solid label contrast');
      assert.ok(contrast(gradientStart,foreground)>=4.5,key+' '+mode+' gradient label contrast');
    }
  }
});

test('product dialog footer is one rounded quantity and checkout bar',async()=>{
  const html=await text('index.html');
  const css=await text('css/product-detail-redesign.css');
  const js=await text('js/customer.js');
  const start=css.indexOf('Product footer: one rounded pill');
  const end=css.indexOf('#productSheet .opt-invalid .opt-rows',start);
  assert.ok(start>=0&&end>start,'product footer must be rebuilt in place');
  const rules=css.slice(start,end);
  assert.match(rules,/border-radius:999px/);
  assert.match(rules,/flex:0 0 33%/);
  assert.match(rules,/background:var\(--pd-button\)!important/);
  assert.match(rules,/background:var\(--pd-card\)/);
  assert.match(rules,/font-size:var\(--text-lg,18px\)!important/);
  assert.doesNotMatch(rules,/gap:10px|border-radius:28px/,'old separated controls must be absent');
  assert.match(html,/<span id="sheetAddLabel">Legg til<\/span>/);
  assert.match(html,/<strong id="sheetTotal" aria-live="polite">0 kr<\/strong>/);
  assert.match(js,/sheetAddLabel: \$\('sheetAddLabel'\)/);
  assert.match(js,/el\.sheetAddLabel\.textContent = draft\.editingLineId/);
  assert.match(js,/el\.qtyMinus\.addEventListener\('click'/);
  assert.match(js,/el\.qtyPlus\.addEventListener\('click'/);
  assert.match(js,/el\.sheetTotal\.textContent = formatPrice\(draftTotal\(\)\)/);
  assert.match(html,/product-detail-redesign\.css\?v=20261104-cart-pill1/);
});

test('one themed status banner replaces the legacy double open/closed card', async () => {
  const html=await text('index.html');
  const customer=await text('js/customer.js');
  const status=await text('css/order-status-cards.css');
  const base=await text('css/customer.css');
  const theme=await text('css/theme.css');
  assert.match(html,/class="menu-overview status-is-pending"/);
  for(const id of ['statusShopIcon','openStatus','pickupDetails','openDot',
    'statusTimePill','statusTimeText','allergenVisibilityToggle']) {
    assert.ok(html.includes('id="'+id+'"'),id+' missing');
  }
  assert.ok(!html.includes('id="closedBanner"'));
  assert.ok(!customer.includes('closedBanner'));
  assert.ok(!status.includes('.closed-banner'));
  assert.ok(!base.includes('.menu-overview'));
  assert.ok(!theme.includes('html[data-theme="dark"] .menu-overview'));
  for(const token of ['--palette-success','--palette-danger',
    '--palette-surface','--palette-ink']) {
    assert.ok(status.includes(token),token+' missing');
  }
  assert.match(customer,/Forhåndsbestilling mulig · hent etter åpning/);
  assert.match(customer,/indefiniteManualClose/);
  assert.match(customer,/lastRestaurantWindowKey/);
  assert.ok(base.includes('--palette-button'), 'allergen toggle still uses chosen theme button color');
  assert.ok(customer.includes('statusShopIcon.dataset.iconState'), 'avoid repainting icon every five seconds');
  assert.ok(customer.includes("el.statusShopIcon.dataset.iconState = 'pending'"), 'connection loss must restore neutral icon');
  assert.match(customer,/hasVerifiedTime = \/\^\(\?:\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$\//);
});
