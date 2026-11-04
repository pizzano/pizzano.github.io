/* Pure customer helpers + non-destructive performance regression tests.
 * Run: node --test demo/tests/*.test.mjs
 * No Firebase writes, SMS, email or printer access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { escapeHtml, profileInitials, formatProfilePhone, orderStatusClass, validPhone } from '../js/display-format.js';
import { resolveScheduledPickupAt } from '../js/pickup-slots.js';
import { buildMenuBlocks, categoryIcon, renderProductCard, visibleMenuItems } from '../js/customer-menu-view.js';

test('HTML escaping handles special characters without altering ordinary names', () => {
  assert.equal(escapeHtml('<b title="&">Pizza</b>'), '&lt;b title=&quot;&amp;&quot;&gt;Pizza&lt;/b&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml('Margherita'), 'Margherita');
});

test('profile helpers handle empty names, Norwegian initials and 8-digit phone formatting', () => {
  assert.equal(profileInitials(''), '');
  assert.equal(profileInitials('Kübra Alemdar'), 'KA');
  assert.equal(profileInitials('Fatih'), 'F');
  assert.equal(formatProfilePhone('41223344'), '+47 41 22 33 44');
  assert.equal(formatProfilePhone(''), 'Kundeprofil');
});

test('order status styles classify rejection, ready, confirmed and new', () => {
  assert.equal(orderStatusClass('avvist'), 'is-rejected');
  assert.equal(orderStatusClass('klar'), 'is-ready');
  assert.equal(orderStatusClass('bekreftet'), 'is-active');
  assert.equal(orderStatusClass('fullført'), 'is-done');
  assert.equal(orderStatusClass('mottatt'), 'is-new');
});

test('phone validator accepts 4/9-starting Norwegian numbers and rejects incomplete entries', () => {
  assert.equal(validPhone('41223344'), true);
  assert.equal(validPhone('91 22 33 44'), true);
  assert.equal(validPhone('51223344'), false);
  assert.equal(validPhone('4122334'), false);
});

test('scheduled pickup rolls into the next day when the selected clock is earlier', () => {
  const now = new Date(2026, 10, 3, 23, 50);
  assert.equal(resolveScheduledPickupAt('00:15', now), new Date(2026, 10, 4, 0, 15).getTime());
  assert.equal(resolveScheduledPickupAt('23:55', now), new Date(2026, 10, 3, 23, 55).getTime());
  assert.equal(resolveScheduledPickupAt('hello', now), null);
});

test('menu search still covers names, descriptions, options and allergens', () => {
  const section = { title: 'Pizza', items: [
    { id: '1', name: 'Margherita', description: 'Tomat', sizes: [{label:'Stor'}] },
    { id: '2', name: 'Vegetar', hidden: true },
  ] };
  const group = () => [{ title: 'Saus', options: [{ label: 'Béarnaisesaus' }] }];
  const allergens = () => ['Melk'];
  assert.deepEqual(visibleMenuItems(section, 'margherita', group, allergens).map(i=>i.id), ['1']);
  assert.deepEqual(visibleMenuItems(section, 'BÉARNAISE', group, allergens).map(i=>i.id), ['1']);
  assert.deepEqual(visibleMenuItems(section, 'melk', group, allergens).map(i=>i.id), ['1']);
  assert.deepEqual(visibleMenuItems(section, '', group, allergens).map(i=>i.id), ['1']);
});

test('order-status updates cannot needlessly recreate unchanged menu cards', async () => {
  const js = await readFile(new URL('../js/customer.js', import.meta.url), 'utf8');
  assert.match(js, /if \(nextMarkup === lastMenuMarkup\) return;/);
  assert.match(js, /updateMenuMarkup\(markup\)/);
  assert.match(js, /ui\.searchOpen && el\.menuSearch\?\.isConnected/);
  const menuView = await readFile(new URL('../js/customer-menu-view.js', import.meta.url), 'utf8');
  assert.match(menuView, /loading="lazy" decoding="async" width="108" height="108"/);
});

test('customer and admin modules use one canonical Firebase data URL', async () => {
  const names = ['customer.js', 'shop-info.js', 'special-days-customer.js',
    'typography-settings.js', 'admin.js', 'admin-health.js',
    'loyalty-sync.js', 'orders-archive.js', 'pickup-load-admin.js',
    'special-days-admin.js'];
  const imports = await Promise.all(names.map(async name => {
    const code = await readFile(new URL('../js/' + name, import.meta.url), 'utf8');
    const match = code.match(/from ['"](\.\/data\.js\?v=[^'"]+)['"]/);
    assert.ok(match, name + ' must import the versioned Firebase data module');
    return match[1];
  }));
  assert.equal(new Set(imports).size, 1, 'different module URLs duplicate Firebase state/listeners');
});

test('customer and admin share one HTML escaping implementation', async () => {
  const admin = await readFile(new URL('../js/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /import \{ escapeHtml \} from '\.\/display-format\.js'/);
  assert.doesNotMatch(admin, /function escapeHtml\(/);
});

test('SSE retry backs off and polling retains per-order REST fallback', async () => {
  const js = await readFile(new URL('../js/data.js', import.meta.url), 'utf8');
  assert.match(js, /customerStreamRetryAfter/);
  assert.match(js, /Math\.min\(30000, 2000 \* \(2 \*\* \(customerStreamFailures - 1\)\)\)/);
  assert.match(js, /if \(force && now - lastCustomerPollAt < 2500\) return;/);
  assert.match(js, /customerOrderStreamHealthy && customerOrderStreamId === id/);
  assert.match(js, /restGet\(ORDERS_PATH \+ '\/' \+ encodeURIComponent\(id\), 7500\)/);
});

test('menu groups favorites, popular picks and categories without DOM access', () => {
  const item = { id: 'pizza1', name: 'Pizza' };
  const section = { id: 'pizza', title: 'Pizza', items: [item] };
  const groups = buildMenuBlocks({
    favorites: ['pizza1'],
    popularItemIds: ['pizza1'],
    sections: [section],
    findItem: id => ({ item: id === 'pizza1' ? item : null, section }),
    visibleItems: value => value.items.filter(Boolean),
  });
  assert.deepEqual(groups.map(group=>group.key), ['favorites','popular','pizza']);
  assert.match(categoryIcon({ key: 'favorites', title: 'Favoritter' }), /<svg/);
  assert.match(categoryIcon({ key: 'pizza', title: 'Pizza' }), /<svg/);
});

test('product taps initialize a draft without a missing helper and restore option defaults', async () => {
  const source = await readFile(new URL('../js/customer.js', import.meta.url), 'utf8');
  const open = source.slice(source.indexOf('function openProduct('), source.indexOf('function finishProductClose('));
  const render = source.slice(source.indexOf('function renderSheet()'), source.indexOf('/* ------------------------------------------------------------------ *\n * Handlekurv'));
  assert.ok(open.length > 0 && render.length > 0);
  assert.doesNotMatch(open, /defaultSelectionFor\(/, 'removed helper must never be called');
  assert.match(open, /selections:\s*editLine\s*\?\s*JSON\.parse\(JSON\.stringify\(editLine\.selections\)\)\s*:\s*\{\}/);
  assert.match(open, /renderSheet\(\)/);
  assert.match(render, /draft\.selections\[group\.id\] = \[\.\.\.\(group\.defaultOptionIds \|\| \[\]\)\]/);
  assert.match(source, /const card = event\.target\.closest\('\.prod-card'\)/);
  assert.match(source, /openProduct\(card\.dataset\.item\)/);
});

test('product popup actually opens and closes without undefined dialog state', async () => {
  const source = await readFile(new URL('../js/customer.js', import.meta.url), 'utf8');
  const stateStart = source.indexOf('/** Åpent produkt i sheet. */');
  const openStart = source.indexOf('function openProduct(');
  const lifecycleEnd = source.indexOf('/** Validerer valggrupper.', openStart);
  assert.ok(stateStart >= 0 && openStart > stateStart && lifecycleEnd > openStart);
  for (const name of ['productPreviousFocus', 'productExitTimer', 'productHistoryEntryActive']) {
    assert.match(source.slice(stateStart, openStart), new RegExp('\\blet ' + name + ' = (?:null|false);'));
  }
  const active = { isConnected: true, focusCount: 0, focus() { this.focusCount++; } };
  const item = { id: 'p1', name: 'Testpizza', sizes: [{id: 'm'}] };
  const el = {
    sheetTitle: {textContent: ''}, sheetBackdrop: {hidden: true, dataset: {}},
    sheet: {hidden: true, dataset: {}, querySelector: () => ({scrollTop: 0})},
    sheetClose: {focus() {}}, sheetErr: {hidden: true},
  };
  const history = {state: {}, pushState(next) {this.state = next}, back() {}};
  let rendered = 0;
  const context = {
    el, history, ui: {}, cart: [], choosingBonus: false, bonusState: null,
    document: {activeElement: active, body: {style: {}}},
    location: {href: 'https://example.invalid/demo/'},
    window: {matchMedia: () => ({matches: true})},
    metricClock: () => 0, recordDuration() {}, findItem: () => ({item}),
    getDefaultSize: value => value.sizes[0], updateProductFavoriteButton() {},
    renderSheet() {rendered++}, clearTimeout() {}, toast() {},
  };
  const lifecycle = source.slice(stateStart, source.indexOf('let bonusState = null;', stateStart)) +
    source.slice(openStart, lifecycleEnd);
  const result = runInNewContext(lifecycle + '\n' +
    'openProduct("p1"); const wasOpen = !el.sheet.hidden && !el.sheetBackdrop.hidden;' +
    'closeSheet(); ({wasOpen, isClosed: el.sheet.hidden && el.sheetBackdrop.hidden})',
    context, {timeout: 1500});
  assert.equal(result.wasOpen, true);
  assert.equal(result.isClosed, true);
  assert.equal(rendered, 1);
  assert.equal(active.focusCount, 1);
});

