/* Customer menu, browser caching and one live public update stream. */
'use strict';
const BASE='https://kol-grill-pizza-default-rtdb.firebaseio.com';
const CACHE_DB='kol-beta-public-v1', CART_KEY='kol-beta-cart-v1', META_KEY='kol-beta-meta-v1';
let refreshPending=false,activeCategory=null,allergensVisible=true,scrollObserver=null,draggedCategories=false;
let changeStream=null,changeCacheTimer=null,liveRevision=0;
let sharedChannel=null,sharedLeader=false,sharedLockPending=false,sharedLockController=null,sharedLockRelease=null;
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
 startSharedChangeStream();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)startSharedChangeStream()});
 window.addEventListener('online',startSharedChangeStream);
 window.setInterval(updateHoursStatus,60000);
}
async function refreshMenu(manual=true){if(refreshPending)return;refreshPending=true;$('refresh').disabled=true;$('cacheStatus').textContent='Henter…';try{const startingRevision=liveRevision;const fresh=await fromFirebase();if(!(menu&&startingRevision!==liveRevision&&Number(menu.updatedAt)>Number(fresh.updatedAt)))menu=fresh;try{await localPut(menu)}catch(e){$('notice').textContent='Nettleseren kunne ikke lagre menyen lokalt.'}try{localStorage.setItem(META_KEY,JSON.stringify({lastSync:Date.now()}))}catch{}render();$('cacheStatus').textContent='Oppdatert';}catch(e){if(!menu){$('notice').textContent='Kunne ikke hente menyen. Kontroller Firebase-lesetilgang og nettverk. '+e.message;$('cacheStatus').textContent='Ingen data'}else{$('notice').textContent='Kunne ikke oppdatere. Lokal meny vises.';$('cacheStatus').textContent='Lagret lokalt'}}finally{refreshPending=false;$('refresh').disabled=false}}

/* One tiny Firebase SSE subscription replaces all periodic GETs.
 * The initial snapshot is only the latest compact change notification.
 * Every notification contains the same version as the atomic admin update.
 * Missing/oversize delta => manual refresh prompt, never automatic full download.
 */
const LIVE_FEED_URL=BASE+'/menu/changeFeed/latest.json';
// Add future public data domains here; share this same EventSource, never create a second listener.
const liveDomainHandlers=new Map();
function registerLiveDomain(name,apply){
 if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)||name==='menu'||name==='settings'||typeof apply!=='function')throw Error('Invalid live domain');
 liveDomainHandlers.set(name,apply);
}
const unsafeSegment=part=>!part||part==='__proto__'||part==='constructor'||part==='prototype';
function applyLiveChanges(snapshot,changes){
 const next=structuredClone(snapshot);
 for(const change of changes){
   if(!change||typeof change.path!=='string')throw Error('Invalid change');
   const parts=change.path.split('/');
   if(parts.some(unsafeSegment)||parts.length<2)throw Error('Unsupported change path');
   if(!['menu','settings'].includes(parts[0])){
     const handler=liveDomainHandlers.get(parts[0]);
     if(!handler)throw Error('Unregistered live domain');
     handler(next,parts.slice(1),change.value);
     continue;
   }
   // Locally cached menu has no "menu" wrapper.
   let target=parts[0]==='menu'?next:next.settings;
   const rest=parts.slice(1);
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
   askPeerForCurrentMenu();
   return;
 }
 await refreshMenu(false);
}
async function receiveLiveAnnouncement(value,relay=false){
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
   if(relay)broadcastLiveMessage({type:'delta',value});
   $('notice').textContent='';
   $('cacheStatus').textContent='Oppdatert automatisk';
 }catch(error){
   console.warn('Could not apply live menu update',error);
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
     if(update.path==='/')void receiveLiveAnnouncement(update.data,true);
     else if(update.path==='/latest')void receiveLiveAnnouncement(update.data,true);
     else{
       // Nested patch at a feed path: treat it as an unknown revision.
       void resyncAfterGap();
     }
   }catch(error){console.warn('Live menu update parse failed',error)}
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
/* Use one Firebase SSE stream across same-origin tabs when Web Locks and
 * BroadcastChannel are supported. Other tabs receive lightweight deltas
 * locally, not through separate Firebase listeners. On a gap they can copy
 * an up-to-date snapshot from another tab without a network download.
 */
