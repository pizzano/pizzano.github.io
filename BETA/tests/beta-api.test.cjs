'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync}=require('node:crypto');
const {EventEmitter}=require('node:events');
const handler=require('../../api/beta.js');

test('BETA guarded checkout, notifications, transitions, and archive (all mocked)',async()=>{
 const tenant='kol-grill-pizza',dbName='beta-isolated-test-default-rtdb';
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 process.env.BETA_FIREBASE_DATABASE_URL='https://'+dbName+'.firebaseio.com';
 process.env.BETA_FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'beta-test',client_email:'test@beta.invalid',private_key:privateKey});
 process.env.BETA_SESSION_SECRET='testing-secret-'.repeat(5);
 process.env.BETA_ADMIN_EMAIL='admin@unit.invalid';
 process.env.BETA_SMS_GATEWAY_TOKEN='mock-traccar-token';
 process.env.BETA_RESEND_API_KEY='mock-resend-key';
 process.env.BETA_EMAIL_FROM='test@unit.invalid';
 const fakeDB={tenants:{[tenant]:{catalog:{
   updatedAt:1234,sections:[{id:'pizza',title:'Pizza',items:[
    {id:'pizza1',name:'Classico',sizes:[{id:'small',label:'Medium',price:189}],optionGroupIds:[]}
   ]}],optionGroups:[],siteSettings:{
    weeklyHours:Array.from({length:7},()=>({enabled:true,open:'00:00',close:'00:00'})),
    prepMinutes:25
   }
  },orders:{active:{},archive:{}}}}};
 const versions=new Map();let sms=0,email=0,google=0;
 const fromPath=path=>path.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
 const get=(path)=>fromPath(path).reduce((o,k)=>o?.[k],fakeDB)??null;
 const set=(path,value)=>{
  const parts=fromPath(path);let obj=fakeDB;
  for(const part of parts.slice(0,-1)){if(!obj[part])obj[part]={};obj=obj[part];}
  if(value===null)delete obj[parts.at(-1)];else obj[parts.at(-1)]=value;
  versions.set(path,String(Number(versions.get(path)||0)+1));
 };
 const make=(status,data={},headers={})=>({
  status,ok:status>=200&&status<300,
  headers:{get:(k)=>headers[k]||headers[k.toLowerCase()]||null},
  async json(){return data;},
  body:null
 });
 const sent=[];
 global.fetch=async (url,init={})=>{
  const u=new URL(url),method=init.method||'GET';
  if(u.hostname==='oauth2.googleapis.com'){google++;return make(200,{access_token:'mock-oauth-token',expires_in:3600});}
  if(u.hostname==='www.traccar.org'){sms++;sent.push({type:'sms',request:JSON.parse(init.body)});return make(200,{successCount:1,failureCount:0});}
  if(u.hostname==='api.resend.com'){email++;sent.push({type:'email',request:JSON.parse(init.body)});return make(200,{id:'test-email'});}
  if(u.hostname===dbName+'.firebaseio.com'){
   const path=decodeURIComponent(u.pathname.slice(1).replace(/\.json$/,''));
   if(path==='tenants/'+tenant+'/orders/active'&&u.searchParams.get('shallow')==='true')
    return make(401,{error:'Permission denied'});
   if(!init.headers?.Authorization)throw Error('Missing Firebase OAuth2 Bearer');
   if(init.headers.Authorization!=='Bearer mock-oauth-token')throw Error('Unexpected Firebase token');
   if(method==='GET')return make(200,get(path),{'ETag':'"'+(versions.get(path)||'0')+'"'});
   if(method==='PUT'){
    const old=get(path);
    const expected=init.headers['If-Match'];
    if(expected==='null_etag'&&old!==null)return make(412,{});
    if(expected&&expected!=='null_etag'&&expected!=='"'+(versions.get(path)||'0')+'"')return make(412,{});
    const val=JSON.parse(init.body);
    set(path,val);return make(200,val,{'ETag':'"'+versions.get(path)+'"'});
   }
   if(method==='PATCH'){
    const body=JSON.parse(init.body);
    for(const [key,val] of Object.entries(body))set(path+'/'+key,val);
    return make(200,body);
   }
  }
  if(u.hostname==='kol-grill-pizza-default-rtdb.firebaseio.com'){
   const name=u.pathname.slice(1).replace('.json','');
   return make(200,fakeDB.tenants[tenant].catalog[name]);
  }
  throw new Error('Unexpected outbound request: '+url);
 };
 async function call(method,path,body,headers={},query={}){
  const req=new EventEmitter();
  req.method=method;
  req.query={path:'v1/tenants/'+tenant+'/'+path,...query};
  req.url='/api/beta/v1/tenants/'+tenant+'/'+path;
  req.headers={origin:'https://bestill.online',...headers};
  req.body=body;
  const res=new EventEmitter();
  res.statusCode=200;res.headers={};res.writableEnded=false;res.destroyed=false;
  res.setHeader=(key,val)=>{res.headers[key]=val};
  res.status=n=>{res.statusCode=n;return res};
  res.json=obj=>{res.data=obj;res.writableEnded=true;return res};
  res.end=()=>{res.writableEnded=true;return res};
  res.write=str=>{res.output=(res.output||'')+str;return true};
  res.flushHeaders=()=>{};
  await handler(req,res);
  return res;
 }
 const body={
  tenantId:tenant,customerName:'Testkunde',phone:'41234567',email:'test@example.invalid',
  pickupMode:'asap',pickup:'Snarest',total:189,lines:[
   {itemId:'pizza1',sizeId:'small',quantity:1,options:[],comment:''}
  ]
 };
 const key='11111111-1111-4111-8111-111111111111';
 let result=await call('POST','orders',body,{'idempotency-key':key});
 assert.equal(result.statusCode,201);
 const id=result.data.id,customerToken=result.data.accessToken;
 assert.match(id,/^ord_[a-zA-Z0-9_-]{15,50}$/);
 assert.equal(result.data.status,'mottatt');
 const idem=await call('POST','orders',body,{'idempotency-key':key});
 assert.equal(idem.statusCode,200);
 assert.equal(idem.data.id,id);
 assert.equal(Object.keys(fakeDB.tenants[tenant].orders.active).length,1);
 const altered={...body,total:3};
 const conflict=await call('POST','orders',altered,{'idempotency-key':key});
 assert.equal(conflict.statusCode,409);
 const wrongPrice=await call('POST','orders',altered,{'idempotency-key':'22222222-2222-4222-8222-222222222222'});
 assert.equal(wrongPrice.statusCode,409);
 const withoutToken=await call('GET','orders/'+id+'/status');
 assert.equal(withoutToken.statusCode,404);
 const mine=await call('GET','orders/'+id+'/status',null,{authorization:'Bearer '+customerToken});
 assert.equal(mine.statusCode,200);
 assert.deepEqual(Object.keys(mine.data).sort(),['estimatedReadyAt','id','status','statusUpdatedAt']);
 const anon=await call('GET','admin/orders',null,{}, {status:'active',limit:'100'});
 assert.equal(anon.statusCode,401);
 // A password is NEVER accepted for admin login. One-time email code only.
 const legacy=await call('POST','admin/sessions',{username:'unit-admin',password:'old-password'});
 assert.equal(legacy.statusCode,404);
 const challenge=await call('POST','admin/login/request',{});
 assert.equal(challenge.statusCode,200);
 assert.equal(challenge.data.sent,true);
 assert.equal(email,1);
 assert.equal(sent[0].request.to[0],'admin@unit.invalid');
 const code=sent[0].request.text.match(/\b\d{8}\b/)?.[0];
 assert.match(code,/^\d{8}$/);
 const flood=await call('POST','admin/login/request',{});
 assert.equal(flood.statusCode,429);
 const bad=await call('POST','admin/login/verify',{code:code==='00000000'?'00000001':'00000000'});
 assert.equal(bad.statusCode,401);
 const login=await call('POST','admin/login/verify',{code});
 assert.equal(login.statusCode,200);
 assert.ok(login.data.accessToken);
 const replay=await call('POST','admin/login/verify',{code});
 assert.equal(replay.statusCode,401);
 const adminHeaders={authorization:'Bearer '+login.data.accessToken,'x-csrf-token':login.data.csrfToken};
 const active=await call('GET','admin/orders',null,adminHeaders,{status:'active',limit:'100'});
 assert.equal(active.statusCode,200);assert.equal(active.data.orders.length,1);
 // Wrong transitions must not silently return transitioned:false.
 const tooEarly=await call('POST','admin/orders/'+id+'/ready',{
  expectedStatus:'mottatt',expectedVersion:Date.now()
 },adminHeaders);
 assert.equal(tooEarly.statusCode,409);
 const initial=fakeDB.tenants[tenant].orders.active[id];
 const confirmed=await call('POST','admin/orders/'+id+'/confirm',{
  expectedStatus:'mottatt',expectedVersion:initial.statusUpdatedAt,estimatedMinutes:25
 },adminHeaders);
 assert.equal(confirmed.statusCode,200);
 assert.equal(confirmed.data.transitioned,true);
 assert.equal(confirmed.data.order.status,'bekreftet');
 assert.equal(sms,1);assert.equal(email,2);
 const repeat=await call('POST','admin/orders/'+id+'/confirm',{
  expectedStatus:'mottatt',expectedVersion:initial.statusUpdatedAt,estimatedMinutes:25
 },adminHeaders);
 assert.equal(repeat.statusCode,200);assert.equal(repeat.data.transitioned,false);
 assert.equal(sms,1);assert.equal(email,2);
 const changed=await call('POST','admin/orders/'+id+'/estimate',{
  expectedVersion:confirmed.data.order.statusUpdatedAt,estimatedMinutes:35
 },adminHeaders);
 assert.equal(changed.statusCode,200);
 assert.equal(changed.data.order.estimatedMinutes,35);
 assert.equal(sms,1);
 const ready=await call('POST','admin/orders/'+id+'/ready',{
  expectedStatus:'bekreftet',expectedVersion:changed.data.order.statusUpdatedAt
 },adminHeaders);
 assert.equal(ready.statusCode,200);assert.equal(ready.data.order.status,'klar');
 assert.equal(sms,1);
 const completed=await call('POST','admin/orders/'+id+'/complete',{
  expectedStatus:'klar',expectedVersion:ready.data.order.statusUpdatedAt
 },adminHeaders);
 assert.equal(completed.statusCode,200);
 assert.equal(completed.data.order.status,'fullfort');
 assert.equal(get('tenants/'+tenant+'/orders/active/'+id),null);
 assert.equal(get('tenants/'+tenant+'/orders/archive/'+id).status,'fullfort');
 assert.equal(sms,1);assert.equal(email,2);
 const after=await call('GET','admin/orders',null,adminHeaders,{status:'active',limit:'100'});
 assert.equal(after.data.orders.length,0);
 const publicHistory=await call('GET','admin/orders/archive',null,{}, {limit:'50'});
 assert.equal(publicHistory.statusCode,401);
 const history=await call('GET','admin/orders/archive',null,adminHeaders,{limit:'50'});
 assert.equal(history.statusCode,200);
 assert.equal(history.data.orders.length,1);
 assert.equal(history.data.orders[0].status,'fullfort');
 const archivedCustomer=await call('GET','orders/'+id+'/status',null,{authorization:'Bearer '+customerToken});
 assert.equal(archivedCustomer.data.status,'fullfort');
 assert.ok(google>=1);
 assert.equal(sent.filter(x=>x.type==='sms').length,1);
});
