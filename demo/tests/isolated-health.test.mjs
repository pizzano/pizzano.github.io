/* Isolated test lab and read-only admin health contracts.
 * No credentials, Firebase writes, SMS, email, print or network use. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSimulation, simulateAction, simulateCompleteFlow } from '../js/test-simulator.js';
import { activeCriticalAlerts, isFreshHeartbeat, smsHealthState, emailHealthState } from '../js/admin-health-policy.js';

const file = name => readFile(new URL('../'+name, import.meta.url),'utf8');
const at = 1800000000000;

test('full test chain is simulated and ends ready without external effects', () => {
  const result=simulateCompleteFlow({at,id:'SIM-001'});
  assert.equal(result.status,'klar');
  assert.equal(result.id,'SIM-001');
  assert.equal(result.sms,'mock-ok');
  assert.equal(result.email,'mock-ok');
  assert.equal(result.print,'mock-ok');
  assert.equal(result.events.length,5);
  assert.match(result.events[3].message,/SIMULERT/);
});
test('simulator only accepts safe SIM identifiers', () => {
  assert.throws(()=>createSimulation({id:'ord_123'}));
  assert.throws(()=>simulateAction({id:'ord_123'},'accept'));
});
test('simulated accept cannot be duplicated and rejected orders cannot notify', () => {
  const incoming=createSimulation({at,id:'SIM-002'});
  const confirmed=simulateAction(incoming,'accept',{at:at+1000,minutes:15});
  assert.throws(()=>simulateAction(confirmed,'accept',{at:at+2000}));
  const rejected=simulateAction(incoming,'reject',{at:at+500});
  assert.throws(()=>simulateAction(rejected,'notifications',{at:at+1000}));
  assert.equal(incoming.status,'mottatt');
});
test('simulated 3-minute deadline and pre-order exemption', () => {
  const incoming=createSimulation({at,id:'SIM-003'});
  assert.throws(()=>simulateAction(incoming,'expire',{at:at+179999}));
  assert.equal(simulateAction(incoming,'expire',{at:at+180000}).status,'avvist');
  assert.throws(()=>simulateAction(incoming,'accept',{at:at+180001}));
  const pre=createSimulation({at,id:'SIM-004',preOrder:true});
  assert.equal(simulateAction(pre,'accept',{at:at+3600000}).status,'bekreftet');
  assert.throws(()=>simulateAction(pre,'expire',{at:at+3600000}));
});
test('SMS heartbeat requires LIVE and timestamp is under three minutes', () => {
  const healthy={source:'apps-script-sms-poller',status:'ok',checkedAt:at,liveConfigured:true};
  assert.equal(smsHealthState(healthy,at+120000).state,'warning');
  assert.equal(smsHealthState(healthy,at+180000).state,'error');
  assert.equal(smsHealthState({...healthy,liveConfigured:false},at+100).state,'error');
  assert.equal(isFreshHeartbeat(healthy,at+120000),true);
});
test('email heartbeat requires valid quota and does not promise delivery', () => {
  const healthy={source:'apps-script-email-poller',status:'ok',checkedAt:at,quotaRemaining:35};
  assert.equal(emailHealthState(healthy,at+120000).state,'warning');
  assert.match(emailHealthState(healthy,at+120000).detail,/Innbokslevering/);
  assert.equal(emailHealthState({...healthy,quotaRemaining:0},at+100).state,'error');
  assert.notEqual(emailHealthState({...healthy,quotaRemaining:null},at+100).label,'E-post: Sender aktiv');
});
test('critical banner ignores test, recovered, resolved and old alerts', () => {
  const entry=(lastSeen,status='ongoing')=>({lastSeen,severity:'critical',status,resolved:false,operation:'Godta'});
  const records={
    'order_accept_timeout':entry(at-2000),
    'test_order_create_network':entry(at-1000),
    'sms_network':entry(at-3000,'recovered'),
    'email_timeout':{...entry(at-4000),resolved:true},
    'firebase_network':entry(at-3600000),
  };
  assert.deepEqual(activeCriticalAlerts(records,at).map(([id])=>id),['order_accept_timeout']);
});
test('sandbox HTML blocks all network requests and never loads production config', async () => {
  const html=await file('test-lab.html');
  const ui=await file('js/test-lab.js');
  const engine=await file('js/test-simulator.js');
  assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/src=["'][^"']*(config\.js|customer\.js|data\.js|admin\.js)/);
  assert.doesNotMatch(ui,/fetch\s*\(|localStorage|sendSMS|printKitchenTicket/);
  assert.doesNotMatch(engine,/fetch\s*\(|localStorage|sendSMS|printKitchenTicket/);
  assert.match(ui,/simulateCompleteFlow/);
});
test('admin health is read-only and never posts to Firebase or prints tickets', async () => {
  const js=await file('js/admin-health.js');
  assert.match(js,/method:'GET'/);
  assert.match(js,/readOnly\('orders',true\)/);
  assert.match(js,/checkEpsonConnection\(\)/);
  assert.doesNotMatch(js,/printKitchenTicket\(|method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(js,/submitOrder\(|sendSms\(|sendEmail\(/);
});
test('admin health and critical banner use real non-test alert records', async () => {
  const html=await file('admin.html');
  const admin=await file('js/admin.js');
  assert.match(html,/data-settings-section-tab="health"/);
  assert.match(html,/id="criticalSystemBanner"/);
  assert.match(admin,/kol-alert-snapshot/);
  assert.match(admin,/kol-health-refresh-request/);
  assert.match(admin,/SETTINGS_SECTIONS = new Set\(\[[^\]]*'health'/);
});
