import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('SMS: completed send repairs only Firebase receipt, without gateway call', () => {
  const code = load('../integrations/google-apps-script/Kode.gs');
  const block = code.slice(code.indexOf('const prior = props.getProperty(eventKey);'), code.indexOf("if (kind !== 'accepted') continue;"));
  assert.match(block, /completed\.state === 'sent'/);
  assert.match(block, /kolSmsReceipt_\(/);
  assert.match(block, /continue;/);
  assert.doesNotMatch(block, /kolApiSend_\(/);
});
test('Email: completed send receipt reconciliation does not call MailApp', () => {
  const code = load('../integrations/google-apps-script/email-poller.gs');
  const block = code.slice(code.indexOf('for (const completedKey in checkpoint.sent)'), code.indexOf('const kind = kolNotificationKind_', code.indexOf('for (const completedKey in checkpoint.sent)')));
  assert.match(block, /checkpoint\.sent\[completedKey\] !== 'sent'/);
  assert.match(block, /kolEmailReceipt_\(/);
  assert.doesNotMatch(block, /kolSendMail_|MailApp\.sendEmail/);
});
test('Epson uncertainty warns employee to check paper before manual reprint', () => {
  const code = load('../js/admin.js');
  assert.match(code, /Sjekk om Epson allerede skrev ut før du velger/);
  assert.match(code, /printingOrderIds\.has\(orderId\)/);
});

test('SMS scans only changes since last successful poll with bounded overlap', () => {
  const code = load('../integrations/google-apps-script/Kode.gs');
  assert.match(code, /KOL_SMS_SCAN_OVERLAP_MS = 5 \* 60 \* 1000/);
  assert.match(code, /successfulAt - KOL_SMS_SCAN_OVERLAP_MS/);
  assert.match(code, /if \(kolSmsIndexedQueryOk_ && !scanHasMore\)/);
  assert.match(code, /if \(sent >= KOL_SMS.maxPerRun \|\| todayCount >= KOL_SMS.maxPerDay\)/);
  assert.match(code, /kolSmsRespondToManualHealth_\(kolProps_\(\), healthMode, scanStatus\)/);
  assert.match(code, /everyMinutes\(1\)/, 'independent Apps Script trigger must keep running');
});
test('Email and SMS load large templates only when sending, not every idle minute', () => {
  const sms = load('../integrations/google-apps-script/Kode.gs');
  const email = load('../integrations/google-apps-script/email-poller.gs');
  const smsPoll = sms.slice(sms.indexOf('function pollOrdersForSms()'), sms.indexOf('function setupTestSms()'));
  assert.match(smsPoll, /const templateForSend = \(\) =>/);
  assert.match(smsPoll, /kolMessage_\(order, kind, item.id, templateForSend\(\)\)/);
  const emailPoll = email.slice(email.indexOf('function kontrollerEpostBestillinger()'),
    email.indexOf('function kontrollerEpostTestNaa()'));
  assert.match(emailPoll, /const templatesForSend = \(\) =>/);
  assert.match(emailPoll, /kolProcessMailTests_\(props,templatesForSend\)/);
  assert.match(emailPoll, /kind,templatesForSend\(\)/);
  assert.match(emailPoll, /kolEmailRespondToManualHealth_\('ok'\)/);
});

test('sender health writes require a fresh nonduplicate request from admin', () => {
  const sms=load('../integrations/google-apps-script/Kode.gs');
  const email=load('../integrations/google-apps-script/email-poller.gs');
  const smsFn=sms.slice(sms.indexOf('function kolSmsRespondToManualHealth_('),
    sms.indexOf('function kolSmsReceipt_('));
  const emailFn=email.slice(email.indexOf('function kolEmailRespondToManualHealth_('),
    email.indexOf('function forhåndsvisEpostEksempel('));
  assert.match(smsFn,/requestId === props\.getProperty\(KOL_SMS_LAST_HEALTH_REQUEST_KEY\)/);
  assert.match(emailFn,/requestId === props\.getProperty\(KOL_EMAIL_LAST_HEALTH_REQUEST_KEY\)/);
  assert.match(smsFn,/age > 5 \* 60 \* 1000/);
  assert.match(emailFn,/age > 5 \* 60 \* 1000/);
  assert.match(smsFn,/kolSmsHeartbeat_\(mode, Date\.now\(\), status, requestId\)/);
  assert.match(emailFn,/kolEmailHeartbeat_\(Date\.now\(\),state,requestId\)/);
  const smsPoll=sms.slice(sms.indexOf('function pollOrdersForSms()'),sms.indexOf('function setupTestSms()'));
  const emailPoll=email.slice(email.indexOf('function kontrollerEpostBestillinger()'),email.indexOf('function kontrollerEpostTestNaa()'));
  assert.doesNotMatch(smsPoll,/kolSmsHeartbeat_\(mode,/);
  assert.doesNotMatch(emailPoll,/kolEmailHeartbeat_\(now,/);
  assert.match(sms,/everyMinutes\(1\)/);
  assert.match(email,/everyMinutes\(1\)/);
});
