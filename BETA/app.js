/* Customer menu, browser caching and one live public update stream. */
'use strict';
const BASE='https://kol-grill-pizza-1-default-rtdb.firebaseio.com';
const CACHE_DB='kol-beta-public-kol1-v1';
const MENU_FALLBACK_KEY='kol-beta-menu-fallback-kol1-v1', IMAGE_PRELOAD_COUNT=6;
let refreshPending=false,activeCategory=null,allergensVisible=true,scrollObserver=null,draggedCategories=false;
let changeStream=null,changeCacheTimer=null,liveRevision=0;
let sharedChannel=null,sharedLeader=false,sharedLockPending=false,sharedLockController=null,sharedLockRelease=null;
const $=id=>document.getElementById(id), money=n=>Math.round(Number(n)||0)+' kr';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>Array.isArray(v)?v:Object.entries(v||{}).map(([id,x])=>x&&typeof x==='object'?{id,...x}:x).filter(Boolean);
let menu=null,current=null,qty=1,selection={},imageURLs=new Map();
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
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('IndexedDB unavailable'));return}
  const r=indexedDB.open(CACHE_DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('public');
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error);
 });
}
// IndexedDB is preferred. Backup small menus locally when it is unavailable,
// so reopening the page does not trigger another full Firebase download.
function readMenuFallback(){
 try{const data=JSON.parse(localStorage.getItem(MENU_FALLBACK_KEY)||'null');return data?.sections?.length?data:null}
 catch{return null}
}
async function localGet(){
 try{
  const db=await openDB();
  const value=await new Promise((resolve,reject)=>{
   const t=db.transaction('public','readonly'),r=t.objectStore('public').get('menu');
   r.onsuccess=()=>resolve(r.result||null);
   r.onerror=()=>reject(r.error);
   t.oncomplete=()=>db.close();
  });
  return value||readMenuFallback();
 }catch{return readMenuFallback()}
}
async function localPut(value){
 try{
  const db=await openDB();
  await new Promise((resolve,reject)=>{
   const t=db.transaction('public','readwrite');
   t.objectStore('public').put(value,'menu');
   t.oncomplete=()=>{db.close();resolve()};
   t.onerror=()=>{db.close();reject(t.error)};
  });
  try{localStorage.removeItem(MENU_FALLBACK_KEY)}catch{}
 }catch(error){
  try{
   const json=JSON.stringify(value);
   if(json.length>1_500_000)throw Error('Menu too large for fallback');
   localStorage.setItem(MENU_FALLBACK_KEY,json);
  }catch{throw error}
 }
}
// Expand shared image URLs, allergen combinations and size names only after the
// compact public JSON has arrived. The Firebase download contains each once.
function normalize(data){
 const images=Array.isArray(data.images)?data.images:[];
 const sizeLabels=Array.isArray(data.sizeLabels)?data.sizeLabels:[];
 const allergenSets=Array.isArray(data.allergenSets)?data.allergenSets:[];
 const sections=list(data.sections).map(section=>({...section,
  items:list(section.items).map(item=>{
   const imageUrl=Number.isInteger(item.imageId)?images[item.imageId]||'':item.imageUrl||'';
   const allergens=Number.isInteger(item.allergenSet)?list(allergenSets[item.allergenSet]):list(item.allergens);
   const sizes=list(item.sizes).map(size=>({
    ...size,label:Number.isInteger(size.labelId)?sizeLabels[size.labelId]||size.label||size.name||'':size.label
   }));
   return {...item,imageUrl,allergens,sizes};
  })
 }));
 return {cacheFormat:3,sections,optionGroups:list(data.optionGroups),
  allergenCatalog:list(data.allergenCatalog),images,sizeLabels,allergenSets,
  settings:data.settings||{},
  popularItemIds:list(data.popularItemIds).map(x=>typeof x==='object'?(x.id??x.value):x).filter(Boolean),
  updatedAt:Number(data.updatedAt)||0};
}
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
 // A single best-effort down/up scroll after first menu render on small touch screens.
 // Chrome may ignore scripted scrolling for browser toolbar visibility.
 watchStartupScrollIntent();
 renderDemoActiveOrder();
 let cached=null;try{cached=await localGet()}catch{}
 try{const state=localStorage.getItem('kol-beta-allergens');if(state!==null)allergensVisible=state==='true'}catch{}
 $('showAllergens').checked=allergensVisible;
 const useCached=value=>{
  menu=value;render();$('cacheStatus').textContent='Lagret lokalt';
 };
 if(cached?.sections?.length)useCached(cached);
 else if(navigator.locks&&typeof navigator.locks.request==='function'){
  // On a first visit, other tabs wait for the first tab's cached menu
  // instead of each downloading /menu and /settings from Firebase.
  try{
   await navigator.locks.request('kol-beta-initial-menu-kol1-v1',async()=>{
    const shared=await localGet();
    if(shared?.sections?.length)useCached(shared);
    else await refreshMenu(false);
   });
  }catch(error){
   if(!menu)await refreshMenu(false);
  }
 }else await refreshMenu(false);
 attemptStartupBrowserScroll();
 startSharedChangeStream();
 document.addEventListener('visibilitychange',()=>{
  // Visible customers stay live. Hidden tabs release Firebase streams and locks.
  if(document.hidden)stopSharedChangeStream();
  else startSharedChangeStream();
 });
 window.addEventListener('online',startSharedChangeStream);
 window.setInterval(updateHoursStatus,60000);
}
async function refreshMenu(manual=true){if(refreshPending)return;refreshPending=true;$('refresh').disabled=true;$('cacheStatus').textContent='Henter…';try{const startingRevision=liveRevision;const fresh=await fromFirebase();if(!(menu&&startingRevision!==liveRevision&&Number(menu.updatedAt)>Number(fresh.updatedAt)))menu=fresh;try{await localPut(menu)}catch(e){$('notice').textContent='Nettleseren kunne ikke lagre menyen lokalt.'}render();$('cacheStatus').textContent='Oppdatert';if(sharedChannel)broadcastLiveMessage({type:'snapshot',value:menu});}catch(e){if(!menu){$('notice').textContent='Kunne ikke hente menyen. Kontroller Firebase-lesetilgang og nettverk. '+e.message;$('cacheStatus').textContent='Ingen data'}else{$('notice').textContent='Kunne ikke oppdatere. Lokal meny vises.';$('cacheStatus').textContent='Lagret lokalt'}}finally{refreshPending=false;$('refresh').disabled=false}}

