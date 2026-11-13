import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationDeadline, confirmationExpired, confirmationRemaining, ORDER_CONFIRM_WAIT_MS, customerPageBaseUrl, customerOrderLink } from '../js/order-confirmation.js';

test('normal order expires exactly after three minutes', () => {
  const order = { id:'test-1', status:'mottatt', createdAt: 1000000 };
  assert.equal(ORDER_CONFIRM_WAIT_MS,180000);
  assert.equal(confirmationDeadline(order),1180000);
  assert.equal(confirmationExpired(order,1179999),false);
  assert.equal(confirmationExpired(order,1180000),true);
  assert.equal(confirmationRemaining(order,1000000),'3:00');
});
test('preopening order never expires even many hours later', () => {
  const order={id:'test-2',status:'mottatt',createdAt:1000000,confirmationNoTimeout:true,confirmationDeadline:0};
  assert.equal(confirmationDeadline(order),0);
  assert.equal(confirmationExpired(order,100000000),false);
  assert.equal(confirmationRemaining(order,100000000),'Uten tidsfrist');
});
test('an accepted or rejected order is not pending expiry', () => {
  for (const status of ['bekreftet','klar','avvist']) {
    assert.equal(confirmationExpired({status,createdAt:1000000},1300000),false);
  }
});
test('explicit deadline is respected for ordinary orders', () => {
  const order={status:'mottatt',createdAt:1000000,confirmationDeadline:1250000};
  assert.equal(confirmationExpired(order,1190000),false);
  assert.equal(confirmationExpired(order,1250000),true);
});

test('order links follow the real shop directory without hardcoded /demo/ paths', () => {
  assert.equal(customerPageBaseUrl('https://example.test/shop/admin.html?tab=orders'), 'https://example.test/shop/');
  assert.equal(customerPageBaseUrl('https://example.test/demo/'), 'https://example.test/demo/');
  assert.equal(customerOrderLink('ord_abcdefg', 'https://example.test/shop/admin.html'),
    'https://example.test/shop/?order=ord_abcdefg');
  assert.throws(() => customerOrderLink('other', 'https://example.test/shop/'));
  assert.throws(() => customerPageBaseUrl('file:///tmp/index.html'));
});

test('optional server expiry worker validates deadlines and uses conditional Firebase writes', async () => {
  const {readFileSync}=await import('node:fs');
  const script=readFileSync(new URL('../integrations/google-apps-script/Kode.gs',import.meta.url),'utf8');
  const start=script.indexOf('function kolExpirePendingOrders()');
  const body=script.slice(start);
  assert.ok(start>0);
  assert.match(body,/function kolInstallExpiryTrigger\(\)/);
  assert.match(body,/function kolRemoveExpiryTrigger\(\)/);
  assert.match(body,/confirmationNoTimeout===true/);
  assert.match(body,/current\.status!=='mottatt'/);
  assert.match(body,/'X-Firebase-ETag':'true'/);
  assert.match(body,/'if-match':String\(etag\)/);
  assert.match(body,/update\.getResponseCode\(\)!==412/);
  assert.match(body,/everyMinutes\(1\)/);
});


test('expiry worker uses indexed pending-only query and never a full orders fallback', async () => {
  const {readFileSync}=await import('node:fs');
  const src=readFileSync(new URL('../integrations/google-apps-script/Kode.gs',import.meta.url),'utf8');
  const start=src.indexOf('function kolExpirePendingOrders()');
  const end=src.indexOf('\nfunction kolInstallExpiryTrigger()',start);
  assert.ok(start>=0 && end>start);
  const worker=src.slice(start,end);
  assert.match(worker,/encodeURIComponent\('"status"'\)/);
  assert.match(worker,/encodeURIComponent\('"mottatt"'\)/);
  assert.doesNotMatch(worker,/databaseUrl\+'\/orders\.json';/);
  assert.match(worker,/if \(!etag \|\| !current \|\| current\.status!=='mottatt'/);
});

test('server expiry worker only rejects overdue pending orders with Firebase ETag', async () => {
  const {readFileSync}=await import('node:fs');
  const src=readFileSync(new URL('../integrations/google-apps-script/Kode.gs',import.meta.url),'utf8');
  const start=src.indexOf('function kolExpirePendingOrders()');
  const end=src.indexOf('\nfunction kolInstallExpiryTrigger()',start);
  const worker=src.slice(start,end);
  const now=Date.now();
  const orderId='ord_abcdefg';
  const expired={status:'mottatt',createdAt:now-240000,phone:'12345678'};
  const calls=[];
  const makeResponse=(code,data,headers={})=>({
    getResponseCode:()=>code,
    getContentText:()=>JSON.stringify(data),
    getHeaders:()=>headers
  });
  const fakeFetch=(url,options)=>{
    calls.push({url,options});
    if(url.includes('?orderBy=')) {
      assert.match(url,/orderBy=%22status%22/);
      assert.match(url,/equalTo=%22mottatt%22/);
      return makeResponse(200,{
        [orderId]:expired,
        ord_bbbbbbb:{status:'mottatt',createdAt:now-240000,confirmationNoTimeout:true},
        ord_ccccccc:{status:'mottatt',createdAt:now-10000}
      });
    }
    if(options.method==='get')return makeResponse(200,expired,{ETag:'"v1"'});
    assert.equal(options.method,'put');
    assert.equal(options.headers['if-match'],'"v1"');
    assert.equal(JSON.parse(options.payload).status,'avvist');
    assert.equal(JSON.parse(options.payload).phone,'12345678');
    return makeResponse(200,{});
  };
  let released=0;
  const deps={
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},
    UrlFetchApp:{fetch:fakeFetch},
    KOL_SMS:{databaseUrl:'https://db.example'},
    console:{error:message=>{throw new Error(String(message));}}
  };
  const fn=new Function('deps',
    'const {LockService,UrlFetchApp,KOL_SMS,console}=deps;\n'+worker+
    '\nreturn kolExpirePendingOrders;')(deps);
  fn();
  assert.equal(calls.length,3);
  assert.equal(calls[0].url,'https://db.example/orders.json?orderBy=%22status%22&equalTo=%22mottatt%22');
  assert.equal(released,1);
});

test('server expiry worker fails closed when pending-only query fails', async () => {
  const {readFileSync}=await import('node:fs');
  const src=readFileSync(new URL('../integrations/google-apps-script/Kode.gs',import.meta.url),'utf8');
  const worker=src.slice(src.indexOf('function kolExpirePendingOrders()'),
    src.indexOf('\nfunction kolInstallExpiryTrigger()'));
  const calls=[],errors=[];
  let released=0;
  const deps={
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},
    UrlFetchApp:{fetch:(url,options)=>{
      calls.push({url,options});
      return {getResponseCode:()=>400,getContentText:()=>'',getHeaders:()=>({})};
    }},
    KOL_SMS:{databaseUrl:'https://db.example'},
    console:{error:message=>errors.push(String(message))}
  };
  new Function('deps','const {LockService,UrlFetchApp,KOL_SMS,console}=deps;\n'+worker+
    '\nreturn kolExpirePendingOrders;')(deps)();
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/orderBy=%22status%22/);
  assert.match(errors.join('\n'),/indexOn/);
  assert.equal(released,1);
});
