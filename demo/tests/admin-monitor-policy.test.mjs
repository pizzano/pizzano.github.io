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

test('alerts fallback is slower because live SSE carries critical changes', () => {
  assert.equal(ALERTS_VISIBLE_INTERVAL_MS, 60000);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:59999 }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:60000 }),true);
});

test('background status scans are throttled but cannot run in hidden tabs', () => {
  assert.equal(ALERTS_BACKGROUND_INTERVAL_MS, 180000);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'orders',
    settingsSection:'status',sinceLastCheckMs:179999 }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'orders',
    settingsSection:'status',sinceLastCheckMs:180000 }),true);
  assert.equal(systemAlertsShouldPoll({ visible:false,page:'orders',
    settingsSection:'alerts',sinceLastCheckMs:100000,force:true }),false);
  assert.equal(systemAlertsShouldPoll({ visible:true,page:'settings',
    settingsSection:'alerts',sinceLastCheckMs:1000,force:true }),true);
});


test('admin never asks SMS/email Apps Script for idle health status', async () => {
  const admin=await readFile(new URL('../js/admin.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  const health=await readFile(new URL('../js/admin-health.js',import.meta.url),'utf8');
  assert.doesNotMatch(admin,/requestManualNotificationHealth|awaitManualHealthResponse|healthCheckRequest\\.json/);
  assert.doesNotMatch(admin,/\/notifications\/emailHealth\\.json/);
  assert.match(admin,/updateOrderSenderIndicators\\(all\\)/);
  assert.match(admin,/orderSenderState\\(order,channel\\)/);
  assert.match(admin,/senderBadgeHtml\\(order,'sms'\\)/);
  assert.match(admin,/senderBadgeHtml\\(order,'email'\\)/);
  assert.match(admin,/refreshFromDatabase\\(\\{ ordersOnly: true \\}\\)/);
  assert.match(admin,/testEpsonFromOrders\\(\\{ force: true \\}\\)/);
  assert.match(admin,/acceptOrderWithEstimate|acceptScheduledOrder/);
  assert.match(admin,/printOrderFromAdmin/);
  assert.doesNotMatch(health,/window\\.setInterval\\(\\(\\) => \\{\\s*if \\(visible\\(\\)\\) void runChecks/);
  assert.match(html,/SMS: ingen sending ennå/);
  assert.match(html,/E-post: ingen sending ennå/);
});

test('system errors use a live SSE feed and sparse REST fallback', async () => {
  const admin=await readFile(new URL('../js/admin.js',import.meta.url),'utf8');
  assert.match(admin,/new EventSource\(DB_URL \+ '\/systemErrors\.json'\)/);
  assert.match(admin,/applyAlertStreamDelta\(systemAlertsRaw,change,isPatch\)/);
  assert.match(admin,/if \(!force && systemAlertsStreamHealthy\) return/);
  assert.match(admin,/SYSTEM_ALERT_STREAM_RETRY_MS = 120000/);
  assert.match(admin,/stopSystemAlertsStream\(\)/);
  assert.match(admin,/if \(document\.hidden\) \{/);
  assert.doesNotMatch(admin,/window\.setInterval\(\(\)=>\{void refreshSystemAlerts\(\);\},12000\)/);
});
