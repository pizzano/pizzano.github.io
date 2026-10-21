'use strict';
/* BETA only, isolated from DEMO. All private RTDB operations use a service
 * account with an OAuth2 token; no database secrets go to the browser.
 * Always fail CLOSED if the private Firebase instance is not configured. */
const crypto=require('node:crypto');
const BASE_MENU='https://kol-grill-pizza-default-rtdb.firebaseio.com';
const DEMO_DB='kol-grill-pizza-default-rtdb';
let accessCache={value:'',until:0},menuCache={version:null,loaded:0,data:null};
const env=()=>({
 db:String(process.env.BETA_FIREBASE_DATABASE_URL||'').replace(/\/$/,''),
 secret:String(process.env.BETA_SESSION_SECRET||''),
 account:String(process.env.BETA_FIREBASE_SERVICE_ACCOUNT_JSON||''),
 adminUser:String(process.env.BETA_ADMIN_USERNAME||''),
 adminHash:String(process.env.BETA_ADMIN_PASSWORD_HASH||''),
 smsToken:String(process.env.BETA_SMS_GATEWAY_TOKEN||''),
 resendKey:String(process.env.BETA_RESEND_API_KEY||''),
 emailFrom:String(process.env.BETA_EMAIL_FROM||'')
});
const b64=obj=>Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj)).toString('base64url');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const hmac=(secret,value)=>crypto.createHmac('sha256',secret).update(value).digest('base64url');
const equals=(a,b)=>{
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const write=(res,status,data)=>res.status(status).json(data);
const noCache=res=>res.setHeader('Cache-Control','no-store, max-age=0');
const tenantValid=value=>/^[a-z0-9][a-z0-9-]{2,50}$/.test(value);
const idValid=value=>/^ord_[a-zA-Z0-9_-]{15,50}$/.test(value);
const fields=raw=>Array.isArray(raw)?raw.filter(Boolean):raw&&typeof raw==='object'?Object.values(raw).filter(Boolean):[];
const number=value=>Number(value)||0;
const str=value=>String(value??'').trim();
const json=(req)=>{
 if(typeof req.body==='string')return JSON.parse(req.body);
 return req.body&&typeof req.body==='object'?req.body:{};
};
const allowedOrigins=new Set([
 'https://bestill.online','https://www.bestill.online',
 'https://pizzano-github-io.vercel.app',
 'https://pizzano-github-io-skarnes-restaurants-projects.vercel.app'
]);
function cors(req,res){
 const origin=String(req.headers.origin||'');
 if(origin&&allowedOrigins.has(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
 }
 res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Idempotency-Key, X-CSRF-Token, If-None-Match');
 res.setHeader('Access-Control-Max-Age','600');
 return !origin||allowedOrigins.has(origin);
}
function requireConfigured(){
 const e=env();
 if(!e.db||!e.secret||!e.account||!e.adminHash||!e.adminUser)
  throw fail(503,'BETA private database / administrator credentials are not configured.');
 if(!/^https:\/\/[a-z0-9.-]+\.(?:firebaseio\.com|firebasedatabase\.app)$/.test(e.db))
  throw fail(503,'Private database URL is invalid.');
 if(e.db.includes(DEMO_DB)||e.db===BASE_MENU)
  throw fail(503,'DEMO database cannot store private BETA customer orders.');
 if(e.secret.length<32)throw fail(503,'Session secret is missing.');
 if(!e.smsToken||!e.resendKey||!e.emailFrom)throw fail(503,'BETA notification provider credentials are missing.');
 let account;try{account=JSON.parse(e.account);}catch{throw fail(503,'Invalid service account.');}
 if(!account.client_email||!account.private_key||!account.project_id)throw fail(503,'Invalid service account.');
 return {...e,account};
}
async function tokenFor(e){
 if(accessCache.until>Date.now()+120000)return accessCache.value;
 const now=Math.floor(Date.now()/1000);
 const head=b64({alg:'RS256',typ:'JWT'});
 const body=b64({iss:e.account.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500});
 const input=head+'.'+body;
 const assertion=input+'.'+crypto.sign('RSA-SHA256',Buffer.from(input),e.account.private_key).toString('base64url');
 const form=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion});
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:form,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 if(!response.ok)throw fail(503,'Unable to authenticate Firebase service account.');
 const data=await response.json();
 if(!data.access_token)throw fail(503,'Firebase service account access denied.');
 accessCache={value:data.access_token,until:Date.now()+Math.min(3300000,number(data.expires_in)*1000)};
 return accessCache.value;
}
/* An OAuth token in an Authorization header is never exposed in URLs or logs. */
async function db(e,path,{method='GET',body,etag=false,match,query='',accept}={}){
 const bearer=await tokenFor(e);
 const headers={'Authorization':'Bearer '+bearer,'Accept':accept||'application/json'};
 if(etag)headers['X-Firebase-ETag']='true';
 if(match!==undefined)headers['If-Match']=match;
 if(body!==undefined)headers['Content-Type']='application/json';
 const req=await fetch(e.db+'/'+path+'.json'+query,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'
 });
 if(req.status===412)return {status:412};
 if(!req.ok)throw fail(503,'Private Firebase request failed.');
 return {status:req.status,etag:req.headers.get('ETag'),data:await req.json()};
}

