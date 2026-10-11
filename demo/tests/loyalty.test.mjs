import test from 'node:test';
import assert from 'node:assert/strict';
import { loyaltyPhone, pizzaBonus, historicalPizzaEvents, largePizza } from '../js/loyalty.js';
const event = (id, at, quantity, redeemed = false) => ({ id, at, quantity, redeemed });
test('Norwegian phone formats share the same loyalty account', () => {
  for (const value of ['47955574', '+47 47955574', '004747955574']) assert.equal(loyaltyPhone(value), '47955574');
  assert.equal(loyaltyPhone('123'), '');
});
test('Count stays at ten until the reward is used', () => {
  for (const quantity of [10, 13, 20, 30]) assert.deepEqual(pizzaBonus({a:event('a',1,quantity)}), {count:10,cycle:'start',ready:true});
});
test('Confirmed redemption resets to zero and discards accumulated overflow', () => {
  assert.deepEqual(pizzaBonus({a:event('a',1,30),b:event('b',2,4,true)}), {count:0,cycle:'b',ready:false});
  assert.equal(pizzaBonus({a:event('a',1,30),b:event('b',2,0,true),c:event('c',3,2)}).count,2);
});
test('Only confirmed large pizzas for the same phone earn credit', () => {
  const sections=[{type:'pizza',items:[{id:'pizza'}]},{type:'drinks',items:[{id:'drink'}]}];
  const order=(id,status,lines,phone='47955574')=>({id,createdAt:Number(id),status,lines,phone});
  const line=(itemId,size,quantity,loyaltyFree=false)=>({itemId,size,quantity,loyaltyFree});
  const orders=[order('1','mottatt',[line('pizza','Stor',8)]),order('2','avvist',[line('pizza','Stor',8)]),order('3','fullfort',[line('pizza','Stor',7),line('pizza','Medium',9),line('drink','Stor',9),line('pizza','Stor',1,true)]),order('4','bekreftet',[line('pizza','Stor',4)],'48955574')];
  assert.equal(pizzaBonus(historicalPizzaEvents(orders,'47955574',sections)).count,7);
  assert(!largePizza({type:'drinks'},'Stor'));
});
test('Replayed event IDs are counted once and confirmation order wins', () => {
  const events={a:event('a',1,10),b:event('b',2,0,true)};
  events.b=event('b',2,0,true);
  assert.equal(pizzaBonus(events).count,0);
  assert.equal(pizzaBonus({c:event('c',3,4),...events}).count,4);
});
