/**
 * Live PUBLIC MENU adapter for Firebase Realtime Database.
 * Read-only: never reads /orders, /pizzaBonus, /emailHealth or / root.
 * The existing DEMO stores menu fields directly at root. New restaurants should
 * publish only their menu/settings under a tenant-scoped public menu path.
 * Local menu cache, one tiny SSE revision stream and REST fallback only when offline.
 */
import {config} from './config.js?v=20261021-beta26';
import {resolveCategoryIcon} from './icons.js?v=20261021-beta26';
export const catalog={version:'',allergens:[],optionGroups:{},categories:[],popularIds:[]};
export let menuStatus={source:'none',error:'',lastChecked:0};
const menu=config.menu;
const cacheKey='beta:v2:'+config.tenantId+':menu:'+menu.databaseUrl+':'+menu.basePath;
const asArray=x=>Array.isArray(x)?x.filter(Boolean):(x&&typeof x==='object'?Object.values(x).filter(Boolean):[]);
const str=x=>String(x??'').trim();
const number=x=>Number(x)||0;
const path=name=>[menu.basePath.replace(/^\/+|\/+$/g,''),name].filter(Boolean).join('/');
const url=name=>menu.databaseUrl.replace(/\/$/,'')+'/'+path(name)+'.json';
const fallbackAllergens=[{id:'melk',label:'Melk'},{id:'hvete',label:'Hvete (gluten)'}];
async function getField(field){
 const res=await fetch(url(field),{method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
 if(!res.ok)throw new Error('Firebase '+field+': HTTP '+res.status);
 return res.json();
}
function readCache(){try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');return cached&&cached.menu&&cached.savedAt?cached:null;}catch{return null;}}
function saveCache(obj){try{localStorage.setItem(cacheKey,JSON.stringify(obj));}catch{}}
function normalize(raw){
 const sourceSettings=raw.siteSettings||raw.settings||{};
 // Cache only PUBLIC storefront settings, not old DEMO printer/admin configuration.
 const publicKeys=['restaurantName','restaurantLogo','phone','email','contactEmail','streetAddress','postalCode','city',
  'timezone','manualClosed','manualClosedUntil','prepMinutes','slotIntervalMinutes',
  'ingredientCustomizationEnabled','weeklyHours','orderOpenTime','orderCloseTime','customerPalette',
  'paymentInfo'];
 const settings=Object.fromEntries(publicKeys.filter(key=>sourceSettings[key]!==undefined).map(key=>[key,sourceSettings[key]]));
 const allergens=asArray(raw.allergenCatalog).map(a=>typeof a==='string'?{id:a.toLowerCase(),label:a}:{id:str(a.id),label:str(a.label||a.id)}).filter(x=>x.id);
 const dictionary=allergens.length?allergens:fallbackAllergens;
 const label=id=>dictionary.find(a=>a.id.toLowerCase()===str(id).toLowerCase()||a.label.toLowerCase()===str(id).toLowerCase())?.label||str(id);
 const optionGroups={};
 for(const g of asArray(raw.optionGroups)){
   if(!g?.id)continue;
   const options=asArray(g.options).filter(o=>o&&!o.soldOut).map(o=>({id:str(o.id),label:str(o.label||o.name),price:number(o.price)})).filter(o=>o.id);
   optionGroups[g.id]={id:g.id,title:str(g.title),required:g.required===true,
    multiple:g.selectionMode==='multiple',max:Number(g.maxSelections)|| (g.selectionMode==='multiple'?99:1),
    min:g.required?Math.max(1,Number(g.minSelections)||1):0,
    defaultOptionIds:asArray(g.defaultOptionIds),options};
 }
 const categories=asArray(raw.sections).filter(c=>c&&c.id).map(c=>{
   const kind=/pizza/i.test(c.title||'')?'pizza':/kebab/i.test(c.title||'')?'kebab':/burger/i.test(c.title||'')?'burger':'annet';
   return {id:str(c.id),kind,name:str(c.title),iconKey:resolveCategoryIcon(c.iconKey||c.icon||c.iconName||c.iconType,c.title),description:str(c.note),products:
    asArray(c.items).filter(p=>p&&p.id&&!p.hidden).map(p=>{
     const sizes=asArray(p.sizes).map(s=>({id:str(s.id),name:str(s.label||s.name||'Standard'),price:number(s.price),optionGroupIds:asArray(s.optionGroupIds)})).filter(s=>s.id);
     const idx=Math.min(sizes.length-1,Math.max(0,Number(p.defaultSizeIndex)||0));
     const ingredients=typeof p.ingredients==='string'?p.ingredients.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean):asArray(p.ingredientRules).map(x=>typeof x==='string'?x:str(x.name)).filter(Boolean);
     const rules=asArray(p.ingredientRules);
     const removable=ingredients.map(name=>({name,removable:rules.find(x=>str(x.name).toLowerCase()===name.toLowerCase())?.removable!==false}));
     return {id:str(p.id),name:str(p.name),description:str(p.description||p.ingredients),image:str(p.imageUrl),
       sizes,defaultSizeId:sizes[idx]?.id||'',allergens:asArray(p.allergens).map(label),ingredients,
       ingredientRules:removable,optionGroupIds:asArray(p.optionGroupIds),optionGroupOrder:asArray(p.optionGroupOrder),
       soldOut:p.soldOut===true};
    }).filter(p=>p.sizes.length)
   };
 });
 return {version:raw.updatedAt??'',allergens:dictionary.map(x=>x.label),optionGroups,categories,popularIds:asArray(raw.popularItemIds),settings};
}
function apply(data){
 if(!data||!Array.isArray(data.categories))return;
 catalog.version=data.version;catalog.allergens=data.allergens;catalog.categories=data.categories;
 catalog.optionGroups=data.optionGroups;catalog.popularIds=data.popularIds;
 const s=data.settings||{},r=config.restaurant;
 r.name=str(s.restaurantName)||r.name;
 r.logoUrl=str(s.restaurantLogo)||'';
 r.phone=str(s.phone)||'';
 r.email=str(s.email||s.contactEmail)||config.restaurant.email;
 r.address=str(s.streetAddress)||'';
 r.city=str(s.city)||'';
 r.postcode=str(s.postalCode)||'';
 r.paymentInfo=str(s.paymentInfo)||config.restaurant.paymentInfo;
 r.timezone=str(s.timezone)||r.timezone;
 r.manualClosed=s.manualClosed===true;
 r.manualClosedUntil=number(s.manualClosedUntil);
 r.pickupMinutes=Number(s.prepMinutes)||25;
 r.pickupIntervalMinutes=Number(s.slotIntervalMinutes)||15;
 r.ingredientCustomizationEnabled=s.ingredientCustomizationEnabled!==false;
 if(['reference','lively','fresh','gourmet'].includes(str(s.customerPalette)))r.palette=s.customerPalette;
 const t=s.weeklyHours;
 if(Array.isArray(t)&&t.length===7){
  r.openTimes=t.map(d=>({enabled:d?.enabled!==false,from:str(d?.open)||'14:00',to:str(d?.close)||'22:00'}));
 }else{
  r.openTimes=Array.from({length:7},()=>({enabled:true,from:str(s.orderOpenTime)||'14:00',to:str(s.orderCloseTime)||'22:00'}));
 }
}

/* Preserve the beta:v2 localStorage cache key and existing normalized menu.
 * DEMO already writes siteSettings and updatedAt on each menu/settings save.
 * Never read the root, /orders or the potentially private /settings node. */
const publicFields=['sections','optionGroups','allergenCatalog','popularItemIds','siteSettings'];
let pending=null;
let source=null,started=false,healthy=false,onChange=null;
let fallbackTimer=null,initialTimer=null,reconnectTimer=null,retryTimer=null;
let polling=null,refreshing=null,wanted=null,latest=null,retryMs=30000;
const same=(a,b)=>String(a??'')===String(b??'');
const active=()=>started&&!document.hidden&&(typeof navigator==='undefined'||navigator.onLine!==false);
function clear(ref){if(ref!==null)clearTimeout(ref);}

/** Cache-first boot: warm visits do no menu GET and keep old user caches. */
export async function loadCatalog({force=false,revision}={}){
 if(pending)return pending;
 const cached=readCache();
 if(cached&&!catalogReady())apply(cached.menu);
 if(cached&&!force){
  menuStatus={source:'cache',error:'',lastChecked:cached.checkedAt||0};
  return catalog;
 }
 if(cached&&revision!==undefined&&same(cached.menu.version,revision)){
  apply(cached.menu);return catalog;
 }
 pending=(async()=>{
  try{
   const names=revision===undefined?[...publicFields,menu.revisionField]:publicFields;
   const values=await Promise.all(names.map(getField));
   const data=Object.fromEntries(names.map((name,i)=>[name,values[i]]));
   data.updatedAt=revision===undefined?data[menu.revisionField]:revision;
   // Compatibility for cached legacy installations, without fetching /settings.
   if(data.siteSettings==null)data.siteSettings=cached?.menu?.settings||null;
   const normalized=normalize(data);
   if(!normalized.categories.length)throw new Error('Firebase-menyen er tom.');
   apply(normalized);
   const now=Date.now();
   saveCache({menu:normalized,savedAt:now,checkedAt:now});
   menuStatus={source:'firebase',error:'',lastChecked:now};
   return catalog;
  }catch(err){
   menuStatus={source:cached?'offline-cache':'error',error:err.message||'Firebase svarer ikke.',lastChecked:Date.now()};
   throw err;
  }
 })().finally(()=>pending=null);
 return pending;
}
function retryUpdate(){
 if(retryTimer!==null||!active())return;
 retryTimer=setTimeout(()=>{
  retryTimer=null;
  if(active()&&latest!==null&&!same(latest,catalog.version))queueVersion(latest);
 },retryMs);
 retryMs=Math.min(retryMs*2,300000);
}
/** Only one menu snapshot request at a time, even during rapid admin saves. */
function queueVersion(revision){
 if(revision==null||!active())return;
 latest=revision;wanted=revision;
 if(refreshing)return;
 refreshing=(async()=>{
  while(wanted!==null&&active()){
   const next=wanted;wanted=null;
   if(same(catalog.version,next))continue;
   try{
    const before=catalog.version;
    await loadCatalog({force:true,revision:next});
    if(!same(before,catalog.version))onChange?.();
    retryMs=30000;
    clear(retryTimer);retryTimer=null;
   }catch(err){
    menuStatus={source:'offline-cache',error:err.message||'Menyoppdatering feilet.',lastChecked:Date.now()};
    retryUpdate();
    break;
   }
  }
 })().finally(()=>{
  refreshing=null;
  if(wanted!==null&&!same(wanted,catalog.version)&&active())queueVersion(wanted);
 });
}
async function pollVersion(){
 if(!active()||healthy||polling)return;
 polling=(async()=>{
  try{
   const revision=await getField(menu.revisionField);
   if(revision!==null)queueVersion(revision);
  }catch(err){
   menuStatus={source:catalogReady()?'offline-cache':'error',error:err.message||'Frakoblet.',lastChecked:Date.now()};
  }
 })().finally(()=>polling=null);
 return polling;
}
function closeSource(){
 clear(initialTimer);initialTimer=null;
 if(source){source.close();source=null;}
 healthy=false;
}
function reconnect(){
 if(reconnectTimer!==null||!active())return;
 reconnectTimer=setTimeout(()=>{reconnectTimer=null;connect();},30000);
}
function connect(){
 if(!active()||source||typeof EventSource==='undefined')return;
 try{
  const stream=new EventSource(url(menu.revisionField));
  source=stream;healthy=false;
  initialTimer=setTimeout(()=>{initialTimer=null;if(!healthy)void pollVersion();},8000);
  const update=event=>{
   if(source!==stream)return;
   try{
    const msg=JSON.parse(event.data);
    if(!msg||msg.path!=='/'||!Object.prototype.hasOwnProperty.call(msg,'data'))return;
    const version=msg.data;
    if(version===null||!['string','number'].includes(typeof version))return;
    healthy=true;clear(initialTimer);initialTimer=null;
    if(same(version,catalog.version)){
     menuStatus={source:'firebase-verified',error:'',lastChecked:Date.now()};
    }else queueVersion(version);
   }catch{menuStatus={source:'offline-cache',error:'Ugyldig Firebase-melding.',lastChecked:Date.now()};}
  };
  stream.addEventListener('put',update);
  stream.addEventListener('patch',update);
  for(const type of ['cancel','auth_revoked']){
   stream.addEventListener(type,()=>{
    if(source!==stream)return;
    stopCatalogSync();
    menuStatus={source:'error',error:'Firebase tilgang avvist.',lastChecked:Date.now()};
   });
  }
  stream.onerror=()=>{
   if(source!==stream)return;
   healthy=false;
   if(stream.readyState===2){closeSource();reconnect();}
  };
 }catch{closeSource();reconnect();}
}
/** SSE is one scalar /updatedAt listener, never whole-menu or order streams. */
export function startCatalogSync(callback){
 onChange=callback;
 if(started||document.hidden||(typeof navigator!=='undefined'&&navigator.onLine===false))return;
 started=true;
 connect();
 // Timer makes no Firebase requests while SSE is healthy.
 fallbackTimer=setInterval(()=>{if(!healthy)void pollVersion();},menu.revalidateMs);
 if(typeof EventSource==='undefined')void pollVersion();
}
export function stopCatalogSync(){
 started=false;closeSource();
 if(fallbackTimer!==null)clearInterval(fallbackTimer);
 fallbackTimer=null;
 clear(reconnectTimer);reconnectTimer=null;
 clear(retryTimer);retryTimer=null;
 wanted=null;
}
export function catalogReady(){return !!catalog.categories.length}