let privacyCheckedUntil=0;
async function assertPrivacy(e,tenant){
 if(privacyCheckedUntil>Date.now())return;
 const response=await fetch(e.db+'/tenants/'+tenant+'/orders/active.json?shallow=true',{cache:'no-store'});
 if(response.status!==401&&response.status!==403)throw fail(503,'Private BETA orders readable without authentication.');
 privacyCheckedUntil=Date.now()+120000;
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function confirmedTime(o){
 return new Intl.DateTimeFormat('nb-NO',{timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(o.estimatedReadyAt));
}
async function providerSend(e,o,type){
 if(type==='sms'){
  if(!e.smsToken)return false;
  const phone='+47'+String(o.phone||'').replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'');
  if(!/^\+47[49]\d{7}$/.test(phone))return false;
  const name=str(o.customerName).split(/\s+/)[0].replace(/[^a-zA-ZæøåÆØÅ'-]/g,'').slice(0,20);
  const message='Hei '+name+'! Bestillingen din er bekreftet. Hentetid: '+confirmedTime(o)+'. – KØL Grill & Pizza';
  const response=await fetch('https://www.traccar.org/sms/',{
   method:'POST',headers:{Authorization:e.smsToken,'Content-Type':'application/json'},
   body:JSON.stringify({to:phone,message}),signal:AbortSignal.timeout(7000)
  });
  const payload=await response.json().catch(()=>null);
  return response.ok&&Number(payload?.successCount)>=1&&Number(payload?.failureCount||0)===0;
 }
 if(type==='email'){
  if(!o.email||!e.resendKey||!e.emailFrom)return false;
  const subtotal=o.total,vat=Math.round(subtotal*15/115*100)/100;
  const list=o.lines.map(line=>'<li><b>'+escape(line.quantity+'× '+line.name)+'</b> '+escape(line.size)+' — '+escape(line.price)+' kr</li>').join('');
  const html='<div style="font:16px Arial;max-width:640px;padding:22px"><h1>KØL Grill & Pizza</h1><h2>Bestillingen din er bekreftet</h2><h1>Hentetid: '+escape(confirmedTime(o))+'</h1><p>#'+escape(o.id)+'</p><ul>'+list+'</ul><p>Totalt: <b>'+escape(o.total)+' kr</b></p><p>MVA 15%: '+vat+' kr</p><p>Øgardsvegen 44, Skarnes</p></div>';
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+e.resendKey,'Content-Type':'application/json','Idempotency-Key':'kol-beta-'+o.id+'-accepted'},
   body:JSON.stringify({from:e.emailFrom,to:[o.email],reply_to:'skarnes.restaurant@gmail.com',
    subject:'Bestillingen din er bekreftet – KØL Grill & Pizza',html,
    text:'Bestillingen din er bekreftet. Hentetid: '+confirmedTime(o)+'. Totalt: '+o.total+' kr.'}),
   signal:AbortSignal.timeout(7000)
  });
  return response.ok;
 }
 return false;
}
/** CAS claim BEFORE contacting providers. At most one SMS attempt per order.
 * Unknown transport outcomes are recorded as uncertain, never retried blindly.
 */
