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