test('five Firebase font tiers preview, save, reload and sync across admin/customer', async () => {
  const original = await readFile(new URL('../js/typography-settings.js', import.meta.url), 'utf8');
  const code = original.replace(/^import \{[^\n]+\} from '[^']+';\n/m, '');
  assert.ok(!code.includes("import {"),'typography module import should be removable for isolated test');

  function setup(settings, admin) {
    const keys=['uiFontXs','uiFontSm','uiFontMd','uiFontLg','uiFontXl'];
    const controls=Object.fromEntries(keys.map(key => [key, {
      dataset:{uiFont:key},value:'',handlers:{},addEventListener(name,handler){this.handlers[name]=handler},
      setCustomValidity(value){this.error=value}
    }]));
    const savedStatus={textContent:'',dataset:{}};
    const button={disabled:false,handlers:{},addEventListener(name,handler){this.handlers[name]=handler}};
    const css={};
    const document={
      activeElement:null,
      documentElement:{style:{setProperty(name,value){css[name]=value}}},
      querySelectorAll:()=>admin?Object.values(controls):[],
      getElementById:id=>id==='uiFontStatus'?savedStatus:id==='btnSaveUiTypography'?button:null,
    };
    const store={settings:{...settings}};
    let listener=null,saveObserver=null,mutationCount=0,saveCount=0;
    runInNewContext(code,{
      document,store,
      subscribe:handler=>{listener=handler},
      ready:()=>Promise.resolve(),
      mutate:fn=>{mutationCount++;fn(store);listener?.('local')},
      saveNow:async()=>{saveCount++;return true},
      onStatus:handler=>{saveObserver=handler},
    },{timeout:1500});
    return {
      store,controls,css,button,savedStatus,
      emitRemote:()=>listener?.('remote'),
      saved:()=>saveObserver?.({state:'saved'}),
      counts:()=>({mutationCount,saveCount}),
    };
  }

  const admin=setup({uiFontXs:10,uiFontSm:11,uiFontMd:12,uiFontLg:13},true);
  assert.equal(admin.controls.uiFontXl.value,'22','old four-size settings get an XL default');
  assert.equal(admin.css['--text-sm'],'11px','existing Firebase custom sizes survive');

  admin.controls.uiFontMd.value='15';
  admin.controls.uiFontMd.handlers.input();
  assert.equal(admin.css['--text-md'],'15px','changes must preview immediately');
  admin.controls.uiFontMd.handlers.change();
  assert.equal(admin.store.settings.uiFontMd,15,'change must reach shared Firebase settings');
  admin.saved();
  assert.match(admin.savedStatus.textContent,/lagret i Firebase/);

  admin.controls.uiFontXl.value='25';
  admin.controls.uiFontXl.handlers.input();
  admin.controls.uiFontXl.handlers.change();
  await admin.button.handlers.click();
  assert.equal(admin.store.settings.uiFontXl,25);
  assert.equal(admin.counts().saveCount,1,'explicit Save writes through shared saveNow');

  const customer=setup(admin.store.settings,false);
  assert.equal(customer.css['--text-md'],'15px');
  assert.equal(customer.css['--text-xl'],'25px');
  customer.store.settings.uiFontXl=27;
  customer.emitRemote();
  assert.equal(customer.css['--text-xl'],'27px','customer must reflect subsequent Firebase updates');
});