async function attemptNotify(e,tenant,id,type){
 const path=privatePath(tenant,'orders/active/'+id);
 let claimed=null;
 for(let i=0;i<4;i++){
  const current=await db(e,path,{etag:true});
  if(!current.data||current.data.notifications?.[type]?.state!=='pending')return;
  claimed={...current.data,notifications:{...current.data.notifications,[type]:{state:'attempted',at:Date.now()}}};
  const saved=await db(e,path,{method:'PUT',match:current.etag,body:claimed});
  if(saved.status!==412)break;
  claimed=null;
 }
 if(!claimed)return;
 let delivered=false;
 try{delivered=await providerSend(e,claimed,type);}catch{}
 for(let i=0;i<4;i++){
  const row=await db(e,path,{etag:true});
  if(!row.data||row.data.notifications?.[type]?.state!=='attempted')return;
  const next={...row.data,notifications:{...row.data.notifications,
   [type]:{state:delivered?'accepted':'uncertain',at:Date.now()}}};
  if((await db(e,path,{method:'PUT',body:next,match:row.etag})).status!==412)return;
 }
}
async function notifyAccepted(e,tenant,id){
 await Promise.allSettled(['sms','email'].map(type=>attemptNotify(e,tenant,id,type)));
}

function makeSession(e,tenant){
 const payload=b64({tenant,role:'admin',exp:Date.now()+8*3600000,nonce:crypto.randomBytes(8).toString('hex')});
 return payload+'.'+hmac(e.secret,payload);
}
function verifySession(e,req,tenant){
 const header=String(req.headers.authorization||'');
 const t=header.startsWith('Bearer ')?header.slice(7):'';
 const [payload,signature,extra]=t.split('.');
 if(!payload||!signature||extra||!equals(signature,hmac(e.secret,payload)))throw fail(401,'Login required.');
 let data;try{data=JSON.parse(Buffer.from(payload,'base64url').toString())}catch{throw fail(401,'Invalid login.');}
 if(data.tenant!==tenant||data.role!=='admin'||data.exp<Date.now())throw fail(401,'Expired login.');
 return {token:t,csrfToken:hmac(e.secret,'csrf:'+t)};
}
function verifyAdmin(e,req,tenant,mutation=false){
 const user=verifySession(e,req,tenant);
 if(mutation&&!equals(req.headers['x-csrf-token']||'',user.csrfToken))throw fail(403,'CSRF check failed.');
 return user;
}
function comparePassword(password,encoded){
 const pair=String(encoded).split(':');
 if(pair.length!==2||!(/^[a-f0-9]{32,64}$/i.test(pair[0]))||!(/^[a-f0-9]{64}$/i.test(pair[1])))throw fail(503,'Invalid admin password verifier.');
 const hash=crypto.pbkdf2Sync(String(password),Buffer.from(pair[0],'hex'),250000,32,'sha256');
 return equals(hash.toString('hex'),pair[1]);
}
function privatePath(tenant,sub){return 'tenants/'+tenant+'/'+sub;}
/** Trusted menu snapshot: never price orders from anonymously writable DEMO.
 * Admin imports a reviewed snapshot after authenticating; edits elsewhere do
 * not change these server prices until an authorized import updates revision.
 */
