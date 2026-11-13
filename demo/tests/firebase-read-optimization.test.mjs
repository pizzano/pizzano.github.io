import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const archive = readFileSync(new URL('../js/orders-archive.js', import.meta.url), 'utf8');
const loyalty = readFileSync(new URL('../js/loyalty-sync.js', import.meta.url), 'utf8');

test('customer order polling remains fast while there are pending orders', () => {
  assert.match(data, /const needsLiveUpdates = tracked\.some\(/);
  assert.match(data, /\['mottatt', 'bekreftet', 'tilberedning'\]/);
  assert.match(data, /needsLiveUpdates \? CUSTOMER_ORDER_POLL_MS : 30000/);
});
test('customer releases the active SSE stream once order is ready', () => {
  assert.match(data, /!\['avvist','fullfort','klar'\]\.includes\(current\.status\)/);
  assert.match(data, /\['klar', 'avvist', 'fullfort'\]\.includes\(updated\.status\)/);
  assert.match(data, /closeCustomerOrderStream\(\)/);
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
  assert.match(data, /adminOrdersShouldBeLive\(\) && !ordersStreamHealthy && !ordersFallbackBusy/);
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
      (name === 'admin' ? '20261109-delta9' : '20261107-admin-startup1')));
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

test('compact order feed is strictly opt-in and retains legacy SSE fallback', async () => {
  const fs=await import('node:fs/promises');
  const data=await fs.readFile(new URL('../js/data.js',import.meta.url),'utf8');
  const config=await fs.readFile(new URL('../config.js',import.meta.url),'utf8');
  const loyalty=await fs.readFile(new URL('../js/loyalty-sync.js',import.meta.url),'utf8');
  const archive=await fs.readFile(new URL('../js/orders-archive.js',import.meta.url),'utf8');
  assert.doesNotMatch(config,/trustedCompactOrderFeed\s*:\s*true/);
  assert.match(data,/trustedCompactOrderFeed === true/);
  assert.match(data,/function validatedCompactOrderFeed\(/);
  assert.match(data,/meta\.completeOpenOrders !== true/);
  assert.match(data,/meta\.backendMaintainsLoyalty !== true/);
  assert.match(data,/meta\.backendMaintainsRetention !== true/);
  assert.match(data,/meta\.backendMaintainsLegacyMigration !== true/);
  assert.match(data,/Number\(meta\.openOrderCount\) !== active/);
  assert.match(data,/COMPACT_ORDER_MAX_AGE_MS = 45000/);
  assert.match(data,/if \(beginTrustedCompactOrdersStream\(\)\) return/);
  assert.match(data,/recoverFullOrdersStream\('Utdatert backendindeks'\)/);
  assert.match(data,/recoverFullOrdersStream\('Manuell kontroll av alle ordre'\)/);
  assert.match(data,/new EventSource\(streamUrl\(ORDERS_PATH\)\)/);
  assert.match(loyalty,/if \(isTrustedCompactOrderFeedActive\(\)\) return/);
  assert.match(archive,/if \(isTrustedCompactOrderFeedActive\(\)\) return/);
});

test('compact order feed rejects stale/partial backend snapshots before any UI adoption', async () => {
  const vm=await import('node:vm');
  const script = data.slice(data.indexOf('function validatedCompactOrderFeed('),
    data.indexOf('\nlet menuFallbackBusy',data.indexOf('function validatedCompactOrderFeed(')));
  assert.ok(script.startsWith('function validatedCompactOrderFeed('));
  const inspect=vm.runInNewContext(
    'const COMPACT_ORDER_MAX_AGE_MS=45000;\n'+script+'\nvalidatedCompactOrderFeed;');
  const now=1800000000000;
  const id='ord_abcdefgh12345';
  const order={id,phone:'41145353',createdAt:now-1000,status:'mottatt',
    total:210,lines:[{itemId:'pizza',quantity:1}]};
  const meta={schemaVersion:1,publisher:'trusted-firebase-order-worker-v1',
    ready:true,completeOpenOrders:true,backendMaintainsLoyalty:true,
    backendMaintainsRetention:true,backendMaintainsLegacyMigration:true,
    generatedAt:now-1000,includedOrderCount:1,openOrderCount:1};
  const feed={meta,orders:{[id]:order}};
  assert.ok(inspect(feed,now));
  assert.equal(inspect({...feed,meta:{...meta,generatedAt:now-45000}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,ready:false}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,completeOpenOrders:false}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,backendMaintainsLoyalty:false}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,backendMaintainsRetention:false}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,openOrderCount:0}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,includedOrderCount:2}},now),null);
  assert.equal(inspect({...feed,orders:{[id]:{...order,lines:undefined}}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,publisher:'browser'}},now),null);
  assert.equal(inspect({...feed,meta:{...meta,generatedAt:now+16000}},now),null);
});

