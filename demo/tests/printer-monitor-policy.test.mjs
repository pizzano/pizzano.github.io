/* Adaptive Epson connection checks: no network/printer requests in tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EPSON_HEALTHY_INTERVAL_MS, EPSON_INITIAL_INTERVAL_MS,
  EPSON_ERROR_INITIAL_INTERVAL_MS, EPSON_ERROR_MAX_INTERVAL_MS,
  epsonProbeInterval, shouldProbeEpson,
} from '../js/printer-monitor-policy.js';

const onOrders = { page: 'orders', visible: true };
const now = 200000;

test('healthy Epson: check every 30 seconds, not every 10 seconds', () => {
  assert.equal(EPSON_HEALTHY_INTERVAL_MS, 30000);
  assert.equal(epsonProbeInterval('ok'), 30000);
  assert.equal(shouldProbeEpson({ ...onOrders, status:'ok',lastCheckedAt:now-29999,now }), false);
  assert.equal(shouldProbeEpson({ ...onOrders, status:'ok',lastCheckedAt:now-30000,now }), true);
});

test('unknown initial connection is checked immediately and rechecked after 5s', () => {
  assert.equal(EPSON_INITIAL_INTERVAL_MS, 5000);
  assert.equal(shouldProbeEpson({ ...onOrders, lastCheckedAt:0, now }), true);
  assert.equal(shouldProbeEpson({ ...onOrders, status:'pending',lastCheckedAt:now-4999,now }), false);
  assert.equal(shouldProbeEpson({ ...onOrders, status:'pending',lastCheckedAt:now-5000,now }), true);
});

test('repeated failed Epson probes back off 10, 20, 40 then 60 seconds', () => {
  assert.equal(EPSON_ERROR_INITIAL_INTERVAL_MS, 10000);
  assert.equal(EPSON_ERROR_MAX_INTERVAL_MS, 60000);
  assert.deepEqual([1,2,3,4,20].map(failures => epsonProbeInterval('error',failures)),
    [10000,20000,40000,60000,60000]);
  assert.equal(shouldProbeEpson({ ...onOrders,status:'error', failures:2,
    lastCheckedAt:now-19999,now }), false);
  assert.equal(shouldProbeEpson({ ...onOrders,status:'error', failures:2,
    lastCheckedAt:now-20000,now }), true);
});

test('never probe a hidden page, a different admin tab or during ticket printing', () => {
  assert.equal(shouldProbeEpson({ ...onOrders, visible:false,force:true }), false);
  assert.equal(shouldProbeEpson({ ...onOrders, page:'products',force:true }), false);
  assert.equal(shouldProbeEpson({ ...onOrders, busy:true,force:true }), false);
  assert.equal(shouldProbeEpson({ ...onOrders, status:'ok',lastCheckedAt:now-10,now,force:true }), true);
});

test('real ticket printing and uncertain-print no-retry safeguards remain unchanged', async () => {
  const js = await readFile(new URL('../js/admin.js', import.meta.url), 'utf8');
  const printer = await readFile(new URL('../js/order-printer.js', import.meta.url), 'utf8');
  assert.match(js, /shouldProbeEpson\(\{/);
  assert.match(js, /busy: printerCheckRunning \|\| printingOrderIds\.size > 0/);
  assert.match(js, /window\.setInterval\(\(\) => \{ void testEpsonFromOrders\(\); \}, 5000\)/);
  assert.match(js, /if \(ui\.page === 'orders'\) void testEpsonFromOrders\(\{ force: true \}\)/);
  assert.match(js, /\+\+printerProbeEpoch;\s*printerCheckRunning = false;\s*if \(selectedOrderId === orderId\)/);
  assert.match(js, /await printKitchenTicket\(order, \{ reprint, typography: store\.settings \}\)/);
  assert.match(js, /Never automatically retry an uncertain print/);
  assert.match(printer, /export async function checkEpsonConnection\(\)/);
  assert.match(printer, /<epos-print xmlns="/);
});
