/* BETA: public menu only. No listeners, analytics or order writes. */
'use strict';
const BASE='https://kol-grill-pizza-default-rtdb.firebaseio.com';
const CACHE_DB='kol-beta-public-v1', CART_KEY='kol-beta-cart-v1', META_KEY='kol-beta-meta-v1';
const VERSION_INTERVAL=3*60*1000;let lastVersionCheck=0,versionCheckPending=false,refreshPending=false,activeCategory=null,allergensVisible=true,scrollObserver=null,draggedCategories=false;
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
 render();
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
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}renderCartIndicators()}
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
   // One-time upgrade: earlier BETA caches did not store popularItemIds.
   // Refresh once to repair them, not on every page opening.
   if(cached.cacheFormat!==2)await refreshMenu(false);
   else checkMenuVersion(true);
 }
 else await refreshMenu(false);
 if(!window.__betaVersionTimer)window.__betaVersionTimer=window.setInterval(()=>checkMenuVersion(false),VERSION_INTERVAL);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkMenuVersion(false)});
 window.addEventListener('focus',()=>checkMenuVersion(false));
 window.addEventListener('online',()=>checkMenuVersion(true));
 window.setInterval(updateHoursStatus,60000);
}
async function refreshMenu(manual=true){if(refreshPending)return;refreshPending=true;$('refresh').disabled=true;$('cacheStatus').textContent='Henter…';try{const fresh=await fromFirebase();menu=fresh;try{await localPut(fresh)}catch(e){$('notice').textContent='Nettleseren kunne ikke lagre menyen lokalt.'}try{localStorage.setItem(META_KEY,JSON.stringify({lastSync:Date.now()}))}catch{}render();lastVersionCheck=Date.now();$('cacheStatus').textContent='Oppdatert';}catch(e){if(!menu){$('notice').textContent='Kunne ikke hente menyen. Kontroller Firebase-lesetilgang og nettverk. '+e.message;$('cacheStatus').textContent='Ingen data'}else{$('notice').textContent='Kunne ikke oppdatere. Lokal meny vises.';$('cacheStatus').textContent='Lagret lokalt'}}finally{refreshPending=false;$('refresh').disabled=false}}

/* The existing admin saves one /menu/updatedAt revision on ALL menu and settings edits.
   A single tiny version read detects changes; complete data is fetched only if newer. */
async function checkMenuVersion(force=false){
 if(!menu||versionCheckPending||refreshPending||document.hidden||navigator.onLine===false)return;
 if(!force&&Date.now()-lastVersionCheck<VERSION_INTERVAL)return;
 versionCheckPending=true;lastVersionCheck=Date.now();
 try{
   const response=await fetch(BASE+'/menu/updatedAt.json',{cache:'no-store'});
   if(!response.ok)throw Error('Versjon '+response.status);
   const version=Number(await response.json())||0;
   if(version&&version!==Number(menu.updatedAt))await refreshMenu(false);
 }catch{
   $('cacheStatus').textContent='Lagret lokalt';
 }finally{versionCheckPending=false}
}
const clockMinutes=time=>{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time||''));return m?Number(m[1])*60+Number(m[2]):null};
function openingDays(settings){
 const days=Array.isArray(settings?.weeklyHours)&&settings.weeklyHours.length===7?settings.weeklyHours:null;
 return Array.from({length:7},(_,i)=>({enabled:days?days[i]?.enabled!==false:true,open:days?.[i]?.open||'14:00',close:days?.[i]?.close||'22:00'}));
}
function osloTime(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
 const get=k=>parts.find(p=>p.type===k)?.value||'';
 const day=['mon','tue','wed','thu','fri','sat','sun'].indexOf(get('weekday').toLowerCase().slice(0,3));
 return {day:day<0?0:day,minute:(Number(get('hour'))%24)*60+Number(get('minute'))};
}
function updateHoursStatus(){
 if(!menu)return;
 const settings=menu.settings||{},now=osloTime(),days=openingDays(settings);
 const today=days[now.day],yesterday=days[(now.day+6)%7],openTime=clockMinutes(today.open),closeTime=clockMinutes(today.close);
 const yStart=clockMinutes(yesterday.open),yEnd=clockMinutes(yesterday.close);
 let closesAt=null;
 if(yesterday.enabled&&yStart!==null&&yEnd!==null&&yEnd<=yStart&&now.minute<yEnd)closesAt=yesterday.close;
 if(!closesAt&&today.enabled&&openTime!==null&&closeTime!==null&&now.minute>=openTime&&(closeTime<=openTime||now.minute<closeTime))closesAt=today.close;
 const until=Number(settings.manualClosedUntil)||0;
 const manual=settings.manualClosed===true&&(until<=0||until>Date.now());
 const open=!!closesAt&&!manual;
 let nextOpen=null,nextOffset=0;
 if(!open){
   for(let offset=0;offset<8;offset++){
     const day=days[(now.day+offset)%7],start=clockMinutes(day.open);
     if(!day.enabled||start===null)continue;
     if(offset===0&&start<=now.minute)continue;
     if(until>Date.now()){
       const daysUntil=Math.floor((until-Date.now())/86400000);
       if(offset<daysUntil)continue;
     }
     nextOpen=day.open;nextOffset=offset;break;
   }
 }
 const preOpen=!open&&!manual&&today.enabled&&openTime!==null&&now.minute<openTime;
 $('statusBanner').classList.toggle('is-closed',!open);
 $('statusTitle').textContent=open?'Åpent nå':preOpen?'Åpner senere i dag':'Stengt nå';
 $('statusSubtitle').textContent=open?'Bestilling tilgjengelig':preOpen?'Forhåndsbestilling tilgjengelig':manual?'Midlertidig stengt':'Se neste åpningstid';
 const pill=$('hoursPill');pill.hidden=false;
 pill.textContent=open?'◷ Stenger kl. '+closesAt:nextOpen?'◷ '+(nextOffset===0?'Åpner kl. ':'Neste åpning: ')+nextOpen:'Ingen åpningstid';
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
 },{rootMargin:'-215px 0px -55% 0px'});
 $('menu').querySelectorAll('.menu-section').forEach(el=>scrollObserver.observe(el));
}