test('phase 2: overlapping REST reads are shared without stale order caching', () => {
  assert.match(data,/const pendingRestReads = new Map\(\)/);
  assert.match(data,/pendingRestReads\.has\(key\)/);
  assert.match(data,/pendingRestReads\.delete\(key\)/);
  assert.doesNotMatch(data,/\?_=\$\{Date\.now\(\)\}/);
  assert.match(data,/cache: 'no-store'/);
});

test('phase 2: SSE checks one order for a leaf update and all orders on root', () => {
  assert.match(data,/function orderDisplaySignature\(o\)/);
  assert.match(data,/function applyRemoteOrders\(value, changedOrderId = ''\)/);
  assert.match(data,/const changedId = change\.path\.split\('\/'\)/);
  assert.match(data,/lastOrderDisplaySignatures\.set\(changedOrderId, newSignature\)/);
});

test('phase 2: legacy bonus reuses a loaded admin snapshot', () => {
  assert.match(data,/adminOrdersSnapshotLoaded && !compactFeedActive/);
  assert.match(data,/Object\.values\(ordersRaw\)\.filter/);
  assert.match(data,/Object\.values\(await restGet\(ORDERS_PATH\)/);
});

test('phase 2: unrelated remote receipt changes do not reschedule loyalty rollups', () => {
  assert.match(loyalty,/function orderSyncFingerprint\(\)/);
  assert.match(loyalty,/if \(nextFingerprint === lastOrderSyncFingerprint\) return/);
});


test('admin orders channel pauses outside orderable hours but resumes after midnight', () => {
  const begin=data.indexOf('function adminOrdersShouldBeLive(');
  const end=data.indexOf('\nfunction reconcileAdminOrdersChannel()',begin);
  assert.ok(begin>0 && end>begin);
  const fnCode=data.slice(begin,end);
  const now=Date.now();
  const make=(openState,orders=[])=>new Function('deps',
    'const {CUSTOMER_MODE,getOpenState,store}=deps;\n'+fnCode+
    '\nreturn adminOrdersShouldBeLive;')({
      CUSTOMER_MODE:false,getOpenState:()=>openState,
      store:{orders}
    });
  assert.equal(make({open:false,orderable:false})(),false);
  assert.equal(make({open:true,orderable:true})(),true);
  assert.equal(make({open:false,preOpen:true,orderable:true})(),true);
  assert.equal(make({open:false,orderable:false},[{status:'mottatt',createdAt:now-60000}])(),true);
  assert.equal(make({open:false,orderable:false},[{status:'tilberedning',createdAt:now-60000}])(),true);
  assert.equal(make({open:false,orderable:false},[{status:'avvist',createdAt:now-60000}])(),false);
  assert.equal(make({open:false,orderable:false},[{status:'mottatt',createdAt:now-3*86400000}])(),false);
});

test('admin SSE and REST fallback honor the same hours gate without blocking manual refresh', () => {
  assert.match(data,/function beginOrdersStream\(\) \{\s*if \(!adminOrdersShouldBeLive\(\)\) return;/);
  assert.match(data,/if \(!CUSTOMER_MODE\) reconcileAdminOrdersChannel\(\);/);
  assert.match(data,/adminOrdersShouldBeLive\(\) && !ordersStreamHealthy && !ordersFallbackBusy/);
  assert.match(data,/if \(!ordersStream && !document\.hidden && navigator\.onLine !== false\)\s*beginOrdersStream\(\)/);
  assert.match(data,/if \(hadOrders && !ordersStream\) reconcileAdminOrdersChannel\(\)/);
  assert.match(data,/async function pullRemote\(\{ ordersOnly = false \} = \{\}\)/);
  assert.match(data,/restGet\(ORDERS_PATH\)/);
});
