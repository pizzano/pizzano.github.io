/* All times are restaurant-local minutes; no Firebase or clock mocking needed.
 * These tests cover the real function used by getPickupSlots(). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePickupSlots } from '../js/pickup-slots.js';

const minutes = clock => {
  const [hour, minute] = clock.split(':').map(Number);
  return hour * 60 + minute;
};
const values = config => calculatePickupSlots(config).map(slot => slot.value);
const opening = (open, close, lead = 30) => ({
  preOpen: true, openMinute: minutes(open), closeMinute: minutes(close),
  pickupLeadMinutes: lead,
});
const trading = (now, close, lead = 30) => ({
  open: true, nowMinute: minutes(now),
  minutesToClose: (minutes(close) - minutes(now) + 1440) % 1440,
  pickupLeadMinutes: lead,
});

test('pre-opening 12–22 includes each 15-minute slot through 21:45 (Vis mer)', () => {
  const all = values(opening('12:00','22:00'));
  assert.equal(all[0], '12:30');
  assert.equal(all.at(-1), '21:45');
  assert.ok(all.length > 20);
  assert.equal(all.length, new Set(all).size);
  for (const value of all) assert.equal(minutes(value) % 15, 0);
});
test('21:10 with 22:00 closing offers exactly 21:45', () => {
  assert.deepEqual(values(trading('21:10','22:00')), ['21:45']);
});
test('21:29 with 22:00 closing offers no pickup after closing buffer', () => {
  assert.deepEqual(values(trading('21:29','22:00')), []);
});
test('closed days and expired hours offer no slots', () => {
  assert.deepEqual(values({open:false, preOpen:false,nowMinute:900}), []);
  assert.deepEqual(values({open:true, nowMinute:1320, minutesToClose:0}), []);
});
test('one hour prep moves first selectable slot to 13:00', () => {
  const all = values(opening('12:00', '22:00',60));
  assert.equal(all[0], '13:00');
});
test('cross-midnight opening, 23:30–01:00, produces next-day clock slots', () => {
  const all = values(opening('23:30','01:00'));
  assert.deepEqual(all, ['00:00','00:15','00:30','00:45']);
});
test('after midnight, closing at 02:00 still respects 30-minute preparation', () => {
  assert.deepEqual(values({open:true,nowMinute:15,minutesToClose:105}),
    ['00:45','01:00','01:15','01:30','01:45']);
});
test('overnight 23:25 opening to 01:00 works across the date boundary', () => {
  assert.deepEqual(values(trading('23:25','01:00')), ['00:00','00:15','00:30','00:45']);
});
test('limit never generates more than 96 entries', () => {
  const all = values({open:true,nowMinute:0,minutesToClose:1600,pickupLeadMinutes:15});
  assert.ok(all.length <= 96);
});
test('pre-opening without valid weekly hours cannot invent pickup times', () => {
  assert.deepEqual(values({preOpen:true,openMinute:null,closeMinute:null}), []);
});

test('00:00–opening permits advance orders, but first pickup follows opening + minimum lead', () => {
  const midnight = values({
    open:false, preOpen:true, nowMinute:0,
    openMinute:minutes('12:00'), closeMinute:minutes('22:00'),
    pickupLeadMinutes:30
  });
  const afterMidnight = values({
    open:false, preOpen:true, nowMinute:minutes('00:05'),
    openMinute:minutes('12:00'), closeMinute:minutes('22:00'),
    pickupLeadMinutes:30
  });
  assert.equal(midnight[0], '12:30');
  assert.deepEqual(afterMidnight, midnight);
  assert.equal(midnight.at(-1), '21:45');
  assert.ok(midnight.every(clock => minutes(clock) >= minutes('12:30')));
});
