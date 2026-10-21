/** BETA-only test orders in the existing KØL Firebase Realtime Database.
 * Direct REST; NO Cloud Functions, Vercel, service credentials, or real customers.
 * Never transmit user names, phones, emails, or checkout comments to public test RTDB.
 * This cannot be promoted to real customer orders without private auth/rules.
 */
import {config} from './config.js?v=20261021-beta28';
const root=()=>config.testDatabaseUrl.replace(/\/$/,'')+'/betaTest/orders';
const safeId=id=>/^test_[0-9]{13}_[a-f0-9]{12}$/.test(String(id||''));
const url=(id='',query='')=>root()+(id?'/'+encodeURIComponent(id):'')+'.json'+query;
const limitQuery='?orderBy=%22%24key%22&limitToLast=100';
function friendlyError(response){
 if(response.status===401||response.status===403)throw new Error('Firebase-tillatelser mangler for betaTest/orders. Ingen testbestilling ble lagret.');
 throw new Error('Firebase database svarer ikke (HTTP '+response.status+').');
}
async function firebase(path,{method='GET',body,etag=false,match,signal,accept}={}){
 const headers={Accept:accept||'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(etag)headers['X-Firebase-ETag']='true';
 if(match!==undefined)headers['If-Match']=match;
 const response=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});
 if(response.status===412)return {conflict:true};
 if(!response.ok)friendlyError(response);
 return {value:await response.json().catch(()=>null),etag:response.headers.get('ETag')};
}
function scheduledAt(clock,from=Date.now()){
 if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(clock||'')))return 0;
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const minute=60000,start=Math.ceil((from+5*minute)/minute)*minute;
 for(let timestamp=start;timestamp<from+26*3600000;timestamp+=minute)
  if(formatter.format(new Date(timestamp))===clock)return timestamp;
 return 0;
}
const projected=o=>o&&o.testMode===true&&safeId(o.id)&&o.tenantId===config.tenantId?o:null;
const listOf=data=>Object.values(data||{}).map(projected).filter(Boolean).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,100);
export async function listTestOrders({signal}={}){
 const result=await firebase(url('',limitQuery),{signal});
 return listOf(result.value);
}
export async function testHealth(){
 await firebase(url('', '?orderBy=%22%24key%22&limitToLast=1'));
 return true;
}
export async function addTestOrder(order,key,startedAt){
 if(!/^[a-f0-9-]{36}$/i.test(key)||!Number.isSafeInteger(startedAt))throw new Error('Ugyldig testbestillings-ID.');
 const id='test_'+String(startedAt).padStart(13,'0')+'_'+key.replace(/-/g,'').slice(0,12);
 if(!safeId(id))throw new Error('Ugyldig test-ID.');
 const lines=(Array.isArray(order.lines)?order.lines:[]).slice(0,40).map(line=>({
  itemId:String(line.itemId||line.productId||'').slice(0,80),
  name:String(line.name||'Produkt').slice(0,100),
  size:String(line.size||'').slice(0,50),
  quantity:Math.max(1,Math.min(30,Math.round(Number(line.quantity)||1))),
  price:Math.round((Number(line.price)||0)*100)/100,
  options:(Array.isArray(line.options)?line.options:[]).slice(0,30).map(o=>({label:String(o.label||'').slice(0,80)})),
  removedIngredients:(Array.isArray(line.removedIngredients)?line.removedIngredients:[]).slice(0,15).map(s=>String(s).slice(0,60)),
  comment:'' // No free text in publicly visible test data.
 }));
 if(!lines.length)throw new Error('Handlekurven er tom.');
 const clean={id,tenantId:config.tenantId,testMode:true,customerName:'BETA TEST',phone:'',email:'',
  type:'henting',pickupMode:order.pickupMode==='scheduled'?'scheduled':'asap',
  pickup:order.pickupMode==='scheduled'?String(order.pickup||'').slice(0,5):'Snarest',
  scheduledPickupAt:order.pickupMode==='scheduled'?scheduledAt(String(order.pickup||'')):0,estimatedReadyAt:0,
  total:Math.round((Number(order.total)||0)*100)/100,lines,
  status:'mottatt',createdAt:startedAt,statusUpdatedAt:startedAt,
  notifications:{sms:{state:'disabled-test'},email:{state:'disabled-test'}}};
 if(!Number.isFinite(clean.total)||clean.total<=0)throw new Error('Ugyldig testbeløp.');
 if(clean.pickupMode==='scheduled'&&!clean.scheduledPickupAt)throw new Error('Ugyldig hentetid i testbestillingen.');
 const stored=await firebase(url(id),{method:'PUT',body:clean,match:'null_etag'});
 if(stored.conflict){
  const existing=projected((await firebase(url(id))).value);
  if(!existing)throw new Error('Testbestillingen ble endret. Oppdater siden.');
  return existing;
 }
 return clean;
}
export async function getTestOrder(id,{signal}={}){
 if(!safeId(id))return null;
 return projected((await firebase(url(id),{signal})).value);
}
export async function updateTestOrder(id,action,input={}){
 if(!safeId(id))throw new Error('Ugyldig ordre-ID.');
 const existing=await firebase(url(id),{etag:true});
 const order=projected(existing.value);
 if(!order)throw new Error('Testbestillingen finnes ikke.');
 const allowed={confirm:['mottatt'],estimate:['bekreftet','tilberedning'],
  ready:['bekreftet','tilberedning'],complete:['klar']};
 if(!allowed[action]?.includes(order.status))throw new Error('Statusen er allerede endret.');
 if(input.expectedStatus!==order.status||Number(input.expectedVersion)!==Number(order.statusUpdatedAt))
  throw new Error('Status endret. Oppdater først.');
 const now=Math.max(Date.now(),Number(order.statusUpdatedAt||0)+1),next={...order,statusUpdatedAt:now};
 if(action==='confirm'){
  next.status='bekreftet';
  const mins=order.pickupMode==='scheduled'?Math.max(1,Math.ceil((order.scheduledPickupAt-now)/60000)):Number(input.estimatedMinutes);
  if(!Number.isInteger(mins)||mins<1||mins>180)throw new Error('Velg 1–180 minutter.');
  next.estimatedMinutes=mins;
  next.estimatedReadyAt=order.pickupMode==='scheduled'?order.scheduledPickupAt:now+mins*60000;
  next.confirmedAt=now;
 }else if(action==='estimate'){
  const mins=Number(input.estimatedMinutes);
  if(!Number.isInteger(mins)||mins<1||mins>180)throw new Error('Velg 1–180 minutter.');
  next.estimatedMinutes=mins;next.estimatedReadyAt=now+mins*60000;
  next.estimateUpdatedAt=now;
 }else if(action==='ready'){next.status='klar';next.staffReadyAt=now;}
 else if(action==='complete'){next.status='fullfort';next.completedAt=now;}
 const saved=await firebase(url(id),{method:'PUT',body:next,match:existing.etag});
 if(saved.conflict)throw new Error('Bestillingen ble oppdatert i en annen fane.');
 return {order:next,transitioned:true};
}
/** One bounded Firebase RTDB SSE connection, only while the Admin tab is visible.
 * Firebase emits raw put/patch events rather than app gateway messages. */
