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
