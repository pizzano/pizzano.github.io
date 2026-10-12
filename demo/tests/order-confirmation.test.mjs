import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationDeadline, confirmationExpired, confirmationRemaining } from '../js/order-confirmation.js';
test('Customer and admin share the original three minute deadline', () => {
  const order = { createdAt: 1000, status: 'mottatt' };
  assert.equal(confirmationDeadline(order), 181000);
  assert.equal(confirmationRemaining(order, 1000), '3:00');
  assert.equal(confirmationRemaining(order, 17000), '2:44');
  assert.equal(confirmationRemaining(order, 181000), '0:00');
  assert(confirmationExpired(order, 181000));
  assert(!confirmationExpired(order, 180999));
});
test('Explicit deadlines persist across reopening and accepted orders never expire', () => {
  const order = { createdAt: 1000, confirmationDeadline: 200000, status: 'mottatt' };
  assert.equal(confirmationDeadline(order), 200000);
  for (const status of ['bekreftet', 'tilberedning', 'klar', 'avvist', 'fullfort']) assert(!confirmationExpired({ ...order, status }, 300000));
  assert(!confirmationExpired({ status: 'mottatt' }, 300000));
});
