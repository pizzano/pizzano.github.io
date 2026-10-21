import {config} from './config.js?v=20261021-beta28';
import {addTestOrder} from './test-orders.js?v=20261021-beta28';
import {catalog,loadCatalog,menuStatus,catalogReady,startCatalogSync,stopCatalogSync} from './catalog.js?v=20261021-beta28';
export {config,catalog,loadCatalog,menuStatus,catalogReady,startCatalogSync,stopCatalogSync};
const prefix='beta:v2:'+config.tenantId+':';
const read=(key,def)=>{try{const x=JSON.parse(localStorage.getItem(prefix+key));return x??def;}catch{return def;}};
const write=(key,val)=>{try{localStorage.setItem(prefix+key,JSON.stringify(val));}catch{}};
export const state={
 profile:read('profile',{name:'',phone:'',email:''}),
 cart:read('cart',[]),
 // Never show old browser-only mock orders as accepted orders.
 orders:read('orders',[]).filter(order=>order && order.status!=='preview' && !String(order.id||'').startsWith('preview-')),
 // Loyalty points must come from an authenticated server, never from local mock purchases.
 loyalty:{count:0,used:0,offersConsent:read('loyalty',{offersConsent:false}).offersConsent===true},
 allergens:read('allergens',config.restaurant.showAllergensByDefault),
 theme:read('theme','light')
};
export function persist(){for(const k of ['profile','cart','orders','loyalty','allergens','theme'])write(k,state[k]);}
export const money=n=>new Intl.NumberFormat(config.locale,{maximumFractionDigits:2}).format(Number(n)||0)+' kr';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function findProduct(id){for(const c of catalog.categories){const p=c.products.find(x=>x.id===id);if(p)return {p,c};}return null;}
export const basePrice=p=>p?.sizes?.length?Math.min(...p.sizes.map(s=>Number(s.price)||0)):0;
export const selectedSize=(p,sizeId)=>p.sizes.find(s=>s.id===sizeId)||p.sizes.find(s=>s.id===p.defaultSizeId)||p.sizes[0];
export function applicableGroups(p,sizeId){
 const s=selectedSize(p,sizeId);
 const attached=[...new Set([...(p.optionGroupIds||[]),...(s?.optionGroupIds||[])])];
 const ordered=[...new Set([...(p.optionGroupOrder||[]).filter(x=>attached.includes(x)),...attached])];
 return ordered.map(id=>catalog.optionGroups[id]).filter(Boolean);
}
export function unitPrice(line){
 const found=findProduct(line.productId);if(!found)return 0;
 const p=found.p,s=selectedSize(p,line.sizeId);let price=Number(s.price)||0;
 for(const g of applicableGroups(p,s.id)){
  for(const choice of line.options?.[g.id]||[]){
   price+=Number(g.options.find(x=>x.id===choice)?.price)||0;
  }
 }
 return price;
}
export const linePrice=line=>(Number(line.quantity)||1)*unitPrice(line);
export const cartTotal=()=>state.cart.reduce((sum,line)=>sum+linePrice(line),0);
export const cartQuantity=()=>state.cart.reduce((sum,l)=>sum+(Number(l.quantity)||0),0);
export function addLine(line,editId){
 if(editId){const i=state.cart.findIndex(l=>l.id===editId);if(i>=0)state.cart[i]={...line,id:editId};}
 else state.cart.push({...line,id:crypto.randomUUID?.()||'line-'+Date.now()});
 persist();
}
export function changeQuantity(id,n){
 const x=state.cart.find(l=>l.id===id);if(!x)return;
 x.quantity=Math.max(0,Number(x.quantity||0)+n);state.cart=state.cart.filter(l=>l.quantity>0);persist();
}
export function removeLine(id){const before=state.cart.length;state.cart=state.cart.filter(l=>l.id!==id);if(state.cart.length!==before)persist();}
export function clearCart(){state.cart=[];persist();}
export function setProfile(data){state.profile={...data};persist();}
const clock=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):0;};
export function openState(date=new Date()){
 const r=config.restaurant;
 const now=date.getTime(),manuallyClosed=r.manualClosed && (!r.manualClosedUntil||r.manualClosedUntil>now);
 let day=(date.getDay()+6)%7,minute=date.getHours()*60+date.getMinutes();
 try{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:r.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  day=['mon','tue','wed','thu','fri','sat','sun'].indexOf(parts.find(p=>p.type==='weekday')?.value.toLowerCase().slice(0,3));
  minute=Number(parts.find(p=>p.type==='hour')?.value)%24*60+Number(parts.find(p=>p.type==='minute')?.value);
 }catch{}
 const today=r.openTimes[day]||{},yesterday=r.openTimes[(day+6)%7]||{};
 const inWindow=x=>{const a=clock(x.from),b=clock(x.to);return x.enabled!==false&&(b>a?(minute>=a&&minute<b):(minute>=a||minute<b));};
 const fromYesterday=yesterday.enabled!==false&&clock(yesterday.to)<=clock(yesterday.from)&&minute<clock(yesterday.to);
 const open=!manuallyClosed&&(inWindow(today)||fromYesterday);
 return {open,closesAt:fromYesterday?yesterday.to:today.to||'22:00',opensAt:today.from||'14:00',manuallyClosed};
}
export const isOpen=date=>openState(date).open;
export function pickupSlots(date=new Date()){
 if(!isOpen(date)&&config.mode!=='firebase-test')return [];
 const out=[],step=config.restaurant.pickupIntervalMinutes||15;
 const base=new Date(date.getTime()+(config.restaurant.pickupMinutes||25)*60000);
 base.setSeconds(0,0);base.setMinutes(Math.ceil(base.getMinutes()/step)*step);
 for(let i=0;i<24;i++){
  const d=new Date(base.getTime()+i*step*60000);
  if(!isOpen(d)&&config.mode!=='firebase-test')break;
  out.push(d.toLocaleTimeString(config.locale,{hour:'2-digit',minute:'2-digit'}));
 }
 return out;
}
/**
 * Browser retries retain the SAME idempotency key for an unchanged order.
 * A key alone is not sufficient: the authenticated server MUST atomically
 * deduplicate (tenantId, key), validate prices/menu/options and return the
 * original result after a timeout. No direct client Firebase writes.
 */
