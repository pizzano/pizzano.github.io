import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePickupSlots } from '../js/pickup-slots.js';

const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../js/admin.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');

test('orders can select 21:45 pickup at 21:10 when closing at 22:00', () => {
  const slots = calculatePickupSlots({
    open:true, nowMinute:21*60+10, minutesToClose:50, pickupLeadMinutes:30,
  });
  assert.deepEqual(slots.map(slot => slot.value), ['21:45']);
});

test('pickup times use 15-minute slots and stop before closing', () => {
  const slots = calculatePickupSlots({
    open:true, nowMinute:20*60+10, minutesToClose:110, pickupLeadMinutes:30,
  }).map(slot => slot.value);
  assert.deepEqual(slots.slice(0,3), ['20:45','21:00','21:15']);
  assert.equal(slots.at(-1), '21:45');
});

test('prep display and minimum pickup wait remain separate settings', () => {
  assert.match(data, /prepMinutes: 25/);
  assert.match(data, /pickupLeadMinutes: 30/);
  assert.match(data, /pickupLeadMinutes: effectivePickupLead\(settings\)/);
  assert.match(admin, /prepMinutes: \$\('sPrepMinutes'\)/);
  assert.match(html, /id="sPrepMinutes"/);
  assert.match(html, /id="sPickupLeadMinutes"/);
});
