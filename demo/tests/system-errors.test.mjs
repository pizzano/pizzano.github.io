import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticCode, diagnosticEntry, reportSystemError, readSystemErrors, setSystemErrorStatus } from '../js/system-errors.js';

test('report entries never serialize personal details',()=>{
  const item=diagnosticEntry('order_accept','http','critical',1234);
  assert.equal(item.code,'order_accept_http');
  assert.equal(item.count,1);
  assert.equal(item.read,false);
  assert.equal(item.resolved,false);
  assert.ok(!JSON.stringify(item).includes('@'));
});
test('unknown descriptions are mapped to predefined safe labels',()=>{
  assert.equal(diagnosticCode('user@example.com','secret'),'firebase_unknown');
});
test('deduplicates the same failure with conditional Firebase writes',async()=>{
  const original=globalThis.fetch;
  const originalWindow=globalThis.window;
  globalThis.window={BESTILL_CONFIG:{databaseUrl:'https://example.test'}};
  const values=new Map();
  const reqs=[];
  globalThis.fetch=async(url,options={})=>{
    reqs.push({url,method:options.method||'GET'});
    const key=url.split('/').pop();
    if(options.method==='PUT'){
      const val=JSON.parse(options.body);
      values.set(key,val);
      return {ok:true,status:200};
    }
    if(options.method==='PATCH')return {ok:true,status:200};
    return {ok:true,status:200,headers:{get:()=>'\"mock-etag\"'},json:async()=>values.get(key)||null};
  };
  try{
    assert.equal(await reportSystemError('order_accept','http','critical'),true);
    assert.equal(await reportSystemError('order_accept','http','critical'),true);
    const record=values.get('order_accept_http.json');
    assert.equal(record.count,2);
    assert.equal(Object.keys(values).length,1);
    assert.equal((await readSystemErrors()) instanceof Object,true);
    assert.equal(await setSystemErrorStatus('order_accept_http',{read:true}),true);
    assert.equal(await setSystemErrorStatus('../../orders',{read:true}),false);
    assert.equal(reqs.filter(x=>x.method==='PUT').length,2);
  }finally{
    globalThis.fetch=original;
    globalThis.window=originalWindow;
  }
});
test('reporting failure never throws or recursively retries',async()=>{
  const original=globalThis.fetch, originalWindow=globalThis.window;
  globalThis.window={BESTILL_CONFIG:{databaseUrl:'https://example.test'}};
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('offline private data: 999');};
  try{
    assert.equal(await reportSystemError('firebase','network'),false);
    assert.equal(calls,1);
  }finally{globalThis.fetch=original;globalThis.window=originalWindow;}
});