function getGroup(id){return menu.optionGroups.find(g=>String(g.id)===String(id))}
function groupsFor(item,size){const ids=[...(item.optionGroupIds||[]),...(size?.optionGroupIds||[])];return [...new Set(ids)].map(getGroup).filter(Boolean)}
function basePrice(item){const prices=list(item.sizes).map(s=>Number(s.price)||0);return prices.length?Math.min(...prices):Number(item.price)||0}
function productById(id){for(const s of menu.sections)for(const item of s.items)if(String(item.id)===String(id))return item;return null}
function imgEl(url,alt,cls){if(!url)return '';return '<img class="'+cls+'" data-image="'+esc(url)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">'}
/* Cache Storage holds image responses where image CORS permits it; HTTP cache is fallback. */
async function setCachedImage(img,url){
  if(!url)return;
  if(imageURLs.has(url)){img.src=imageURLs.get(url);return}
  try{
    if(!('caches' in window))throw Error('CacheStorage unsupported');
    const cache=await caches.open('kol-beta-images-v1');
    let response=await cache.match(url);
    if(!response){
      response=await fetch(url,{mode:'cors',cache:'force-cache'});
      if(!response.ok||response.type==='opaque')throw Error('Image not cacheable');
      try{await cache.put(url,response.clone())}catch{}
    }
    const blob=await response.blob();
    if(!blob.size)throw Error('Empty image');
    const objectURL=URL.createObjectURL(blob);imageURLs.set(url,objectURL);img.src=objectURL;
  }catch{img.src=url}
}
const imageObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;imageObserver.unobserve(entry.target);setCachedImage(entry.target,entry.target.dataset.image)}},{rootMargin:'180px'}):null;
function hydrateImages(root){root.querySelectorAll('img[data-image]').forEach(img=>{if(imageObserver)imageObserver.observe(img);else setCachedImage(img,img.dataset.image)})}
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
 return '<article class="product-card"><div class="product-photo">'+imgEl(i.imageUrl,i.name,'photo')+(amount?'<span class="in-cart">🛒 '+amount+' i kurven</span>':'')+'<button class="card-favorite'+(isFavorite(i.id)?' is-favorite':'')+'" data-favorite="'+esc(i.id)+'" aria-label="'+(isFavorite(i.id)?'Fjern fra favoritter':'Legg til favoritter')+'" aria-pressed="'+isFavorite(i.id)+'">'+(isFavorite(i.id)?'♥':'♡')+'</button></div><div class="product-info"><h3>'+esc(i.name)+'</h3><p>'+esc(i.description||i.ingredients||'')+'</p>'+(allergens&&allergensVisible?'<p class="allergens">Inneholder '+esc(allergens)+'</p>':'')+'</div><div class="product-side"><span class="price">'+(sizeCount>1?'<small>fra </small>':'')+money(basePrice(i))+'</span><button class="add-round" data-product="'+esc(i.id)+'" '+(i.soldOut?'disabled':'')+' aria-label="Velg '+esc(i.name)+'">+</button></div></article>';
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
function showSheet(id){const item=productById(id);if(!item||item.soldOut)return;current=item;qty=1;selection={};$('quantity').textContent=qty;$('comment').value='';$('sheetTitle').textContent=item.name;$('sheetDesc').textContent=item.description||item.ingredients||'';const hero=$('sheetHero');hero.querySelectorAll('img').forEach(n=>n.remove());if(item.imageUrl){const im=document.createElement('img');im.alt=item.name;hero.prepend(im);setCachedImage(im,item.imageUrl)}renderOptions();updateSheetFavorite();show('productSheet')}
function renderOptions(){if(!current)return;const sizes=list(current.sizes),size=sizes.find(s=>String(s.id)===String(selection.size))||sizes[Math.min(Math.max(Number(current.defaultSizeIndex)||0,0),sizes.length-1)];if(size)selection.size=size.id;const groupHTML=(title,choices,key,type,required=false)=>'<fieldset class="option-group"><div class="option-head"><span>'+esc(title)+'</span>'+(required?'<span class="required">Påkrevd</span>':'')+'</div>'+choices.map((o,i)=>'<label class="option-choice"><input type="'+type+'" name="'+esc(key)+'" value="'+esc(o.id)+'" '+(type==='radio'?(String(selection[key])===String(o.id)?'checked':''):(Array.isArray(selection[key])&&selection[key].includes(o.id)?'checked':''))+'><span>'+esc(o.label||o.name||'')+'</span><span class="opt-price">'+(o.price?'+'+money(o.price):o.caption||'')+'</span></label>').join('')+'</fieldset>';let html='';if(sizes.length){html+=groupHTML('Størrelse',sizes.map(s=>({id:s.id,label:s.label||s.name,price:0,caption:money(s.price)})),'size','radio',true)}const groups=groupsFor(current,size);for(const g of groups){const key='group:'+g.id,opts=list(g.options).map(o=>({id:o.id,label:o.label||o.name,price:Number(o.price)||Number(o.priceDelta)||0}));if(!opts.length)continue;const multi=g.multiple===true||g.type==='multiple'||g.selectionType==='multiple'||Number(g.maxSelections)>1; if(!multi && selection[key]===undefined)selection[key]=(opts.find(o=>o.id===g.defaultOptionId)||opts[0]).id;html+=groupHTML(g.title||g.name||'Velg',opts,key,multi?'checkbox':'radio',!multi)}$('options').innerHTML=html;updatePrice()}
function currentPrice(){if(!current)return 0;const sizes=list(current.sizes),size=sizes.find(s=>String(s.id)===String(selection.size));let n=Number(size?.price??current.price)||0;for(const group of groupsFor(current,size)){const value=selection['group:'+group.id];for(const o of list(group.options))if(Array.isArray(value)?value.map(String).includes(String(o.id)):String(value)===String(o.id))n+=Number(o.price)||Number(o.priceDelta)||0}return n}
function updatePrice(){$('addPrice').textContent=money(currentPrice()*qty)}
function show(id){$('overlay').hidden=false;$(id).hidden=false;document.body.style.overflow='hidden'}
function hideAll(){$('overlay').hidden=true;$('productSheet').hidden=true;$('cartSheet').hidden=true;document.body.style.overflow=''}
function addToCart(){if(!current)return;const size=list(current.sizes).find(s=>String(s.id)===String(selection.size));const choices=groupsFor(current,size).map(g=>{const selected=selection['group:'+g.id],opts=list(g.options).filter(o=>Array.isArray(selected)?selected.map(String).includes(String(o.id)):String(selected)===String(o.id));return {groupId:g.id,group:g.title||g.name||'',options:opts.map(o=>({id:o.id,label:o.label||o.name,price:Number(o.price)||Number(o.priceDelta)||0}))}}).filter(g=>g.options.length);const entry={id:current.id,name:current.name,size:size?{id:size.id,label:size.label||size.name}:null,choices,comment:$('comment').value.trim().slice(0,500),qty,unitPrice:currentPrice()};const key=JSON.stringify([entry.id,entry.size?.id,entry.choices,entry.comment]);const old=cart.find(x=>JSON.stringify([x.id,x.size?.id,x.choices,x.comment])===key);if(old)old.qty+=qty;else cart.push(entry);saveCart();hideAll();render()}
function renderCartIndicators(){const n=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0),total=cart.reduce((sum,x)=>sum+x.qty*x.unitPrice,0);$('cartCount').hidden=!n;$('cartCount').textContent=n;$('cartBar').hidden=!n;$('barQty').textContent=n;$('barTotal').textContent=money(total)}
function showCart(){$('cartItems').innerHTML=cart.length?cart.map((x,i)=>'<div class="cart-item"><div><strong>'+esc(x.qty+' × '+x.name)+'</strong><small>'+esc([x.size?.label,...(x.choices||[]).flatMap(g=>g.options.map(o=>o.label)),x.comment].filter(Boolean).join(' · '))+'</small><button data-remove="'+i+'">Fjern</button></div><b>'+money(x.qty*x.unitPrice)+'</b></div>').join(''):'<p>Handlekurven er tom.</p>';$('cartTotal').textContent=money(cart.reduce((sum,x)=>sum+x.qty*x.unitPrice,0));show('cartSheet')}
$('refresh').addEventListener('click',()=>refreshMenu());
$('showAllergens').addEventListener('change',e=>{allergensVisible=e.target.checked;try{localStorage.setItem('kol-beta-allergens',String(allergensVisible))}catch{}render()});
$('categories').addEventListener('scroll',categoryProgress,{passive:true});
/* Desktop mouse drag; real touch scrolling remains native. */
{
 const nav=$('categories');let down=false,startX=0,startScroll=0,dragDistance=0;
 nav.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button!==0)return;
  down=true;dragDistance=0;startX=e.clientX;startScroll=nav.scrollLeft;
  nav.setPointerCapture(e.pointerId);nav.classList.add('is-grabbing');
 });
 nav.addEventListener('pointermove',e=>{
  if(!down)return;
  dragDistance=Math.max(dragDistance,Math.abs(e.clientX-startX));
  if(dragDistance>4){draggedCategories=true;nav.scrollLeft=startScroll-(e.clientX-startX)}
 });
 const end=()=>{down=false;nav.classList.remove('is-grabbing');if(dragDistance>4)setTimeout(()=>{draggedCategories=false},150)};
 nav.addEventListener('pointerup',end);nav.addEventListener('pointercancel',end);
 nav.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&nav.scrollWidth>nav.clientWidth){e.preventDefault();nav.scrollLeft+=e.deltaY}},{passive:false});
}
$('catPrev').onclick=()=>$('categories').scrollBy({left:-Math.max(130,$('categories').clientWidth*.7),behavior:'smooth'});
$('catNext').onclick=()=>$('categories').scrollBy({left:Math.max(130,$('categories').clientWidth*.7),behavior:'smooth'});
window.addEventListener('resize',categoryProgress);$('searchToggle').addEventListener('click',()=>{$('searchArea').hidden=!$('searchArea').hidden;if(!$('searchArea').hidden)$('search').focus()});$('search').addEventListener('input',render);
$('categories').addEventListener('click',e=>{if(draggedCategories){draggedCategories=false;return}const b=e.target.closest('[data-scroll]');if(!b)return;$('categories').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('category-'+b.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'})});
$('menu').addEventListener('click',e=>{
 const fav=e.target.closest('[data-favorite]');if(fav){toggleFavorite(fav.dataset.favorite);return}
 const b=e.target.closest('[data-product]');if(b)showSheet(b.dataset.product);
});
$('sheetFavorite').addEventListener('click',()=>{if(current)toggleFavorite(current.id)});
$('options').addEventListener('change',e=>{const i=e.target;if(!i.matches('input'))return;if(i.type==='checkbox')selection[i.name]=[...$('options').querySelectorAll('input[name="'+CSS.escape(i.name)+'"]:checked')].map(x=>x.value);else selection[i.name]=i.value;if(i.name==='size'){for(const k of Object.keys(selection))if(k.startsWith('group:'))delete selection[k];renderOptions()}else updatePrice()});
$('plus').onclick=()=>{$('quantity').textContent=++qty;updatePrice()};$('minus').onclick=()=>{$('quantity').textContent=qty=Math.max(1,qty-1);updatePrice()};
$('add').onclick=addToCart;$('cartOpen').onclick=showCart;$('cartBar').onclick=showCart;$('cartItems').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;cart.splice(Number(b.dataset.remove),1);saveCart();showCart();render()});for(const id of ['overlay','sheetClose','cartClose','continue'])$(id).onclick=hideAll;document.addEventListener('keydown',e=>{if(e.key==='Escape')hideAll()});document.addEventListener('DOMContentLoaded',init);