/* One tiny Firebase SSE subscription replaces all periodic GETs.
 * The initial snapshot is only the latest compact change notification.
 * Every notification contains the same version as the atomic admin update.
 * Missing/oversize delta => manual refresh prompt, never automatic full download.
 */
const LIVE_FEED_URL=BASE+'/menu/changeFeed/latest.json';
const unsafeSegment=part=>!part||part==='__proto__'||part==='constructor'||part==='prototype';
function applyLiveChanges(snapshot,changes){
 const next=structuredClone(snapshot);
 for(const change of changes){
   if(!change||typeof change.path!=='string')throw Error('Invalid change');
   const parts=change.path.split('/');
   if(parts.some(unsafeSegment)||parts.length<2)throw Error('Unsupported change path');
   if(!['menu','settings'].includes(parts[0]))throw Error('Unknown public data domain');
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
   const next=normalize({...applyLiveChanges(menu,value.changes),updatedAt:version});
   next.updatedAt=version;
   next.cacheFormat=3;
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
 if(document.hidden||!('EventSource' in window)||navigator.onLine===false)return;
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
const SHARED_STREAM_LOCK='kol1-public-menu-stream-v1';
const SHARED_STREAM_CHANNEL='kol1-public-menu-updates-v1';
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
 if(!menu||document.hidden||navigator.onLine===false)return;
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
 updateCartQuantityControls();
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
 const scrollRoot=window.matchMedia('(min-width:601px) and (pointer:fine)').matches?$('appViewport'):null;
 scrollObserver=new IntersectionObserver(entries=>{
   const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
   if(!visible.length)return;
   const id=visible[0].target.id.slice('category-'.length);
   if(activeCategory===id)return;activeCategory=id;
   const buttons=[...$('categories').querySelectorAll('[data-scroll]')];
   buttons.forEach(b=>b.classList.toggle('active',b.dataset.scroll===id));
   const target=buttons.find(b=>b.dataset.scroll===id);
   if(target)moveCategoryButtonIntoView(target);
 },{root:scrollRoot,rootMargin:'-115px 0px -55% 0px'});
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
 },{root:null,rootMargin:'400px 0px'}):null;
 const uniqueURLs=[...new Set(images.map(img=>img.dataset.image).filter(Boolean))];
 // Load only the first visible cards initially; defer the rest until scrolling.
 for(const url of uniqueURLs.slice(0,IMAGE_PRELOAD_COUNT))void resolveImage(url).then(resolved=>{
  for(const img of images)if(img.isConnected&&img.dataset.image===url)img.src=resolved;
 });
 images.forEach((img,index)=>{
   const cached=imageURLs.get(img.dataset.image);
   if(cached){img.src=cached;return}
   if(index<IMAGE_PRELOAD_COUNT){img.loading='eager';void setCachedImage(img,img.dataset.image)}
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
// Consistent local SVG icons: no image downloads, icon fonts, or extra CSS files.
/* Food icons adapted from Lucide (ISC), https://lucide.dev/ */
const CATEGORY_ICON_PATHS={
 star:"<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />",
 pizza:"<path d=\"m12 14-1 1\" /><path d=\"m13.75 18.25-1.25 1.42\" /><path d=\"M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12\" /><path d=\"M18.8 9.3a1 1 0 0 0 2.1 7.7\" /><path d=\"M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z\" />",
 kebab:"<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" />",
 burger:"<path d=\"M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25\" /><path d=\"M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2\" /><path d=\"M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0\" /><path d=\"m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2\" />",
 drink:"<path d=\"m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8\" /><path d=\"M5 8h14\" /><path d=\"M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0\" /><path d=\"m12 8 1-6h2\" />",
 salad:"<path d=\"M19.496 12a2.5 2.5 0 00.399-2.214A2 2 0 0020.32 6.5 2 2 0 0019 3a2 2 0 00-1.5.68 2 2 0 00-3.287.424 2.5 2.5 0 00-3.189 2.06A3 3 0 0012 12l4-4\" /><path d=\"M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z\" /><path d=\"M7 21h10\" /><path d=\"M9.85 6.907A3.5 3.5 0 005.05 12\" />",
 chicken:"<path d=\"M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23\" /><path d=\"m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59\" />",
 pasta:"<path d=\"M11.248 3c.273.1.808.53.747 1.36-.05.83-.938 1.2-.989 2.02-.06.78.333 1.24.727 1.62\" /><path d=\"M16.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62\" /><path d=\"M19.5 12 22 6\" /><path d=\"M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z\" /><path d=\"M6.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.735 1.62\" /><path d=\"M7 21h10\" />",
 dessert:"<path d=\"m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11\" /><path d=\"M17 7A5 5 0 0 0 7 7\" /><path d=\"M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4\" />",
 coffee:"<path d=\"M10 2v2\" /><path d=\"M14 2v2\" /><path d=\"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1\" /><path d=\"M6 2v2\" />",
 sauce:"<path d=\"M2 12h20\" /><path d=\"M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\" /><path d=\"m4 8 16-4\" /><path d=\"m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8\" />",
 grill:"<path d=\"M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3\" /><path d=\"m18.5 6 1.754 3.5a6.48 6.48 0 0 1-1.854 8.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5\" /><circle cx=\"12.5\" cy=\"8.5\" r=\"2.5\" />",
 kids:"<path d=\"M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4\" /><path d=\"M10 22 9 8\" /><path d=\"m14 22 1-14\" /><path d=\"M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z\" />",
 fish:"<path d=\"M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z\" /><path d=\"M18 12v.5\" /><path d=\"M16 17.93a9.77 9.77 0 0 1 0-11.86\" /><path d=\"M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33\" /><path d=\"M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4\" /><path d=\"m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98\" />",
 utensils:"<path d=\"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8\" /><path d=\"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7\" /><path d=\"m2.1 21.8 6.4-6.3\" /><path d=\"m19 5-7 7\" />",
 fries:"<path d=\"M4 9h16l-2 12H6L4 9Z\"/><path d=\"M7 9 6 3M10 9V2M14 9l1-6M18 9l1-5\"/>"
};
function categoryGlyph(block){
 const t=String(block.title||'').toLocaleLowerCase('no');
 let kind='utensils';
 if(block.id==='popular')kind='star';
 else if(/pizza/.test(t))kind='pizza';
 else if(/kebab|rull|wrap|lefse/.test(t))kind='kebab';
 else if(/burger/.test(t))kind='burger';
 else if(/pommes|fries|søtpotet/.test(t))kind='fries';
 else if(/drikk|brus|vann|juice|milkshake/.test(t))kind='drink';
 else if(/salat|vegetar/.test(t))kind='salad';
 else if(/kylling|chicken|snadder/.test(t))kind='chicken';
 else if(/pasta|spaghetti/.test(t))kind='pasta';
 else if(/dessert|kake|is\b|søt/.test(t))kind='dessert';
 else if(/kaffe|coffee|varm drikk/.test(t))kind='coffee';
 else if(/saus|dressing|dip|tilbehør|ekstra/.test(t))kind='sauce';
 else if(/barn|kids/.test(t))kind='kids';
 else if(/fisk|fish/.test(t))kind='fish';
 else if(/grill|biff|tallerken|rett/.test(t))kind='grill';
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+CATEGORY_ICON_PATHS[kind]+'</svg>';
}
function productCard(i){
 const sizeCount=list(i.sizes).length;
 const amount=cartQuantityForProduct(i.id);
 const allergens=list(i.allergens).map(a=>{const match=menu.allergenCatalog.find(x=>String(x.id)===String(a));return match?.label||a}).join(', ');
 return '<article class="product-card'+(i.soldOut?' is-soldout':'')+'" data-product-card="'+esc(i.id)+'" role="button" tabindex="'+(i.soldOut?'-1':'0')+'" aria-label="Velg '+esc(i.name)+'" aria-disabled="'+Boolean(i.soldOut)+'"><div class="product-photo">'+imgEl(i.imageUrl,i.name,'photo')+(amount?'<span class="in-cart">🛒 '+amount+' i kurven</span>':'')+(isFavorite(i.id)?'<span class="card-favorite is-favorite" aria-label="Favoritt" title="Favoritt">♥</span>':'')+'</div><div class="product-info"><h3>'+esc(i.name)+'</h3><p>'+esc(i.description||i.ingredients||'')+'</p>'+(allergens&&allergensVisible?'<p class="allergens">Inneholder '+esc(allergens)+'</p>':'')+'</div><div class="product-side"><span class="price">'+(sizeCount>1?'<small>fra </small>':'')+money(basePrice(i))+'</span><button class="add-round" type="button" '+(i.soldOut?'disabled':'')+' aria-label="Velg '+esc(i.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></button></div></article>';
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
 current=item;qty=1;selection={};removedIngredients=new Set();ingredientEditorExpanded=false;selectedKitchenNotes=new Set();editingCartIndex=null;
 $('add').firstChild.textContent='Legg til ';$('quantity').textContent=qty;$('comment').value='';
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
 // The product sheet is reused: never inherit another product's scroll position.
 const sheetScroll=$('productSheet').querySelector('.sheet-scroll');
 if(sheetScroll){sheetScroll.scrollTop=0;sheetScroll.scrollLeft=0}
 renderOptions();
 if(editIndex!==null&&cart[editIndex])restoreCartLineForEdit(cart[editIndex],editIndex);
 updateSheetFavorite();show('productSheet');
 // Reset again after showing, when the browser has laid out the new product.
 if(sheetScroll){sheetScroll.scrollTop=0;sheetScroll.scrollLeft=0}
}
const KITCHEN_NOTE_DEFAULTS={
 pizza:['Godt stekt','Ikke skjær','Del i to'],
 burger:['Godt stekt','Saus ved siden av'],
 kebab:['Saus ved siden av','Del i to'],
 tallerken:['Saus ved siden av'],
 other:['Ekstra servietter']
};
let removedIngredients=new Set(),ingredientEditorExpanded=false,selectedKitchenNotes=new Set();
function productSectionHeading(title,required){
 return '<div class="product-section-heading"><strong>'+esc(title)+'</strong>'+
  '<span class="product-section-flag">'+(required?'Påkrevd':'Valgfritt')+'</span></div>';
}
// Use the exact group order saved by the DEMO admin (item.optionGroupOrder).
// groupsFor also filters groups by the selected product size.
function productDisplayGroups(){
 return groupsFor(current,chosenSize());
}
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
 host.innerHTML='<details class="ingredient-editor detail-panel product-section"'+(ingredientEditorExpanded?' open':'')+'>'+
  '<summary class="ingredient-editor-toggle">'+
    '<svg class="ingredient-settings-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>'+
    '<span class="ingredient-editor-title">Tilpass ingredienser</span>'+
    '<span class="product-section-flag">Valgfritt</span>'+
    '<svg class="ingredient-editor-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'+
  '</summary>'+
  '<div class="ingredient-editor-body"><div class="ingredient-heading"><strong>Ingredienser</strong><small>Trykk for å fjerne</small></div>'+
  '<div class="ingredient-chips">'+names.map(name=>
   '<button type="button" class="ingredient-chip'+(removedIngredients.has(name)?' is-removed':'')+
   '" data-ingredient="'+esc(name)+'" aria-pressed="'+removedIngredients.has(name)+'">'+
   (removedIngredients.has(name)?'−':'✓')+' '+esc(name)+'</button>'
  ).join('')+'</div><p>Fjernede ingredienser kan legges tilbake med ett trykk.</p></div></details>';
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
 return '<section class="option-group product-section">'+
  productSectionHeading(group.title||'Velg',Boolean(group.required))+
  '<div class="option-rows">'+entries+'</div></section>';
}
function renderOptions(){
 if(!current)return;
 initializeOptions();
 const sizes=list(current.sizes),size=chosenSize();
 let html='';
 if(sizes.length>1){
  html+='<section class="option-group product-section">'+productSectionHeading('Størrelse',true)+
   '<div class="option-rows">';
  html+=sizes.map(entry=>'<label class="option-choice'+(String(entry.id)===String(size?.id)?' is-chosen':'')+'"><input type="radio" name="size" value="'+esc(entry.id)+'" '+(String(entry.id)===String(size?.id)?'checked':'')+'><span class="option-label-text">'+esc(entry.label||entry.name||'')+'</span><span class="opt-price">'+money(entry.price)+'</span></label>').join('');
  html+='</div></section>';
 }
 for(const group of productDisplayGroups())html+=optionGroupMarkup(group);
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
// Keep the document's scroll container intact: changing html/body overflow
// while a dialog is open can make the sticky restaurant header disappear.
function show(id){$('overlay').hidden=false;$(id).hidden=false}
function hideAll(){$('overlay').hidden=true;$('productSheet').hidden=true;$('cartSheet').hidden=true;$('demoConfirmation').hidden=true}
$('refresh').addEventListener('click',()=>refreshMenu());
$('showAllergens').addEventListener('change',e=>{allergensVisible=e.target.checked;try{localStorage.setItem('kol-beta-allergens',String(allergensVisible))}catch{}render()});
// Only one unobtrusive attempt per page load. Scripted scroll may not
// collapse Chrome's address bar: browser UI visibility is browser-controlled.
// Cancel immediately when a person interacts, so navigation is never hijacked.
let startupScrollInterrupted=false,startupScrollArmed=false,startupScrollFinished=false;
const startupScrollEvents=['touchstart','pointerdown','wheel','keydown'];
function interruptStartupScroll(){startupScrollInterrupted=true}
function watchStartupScrollIntent(){
 if(startupScrollArmed)return;
 startupScrollArmed=true;
 for(const name of startupScrollEvents)
  window.addEventListener(name,interruptStartupScroll,{passive:true});
}
function finishStartupScroll(){
 startupScrollFinished=true;
 for(const name of startupScrollEvents)
  window.removeEventListener(name,interruptStartupScroll);
}
function attemptStartupBrowserScroll(){
 if(startupScrollFinished)return;
 const mobile=window.matchMedia?.('(max-width:600px) and (pointer:coarse)').matches;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(!mobile||reducedMotion||startupScrollInterrupted||document.visibilityState!=='visible'||
    window.scrollY>2||!menu){finishStartupScroll();return}
 const available=document.documentElement.scrollHeight-window.innerHeight;
 if(available<180){finishStartupScroll();return}
 window.setTimeout(()=>{
  if(startupScrollInterrupted||window.scrollY>2||document.visibilityState!=='visible'||
     !$('overlay').hidden){finishStartupScroll();return}
  const distance=Math.min(240,document.documentElement.scrollHeight-window.innerHeight);
  if(distance<180){finishStartupScroll();return}
  autoNavScrollUntil=Date.now()+1100;
  window.scrollTo({top:distance,behavior:'instant'});
  window.setTimeout(()=>{
   if(!startupScrollInterrupted&&document.visibilityState==='visible'){
    window.scrollTo({top:0,behavior:'instant'});
    $('appViewport').classList.remove('nav-hidden');
    autoNavLastY=0;autoNavAccum=0;
   }
   finishStartupScroll();
  },160);
 },180);
}
// Scroll the page itself so mobile browsers can collapse their URL bars.
// The compact header and category row hide when scrolling down and reappear up.
let autoNavLastY=Math.max(0,window.scrollY),autoNavAccum=0,autoNavDirection=0,autoNavScrollUntil=0;
function updateAutoHideNav(){
 const y=Math.max(0,window.scrollY),delta=y-autoNavLastY;
 autoNavLastY=y;
 const app=$('appViewport');
 if(y<45){app.classList.remove('nav-hidden');autoNavAccum=0;return}
 if(!$('overlay').hidden||Date.now()<autoNavScrollUntil)return;
 const dir=Math.sign(delta);
 if(!dir)return;
 if(dir!==autoNavDirection){autoNavDirection=dir;autoNavAccum=0}
 autoNavAccum+=Math.abs(delta);
 if(autoNavAccum<18)return;
 app.classList.toggle('nav-hidden',dir>0);
 autoNavAccum=0;
}
window.addEventListener('scroll',updateAutoHideNav,{passive:true});
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
window.addEventListener('resize',()=>{categoryProgress();watchSections()});function setSearchOpen(open){
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
$('categories').addEventListener('click',e=>{if(draggedCategories){draggedCategories=false;return}const b=e.target.closest('[data-scroll]');if(!b)return;$('categories').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));const section=document.getElementById('category-'+b.dataset.scroll);if(!section)return;const app=$('appViewport');app.classList.remove('nav-hidden');autoNavScrollUntil=Date.now()+900;const offset=document.querySelector('.header').offsetHeight+document.querySelector('.category-wrap').offsetHeight+10;const desktop=window.matchMedia('(min-width:601px) and (pointer:fine)').matches;const target=desktop?Math.max(0,section.getBoundingClientRect().top-app.getBoundingClientRect().top+app.scrollTop-offset):Math.max(0,section.getBoundingClientRect().top+window.scrollY-offset);if(desktop)app.scrollTo({top:target,behavior:'smooth'});else window.scrollTo({top:target,behavior:'smooth'});activeCategory=b.dataset.scroll;moveCategoryButtonIntoView(b)});
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
 const summary=e.target.closest('.ingredient-editor-toggle');
 if(summary){
  // Native <details> toggles immediately after this click event.
  ingredientEditorExpanded=!summary.parentElement.open;
  return;
 }
 const button=e.target.closest('[data-ingredient]');if(!button)return;
 const name=button.dataset.ingredient;
 if(removedIngredients.has(name))removedIngredients.delete(name);else removedIngredients.add(name);
 ingredientEditorExpanded=true;
 ingredientEditor();renderSheetExtras();
});
$('quickNotes').addEventListener('click',e=>{
 const btn=e.target.closest('[data-kitchen-note]');if(!btn)return;
 const note=btn.dataset.kitchenNote;
 if(selectedKitchenNotes.has(note))selectedKitchenNotes.delete(note);else selectedKitchenNotes.add(note);
 renderSheetExtras();
});
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();returnToMenu()});
initCartEvents();
$('overlay').onclick=()=>{if(!$('productSheet').hidden)closeProductSheet();else hideAll()};
$('overlay').addEventListener('wheel',e=>e.preventDefault(),{passive:false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('productSheet').hidden)closeProductSheet();else hideAll()}});document.addEventListener('DOMContentLoaded',init);
