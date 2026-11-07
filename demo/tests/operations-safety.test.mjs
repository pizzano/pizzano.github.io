/* Offline-only checks for test lab isolation, health classification and alerts.
 * No production Firebase, SMS, email or Epson traffic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSimulation, simulateAction, simulateCompleteFlow } from '../js/test-simulator.js';
import { smsHealthState, emailHealthState, activeCriticalAlerts } from '../js/admin-health-policy.js';

const source = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const START = 1800000000000;

test('complete simulated order flow does not require any network or printer', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected external call'); };
  try {
    const order = simulateCompleteFlow({id:'SIM-999',at:START});
    assert.equal(order.status,'klar');
    assert.equal(order.sms,'mock-ok');
    assert.equal(order.email,'mock-ok');
    assert.equal(order.print,'mock-ok');
    assert.equal(order.events.length,5);
  } finally { globalThis.fetch = originalFetch; }
});

test('test lab refuses production order IDs', () => {
  assert.throws(() => createSimulation({id:'real_order_123'}), /SIM-/);
  assert.throws(() => simulateAction({id:'real_order_123'},'accept'), /simulated/i);
});

test('pending order expires only after 3 minutes; pre-orders are exempt', () => {
  const regular=createSimulation({id:'SIM-A',at:START});
  assert.throws(()=>simulateAction(regular,'expire',{at:START+179999}),/ikke ute/);
  assert.equal(simulateAction(regular,'expire',{at:START+180000}).status,'avvist');
  const preOrder=createSimulation({id:'SIM-B',at:START,preOrder:true});
  assert.throws(()=>simulateAction(preOrder,'expire',{at:START+999999}),/Ingen tidsfrist/);
  assert.equal(simulateAction(preOrder,'accept',{at:START+999999}).status,'bekreftet');
});

test('mock notification and printer errors are local to the simulated order', () => {
  const accepted=simulateAction(createSimulation({id:'SIM-C',at:START}), 'accept', {at:START+1});
  const failed=simulateAction(simulateAction(accepted,'notification-fail',{at:START+2}),
    'print-fail',{at:START+3});
  assert.equal(failed.sms,'mock-error');
  assert.equal(failed.email,'mock-error');
  assert.equal(failed.print,'mock-error');
  assert.equal(accepted.sms,'not-run');
  assert.equal(accepted.print,'not-run');
});

test('simulation page forbids external network, form submission and plugins', async () => {
  const html=await source('test-lab.html');
  const js=await source('js/test-lab.js');
  const simulator=await source('js/test-simulator.js');
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/default-src 'none'/);
  assert.doesNotMatch(js,/from ['"]\.\/data\.js/);
  assert.doesNotMatch(simulator,/\bfetch\s*\(|\blocalStorage\b\s*\.|\bwindow\.print\s*\(/);
});

test('fresh SMS poller is not represented as confirmed phone delivery', () => {
  const result=smsHealthState({source:'apps-script-sms-poller',liveConfigured:true,
    status:'ok',checkedAt:START},START+1000);
  assert.equal(result.state,'warning');
  assert.match(result.detail,/ikke bekreftet/);
  assert.equal(smsHealthState({source:'apps-script-sms-poller',liveConfigured:false,
    status:'ok',checkedAt:START},START+1000).state,'error');
  assert.equal(smsHealthState({source:'apps-script-sms-poller',liveConfigured:true,
    status:'ok',checkedAt:START},START+190000).state,'error');
});

test('fresh email poller is not represented as inbox delivery', () => {
  const result=emailHealthState({source:'apps-script-email-poller',status:'ok',
    checkedAt:START,quotaRemaining:100},START+1000);
  assert.equal(result.state,'warning');
  assert.match(result.detail,/ikke bekreftet/);
  assert.equal(emailHealthState({source:'apps-script-email-poller',status:'unavailable',
    checkedAt:START,quotaRemaining:0},START+1000).state,'error');
});

test('only unresolved recent genuine critical alerts trigger the banner', () => {
  const records={
    real:{severity:'critical',lastSeen:START-5000,status:'ongoing',resolved:false},
    test_order_accept_http:{severity:'critical',lastSeen:START,status:'ongoing'},
    recovered:{severity:'critical',lastSeen:START,status:'recovered'},
    old:{severity:'critical',lastSeen:START-3600000,status:'ongoing'},
    warning:{severity:'warning',lastSeen:START,status:'ongoing'},
  };
  assert.deepEqual(activeCriticalAlerts(records,START).map(([key])=>key),['real']);
});

test('health checks never issue writes or automatic printer receipts', async () => {
  const js=await source('js/admin-health.js');
  assert.match(js,/method:'GET'/);
  assert.match(js,/Promise\.allSettled/);
  assert.doesNotMatch(js,/submitOrder\s*\(|printKitchenTicket\s*\(/);
  assert.match(js,/refreshButton\?\.addEventListener\('click', \(\) => \{ void runChecks\(true\); \}\)/);
  assert.doesNotMatch(js,/if \(visible\(\)\) void runChecks\(\)/);
  assert.match(js,/catch \(error\) \{[\s\S]*?Firebase: Kontroll avbrutt/);
  assert.match(js,/finally \{\s*running = false;\s*refreshButton.disabled = false;/);
});
