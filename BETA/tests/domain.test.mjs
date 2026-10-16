import test from 'node:test';
import assert from 'node:assert/strict';
import {addToCart,changeQuantity,cartTotal,cartQuantity,validateCart} from '../src/domain/cart.js';
import {createTestOrder,transitionTestOrder,canTransition} from '../src/domain/orders.js';
import {sampleCatalog} from '../src/data/catalog.js';
import {safeText} from '../src/shared/format.js';

const pizza=sampleCatalog[0];
test('adds a product using the right variant and price',()=>{
  const cart=addToCart([],pizza,'stor');
  assert.equal(cart.length,1);
  assert.equal(cartTotal(cart),269);
  assert.equal(cart[0].sizeLabel,'Stor');
});
test('merges repeated variants into one line',()=>{
  const once=addToCart([],pizza,'medium');
  const twice=addToCart(once,pizza,'medium');
  assert.equal(twice.length,1);
  assert.equal(cartQuantity(twice),2);
  assert.equal(cartTotal(twice),398);
});
test('different sizes stay separate',()=>{
  let cart=addToCart([],pizza,'medium');
  cart=addToCart(cart,pizza,'stor');
  assert.equal(cart.length,2);
});
test('minus removes last item, total returns zero',()=>{
  const cart=addToCart([],pizza,'medium');
  const removed=changeQuantity(cart,cart[0].key,-1);
  assert.deepEqual(removed,[]);
  assert.equal(cartTotal(removed),0);
});
test('rejects invalid cart lines and sizes',()=>{
  assert.equal(validateCart([{key:'x',name:'X',price:-5,quantity:1}]),false);
  assert.throws(()=>addToCart([],pizza,'unknown'));
});
test('creates mock order with no external notifications',()=>{
  const order=createTestOrder({
    customerName:'Test Kunde',phone:'95557474',email:'test@example.com',
    lines:addToCart([],pizza,'medium'),total:199
  },1760000000000);
  assert.equal(order.status,'mottatt');
  assert.deepEqual(order.notifications,{sms:'disabled',email:'disabled'});
  assert.equal(order.total,199);
});
test('rejects invalid phone and email',()=>{
  const input={customerName:'Test',phone:'123',lines:addToCart([],pizza,'medium'),total:199};
  assert.throws(()=>createTestOrder(input));
  assert.throws(()=>createTestOrder({...input,phone:'95557474',email:'not-an-email'}));
});
test('accepts with estimated ready time, then marks staff ready',()=>{
  const order=createTestOrder({customerName:'Test',phone:'95557474',lines:addToCart([],pizza,'medium'),total:199},1760000000000);
  const accepted=transitionTestOrder(order,'bekreftet',{minutes:15,now:1760000060000});
  assert.equal(accepted.estimatedReadyAt,1760000060000+15*60000);
  const ready=transitionTestOrder(accepted,'klar',{now:1760001000000});
  assert.equal(ready.staffReadyAt,1760001000000);
  const completed=transitionTestOrder(ready,'fullfort');
  assert.equal(completed.status,'fullfort');
});
test('rejects illegal status transitions',()=>{
  const order=createTestOrder({customerName:'Test',phone:'95557474',lines:addToCart([],pizza,'medium'),total:199});
  assert.equal(canTransition(order,'klar'),false);
  assert.throws(()=>transitionTestOrder(order,'klar'));
  assert.throws(()=>transitionTestOrder(order,'bekreftet',{minutes:0}));
});
test('escapes browser-rendered user strings',()=>{
  assert.equal(safeText('<img src=x onerror="evil">'),'&lt;img src=x onerror=&quot;evil&quot;&gt;');
});
