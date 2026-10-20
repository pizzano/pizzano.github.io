import {config} from './config.js';
import {catalog} from './catalog.js';
export {config,catalog};
const prefix='beta:v1:'+config.tenantId+':';
const read=(key,def)=>{try{const x=JSON.parse(localStorage.getItem(prefix+key));return x??def;}catch{return def;}};
const write=(key,val)=>{try{localStorage.setItem(prefix+key,JSON.stringify(val));}catch{}};
export const state={
  profile:read('profile',{name:'',phone:'',email:''}),
  cart:read('cart',[]),
  orders:read('orders',[]),
  loyalty:read('loyalty',{count:0,used:0,offersConsent:false}),
  favorites:read('favorites',[]),
  allergens:read('allergens',config.restaurant.showAllergensByDefault),
  theme:read('theme','light')
};
export function persist(){for(const k of ['profile','cart','orders','loyalty','favorites','allergens','theme'])write(k,state[k]);}
export const money=(n)=>new Intl.NumberFormat(config.locale,{maximumFractionDigits:2}).format(Number(n)||0)+' kr';
export function findProduct(id){for(const c of catalog.categories){const p=c.products.find(x=>x.id===id);if(p)return {p,c};}return null;}
export const basePrice=p=>Math.min(...p.sizes.map(s=>s.price));
export const selectedSize=(p,sizeId)=>p.sizes.find(s=>s.id===sizeId)||p.sizes.find(s=>s.id===p.defaultSizeId)||p.sizes[0];
export function applicableGroups(p,sizeId){return(p.optionGroupIds||[]).map(id=>catalog.optionGroups[id]).filter(g=>g&&(!g.onlySizes||g.onlySizes.includes(sizeId)));}
export function unitPrice(line){const found=findProduct(line.productId);if(!found)return 0;const {p}=found;const s=selectedSize(p,line.sizeId);let price=s.price;
 for(const group of applicableGroups(p,s.id))for(const choice of line.options?.[group.id]||[]){price+=group.options.find(x=>x.id===choice)?.price||0;}
 return price;
}
export const linePrice=line=>line.quantity*unitPrice(line);
export const cartTotal=()=>state.cart.reduce((sum,line)=>sum+linePrice(line),0);
export const cartQuantity=()=>state.cart.reduce((sum,l)=>sum+l.quantity,0);
export function addLine(line,editId){if(editId){const i=state.cart.findIndex(l=>l.id===editId);if(i>=0)state.cart[i]={...line,id:editId};}
 else state.cart.push({...line,id:crypto.randomUUID?.()||'line-'+Date.now()});persist();}
export function changeQuantity(id,n){const x=state.cart.find(l=>l.id===id);if(!x)return;x.quantity=Math.max(0,x.quantity+n);state.cart=state.cart.filter(l=>l.quantity>0);persist();}
export function clearCart(){state.cart=[];persist();}
export function setProfile(data){state.profile={...data};persist();}
export function toggleFavorite(id){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];persist();}
export const escapeHtml=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function isOpen(date=new Date()){
  const day=(date.getDay()+6)%7;const hours=config.restaurant.openTimes[day];if(!hours)return false;
  const min=date.getHours()*60+date.getMinutes();const asMin=s=>Number(s.split(':')[0])*60+Number(s.split(':')[1]);
  const start=asMin(hours.from),end=asMin(hours.to);
  return end>start?(min>=start&&min<end):(min>=start||min<end);
}
export function pickupSlots(date=new Date()){
  const out=[];const step=config.restaurant.pickupIntervalMinutes||15;
  const base=new Date(date.getTime()+(config.restaurant.pickupMinutes||25)*60000);
  base.setSeconds(0,0);base.setMinutes(Math.ceil(base.getMinutes()/step)*step);
  for(let i=0;i<16;i++){const d=new Date(base.getTime()+i*step*60000);if(d.toDateString()!==date.toDateString())break;if(!isOpen(d))continue;out.push(d.toLocaleTimeString(config.locale,{hour:'2-digit',minute:'2-digit'}));}
  return out;
}
export function addPreviewLoyalty(lines){
 const count=lines.reduce((n,line)=>{const f=findProduct(line.productId);return n+(f?.c.id===config.restaurant.loyalty.eligibleCategory&&line.sizeId==='stor'?line.quantity:0);},0);
 state.loyalty.count+=count;persist();
}
/** Local preview is not a real order. Live mode requires server side validation:
 * authentication, pricing, tenant authorization, stock and loyalty reservation.
 */
export async function sendOrder(order){
 if(config.mode==='preview'){
   const record={...order,id:'preview-'+crypto.randomUUID(),status:'preview',createdAt:Date.now()};
   state.orders.unshift(record);state.orders=state.orders.slice(0,15);
   addPreviewLoyalty(order.lines);persist();return record;
 }
 if(config.mode!=='api'||!config.apiBase)throw new Error('Bestillingsserver er ikke konfigurert.');
 const response=await fetch(config.apiBase.replace(/\/$/,'')+'/v1/tenants/'+encodeURIComponent(config.tenantId)+'/orders',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(order),credentials:'omit'
 });
 if(!response.ok)throw new Error('Bestillingen kunne ikke sendes. Prøv igjen.');
 const result=await response.json();
 if(!result.id)throw new Error('Mangler bekreftelse fra serveren.');
 state.orders.unshift({...order,...result});state.orders=state.orders.slice(0,15);persist();return result;
}
