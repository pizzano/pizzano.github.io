'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../js/test-orders.js'),'utf8');
const config={tenantId:'kol-grill-pizza',testDatabaseUrl:'https://kol-grill-pizza-default-rtdb.firebaseio.com'};
function adapter(network){
 const script=source.replace(/^import .*?;$/gm,'').replace(/^export /gm,'')+
 '\nreturn {addTestOrder,getTestOrder,listTestOrders,updateTestOrder,testHealth,streamTestOrders};';
 return new Function('config','fetch',script)(config,network);
}
function database(){
 const saved=new Map(),versions=new Map(),urls=[];
 let permission=true;
 const mock=async(input,request={})=>{
  const u=new URL(input),method=request.method||'GET';
  urls.push({url:u.toString(),method,headers:request.headers});
  assert.equal(u.hostname,'kol-grill-pizza-default-rtdb.firebaseio.com');
  assert.match(u.pathname,/^\/betaTest\/orders(?:\/test_[a-zA-Z0-9_]+)?\.json$/);
  if(!permission)return {status:403,ok:false,headers:{get:()=>null},json:async()=>({error:'Permission denied'})};
  const isRoot=u.pathname==='/betaTest/orders.json',id=isRoot?'':u.pathname.slice('/betaTest/orders/'.length,-5);
  const current=saved.get(id)||null;
  const response=(status,value,etag)=>({status,ok:status>=200&&status<300,
   headers:{get:key=>key.toLowerCase()==='etag'?etag:null},json:async()=>value});
  if(method==='GET'){
   if(isRoot){
    const subset=[...saved.values()].sort((a,b)=>a.id.localeCompare(b.id)).slice(-100);
    return response(200,Object.fromEntries(subset.map(o=>[o.id,o])),null);
   }
   return response(200,current,'"'+(versions.get(id)||0)+'"');
  }
  assert.equal(method,'PUT');
  const match=request.headers?.['If-Match'];
  if(match==='null_etag'&&current||match&&match!=='null_etag'&&match!=='"'+(versions.get(id)||0)+'"')
   return response(412,{error:'conflict'},null);
  const value=JSON.parse(request.body);
  saved.set(id,value);versions.set(id,(versions.get(id)||0)+1);
  return response(200,value,'"'+versions.get(id)+'"');
 };
 return{mock,saved,urls,deny:()=>{permission=false}};
}
const baseOrder={
 tenantId:'kol-grill-pizza',customerName:'PERSON TEST',phone:'41123456',
 email:'private-test@not-real.example',pickupMode:'asap',pickup:'Snarest',
 total:189,lines:[{itemId:'pizza1',name:'Margherita',size:'Stor',quantity:1,price:189,
 options:[{label:'Ekstra ost'}],comment:'HEMMELIG KOMMENTAR'}]
};
test('BETA never persists personal data and accepts idempotent test orders',async()=>{
 const db=database(),api=adapter(db.mock);
 const key='11111111-1111-4111-8111-111111111111',at=1761062400000;
 const stored=await api.addTestOrder(baseOrder,key,at);
 assert.match(stored.id,/^test_[0-9]{13}_[a-f0-9]{12}$/);
 assert.equal(stored.testMode,true);
 assert.equal(stored.status,'mottatt');
 assert.equal(stored.customerName,'BETA TEST');
 assert.equal(stored.phone,'');
 assert.equal(stored.email,'');
 assert.equal(stored.lines[0].comment,'');
 assert.equal(stored.notifications.sms.state,'disabled-test');
 assert.equal(stored.notifications.email.state,'disabled-test');
 assert.equal((await api.addTestOrder(baseOrder,key,at)).id,stored.id);
 assert.equal(db.saved.size,1);
 assert.deepEqual((await api.listTestOrders()).map(o=>o.id),[stored.id]);
 const text=JSON.stringify([...db.saved.values()]);
 for(const forbidden of ['PERSON TEST','41123456','private-test@not-real.example','HEMMELIG KOMMENTAR'])
  assert.ok(!text.includes(forbidden),'Forbidden customer data in public beta test storage');
 assert.ok(db.urls.every(u=>u.url.includes('/betaTest/orders')));
});
test('Admin updates test order status with ETag and never schedules messages',async()=>{
 const db=database(),api=adapter(db.mock);
 const order=await api.addTestOrder(baseOrder,'22222222-2222-4222-8222-222222222222',1761062401000);
 const confirmed=await api.updateTestOrder(order.id,'confirm',{expectedStatus:'mottatt',expectedVersion:order.statusUpdatedAt,estimatedMinutes:20});
 assert.equal(confirmed.order.status,'bekreftet');
 assert.equal(confirmed.order.notifications.sms.state,'disabled-test');
 const changed=await api.updateTestOrder(order.id,'estimate',{expectedStatus:'bekreftet',expectedVersion:confirmed.order.statusUpdatedAt,estimatedMinutes:30});
 assert.equal(changed.order.estimatedMinutes,30);
 const ready=await api.updateTestOrder(order.id,'ready',{expectedStatus:'bekreftet',expectedVersion:changed.order.statusUpdatedAt});
 assert.equal(ready.order.status,'klar');
 await assert.rejects(api.updateTestOrder(order.id,'ready',{expectedStatus:'bekreftet',expectedVersion:changed.order.statusUpdatedAt}),/Statusen/);
 const complete=await api.updateTestOrder(order.id,'complete',{expectedStatus:'klar',expectedVersion:ready.order.statusUpdatedAt});
 assert.equal(complete.order.status,'fullfort');
 assert.equal((await api.getTestOrder(order.id)).status,'fullfort');
});
test('Database permission errors fail closed: no accepted order',async()=>{
 const db=database(),api=adapter(db.mock);db.deny();
 await assert.rejects(api.addTestOrder(baseOrder,'33333333-3333-4333-8333-333333333333',1761062402000),/tillatelser/);
 assert.equal(db.saved.size,0);
 await assert.rejects(api.listTestOrders(),/tillatelser/);
});
test('Admin reads only newest 100 test orders',async()=>{
 const db=database(),api=adapter(db.mock);
 for(let i=0;i<110;i++){
  const id='test_'+String(1761062400000+i)+'_'+String(i).padStart(12,'0');
  db.saved.set(id,{id,testMode:true,tenantId:'kol-grill-pizza',createdAt:1761062400000+i,status:'mottatt'});
 }
 const list=await api.listTestOrders();
 assert.equal(list.length,100);
 assert.equal(list[0].createdAt,1761062400109);
});
test('BETA client uses existing KØL Realtime Database, never bestill-pizza or hosted function URLs',()=>{
 const cfg=fs.readFileSync(path.join(__dirname,'../js/config.js'),'utf8');
 assert.match(cfg,/mode:'firebase-test'/);
 assert.match(cfg,/testDatabaseUrl:'https:\/\/kol-grill-pizza-default-rtdb\.firebaseio\.com'/);
 assert.doesNotMatch(cfg,/bestill-pizza|cloudfunctions\.net|vercel\.app/);
 const admin=fs.readFileSync(path.join(__dirname,'../js/admin.js'),'utf8');
 const store=fs.readFileSync(path.join(__dirname,'../js/store.js'),'utf8');
 assert.match(admin,/streamTestOrders/);
 assert.match(store,/addTestOrder/);
});

test('test checkout works outside restaurant hours without altering live hours',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
 const store=fs.readFileSync(path.join(__dirname,'../js/store.js'),'utf8');
 assert.ok(app.includes("openState().open||config.mode==='firebase-test'"));
 assert.ok(store.includes("!isOpen(date)&&config.mode!=='firebase-test'"));
 assert.match(app,/Testmodus: Ingen e-post eller SMS sendes/);
});
