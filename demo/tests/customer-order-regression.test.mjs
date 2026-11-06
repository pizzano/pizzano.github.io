/* Offline-only order-flow regression checks.
 * Run from repository root: node --test demo/tests/customer-order-regression.test.mjs
 * Never contacts Firebase, sends messages, accepts orders or prints tickets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmationDeadline, confirmationExpired, confirmationRemaining, ORDER_CONFIRM_WAIT_MS } from '../js/order-confirmation.js';
import { sortCartByCategory, getDisplayComment } from '../js/order-product-summary.js';
import { loyaltyPhone, pizzaBonus, largePizza, automaticPizzaIndex, historicalPizzaEvents } from '../js/loyalty.js';

const src = name => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('pending orders expire at exactly three minutes, not sooner', () => {
  const createdAt = 1_800_000_000_000;
  const order = { status: 'mottatt', createdAt };
  assert.equal(ORDER_CONFIRM_WAIT_MS, 180000);
  assert.equal(confirmationDeadline(order), createdAt + ORDER_CONFIRM_WAIT_MS);
  assert.equal(confirmationRemaining(order, createdAt), '3:00');
  assert.equal(confirmationExpired(order, createdAt + ORDER_CONFIRM_WAIT_MS - 1), false);
  assert.equal(confirmationExpired(order, createdAt + ORDER_CONFIRM_WAIT_MS), true);
  assert.equal(confirmationExpired({ ...order, status: 'bekreftet' }, createdAt + 200000), false);
});

test('pre-opening orders have no automatic confirmation timeout', () => {
  const order = { status: 'mottatt', createdAt: 1800000000000, confirmationNoTimeout: true };
  assert.equal(confirmationDeadline(order), 0);
  assert.equal(confirmationExpired(order, order.createdAt + 3600000), false);
  assert.equal(confirmationRemaining(order, order.createdAt), 'Uten tidsfrist');
});

test('cart lines sort by menu category without losing order within a category', () => {
  const sections = [
    { id: 'pizza', items: [{ id: 'p1' }, { id: 'p2' }] },
    { id: 'burger', items: [{ id: 'b1' }] },
  ];
  const cart = [{ itemId: 'b1' }, { itemId: 'p2' }, { itemId: 'p1' }, { itemId: 'unknown' }];
  assert.deepEqual(sortCartByCategory(cart, sections).map(v => v.itemId),
    ['p2', 'p1', 'b1', 'unknown']);
  assert.deepEqual(cart.map(v => v.itemId), ['b1', 'p2', 'p1', 'unknown']);
});

test('Norwegian phone normalization and pizza classification stay stable', () => {
  assert.equal(loyaltyPhone('+47 41 22 33 44'), '41223344');
  assert.equal(loyaltyPhone('0047 91 22 33 44'), '91223344');
  assert.equal(loyaltyPhone('123'), '');
  assert.equal(largePizza({ type: 'pizza' }, 'Stor'), true);
  assert.equal(largePizza({ type: 'burger' }, 'Stor'), false);
});

test('ten pizzas unlock the reward, confirmed redemption resets the cycle', () => {
  const events = Object.fromEntries(Array.from({ length: 10 }, (_, i) =>
    ['order' + i, { id: 'order' + i, at: i + 1, quantity: 1, redeemed: false }]));
  assert.deepEqual(pizzaBonus(events), { count: 10, cycle: 'start', ready: true });
  events.redeem = { id: 'redeem', at: 11, quantity: 1, redeemed: true };
  assert.deepEqual(pizzaBonus(events), { count: 0, cycle: 'redeem', ready: false });
});

test('free-pizza suggestion picks the cheapest eligible pizza', () => {
  const lines = [
    { eligible: true, quantity: 1, basePrice: 260 },
    { eligible: true, quantity: 1, basePrice: 210 },
    { eligible: false, quantity: 1, basePrice: 10 },
  ];
  assert.equal(automaticPizzaIndex(lines, 9), 1);
  assert.equal(automaticPizzaIndex(lines, 2), -1);
});

test('loyalty history counts only confirmed orders', () => {
  const sections = [{ type: 'pizza', title: 'Pizza', items: [{ id: 'p1' }] }];
  const orders = [
    { id: 'pending', status: 'mottatt', phone: '41223344', lines: [{ itemId: 'p1', size: 'Stor', quantity: 3 }] },
    { id: 'accepted', status: 'bekreftet', phone: '+4741223344', createdAt: 4, total: 250, lines: [{ itemId: 'p1', size: 'Stor', quantity: 2 }] },
  ];
  const events = historicalPizzaEvents(orders, '41223344', sections);
  assert.equal(events.pending, undefined);
  assert.equal(events.accepted.quantity, 2);
});

test('create-only Firebase write and unknown-response retry contract still exist', async () => {
  const data = await src('js/data.js');
  const customer = await src('js/customer.js');
  assert.match(data, /'if-match': 'null_etag'/);
  assert.match(data, /response\.status === 412/);
  assert.match(data, /JSON\.stringify\(existing\.lines\) !== JSON\.stringify\(record\.lines\)/);
  assert.match(customer, /id: ui\.pendingOrderId/);
  const retry = customer.slice(customer.indexOf('  try {\n    order = await submitOrder('));
  assert.match(retry, /catch \(err\) \{[\s\S]*?ui\.orderSendFailed = true/);
  assert.match(retry, /ui\.pendingOrderId = null/);
  assert.ok(retry.indexOf('ui.pendingOrderId = null') > retry.indexOf('catch (err)'));
});

test('offline protection stops sending before bonus reservation', async () => {
  const data = await src('js/data.js');
  const customer = await src('js/customer.js');
  assert.ok(data.indexOf('if (navigator.onLine === false)') < data.indexOf('await reservePizzaReward(record)'));
  const submit = customer.slice(customer.indexOf('async function placeOrder() {'));
  assert.ok(submit.indexOf('if (navigator.onLine === false)') < submit.indexOf('bonusState = await getPizzaBonus(phone, { fresh: true })'));
  assert.match(customer, /window\.addEventListener\('offline', updateConnectionNotice\)/);
});

test('pickup intervals and staff acceptance/notifications/printing remain wired', async () => {
  const data = await src('js/data.js');
  const admin = await src('js/admin.js');
  const slots = await src('js/pickup-slots.js');
  assert.match(data, /calculatePickupSlots\(\{/);
  assert.match(slots, /interval = 15/);
  assert.match(slots, /pickupLeadMinutes = 30/);
  assert.match(slots, /closeMinute <= openMinute/);
  assert.match(admin, /data-accept-inline/);
  assert.match(admin, /acceptOrderWithEstimate/);
  assert.match(admin, /printOrderFromAdmin/);
  assert.match(admin, /smsReceiptSent/);
  assert.match(admin, /emailReceiptSent/);
});

test('saved order comments hide duplicated automatic ingredient removals', () => {
  assert.equal(getDisplayComment({ removedIngredients:['Løk'], comment:'Uten løk\nEkstra sterk' }), 'Ekstra sterk');
  assert.equal(getDisplayComment({ removedIngredients:['Ost'], comment:'Uten ost' }), '');
  assert.equal(getDisplayComment({ removedIngredients:[], comment:'Lite salt' }), 'Lite salt');
});
