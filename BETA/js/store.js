import {config} from './config.js?v=20261021-beta15';
import {catalog,loadCatalog,menuStatus,catalogReady,startCatalogSync,stopCatalogSync} from './catalog.js?v=20261021-beta15';
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
 if(!isOpen(date))return [];
 const out=[],step=config.restaurant.pickupIntervalMinutes||15;
 const base=new Date(date.getTime()+(config.restaurant.pickupMinutes||25)*60000);
 base.setSeconds(0,0);base.setMinutes(Math.ceil(base.getMinutes()/step)*step);
 for(let i=0;i<24;i++){
  const d=new Date(base.getTime()+i*step*60000);
  if(!isOpen(d))break;
  out.push(d.toLocaleTimeString(config.locale,{hour:'2-digit',minute:'2-digit'}));
 }
 return out;
}
/** Actual Firebase acknowledgement is required before showing success. */
export async function sendOrder(order){
 const {submitFirebaseOrder}=await import('./orders.js?v=20261021-beta15');
 const result=await submitFirebaseOrder(order);
 state.orders=[result,...state.orders.filter(x=>x.id!==result.id)].slice(0,4);
 persist();return result;
}