test('product hero never flashes the previous photo during fast product changes', async () => {
  const source=await readFile(new URL('../js/customer.js',import.meta.url),'utf8');
  const start=source.indexOf('function renderProductHeroImage(');
  const end=source.indexOf('function renderSheet() {',start);
  assert.ok(start>=0 && end>start,'hero-image lifecycle helper is present');
  assert.match(source.slice(end),/renderProductHeroImage\(heroHeader, item\.imageUrl\)/);
  const created=[];
  const document={
    createElement(tag) {
      assert.equal(tag,'img');
      const photo={
        dataset:{},style:{},handlers:{},isConnected:false,
        complete:false,naturalWidth:0,
        addEventListener(type,callback){this.handlers[type]=callback},
        remove(){if(this.parent?.photo===this)this.parent.photo=null;this.isConnected=false}
      };
      created.push(photo);
      return photo;
    }
  };
  const hero={
    photo:null,
    querySelector(selector){assert.equal(selector,'.pd-hero-photo');return this.photo},
    prepend(photo){this.photo=photo;photo.parent=this;photo.isConnected=true}
  };
  const sources=(url,variant)=>{
    assert.equal(variant,'hero');
    return url==='vegetar.webp'
      ? {src:'/vegetar-hero.webp',srcset:'/vegetar-480.webp 480w',sizes:'100vw'}
      : {src:'/pommes-hero.webp',srcset:'',sizes:''};
  };
  const update=runInNewContext(source.slice(start,end)+'\nrenderProductHeroImage;',
    {document,productImageSources:sources},{timeout:1500});

  update(hero,'vegetar.webp');
  const vegetarian=hero.photo;
  assert.equal(vegetarian.style.visibility,'hidden','wait for first image before showing');
  assert.equal(vegetarian.srcset,'/vegetar-480.webp 480w');
  update(hero,'vegetar.webp');
  assert.equal(hero.photo,vegetarian,'same product preserves its already loading image');
  update(hero,'pommes.webp');
  const fries=hero.photo;
  assert.notEqual(fries,vegetarian,'a new product gets a new image element');
  assert.equal(vegetarian.isConnected,false,'old product bitmap is detached immediately');
  assert.equal(fries.style.visibility,'hidden','new bitmap must not show before loading');
  assert.equal(fries.src,'/pommes-hero.webp');
  assert.equal(fries.srcset,undefined,'old CDN srcset does not leak into another product');
  vegetarian.handlers.load();
  assert.equal(vegetarian.style.visibility,'hidden','late old load cannot restore stale bitmap');
  assert.equal(hero.photo,fries,'late load cannot replace the current image');
  fries.handlers.load();
  assert.equal(fries.style.visibility,'visible','correct photo appears on load');
  update(hero,'pommes.webp');
  assert.equal(hero.photo,fries,'size/option updates preserve the loaded photo');
  update(hero,'');
  assert.equal(hero.photo,null,'products without a photo remove the old one');

  update(hero,'pommes.webp');
  hero.photo.handlers.error();
  assert.equal(hero.photo,null,'failed image leaves no stale bitmap');
  assert.equal(created.length,3,'repeated renders do not create redundant images');
});

