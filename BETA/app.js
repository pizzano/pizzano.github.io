/* BETA: public menu only. No listeners, analytics or order writes. */
'use strict';
const BASE='https://kol-grill-pizza-default-rtdb.firebaseio.com';
const CACHE_DB='kol-beta-public-v1', CART_KEY='kol-beta-cart-v1', META_KEY='kol-beta-meta-v1';
let refreshPending=false,activeCategory=null,allergensVisible=true,scrollObserver=null,draggedCategories=false;
let changeStream=null,changeCacheTimer=null,liveRevision=0,liveReloadInFlight=false;
let weeklyHoursStream=null,weeklyHoursRevision=0;
const $=id=>document.getElementById(id), money=n=>Math.round(Number(n)||0)+' kr';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>Array.isArray(v)?v:Object.entries(v||{}).map(([id,x])=>x&&typeof x==='object'?{id,...x}:x).filter(Boolean);
let menu=null,current=null,qty=1,selection={},cart=loadCart(),imageURLs=new Map();
const FAVORITES_KEY='kol-beta-favorites-v1';
function readFavorites(){try{const a=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(a)?a.map(String):[]}catch{return []}}
let favorites=readFavorites();
function isFavorite(id){return favorites.includes(String(id))}
function toggleFavorite(id){
 id=String(id);favorites=isFavorite(id)?favorites.filter(x=>x!==id):[...favorites,id];
 try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites))}catch{}
 if(current&&String(current.id)===id)updateSheetFavorite();
 updateCardFavorite(id);
}
function updateSheetFavorite(){
 const b=$('sheetFavorite');
 if(!b||!current)return;
 b.classList.toggle('is-favorite',isFavorite(current.id));
 b.setAttribute('aria-pressed',String(isFavorite(current.id)));
 b.setAttribute('aria-label',isFavorite(current.id)?'Fjern fra favoritter':'Legg til favoritter');
 b.textContent=isFavorite(current.id)?'♥':'♡';
}
function loadCart(){try{const c=JSON.parse(localStorage.getItem(CART_KEY));return Array.isArray(c)?c:[]}catch{return []}}
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}renderCartIndicators();updateCartBadges()}
function openDB(){return new Promise((resolve,reject)=>{if(!indexedDB){reject(Error('IndexedDB unavailable'));return}const r=indexedDB.open(CACHE_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('public');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function localGet(){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction('public','readonly'),r=t.objectStore('public').get('menu');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close()})}
async function localPut(value){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction('public','readwrite');t.objectStore('public').put(value,'menu');t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)})}
function normalize(data){return {cacheFormat:2,sections:list(data.sections).map(s=>({...s,items:list(s.items)})),optionGroups:list(data.optionGroups),allergenCatalog:list(data.allergenCatalog),settings:data.settings||{},popularItemIds:list(data.popularItemIds).map(x=>typeof x==='object'?(x.id??x.value):x).filter(Boolean),updatedAt:Number(data.updatedAt)||0}}
async function fromFirebase(){
  const read=async path=>{
    const r=await fetch(BASE+'/'+path+'.json',{cache:'no-store'});
    if(!r.ok)throw Error('Firebase HTTP '+r.status+' ('+path+')');
    return r.json();
  };
  // Production stores the public catalogue at /menu. Settings live at /settings.
  // Two parallel reads only; never read the Firebase root or private order nodes.
  const [payload,settings]=await Promise.all([read('menu'),read('settings')]);
  if(!payload || !payload.sections || !payload.optionGroups)
    throw Error('Meny mangler på /menu eller har ugyldig format');
  const data=normalize({...payload,settings:settings||payload.settings||{}});
  if(!data.sections.length)throw Error('Ingen kategorier i /menu');
  return data;
}
async function init(){
 let cached=null;try{cached=await localGet()}catch{}
 try{const state=localStorage.getItem('kol-beta-allergens');if(state!==null)allergensVisible=state==='true'}catch{}
 $('showAllergens').checked=allergensVisible;
 if(cached?.sections?.length){
   menu=cached;render();$('cacheStatus').textContent='Lagret lokalt';
   // Never re-download a cached menu automatically. Manual refresh stays available.
 }else await refreshMenu(false);
 startChangeStream();
 startWeeklyHoursStream();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){startChangeStream();startWeeklyHoursStream()}});
 window.addEventListener('online',()=>{startChangeStream();startWeeklyHoursStream()});
 window.setInterval(updateHoursStatus,60000);
}
async function refreshMenu(manual=true){if(refreshPending)return;refreshPending=true;$('refresh').disabled=true;$('cacheStatus').textContent='Henter…';try{const startingRevision=liveRevision;const fresh=await fromFirebase();if(!(menu&&startingRevision!==liveRevision&&Number(menu.updatedAt)>Number(fresh.updatedAt)))menu=fresh;try{await localPut(fresh)}catch(e){$('notice').textContent='Nettleseren kunne ikke lagre menyen lokalt.'}try{localStorage.setItem(META_KEY,JSON.stringify({lastSync:Date.now()}))}catch{}render();$('cacheStatus').textContent='Oppdatert';}catch(e){if(!menu){$('notice').textContent='Kunne ikke hente menyen. Kontroller Firebase-lesetilgang og nettverk. '+e.message;$('cacheStatus').textContent='Ingen data'}else{$('notice').textContent='Kunne ikke oppdatere. Lokal meny vises.';$('cacheStatus').textContent='Lagret lokalt'}}finally{refreshPending=false;$('refresh').disabled=false}}

