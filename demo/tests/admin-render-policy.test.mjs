/* Only the selected admin section should change after a Firebase event.
 * Pure scheduling and DOM memoization tests; no Firebase or printing requests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  adminDataSignatures, adminRenderChanges, createMarkupUpdater,
} from '../js/admin-render-policy.js';

const base = () => ({
  sections: [{ id:'pizza', items:[{ id:'p1', name:'Pizza' }] }],
  optionGroups: [], allergenCatalog: [],
  popularItemIds: ['p1'], settings: { restaurantName:'KØL' },
  updatedAt: 1234,
  orders: [{ id:'o1', status:'mottatt', total:210, customerName:'Kari' }],
});

test('first render and manual navigation must render full view', () => {
  const state = adminDataSignatures(base());
  assert.deepEqual(adminRenderChanges(null,state,'remote'),
    {menu:true,orders:true,stats:true});
  assert.deepEqual(adminRenderChanges(state,state,'manual'),
    {menu:true,orders:true,stats:true});
  assert.deepEqual(adminRenderChanges(state,state,'local'),
    {menu:true,orders:true,stats:true});
});

test('a Firebase order-only update never rebuilds the product/settings editor', () => {
  const before=base();
  const after=base();
  after.orders[0].status='bekreftet';
  const dirty=adminRenderChanges(
    adminDataSignatures(before),adminDataSignatures(after),'remote');
  assert.deepEqual(dirty,{menu:false,orders:true,stats:true});
});

test('a menu-only update leaves the live order snapshot intact but refreshes product data', () => {
  const before=base();
  const after=base();
  after.sections[0].items[0].name='Pizza Stor';
  const dirty=adminRenderChanges(
    adminDataSignatures(before),adminDataSignatures(after),'remote');
  assert.deepEqual(dirty,{menu:true,orders:false,stats:true});
});

test('order receipts and customer details are considered relevant order changes', () => {
  const before=base();
  const after=base();
  after.orders[0].smsReceipts={confirmation:{state:'accepted'}};
  assert.equal(adminRenderChanges(
    adminDataSignatures(before),adminDataSignatures(after),'remote').orders,true);
  after.orders[0].total=239;
  assert.equal(adminRenderChanges(
    adminDataSignatures(before),adminDataSignatures(after),'remote').orders,true);
});

test('duplicate remote snapshots never trigger expensive sections or stats', () => {
  const before=adminDataSignatures(base());
  assert.deepEqual(adminRenderChanges(before, adminDataSignatures(base()),'remote'),
    {menu:false,orders:false,stats:false});
});

test('unchanged card and order HTML is not replaced, preserving scroll and focus', () => {
  const set = createMarkupUpdater();
  const node={writes:0,html:'',scrollTop:42,
    set innerHTML(html){this.writes++;this.html=html;},
    get innerHTML(){return this.html;}};
  assert.equal(set(node,'<p>Ny ordre</p>'),true);
  const preservedChild={name:'focused'};
  node.child=preservedChild;
  assert.equal(set(node,'<p>Ny ordre</p>'),false);
  assert.equal(node.writes,1);
  assert.equal(node.child,preservedChild);
  assert.equal(node.scrollTop,42);
  assert.equal(set(node,'<p>Bekreftet</p>'),true);
  assert.equal(node.writes,2);
});

test('admin wires partial render to Firebase origin without changing critical order flow', async () => {
  const admin=await readFile(new URL('../js/admin.js', import.meta.url),'utf8');
  assert.match(admin,/adminRenderChanges\(lastAdminSignatures, nextSignatures, origin\)/);
  assert.match(admin,/subscribe\(\(_state, origin\) => renderAll\(origin\)\)/);
  assert.match(admin,/ui\.page === 'products' && dirty\.menu/);
  assert.match(admin,/ui\.page === 'groups' && dirty\.menu/);
  assert.match(admin,/ui\.page === 'settings' && dirty\.menu/);
  assert.match(admin,/ui\.page === 'orders' && \(dirty\.orders \|\| dirty\.menu\)/);
  assert.match(admin,/updateAdminMarkup\(el\.statRow, cards/);
  assert.match(admin,/updateAdminMarkup\(el\.orderStatRow, \[/);
  assert.match(admin,/updateAdminMarkup\(el\.orderList, listMarkup\)/);
  assert.match(admin,/updateAdminMarkup\(el\.settings\.slotPreview, markup\)/);
  assert.match(admin,/if \(key === lastPalettePreviewKey && node\.childElementCount\) return;/);
  assert.match(admin,/confirmationExpired\(order\)/);
  assert.match(admin,/acceptOrderWithEstimate/);
  assert.match(admin,/await printKitchenTicket\(order, \{ reprint, typography: store\.settings \}\)/);
});