test('product card renderer keeps price, cart action and lazy image hints', () => {
  const deps = {
    getItemBasePrice: () => 210,
    getItemOptionGroups: () => [],
    getItemIngredientRules: () => [],
    allergenLabels: () => [],
    formatPrice: value => value + ' kr',
    productCartBadgeHtml: () => '',
    ingredientCustomizationEnabled: true,
    showAllergens: false,
  };
  const item = { id: 'p1', name: 'Margherita', imageUrl: '/pizza.webp', sizes: [], description: 'Tomatsaus' };
  const html = renderProductCard(item, { title: 'Pizza' }, deps);
  assert.match(html, /data-quick-add="p1"/);
  assert.match(html, /loading="lazy" decoding="async" width="108" height="108"/);
  assert.match(html, /210 kr/);
  const withOptions = renderProductCard(item, { title: 'Pizza' }, {
    ...deps, getItemOptionGroups: () => [{ id: 'sauce' }],
  });
  assert.match(withOptions, /data-open="p1"/);
});

test('reference menu card keeps image ribbon, actual cart action and sold-out state', () => {
  const item={id:'biff',name:'Biffsnadder',description:'Biffkjøtt og pommes frites',imageUrl:'/biff.webp'};
  const deps={
    getItemBasePrice:()=>259,getItemOptionGroups:()=>[],
    getItemIngredientRules:()=>[],allergenLabels:()=>[],
    formatPrice:price=>price+' kr',productCartBadgeHtml:()=>'<span class="prod-cart-badge">1 i kurven</span>',
    ingredientCustomizationEnabled:false,showAllergens:false
  };
  const card=renderProductCard(item,{title:'Snadder'},deps);
  assert.ok(card.indexOf('class="prod-media"')<card.indexOf('class="prod-info"'));
  assert.ok(card.indexOf('class="prod-cart-badge"')<card.indexOf('class="prod-info"'));
  assert.match(card,/data-quick-add="biff"/);
  assert.match(card,/259 kr/);
  assert.match(card,/width="108" height="108"/);
  const soldOut=renderProductCard({...item,soldOut:true},{title:'Snadder'},deps);
  assert.match(soldOut,/is-soldout/);
  assert.doesNotMatch(soldOut,/data-quick-add=|data-open=/);
});
test('cart badge creation and updates reuse one SVG label renderer', async () => {
  const source=await readFile(new URL('../js/customer.js',import.meta.url),'utf8');
  assert.match(source,/const MENU_CART_ICON =/);
  assert.match(source,/prod-cart-icon/);
  assert.match(source,/prod-cart-label/);
  assert.match(source,/productCartBadgeContent\(quantity\)/);
  assert.match(source,/badge\.innerHTML = productCartBadgeContent\(quantity\)/);
  const menuBadgeSource=source.slice(source.indexOf('const MENU_CART_ICON'),source.indexOf('let lastMenuMarkup'));
  assert.ok(menuBadgeSource.length > 0);
  assert.doesNotMatch(menuBadgeSource,/aria-hidden="true">✓<\/span>/);
});
