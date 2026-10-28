import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSoundPendingOrder } from '../js/order-alarm.js';
const at = 1_000_000;
test('preopening order stays silent before opening and becomes audible at opening', () => {
  const order = { status:'mottatt', confirmationNoTimeout:true, createdAt:at-3600000 };
  assert.equal(shouldSoundPendingOrder(order,false,at),false);
  assert.equal(shouldSoundPendingOrder(order,true,at),true);
  assert.equal(shouldSoundPendingOrder(order,true,at+10*60000),true);
});
test('approved or rejected preorders never trigger the alarm', () => {
  for (const status of ['bekreftet','tilberedning','klar','avvist']) {
    assert.equal(shouldSoundPendingOrder({status,confirmationNoTimeout:true},true,at),false);
  }
});
test('normal orders sound during the three-minute deadline but not after expiry', () => {
  const order={status:'mottatt',createdAt:at};
  assert.equal(shouldSoundPendingOrder(order,true,at+179999),true);
  assert.equal(shouldSoundPendingOrder(order,true,at+180000),false);
});
test('preorders do not acquire a three-minute deadline when restaurant opens', () => {
  const order={status:'mottatt',createdAt:at,confirmationNoTimeout:true,confirmationDeadline:0};
  assert.equal(shouldSoundPendingOrder(order,true,at+24*3600000),true);
});
