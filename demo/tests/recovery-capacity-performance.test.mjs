/* Offline-only unit tests. No Firebase writes or customer personal data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingOrderIdFor, readPendingIntent, clearPendingIntent, fingerprintHash } from '../js/order-recovery.js';
import { publicPickupLoad, pickupSlotKey, pickupLoadFresh, capacityFilteredSlots,
  effectivePickupLead, busyAcceptMinutes } from '../js/pickup-capacity.js';
import { recordDuration, metricSummary, clearMetrics } from '../js/performance-metrics.js';
import { readFile } from 'node:fs/promises';

function memoryStorage() {
  const data=new Map();
  return {
    getItem:key=>data.get(key)||null,
    setItem:(key,value)=>{data.set(key,value);},
    removeItem:key=>{data.delete(key);},
    dump:()=>[...data.entries()],
  };
}
const mockCrypto={
  subtle:{async digest(name,bytes){
    assert.equal(name,'SHA-256');
    // Deterministic 32-byte fake for logic tests; NOT used in production.
    const result=new Uint8Array(32);
    result.fill(bytes[0]||0);
    return result.buffer;
  }},
};
const at=Date.now(); // Keep mock IDs within the real 24-hour retry window.

test('25: same intent after reload keeps the same opaque Firebase order ID',async()=>{
  const storage=memoryStorage();
  let calls=0;
  const makeId=()=>{calls++;return 'ord_abcdefgh12345';};
  const first=await pendingOrderIdFor('basket+phone',makeId,storage,at,mockCrypto);
  const retry=await pendingOrderIdFor('basket+phone',makeId,storage,at+120000,mockCrypto);
  assert.equal(first,retry);
  assert.equal(calls,1);
  assert.equal(storage.dump().length,1);
  assert.ok(!JSON.stringify(storage.dump()).includes('basket+phone'));
  assert.ok(!JSON.stringify(storage.dump()).includes('phone'));
  clearPendingIntent(first,storage);
  assert.equal(storage.dump().length,0);
});

test('25: modified cart/contact creates a different retry ID',async()=>{
  const storage=memoryStorage();
  let i=0;
  const makeId=()=> 'ord_abcde'+(++i)+'qwerty12';
  const initial=await pendingOrderIdFor('alpha',makeId,storage,at,mockCrypto);
  const changed=await pendingOrderIdFor('beta',makeId,storage,at+100,mockCrypto);
  assert.notEqual(initial,changed);
  assert.equal(i,2);
});

test('25: stale, invalid and inaccessible storage never reuses an old ID',async()=>{
  const storage=memoryStorage();
  storage.setItem('kol_pending_order_intent_v1',JSON.stringify({
    id:'ord_abcdefgh12345',hash:'a'.repeat(64),at:at-86400001,
  }));
  assert.equal(readPendingIntent(storage,at),null);
  const noStorage={
    getItem(){throw new Error('blocked');},
    setItem(){throw new Error('blocked');},
    removeItem(){throw new Error('blocked');},
  };
  const result=await pendingOrderIdFor('alpha',()=>'ord_abcdefgh12345',noStorage,at,mockCrypto);
  assert.equal(result,'ord_abcdefgh12345');
  assert.equal(await fingerprintHash('alpha',{subtle:null}),null);
});

test('26: busy mode is opt-in and adds bounded lead time',()=>{
  assert.equal(effectivePickupLead({pickupLeadMinutes:30}),30);
  assert.equal(effectivePickupLead({pickupLeadMinutes:30,busyExtraMinutes:45}),30);
  assert.equal(effectivePickupLead({pickupLeadMinutes:30,busyModeEnabled:true,busyExtraMinutes:45}),75);
  assert.equal(effectivePickupLead({pickupLeadMinutes:200,busyModeEnabled:true,busyExtraMinutes:90}),240);
  assert.equal(busyAcceptMinutes({busyModeEnabled:true,busyExtraMinutes:20}),35);
  assert.equal(busyAcceptMinutes({busyModeEnabled:false,busyExtraMinutes:20}),15);
});

test('27: aggregate pickup load contains counts only, never order IDs or contact details',()=>{
  const at=Date.parse('2026-11-03T14:00:00Z');
  const scheduledPickupAt=Date.parse('2026-11-03T17:15:00Z');
  const source=[
    {id:'private123',phone:'41145353',customerName:'Private Name',status:'mottatt',
      scheduledPickupAt,confirmationDeadline:at+180000},
    {id:'private456',email:'private@example.test',status:'bekreftet',scheduledPickupAt},
    {id:'other',status:'avvist',scheduledPickupAt},
  ];
  const snapshot=publicPickupLoad(source,at);
  assert.deepEqual(snapshot.slots,{'20261103_1815':2});
  assert.doesNotMatch(JSON.stringify(snapshot),/private|41145353|@/);
});

test('27: expired pending orders do not fill scheduled capacity',()=>{
  const at=Date.parse('2026-11-03T14:00:00Z');
  const pickup=Date.parse('2026-11-03T17:15:00Z');
  const result=publicPickupLoad([{status:'mottatt',scheduledPickupAt:pickup,
    confirmationDeadline:at-1}],at);
  assert.deepEqual(result.slots,{});
});

test('27: fresh full quarter-hour hidden only if opted in',()=>{
  const at=Date.parse('2026-11-03T17:05:00Z'); // 18:05 in Oslo
  const slots=[{value:'18:15',label:'18:15'},{value:'18:30',label:'18:30'}];
  const snapshot={updatedAt:at,slots:{'20261103_1815':4}};
  assert.equal(pickupLoadFresh(snapshot,at),true);
  assert.equal(capacityFilteredSlots(slots,{pickupCapacityEnabled:true,pickupCapacityMax:4},
    snapshot,{at}).length,1);
  assert.deepEqual(capacityFilteredSlots(slots,{pickupCapacityEnabled:false,pickupCapacityMax:4},
    snapshot,{at}),slots);
  assert.deepEqual(capacityFilteredSlots(slots,{pickupCapacityEnabled:true,pickupCapacityMax:4},
    snapshot,{at:at+180000}),slots);
});

test('27: a pickup after midnight belongs to the next Oslo-local date',()=>{
  const at=Date.parse('2026-11-03T22:35:00Z'); // 23:35 Oslo
  assert.equal(pickupSlotKey('00:15',{at}), '20261104_0015');
  assert.equal(pickupSlotKey('23:45',{at}), '20261103_2345');
});

test('30: performance metrics are bounded and contain no customer identifiers',()=>{
  try {
    clearMetrics();
    recordDuration('menu_render',100,118);
    recordDuration('menu_render',120,155);
    recordDuration('not_an_allowed_key',10,100);
    recordDuration('order_submit',100,61010); // ignored: >60 sec
    const entry=metricSummary().find(item=>item.key==='menu_render');
    assert.equal(entry.samples,2);
    assert.equal(entry.avg,27);
    assert.equal(entry.p95,35);
    assert.equal(metricSummary().length,7);
  }finally{clearMetrics();}
});

test('integration: customer/admin and helper modules retain safe order protections',async()=>{
  const [customer,data,admin,worker]=await Promise.all([
    'js/customer.js','js/data.js','js/admin.js','js/pickup-load-admin.js',
  ].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')));
  assert.match(customer,/pendingOrderIdFor\(/);
  assert.match(customer,/clearPendingIntent\(order\.id\)/);
  assert.match(customer,/placeOrderLocked/);
  assert.match(data,/'if-match': 'null_etag'/);
  assert.match(data,/capacityFilteredSlots\(/);
  assert.match(admin,/busyAcceptMinutes\(store\.settings\)/);
  assert.match(worker,/publicPickupLoad\(getOrders\(\)/);
  assert.match(worker,/publicPickupLoad\.json/);
});

test('pickup load heartbeat sends only sparse unchanged updates', async () => {
  const source=await readFile(new URL('../js/pickup-load-admin.js',import.meta.url),'utf8');
  assert.match(source,/CAPACITY_HEARTBEAT_MS = 150 \* 1000/);
  assert.match(source,/CAPACITY_TIMER_MS = 60 \* 1000/);
  assert.match(source,/slots === lastSlots && Date\.now\(\) - lastSuccess < CAPACITY_HEARTBEAT_MS/);
  assert.match(source,/subscribe\(queue\)/);
  assert.match(source,/window\.setInterval\(queue, CAPACITY_TIMER_MS\)/);
  assert.equal(pickupLoadFresh({updatedAt:100000,slots:{}},100000+235000),true);
  assert.equal(pickupLoadFresh({updatedAt:100000,slots:{}},100000+240000),false);
});