const pendingKey=prefix+'checkout-pending';
function pendingCheckout(order){
 const fingerprint=JSON.stringify(order);
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{}
 if(saved?.fingerprint===fingerprint && /^[0-9a-f-]{36}$/i.test(saved.key))return saved.key;
 if(typeof crypto?.randomUUID!=='function')throw new Error('En sikker bestillings-ID kunne ikke opprettes.');
 const key=crypto.randomUUID();
 try{localStorage.setItem(pendingKey,JSON.stringify({key,fingerprint,createdAt:Date.now()}));}
 catch{throw new Error('Kunne ikke sikre bestillingen mot duplikater. Kontroller nettleserlagring.');}
 return key;
}
function clearPendingCheckout(key){
 try{
  const pending=JSON.parse(localStorage.getItem(pendingKey)||'null');
  if(pending?.key===key)localStorage.removeItem(pendingKey);
 }catch{}
}
/** Return order only after the selected database has acknowledged a write. */
export async function sendOrder(order){
 if(config.mode==='firebase-test'){
  const key=pendingCheckout(order);
  let startedAt=Date.now();
  try{startedAt=Number(JSON.parse(localStorage.getItem(pendingKey)||'null')?.createdAt)||startedAt;}catch{}
  // NO personal data is sent to Firebase during BETA-only tests.
  // The adapter also strips comments and notification recipient fields.
  const accepted=await addTestOrder(order,key,startedAt);
  state.orders=[accepted,...state.orders.filter(o=>o.id!==accepted.id)].slice(0,15);
  persist();clearPendingCheckout(key);
  return accepted;
 }
 if(config.mode!=='api'||!config.apiBase)throw new Error('Bestillinger er ikke aktivert ennå.');
 const key=pendingCheckout(order);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 let response;
 try{
  response=await fetch(config.apiBase.replace(/\/$/,'')+'/v1/tenants/'+encodeURIComponent(config.tenantId)+'/orders',{
   method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},
   body:JSON.stringify(order),credentials:'omit',cache:'no-store',signal:controller.signal
  });
 }catch(error){
  // An unknown outcome must retain the same key for an explicit retry.
  throw new Error(error.name==='AbortError'
    ?'Forespørselen tok for lang tid. Prøv igjen – samme bestilling blir ikke sendt på nytt.'
    :'Ingen sikker bekreftelse fra serveren. Prøv igjen med samme bestilling.');
 }finally{clearTimeout(timeout);}
 if(!response.ok){
  // A 503 due to missing server configuration is NOT an uncertain order:
  // do not encourage repeatedly pressing Send or claim an order exists.
  const problem=await response.json().catch(()=>null);
  if(response.status===503 && problem?.code==='SERVICE_NOT_READY')
   throw new Error('Nettbestilling er ikke aktivert hos restauranten ennå. Bestillingen er ikke sendt. Ring restauranten for å bestille.');
  if(response.status===409)
   throw new Error('Bestillingen kan ikke bekreftes. Menypris eller hentetid kan ha endret seg. Oppdater siden før ny bestilling.');
  if(response.status===422)
   throw new Error('Kontroller navn, telefonnummer, varer og hentetid. Bestillingen ble ikke godtatt.');
  if(response.status>=500)
   throw new Error('Mottakstjenesten er midlertidig utilgjengelig. Ingen bekreftelse mottatt – prøv igjen med samme bestilling senere.');
  if(response.status===403||response.status===401)
   throw new Error('Bestillingen ble avvist av tjenesten. Ingen bestilling er bekreftet.');
  throw new Error('Bestillingen kunne ikke godtas. Kontroller opplysningene.');
 }
 const result=await response.json().catch(()=>null);
 if(!result?.id||!['mottatt','bekreftet','tilberedning','klar'].includes(result.status)||!Number.isFinite(Number(result.createdAt)))
  throw new Error('Ugyldig ordrebekreftelse. Prøv igjen med samme bestilling.');
 const accepted={...order,...result,createdAt:Number(result.createdAt),status:result.status};
 state.orders=[accepted,...state.orders.filter(o=>o.id!==accepted.id)].slice(0,15);
 persist();
 clearPendingCheckout(key);
 return accepted;
}
