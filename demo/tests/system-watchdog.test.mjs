import test from 'node:test';
import assert from 'node:assert/strict';
import { reportSystemError, flushSystemErrorQueue, diagnosticEntry, monitorCriticalOperation } from '../js/system-errors.js';

test('offline failure enters bounded local queue and flushes on recovery', async()=>{
  const savedFetch=globalThis.fetch, savedWindow=globalThis.window, savedStorage=globalThis.localStorage;
  const map=new Map(), records=new Map();
  globalThis.window={BESTILL_CONFIG:{databaseUrl:'https://fake.test'}};
  globalThis.localStorage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};
  let online=false;
  globalThis.fetch=async(url,opts={})=>{
    if(!online)return {ok:false,status:503};
    const key=url.split('/').at(-1);
    if(opts.method==='PUT'){records.set(key,JSON.parse(opts.body));return {ok:true,status:200};}
    return {ok:true,status:200,headers:{get:()=>'"etag"'},json:async()=>records.get(key)||null};
  };
  try {
    assert.equal(await reportSystemError('order_accept','network','critical'),false);
    assert.ok(map.get('kol_safe_system_errors_v1').includes('order_accept_network'));
    online=true;
    assert.equal(await flushSystemErrorQueue(),1);
    assert.equal(records.get('order_accept_network.json').count,1);
    assert.equal(map.get('kol_safe_system_errors_v1'),'{}');
  }finally {globalThis.fetch=savedFetch;globalThis.window=savedWindow;globalThis.localStorage=savedStorage;}
});
test('watchdog returns the original result without changing success semantics',async()=>{
  const value=await monitorCriticalOperation(Promise.resolve(42),'order_accept',1000);
  assert.equal(value,42);
  await assert.rejects(()=>monitorCriticalOperation(Promise.reject(new Error('network')),'order_accept',1000),/network/);
});
test('default diagnostics keep PII out of storage',()=>{
  const record=diagnosticEntry('order_create','network','critical',2000);
  assert.equal(record.status,'ongoing');
  assert.deepEqual(Object.keys(record).filter(x=>/phone|email|customer/i.test(x)),[]);
});
