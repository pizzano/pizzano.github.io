import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePickupSlots } from '../js/pickup-slots.js';

function slots(nowMinute, minutesToClose, lead = 30) {
  return calculatePickupSlots({
    open: true, nowMinute, minutesToClose,
    pickupLeadMinutes: lead,
  }).map(slot => slot.value);
}

test('21:10 with 22:00 closing allows 21:45 pickup with 30-min minimum', () => {
  assert.deepEqual(slots(21*60+10,50), ['21:45']);
});
test('first pickup is rounded to next quarter-hour', () => {
  assert.equal(slots(18*60+1,239,30)[0], '18:45');
  assert.deepEqual(slots(19*60,180,30).slice(0,3), ['19:30','19:45','20:00']);
});
test('60-minute minimum is independent of closing buffer', () => {
  assert.equal(slots(19*60+10,170,60)[0], '20:15');
});
