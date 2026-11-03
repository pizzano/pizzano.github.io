/* Pure core-module regressions: no Firebase, browser, printer, SMS or e-mail. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDataNormalizers, detectIngredientRules } from '../js/data-normalization.js';
import { restorePreviousOrderSelections } from '../js/order-product-summary.js';
import {
  emailReceiptKinds, emailReceiptSent, emailReceiptDetail,
  smsReceiptKinds, smsReceiptSentForOrders, smsReceiptDetailForOrders,
} from '../js/admin-health-policy.js';

function fixtureNormalizers() {
  let counter = 0;
  const weekdays = Array.from({length:7}, (_,i) => ({id:String(i)}));
  return createDataNormalizers({
    DEFAULT_SETTINGS: {
      weeklyHours:null, manualClosed:true, manualClosedUntil:0,
      customerPalette:'reference', prepMinutes:25, pickupLeadMinutes:30,
      busyExtraMinutes:15, pickupCapacityMax:4, slotIntervalMinutes:15,
      uiFontXs:10,uiFontSm:12,uiFontMd:14,uiFontLg:18,uiFontXl:22,
      printerQtySize:39, printerItemNameSize:35, printerSizeTextSize:28,
      printerExtraTextSize:22, printerPriceSize:24, printerSidePadding:5,
    },
    DEFAULT_ALLERGENS:[{id:'melk',label:'Melk'}],
    RESTAURANT_WEEKDAYS:weekdays,
    ORDER_STATUSES:[{id:'mottatt'},{id:'bekreftet'},{id:'klar'},{id:'avvist'}],
    SCHEMA_VERSION:6,
    asArray:value => Array.isArray(value) ? value.filter(x=>x!==null)
      : value && typeof value==='object' ? Object.values(value) : [],
    clone:value=>JSON.parse(JSON.stringify(value)),
    uid:prefix=>prefix+'_'+(++counter),
    validClock:value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value)) ? value : '',
    confirmationDeadline:order=>Number(order.confirmationDeadline)||0,
    buildIngredientRules:()=>[],
    detectIngredientRules:()=>[],
  });
}

test('order normalization keeps confirmed receipts, selection quantities and order chronology', () => {
  const { normalizeOrders } = fixtureNormalizers();
  const entries={
    old:{id:'old',status:'bekreftet',createdAt:100,total:240,
      smsReceipts:{accepted:{provider:'Traccar',state:'accepted',sentAt:150}},
      emailReceipts:{accepted:{provider:'MailApp',state:'accepted',sentAt:160}},
      lines:[{name:'Pizza',optionIds:['garlic','garlic'],selections:{sauce:['garlic','garlic']},
        optionDetails:[{label:'Hvitløksaus',groupTitle:'Saus',price:10}],quantity:1,price:240}]},
    new:{id:'new',status:'mottatt',createdAt:200,total:210,lines:[]},
  };
  const normalized=normalizeOrders(entries);
  assert.deepEqual(normalized.map(order=>order.id),['new','old']);
  assert.deepEqual(normalized[1].lines[0].optionIds,['garlic','garlic']);
  assert.deepEqual(normalized[1].lines[0].selections.sauce,['garlic','garlic']);
  assert.equal(normalized[1].smsReceipts.accepted.provider,'Traccar');
  assert.equal(normalized[1].emailReceipts.accepted.provider,'MailApp');
  assert.equal(normalized[1].subtotal,240);
});

test('normalization preserves preopening flags and rejects unrecognized statuses', () => {
  const { normalizeOrders }=fixtureNormalizers();
  const [record]=normalizeOrders([{
    id:'ord1',status:'unknown',confirmationNoTimeout:true,confirmationDeadline:0,
    pickup:'18:15',scheduledPickupAt:1800000000000,lines:[{itemId:'p1',quantity:2}],
  }]);
  assert.equal(record.status,'mottatt');
  assert.equal(record.confirmationNoTimeout,true);
  assert.equal(record.pickupMode,'scheduled');
  assert.equal(record.scheduledPickupAt,1800000000000);
  assert.equal(record.lines[0].quantity,2);
});

test('restaurant settings still normalize weekly schedule, limits and manual closure', () => {
  const { normalizeSettings }=fixtureNormalizers();
  const settings=normalizeSettings({
    pickupLeadMinutes:5,manualClosedUntil:-100,customerPalette:'invalid',
    weeklyHours:Array.from({length:7},()=>({open:'99:99',close:'22:00'})),
  });
  assert.equal(settings.manualClosed,false);
  assert.equal(settings.manualClosedUntil,0);
  assert.equal(settings.pickupLeadMinutes,15);
  assert.equal(settings.customerPalette,'reference');
  assert.equal(settings.weeklyHours.length,7);
  assert.equal(settings.weeklyHours[0].open,'14:00');
});

test('font-size normalization preserves older four-key settings and adds XL', () => {
  const { normalizeSettings }=fixtureNormalizers();
  const old=normalizeSettings({uiFontXs:10,uiFontSm:11,uiFontMd:12,uiFontLg:13});
  assert.deepEqual(
    [old.uiFontXs,old.uiFontSm,old.uiFontMd,old.uiFontLg,old.uiFontXl],
    [10,11,12,13,22]
  );
  const updated=normalizeSettings({uiFontXs:8,uiFontSm:12,uiFontMd:18,uiFontLg:24,uiFontXl:50});
  assert.equal(updated.uiFontXl,36,'out-of-range values are clamped');
  assert.equal(updated.uiFontMd,18);
});

test('menu state normalizer keeps repeatable sauce cap and valid references', () => {
  const { normalizeState }=fixtureNormalizers();
  const state=normalizeState({
    settings:{},
    optionGroups:[{id:'sauce',allowQuantity:true,selectionMode:'multiple',maxSelections:12,
      options:[{id:'garlic',label:'Hvitløksaus',price:15}]}],
    sections:[{id:'pizza',title:'Pizza',items:[{
      id:'p1',name:'Pizza',sizes:[{id:'big',label:'Stor',price:239,optionGroupIds:['sauce']}],
      optionGroupIds:['missing'],allergens:['melk'],
    }]}],
    popularItemIds:['p1','missing'],
  });
  assert.equal(state.schemaVersion,6);
  assert.equal(state.optionGroups[0].maxSelections,12);
  assert.deepEqual(state.sections[0].items[0].optionGroupIds,[]);
  assert.deepEqual(state.sections[0].items[0].sizes[0].optionGroupIds,['sauce']);
  assert.deepEqual(state.popularItemIds,['p1']);
  assert.deepEqual(state.sections[0].items[0].allergens,['melk']);
});

test('repeatable sauce servings survive reordering from compact order history', () => {
  const item={sizes:[{id:'big',label:'Stor'}]};
  const group={id:'sauce',allowQuantity:true,selectionMode:'multiple',maxSelections:4,
    options:[{id:'garlic',label:'Hvitløksaus'},{id:'bearnaise',label:'Béarnaisesaus'}]};
  const lines={size:'Stor',optionIds:['garlic','garlic','bearnaise']};
  const selected=restorePreviousOrderSelections(item,lines,(_item,sizeId)=>{
    assert.equal(sizeId,'big');
    return [group];
  });
  assert.deepEqual(selected.sauce,['garlic','garlic','bearnaise']);
  const explicit=restorePreviousOrderSelections(item,{
    size:'Stor',selections:{sauce:['garlic','garlic','invalid']},
  },()=>[group]);
  assert.deepEqual(explicit.sauce,['garlic','garlic']);
});

test('mail badge requires MailApp receipt and never trusts only order status', () => {
  const order={status:'bekreftet',createdAt:1000};
  assert.equal(emailReceiptSent(order),false);
  assert.match(emailReceiptDetail(order),/ikke bekreftet/);
  assert.equal(emailReceiptKinds({...order,emailReceipts:{
    accepted:{state:'accepted',provider:'Traccar',sentAt:1100}}}).accepted,false);
  const confirmed={...order,emailReceipts:{
    accepted:{state:'accepted',provider:'MailApp',sentAt:1100}}};
  assert.equal(emailReceiptSent(confirmed),true);
  assert.match(emailReceiptDetail(confirmed),/Bekreftelse/);
});

test('SMS badge requires Traccar acknowledgement on matching order', () => {
  const now=Date.now();
  const order={id:'ordA',createdAt:now-5000,
    smsReceipts:{accepted:{state:'accepted',provider:'Traccar',sentAt:now}}};
  const invalid={...order,smsReceipts:{
    accepted:{state:'accepted',provider:'MailApp',sentAt:now}}};
  assert.equal(smsReceiptKinds(order).accepted,true);
  assert.equal(smsReceiptKinds(invalid).accepted,false);
  assert.equal(smsReceiptSentForOrders('ordA',[order]),true);
  assert.equal(smsReceiptSentForOrders('missing',[order]),false);
  assert.match(smsReceiptDetailForOrders('ordA',[order]),/Bekreftelse/);
  assert.equal(smsReceiptDetailForOrders('missing',[order]),'');
});

test('extracted modules remain pure and core entry points call them', () => {
  const root=name=>readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
  const extracted=root('data-normalization.js');
  assert.doesNotMatch(extracted, /\bfetch\s*\(|window\.|localStorage\.|DB_URL/);
  assert.match(root('data.js'), /createDataNormalizers\(\{/);
  assert.match(root('customer.js'), /restorePreviousOrderSelections\(item, line, getItemOptionGroups\)/);
  assert.match(root('admin.js'), /smsReceiptSentForOrders\(id, getOrders\(\)\)/);
});

test('ingredient detection stays conservative after consolidation', () => {
  const names = detectIngredientRules('Pizza med pepperoni, rødløk og ost').map(item => item.name.toLocaleLowerCase('no'));
  assert.ok(names.includes('pepperoni'));
  assert.ok(names.includes('rødløk'));
  assert.ok(names.includes('ost'));
  assert.ok(!names.includes('løk'), 'Overlapping rødløk must not generate a second løk removal');
  assert.deepEqual(detectIngredientRules('Biff eller kylling'), []);
});
