import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const customer = readFileSync(new URL('../js/customer.js', import.meta.url), 'utf8');
test('customer listens to one tracked order via Firebase SSE, not global orders', () => {
  const start = data.indexOf('function startCustomerOrderStream()');
  const end = data.indexOf('// No customer order snapshots', start);
  const code = data.slice(start, end);
  assert.match(code, /new EventSource\(streamUrl\(ORDERS_PATH \+ '\/' \+ encodeURIComponent\(id\)\)\)/);
  assert.match(code, /source\.addEventListener\('put'/);
  assert.match(code, /source\.addEventListener\('patch'/);
  assert.match(code, /closeCustomerOrderStream\(\)/);
  assert.doesNotMatch(code, /new EventSource\(streamUrl\(ORDERS_PATH\)\)/);
});
test('polling skips a healthy live order but continues fallback for other IDs', () => {
  assert.match(data, /customerOrderStreamHealthy && customerOrderStreamId === id/);
  assert.match(data, /startCustomerOrderStream\(\);\s*await pollCustomerOrders\(\)/);
  assert.match(customer, /!customerOrderHasLiveListener\(orderConfirmOrderId\)/);
});
