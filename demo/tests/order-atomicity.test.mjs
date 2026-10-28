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
