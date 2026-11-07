/* Firebase read economy: tests schedule decisions, never calls Firebase.
 * These status badges are independent from live orders, acceptance and alerts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SMS_STATUS_INTERVAL_MS, ALERTS_BACKGROUND_INTERVAL_MS, ALERTS_VISIBLE_INTERVAL_MS,
  smsStatusShouldPoll, systemAlertsShouldPoll,
} from '../js/admin-health-policy.js';

test('SMS health never polls when the tab is hidden or admin is not on orders', () => {
  assert.equal(smsStatusShouldPoll({ page:'products',visible:true,sinceLastCheckMs:60000 }),false);
  assert.equal(smsStatusShouldPoll({ page:'settings',visible:true,sinceLastCheckMs:60000,force:true }),false);
  assert.equal(smsStatusShouldPoll({ page:'orders',visible:false,sinceLastCheckMs:60000,force:true }),false);
});

test('SMS health is manual-only even after hours of inactivity', () => {
  assert.equal(SMS_STATUS_INTERVAL_MS, 45000);
  assert.equal(smsStatusShouldPoll({ page:'orders',visible:true,sinceLastCheckMs:44999 }),false);
  assert.equal(smsStatusShouldPoll({ page:'orders',visible:true,sinceLastCheckMs:3600000 }),false);
  assert.equal(smsStatusShouldPoll({ page:'orders',visible:true,sinceLastCheckMs:1,force:true }),true);
});

test('system-error status remains fast while the Varsler tab is open', () => {
  assert.equal(ALERTS_VISIBLE_INTERVAL_MS, 12000);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:11999 }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:12000 }),true);
});

test('background status scans are throttled but cannot run in hidden tabs', () => {
  assert.equal(ALERTS_BACKGROUND_INTERVAL_MS, 30000);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'orders',
    settingsSection:'status',sinceLastCheckMs:29999 }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'orders',
    settingsSection:'status',sinceLastCheckMs:30000 }),true);
  assert.equal(systemAlertsShouldPoll({ visible:false,page:'orders',
    settingsSection:'alerts',sinceLastCheckMs:100000,force:true }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:1000,force:true }),true);
});

test('order stream and acceptance remain independent of health badges', async () => {
  const admin = await readFile(new URL('../js/admin.js', import.meta.url),'utf8');
  assert.doesNotMatch(admin,/window\.setInterval\(refreshSmsStatus/);
  assert.doesNotMatch(admin,/window\.setInterval\(\(\) => \{ void refreshEmailStatus/);
  assert.match(admin,/smsStatusShouldPoll\(\{/);
  assert.match(admin,/systemAlertsShouldPoll\(\{/);
  assert.match(admin,/refreshSmsStatus\(\{ force: true \}\)/);
  assert.match(admin,/refreshEmailStatus\(\)/);
  assert.match(admin,/testEpsonFromOrders\(\{ force: true \}\)/);
  assert.match(admin,/refreshFromDatabase\(\{ ordersOnly: true \}\)/);
  assert.match(admin,/updateOrdersConnection\(\)/);
  assert.match(admin,/if \(section === 'alerts'\) void refreshSystemAlerts\(\{ force: true \}\)/);
  assert.match(admin,/if \(emailStatusFetching \|\| document\.hidden \|\| ui\.page !== 'orders'\) return;/);
  assert.match(admin,/acceptOrderWithEstimate/);
  assert.match(admin,/printOrderFromAdmin/);
});

test('status badges only request Firebase when an explicit refresh is pressed', async () => {
  const admin=await readFile(new URL('../js/admin.js',import.meta.url),'utf8');
  const health=await readFile(new URL('../js/admin-health.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  const start=admin.indexOf("el.btnRefreshOrders.addEventListener('click'");
  const end=admin.indexOf('// Expiration is a local clock event',start);
  assert.ok(start>0 && end>start);
  const handler=admin.slice(start,end);
  assert.match(handler,/Promise\.allSettled\(\[/);
  for(const call of [
    'refreshFromDatabase({ ordersOnly: true })',
    'refreshSmsStatus({ force: true })',
    'refreshEmailStatus()',
    'testEpsonFromOrders({ force: true })'
  ]) assert.ok(handler.includes(call),'manual check missing: '+call);
  assert.doesNotMatch(admin,/window\.setTimeout\(\(\) => \{ void testEpsonFromOrders/);
  assert.doesNotMatch(admin,/window\.setInterval\(\(\) => \{ void testEpsonFromOrders/);
  assert.doesNotMatch(admin,/window\.setInterval\(\(\) => \{if\(ui\.page==='notifications'/);
  assert.doesNotMatch(health,/window\.setInterval\(\(\) => \{\s*if \(visible\(\)\) void runChecks/);
  assert.match(html,/id="btnRefreshOrders"/);
  assert.match(html,/Oppdater bestillinger, nett, Epson, SMS og e-post/);
});
