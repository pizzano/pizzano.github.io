import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const begin = source.indexOf('async function patchConfirmedPizzaOrder(order, changes) {');
const end = source.indexOf('\nconst expiringOrders', begin);
assert.ok(begin >= 0 && end > begin, 'acceptance function exists');
const code = source.slice(begin, end);
function harness(fetchImpl) {
  const deps = {
    remoteEnabled: true, CUSTOMER_MODE: false, DB_URL: 'https://firebase.test',
    ORDERS_PATH: 'orders', fetch: fetchImpl,
    pauseAdminLiveStreamsForWrite: () => () => {},
    confirmationExpired: () => false,
    orderAcceptHttpError: async response => new Error('HTTP ' + response.status),
    monitorCriticalOperation: promise => promise,
    window: { dispatchEvent() {} },
    Event: class { constructor(type) { this.type = type; } },
    AbortSignal,
    setTimeout,
  };
  return new Function('deps', 'const {' + Object.keys(deps).join(',') + '}=deps; ' + code + '; return patchConfirmedPizzaOrder;')(deps);
}
const pending = { id: 'o1', status: 'mottatt', customerName: 'Test', smsReceipt: { sent: true } };
const response = (status, value, etag = null) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: key => key === 'ETag' ? etag : null },
  json: async () => value,
});
test('Godta reads ETag, preserves receipt data and commits only with if-match', async () => {
  const calls = [];
  const fn = harness(async (_url, options) => {
    calls.push(options);
    if (!options.method) return response(200, pending, '"v1"');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['if-match'], '"v1"');
    const saved = JSON.parse(options.body);
    assert.deepEqual(saved.smsReceipt, pending.smsReceipt);
    assert.equal(saved.status, 'bekreftet');
    return response(200, saved);
  });
  const result = await fn(pending, { status: 'bekreftet', statusUpdatedAt: 200 });
  assert.equal(result.status, 'bekreftet');
  assert.equal(calls.length, 2);
});
test('two-admin race: Firebase 412 never reports confirmed status', async () => {
  const fn = harness(async (_url, options) =>
    options.method ? response(412, null) : response(200, pending, '"v1"'));
  await assert.rejects(fn(pending, { status: 'bekreftet' }), /annen enhet/);
});
test('already confirmed on server: Godta does not issue a write', async () => {
  let writes = 0;
  const fn = harness(async (_url, options) => {
    if (options.method) writes++;
    return response(200, { ...pending, status: 'bekreftet' }, '"v2"');
  });
  await assert.rejects(fn(pending, { status: 'bekreftet' }), /allerede behandlet/);
  assert.equal(writes, 0);
});
test('order creation uses create-only conditional write and reconciles duplicates', () => {
  assert.match(source, /'if-match': 'null_etag'/);
  assert.match(source, /if \(response\.status === 412\)/);
  assert.match(source, /Object\.assign\(record, existing\)/);
});

const rejectionStart = source.indexOf('export async function rejectOrder(orderId, reason = \'\', message = \'\') {');
const rejectionEnd = source.indexOf('\n/** Alle ordre, nyeste først. */', rejectionStart);
assert.ok(rejectionStart > 0 && rejectionEnd > rejectionStart);
const rejectionCode = source.slice(rejectionStart, rejectionEnd).replace('export async function', 'async function');
function rejectionHarness(fetchImpl, initial) {
  const store = { orders: [{ ...initial }] };
  const states = [];
  const deps = {
    store, fetch: fetchImpl, remoteEnabled: true, remoteOnline: true,
    ORDERS_PATH: 'orders', DB_URL: 'https://firebase.test',
    beginOrderStatusWrite: () => ({}),
    finishOrderStatusWrite: () => {},
    emitData: () => {},
    setSaveState: state => states.push(state),
    pauseAdminLiveStreamsForWrite: () => () => {},
    orderAcceptHttpError: async response => new Error('HTTP ' + response.status),
    AbortSignal,
  };
  const fn = new Function('deps', 'let {' + Object.keys(deps).join(',') + '}=deps; ' +
    rejectionCode + '; return rejectOrder;')(deps);
  return { fn, store, states };
}

test('Avvis uses ETag and preserves notifications on successful reject', async () => {
  const current = { id: 'o2', status: 'mottatt', statusUpdatedAt: 100, smsReceipts: { accepted: 'ok' } };
  const calls = [];
  const { fn, store } = rejectionHarness(async (_url, opts) => {
    calls.push(opts);
    if (!opts.method) return response(200, current, '"reject-v1"');
    assert.equal(opts.method, 'PUT');
    assert.equal(opts.headers['if-match'], '"reject-v1"');
    const written = JSON.parse(opts.body);
    assert.deepEqual(written.smsReceipts, current.smsReceipts);
    assert.equal(written.status, 'avvist');
    return response(200, written);
  }, current);
  assert.equal(await fn('o2', 'Kan ikke lage', 'Beklager'), true);
  assert.equal(store.orders[0].status, 'avvist');
  assert.equal(calls.length, 2);
});

test('Avvis rejects a stale admin view without overwriting the remote order', async () => {
  const original = { id: 'o3', status: 'mottatt', statusUpdatedAt: 100 };
  let writes = 0;
  const { fn, store, states } = rejectionHarness(async (_url, opts) => {
    if (opts.method) writes++;
    return response(200, { ...original, status: 'bekreftet', statusUpdatedAt: 101 }, '"reject-v2"');
  }, original);
  assert.equal(await fn('o3', 'Stengt'), false);
  assert.equal(writes, 0);
  assert.equal(store.orders[0].status, 'mottatt');
  assert.ok(states.includes('error'));
});

test('Avvis returns false and rolls back when another device wins ETag race', async () => {
  const original = { id: 'o4', status: 'mottatt', statusUpdatedAt: 100 };
  const { fn, store } = rejectionHarness(async (_url, opts) =>
    opts.method ? response(412, null) : response(200, original, '"reject-v1"'), original);
  assert.equal(await fn('o4', 'Stengt'), false);
  assert.equal(store.orders[0].status, 'mottatt');
});

