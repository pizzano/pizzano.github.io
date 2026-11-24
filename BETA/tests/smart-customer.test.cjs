const test=require('node:test'),assert=require('node:assert/strict'),{clean,remember,available,create}=require('../index/smart-customer.js');
test('recent list deduplicates and bounds size',()=>{const now=10000000000;assert.deepEqual(remember([{id:'a',at:now-1},{id:'b',at:now-2}],'b',now).map(x=>x.id),['b','a']);assert.equal(remember(Array.from({length:12},(_,i)=>({id:String(i),at:now-1})),'new',now).length,8)});
test('expired and future data excluded',()=>{const now=10000000000;assert.deepEqual(clean([{id:'old',at:now-31*86400000},{id:'future',at:now+1}],now),[])});
test('catalogue availability and duplicates',()=>assert.deepEqual(available(['a','a','b','c','d'],id=>({id,hidden:id==='b',soldOut:id==='c'})).map(x=>x.id),['a','d']));
test('local storage and clear',()=>{const data=new Map(),s=create({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'x');s.visit('a');assert.equal(s.read()[0].id,'a');s.clear();assert.deepEqual(s.read(),[])});
