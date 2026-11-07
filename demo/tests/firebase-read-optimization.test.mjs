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

test('admin reconnect waits for initial SSE snapshot before duplicating full order GET', () => {
  assert.match(data, /ordersStreamStartedAt = Date\.now\(\)/);
  assert.match(data, /\(!ordersStream \|\| Date\.now\(\) - ordersStreamStartedAt >= 9000\)/);
  assert.match(data, /const FALLBACK_MENU_INTERVAL = CUSTOMER_MODE \? 10 \* 60 \* 1000 : 30000/);
  assert.match(data, /if \(!ordersStreamHealthy && !ordersFallbackBusy/);
});
test('customer contact saves only name/email without downloading private account totals', () => {
  const start = data.indexOf('export async function saveCustomerContact(');
  const end = data.indexOf('export async function setPizzaOffersConsent(',start);
  const section = data.slice(start,end);
  assert.match(section, /method: 'PATCH'/);
  assert.match(section, /JSON\.stringify\(\{ name: displayName, email: address \}\)/);
  assert.doesNotMatch(section, /await read\.json\(|X-Firebase-ETag|method: 'PUT'/);
});
test('bonus cache is memory-only and monetary redemptions force authoritative reads', () => {
  assert.match(data, /const BONUS_STATE_TTL_MS = 45 \* 1000/);
  assert.match(data, /const bonusStateCache = new Map\(\)/);
  assert.match(data, /if \(!fresh && bonusStateInFlight\.has\(phone\)\)/);
  assert.match(data, /const state = await getPizzaBonus\(record\.phone, \{ fresh: true \}\)/);
  assert.match(data, /bonusStateCache\.delete\(phone\)/);
  const from = data.indexOf('const BONUS_STATE_TTL_MS');
  const to = data.indexOf('async function reservePizzaReward(', from);
  assert.doesNotMatch(data.slice(from,to), /localStorage|sessionStorage|indexedDB/);
});

test('manual admin refresh requests orders without re-downloading complete menu', async () => {
  const code=await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../js/data.js',import.meta.url),'utf8'));
  assert.match(code,/async function pullRemote\(\{ ordersOnly = false \} = \{\}\)/);
  assert.match(code,/ordersOnly \? Promise\.resolve\(null\) : readRemoteMenuSnapshot\(\)/);
  assert.match(code,/restGet\(ORDERS_PATH\)/);
  assert.match(code,/export async function refreshFromDatabase\(options = \{\}\)/);
});

test('admin retains Firebase startup safety with no orphaned retry button code', async () => {
  const fs=await import('node:fs/promises');
  const data=await fs.readFile(new URL('../js/data.js',import.meta.url),'utf8');
  const admin=await fs.readFile(new URL('../js/admin.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../admin.html',import.meta.url),'utf8');
  assert.match(data,/async function restGet\(path, timeoutMs = 9000\)/);
  assert.match(data,/let adminMenuVerified = CUSTOMER_MODE/);
  assert.match(data,/if \(!CUSTOMER_MODE && !adminMenuVerified\) \{/);
  assert.match(data,/setSaveState\(startupError \? 'error' : 'saved'/);
  assert.match(admin,/el\.btnSaveNow\.disabled = !backendInfo\.menuLoaded/);
  assert.doesNotMatch(data,/retryAdminMenuLoad|Manuell innlasting av adminmeny feilet/);
  assert.doesNotMatch(admin,/retryAdminMenuLoad|retryAdminButton|btnRetryAdminLoad/);
  assert.doesNotMatch(html,/btnRetryAdminLoad|Prøv å hente menyen på nytt|Admin-JavaScript kunne ikke starte|Admin svarte ikke/);
  assert.match(html,/id="backendHint">Lagring: —<\/p>/);
});

test('all admin entry modules import exactly one fresh shared data module', async () => {
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../admin.html',import.meta.url),'utf8');
  for (const name of ['admin','admin-health','loyalty-sync','orders-archive',
    'pickup-load-admin','special-days-admin']) {
    const code=await fs.readFile(new URL('../js/'+name+'.js',import.meta.url),'utf8');
    assert.match(code,/\.\/data\.js\?v=20261107-admin-startup1/);
    assert.match(html,new RegExp('./js/'+name+'\\.js\\?v='+
      (name === 'admin' ? '20261107-admin-cleanup1' : '20261107-admin-startup1')));
  }
});

test('cache-first menu checks on return and always revalidates before purchase', () => {
  assert.match(data,/const CUSTOMER_MENU_RETURN_MIN_MS = 60 \* 1000/);
  assert.match(data,/if \(CUSTOMER_MODE && Date\.now\(\) - lastMenuFallbackAt >= CUSTOMER_MENU_RETURN_MIN_MS\)/);
  assert.match(data,/lastMenuFallbackAt = 0; \/\/ force a small updatedAt read/);
  assert.match(data,/export async function ensureCustomerMenuCurrent\(\)/);
});

test('historical pizza migration is audited at most weekly after full success', async () => {
  const fs=await import('node:fs/promises');
  const code=await fs.readFile(new URL('../js/loyalty-sync.js',import.meta.url),'utf8');
  assert.match(code,/LEGACY_AUDIT_INTERVAL_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(code,/localStorage\.getItem\(LEGACY_AUDIT_KEY\)/);
  assert.match(code,/localStorage\.setItem\(LEGACY_AUDIT_KEY,String\(Date\.now\(\)\)\)/);
  assert.match(code,/if \(legacyAuditRecentlyCompleted\(\)\) \{/);
  assert.match(code,/historicalAuditFailed = true/);
  assert.match(code,/historicalDiscovered && !historicalQueue\.length && !historicalAuditFailed/);
  assert.match(code,/window\.addEventListener\('kol-order-confirmed', scheduleSync\)/);
  assert.match(code,/const old = compact \|\| fromV3 \? null : await readOldCustomer\(phone\)/);
  const marked=code.match(/localStorage\.setItem\([^)]*\)/g) || [];
  assert.equal(marked.length,1,'never write phone numbers or loyalty snapshots to local storage');
});
