import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationDeadline, confirmationExpired, confirmationRemaining, ORDER_CONFIRM_WAIT_MS } from '../js/order-confirmation.js';

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