async function menu(e,tenant){
 const root=privatePath(tenant,'catalog');
 const ver=await db(e,root+'/updatedAt');
 const revision=ver.data;
 if(!revision)throw fail(503,'Private BETA menu has not been imported.');
 if(menuCache.data&&String(menuCache.version)===String(revision))return menuCache.data;
 const [sections,optionGroups,siteSettings]=await Promise.all([
  db(e,root+'/sections'),db(e,root+'/optionGroups'),db(e,root+'/siteSettings')
 ]);
 const data={sections:fields(sections.data),groups:fields(optionGroups.data),settings:siteSettings.data||{}};
 if(!data.sections.length)throw fail(503,'Private BETA menu is empty.');
 menuCache={version:revision,loaded:Date.now(),data};
 return data;
}
async function importTrustedMenu(e,tenant,res){
 // Staff explicitly imports the legacy public menu into a LOCKED BETA database.
 const [rev,sections,optionGroups,siteSettings]=await Promise.all(
  ['updatedAt','sections','optionGroups','siteSettings'].map(async path=>{
   const r=await fetch(BASE_MENU+'/'+path+'.json',{cache:'no-store'});
   if(!r.ok)throw fail(503,'Could not fetch public menu.');
   return r.json();
  })
 );
 if(!sections||!rev)throw fail(503,'Legacy menu is empty.');
 const snapshot={updatedAt:rev,sections,optionGroups,siteSettings};
 const root=privatePath(tenant,'catalog');
 await db(e,root,{method:'PUT',body:snapshot});
 menuCache={version:null,loaded:0,data:null};
 return write(res,200,{imported:true,version:rev});
}
function currentLocal(timestamp){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp));
 const get=key=>parts.find(p=>p.type===key)?.value||'';
 return {day:['mon','tue','wed','thu','fri','sat','sun'].indexOf(get('weekday').toLowerCase().slice(0,3)),minutes:Number(get('hour'))%24*60+Number(get('minute'))};
}
function openAt(time,settings){
 const local=currentLocal(time),week=fields(settings.weeklyHours);
 const norm=day=>{
  const item=week[day];if(!item)return {enabled:true,open:settings.orderOpenTime||'14:00',close:settings.orderCloseTime||'22:00'};
  return item;
 };
 const m=value=>{const match=/^(\d{2}):(\d{2})$/.exec(str(value));return match?Number(match[1])*60+Number(match[2]):null;};
 const today=norm(local.day),yesterday=norm((local.day+6)%7);
 const inside=(o)=>{const start=m(o.open||o.from),end=m(o.close||o.to);if(start===null||end===null||o.enabled===false)return false;return end>start?local.minutes>=start&&local.minutes<end:local.minutes>=start||local.minutes<end;};
 const fromY=()=>{const a=m(yesterday.open||yesterday.from),b=m(yesterday.close||yesterday.to);return yesterday.enabled!==false&&a!==null&&b!==null&&b<=a&&local.minutes<b;};
 return inside(today)||fromY();
}
function checkOrder(input,data,tenant){
 const settings=data.settings||{},now=Date.now();
 if(settings.manualClosed&&(Number(settings.manualClosedUntil||0)===0||Number(settings.manualClosedUntil)>now))throw fail(409,'Restaurant closed.');
 if(!openAt(now,settings))throw fail(409,'Restaurant closed.');
 const name=str(input.customerName),phone=str(input.phone).replace(/\D/g,'');
 if(name.length<2||name.length>90||!/^[49]\d{7}$/.test(phone))throw fail(422,'Invalid name or phone.');
 const email=str(input.email);if(email.length>160||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw fail(422,'Invalid email.');
 const source=Array.isArray(input.lines)?input.lines:[];
 if(!source.length||source.length>40)throw fail(422,'Invalid order lines.');
 let total=0,pizzaCount=0;
 const validated=source.map(line=>{
  const itemId=str(line.itemId||line.productId),sizeId=str(line.sizeId);
  const product=data.sections.flatMap(section=>fields(section.items).filter(x=>!section.hidden&&!x.hidden&&!x.soldOut&&!x.hidden).map(x=>({...x,_section:section}))).find(x=>str(x.id)===itemId);
  if(!product)throw fail(422,'Product not available.');
  const size=fields(product.sizes).find(s=>str(s.id)===sizeId);
  if(!size||!Number.isFinite(Number(size.price)))throw fail(422,'Invalid size.');
  const quantity=number(line.quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>30)throw fail(422,'Invalid quantity.');
  const options=Array.isArray(line.options)?line.options:[];
  const attached=new Set([...fields(product.optionGroupIds),...fields(size.optionGroupIds)].map(v=>typeof v==='string'?v:str(v.id)));
  const chosen=new Map();
  let unit=number(size.price);
  for(const entry of options){
   const groupId=str(entry.groupId),id=str(entry.id);
   if(!attached.has(groupId))throw fail(422,'Unrecognized option group.');
   const group=data.groups.find(g=>str(g.id)===groupId);
   const value=fields(group?.options).find(v=>str(v.id)===id&&!v.soldOut);
   if(!value)throw fail(422,'Unavailable option.');
   const selections=chosen.get(groupId)||new Set();
   if(selections.has(id))throw fail(422,'Duplicate option.');
   selections.add(id);chosen.set(groupId,selections);
   unit+=number(value.price);
  }
  for(const groupId of attached){
   const group=data.groups.find(g=>str(g.id)===groupId);
   if(!group)continue;
   const selected=chosen.get(groupId)?.size||0;
   const min=group.required?Math.max(1,number(group.minSelections)):number(group.minSelections);
   const max=group.selectionMode==='multiple'?Math.max(1,number(group.maxSelections)||99):1;
   if(selected<min||selected>max)throw fail(422,'Invalid options.');
  }
  const removed=(Array.isArray(line.removedIngredients)?line.removedIngredients:[]).map(str).slice(0,24);
  if(removed.some(x=>x.length>80))throw fail(422,'Invalid ingredient.');
  const comment=str(line.comment).slice(0,400);
  const lineTotal=Math.round(unit*quantity*100)/100;
  total+=lineTotal;
  if(/pizza/i.test(product._section.title||''))pizzaCount+=quantity;
  return {itemId,productId:itemId,name:str(product.name),sizeId,size:str(size.label||size.name),quantity,
   options:options.map(entry=>({groupId:str(entry.groupId),id:str(entry.id),
     label:str(data.groups.find(g=>str(g.id)===str(entry.groupId))?.options&&fields(data.groups.find(g=>str(g.id)===str(entry.groupId)).options).find(o=>str(o.id)===str(entry.id))?.label||entry.label)})),
   removedIngredients:removed,comment,price:lineTotal};
 });
 if(!Number.isFinite(total)||total<=0||total>25000)throw fail(422,'Invalid total.');
 if(Math.abs(number(input.total)-total)>0.009)throw fail(409,'Menu prices changed. Refresh the menu.');
 const pickupMode=str(input.pickupMode);
 if(!['asap','scheduled'].includes(pickupMode))throw fail(422,'Pickup mode is required.');
 let scheduledPickupAt=0,pickup='Snarest';
 if(pickupMode==='scheduled'){
  const match=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(str(input.pickup));
  if(!match)throw fail(422,'Invalid pickup clock.');
  const minutes=Number(match[1])*60+Number(match[2]),minimum=now+(number(settings.prepMinutes)||25)*60000;
  for(let t=minimum;t<now+26*3600000;t+=60000){
   const loc=currentLocal(t);
   if(loc.minutes===minutes && openAt(t,settings)){scheduledPickupAt=t;break;}
  }
  if(!scheduledPickupAt)throw fail(422,'Pickup time is unavailable.');
  pickup=str(input.pickup);
 }
 return {tenantId:tenant,customerName:name,phone,email,pickupMode,pickup,scheduledPickupAt,
  total:Math.round(total*100)/100,lines:validated,pizzaCount,
  createdAt:now,status:'mottatt',statusUpdatedAt:now};
}
function orderSecret(e,id){return hmac(e.secret,'customer-order:'+id);}
function customerAllowed(e,req,order){
 const value=String(req.headers.authorization||'').replace(/^Bearer /,'');
 return value&&equals(value,orderSecret(e,order.id));
}
function publicStatus(o){
 return {id:o.id,status:o.status,statusUpdatedAt:o.statusUpdatedAt,estimatedReadyAt:o.estimatedReadyAt||0};
}
function recordPublic(o){
 const {fingerprint, ...rest}=o;
 return rest;
}
function readOrigin(req){return String(req.headers.origin||'');}
async function getPrivateOrder(e,tenant,id){
 const row=await db(e,privatePath(tenant,'orders/active/'+id),{etag:true});
 if(row.data)return {...row,section:'active'};
 const archived=await db(e,privatePath(tenant,'orders/archive/'+id),{etag:true});
 return {...archived,section:'archive'};
}
async function submit(e,req,tenant,res){
 const key=str(req.headers['idempotency-key']);
 if(!/^[a-f0-9-]{36}$/i.test(key))throw fail(422,'Idempotency key required.');
 const body=json(req);
 if(body.tenantId!==tenant)throw fail(403,'Wrong tenant.');
 const bodyHash=digest(JSON.stringify(body)),id='ord_'+hmac(e.secret,tenant+'|'+key).replace(/[-_]/g,'').slice(0,24);
 const path=privatePath(tenant,'orders/active/'+id);
 // Read-only existence check prevents duplicate work / large menu reads on retry.
 const existing=await getPrivateOrder(e,tenant,id);
 if(existing.data){
  if(existing.data.fingerprint!==bodyHash)throw fail(409,'Idempotency collision.');
  return write(res,200,{id,status:existing.data.status,createdAt:existing.data.createdAt,
    accessToken:orderSecret(e,id)});
 }
 const data=await menu(e,tenant);
 const checked=checkOrder(body,data,tenant);
 const order={...checked,id,fingerprint:bodyHash};
 const inserted=await db(e,path,{method:'PUT',match:'null_etag',body:order});
 if(inserted.status===412){
  const record=await getPrivateOrder(e,tenant,id);
  if(!record.data||record.data.fingerprint!==bodyHash)throw fail(409,'Idempotency conflict.');
  return write(res,200,{id,status:record.data.status,createdAt:record.data.createdAt,
    accessToken:orderSecret(e,id)});
 }
 return write(res,201,{id,status:'mottatt',createdAt:checked.createdAt,
  accessToken:orderSecret(e,id)});
}
async function status(e,req,tenant,id,res){
 const record=await getPrivateOrder(e,tenant,id);
 if(!record.data||!customerAllowed(e,req,record.data))throw fail(404,'Order not found.');
 const etag='"'+record.data.statusUpdatedAt+'"';
 res.setHeader('ETag',etag);
 if(req.headers['if-none-match']===etag)return res.status(304).end();
 return write(res,200,publicStatus(record.data));
}
function active(o){return o&&['mottatt','bekreftet','tilberedning','klar'].includes(o.status);}
async function listActive(e,tenant,res){
 const data=await db(e,privatePath(tenant,'orders/active'),{query:'?orderBy=%22createdAt%22&limitToLast=100'});
 const orders=Object.values(data.data||{}).filter(active).sort((a,b)=>b.createdAt-a.createdAt).map(recordPublic);
 return write(res,200,{orders});
}
async function transition(e,req,tenant,id,kind,res){
 const body=json(req),allowed={confirm:'mottatt',ready:'bekreftet',complete:'klar'};
 if(!allowed[kind])throw fail(404,'Unknown action.');
 for(let attempt=0;attempt<4;attempt++){
  const current=await db(e,privatePath(tenant,'orders/active/'+id),{etag:true});
  const before=current.data;
  if(!before)throw fail(404,'Order not found.');
  if(before.tenantId!==tenant)throw fail(403,'Wrong restaurant.');
  if(before.status!==allowed[kind]){
   if((kind==='confirm'&&['bekreftet','tilberedning','klar'].includes(before.status))||
      (kind==='ready'&&before.status==='klar')||
      (kind==='complete'&&before.status==='fullfort'))
    if(kind==='confirm'&&before.notifications)await notifyAccepted(e,tenant,id);
   return write(res,200,{order:recordPublic(before),transitioned:false});
   throw fail(409,'Order status changed.');
  }
  if(body.expectedStatus!==before.status||number(body.expectedVersion)!==number(before.statusUpdatedAt))
    throw fail(409,'Order was updated, refresh.');
  const now=Date.now(),next={...before,status:kind==='confirm'?'bekreftet':kind==='ready'?'klar':'fullfort',statusUpdatedAt:now};
  if(kind==='confirm'){
   const wait=before.pickupMode==='scheduled'?Math.ceil((before.scheduledPickupAt-now)/60000):number(body.estimatedMinutes);
   if(!Number.isInteger(wait)||wait<1||wait>180)throw fail(422,'Invalid preparation time.');
   next.estimatedMinutes=wait;next.estimatedAt=now;next.estimatedReadyAt=before.pickupMode==='scheduled'?before.scheduledPickupAt:now+wait*60000;
   next.confirmedAt=now;
   // Durable, single confirmation intent lives with the order.
   next.notifications={...(before.notifications||{}),
     sms:{state:e.smsToken?'pending':'not-configured',at:now},
     email:{state:before.email&&e.resendKey&&e.emailFrom?'pending':'not-configured',at:now}};
  }
  if(kind==='ready')next.staffReadyAt=now;
  const result=await db(e,privatePath(tenant,'orders/active/'+id),{method:'PUT',body:next,match:current.etag});
  if(result.status===412)continue;
  if(kind==='complete'){
   // Atomic move: the entire active list is never fetched by the customer.
   await db(e,privatePath(tenant,''),{method:'PATCH',body:{
    ['orders/archive/'+id]:next,['orders/active/'+id]:null
   }});
  }
  if(kind==='confirm')await notifyAccepted(e,tenant,id);
  const confirmed=kind==='confirm'?await db(e,privatePath(tenant,'orders/active/'+id)):null;
  return write(res,200,{order:recordPublic(confirmed?.data||next),transitioned:true});
 }
 throw fail(409,'Order changed. Retry.');
}

/** Server-side RTDB SSE bridge; browsers NEVER receive Firebase credentials.
 * One upstream listener scoped to a tenant's last 100 ACTIVE orders, or
 * to one authorized private order. All returned client events are sanitized.
 */
async function streamFirebase(e,req,res,path,{query='',transform}){
 const token=await tokenFor(e);
 const controller=new AbortController();
 res.on('close',()=>controller.abort());
 const response=await fetch(e.db+'/'+path+'.json'+query,{
  method:'GET',cache:'no-store',
  headers:{Authorization:'Bearer '+token,Accept:'text/event-stream'},
  signal:controller.signal
 });
 if(!response.ok||!response.body)throw fail(503,'Order events unavailable.');
 res.statusCode=200;
 res.setHeader('Content-Type','text/event-stream; charset=utf-8');
 res.setHeader('Cache-Control','no-cache, no-transform');
 res.setHeader('X-Accel-Buffering','no');
 res.flushHeaders?.();
 res.write(': connected\n\n');
 let buf='',sent=0;
 const timeout=setTimeout(()=>controller.abort(),210000);
 const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': heartbeat\n\n');},25000);
 try{
  const reader=response.body.getReader(),decoder=new TextDecoder();
  while(!res.destroyed&&sent<10000){
   const {done,value}=await reader.read();
   if(done)break;
   buf+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
   if(buf.length>256000)throw new Error('Oversized Firebase event');
   let i;
   while((i=buf.indexOf('\n\n'))>=0){
    const raw=buf.slice(0,i);buf=buf.slice(i+2);
    const event=raw.split('\n').find(line=>line.startsWith('event:'))?.slice(6).trim();
    const data=raw.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!['put','patch'].includes(event)||!data)continue;
    let parsed;try{parsed=JSON.parse(data);}catch{continue;}
    const messages=await transform(parsed,event);
    for(const message of messages||[]){
     if(res.writableEnded)break;
     res.write('data: '+JSON.stringify(message)+'\n\n');sent++;
    }
   }
  }
 }catch(err){
  if(!controller.signal.aborted)console.warn('BETA event stream closed:',err.message);
 }finally{
  clearTimeout(timeout);clearInterval(heartbeat);controller.abort();
  if(!res.writableEnded)res.end();
 }
}
async function streamCustomer(e,req,tenant,id,res){
 const record=await getPrivateOrder(e,tenant,id);
 if(!record.data||!customerAllowed(e,req,record.data))throw fail(404,'Order not found.');
 if(record.section==='archive'){
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.write('data: '+JSON.stringify(publicStatus(record.data))+'\n\n');
  return res.end();
 }
 const path=privatePath(tenant,'orders/active/'+id);
 let last='';
 return streamFirebase(e,req,res,path,{transform:async packet=>{
  if(packet.path==='/'&&packet.data&&packet.data.id===id){
   const publicValue=publicStatus(packet.data);
   const hash=JSON.stringify(publicValue);
   if(hash!==last){last=hash;return [publicValue];}
  }
  return [];
 }});
}
async function streamAdmin(e,req,tenant,res){
 verifyAdmin(e,req,tenant);
 const byId=new Map(),path=privatePath(tenant,'orders/active');
 return streamFirebase(e,req,res,path,{
  query:'?orderBy=%22createdAt%22&limitToLast=100',
  transform:async packet=>{
   const output=[];
   if(packet.path==='/'){
    byId.clear();
    for(const entry of Object.values(packet.data||{})){
     if(active(entry)&&entry.tenantId===tenant)byId.set(entry.id,entry);
    }
    output.push({type:'snapshot',orders:[...byId.values()].sort((a,b)=>b.createdAt-a.createdAt).map(recordPublic)});
   }else{
    const pathParts=str(packet.path).split('/').filter(Boolean);
    const id=pathParts[0];
    if(!idValid(id))return [];
    if(packet.data===null){
     byId.delete(id);output.push({type:'remove',id});
    }else if(pathParts.length===1 && packet.data?.tenantId===tenant){
     const newOrder=packet.data;
     if(active(newOrder)){
      byId.set(id,newOrder);output.push({type:'upsert',order:recordPublic(newOrder)});
     }else{byId.delete(id);output.push({type:'remove',id});}
    }else{
     // A nested patch cannot be safely merged into a complete order object.
     // Omit rather than sending partial PII/status; next reconnect snapshots.
    }
   }
   return output;
  }
 });
}


