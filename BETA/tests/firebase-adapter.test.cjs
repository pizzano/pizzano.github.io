'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('Firebase v2 gateway binds three secrets and protects server-side identity',async()=>{
 const code=fs.readFileSync(path.join(__dirname,'../functions/index.js'),'utf8');
 let options,requestHandler,calls=0;
 const secretNames=new Set(['BETA_SESSION_SECRET','BETA_SMS_GATEWAY_TOKEN','BETA_RESEND_API_KEY']);
 const secret=name=>{assert.ok(secretNames.has(name));return{name,value:()=>name+'-test-secret'}};
 const plain=name=>({name,value:()=>name==='BETA_FIREBASE_DATABASE_URL'
  ?'https://beta-isolated-test-default-rtdb.firebasedatabase.app':'admin@unit.invalid'});
 const processMock={env:{K_SERVICE:'betaorders'}};
 const exports={};
 vm.runInNewContext(code,{
  exports,process:processMock,require(id){
   if(id==='firebase-functions/v2/https')return {onRequest:(config,fn)=>{options=config;requestHandler=fn;return fn}};
   if(id==='firebase-functions/params')return {defineSecret:secret,defineString:plain};
   if(id==='./beta-handler.cjs')return async(req,res)=>{calls++;res.gatewayCalled=true;};
   throw Error('Unexpected dependency: '+id);
  }
 },{filename:'BETA/functions/index.js'});
 assert.equal(typeof exports.betaOrders,'function');
 assert.equal(options.region,'europe-west1');
 assert.equal(options.cors,false);
 assert.equal(options.invoker,'public');
 assert.equal(options.secrets.length,3);
 assert.ok(options.timeoutSeconds>=210);
 const reply={};
 await requestHandler({},reply);
 assert.equal(calls,1);
 assert.equal(reply.gatewayCalled,true);
 assert.equal(processMock.env.BETA_FIREBASE_ADC,'1');
 assert.equal(processMock.env.BETA_SESSION_SECRET,'BETA_SESSION_SECRET-test-secret');
 assert.equal(processMock.env.BETA_RESEND_API_KEY,'BETA_RESEND_API_KEY-test-secret');
});
test('customer and admin frontend use only Firebase Cloud Functions for orders',()=>{
 const dir=path.join(__dirname,'../js');
 const config=fs.readFileSync(path.join(dir,'config.js'),'utf8');
 const store=fs.readFileSync(path.join(dir,'store.js'),'utf8');
 const admin=fs.readFileSync(path.join(dir,'admin.js'),'utf8');
 assert.match(config,/https:\/\/europe-west1-bestill-19\.cloudfunctions\.net\/betaOrders/);
 assert.doesNotMatch(config,/vercel\.app\/api\/beta/);
 assert.match(store,/config\.apiBase/);
 assert.match(admin,/config\.apiBase/);
 assert.doesNotMatch(config,/BETA_SESSION_SECRET|BETA_SMS_GATEWAY_TOKEN|BETA_RESEND_API_KEY/);
});
test('isolated private RTDB rule files fail closed',()=>{
 const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.rules.json'),'utf8')).rules;
 assert.equal(rules['.read'],false);
 assert.equal(rules['.write'],false);
 const deploy=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.json'),'utf8'));
 assert.equal(deploy.functions.codebase,'kol-beta-orders');
 assert.equal(deploy.functions.source,'functions');
});
