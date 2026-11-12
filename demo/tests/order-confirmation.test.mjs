import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationDeadline, confirmationExpired, confirmationRemaining, ORDER_CONFIRM_WAIT_MS, customerPageBaseUrl, customerOrderLink } from '../js/order-confirmation.js';

test('normal order expires exactly after three minutes', () => {
  const order = { id:'test-1', status:'mottatt', createdAt: 1000000 };
  assert.equal(ORDER_CONFIRM_WAIT_MS,180000);
  assert.equal(confirmationDeadline(order),1180000);
  assert.equal(confirmationExpired(order,1179999),false);
  assert.equal(confirmationExpired(order,1180000),true);
  assert.equal(confirmationRemaining(order,1000000),'3:00');
});
test('preopening order never expires even many hours later', () => {
  const order={id:'test-2',status:'mottatt',createdAt:1000000,confirmationNoTimeout:true,confirmationDeadline:0};
  assert.equal(confirmationDeadline(order),0);
  assert.equal(confirmationExpired(order,100000000),false);
  assert.equal(confirmationRemaining(order,100000000),'Uten tidsfrist');
});
test('an accepted or rejected order is not pending expiry', () => {
  for (const status of ['bekreftet','klar','avvist']) {
    assert.equal(confirmationExpired({status,createdAt:1000000},1300000),false);
  }
});
test('explicit deadline is respected for ordinary orders', () => {
  const order={status:'mottatt',createdAt:1000000,confirmationDeadline:1250000};
  assert.equal(confirmationExpired(order,1190000),false);
  assert.equal(confirmationExpired(order,1250000),true);
});

test('order links follow the real shop directory without hardcoded /demo/ paths', () => {
  assert.equal(customerPageBaseUrl('https://example.test/shop/admin.html?tab=orders'), 'https://example.test/shop/');
  assert.equal(customerPageBaseUrl('https://example.test/demo/'), 'https://example.test/demo/');
  assert.equal(customerOrderLink('ord_abcdefg', 'https://example.test/shop/admin.html'),
    'https://example.test/shop/?order=ord_abcdefg');
  assert.throws(() => customerOrderLink('other', 'https://example.test/shop/'));
  assert.throws(() => customerPageBaseUrl('file:///tmp/index.html'));
});

test('optional server expiry worker validates deadlines and uses conditional Firebase writes', async () => {
  const {readFileSync}=await import('node:fs');
  const script=readFileSync(new URL('../integrations/google-apps-script/Kode.gs',import.meta.url),'utf8');
  const start=script.indexOf('function kolExpirePendingOrders()');
  const body=script.slice(start);
  assert.ok(start>0);
  assert.match(body,/function kolInstallExpiryTrigger\(\)/);
  assert.match(body,/function kolRemoveExpiryTrigger\(\)/);
  assert.match(body,/confirmationNoTimeout===true/);
  assert.match(body,/current\.status!=='mottatt'/);
  assert.match(body,/'X-Firebase-ETag':'true'/);
  assert.match(body,/'if-match':String\(etag\)/);
  assert.match(body,/update\.getResponseCode\(\)!==412/);
  assert.match(body,/everyMinutes\(1\)/);
});
