import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const {sortCartByCategory}=await import('data:text/javascript;base64,'+readFileSync(new URL('../js/cart-order.js',import.meta.url)).toString('base64'));
test('Uses menu categories and preserves distinct lines within a category without mutating cart',()=>{
 const sections=[{items:[{id:'pizza'}]},{items:[{id:'burger'}]},{items:[{id:'lovstek'}]}];
 const cart=[{itemId:'lovstek',lineId:'a'},{itemId:'pizza',lineId:'b'},{itemId:'burger',lineId:'c'},{itemId:'pizza',lineId:'d'}];
 assert.deepEqual(sortCartByCategory(cart,sections).map(l=>l.lineId),['b','d','c','a']);
 assert.deepEqual(cart.map(l=>l.lineId),['a','b','c','d']);
 assert.equal(sortCartByCategory(cart,sections)[0],cart[1]);
});
test('Follows reordered categories and keeps unmatched lines last',()=>{
 const sections=[{items:[{id:'burger'}]},{items:[{id:'pizza'}]}];
 assert.deepEqual(sortCartByCategory([{itemId:'gone'},{itemId:'pizza'},{itemId:'burger'}],sections).map(l=>l.itemId),['burger','pizza','gone']);
});