/** Adjust only a staff-confirmed order's prep time; never trigger another SMS. */
async function updateEstimate(e,req,tenant,id,res){
 const requested=json(req),minutes=Number(requested.estimatedMinutes);
 if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw fail(422,'Preparation time must be 1–180 minutes.');
 const path=privatePath(tenant,'orders/active/'+id);
 for(let attempt=0;attempt<4;attempt++){
  const current=await db(e,path,{etag:true});
  const order=current.data;
  if(!order||order.tenantId!==tenant)throw fail(404,'Order not found.');
  if(!['bekreftet','tilberedning'].includes(order.status))throw fail(409,'Order no longer accepts time changes.');
  if(Number(requested.expectedVersion)!==Number(order.statusUpdatedAt))throw fail(409,'Order status changed.');
  const now=Date.now();
  const updated={...order,estimatedMinutes:minutes,estimatedAt:now,estimatedReadyAt:now+minutes*60000,estimateUpdatedAt:now};
  const result=await db(e,path,{method:'PUT',match:current.etag,body:updated});
  if(result.status!==412)return write(res,200,{order:recordPublic(updated),transitioned:true});
 }
 throw fail(409,'Order was changed. Refresh.');
}

async function login(e,req,tenant,res){
 const input=json(req),username=str(input.username),password=str(input.password);
 if(username.length>100||password.length>200)throw fail(401,'Wrong login.');
 if(!equals(username,e.adminUser)||!comparePassword(password,e.adminHash))throw fail(401,'Wrong login.');
 const token=makeSession(e,tenant);
 return write(res,200,{authenticated:true,accessToken:token,csrfToken:hmac(e.secret,'csrf:'+token)});
}
function routePath(req){
 const p=req.query?.path;
 if(typeof p==='string')return p.replace(/^\/+/,'');
 if(Array.isArray(p))return p.join('/');
 const u=new URL(req.url,'https://localhost');
 return u.pathname.replace(/^\/api\/beta\/?/,'');
}
module.exports=async function betaHandler(req,res){
 noCache(res);
 const ok=cors(req,res);
 if(req.method==='OPTIONS')return res.status(ok?204:403).end();
 if(!ok)return write(res,403,{error:'Origin denied.'});
 try{
  if(Number(req.headers['content-length']||0)>45000)throw fail(413,'Request too large.');
  const route=routePath(req),match=/^v1\/tenants\/([a-z0-9-]{3,51})\/(.*)$/.exec(route);
  if(!match)throw fail(404,'Not found.');
  const tenant=match[1],sub=match[2];
  if(!tenantValid(tenant)||tenant!=='kol-grill-pizza')throw fail(404,'Unknown tenant.');
  const e=requireConfigured();
  await assertPrivacy(e,tenant);
  if(sub==='orders'&&req.method==='POST')return await submit(e,req,tenant,res);
  if(sub==='admin/sessions'&&req.method==='POST')return await login(e,req,tenant,res);
  if(sub==='admin/menu/status'&&req.method==='GET'){
   verifyAdmin(e,req,tenant);
   const v=await db(e,privatePath(tenant,'catalog/updatedAt'));
   return write(res,200,{configured:Boolean(v.data),version:v.data||null});
  }
  if(sub==='admin/menu/import'&&req.method==='POST'){
   verifyAdmin(e,req,tenant,true);
   return importTrustedMenu(e,tenant,res);
  }
  if(sub==='admin/session'&&req.method==='GET'){
   const auth=verifyAdmin(e,req,tenant);
   return write(res,200,{authenticated:true,csrfToken:auth.csrfToken});
  }
  if(sub==='admin/sessions'&&req.method==='DELETE'){
   verifyAdmin(e,req,tenant,true);
   return res.status(204).end();
  }
  if(sub==='admin/orders/events'&&req.method==='GET')return streamAdmin(e,req,tenant,res);
  if(sub==='admin/orders'&&req.method==='GET'){
   verifyAdmin(e,req,tenant);
   if(req.query?.status!=='active'||String(req.query?.limit)!=='100')throw fail(422,'Only bounded active queries.');
   return listActive(e,tenant,res);
  }
  const estimateAction=/^admin\/orders\/(ord_[a-zA-Z0-9_-]{15,50})\/estimate$/.exec(sub);
  if(estimateAction&&req.method==='POST'){
   verifyAdmin(e,req,tenant,true);
   return updateEstimate(e,req,tenant,estimateAction[1],res);
  }
  const action=/^admin\/orders\/(ord_[a-zA-Z0-9_-]{15,50})\/(confirm|ready|complete)$/.exec(sub);
  if(action&&req.method==='POST'){
   verifyAdmin(e,req,tenant,true);
   return transition(e,req,tenant,action[1],action[2],res);
  }
  const events=/^orders\/(ord_[a-zA-Z0-9_-]{15,50})\/events$/.exec(sub);
  if(events&&req.method==='GET')return streamCustomer(e,req,tenant,events[1],res);
  const customer=/^orders\/(ord_[a-zA-Z0-9_-]{15,50})\/status$/.exec(sub);
  if(customer&&req.method==='GET')return status(e,req,tenant,customer[1],res);
  throw fail(404,'Unknown endpoint.');
 }catch(error){
  const code=Number(error.status)||500;
  if(code>=500)console.error('BETA backend unavailable:',error.message);
  return write(res,code>=400&&code<=599?code:500,{error:code<500?error.message:'Service unavailable.'});
 }
};
