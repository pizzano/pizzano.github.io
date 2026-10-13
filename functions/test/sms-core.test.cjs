'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notificationKind, norwegianMobile, pickupLabel, smsText, validGatewayResponse } = require('../sms-core.cjs');

test('only accepts the two intended transitions', () => {
  assert.equal(notificationKind({ status: 'mottatt' }, { status: 'bekreftet' }), 'accepted');
  assert.equal(notificationKind({ status: 'bekreftet' }, { status: 'klar' }), 'ready');
  assert.equal(notificationKind({ status: 'tilberedning' }, { status: 'klar' }), 'ready');
  assert.equal(notificationKind({ status: 'mottatt' }, { status: 'klar' }), null);
  assert.equal(notificationKind({ status: 'klar' }, { status: 'fullfort' }), null);
  assert.equal(notificationKind({ status: 'bekreftet' }, { status: 'bekreftet' }), null);
});

test('normalizes Norwegian mobiles only', () => {
  assert.equal(norwegianMobile('955 57 474'), '+4795557474');
  assert.equal(norwegianMobile('+47 955 57 474'), '+4795557474');
  assert.equal(norwegianMobile('0047 95557474'), '+4795557474');
  assert.equal(norwegianMobile('41145353'), '+4741145353');
  assert.equal(norwegianMobile('+4712345678'), null);
  assert.equal(norwegianMobile(''), null);
});

test('formats future pickup time in Norwegian local timezone', () => {
  const at = Date.parse('2026-10-14T17:30:00+02:00');
  const value = pickupLabel({ scheduledPickupAt: at, pickup: '19:30', pickupMode: 'scheduled' });
  assert.match(value, /17:30/);
});

test('messages are different and contain correct order summary', () => {
  const order = {
    id: 'order-J2R5GS', status: 'bekreftet', customerName: 'Fatih Alemdar',
    scheduledPickupAt: Date.parse('2026-10-14T19:30:00+02:00'),
  };
  assert.match(smsText(order, 'accepted'), /bekreftet/);
  assert.match(smsText(order, 'accepted'), /19:30/);
  assert.match(smsText(order, 'ready'), /klar for henting/);
  assert.match(smsText(order, 'ready'), /#J2R5GS/);
});

test('checks body even when HTTP response is 200', () => {
  assert.equal(validGatewayResponse(200, { successCount: 0, failureCount: 1 }), false);
  assert.equal(validGatewayResponse(200, { successCount: 1, failureCount: 0 }), true);
  assert.equal(validGatewayResponse(401, { successCount: 1, failureCount: 0 }), false);
});