const SHARED_STREAM_LOCK='kol-public-menu-stream-v1';
const SHARED_STREAM_CHANNEL='kol-public-menu-updates-v1';
function broadcastLiveMessage(value){
 try{sharedChannel?.postMessage(value)}catch{}
}
function askPeerForCurrentMenu(){
 broadcastLiveMessage({type:'snapshot-request',since:Number(menu?.updatedAt)||0});
}
function setupSharedChannel(){
 if(sharedChannel||!('BroadcastChannel' in window))return;
 try{
  const channel=new BroadcastChannel(SHARED_STREAM_CHANNEL);
  sharedChannel=channel;
  channel.onmessage=event=>{
   const message=event.data;
   if(!menu||!message||typeof message!=='object')return;
   if(message.type==='snapshot-request'){
    if(sharedLeader&&Number(menu.updatedAt)>Number(message.since||0))
     broadcastLiveMessage({type:'snapshot',value:menu});
    return;
   }
   if(message.type==='snapshot'){
    const newer=message.value;
    if(!newer||!Array.isArray(newer.sections)||!Array.isArray(newer.optionGroups)||
       !newer.settings||Number(newer.updatedAt)<=Number(menu.updatedAt))return;
    menu=newer;
    liveRevision++;
    saveLiveCacheSoon();
    render();
    $('notice').textContent='';
    $('cacheStatus').textContent='Oppdatert automatisk';
    return;
   }
   if(message.type==='delta')void receiveLiveAnnouncement(message.value);
  };
 }catch(error){sharedChannel=null;console.warn('Local tab sync unavailable',error)}
}
function startSharedChangeStream(){
 if(!menu||navigator.onLine===false)return;
 setupSharedChannel();
 askPeerForCurrentMenu();
 // Fallback keeps the original single-tab behavior in older browsers.
 if(!sharedChannel||!navigator.locks||typeof navigator.locks.request!=='function'){
  startChangeStream();return;
 }
 if(sharedLockPending){
  // A tab already holding the lock may need to restart SSE after going offline.
  if(sharedLeader)startChangeStream();
  return;
 }
 sharedLockPending=true;
 const controller=new AbortController();
 sharedLockController=controller;
 void navigator.locks.request(SHARED_STREAM_LOCK,{mode:'exclusive',signal:controller.signal},async()=>{
  if(controller.signal.aborted)return;
  sharedLeader=true;
  startChangeStream();
  await new Promise(resolve=>{sharedLockRelease=resolve});
  sharedLeader=false;
  if(changeStream){changeStream.close();changeStream=null}
 }).catch(error=>{
  if(error?.name!=='AbortError'){
   console.warn('Shared stream lock unavailable',error);
   if(!controller.signal.aborted)startChangeStream();
  }
 }).finally(()=>{
  if(sharedLockController===controller)sharedLockController=null;
  sharedLockRelease=null;
  sharedLockPending=false;
 });
}
function stopSharedChangeStream(){
 if(sharedLockController)sharedLockController.abort();
 if(sharedLockRelease)sharedLockRelease();
 if(changeStream){changeStream.close();changeStream=null}
 sharedLeader=false;
 if(sharedChannel){sharedChannel.close();sharedChannel=null}
}
window.addEventListener('pageshow',event=>{
 if(event.persisted)requestAnimationFrame(startSharedChangeStream);
});
window.addEventListener('pagehide',()=>{
 stopSharedChangeStream();
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
 // Preorders start at 00:00 on the same day of opening, NEVER the previous evening.
 const preOpen=!open&&!manuallyClosed&&today.enabled&&start!==null&&t<start;
 let upcoming=null;
 for(let offset=0;offset<=7;offset++){
  const next=days[(now.day+offset)%7],minute=clockMinutes(next.open);
  if(!next.enabled||minute===null||offset*1440+minute<=t)continue;
  upcoming={offset,day:(now.day+offset)%7,time:next.open};break;
 }
 const title=open?'Åpent nå':preOpen?'Forhåndsbestilling':!today.enabled?'Stengt i dag':'Stengt nå';
 let subtitle=open?'Vi tar imot bestillinger nå':preOpen?'Bestill nå · hent etter åpning':
  manuallyClosed?'Vi tar ikke imot bestillinger akkurat nå':!today.enabled?'Stengt hele '+WEEKDAY_NAMES[now.day]:'Vi tar ikke imot bestillinger akkurat nå';
 if(!open&&!preOpen&&!manuallyClosed&&upcoming?.offset>1&&days[(now.day+1)%7].enabled===false)
  subtitle=WEEKDAY_NAMES[(now.day+1)%7].replace(/^./,c=>c.toUpperCase())+' er stengt';
 const nextLabel=upcoming?(upcoming.offset===0?'Åpner i dag kl. ':'Åpner '+WEEKDAY_NAMES[upcoming.day]+' kl. ')+upcoming.time:'Ingen planlagt åpningstid';
 const pill=open?'Stenger kl. '+closesAt:preOpen?'Åpner kl. '+today.open:nextLabel;
 return {open,preOpen,orderable:open||preOpen,mode:open?'open':preOpen?'preorder':'closed',
  title,subtitle,pill,upcoming};
}
function getOrderingState(){
 return menu?calculateHoursStatus(menu.settings||{},osloTime()):{open:false,preOpen:false,orderable:false,mode:'closed',title:'Stengt',subtitle:'Meny utilgjengelig'};
}
function updateOrderingControls(){
 const state=getOrderingState();
 const add=$('add'),notice=$('sheetOrderNotice');
 if(add){
  add.disabled=!current||current.soldOut;
  add.setAttribute('aria-disabled',String(add.disabled));
  if(notice){notice.hidden=true;notice.textContent=''}
 }
 // Existing cart entries are preserved, but cannot be increased while closed.
 const cartPanel=$('cartSheet');
 if(cartPanel&&!cartPanel.hidden){
  cartPanel.querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
 }
}
function updateHoursStatus(){
 if(!menu)return;
 const status=getOrderingState(),banner=$('statusBanner');
 banner.classList.toggle('is-closed',status.mode==='closed');
 banner.classList.toggle('is-preorder',status.mode==='preorder');
 banner.classList.toggle('is-open',status.mode==='open');
 banner.dataset.state=status.mode;
 $('statusTitle').textContent=status.title;
 $('statusSubtitle').textContent=status.subtitle;
 const pill=$('hoursPill');pill.hidden=false;pill.textContent='◷ '+status.pill;
 const mark=banner.querySelector('.status-icon');
 if(mark){
  mark.innerHTML=status.mode==='closed'
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-7h6v7M3 10c1 2 3 2 4 0 1 2 3 2 5 0 1 2 3 2 5 0 1 2 3 2 4 0"/></svg>';
 }
 updateOrderingControls();
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
function groupsFor(item,size){const ids=[...(item.optionGroupIds||[]),...(size?.optionGroupIds||[])];const sorted=[...(item.optionGroupOrder||[]).filter(id=>ids.includes(id)),...ids];return [...new Set(sorted)].map(getGroup).filter(Boolean)}
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
function showSheet(id,editIndex=null){
 const item=productById(id);if(!item||item.soldOut)return;
 current=item;qty=1;selection={};removedIngredients=new Set();ingredientsOpen=false;selectedKitchenNotes=new Set();editingCartIndex=null;
 $('add').firstChild.textContent='🛒 Legg til ';$('quantity').textContent=qty;$('comment').value='';
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
 renderOptions();
 if(editIndex!==null&&cart[editIndex])restoreCartLineForEdit(cart[editIndex],editIndex);
 updateSheetFavorite();show('productSheet');
}
const KITCHEN_NOTE_DEFAULTS={
 pizza:['Godt stekt','Ikke skjær','Del i to'],
 burger:['Godt stekt','Saus ved siden av'],
 kebab:['Saus ved siden av','Del i to'],
 tallerken:['Saus ved siden av'],
 other:['Ekstra servietter']
};
let removedIngredients=new Set(),ingredientsOpen=false,selectedKitchenNotes=new Set(),editingCartIndex=null;
function kitchenNotesFor(item){
 if(menu.settings?.quickKitchenNotesEnabled===false||item?.quickKitchenNotesEnabled===false)return [];
 const section=menu.sections.find(s=>(s.items||[]).some(x=>String(x.id)===String(item.id)));
 const label=(String(section?.title||'')+' '+String(item.name||'')).toLocaleLowerCase('no');
 const kind=/pizza/.test(label)?'pizza':/burger|hamburger/.test(label)?'burger':/kebab|rull/.test(label)?'kebab':/tallerken|snadder/.test(label)?'tallerken':'other';
 let custom={};
 try{custom=JSON.parse(String(menu.settings?.quickKitchenNotesConfig||'{}'))||{}}catch{}
 const source=Array.isArray(item.quickKitchenNotes)?item.quickKitchenNotes:Array.isArray(custom[kind])?custom[kind]:KITCHEN_NOTE_DEFAULTS[kind];
 return [...new Set(source.map(n=>String(n||'').trim().replace(/\s+/g,' ').slice(0,60)).filter(n=>n&&!/^uten[\s:]/i.test(n)))].slice(0,8);
}
function removableIngredientRules(item){
 if(menu?.settings?.ingredientCustomizationEnabled===false)return [];
 const fallback=String(item.ingredients||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
 const raw=Array.isArray(item.ingredientRules)&&item.ingredientRules.length?item.ingredientRules:
  Array.isArray(item.ingredientDefaults)&&item.ingredientDefaults.length?item.ingredientDefaults:fallback;
 const seen=new Set();
 return raw.map(x=>typeof x==='string'?{name:x,removable:true}:x).filter(x=>{
  if(!x||x.removable===false||!String(x.name||'').trim())return false;
  const key=x.name.trim().toLocaleLowerCase('no');
  if(seen.has(key))return false;seen.add(key);return true;
 }).map(x=>String(x.name).trim());
}
function ingredientEditor(){
 const names=removableIngredientRules(current),host=$('sheetIngredients');
 if(!names.length){host.innerHTML='';return}
 host.innerHTML='<section class="ingredient-editor detail-panel'+(ingredientsOpen?' is-expanded':'')+'">'+
  '<button type="button" id="ingredientToggle" aria-expanded="'+ingredientsOpen+'" class="ingredient-toggle">'+
    '<span class="ingredient-symbol" aria-hidden="true">☷</span><span><strong>Tilpass ingredienser</strong><small>'+
    (removedIngredients.size?'Uten: '+esc([...removedIngredients].join(', ')):'Ingen endringer')+
    '</small></span><b aria-hidden="true">'+(ingredientsOpen?'⌄':'›')+'</b></button>'+
  '<div class="ingredient-editor-body" '+(ingredientsOpen?'':'hidden')+'><div class="ingredient-heading"><strong>Ingredienser</strong><small>Trykk for å fjerne</small></div>'+
  '<div class="ingredient-chips">'+names.map(name=>'<button type="button" class="ingredient-chip'+(removedIngredients.has(name)?' is-removed':'')+
   '" data-ingredient="'+esc(name)+'" aria-pressed="'+removedIngredients.has(name)+'">'+(removedIngredients.has(name)?'−':'✓')+' '+esc(name)+'</button>').join('')+
  '</div><p>Fjernede ingredienser kan legges tilbake med ett trykk.</p></div></section>';
}
function chosenSize(){
 const sizes=list(current?.sizes);
 return sizes.find(s=>String(s.id)===String(selection.size))||sizes[Math.min(Math.max(Number(current?.defaultSizeIndex)||0,0),sizes.length-1)];
}
function selectedIds(group){
 const val=selection['group:'+group.id];
 return Array.isArray(val)?val:[];
}
function initializeOptions(){
 const size=chosenSize();
 if(size)selection.size=size.id;
 for(const group of groupsFor(current,size)){
  const key='group:'+group.id;
  if(Array.isArray(selection[key]))continue;
  const valid=new Set(list(group.options).filter(o=>!o.soldOut).map(o=>String(o.id)));
  const defaults=list(group.defaultOptionIds).map(String).filter(id=>valid.has(id));
  selection[key]=group.selectionMode==='multiple'?defaults.slice(0,Math.max(1,Number(group.maxSelections)||1)):defaults.slice(0,1);
 }
}
function optionGroupMarkup(group){
 const options=list(group.options),multiple=group.selectionMode==='multiple',serving=multiple&&group.allowQuantity===true;
 const ids=selectedIds(group),max=Math.max(1,Math.min(30,Number(group.maxSelections)||1));
 const entries=options.map(opt=>{
  const count=ids.filter(id=>String(id)===String(opt.id)).length;
  const price=Number(opt.price)||0,blocked=Boolean(opt.soldOut)||(multiple&&ids.length>=max&&!count);
  if(serving)return '<div class="option-choice is-quantity'+(count?' is-chosen':'')+'"><span class="option-label-text">'+esc(opt.label||'')+
   '<small>'+(price?'+'+money(price)+' / stk':'Inkludert')+'</small></span>'+
   (count>1&&price?'<small class="option-line-total">Totalt +'+money(price*count)+'</small>':'')+
   '<div class="option-quantity"><button type="button" data-qty-group="'+esc(group.id)+'" data-qty-option="'+esc(opt.id)+'" data-qty-step="-1" '+(!count?'disabled':'')+' aria-label="Færre '+esc(opt.label)+'">−</button><b>'+count+'</b><button type="button" data-qty-group="'+esc(group.id)+'" data-qty-option="'+esc(opt.id)+'" data-qty-step="1" '+(blocked?'disabled':'')+' aria-label="Flere '+esc(opt.label)+'">+</button></div></div>';
  return '<label class="option-choice'+(count?' is-chosen':'')+'"><input type="'+(multiple?'checkbox':'radio')+'" name="group:'+esc(group.id)+'" value="'+esc(opt.id)+'" '+(count?'checked':'')+' '+(blocked?'disabled':'')+'><span class="option-label-text">'+esc(opt.label||'')+'</span><span class="opt-price">'+(price?'+'+money(price):'Inkludert')+'</span></label>';
 }).join('');
 const guidance=group.required?'Påkrevd':'Valgfritt';
 return '<fieldset class="option-group"><div class="option-head"><strong>'+esc(group.title||'Velg')+'</strong><span class="required">'+guidance+'</span>'+
  (multiple?'<small>Maks '+max+' stk · '+ids.length+' valgt</small>':'')+'</div><div class="option-rows">'+entries+'</div></fieldset>';
}
function restoreCartLineForEdit(line,index){
 if(String(line.id)!==String(current?.id))return;
 editingCartIndex=index;
 qty=Math.max(1,Math.min(99,Number(line.qty)||1));
 $('quantity').textContent=qty;
 if(line.size?.id!==undefined)selection.size=line.size.id;
 for(const group of groupsFor(current,chosenSize())){
  const found=(line.choices||[]).find(x=>String(x.groupId)===String(group.id));
  if(found){
   selection['group:'+group.id]=found.options.flatMap(opt=>Array.from(
    {length:Math.max(1,Number(opt.count)||1)},()=>String(opt.id)));
  }
 }
 removedIngredients=new Set(line.removedIngredients||[]);
 const allowed=kitchenNotesFor(current);
 selectedKitchenNotes=new Set((line.quickNotes||[]).filter(n=>allowed.includes(n)));
 const raw=String(line.comment||'');
 $('comment').value=raw.split('\n').filter(x=>!selectedKitchenNotes.has(x)).join('\n');
 renderOptions();
 $('add').firstChild.textContent='Oppdater kurven ';
}

function renderOptions(){
 if(!current)return;
 initializeOptions();
 const sizes=list(current.sizes),size=chosenSize();
 let html='';
 if(sizes.length>1){
  html+='<fieldset class="option-group"><div class="option-head"><strong>Størrelse</strong><span class="required">Påkrevd</span></div><div class="option-rows">';
  html+=sizes.map(entry=>'<label class="option-choice'+(String(entry.id)===String(size?.id)?' is-chosen':'')+'"><input type="radio" name="size" value="'+esc(entry.id)+'" '+(String(entry.id)===String(size?.id)?'checked':'')+'><span class="option-label-text">'+esc(entry.label||entry.name||'')+'</span><span class="opt-price">'+money(entry.price)+'</span></label>').join('');
  html+='</div></fieldset>';
 }
 for(const group of groupsFor(current,size))html+=optionGroupMarkup(group);
 $('options').innerHTML=html;
 renderSheetExtras();
 updatePrice();
}
function renderSheetExtras(){
 ingredientEditor();
 const notes=kitchenNotesFor(current);
 $('quickNotes').innerHTML=notes.length?notes.map(note=>'<button type="button" class="quick-note'+(selectedKitchenNotes.has(note)?' is-selected':'')+'" data-kitchen-note="'+esc(note)+'" aria-pressed="'+selectedKitchenNotes.has(note)+'">'+esc(note)+'</button>').join(''):'<span class="empty-notes">Ingen raske beskjeder</span>';
 const selected=groupsFor(current,chosenSize()).flatMap(group=>list(group.options).filter(opt=>selectedIds(group).some(id=>String(id)===String(opt.id))));
 const allergenIds=new Set([...list(current.allergens),...selected.flatMap(opt=>list(opt.allergens))].map(String));
 const labels=[...allergenIds].map(id=>menu.allergenCatalog.find(a=>String(a.id)===id)?.label||id);
 $('allergenInfo').innerHTML=labels.length?labels.map(label=>'<span class="allergen-chip">'+esc(label)+'</span>').join(''):'<span class="allergen-empty">Allergener ikke oppgitt</span>';
 if(removedIngredients.size)$('allergenInfo').innerHTML+='<p class="allergen-caution">Allergeninformasjon kan være ufullstendig selv om du fjerner ingredienser.</p>';
}
function currentPrice(){
 if(!current)return 0;
 let price=Number(chosenSize()?.price??current.price)||0;
 for(const group of groupsFor(current,chosenSize())){
  for(const id of selectedIds(group)){
   const opt=list(group.options).find(o=>String(o.id)===String(id));
   if(opt)price+=Number(opt.price)||0;
  }
 }
 return price;
}
function optionValidation(){
 for(const group of groupsFor(current,chosenSize())){
  const ids=selectedIds(group),min=group.required?Math.max(1,Number(group.minSelections)||1):0;
  const max=Math.max(1,Number(group.maxSelections)||1);
  if(ids.length<min)return 'Velg minst '+min+' i «'+(group.title||'valg')+'».';
  if(ids.length>max)return 'Maks '+max+' valg i «'+(group.title||'valg')+'».';
 }
 return '';
}
function updatePrice(){
 $('addPrice').textContent=money(currentPrice()*qty);
 updateOrderingControls();
}
function show(id){$('overlay').hidden=false;$(id).hidden=false;document.body.style.overflow='hidden'}
function hideAll(){$('overlay').hidden=true;$('productSheet').hidden=true;$('cartSheet').hidden=true;document.body.style.overflow=''}
function closeProductSheet(){const wasEditing=editingCartIndex!==null;editingCartIndex=null;hideAll();if(wasEditing)showCart()}
function addToCart(){
 if(!current)return;
 const availability=getOrderingState();
 const error=optionValidation();
 if(error){
  const notice=$('sheetOrderNotice');notice.hidden=false;notice.textContent=error;return;
 }
 const size=chosenSize();
 const choices=groupsFor(current,size).map(group=>{
  const ids=selectedIds(group);
  const options=list(group.options).filter(opt=>ids.some(id=>String(id)===String(opt.id))).map(opt=>({
   id:opt.id,label:opt.label||opt.name,price:Number(opt.price)||0,
   count:ids.filter(id=>String(id)===String(opt.id)).length
  }));
  return {groupId:group.id,group:group.title||'',options};
 }).filter(group=>group.options.length);
 const notes=[...selectedKitchenNotes];
 const own=$('comment').value.trim().slice(0,1000);
 const removed=[...removedIngredients];
 const comment=[...notes,own].filter(Boolean).join('\n').slice(0,1000);
 const entry={id:current.id,name:current.name,size:size?{id:size.id,label:size.label||size.name}:null,
  choices,removedIngredients:removed,quickNotes:notes,comment,qty,unitPrice:currentPrice()};
 const key=line=>JSON.stringify([line.id,line.size?.id,line.choices,line.removedIngredients||[],line.comment]);
 const existing=cart.find(line=>key(line)===key(entry));
 if(editingCartIndex!==null&&cart[editingCartIndex])cart[editingCartIndex]=entry;
 else if(existing)existing.qty+=qty;else cart.push(entry);
 const edited=editingCartIndex!==null;editingCartIndex=null;
 saveCart();hideAll();if(edited||!availability.orderable)showCart();
}
function renderCartIndicators(){const n=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0);$('cartCount').hidden=!n;$('cartCount').textContent=n}
function cartChoiceRows(line){
 const rows=[];
 if(line.size?.label)rows.push('<div class="cart-choice"><span>Størrelse: <b>'+esc(line.size.label)+'</b></span></div>');
 for(const group of line.choices||[]){
  for(const opt of group.options||[]){
   const count=Math.max(1,Number(opt.count)||1);
   rows.push('<div class="cart-choice"><span>'+esc(group.group||'Valg')+': <b>'+esc((count>1?count+'× ':'')+opt.label)+'</b></span>'+(opt.price?'<strong>+'+money(opt.price)+(count>1?' / stk · Totalt +'+money(opt.price*count):'')+'</strong>':'<small>Inkludert</small>')+'</div>');
  }
 }
 if((line.removedIngredients||[]).length)rows.push('<div class="cart-choice is-note"><span>Uten: <b>'+esc(line.removedIngredients.join(', '))+'</b></span></div>');
 if(line.comment)rows.push('<div class="cart-choice is-note"><span>Merknad: <b>'+esc(line.comment)+'</b></span></div>');
 return rows.join('');
}
const CART_SUGGESTIONS_CACHE_KEY='kol-beta-cart-suggestions-once-v1';
const CART_SUGGESTIONS_DISMISS_KEY='kol-beta-cart-dismissed-v1';
let dismissedSuggestions=new Set((()=>{try{return JSON.parse(localStorage.getItem(CART_SUGGESTIONS_DISMISS_KEY)||'[]')}catch{return []}})());
let frozenSuggestionSettings=null;
function frozenSuggestions(){
 if(frozenSuggestionSettings)return frozenSuggestionSettings;
 try{
  const saved=JSON.parse(localStorage.getItem(CART_SUGGESTIONS_CACHE_KEY)||'null');
  if(saved&&typeof saved==='object'&&saved.schema===1){frozenSuggestionSettings=saved;return saved}
 }catch{}
 let rules={};
 try{rules=JSON.parse(String(menu?.settings?.cartSuggestionRules||'{}'))||{}}catch{}
 const snapshot={schema:1,enabled:menu?.settings?.cartSuggestionsEnabled!==false,
  rules,max:4,createdAt:Date.now()};
 frozenSuggestionSettings=snapshot;
 try{localStorage.setItem(CART_SUGGESTIONS_CACHE_KEY,JSON.stringify(snapshot))}catch{}
 return snapshot;
}
function suggestionKind(section,item){
 const text=(String(section?.title||'')+' '+String(item?.name||'')).toLocaleLowerCase('no');
 if(/pizza/.test(text))return 'pizza';
 if(/hamburger|burger/.test(text))return 'burger';
 if(/kebab|rull/.test(text))return 'kebab';
 if(/tallerken|snadder/.test(text))return 'tallerken';
 return 'other';
}
function suggestionType(section,item){
 const text=(String(section?.title||'')+' '+String(item?.name||'')).toLocaleLowerCase('no');
 if(/brus|cola|pepsi|fanta|sprite|drikke|vann|iste|energidrikk/.test(text))return 'drink';
 if(/pommes|fries|søtpotet/.test(text))return 'fries';
 if(/saus|dipp|dip|dressing/.test(text))return 'sauce';
 return '';
}
function suggestedCartItems(){
 if(!menu||!cart.length)return [];
 const prefs=frozenSuggestions();
 if(!prefs.enabled)return [];
 const included=new Set([...cart.map(x=>String(x.id)),...dismissedSuggestions]);
 const all=menu.sections.flatMap(section=>(section.items||[]).map(item=>({item,section})))
  .filter(({item})=>item&&item.id&&!item.hidden&&!item.soldOut&&!included.has(String(item.id)));
 const sourceKinds=[...new Set(cart.map(line=>{
  const section=menu.sections.find(s=>(s.items||[]).some(item=>String(item.id)===String(line.id)));
  return suggestionKind(section,productById(line.id)||{});
 }))];
 const selected=[],used=new Set();
 function add(entry){if(entry&&!used.has(String(entry.item.id))&&selected.length<4){selected.push(entry);used.add(String(entry.item.id))}}
 for(const kind of sourceKinds){
  const ids=Array.isArray(prefs.rules?.[kind])?prefs.rules[kind]:[];
  for(const id of ids)add(all.find(x=>String(x.item.id)===String(id)));
 }
 const preferred=sourceKinds.some(k=>k==='burger'||k==='kebab')?['fries','drink','sauce']:
  sourceKinds.includes('pizza')?['sauce','drink','fries']:['drink','fries','sauce'];
 for(const type of preferred)
  for(const entry of all)if(suggestionType(entry.section,entry.item)===type)add(entry);
 return selected.slice(0,4);
}
function renderCartRecommendations(){
 const host=$('cartRecommendations'),items=$('cartRecommendationsItems');
 const suggestions=suggestedCartItems();
 host.hidden=!suggestions.length;
 if(!suggestions.length){items.replaceChildren();return}
 items.innerHTML=suggestions.map(({item})=>'<article class="cart-recommendation">'+
  '<div class="cart-suggestion-image">'+imgEl(item.imageUrl,'','suggestion-photo')+'</div>'+
  '<div class="cart-recommendation-copy"><strong>'+esc(item.name)+'</strong><span>'+money(basePrice(item))+'</span></div>'+
  '<button type="button" class="cart-suggest-add" data-suggest-add="'+esc(item.id)+'" aria-label="Legg til '+esc(item.name)+'">+</button>'+
  '<button type="button" class="cart-suggest-dismiss" data-suggest-dismiss="'+esc(item.id)+'" aria-label="Skjul '+esc(item.name)+'">×</button>'+
  '</article>').join('');
 items.querySelectorAll('img[data-image]').forEach(im=>void setCachedImage(im,im.dataset.image));
}
const cartTrashIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
const cartEditIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 4 4 4-9.4 9.4-4.1 1.1 1.1-4.1L17 5a2.1 2.1 0 0 1 3 3"/></svg>';
function cartLineDetails(line){
 let rows=[];
 const count=Math.max(1,Number(line.qty)||1);
 const price=Number(line.unitPrice)||0;
 const size=line.size?.label||'Standard';
 // Per-item size display follows the original cart's line-by-line layout.
 for(let i=0;i<count;i++)
  rows.push('<div class="cart-line-detail"><span><b>Størrelse:</b> '+esc(size)+'</span><strong>'+money(price)+'</strong></div>');
 for(const group of line.choices||[]){
  for(const option of group.options||[]){
   const qty=Math.max(1,Number(option.count)||1);
   rows.push('<div class="cart-line-detail"><span><b>'+esc(group.group||'Valg')+':</b> '+esc((qty>1?qty+'× ':'')+option.label)+'</span>'+
    (Number(option.price)?'<small>+'+money(option.price)+' / stk</small>':'<small>Inkludert</small>')+'</div>');
  }
 }
 if((line.removedIngredients||[]).length)
  rows.push('<div class="cart-line-detail is-alert"><span>Uten: '+esc(line.removedIngredients.join(', '))+'</span></div>');
 if(line.comment)rows.push('<div class="cart-line-detail is-alert"><span>'+esc(line.comment)+'</span></div>');
 return rows.join('');
}
function renderCartContents(){
 const total=cart.reduce((sum,x)=>sum+(Number(x.qty)||0)*(Number(x.unitPrice)||0),0);
 $('cartTotal').textContent=money(total);
 $('cartTopCount').textContent=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0);
 $('cartClear').hidden=!cart.length;
 $('cartSummary').hidden=!cart.length;
 $('cartItems').innerHTML=cart.length?cart.map((line,index)=>
  '<article class="cart-product-card" data-cart-line="'+index+'">'+
  '<div class="cart-product-heading"><div class="cart-product-copy"><strong class="cart-product-name">'+esc(line.name)+'</strong>'+
  '<button type="button" class="cart-product-edit" data-edit="'+index+'" aria-label="Endre '+esc(line.name)+'" title="Endre produkt">'+cartEditIcon+'</button></div>'+
  '<div class="cart-product-stepper"><button data-cart-minus="'+index+'" aria-label="'+(Number(line.qty)>1?'Reduser antall':'Fjern produkt')+'">'+(Number(line.qty)>1?'−':cartTrashIcon)+'</button><b>'+line.qty+'</b><button data-cart-plus="'+index+'" aria-label="Øk antall">+</button></div></div>'+
  '<div class="cart-product-details">'+cartLineDetails(line)+'</div>'+
  '<div class="cart-product-totalrow"><span>Sum</span><strong>'+money(line.qty*line.unitPrice)+'</strong></div></article>'
 ).join(''):'<div class="cart-empty"><span>🛒</span><strong>Handlekurven er tom</strong><p>Velg noe godt fra menyen.</p></div>';
 renderCartRecommendations();
 const availability=getOrderingState();
 $('cartAvailabilityNotice').hidden=availability.orderable||!cart.length;
 $('cartAvailabilityNotice').textContent=availability.orderable?'':'Restauranten er stengt for bestilling nå. Du kan legge varer i handlekurven, men kan ikke gå videre før restauranten tar imot bestillinger. '+availability.pill+'.';
 $('cartItems').querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}
function showCart(){renderCartContents();show('cartSheet');updateOrderingControls()}
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
 $('searchToggle').innerHTML=open?'×':'<svg viewBox="0 0 24 24" width="29" height="29" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.5 15.5 5 5"/></svg>';
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
$('options').addEventListener('change',e=>{
 const input=e.target;if(!input.matches('input'))return;
 if(input.name==='size'){
  selection.size=input.value;
  for(const key of Object.keys(selection))if(key.startsWith('group:'))delete selection[key];
  renderOptions();return;
 }
 const id=input.name.slice(6),group=getGroup(id);if(!group)return;
 const key='group:'+id,old=selectedIds(group);
 if(group.selectionMode==='multiple'){
  const next=input.checked?[...old.filter(v=>String(v)!==input.value),input.value]:old.filter(v=>String(v)!==input.value);
  const max=Math.max(1,Number(group.maxSelections)||1);
  if(next.length>max){input.checked=false;return}
  selection[key]=next;
 }else selection[key]=[input.value];
 renderOptions();
});
$('options').addEventListener('click',e=>{
 const button=e.target.closest('[data-qty-group]');if(!button)return;
 e.preventDefault();
 const group=getGroup(button.dataset.qtyGroup);if(!group||group.selectionMode!=='multiple'||!group.allowQuantity)return;
 const key='group:'+group.id,ids=[...selectedIds(group)],id=button.dataset.qtyOption;
 if(button.dataset.qtyStep==='1'){
  if(ids.length>=Math.max(1,Number(group.maxSelections)||1))return;
  ids.push(id);
 }else{
  const index=ids.findIndex(v=>String(v)===String(id));if(index>=0)ids.splice(index,1);
 }
 selection[key]=ids;renderOptions();
});
$('sheetIngredients').addEventListener('click',e=>{
 const toggle=e.target.closest('#ingredientToggle');
 if(toggle){ingredientsOpen=!ingredientsOpen;ingredientEditor();return}
 const button=e.target.closest('[data-ingredient]');if(!button)return;
 const name=button.dataset.ingredient;
 if(removedIngredients.has(name))removedIngredients.delete(name);else removedIngredients.add(name);
 ingredientEditor();renderSheetExtras();
});
$('quickNotes').addEventListener('click',e=>{
 const btn=e.target.closest('[data-kitchen-note]');if(!btn)return;
 const note=btn.dataset.kitchenNote;
 if(selectedKitchenNotes.has(note))selectedKitchenNotes.delete(note);else selectedKitchenNotes.add(note);
 renderSheetExtras();
});
$('plus').onclick=()=>{$('quantity').textContent=++qty;updatePrice()};$('minus').onclick=()=>{$('quantity').textContent=qty=Math.max(1,qty-1);updatePrice()};
$('add').onclick=addToCart;$('cartOpen').onclick=showCart;$('cartItems').addEventListener('click',e=>{
 const edit=e.target.closest('[data-edit]');
 if(edit){
  const index=Number(edit.dataset.edit);
  if(Number.isInteger(index)&&cart[index]){
   const id=cart[index].id;hideAll();showSheet(id,index);
  }
  return;
 }
 const minus=e.target.closest('[data-cart-minus]'),plus=e.target.closest('[data-cart-plus]'),remove=e.target.closest('[data-remove]');
 if(!minus&&!plus&&!remove)return;
 const index=Number((minus||plus||remove).dataset.cartMinus??plus?.dataset.cartPlus??remove?.dataset.remove);
 if(!Number.isInteger(index)||index<0||index>=cart.length)return;
 if(remove)cart.splice(index,1);
 else if(plus){cart[index].qty=Math.min(99,Number(cart[index].qty||0)+1)}
 else if(minus){cart[index].qty=Number(cart[index].qty||0)-1;if(cart[index].qty<=0)cart.splice(index,1)}
 saveCart();renderCartContents();
});
$('cartRecommendationsItems').addEventListener('click',event=>{
 const dismiss=event.target.closest('[data-suggest-dismiss]');
 if(dismiss){
  dismissedSuggestions.add(String(dismiss.dataset.suggestDismiss));
  try{localStorage.setItem(CART_SUGGESTIONS_DISMISS_KEY,JSON.stringify([...dismissedSuggestions]))}catch{}
  renderCartRecommendations();return;
 }
 const add=event.target.closest('[data-suggest-add]');
 if(!add)return;
 const item=productById(add.dataset.suggestAdd);if(!item||item.soldOut)return;
 // Use the configured default size and default selections, without opening the product sheet.
 // Optional sauces/extras stay unselected; mandatory groups require valid defaults.
 const sizes=list(item.sizes);
 const size=sizes[Math.min(Math.max(Number(item.defaultSizeIndex)||0,0),Math.max(0,sizes.length-1))];
 const groups=groupsFor(item,size);
 const choices=[];
 let price=Number(size?.price??item.price)||0;
 for(const group of groups){
  const available=list(group.options).filter(opt=>!opt.soldOut);
  const allowed=new Set(available.map(opt=>String(opt.id)));
  const max=Math.max(1,Number(group.maxSelections)||1);
  const min=group.required?Math.max(1,Number(group.minSelections)||1):0;
  const defaults=list(group.defaultOptionIds).map(String).filter(id=>allowed.has(id));
  const selected=group.selectionMode==='multiple'?defaults.slice(0,max):defaults.slice(0,1);
  if(selected.length<min){
   // No valid required default: product detail is necessary before adding.
   hideAll();showSheet(item.id);return;
  }
  const options=available.filter(opt=>selected.includes(String(opt.id))).map(opt=>{
   const count=selected.filter(id=>id===String(opt.id)).length;
   const unit=Number(opt.price)||0;
   price+=unit*count;
   return {id:opt.id,label:opt.label||opt.name,price:unit,count};
  });
  if(options.length)choices.push({groupId:group.id,group:group.title||'',options});
 }
 const line={id:item.id,name:item.name,size:size?{id:size.id,label:size.label||size.name}:null,choices,removedIngredients:[],quickNotes:[],comment:'',qty:1,unitPrice:price};
 const signature=entry=>JSON.stringify([String(entry.id),String(entry.size?.id),entry.choices||[],entry.removedIngredients||[],entry.comment||'']);
 const existing=cart.find(x=>signature(x)===signature(line));
 if(existing)existing.qty++;else cart.push(line);
 saveCart();renderCartContents();
});
$('cartClear').addEventListener('click',()=>{
 if(!cart.length)return;
 cart=[];saveCart();renderCartContents();
});for(const id of ['cartClose','continue'])$(id).onclick=hideAll;
$('sheetClose').onclick=closeProductSheet;
$('overlay').onclick=()=>{if(!$('productSheet').hidden)closeProductSheet();else hideAll()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('productSheet').hidden)closeProductSheet();else hideAll()}});document.addEventListener('DOMContentLoaded',init);