/* One tiny Firebase SSE subscription replaces all periodic GETs.
 * The initial snapshot is only the latest compact change notification.
 * Every notification contains the same version as the atomic admin update.
 * Gap/missed update/oversize delta => one full resync, never polling.
 */
const LIVE_FEED_URL=BASE+'/menu/changeFeed/latest.json';
const unsafeSegment=part=>!part||part==='__proto__'||part==='constructor'||part==='prototype';
function applyLiveChanges(snapshot,changes){
 const next=structuredClone(snapshot);
 for(const change of changes){
   if(!change||typeof change.path!=='string')throw Error('Invalid change');
   const parts=change.path.split('/');
   if(parts.some(unsafeSegment)||!['menu','settings'].includes(parts[0])||parts.length<2)
     throw Error('Unsupported change path');
   // Top-level menu payload in BETA has no "menu" wrapper.
   let target=parts[0]==='menu'?next:next.settings;
   const rest=parts[0]==='menu'?parts.slice(1):parts.slice(1);
   if(rest[0]==='updatedAt'||rest[0]==='cacheFormat')continue;
   for(let i=0;i<rest.length-1;i++){
     const key=rest[i];
     if(!target||typeof target!=='object'||!Object.hasOwn(target,key))
       throw Error('Change path not present');
     target=target[key];
   }
   const last=rest[rest.length-1];
   if(!target||typeof target!=='object')throw Error('Invalid change target');
   if(change.value===null){
     if(Array.isArray(target))throw Error('Array deletion requires full refresh');
     delete target[last];
   }else target[last]=change.value;
 }
 return next;
}
function saveLiveCacheSoon(){
 if(changeCacheTimer)clearTimeout(changeCacheTimer);
 changeCacheTimer=setTimeout(()=>{
   changeCacheTimer=null;
   if(menu)localPut(menu).catch(()=>{});
 },300);
}
async function resyncAfterGap(){
 // No automatic GET once this browser already has a menu.
 // A missed or oversized delta must not silently trigger a full download.
 if(menu){
   $('cacheStatus').textContent='Endringer tilgjengelig';
   $('notice').textContent='Menyen er endret. Trykk ↻ for å oppdatere hvis du ønsker den nyeste versjonen.';
   return;
 }
 await refreshMenu(false);
}
async function receiveLiveAnnouncement(value){
 if(!menu||!value||typeof value!=='object')return;
 const version=Number(value.version)||0;
 if(!version||version<=Number(menu.updatedAt))return;
 if(Number(value.previousVersion)!==Number(menu.updatedAt)||
    value.requiresRefresh===true||!Array.isArray(value.changes)){
   await resyncAfterGap();
   return;
 }
 try{
   const next=applyLiveChanges(menu,value.changes);
   next.updatedAt=version;
   next.cacheFormat=2;
   const changePaths=value.changes.map(x=>String(x.path));
   const menuChanged=changePaths.some(x=>x.startsWith('menu/')&&x!=='menu/updatedAt');
   menu=next;
   liveRevision++;
   if(menuChanged)render();
   else{
     updateHoursStatus();
     $('brandName').textContent=menu.settings?.restaurantName||'KØL Grill & Pizza';
   }
   saveLiveCacheSoon();
   $('notice').textContent='';
   $('cacheStatus').textContent='Oppdatert automatisk';
 }catch(error){
   console.warn('BETA: could not apply live delta, resyncing once',error);
   await resyncAfterGap();
 }
}
function startChangeStream(){
 if(!('EventSource' in window)||navigator.onLine===false)return;
 if(changeStream&&changeStream.readyState!==2)return;
 if(changeStream){changeStream.close();changeStream=null}
 const source=new EventSource(LIVE_FEED_URL);
 changeStream=source;
 const onChange=event=>{
   try{
     const update=JSON.parse(event.data);
     // An initial SSE "put" also carries the latest revision.
     if(update.path==='/')void receiveLiveAnnouncement(update.data);
     else if(update.path==='/latest')void receiveLiveAnnouncement(update.data);
     else{
       // Nested patch at a feed path: treat it as an unknown revision.
       void resyncAfterGap();
     }
   }catch(error){console.warn('BETA live update parse failed',error)}
 };
 source.addEventListener('put',onChange);
 source.addEventListener('patch',onChange);
 source.onerror=()=>{
   if(source.readyState!==2)return; // Browser reconnects automatically.
   source.close();
   if(changeStream===source)changeStream=null;
   // No periodic reconnect requests. Online/visibility events can restart it.
 };
 for(const kind of ['cancel','auth_revoked'])source.addEventListener(kind,()=>{
   source.close();
   if(changeStream===source)changeStream=null;
 });
}
/* Listen only to the seven weekly opening-hour entries, not the whole menu.
 * Initial SSE put is a small current-hours snapshot, then admin edits arrive as
 * tiny leaf updates. This repairs stale local hours without any periodic GET.
 */
