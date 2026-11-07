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

test('admin product editor controls exactly which quick kitchen notes appear',async()=>{
  const admin=await text('admin.html');
  const js=await text('js/admin.js');
  const customer=await text('js/customer.js');
  const css=await text('css/admin.css');
  const normalizer=await text('js/data-normalization.js');
  for(const id of ['fQuickKitchenNotesEnabled','productQuickKitchenNotesList',
    'fQuickKitchenNoteNew','btnAddProductKitchenNote','btnResetProductKitchenNotes']){
    assert.match(admin,new RegExp('id="'+id+'"'));
    assert.ok(js.includes("'"+id+"'"),'admin must bind '+id);
  }
  assert.match(admin,/data-section="produkt"[\s\S]*?id="fQuickKitchenNotesEnabled"/);
  assert.match(js,/function renderProductKitchenNotes\(item,section\)/);
  assert.match(js,/data-remove-product-kitchen-note/);
  assert.match(js,/item\.quickKitchenNotes=cleanProductKitchenNotes/);
  assert.match(js,/item\.quickKitchenNotes=null/);
  assert.match(js,/item\.quickKitchenNotesEnabled=el\.fQuickKitchenNotesEnabled\.checked/);
  assert.match(customer,/item\?\.quickKitchenNotesEnabled === false/);
  assert.match(customer,/Array\.isArray\(item\.quickKitchenNotes\)/);
  assert.match(normalizer,/quickKitchenNotesEnabled: item\.quickKitchenNotesEnabled !== false/);
  assert.match(normalizer,/quickKitchenNotes: Array\.isArray\(item\.quickKitchenNotes\)/);
  assert.match(css,/\.product-kitchen-note-row\{/);
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
  for(const token of ['--palette-accent','--palette-button-text','--palette-surface','--palette-button','--palette-ink','--text-lg']){
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

test('popup header actions, cart badge and selected option borders stay consistent across all palettes',async()=>{
  const customer=await text('css/customer.css');
  const theme=await text('css/customer-theme.css');
  const sheet=await text('css/product-detail-redesign.css');
  const index=await text('index.html');

  // The icon positions belong to the popup, never the selected theme.
  assert.match(sheet,/#productSheet \.sheet-close\{left:auto;right:16px\}/);
  assert.match(sheet,/#productSheet \.sheet-fav\{left:16px;right:auto;/);
  assert.doesNotMatch(sheet,/--premium-(?:fav|close)-(?:left|right)/);
  assert.doesNotMatch(theme,/--premium-(?:fav|close)-(?:left|right)/);

  // No 3px accent bar: all selected rows have the same inset edge on 4 sides.
  const checked=sheet.slice(sheet.indexOf('#productSheet .opt-row.is-checked,'),
    sheet.indexOf('#productSheet .opt-row.is-checked::after'));
  assert.match(checked,/border:2px solid var\(--pd-selected-edge\)/);
  assert.match(checked,/border-radius:14px/);
  assert.match(checked,/box-shadow:none/);
  assert.doesNotMatch(checked,/inset [1-9]px 0 0|premium-row-line/);

  // A menu cart-count badge uses the theme's button background & text contrast.
  const badge=customer.slice(customer.indexOf('.view-menu .prod-grid .prod-cart-badge {'),
    customer.indexOf('.view-menu .prod-grid .prod-cart-icon {'));
  assert.match(badge,/background:var\(--palette-button,var\(--palette-accent\)\)/);
  assert.match(badge,/color:var\(--palette-button-text,var\(--palette-on-accent,#fff\)\)/);
  assert.match(customer,/\.view-menu \.prod-grid \.prod-cart-label \{[^}]*color:inherit/s);

  const expectedVersions={
    'customer.css':'20261105-customer-extras1',
    'customer-theme.css':'20261104-theme-unify4',
    'product-detail-redesign.css':'20261105-customer-extras1',
  };
  for(const [css,version] of Object.entries(expectedVersions)){
    assert.match(index,new RegExp('css/'+css.replaceAll('.','\\.')+'\\?v='+version));
  }
});

test('product popup reaches the screen top and retains blur, curved photo divider and CTA spacing',async()=>{
  const css=await text('css/product-detail-redesign.css');
  const html=await text('index.html');
  const customer=await text('js/customer.js');

  assert.match(css,/position:fixed;inset:0;z-index:9999/);
  assert.match(css,/height:100dvh;max-height:100dvh/);
  assert.match(css,/inset:0 auto auto 50%;transform:translateX\(-50%\)/);
  assert.doesNotMatch(css,/--pd-top-gap|inset:14px auto auto 50%/);
  assert.match(css,/backdrop-filter:blur\(10px\)/);
  assert.match(css,/-webkit-backdrop-filter:blur\(10px\)/);
  assert.match(css,/border-top:5px solid var\(--premium-photo-edge,var\(--pd-accent\)\)/);
  assert.match(css,/#productSheet \.opt-row\.is-checked,#productSheet \.opt-row:has\(>input:checked\)\{\s*background:var\(--pd-selected\);\s*border:2px solid var\(--pd-selected-edge\);\s*border-radius:14px;/);
  assert.match(css,/#productSheet #btnAddToCart\{\s*display:flex;flex:1 1 auto;align-items:center;justify-content:space-evenly/);
  assert.doesNotMatch(css,/box-shadow:inset 0 0 0 2px var\(--pd-selected-edge\)/);
  assert.match(html,/product-detail-redesign\.css\?v=20261105-customer-extras1/);
  assert.match(customer,/el\.btnAddToCart\.addEventListener\('click', addDraftToCart\)/);
});

test('product photo fills mobile top corners and caption spacing stays compact',async()=>{
  const css=await text('css/product-detail-redesign.css');
  const start=css.indexOf('#productSheet {');
  const end=css.indexOf('#productSheet[hidden]');
  const popup=css.slice(start,end);
  assert.match(popup,/border:0;border-radius:0;overflow:hidden/);
  assert.doesNotMatch(popup,/border-radius:20px 20px 0 0/);
  const caption=css.slice(css.indexOf('#productSheet .sheet-hero-caption{'),
    css.indexOf('#productSheet .sheet-hero-caption::before{'));
  assert.match(caption,/padding:11px 16px 10px/);
  const description=css.slice(css.indexOf('#productSheet .pd-hero-description{'),
    css.indexOf('#productSheet .pd-hero-description[hidden]'));
  assert.match(description,/margin:5px 0 0/);
  const accent=css.slice(css.indexOf('#productSheet .sheet-hero-accent{'),
    css.indexOf('/* One layered card system'));
  assert.match(accent,/margin:9px auto 0/);
  assert.match(css,/#productSheet \.pd-hero-photo\{[^}]*width:100%;max-width:none/s);
  const html=await text('index.html');
  assert.match(html,/product-detail-redesign\.css\?v=20261105-customer-extras1/);
});

test('customer theme colors are consistent in header, profile and cart; sheet has no top gap',async()=>{
  const customer=await text('css/customer.css');
  const theme=await text('css/customer-theme.css');
  const cart=await text('css/cart.css');
  const palette=await text('js/palette.js');
  const sheet=await text('css/product-detail-redesign.css');
  const index=await text('index.html');
  const admin=await text('admin.html');

  assert.match(customer,/\.app-header \{\s*position: sticky;[^}]*background: var\(--palette-header-bg\)/s);
  assert.doesNotMatch(customer,/--brown:|--brown-2:|var\(--brown\)/);
  assert.match(customer,/\.step\.is-active \.step-num \{ background: var\(--palette-button\); color: var\(--palette-button-text\)/);
  assert.match(customer,/\.profile-avatar \{[^}]*background: var\(--palette-button\);\s*color: var\(--palette-button-text\)/s);
  assert.match(customer,/#viewProfile \.profile-contact-card \.validated-input\.is-valid \{[^}]*background:var\(--palette-selection-bg\)/s);
  assert.match(customer,/\.view-menu \.prod-grid \.prod-list-allergens \{[^}]*color:var\(--palette-accent-text,var\(--palette-accent\)\)/s);
  assert.match(theme,/html\[data-customer-palette\] \.valid-check \{ background: var\(--palette-button\); color: var\(--palette-button-text\)/);
  assert.match(theme,/html\[data-customer-palette\] \.validated-input\.is-valid \.input \{ background: var\(--palette-selection-bg\) !important; border-color: var\(--palette-accent\)/);
  assert.doesNotMatch(theme,/\.profile-avatar\) \{ color: #fff !important/);
  assert.match(cart,/\.view-cart \.cart-product-name \{[^}]*color:var\(--palette-accent-text,var\(--palette-accent\)\)/s);
  assert.match(cart,/\.view-cart \.cart-extra-count \{[^}]*color:var\(--palette-accent-text,var\(--palette-accent\)\)/s);
  assert.match(palette,/'accent-text': blendHex\(accent, ink, dark \? \.84 : \.69\)/);
  assert.match(palette,/header:'#765522'/);
  assert.match(sheet,/position:fixed;inset:0;z-index:9999/);
  for(const page of [index,admin])assert.match(page,/css\/cart\.css\?v=20261105-customer-extras1/);
  assert.match(index,/css\/customer-theme\.css\?v=20261104-theme-unify4/);
  assert.match(index,/js\/customer\.js\?v=20261106-customer-cache1/);
  assert.match(admin,/js\/admin\.js\?v=20261107-admin-startup1/);
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

test('five customer palettes keep cart ribbon text readable in light and dark modes', () => {
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
  assert.equal(Object.keys(CUSTOMER_PALETTES).length,5);
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

test('Premium Emerald & Gold is selectable in admin and scoped to the customer palette',async()=>{
  const palette=CUSTOMER_PALETTES.emeraldGold;
  assert.ok(palette,'fifth premium palette must be registered');
  assert.equal(palette.dark[0],'#F3D477','champagne gold heading and radio color');
  assert.equal(palette.dark[1],'#062D25','dark emerald background');
  assert.equal(palette.dark[3],'#F7F8F3','light text');
  assert.equal(palette.advanced.dark.button,'#F3D477');
  assert.equal(palette.advanced.dark.buttonText,'#172820');
  assert.equal(palette.light[1],'#F5F7F1','light-mode variant must be usable');

  const customer=await text('index.html');
  const admin=await text('admin.html');
  const adminJs=await text('js/admin.js');
  const normalizer=await text('js/data-normalization.js');
  const base=await text('css/customer.css');
  const theme=await text('css/customer-theme.css');
  const sheet=await text('css/product-detail-redesign.css');
  const cart=await text('css/cart.css');
  const adminCss=await text('css/admin.css');

  assert.match(normalizer,/['"]emeraldGold['"]/);
  assert.match(adminJs,/Object\.entries\(CUSTOMER_PALETTES\)/);
  assert.match(adminJs,/dataset\.paletteChoice = id/);
  assert.match(adminJs,/customerPalette\.dispatchEvent\(new Event\('change'/);
  assert.match(adminJs,/new Option\('6\. Egendefinert/);
  assert.match(admin,/id="sCustomerPalette"/);
  assert.match(admin,/id="customerPalettePreview"/);
  assert.match(adminCss,/\.palette-choice-grid/);
  assert.match(adminCss,/\.palette-choice-sample/);
  assert.match(theme,/data-customer-palette="emeraldGold"/);
  for (const property of ['--premium-main-bg','--premium-action-bg','--premium-card-bg','--premium-card-shadow','--premium-edge']) {
    assert.ok(theme.includes(property), property+' must be theme-controlled');
  }
  assert.match(sheet,/var\(--premium-action-bg/);
  assert.match(sheet,/var\(--premium-photo-edge/);
  assert.match(sheet,/var\(--premium-minus-bg/);
  assert.match(cart,/data-customer-palette="emeraldGold"/);
  assert.match(base,/var\(--premium-card-bg/);
  assert.match(customer,/customer-theme\.css\?v=20261104-theme-unify4/);
  assert.match(customer,/product-detail-redesign\.css\?v=20261105-customer-extras1/);
  assert.match(admin,/admin\.css\?v=20261105-product-notes2/);
});

test('product footer uses two separate rounded pills, theme-aware and compact',async()=>{
  const html=await text('index.html');
  const css=await text('css/product-detail-redesign.css');
  const js=await text('js/customer.js');
  const start=css.indexOf('Product footer — two independent rounded controls');
  const end=css.indexOf('#productSheet .opt-invalid .opt-rows',start);
  assert.ok(start>=0&&end>start,'product footer styles should have one existing owner');
  const rules=css.slice(start,end);
  assert.match(rules,/padding:7px 7px max\(7px,env\(safe-area-inset-bottom\)\)/);
  assert.match(rules,/gap:clamp\(9px,2\.5vw,18px\)/);
  assert.match(rules,/flex:0 0 34%/);
  assert.match(rules,/border:2px solid var\(--pd-button\);border-radius:999px/);
  assert.match(rules,/background:var\(--pd-card\)/);
  assert.match(rules,/border:0;border-radius:999px/);
  assert.match(rules,/color:var\(--pd-button\)/);
  assert.match(rules,/background:var\(--premium-action-bg,linear-gradient\(165deg/);
  assert.match(rules,/text-overflow: ellipsis/);
  assert.doesNotMatch(rules,/background:linear-gradient\(to right|border:3px/,'old joined footer must not return');
  assert.match(html,/<span id="sheetAddLabel">Legg til<\/span>/);
  assert.match(html,/<strong id="sheetTotal" aria-live="polite">0 kr<\/strong>/);
  assert.match(js,/sheetAddLabel: \$\('sheetAddLabel'\)/);
  assert.match(js,/el\.qtyMinus\.addEventListener\('click'/);
  assert.match(js,/el\.qtyPlus\.addEventListener\('click'/);
  assert.match(js,/el\.sheetTotal\.textContent = formatPrice\(draftTotal\(\)\)/);
  assert.match(html,/product-detail-redesign\.css\?v=20261105-customer-extras1/);
});

test('cart and saved order instruction rows share theme red without changing prices',async()=>{
  const css=await text('css/cart.css');
  const index=await text('index.html');
  const admin=await text('admin.html');
  const customer=await text('js/customer.js');
  const orders=await text('js/order-product-summary.js');
  for(const selector of ['.view-cart .cart-detail-row.is-note','.order-product-list .cart-detail-row.is-note']){
    const start=css.indexOf(selector+' {');
    assert.ok(start>=0,selector+' must have a semantic color rule');
    const rule=css.slice(start,css.indexOf('}',start));
    assert.match(rule,/color:var\(--palette-danger,#d32f2f\)/);
  }
  assert.match(customer,/class=\"cart-detail-row is-note\"/);
  assert.match(customer,/<b>Uten:<\/b>/);
  assert.match(customer,/<b>Kommentar:<\/b>/);
  assert.match(orders,/class=\"cart-detail-row is-note\"/);
  assert.match(index,/css\/cart\.css\?v=20261105-customer-extras1/);
  assert.match(admin,/css\/cart\.css\?v=20261105-customer-extras1/);
});

test('compact reference status card keeps solid icon panel, clock badge and working allergen switch',async()=>{
  const html=await text('index.html');
  const css=await text('css/order-status-cards.css');
  const theme=await text('css/theme.css');
  const customerTheme=await text('css/customer-theme.css');
  const customer=await text('js/customer.js');
  const states=['status-is-closed','status-is-preorder','status-is-pending'];
  for(const state of states)assert.ok(css.includes(state),'missing '+state+' style');
  assert.match(customer,/classList\.toggle\('status-is-open', isOpen\)/);
  assert.match(css,/--status-panel: #087c3d/);
  assert.match(css,/--status-panel: #b8171d/);
  assert.match(css,/border-radius: 18px/);
  assert.match(css,/\.menu-overview::before,\s*\.menu-overview::after/);
  assert.match(css,/\.menu-overview \.status-shop-icon/);
  assert.match(css,/border-radius: 0;\s*background: linear-gradient\(153deg/);
  assert.match(css,/\.menu-overview \.status-time-pill\[hidden\] \{ display: none; \}/);
  assert.match(css,/\.menu-overview \.status-allergen-control input:checked \+ \.allergen-visibility-switch/);
  assert.match(css,/@media \(max-width: 420px\)/);
  assert.match(css,/min-height: 84px/);
  assert.doesNotMatch(css,/border-radius: 16px 42%|border-radius:999px|!important.*background/);
  assert.match(customerTheme,/\.allergen-visibility-control:not\(\.status-allergen-control\) input:checked/);
  assert.match(theme,/\.allergen-visibility-control:not\(\.status-allergen-control\) input:checked/);
  assert.match(html,/order-status-cards\.css\?v=20261104-status-reference5/);
  assert.match(html,/customer-theme\.css\?v=20261104-theme-unify4/);
  assert.match(html,/theme\.css\?v=20261104-status-reference5/);
  assert.match(html,/for="allergenVisibilityToggle"/);
  assert.match(customer,/el\.statusTimeText\.textContent/);
  assert.match(customer,/el\.statusShopIcon\.dataset\.iconState/);
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
