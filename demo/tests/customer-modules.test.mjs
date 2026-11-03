/* Pure customer helpers + non-destructive performance regression tests.
 * Run: node --test demo/tests/*.test.mjs
 * No Firebase writes, SMS, email or printer access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(menuView, /loading="lazy" decoding="async" width="76" height="76"/);
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
  assert.match(html, /loading="lazy" decoding="async" width="76" height="76"/);
  assert.match(html, /210 kr/);
  const withOptions = renderProductCard(item, { title: 'Pizza' }, {
    ...deps, getItemOptionGroups: () => [{ id: 'sauce' }],
  });
  assert.match(withOptions, /data-open="p1"/);
});