function normaliseWeeklyHoursPayload(value){
 if(Array.isArray(value))return value.slice(0,7);
 if(value&&typeof value==='object')
  return Array.from({length:7},(_,i)=>value[i]??value[String(i)]??{});
 return null;
}
function receiveWeeklyHoursEvent(event,type){
 if(!menu)return;
 try{
  const update=JSON.parse(event.data);
  if(!update||typeof update.path!=='string')return;
  const path=update.path;
  const old=Array.isArray(menu.settings?.weeklyHours)?menu.settings.weeklyHours:null;
  let next;
  if(path==='/'){
   if(type==='put')next=normaliseWeeklyHoursPayload(update.data);
   else if(type==='patch'&&update.data&&typeof update.data==='object'){
    next=(old||Array.from({length:7},()=>({}))).map(x=>({...x}));
    for(const [key,value] of Object.entries(update.data)){
     if(!/^[0-6]$/.test(key))return;
     next[Number(key)]=value===null?{}:{...next[Number(key)],...value};
    }
   }
  }else{
   const segments=path.slice(1).split('/').filter(Boolean);
   if(!/^[0-6]$/.test(segments[0])||segments.length>3)return;
   next=(old||Array.from({length:7},()=>({}))).map(x=>({...x}));
   const index=Number(segments[0]),key=segments[1];
   if(segments.length===1){
    if(type==='patch'&&update.data&&typeof update.data==='object')
     next[index]={...next[index],...update.data};
    else next[index]=update.data??{};
   }else if(segments.length===2&&['open','close','enabled','id'].includes(key)){
    if(update.data===null)delete next[index][key];
    else next[index][key]=update.data;
   }else return;
  }
  if(!next||next.length!==7)return;
  if(JSON.stringify(next)===JSON.stringify(old))return;
  menu.settings={...(menu.settings||{}),weeklyHours:next};
  weeklyHoursRevision++;
  updateHoursStatus();
  saveLiveCacheSoon();
  $('cacheStatus').textContent='Åpningstider oppdatert';
 }catch(error){console.warn('BETA weekly hours event ignored:',error)}
}
function startWeeklyHoursStream(){
 if(!('EventSource' in window)||navigator.onLine===false)return;
 if(weeklyHoursStream&&weeklyHoursStream.readyState!==2)return;
 if(weeklyHoursStream){weeklyHoursStream.close();weeklyHoursStream=null}
 const source=new EventSource(BASE+'/settings/weeklyHours.json');
 weeklyHoursStream=source;
 source.addEventListener('put',event=>receiveWeeklyHoursEvent(event,'put'));
 source.addEventListener('patch',event=>receiveWeeklyHoursEvent(event,'patch'));
 source.onerror=()=>{
  // EventSource reconnects automatically after transient connection errors.
  if(source.readyState===2&&weeklyHoursStream===source){
   source.close();weeklyHoursStream=null;
  }
 };
 for(const type of ['cancel','auth_revoked'])
  source.addEventListener(type,()=>{
   source.close();if(weeklyHoursStream===source)weeklyHoursStream=null;
  });
}
window.addEventListener('pageshow',event=>{if(event.persisted){startChangeStream();startWeeklyHoursStream()}});
window.addEventListener('pagehide',()=>{
 if(changeStream){changeStream.close();changeStream=null}
 if(weeklyHoursStream){weeklyHoursStream.close();weeklyHoursStream=null}
 if(changeCacheTimer){clearTimeout(changeCacheTimer);changeCacheTimer=null;if(menu)localPut(menu).catch(()=>{})}
});
const clockMinutes=time=>{
 const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time||''));
 return m?Number(m[1])*60+Number(m[2]):null;
};
const WEEKDAY_NAMES=['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'];
function openingDays(settings){
 const raw=Array.isArray(settings?.weeklyHours)&&settings.weeklyHours.length===7?settings.weeklyHours:null;
 return Array.from({length:7},(_,i)=>({
  enabled:raw?raw[i]?.enabled!==false:true,
  open:clockMinutes(raw?.[i]?.open)!==null?raw[i].open:'14:00',
  close:clockMinutes(raw?.[i]?.close)!==null?raw[i].close:'22:00'
 }));
}
function osloTime(){
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Oslo',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false
 }).formatToParts(new Date());
 const get=k=>parts.find(p=>p.type===k)?.value||'';
 const day=['mon','tue','wed','thu','fri','sat','sun'].indexOf(get('weekday').toLowerCase().slice(0,3));
 return {day:day<0?0:day,minute:(Number(get('hour'))%24)*60+Number(get('minute'))};
}
function calculateHoursStatus(settings,now){
 const days=openingDays(settings),today=days[now.day],yesterday=days[(now.day+6)%7];
 const t=now.minute,start=clockMinutes(today.open),end=clockMinutes(today.close);
 const priorStart=clockMinutes(yesterday.open),priorEnd=clockMinutes(yesterday.close);
 let closesAt=null;
 if(yesterday.enabled&&priorStart!==null&&priorEnd!==null&&priorEnd<=priorStart&&t<priorEnd)closesAt=yesterday.close;
 if(!closesAt&&today.enabled&&start!==null&&end!==null&&t>=start&&(end<=start||t<end))closesAt=today.close;
 const until=Number(settings?.manualClosedUntil)||0;
 const manuallyClosed=settings?.manualClosed===true&&(until<=0||until>Date.now());
 const open=Boolean(closesAt)&&!manuallyClosed;
 const preOpen=!open&&!manuallyClosed&&today.enabled&&start!==null&&t<start;
 let upcoming=null;
 for(let offset=0;offset<=7;offset++){
  const next=days[(now.day+offset)%7],minute=clockMinutes(next.open);
  if(!next.enabled||minute===null||offset*1440+minute<=t)continue;
  upcoming={offset,day:(now.day+offset)%7,time:next.open};
  break;
 }
 let subtitle=open?'Bestilling tilgjengelig':preOpen?'Forhåndsbestilling tilgjengelig':
  manuallyClosed?'Midlertidig stengt':!today.enabled?'Stengt hele '+WEEKDAY_NAMES[now.day]:'Se neste åpningstid';
 // If tomorrow is closed, never display its opening clock as the next opening.
 if(!open&&!preOpen&&!manuallyClosed&&upcoming?.offset>1&&days[(now.day+1)%7].enabled===false)
  subtitle=WEEKDAY_NAMES[(now.day+1)%7].replace(/^./,c=>c.toUpperCase())+' er stengt';
 const nextLabel=upcoming?(upcoming.offset===0?'Åpner i dag kl. ':
  upcoming.offset===1?'Åpner i morgen kl. ':'Åpner '+WEEKDAY_NAMES[upcoming.day]+' kl. ')+upcoming.time:'Ingen åpningstid';
 return {
  open,title:open?'Åpent nå':preOpen?'Åpner senere i dag':!today.enabled?'Stengt i dag':'Stengt nå',
  subtitle,pill:open?'Stenger kl. '+closesAt:nextLabel
 };
}
function updateHoursStatus(){
 if(!menu)return;
 const status=calculateHoursStatus(menu.settings||{},osloTime());
 $('statusBanner').classList.toggle('is-closed',!status.open);
 $('statusTitle').textContent=status.title;
 $('statusSubtitle').textContent=status.subtitle;
 const pill=$('hoursPill');pill.hidden=false;pill.textContent='◷ '+status.pill;
}
function categoryProgress(){
 const nav=$('categories'),max=Math.max(0,nav.scrollWidth-nav.clientWidth),track=$('catProgress');
 const fraction=Math.min(1,nav.clientWidth/Math.max(nav.scrollWidth,1));
 track.style.width=(fraction*100)+'%';
 const travel=100-fraction*100;track.style.left=(max?nav.scrollLeft/max*travel:0)+'%';
 $('catPrev').disabled=nav.scrollLeft<=2;$('catNext').disabled=nav.scrollLeft>=max-2;
}
function moveCategoryButtonIntoView(target){
 const nav=$('categories');
 if(!target)return;
 const left=target.offsetLeft-nav.offsetLeft-target.parentElement.offsetLeft;
 const targetLeft=target.offsetLeft-(nav.clientWidth-target.offsetWidth)/2;
 nav.scrollTo({left:Math.max(0,targetLeft),behavior:'smooth'});
}
function watchSections(){
 if(scrollObserver)scrollObserver.disconnect();
 if(!('IntersectionObserver' in window))return;
 scrollObserver=new IntersectionObserver(entries=>{
   const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
   if(!visible.length)return;
   const id=visible[0].target.id.slice('category-'.length);
   if(activeCategory===id)return;activeCategory=id;
   const buttons=[...$('categories').querySelectorAll('[data-scroll]')];
   buttons.forEach(b=>b.classList.toggle('active',b.dataset.scroll===id));
   const target=buttons.find(b=>b.dataset.scroll===id);
   if(target)moveCategoryButtonIntoView(target);
 },{root:$('appViewport'),rootMargin:'-190px 0px -55% 0px'});
 $('menu').querySelectorAll('.menu-section').forEach(el=>scrollObserver.observe(el));
}

