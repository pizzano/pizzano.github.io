import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const archive = readFileSync(new URL('../js/orders-archive.js', import.meta.url), 'utf8');

test('customer order polling remains fast while there are pending orders', () => {
  assert.match(data, /const needsLiveUpdates = tracked\.some\(/);
  assert.match(data, /\['mottatt', 'bekreftet', 'tilberedning'\]/);
  assert.match(data, /needsLiveUpdates \? CUSTOMER_ORDER_POLL_MS : 30000/);
});
test('customer polls only tracked order IDs, never whole orders collection', () => {
  const start = data.indexOf('async function pollCustomerOrders(');
  const end = data.indexOf('\nfunction beginOrdersStream()', start);
  assert.ok(start > 0 && end > start);
  const fn = data.slice(start,end);
  assert.match(fn, /ORDERS_PATH \+ '\/' \+ encodeURIComponent\(id\)/);
  assert.doesNotMatch(fn, /restGet\(ORDERS_PATH\)/);
});
test('legacy orderArchive is not automatically deleted during maintenance', () => {
  assert.doesNotMatch(archive, /method:\s*'DELETE'[^\n]*orderArchive|orderArchive\.json/);
  assert.match(archive, /NOTIFICATION_GRACE_MS = 72/);
  assert.match(archive, /'if-match': etag/);
});

test('returning customers use an indexed public-only menu and version checks', async () => {
  const data = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/data.js', import.meta.url), 'utf8'));
  const customer = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/customer.js', import.meta.url), 'utf8'));
  assert.match(data, /const CUSTOMER_MENU_CACHE_DB = 'kol-customer-public-menu-v1'/);
  assert.match(data, /indexedDB\.open\(CUSTOMER_MENU_CACHE_DB, 1\)/);
  assert.match(data, /const version = Number\(await restGet\(/);
  assert.match(data, /version > 0 && version === Number\(cached\.menu\.updatedAt\)/);
  assert.match(data, /return \{ menu: cached\.menu, verified: true \}/);
  assert.match(data, /await saveCustomerMenuCache\(\)/);
  assert.match(data, /if \(!CUSTOMER_MODE\) return;/);
  assert.match(customer, /await ensureCustomerMenuCurrent\(\)/);
  assert.match(customer, /cartAdjusted \|\| cartSubtotal\(\) !== previousTotal/);
});

test('cached customer menu excludes other customers, orders and admin settings', async () => {
  const data = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/data.js', import.meta.url), 'utf8'));
  const start = data.indexOf('const CUSTOMER_MENU_CACHE_KEYS');
  const end = data.indexOf('];', start) + 2;
  assert.ok(start > 0 && end > start);
  const cacheKeys = data.slice(start, end);
  assert.doesNotMatch(cacheKeys, /'orders'|'customers'|'smsReceipts'|'emailReceipts'|'orderAlarmUrl'|'printerQtySize'/);
  assert.match(data, /menu\.settings = Object\.fromEntries\(CUSTOMER_MENU_CACHE_KEYS/);
  assert.match(data, /menu: publicCustomerMenuSnapshot\(\)/);
  assert.match(data, /return \{ menu: cached\.menu, verified: false \}/);
  assert.match(data, /throw new Error\('Kunne ikke kontrollere oppdatert meny/);
});

test('strict checkout refresh cannot inherit a swallowed background fetch error', async () => {
  const data = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/data.js', import.meta.url), 'utf8'));
  assert.match(data, /if \(!menuRefreshPromise\) \{/);
  assert.match(data, /if \(strict\) return menuRefreshPromise/);
  assert.match(data, /return menuRefreshPromise\.catch\(error =>/);
  const customer = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/customer.js', import.meta.url), 'utf8'));
  assert.match(customer, /const previousCart = JSON\.stringify\(cart\)/);
  assert.match(customer, /JSON\.stringify\(cart\) !== previousCart/);
});

test('public menu cache invalidates automatically when schema version changes', async () => {
  const data = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/data.js', import.meta.url), 'utf8'));
  assert.match(data, /Number\(record\.menu\?\.schemaVersion\) !== SCHEMA_VERSION/);
});
