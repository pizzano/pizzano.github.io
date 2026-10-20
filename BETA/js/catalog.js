/**
 * Live PUBLIC MENU adapter for Firebase Realtime Database.
 * Read-only: never reads /orders, /pizzaBonus, /emailHealth or / root.
 * The existing DEMO stores menu fields directly at root. New restaurants should
 * publish only their menu/settings under a tenant-scoped public menu path.
 * Local cached snapshot + tiny version check (<= once per 5m per tab).
 */
import {config} from './config.js';
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
 const settings=raw.siteSettings||raw.settings||{};
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
   return {id:str(c.id),kind,name:str(c.title),icon:({pizza:'🍕',kebab:'🥙',burger:'🍔',annet:'🍴'})[kind],description:str(c.note),products:
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
 r.address=str(s.streetAddress)||'';
 r.city=str(s.city)||'';
 r.postcode=str(s.postalCode)||'';
 r.timezone=str(s.timezone)||r.timezone;
 r.manualClosed=s.manualClosed===true;
 r.manualClosedUntil=number(s.manualClosedUntil);
 r.pickupMinutes=Number(s.prepMinutes)||25;
 r.pickupIntervalMinutes=Number(s.slotIntervalMinutes)||15;
 r.ingredientCustomizationEnabled=s.ingredientCustomizationEnabled!==false;
 const t=s.weeklyHours;
 if(Array.isArray(t)&&t.length===7){
  r.openTimes=t.map(d=>({enabled:d?.enabled!==false,from:str(d?.open)||'14:00',to:str(d?.close)||'22:00'}));
 }else{
  r.openTimes=Array.from({length:7},()=>({enabled:true,from:str(s.orderOpenTime)||'14:00',to:str(s.orderCloseTime)||'22:00'}));
 }
}
let pending=null;
let lastCheck=0;
export async function loadCatalog({force=false}={}){
 if(pending)return pending;
 pending=(async()=>{
   const cached=readCache();
   if(cached){apply(cached.menu);menuStatus={source:'cache',error:'',lastChecked:cached.checkedAt||0};}
   const now=Date.now();
   if(!force&&cached&&now-(cached.checkedAt||0)<menu.revalidateMs)return catalog;
   try{
    const revision=await getField(menu.revisionField);
    lastCheck=Date.now();
    if(cached && revision!=null && String(revision)===String(cached.menu.version)){
      menuStatus={source:'firebase-verified',error:'',lastChecked:lastCheck};
      saveCache({...cached,checkedAt:lastCheck});return catalog;
    }
    const fields=['sections','optionGroups','allergenCatalog','popularItemIds','siteSettings','settings'];
    const values=await Promise.all(fields.map(getField));
    const data=Object.fromEntries(fields.map((f,i)=>[f,values[i]]));
    data.updatedAt=revision;
    const normalized=normalize(data);
    if(!normalized.categories.length)throw new Error('Firebase-menyen er tom.');
    apply(normalized);
    menuStatus={source:'firebase',error:'',lastChecked:lastCheck};
    saveCache({menu:normalized,savedAt:Date.now(),checkedAt:lastCheck});
    return catalog;
   }catch(err){
    menuStatus={source:cached?'offline-cache':'error',error:err.message||'Kunne ikke hente menyen.',lastChecked:Date.now()};
    if(cached)return catalog;
    throw err;
   }
 })().finally(()=>pending=null);
 return pending;
}
export function catalogReady(){return !!catalog.categories.length}