function getGroup(id){return menu.optionGroups.find(g=>String(g.id)===String(id))}
function groupsFor(item,size){const ids=[...(item.optionGroupIds||[]),...(size?.optionGroupIds||[])];return [...new Set(ids)].map(getGroup).filter(Boolean)}
function basePrice(item){const prices=list(item.sizes).map(s=>Number(s.price)||0);return prices.length?Math.min(...prices):Number(item.price)||0}
function productById(id){for(const s of menu.sections)for(const item of s.items)if(String(item.id)===String(id))return item;return null}
function imgEl(url,alt,cls){
 if(!url)return '';
 const cached=imageURLs.get(url);
 return '<img class="'+cls+'" data-image="'+esc(url)+'"'+(cached?' src="'+esc(cached)+'"':'')+' alt="'+esc(alt)+'" loading="'+(cached?'eager':'lazy')+'" decoding="async">';
}
/* Share each image download, reuse object URLs and cache responses once. */
const imagePromises=new Map();
async function resolveImage(url){
 if(imageURLs.has(url))return imageURLs.get(url);
 if(imagePromises.has(url))return imagePromises.get(url);
 const task=(async()=>{
  try{
   if(!('caches' in window))throw Error('Cache Storage unsupported');
   const cache=await caches.open('kol-beta-images-v1');
   let response=await cache.match(url);
   if(!response){
     response=await fetch(url,{mode:'cors',cache:'force-cache'});
     if(!response.ok||response.type==='opaque')throw Error('No cacheable image');
     try{await cache.put(url,response.clone())}catch{}
   }
   const blob=await response.blob();
   if(!blob.size)throw Error('Empty image');
   const objectURL=URL.createObjectURL(blob);
   imageURLs.set(url,objectURL);
   return objectURL;
  }catch{
   // The browser still reuses its normal HTTP image cache for CORS-restricted images.
   return url;
  }
 })();
 imagePromises.set(url,task);
 return task;
}
async function setCachedImage(img,url){
 if(!url||!img.isConnected)return;
 const resolved=await resolveImage(url);
 if(img.isConnected&&img.dataset.image===url&&img.getAttribute('src')!==resolved)img.src=resolved;
}
let imageObserver=null;
function hydrateImages(root){
 const images=[...root.querySelectorAll('img[data-image]')];
 if(imageObserver)imageObserver.disconnect();
 imageObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{
   for(const entry of entries){
     if(!entry.isIntersecting)continue;
     imageObserver.unobserve(entry.target);
     void setCachedImage(entry.target,entry.target.dataset.image);
   }
 },{root:$('appViewport'),rootMargin:'1200px 0px'}):null;
 const uniqueURLs=[...new Set(images.map(img=>img.dataset.image).filter(Boolean))];
 // The first 15 images begin resolving immediately; later images resolve ahead of scroll.
 for(const url of uniqueURLs.slice(0,15))void resolveImage(url).then(resolved=>{
  for(const img of images)if(img.isConnected&&img.dataset.image===url)img.src=resolved;
 });
 images.forEach((img,index)=>{
   const cached=imageURLs.get(img.dataset.image);
   if(cached){img.src=cached;return}
   if(index<15){img.loading='eager';void setCachedImage(img,img.dataset.image)}
   else if(imageObserver)imageObserver.observe(img);
   else void setCachedImage(img,img.dataset.image);
 });
}
function updateCardFavorite(id){
 for(const card of $('menu').querySelectorAll('[data-product-card]')){
  if(String(card.dataset.productCard)!==String(id))continue;
  const image=card.querySelector('.product-photo');
  if(!image)continue;
  const heart=image.querySelector('.card-favorite');
  if(isFavorite(id)&&!heart){
   const badge=document.createElement('span');
   badge.className='card-favorite is-favorite';badge.textContent='♥';
   badge.title='Favoritt';badge.setAttribute('aria-label','Favoritt');
   image.appendChild(badge);
  }else if(!isFavorite(id)&&heart)heart.remove();
 }
}
function updateCartBadges(){
 if(!menu)return;
 const totals=new Map();
 for(const line of cart)totals.set(String(line.id),(totals.get(String(line.id))||0)+Number(line.qty||0));
 for(const card of $('menu').querySelectorAll('[data-product-card]')){
  const count=totals.get(String(card.dataset.productCard))||0;
  const media=card.querySelector('.product-photo');
  if(!media)continue;
  let badge=media.querySelector('.in-cart');
  if(!count){if(badge)badge.remove();continue}
  if(!badge){badge=document.createElement('span');badge.className='in-cart';media.appendChild(badge)}
  badge.textContent='🛒 '+count+' i kurven';
 }
}
function menuBlocks(){
 const blocks=[],visible=item=>item&&!item.hidden&&!item.soldOut;
 const popularItems=(menu.popularItemIds||[]).map(id=>productById(id)).filter(visible);
 if(popularItems.length)blocks.push({id:'popular',title:'Mest bestilt',note:'Gjestenes favoritter',items:popularItems});
 for(const section of menu.sections){
   const items=(section.items||[]).filter(item=>!item.hidden);
   if(items.length)blocks.push({id:String(section.id),title:section.title,note:section.note||'',items});
 }
 return blocks;
}
function categoryGlyph(block){
 if(block.id==='popular')return '☆';
 const t=String(block.title||'').toLocaleLowerCase('no');
 if(t.includes('pizza'))return '♧';
 if(t.includes('kebab'))return '♢';
 if(t.includes('burger'))return '▤';
 if(t.includes('drikk'))return '◉';
 return '♨';
}
function productCard(i){
 const sizeCount=list(i.sizes).length;
 const amount=cart.filter(x=>String(x.id)===String(i.id)).reduce((a,x)=>a+x.qty,0);
 const allergens=list(i.allergens).map(a=>{const match=menu.allergenCatalog.find(x=>String(x.id)===String(a));return match?.label||a}).join(', ');
 return '<article class="product-card'+(i.soldOut?' is-soldout':'')+'" data-product-card="'+esc(i.id)+'" role="button" tabindex="'+(i.soldOut?'-1':'0')+'" aria-label="Velg '+esc(i.name)+'" aria-disabled="'+Boolean(i.soldOut)+'"><div class="product-photo">'+imgEl(i.imageUrl,i.name,'photo')+(amount?'<span class="in-cart">🛒 '+amount+' i kurven</span>':'')+(isFavorite(i.id)?'<span class="card-favorite is-favorite" aria-label="Favoritt" title="Favoritt">♥</span>':'')+'</div><div class="product-info"><h3>'+esc(i.name)+'</h3><p>'+esc(i.description||i.ingredients||'')+'</p>'+(allergens&&allergensVisible?'<p class="allergens">Inneholder '+esc(allergens)+'</p>':'')+'</div><div class="product-side"><span class="price">'+(sizeCount>1?'<small>fra </small>':'')+money(basePrice(i))+'</span><button class="add-round" data-product="'+esc(i.id)+'" '+(i.soldOut?'disabled':'')+' aria-label="Velg '+esc(i.name)+'">+</button></div></article>';
}
function render(){
 if(!menu)return;
 $('brandName').textContent=menu.settings?.restaurantName||'KØL Grill & Pizza';
 const blocks=menuBlocks(),q=$('search').value.trim().toLocaleLowerCase('no');
 const visibleBlocks=blocks.map(block=>({...block,items:block.items.filter(i=>!q||(String(i.name)+' '+(i.description||'')+' '+(i.ingredients||'')).toLocaleLowerCase('no').includes(q))})).filter(b=>b.items.length);
 const nav=$('categories'),savedX=nav.scrollLeft;
 nav.innerHTML=visibleBlocks.map((block,i)=>'<button type="button" data-scroll="'+esc(block.id)+'" class="'+(activeCategory===block.id||!activeCategory&&i===0?'active':'')+'"><span class="category-glyph" aria-hidden="true">'+categoryGlyph(block)+'</span><span>'+esc(block.title)+'</span></button>').join('');
 $('menu').innerHTML=visibleBlocks.map(block=>'<section class="menu-section" id="category-'+esc(block.id)+'"><h2 class="section-title">'+esc(block.title)+'</h2><p class="section-note">'+esc(block.note)+'</p>'+block.items.map(productCard).join('')+'</section>').join('')||'<p>Ingen produkter funnet.</p>';
 nav.scrollLeft=savedX;
 hydrateImages($('menu'));renderCartIndicators();updateHoursStatus();
 requestAnimationFrame(()=>{categoryProgress();watchSections()});
}
function showSheet(id){
 const item=productById(id);if(!item||item.soldOut)return;
 current=item;qty=1;selection={};$('quantity').textContent=qty;$('comment').value='';
 $('sheetTitle').textContent=item.name;$('sheetDesc').textContent=item.description||item.ingredients||'';
 const hero=$('sheetHero');hero.querySelectorAll('img').forEach(n=>n.remove());
 hero.classList.remove('has-image');
 const url=item.imageUrl;
 if(url){
   const img=document.createElement('img');img.alt=item.name;img.dataset.image=url;
   img.decoding='async';img.loading='eager';img.className='hero-photo';
   // Use the already displayed menu thumbnail immediately without a second request.
   const card=[...$('menu').querySelectorAll('[data-product-card]')].find(n=>n.dataset.productCard===String(id));
   const thumbnail=card?.querySelector('img[data-image]');
   img.src=thumbnail?.currentSrc||imageURLs.get(url)||url;
   img.onload=()=>{if(img.isConnected)hero.classList.add('has-image')};
   img.onerror=()=>{if(!img.isConnected)return;if(!img.dataset.fallbackUsed){img.dataset.fallbackUsed='1';img.src=url}else{img.remove();hero.classList.remove('has-image')}};
   hero.prepend(img);
   if(img.complete&&img.naturalWidth)hero.classList.add('has-image');
   void setCachedImage(img,url);
 }
 renderOptions();updateSheetFavorite();show('productSheet');
}
function renderOptions(){if(!current)return;const sizes=list(current.sizes),size=sizes.find(s=>String(s.id)===String(selection.size))||sizes[Math.min(Math.max(Number(current.defaultSizeIndex)||0,0),sizes.length-1)];if(size)selection.size=size.id;const groupHTML=(title,choices,key,type,required=false)=>'<fieldset class="option-group"><div class="option-head"><span>'+esc(title)+'</span>'+(required?'<span class="required">Påkrevd</span>':'')+'</div>'+choices.map((o,i)=>'<label class="option-choice"><input type="'+type+'" name="'+esc(key)+'" value="'+esc(o.id)+'" '+(type==='radio'?(String(selection[key])===String(o.id)?'checked':''):(Array.isArray(selection[key])&&selection[key].includes(o.id)?'checked':''))+'><span>'+esc(o.label||o.name||'')+'</span><span class="opt-price">'+(o.price?'+'+money(o.price):o.caption||'')+'</span></label>').join('')+'</fieldset>';let html='';if(sizes.length){html+=groupHTML('Størrelse',sizes.map(s=>({id:s.id,label:s.label||s.name,price:0,caption:money(s.price)})),'size','radio',true)}const groups=groupsFor(current,size);for(const g of groups){const key='group:'+g.id,opts=list(g.options).map(o=>({id:o.id,label:o.label||o.name,price:Number(o.price)||Number(o.priceDelta)||0}));if(!opts.length)continue;const multi=g.multiple===true||g.type==='multiple'||g.selectionType==='multiple'||Number(g.maxSelections)>1; if(!multi && selection[key]===undefined)selection[key]=(opts.find(o=>o.id===g.defaultOptionId)||opts[0]).id;html+=groupHTML(g.title||g.name||'Velg',opts,key,multi?'checkbox':'radio',!multi)}$('options').innerHTML=html;updatePrice()}
function currentPrice(){if(!current)return 0;const sizes=list(current.sizes),size=sizes.find(s=>String(s.id)===String(selection.size));let n=Number(size?.price??current.price)||0;for(const group of groupsFor(current,size)){const value=selection['group:'+group.id];for(const o of list(group.options))if(Array.isArray(value)?value.map(String).includes(String(o.id)):String(value)===String(o.id))n+=Number(o.price)||Number(o.priceDelta)||0}return n}
function updatePrice(){$('addPrice').textContent=money(currentPrice()*qty)}
function show(id){$('overlay').hidden=false;$(id).hidden=false;document.body.style.overflow='hidden'}
function hideAll(){$('overlay').hidden=true;$('productSheet').hidden=true;$('cartSheet').hidden=true;document.body.style.overflow=''}
function addToCart(){if(!current)return;const size=list(current.sizes).find(s=>String(s.id)===String(selection.size));const choices=groupsFor(current,size).map(g=>{const selected=selection['group:'+g.id],opts=list(g.options).filter(o=>Array.isArray(selected)?selected.map(String).includes(String(o.id)):String(selected)===String(o.id));return {groupId:g.id,group:g.title||g.name||'',options:opts.map(o=>({id:o.id,label:o.label||o.name,price:Number(o.price)||Number(o.priceDelta)||0}))}}).filter(g=>g.options.length);const entry={id:current.id,name:current.name,size:size?{id:size.id,label:size.label||size.name}:null,choices,comment:$('comment').value.trim().slice(0,500),qty,unitPrice:currentPrice()};const key=JSON.stringify([entry.id,entry.size?.id,entry.choices,entry.comment]);const old=cart.find(x=>JSON.stringify([x.id,x.size?.id,x.choices,x.comment])===key);if(old)old.qty+=qty;else cart.push(entry);saveCart();hideAll()}
function renderCartIndicators(){const n=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0);$('cartCount').hidden=!n;$('cartCount').textContent=n}
function cartChoiceRows(line){
 const rows=[];
 if(line.size?.label)rows.push('<div class="cart-choice"><span>Størrelse: <b>'+esc(line.size.label)+'</b></span></div>');
 for(const group of line.choices||[]){
  for(const opt of group.options||[]){
   rows.push('<div class="cart-choice"><span>'+esc(group.group||'Valg')+': <b>'+esc(opt.label)+'</b></span>'+(opt.price?'<strong>+'+money(opt.price)+'</strong>':'<small>Inkludert</small>')+'</div>');
  }
 }
 if(line.comment)rows.push('<div class="cart-choice is-note"><span>Merknad: <b>'+esc(line.comment)+'</b></span></div>');
 return rows.join('');
}
function renderCartContents(){
 const total=cart.reduce((sum,x)=>sum+(Number(x.qty)||0)*(Number(x.unitPrice)||0),0);
 $('cartTotal').textContent=money(total);
 $('cartClear').hidden=cart.length===0;
 $('cartItems').innerHTML=cart.length?cart.map((line,index)=>{
   return '<article class="cart-product-card" data-cart-line="'+index+'">'+
     '<div class="cart-product-heading"><div class="cart-product-copy"><strong class="cart-product-name">'+esc(line.name)+'</strong><small>'+esc(line.size?.label||'')+'</small></div>'+
     '<div class="cart-product-stepper"><button data-cart-minus="'+index+'" aria-label="Reduser antall">−</button><b>'+line.qty+'</b><button data-cart-plus="'+index+'" aria-label="Øk antall">+</button></div></div>'+
     '<div class="cart-product-details">'+cartChoiceRows(line)+'</div>'+
     '<div class="cart-product-totalrow"><button class="cart-remove" data-remove="'+index+'" aria-label="Fjern '+esc(line.name)+'">🗑 Fjern</button><strong>'+money(line.qty*line.unitPrice)+'</strong></div>'+
   '</article>';
 }).join(''):'<div class="cart-empty"><span>🛒</span><strong>Handlekurven er tom</strong><p>Velg noe fra menyen for å komme i gang.</p></div>';
}
function showCart(){renderCartContents();show('cartSheet')}
$('refresh').addEventListener('click',()=>refreshMenu());
$('showAllergens').addEventListener('change',e=>{allergensVisible=e.target.checked;try{localStorage.setItem('kol-beta-allergens',String(allergensVisible))}catch{}render()});
$('categories').addEventListener('scroll',categoryProgress,{passive:true});
/* Mouse dragging works alongside normal tab clicks. */
{
 const nav=$('categories');
 let pointer=null,origin=0,initialScroll=0,wasDragged=false;
 nav.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button!==0)return;
  pointer=e.pointerId;origin=e.clientX;initialScroll=nav.scrollLeft;wasDragged=false;
 });
 nav.addEventListener('pointermove',e=>{
  if(pointer!==e.pointerId)return;
  const delta=e.clientX-origin;
  if(Math.abs(delta)>12)wasDragged=true;
  if(wasDragged){nav.classList.add('is-grabbing');nav.scrollLeft=initialScroll-delta}
 });
 const end=e=>{
  if(pointer===null||e.pointerId!==pointer)return;
  pointer=null;nav.classList.remove('is-grabbing');
  draggedCategories=wasDragged;
  if(wasDragged)window.setTimeout(()=>{draggedCategories=false},60);
 };
 nav.addEventListener('pointerup',end);
 nav.addEventListener('pointercancel',end);
 nav.addEventListener('wheel',e=>{
  if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&nav.scrollWidth>nav.clientWidth){
   e.preventDefault();nav.scrollLeft+=e.deltaY;
  }
 },{passive:false});
}
$('catPrev').onclick=()=>$('categories').scrollBy({left:-Math.max(130,$('categories').clientWidth*.7),behavior:'smooth'});
$('catNext').onclick=()=>$('categories').scrollBy({left:Math.max(130,$('categories').clientWidth*.7),behavior:'smooth'});
window.addEventListener('resize',categoryProgress);function setSearchOpen(open){
 $('searchArea').hidden=!open;
 $('searchToggle').textContent=open?'×':'⌕';
 $('searchToggle').setAttribute('aria-label',open?'Lukk søk':'Søk');
 $('searchToggle').setAttribute('aria-expanded',String(open));
 if(!open&&$('search').value){$('search').value='';render()}
 if(open)$('search').focus();
}
$('searchToggle').addEventListener('click',()=>setSearchOpen($('searchArea').hidden));
$('search').addEventListener('input',()=>{
 $('searchClear').hidden=!$('search').value;
 render();
});
$('searchClear').addEventListener('click',()=>{
 $('search').value='';$('searchClear').hidden=true;render();$('search').focus();
});
$('categories').addEventListener('click',e=>{if(draggedCategories){draggedCategories=false;return}const b=e.target.closest('[data-scroll]');if(!b)return;$('categories').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));(()=>{const section=document.getElementById('category-'+b.dataset.scroll),viewport=$('appViewport');if(!section||!viewport)return;const target=section.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop-195;viewport.scrollTo({top:target,behavior:'smooth'});activeCategory=b.dataset.scroll;moveCategoryButtonIntoView(b)})()});
$('menu').addEventListener('click',e=>{
 const card=e.target.closest('[data-product-card]');
 if(!card||card.getAttribute('aria-disabled')==='true')return;
 showSheet(card.dataset.productCard);
});
$('menu').addEventListener('keydown',e=>{
 if((e.key!=='Enter'&&e.key!==' ')||e.target.closest('button'))return;
 const card=e.target.closest('[data-product-card]');
 if(!card||card.getAttribute('aria-disabled')==='true')return;
 e.preventDefault();showSheet(card.dataset.productCard);
});
$('sheetFavorite').addEventListener('click',()=>{if(current)toggleFavorite(current.id)});
$('options').addEventListener('change',e=>{const i=e.target;if(!i.matches('input'))return;if(i.type==='checkbox')selection[i.name]=[...$('options').querySelectorAll('input[name="'+CSS.escape(i.name)+'"]:checked')].map(x=>x.value);else selection[i.name]=i.value;if(i.name==='size'){for(const k of Object.keys(selection))if(k.startsWith('group:'))delete selection[k];renderOptions()}else updatePrice()});
$('plus').onclick=()=>{$('quantity').textContent=++qty;updatePrice()};$('minus').onclick=()=>{$('quantity').textContent=qty=Math.max(1,qty-1);updatePrice()};
$('add').onclick=addToCart;$('cartOpen').onclick=showCart;$('cartItems').addEventListener('click',e=>{
 const minus=e.target.closest('[data-cart-minus]'),plus=e.target.closest('[data-cart-plus]'),remove=e.target.closest('[data-remove]');
 if(!minus&&!plus&&!remove)return;
 const index=Number((minus||plus||remove).dataset.cartMinus??plus?.dataset.cartPlus??remove?.dataset.remove);
 if(!Number.isInteger(index)||index<0||index>=cart.length)return;
 if(remove)cart.splice(index,1);
 else if(plus)cart[index].qty=Math.min(99,Number(cart[index].qty||0)+1);
 else if(minus){cart[index].qty=Number(cart[index].qty||0)-1;if(cart[index].qty<=0)cart.splice(index,1)}
 saveCart();renderCartContents();
});
$('cartClear').addEventListener('click',()=>{
 if(!cart.length)return;
 cart=[];saveCart();renderCartContents();
});for(const id of ['overlay','sheetClose','cartClose','continue'])$(id).onclick=hideAll;document.addEventListener('keydown',e=>{if(e.key==='Escape')hideAll()});document.addEventListener('DOMContentLoaded',init);