export async function streamTestOrders(onList,signal){
 const response=await fetch(url('',limitQuery),{headers:{Accept:'text/event-stream'},signal,cache:'no-store'});
 if(!response.ok)friendlyError(response);
 if(!response.body||!response.headers.get('Content-Type')?.includes('text/event-stream'))throw new Error('Firebase live-strøm er utilgjengelig.');
 const rows={};
 const publish=()=>onList(listOf(rows));
 const apply=(packet,kind)=>{
  if(!packet||typeof packet.path!=='string')return;
  const parts=packet.path.split('/').filter(Boolean);
  if(!parts.length){
   if(kind==='put'){Object.keys(rows).forEach(k=>delete rows[k]);Object.assign(rows,packet.data||{});}
   else if(packet.data&&typeof packet.data==='object')Object.assign(rows,packet.data);
  }else{
   const id=parts.shift();
   if(!safeId(id))return;
   if(!parts.length){
    if(packet.data===null)delete rows[id];
    else if(kind==='patch')rows[id]={...(rows[id]||{}),...(packet.data||{})};
    else rows[id]=packet.data;
   }else{
    const old=rows[id];
    if(!old||typeof old!=='object')return;
    let node=old;
    for(const key of parts.slice(0,-1)){
     if(!node[key]||typeof node[key]!=='object')node[key]={};
     node=node[key];
    }
    const last=parts.at(-1);
    if(packet.data===null)delete node[last];
    else if(kind==='patch'&&typeof packet.data==='object')node[last]={...(node[last]||{}),...packet.data};
    else node[last]=packet.data;
   }
  }
  publish();
 };
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',type='',data='';
 try{
  while(!signal.aborted){
   const {done,value}=await reader.read();if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
   if(buffer.length>256000)throw new Error('Firebase event stream too large.');
   let cut;
   while((cut=buffer.indexOf('\n\n'))>=0){
    const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);
    type='';data='';
    for(const line of block.split('\n')){
     if(line.startsWith('event:'))type=line.slice(6).trim();
     if(line.startsWith('data:'))data+=line.slice(5).trimStart();
    }
    if(['put','patch'].includes(type)&&data){
     try{apply(JSON.parse(data),type);}catch(e){console.warn('BETA test SSE event ignored',e);}
    }
   }
  }
 }finally{reader.releaseLock();}
}
