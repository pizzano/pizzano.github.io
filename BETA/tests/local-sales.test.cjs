const test=require('node:test'),assert=require('node:assert/strict'),{record,summarize,choose}=require('../admin/local-sales.js');
const stamp=Date.UTC(2026,10,24,23,30), base={id:'a',status:'klar',total:120.25,createdAt:stamp,updatedAt:stamp};
test('Oslo date and integer øre',()=>{assert.deepEqual(record(base),{id:'a',day:'2026-11-25',amount:12025,sold:true,version:stamp})});
test('pending and invalid excluded',()=>{assert.equal(record({...base,status:'mottatt'}),null);assert.equal(record({...base,total:-1}),null)});
test('idempotent version merge and rejection',()=>{const r=record(base),next=record({...base,status:'avvist',updatedAt:stamp+1});assert.equal(choose(r,r),r);assert.equal(choose(next,r),next);assert.equal(choose(r,next),next)});
test('daily monthly yearly totals exclude rejected',()=>{const r=record(base),rejected=record({...base,id:'b',status:'avvist'});assert.deepEqual(summarize([r,rejected],stamp),Array(3).fill({count:1,amount:12025}))});
