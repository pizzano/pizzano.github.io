/* BestillOnline menu administrator. Only /menu is read/written.
 * Access is protected by Firebase Authentication and Database Rules.
 */
'use strict';
(()=>{
 const DB='https://kol-grill-pizza-1-default-rtdb.firebaseio.com';
 const $=id=>document.getElementById(id);
const ADMIN_UID='CkvfzzzQ9MaPD8lZWKx10RB6iX22';
const ADMIN_EMAIL='fatihsemb@gmail.com';
// Public Firebase Web API key is required by Firebase Authentication, not a password.
// Firebase Web app config is public; never store admin passwords here.
const FIREBASE_WEB_API_KEY='AIzaSyDanHMWBBN260CS9S9IVpFPnb2BfnWXF-0';
let auth=null;
function showLogin(err=''){
 $('adminNav').hidden=true;$('adminToolsMenu').open=false;
 $('adminMain').hidden=true;$('authScreen').hidden=false;$('btnSignOut').hidden=true;
 $('authError').textContent=err;$('authError').hidden=!err;
 $('authPassword').value='';
}
async function configure(){
 if(!window.firebase?.auth)throw Error('Firebase Authentication kunne ikke lastes.');
 const key=FIREBASE_WEB_API_KEY;
 if(!key)throw Error('Firebase Web API Key mangler i konfigurasjonen. Administratoren må legge den inn én gang i admin.js.');
 if(auth)return;
 firebase.initializeApp({apiKey:key,authDomain:'kol-grill-pizza-1.firebaseapp.com',projectId:'kol-grill-pizza-1'});
 auth=firebase.auth();await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
}
async function menuAuthURL(){
 const u=auth?.currentUser;if(!u||u.uid!==ADMIN_UID)throw Error('Ingen administratortilgang.');
 return DB+'/menu.json?auth='+encodeURIComponent(await u.getIdToken());
}
async function login(e){
 e.preventDefault();
 if(!$('authPassword').value)return;
 $('authSubmit').disabled=true;
 try{
  await configure();
  const result=await auth.signInWithEmailAndPassword(ADMIN_EMAIL,$('authPassword').value);
  if(result.user.uid!==ADMIN_UID){await auth.signOut();throw Error('Kontoen har ikke administratorrettigheter.')}
  $('authScreen').hidden=true;$('adminMain').hidden=false;$('btnSignOut').hidden=false;$('authPassword').value='';
  await startAdmin();
 }catch(x){showLogin(x.code?.startsWith('auth/')?'Feil passord eller innlogging. Prøv igjen.':x.message)}
 finally{$('authSubmit').disabled=false}
}
async function bootAuth(){
 showLogin();
 try{
  if(!FIREBASE_WEB_API_KEY)return;
  await configure();
  const u=await new Promise(resolve=>{const stop=auth.onAuthStateChanged(v=>{stop();resolve(v)},()=>resolve(null))});
  if(u?.uid===ADMIN_UID){$('authScreen').hidden=true;$('adminMain').hidden=false;$('btnSignOut').hidden=false;await startAdmin()}
 }catch(e){showLogin(e.message)}
}

 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clone=value=>JSON.parse(JSON.stringify(value));
 const arr=value=>Array.isArray(value)?value:[];
 const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const state={menu:null,original:null,etag:null,category:0,product:0,group:0,dirty:false,tab:'products',saving:false};
 let toastTimer=0,autosaveTimer=0,editRevision=0;
 const draftProductSnapshots=new Map();
 const draftGroupSnapshots=new Map();
 const AUTO_SAVE_DELAY_MS=1400;
 function cancelScheduledSave(){window.clearTimeout(autosaveTimer);autosaveTimer=0}
 function scheduleAutoSave(){
  cancelScheduledSave();
  if(state.menu&&state.etag)
   autosaveTimer=window.setTimeout(()=>{autosaveTimer=0;void save({auto:true})},AUTO_SAVE_DELAY_MS);
 }
 function notify(message,error=false){
  const node=$('toast');node.textContent=message;node.classList.toggle('error',error);node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2300);
 }
 function message(text,type=''){
  const node=$('adminMessage');node.textContent=text;node.className='banner'+(type?' '+type:'');
 }
 function setDirty(){
  if(!state.menu)return;
  editRevision++;
  // No request or timer when the only change is an empty/untouched draft.
  if(syncSaveStatus())scheduleAutoSave();
  else cancelScheduledSave();
 }
 function setClean(){
  cancelScheduledSave();
  state.dirty=false;
  $('btnSave').disabled=true;
  const node=$('saveStatus');node.className='status ok';node.textContent='Menyen er synkronisert';
 }
 // Record the initial product, not merely its placeholder name. Changing the
 // price, image, ingredients or any other field makes it a real edit.
 function isUntouchedNewProduct(item){
  if(!item)return false;
  const baseline=draftProductSnapshots.get(String(item.id));
  return baseline!==undefined&&JSON.stringify(item)===baseline;
 }
 function isUntouchedNewGroup(item){
  if(!item)return false;
  const baseline=draftGroupSnapshots.get(String(item.id));
  return baseline!==undefined&&JSON.stringify(item)===baseline;
 }
 // New empty categories and genuinely untouched products/groups stay local.
 // A product with a changed field may be saved even if its name is unchanged.
 function menuWithoutIncompleteDrafts(){
  const next=clone(state.menu);
  const existingSections=new Set(arr(state.original?.sections).map(section=>String(section.id)));
  const existingProducts=new Set(arr(state.original?.sections).flatMap(section=>
   arr(section.items).map(item=>String(item.id))));
  const originalSizes=new Set(arr(state.original?.sections).flatMap(section=>
   arr(section.items).flatMap(item=>arr(item.sizes).map(size=>String(size.id)))));
  const originalOptions=new Set(arr(state.original?.optionGroups).flatMap(group=>
   arr(group.options).map(option=>String(option.id))));
  const originalGroups=new Set(arr(state.original?.optionGroups).map(group=>String(group.id)));
  const validNewSize=size=>String(size.label||size.name||'').trim().length>0;
  for(const section of next.sections){
   section.items=arr(section.items).filter(item=>
    existingProducts.has(String(item.id))||
    (String(item.name||'').trim()!==''&&!isUntouchedNewProduct(item)&&
     arr(item.sizes).every(size=>originalSizes.has(String(size.id))||validNewSize(size))));
   for(const item of section.items){
    item.sizes=arr(item.sizes).filter(size=>
     originalSizes.has(String(size.id))||validNewSize(size));
   }
  }
  next.sections=next.sections.filter(section=>
   existingSections.has(String(section.id))||section.items.length>0);
  next.optionGroups=arr(next.optionGroups).filter(group=>
   originalGroups.has(String(group.id))||
   (String(group.title||'').trim()!==''&&!isUntouchedNewGroup(group)));
  for(const group of next.optionGroups){
   group.options=arr(group.options).filter(option=>
    originalOptions.has(String(option.id))||String(option.label||'').trim()!=='');
   const retained=new Set(group.options.map(option=>String(option.id)));
   if(Array.isArray(group.defaultOptionIds))
    group.defaultOptionIds=group.defaultOptionIds.filter(id=>retained.has(String(id)));
  }
  return next;
 }
 function persistableSignature(value){
  const copy=clone(value);
  delete copy.updatedAt;
  delete copy.changeFeed;
  return JSON.stringify(copy);
 }
 function hasUnfinishedDrafts(){
  return state.menu&&persistableSignature(state.menu)!==persistableSignature(menuWithoutIncompleteDrafts());
 }
 function syncSaveStatus(){
  const ready=persistableSignature(menuWithoutIncompleteDrafts())!==persistableSignature(state.original);
  const draft=hasUnfinishedDrafts();
  state.dirty=ready||draft;
  $('btnSave').disabled=state.saving||!state.etag||!ready;
  const node=$('saveStatus');
  node.className=ready||draft?'status dirty':'status ok';
  node.textContent=ready?'Lagrer automatisk…':draft?'Utkast · ikke lagret':'Menyen er synkronisert';
  return ready;
 }
 function assertMenu(payload){
  if(!payload||!Array.isArray(payload.sections)||!Array.isArray(payload.optionGroups)||!Array.isArray(payload.images))
   throw Error('Uventet menyformat. For å unngå datatap åpner ikke redigereren dette formatet.');
  if(!payload.sections.every(s=>s&&Array.isArray(s.items)))throw Error('Kategorier mangler items-lister.');
  if(!payload.optionGroups.every(g=>g&&Array.isArray(g.options)))throw Error('Valggrupper har et eldre format som må migreres før redigering. Ingen data ble endret.');
 }
 // Only fields retired from the BestillOnline menu schema. Keep ingredientRules
 // and description intact. Deletion is staged until explicit admin save.
 function removeLegacyIngredients(menuData){
  let removed=0;
  for(const section of arr(menuData?.sections)){
   for(const item of arr(section.items)){
    for(const key of ['ingredients','ingredientDefaults']){
     if(Object.prototype.hasOwnProperty.call(item,key)){
      delete item[key];removed++;
     }
    }
   }
  }
  return removed;
 }
 function exportOriginalMenuBackup(){
  if(!state.original){notify('Ingen meny er lastet fra Firebase.',true);return}
  try{
   const json=JSON.stringify(state.original,null,2);
   const blob=new Blob([json],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const date=new Date().toISOString().replace(/[:.]/g,'-');
   const link=document.createElement('a');
   link.href=url;link.download='BestillOnline-menu-backup-'+date+'.json';
   document.body.appendChild(link);
   link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   notify('Menybackup er klargjort for nedlasting');
  }catch(error){
   console.warn('BestillOnline menu backup export failed',error);
   notify('Kunne ikke opprette menybackup. Prøv igjen.',true);
  }
 }
 function category(){return state.menu?.sections?.[state.category]||null}
 function product(){return category()?.items?.[state.product]||null}
 function recommendationIds(){
  return arr(state.menu?.cartSuggestionRules).map(String).filter(Boolean);
 }
 function toggleCartSuggestion(checked){
  const p=product();if(!p)return;
  const id=String(p.id),ids=recommendationIds();
  if(checked&&!ids.includes(id)&&ids.length>=10){
   $('pCartSuggestion').checked=false;
   notify('Maks 10 produkter kan anbefales i handlekurven.',true);
   return;
  }
  const next=checked?[...new Set([...ids,id])]:ids.filter(value=>value!==id);
  state.menu.cartSuggestionRules=next;
  $('cartSuggestionLimit').textContent=next.length+' av 10 valgt · Kunden ser 4 tilfeldige om gangen';
  renderProducts();setDirty();
 }
 function removeRecommendationIds(ids){
  const blocked=new Set([...ids].map(String)),prev=recommendationIds();
  const next=prev.filter(id=>!blocked.has(id));
  if(next.length!==prev.length)state.menu.cartSuggestionRules=next;
 }
 function group(){return state.menu?.optionGroups?.[state.group]||null}
 function productImage(p){
  if(!p)return '';
  if(Number.isInteger(p.imageId))return state.menu.images[p.imageId]||'';
  return String(p.imageUrl||'');
 }
 function setProductImage(p,url){
  url=String(url||'').trim();
  if(url&&!/^https:\/\//i.test(url))throw Error('Bilde-URL må starte med https://');
  const before=productImage(p);
  if(url===before)return false;
  if(!url){delete p.imageUrl;delete p.imageId;return true}
  let index=state.menu.images.indexOf(url);
  if(index<0){index=state.menu.images.length;state.menu.images.push(url)}
  // Never overwrite an existing shared image: other menu products may use it.
  p.imageId=index;delete p.imageUrl;
  return true;
 }
function getProductAllergens(p){
  if(Number.isInteger(p?.allergenSet)&&Array.isArray(state.menu?.allergenSets)){
   return arr(state.menu.allergenSets[p.allergenSet]).map(String);
  }
  return arr(p?.allergens).map(String);
 }
 function renderAllergenChoices(){
  const p=product();if(!p)return;
  const selected=new Set(getProductAllergens(p));
  $('allergenChoices').innerHTML=arr(state.menu.allergenCatalog).map(a=>{
   const id=String(a.id);
   return '<label class="checkbox"><input type="checkbox" data-product-allergen="'+esc(id)+'"'+(selected.has(id)?' checked':'')+'> '+esc(a.label||id)+'</label>';
  }).join('')||'<p class="muted">Ingen allergenkatalog i menydatabasen.</p>';
 }
 function setProductAllergen(id,checked){
  const p=product();if(!p)return;
  const chosen=new Set(getProductAllergens(p));
  if(checked)chosen.add(id);else chosen.delete(id);
  const ids=[...chosen];
  if(!Array.isArray(state.menu.allergenSets))state.menu.allergenSets=[];
  let index=state.menu.allergenSets.findIndex(a=>JSON.stringify(arr(a).map(String))===JSON.stringify(ids));
  if(index<0){index=state.menu.allergenSets.length;state.menu.allergenSets.push(ids)}
  p.allergenSet=index;delete p.allergens;
  setDirty();
 }
 
function refreshHeader(){
  const n=state.menu?.sections.reduce((sum,s)=>sum+arr(s.items).length,0)||0;
  message(state.menu?'Menyversjon: '+(state.menu.updatedAt||'ukjent')+' · '+n+' produkter · '+state.menu.optionGroups.length+' valggrupper':'Ingen meny lastet inn');
 }
 // Every network request is authorized; never cache Firebase ID tokens.
 const ADMIN_MENU_CACHE_KEY='bestillonline-admin-menu-v1:'+encodeURIComponent(DB)+':'+ADMIN_UID;
 function readAdminMenuCache(){
  try{
   const saved=JSON.parse(localStorage.getItem(ADMIN_MENU_CACHE_KEY)||'null');
   if(saved?.format!==1||typeof saved.etag!=='string'||!saved.etag)return null;
   assertMenu(saved.menu);
   return saved;
  }catch{return null}
 }
 function storeAdminMenuCache(snapshot,etag){
  if(!etag)return;
  try{localStorage.setItem(ADMIN_MENU_CACHE_KEY,JSON.stringify({format:1,etag,menu:snapshot}))}catch{}
 }
 function clearAdminMenuCache(){
  try{localStorage.removeItem(ADMIN_MENU_CACHE_KEY)}catch{}
 }
 async function startAdmin(){
  $('adminNav').hidden=true;
  $('loadingCard').hidden=false;
  $('adminRoot').hidden=true;
  $('loadError').hidden=true;
  $('btnRetry').disabled=true;
  $('saveStatus').className='status';
  $('saveStatus').textContent='Kobler til Firebase…';
  try{
   await loadMenu(false,{preferCache:true});
   $('loadingCard').hidden=true;
   $('adminRoot').hidden=false;
   $('adminNav').hidden=false;
   requestAnimationFrame(updateAdminNavArrows);
   notify('Menyen er kontrollert mot Firebase');
  }catch(error){
   $('adminNav').hidden=true;
   console.warn('BestillOnline menu admin load failed:',error);
   $('loadError').textContent=error.message||'Kunne ikke laste menyen.';
   $('loadError').hidden=false;
   $('saveStatus').textContent='Kunne ikke koble til';
  }finally{$('btnRetry').disabled=false}
 }
 function applyAdminMenu(snapshot,etag){
  // Keep the exact Firebase snapshot. No automatic legacy-field deletion:
  // auto-save must never silently remove unrelated data.
  assertMenu(snapshot);
  if(!etag)throw Error('ETag mangler. Lagring stoppet for å beskytte eksisterende meny.');
  draftProductSnapshots.clear();draftGroupSnapshots.clear();
  state.original=clone(snapshot);
  state.menu=clone(snapshot);
  state.etag=etag;state.category=0;state.product=0;state.group=0;
  setClean();renderAll();refreshHeader();
 }
 async function loadMenu(confirmDiscard=true,{preferCache=false}={}){
  if(confirmDiscard&&state.dirty&&!confirm('Forkast ulagrede endringer og hent menyen på nytt?'))return false;
  const url=await menuAuthURL();
  if(preferCache){
   const saved=readAdminMenuCache();
   if(saved){
    // HEAD requests only the current /menu ETag, not its JSON body. If the
    // endpoint/browser does not support HEAD+ETag, use the safe full GET.
    try{
     const head=await fetch(url,{method:'HEAD',headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
     const remoteETag=head.ok?head.headers.get('ETag'):null;
     if(remoteETag&&remoteETag===saved.etag){
      applyAdminMenu(saved.menu,remoteETag);
      return true;
     }
    }catch(error){
     console.warn('BestillOnline ETag-only check unavailable; loading full menu:',error);
    }
   }
  }
  // A first login, changed ETag, unsupported HEAD, or a manual reload reads
  // the actual menu and obtains a fresh ETag from the same response.
  const response=await fetch(url,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
  if(!response.ok)throw Error('Firebase avviste menylesing ('+response.status+'). Kontroller database Rules.');
  const payload=await response.json();
  const etag=response.headers.get('ETag');
  applyAdminMenu(payload,etag);
  storeAdminMenuCache(payload,etag);
  return true;
 }
 function updateAdminNavArrows(){
  const track=$('adminNavScroll');
  if(!track)return;
  const max=Math.max(0,track.scrollWidth-track.clientWidth);
  $('adminNavPrev').disabled=track.scrollLeft<=3;
  $('adminNavNext').disabled=track.scrollLeft>=max-3;
 }
 function setTab(tab){
  if(tab!=='products'&&tab!=='groups')return;
  const previous=state.tab;
  state.tab=tab;
  $('productsPage').hidden=tab!=='products';$('groupsPage').hidden=tab!=='groups';
  for(const b of document.querySelectorAll('[data-tab]')){
   const active=b.dataset.tab===tab;
   b.classList.toggle('active',active);
   b.setAttribute('aria-selected',String(active));
   b.tabIndex=active?0:-1;
  }
  if(tab!==previous&&!$('adminNav').hidden){
   const current=$('adminNavScroll').querySelector('[data-tab="'+tab+'"]');
   if(current)current.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }
  updateAdminNavArrows();
 }

 let activeAdminModal=null,adminModalReturnFocus=null,categoryModalTarget=null;
 function setAdminModalTab(kind,tab){
  const modal=$(kind==='product'?'productEditor':'groupEditor');
  const tabAttr=kind==='product'?'data-product-tab':'data-group-tab';
  const paneAttr=kind==='product'?'data-product-section':'data-group-section';
  for(const button of modal.querySelectorAll('['+tabAttr+']')){
   const selected=button.getAttribute(tabAttr)===tab;
   button.classList.toggle('active',selected);
   button.setAttribute('aria-selected',String(selected));
   button.tabIndex=selected?0:-1;
  }
  for(const panel of modal.querySelectorAll('['+paneAttr+']')){
   panel.hidden=panel.getAttribute(paneAttr)!==tab;
  }
  modal.querySelector('.admin-modal-body').scrollTop=0;
 }
 function openAdminModal(kind){
  const target=kind==='product'?'productEditor':'groupEditor';
  if(kind==='product'&&!product())return;
  if(kind==='group'&&!group())return;
  if(activeAdminModal&&activeAdminModal!==kind)closeAdminModal();
  if(!activeAdminModal)adminModalReturnFocus=document.activeElement;
  activeAdminModal=kind;
  $(target).hidden=false;
  $(kind==='product'?'productModalBackdrop':'groupModalBackdrop').hidden=false;
  document.body.classList.add('admin-modal-open');
  setAdminModalTab(kind,kind==='product'?'produkt':'gruppe');
  $(kind==='product'?'btnCloseProductModal':'btnCloseGroupModal').focus();
 }
 function closeAdminModal(){
  if(!activeAdminModal)return;
  const kind=activeAdminModal;
  // Abandon a never-edited new product on close instead of leaving a phantom
  // row that could accidentally become part of a later saved menu.
  if(kind==='product'){
   const item=product(),section=category();
   if(item&&section&&isUntouchedNewProduct(item)){
    draftProductSnapshots.delete(String(item.id));
    section.items.splice(state.product,1);
    state.product=Math.max(0,Math.min(state.product,section.items.length-1));
    renderProducts();renderProductEditor();
    syncSaveStatus();
   }
  }
  if(kind==='group'){
   const item=group(),groups=state.menu?.optionGroups;
   if(item&&groups&&isUntouchedNewGroup(item)){
    draftGroupSnapshots.delete(String(item.id));
    groups.splice(state.group,1);
    state.group=Math.max(0,Math.min(state.group,groups.length-1));
    renderGroups();renderGroupEditor();syncSaveStatus();
   }
  }
  activeAdminModal=null;
  $(kind==='product'?'productEditor':kind==='group'?'groupEditor':'categoryEditor').hidden=true;
  $(kind==='product'?'productModalBackdrop':kind==='group'?'groupModalBackdrop':'categoryModalBackdrop').hidden=true;
  if(kind==='category')categoryModalTarget=null;
  document.body.classList.remove('admin-modal-open');
  const toFocus=adminModalReturnFocus;
  adminModalReturnFocus=null;
  if(toFocus?.isConnected&&typeof toFocus.focus==='function')toFocus.focus();
 }
 async function saveAdminModal(kind){
  // Commit a typed image URL before checking whether a new product was edited.
  // The user may click Save without blurring the image input first.
  if(kind==='product'&&product()&&$('pImage').value!==productImage(product()))readAndSetImage();
  if(kind==='product'&&isUntouchedNewProduct(product())){
   closeAdminModal();
   return;
  }
  if(kind==='group'&&isUntouchedNewGroup(group())){
   closeAdminModal();
   return;
  }
  if(kind==='group'&&draftGroupSnapshots.has(String(group()?.id))&&!String(group()?.title||'').trim()){
   notify('Skriv inn et navn på valggruppen før du lagrer.',true);
   $('gTitle').focus();return;
  }
  if(!state.dirty){closeAdminModal();return}
  await save();
  if(!state.dirty)closeAdminModal();
 }
 function modalKeyboard(event){
  if(!activeAdminModal)return;
  if(event.key==='Escape'){event.preventDefault();closeAdminModal();return}
  if(event.key!=='Tab')return;
  const modal=$(activeAdminModal==='product'?'productEditor':activeAdminModal==='group'?'groupEditor':'categoryEditor');
  const all=[...modal.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(el=>
   !el.disabled&&!el.hidden&&!el.closest('[hidden]')&&el.tabIndex!==-1
  );
  if(!all.length)return;
  const first=all[0],last=all[all.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }

 function renderAll(){
  renderCategories();renderProducts();renderProductEditor();
  renderGroups();renderGroupEditor();setTab(state.tab);
 }
 // Compact SVG actions remain visible and are separate from drag targets.
 const adminEditSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';
 const adminDeleteSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6l1 14h12l1-14"/><path d="M10 10v7M14 10v7"/></svg>';
 function categoryButton(s,i){
  const count=arr(s.items).length,name=esc(s.title||'Kategori');
  return '<div class="item admin-sort-row'+(i===state.category?' active':'')+'" draggable="true" data-category="'+i+'" title="Dra for å sortere · Alt + ↑ / ↓" tabindex="0" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">'+
   '<button class="admin-row-main" type="button" data-category-select aria-label="Velg kategori: '+name+'"><span class="item-icon">'+esc(String(s.title||'?').slice(0,1).toUpperCase())+'</span>'+
   '<span class="item-copy"><strong>'+name+'</strong><small>'+count+' produkter</small></span></button>'+
   '<div class="admin-row-actions"><button class="admin-row-action" type="button" data-category-edit title="Rediger kategori" aria-label="Rediger kategori: '+name+'">'+adminEditSvg+'</button>'+
   '<button class="admin-row-action is-delete" type="button" data-category-delete title="Slett kategori" aria-label="Slett kategori: '+name+'">'+adminDeleteSvg+'</button></div>'+
   '<span class="admin-drag-handle" aria-hidden="true">⠿</span></div>';
 }
 function renderCategories(){
  $('categoryList').innerHTML=state.menu.sections.map(categoryButton).join('')||'<p class="empty">Ingen kategorier</p>';
 }
 function renderProducts(){
  const s=category();$('productsTitle').textContent=s?(s.title||'Produkter'):'Produkter';
  const query=$('productSearch').value.trim().toLocaleLowerCase('no');
  $('productList').innerHTML=s?arr(s.items).map((p,i)=>{
   if(query&&!String(p.name||'').toLocaleLowerCase('no').includes(query))return '';
   const url=productImage(p);
   const img=url?'<img src="'+esc(url)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<span class="item-icon">🍕</span>';
   const name=esc(p.name||'Nytt produkt');
   return '<div class="item admin-sort-row'+(i===state.product?' active':'')+(p.hidden?' dim':'')+(query?' drag-locked':'')+'" data-product="'+i+'"'+(query?'':' draggable="true" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"')+' tabindex="0" title="'+(query?'Tøm søket før du sorterer':'Dra for å sortere · Alt + ↑ / ↓')+'">'+
    '<button type="button" class="admin-row-main" data-product-select aria-label="Åpne produkt: '+name+'">'+img+'<span class="item-copy"><strong>'+name+'</strong><small>'+
    esc(arr(p.sizes).map(v=>Math.round(Number(v.price)||0)+' kr').join(' · ')||String(p.price||0)+' kr')+
    (recommendationIds().includes(String(p.id))?' · Anbefales i kurven':'')+
    (p.soldOut?' · Utsolgt':'')+(p.hidden?' · Skjult':'')+'</small></span></button>'+
    '<div class="admin-row-actions"><button type="button" class="admin-row-action" data-product-edit title="Rediger produkt" aria-label="Rediger produkt: '+name+'">'+adminEditSvg+'</button>'+
    '<button type="button" class="admin-row-action is-delete" data-product-delete title="Slett produkt" aria-label="Slett produkt: '+name+'">'+adminDeleteSvg+'</button></div>'+
    '<span class="admin-drag-handle" aria-hidden="true">⠿</span></div>';
  }).join(''):'<p class="empty">Velg en kategori</p>';
 }
 function sizeLabel(size){
  return size.label||state.menu.sizeLabels?.[size.labelId]||size.name||String(size.id||'Størrelse');
 }
 // Global groups are inherited by every size. Optional size-specific groups
 // are stored as size.optionGroupIds. Ordering is per size, not global.
 function selectedGroupIdsForSize(p,size){
  return [...new Set([...arr(p.optionGroupIds),...arr(size.optionGroupIds)].map(String))];
 }
 function orderedGroupIdsForSize(p,size){
  const ids=selectedGroupIdsForSize(p,size),allowed=new Set(ids);
  return [...new Set([...arr(size.optionGroupOrder),...arr(p.optionGroupOrder),...ids]
   .map(String).filter(id=>allowed.has(id)))];
 }
 function renderCommonGroups(){
  const p=product();if(!p)return;
  const checked=new Set(arr(p.optionGroupIds).map(String));
  $('commonGroupList').innerHTML=state.menu.optionGroups.map(group=>{
   const id=String(group.id);
   return '<label class="checkbox"><input type="checkbox" data-common-group="'+esc(id)+'"'+(checked.has(id)?' checked':'')+'><span>'+esc(group.title||id)+'</span></label>';
  }).join('')||'<p class="muted">Ingen valggrupper tilgjengelig.</p>';
 }
 function renderSizes(resetOpen=false){
  const p=product();if(!p)return;
  const host=$('sizeRows'),sizes=arr(p.sizes),groups=state.menu.optionGroups;
  const expanded=resetOpen?new Set([0]):
   new Set([...host.querySelectorAll('details[data-size-options][open]')].map(node=>Number(node.dataset.sizeOptions)));
  renderCommonGroups();
  host.innerHTML=sizes.map((size,i)=>{
   const shared=new Set(arr(p.optionGroupIds).map(String));
   const selected=new Set(selectedGroupIdsForSize(p,size));
   const sorted=orderedGroupIdsForSize(p,size);
   const order=new Map(sorted.map((id,n)=>[id,n]));
   const byId=new Map(groups.map(g=>[String(g.id),g]));
   const all=[...sorted.map(id=>byId.get(id)).filter(Boolean),
    ...groups.filter(g=>!selected.has(String(g.id)))];
   const options=all.map(g=>{
    const id=String(g.id),isOn=selected.has(id),inherited=shared.has(id),place=order.get(id);
    const controls=isOn?
     '<span class="size-order-actions">'+
     '<button class="mini" type="button" data-size-move="'+i+'" data-group-id="'+esc(id)+'" data-group-step="-1" aria-label="Flytt '+esc(g.title||id)+' opp"'+(place===0?' disabled':'')+'>↑</button>'+
     '<button class="mini" type="button" data-size-move="'+i+'" data-group-id="'+esc(id)+'" data-group-step="1" aria-label="Flytt '+esc(g.title||id)+' ned"'+(place===sorted.length-1?' disabled':'')+'>↓</button></span>':'';
    return '<div class="size-option-item'+(isOn?' is-selected':'')+'">'+
     '<span class="size-option-number'+(isOn?'':' is-unused')+'">'+(isOn?place+1:'—')+'</span>'+
     '<label class="checkbox'+(inherited?' is-inherited':'')+'"><input type="checkbox" data-size-group="'+i+'" value="'+esc(id)+'"'+(isOn?' checked':'')+(inherited?' disabled':'')+'><span>'+esc(g.title||id)+'</span></label>'+
     (inherited?'<span class="size-option-type">Felles</span>':'')+controls+'</div>';
   }).join('');
   return '<div class="size-product-card">'+
    '<div class="size-product-header">'+
    '<input data-size-name="'+i+'" aria-label="Størrelsesnavn" placeholder="Størrelse" value="'+esc(size.label||state.menu.sizeLabels?.[size.labelId]||size.name||'')+'">'+
    '<input type="number" min="0" max="99999" step="1" data-size-price="'+i+'" aria-label="Pris i kroner" value="'+esc(Number(size.price)||0)+'">'+
    '<button type="button" data-size-remove="'+i+'" aria-label="Slett størrelse">×</button></div>'+
    '<details class="size-product-options" data-size-options="'+i+'"'+(expanded.has(i)?' open':'')+'>'+
    '<summary><span>Tilvalg for '+esc(sizeLabel(size))+'</span><span class="size-option-count">'+sorted.length+' valgt</span><span aria-hidden="true">⌄</span></summary>'+
    '<div class="size-option-body"><p class="size-option-help">Huk av tilvalg og bruk pilene for å bestemme rekkefølgen. Felles grupper endres i seksjonen øverst.</p>'+
    '<div class="size-option-list">'+options+'</div></div></details></div>';
  }).join('')||'<p class="empty">Ingen størrelser. Legg til en størrelse.</p>';
 }
 function renderProductEditor(){
  const p=product();$('productFields').hidden=!p;
  if(!p){$('productEditorTitle').textContent='Velg et produkt';return}
  $('productEditorTitle').textContent=p.name||'Nytt produkt';
  $('pName').value=p.name||'';$('pDescription').value=p.description||'';
  $('pIngredientRules').value=arr(p.ingredientRules).map(entry=>typeof entry==='string'?entry:String(entry?.name||'')).filter(Boolean).join(', ');
  $('pKitchenNotes').value=arr(p.quickKitchenNotes).join('\n');
  renderAllergenChoices();
  $('pImage').value=productImage(p);$('pPreviewName').textContent=p.name||'Produktbilde';
  const img=$('pPreview');img.src=productImage(p)||'';img.hidden=!productImage(p);
  $('pSoldOut').checked=p.soldOut===true;$('pHidden').checked=p.hidden===true;
  $('pPopular').checked=arr(state.menu.popularItemIds).some(id=>String(id)===String(p.id));
  $('pCartSuggestion').checked=recommendationIds().includes(String(p.id));
  $('cartSuggestionLimit').textContent=recommendationIds().length+' av 10 valgt · Kunden ser 4 tilfeldige om gangen';
  renderSizes(true);
 }
 const GROUP_VIEW_KEY='bestillonline-admin-group-view-v1';
 let groupViewMode=(()=>{
  try{return localStorage.getItem(GROUP_VIEW_KEY)==='list'?'list':'grid'}catch{return 'grid'}
 })();
 function setGroupView(mode){
  if(mode!=='grid'&&mode!=='list')return;
  groupViewMode=mode;
  const list=$('groupList');
  list.classList.toggle('admin-group-grid',mode==='grid');
  list.classList.toggle('admin-group-list',mode==='list');
  for(const button of document.querySelectorAll('[data-group-view]')){
   const selected=button.dataset.groupView===mode;
   button.classList.toggle('active',selected);
   button.setAttribute('aria-pressed',String(selected));
  }
  try{localStorage.setItem(GROUP_VIEW_KEY,mode)}catch{}
 }
 const groupOneIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>';
 const groupManyIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7.5 12 3 3 6-6"/></svg>';
 function renderGroups(){
  const query=$('groupSearch').value.trim().toLocaleLowerCase('no');
  const matching=arr(state.menu?.optionGroups).map((g,i)=>({g,i}))
   .filter(({g})=>String(g.title||'').toLocaleLowerCase('no').includes(query));
  $('groupList').innerHTML=matching.map(({g,i})=>{
   const count=arr(g.options).length,number=count+' '+(count===1?'alternativ':'alternativer');
   const multiple=g.selectionMode==='multiple',name=esc(g.title||'Valggruppe');
   return '<div class="item admin-group-item'+(state.group===i?' active':'')+'" data-group="'+i+'">'+
    '<button type="button" class="admin-row-main" data-group-select aria-label="Rediger valggruppe: '+name+'">'+
    '<span class="item-icon">'+(multiple?groupManyIcon:groupOneIcon)+'</span>'+
    '<span class="item-copy"><strong>'+name+'</strong><small>'+number+' · '+(multiple?'Flere valg':'Ett valg')+'</small></span></button>'+
    '<div class="admin-row-actions">'+
    '<button class="admin-row-action" data-group-edit type="button" title="Rediger valggruppe" aria-label="Rediger valggruppe: '+name+'">'+adminEditSvg+'</button>'+
    '<button class="admin-row-action is-delete" data-group-delete type="button" title="Slett valggruppe" aria-label="Slett valggruppe: '+name+'">'+adminDeleteSvg+'</button></div></div>';
  }).join('')||'<p class="empty">'+(query?'Ingen valggrupper passer søket.':'Ingen valggrupper ennå.')+'</p>';
  $('groupResultCount').textContent=query?matching.length+' av '+arr(state.menu?.optionGroups).length+' valggrupper':matching.length+' valggrupper';
 }
 function renderOptionRows(){
  const g=group();
  $('optionRows').innerHTML=arr(g.options).map((o,i)=>{
   const selected=arr(g.defaultOptionIds).map(String).includes(String(o.id));
   return '<div class="group-card" data-option-row="'+i+'"><div class="option-row">'+
    '<input aria-label="Alternativnavn" data-option-label="'+i+'" value="'+esc(o.label||'')+'" placeholder="Alternativ">'+
    '<input type="number" min="0" max="99999" aria-label="Tilleggspris" data-option-price="'+i+'" value="'+esc(Number(o.price)||0)+'">'+
    '<button type="button" data-option-delete="'+i+'" aria-label="Slett">×</button></div>'+
    '<div class="actions"><label class="checkbox"><input type="checkbox" data-option-default="'+i+'"'+(selected?' checked':'')+'> Startvalg</label>'+
    '<label class="checkbox"><input type="checkbox" data-option-soldout="'+i+'"'+(o.soldOut?' checked':'')+'> Utsolgt</label>'+
    '<button class="btn small" type="button" data-option-up="'+i+'">↑</button><button class="btn small" type="button" data-option-down="'+i+'">↓</button></div></div>';
  }).join('')||'<p class="empty">Ingen alternativer.</p>';
 }
 function renderGroupEditor(){
  const g=group();$('groupFields').hidden=!g;
  if(!g){$('groupEditorTitle').textContent='Velg en valggruppe';return}
  $('groupEditorTitle').textContent=g.title||'Ny gruppe';
  $('gTitle').value=g.title||'';
  $('gMode').value=g.selectionMode==='multiple'?'multiple':'single';
  $('gMax').value=Math.max(1,Number(g.maxSelections)||1);
  $('gRequired').checked=g.required===true;
  $('gQuantity').checked=g.allowQuantity===true;
  renderOptionRows();
 }
 function updateItemField(field,value){
  const p=product();if(!p)return;
  if(p[field]===value)return;
  p[field]=value;setDirty();if(field==='name'){renderProducts();$('productEditorTitle').textContent=value;$('pPreviewName').textContent=value}
 }
 function updateGroupField(field,value){
  const g=group();if(!g)return;
  if(g[field]===value)return;
  g[field]=value;setDirty();if(field==='title'){renderGroups();$('groupEditorTitle').textContent=value}
 }
 function moveIn(array,index,step){
  if(!array||index<0||index>=array.length||index+step<0||index+step>=array.length)return false;
  const target=index+step;[array[index],array[target]]=[array[target],array[index]];return true;
 }
 // Sort only the local draft. The existing explicit Save action writes the
 // reordered /menu with ETag concurrency protection and its normal change feed.
 function commitAdminReorder(kind,sourceIndex,targetIndex,after=false){
  const array=kind==='category'?state.menu?.sections:category()?.items;
  if(!Array.isArray(array)||state.saving||activeAdminModal)return null;
  if(kind==='product'&&$('productSearch').value.trim())return null;
  if(!Number.isInteger(sourceIndex)||!Number.isInteger(targetIndex)||
     sourceIndex<0||sourceIndex>=array.length||targetIndex<0||targetIndex>=array.length)return null;
  let destination=targetIndex+(after?1:0);
  if(destination>sourceIndex)destination--;
  if(destination===sourceIndex)return null;
  const selected=array[kind==='category'?state.category:state.product];
  const [moved]=array.splice(sourceIndex,1);
  array.splice(destination,0,moved);
  if(kind==='category'){
   state.category=array.indexOf(selected);
   renderCategories();renderProducts();renderProductEditor();
  }else{
   state.product=array.indexOf(selected);
   renderProducts();renderProductEditor();
  }
  setDirty();
  return destination;
 }
 function initAdminDragReorder(kind){
  const list=$((kind==='category'?'categoryList':'productList'));
  const key=kind==='category'?'category':'product';
  const selector='[data-'+key+']';
  let drag=null,touchDrag=null,suppressClickUntil=0;
  const clearMarks=()=>{
   for(const row of list.querySelectorAll('.drag-before,.drag-after,.is-dragging,.is-touch-dragging'))
    row.classList.remove('drag-before','drag-after','is-dragging','is-touch-dragging');
  };
  const pointAt=(row,y)=>{
   if(!row||!list.contains(row))return null;
   const rect=row.getBoundingClientRect();
   return {index:Number(row.dataset[key]),after:y>rect.top+rect.height/2};
  };
  const mark=(row,y)=>{
   for(const previous of list.querySelectorAll('.drag-before,.drag-after'))
    previous.classList.remove('drag-before','drag-after');
   const point=pointAt(row,y);
   if(point)row.classList.add(point.after?'drag-after':'drag-before');
   return point;
  };
  const autoScroll=y=>{
   const rect=list.getBoundingClientRect();
   const zone=38;
   if(y<rect.top+zone)list.scrollTop-=18;
   else if(y>rect.bottom-zone)list.scrollTop+=18;
  };
  list.addEventListener('dragstart',event=>{
   const row=event.target.closest(selector);
   if(!row||row.draggable!==true||state.saving||activeAdminModal||
      event.target.closest('.admin-row-action')){event.preventDefault();return}
   drag={source:Number(row.dataset[key])};
   row.classList.add('is-dragging');
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('text/plain','BestillOnline '+kind+' sort');
  });
  list.addEventListener('dragover',event=>{
   if(!drag)return;
   const row=event.target.closest(selector);
   if(!row)return;
   event.preventDefault();
   event.dataTransfer.dropEffect='move';
   autoScroll(event.clientY);
   mark(row,event.clientY);
  });
  list.addEventListener('drop',event=>{
   if(!drag)return;
   event.preventDefault();
   const row=event.target.closest(selector),point=pointAt(row,event.clientY);
   const source=drag.source;
   drag=null;clearMarks();
   suppressClickUntil=Date.now()+350;
   if(point)commitAdminReorder(kind,source,point.index,point.after);
  });
  list.addEventListener('dragend',()=>{
   if(drag)suppressClickUntil=Date.now()+350;
   drag=null;clearMarks();
  });
  // HTML Drag and Drop supports mouse/trackpad. Touch needs a pointer-driven
  // grip because mobile browsers do not reliably support native HTML DnD.
  list.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'||touchDrag)return;
   const grip=event.target.closest('.admin-drag-handle');
   const row=grip?.closest(selector);
   if(!row||!row.draggable||state.saving||activeAdminModal)return;
   event.preventDefault();
   touchDrag={pointerId:event.pointerId,source:Number(row.dataset[key]),grip,last:null};
   grip.setPointerCapture?.(event.pointerId);
   row.classList.add('is-touch-dragging');
  });
  list.addEventListener('pointermove',event=>{
   if(!touchDrag||touchDrag.pointerId!==event.pointerId)return;
   event.preventDefault();
   autoScroll(event.clientY);
   const row=document.elementFromPoint(event.clientX,event.clientY)?.closest(selector);
   touchDrag.last=mark(row,event.clientY);
  });
  const stopTouch=(event,cancel=false)=>{
   if(!touchDrag||touchDrag.pointerId!==event.pointerId)return;
   const {source,last,grip}=touchDrag;
   touchDrag=null;
   if(grip.hasPointerCapture?.(event.pointerId))grip.releasePointerCapture(event.pointerId);
   clearMarks();suppressClickUntil=Date.now()+350;
   if(!cancel&&last)commitAdminReorder(kind,source,last.index,last.after);
  };
  list.addEventListener('pointerup',event=>stopTouch(event));
  list.addEventListener('pointercancel',event=>stopTouch(event,true));
  list.addEventListener('click',event=>{
   if(Date.now()>suppressClickUntil)return;
   event.preventDefault();event.stopImmediatePropagation();
  },true);
  // Keyboard alternative to dragging, without sending any Firebase request.
  list.addEventListener('keydown',event=>{
   if(!event.altKey||event.ctrlKey||event.metaKey||
      !['ArrowUp','ArrowDown'].includes(event.key))return;
   const row=event.target.closest(selector);
   if(!row||!row.draggable)return;
   event.preventDefault();
   const at=Number(row.dataset[key]),step=event.key==='ArrowUp'?-1:1;
   const next=commitAdminReorder(kind,at,at+step,step===1);
   if(next!==null)list.querySelector('[data-'+key+'="'+next+'"]')?.focus();
  });
 }
 function updateCommonGroup(id,checked){
  const p=product();if(!p)return;
  const old=arr(p.optionGroupIds).map(String);
  p.optionGroupIds=checked?[...new Set([...old,id])]:old.filter(x=>x!==id);
  const visible=new Set([...p.optionGroupIds,...arr(p.sizes).flatMap(x=>arr(x.optionGroupIds))].map(String));
  p.optionGroupOrder=[...new Set([...arr(p.optionGroupOrder),...p.optionGroupIds]
   .map(String).filter(x=>visible.has(x)))];
  for(const size of arr(p.sizes)){
   if(Array.isArray(size.optionGroupOrder))size.optionGroupOrder=orderedGroupIdsForSize(p,size);
  }
  renderSizes();setDirty();
 }
 function updateSizeGroup(index,id,checked){
  const p=product(),size=arr(p?.sizes)[index];if(!size)return;
  if(arr(p.optionGroupIds).map(String).includes(id))return; // Inherited from all sizes.
  const before=arr(size.optionGroupIds).map(String);
  size.optionGroupIds=checked?[...new Set([...before,id])]:before.filter(x=>x!==id);
  size.optionGroupOrder=orderedGroupIdsForSize(p,size);
  renderSizes();setDirty();
 }
 function moveSizeGroup(index,id,step){
  const p=product(),size=arr(p?.sizes)[index];if(!size)return;
  const order=orderedGroupIdsForSize(p,size),at=order.indexOf(id);
  if(moveIn(order,at,step)){
   size.optionGroupOrder=order;
   renderSizes();setDirty();
  }
 }
 function readAndSetImage(){
  const p=product();if(!p)return;
  try{
   if(setProductImage(p,$('pImage').value)){setDirty();renderProducts()}
   const url=productImage(p);$('pPreview').src=url;$('pPreview').hidden=!url;
  }catch(e){notify(e.message,true);$('pImage').value=productImage(p)}
 }
 // Reuse the product editor's modal styles/field components; category edits
 // are applied only after Submit. Cancel/Escape never creates a menu change.
 function openCategoryModal(index=null){
  if(!state.menu)return;
  const editing=index!==null;
  const section=editing?state.menu.sections[index]:null;
  if(editing&&!section)return;
  if(activeAdminModal)closeAdminModal();
  adminModalReturnFocus=document.activeElement;
  categoryModalTarget=editing?String(section.id):null;
  $('categoryEditorTitle').textContent=editing?'Rediger kategori':'Ny kategori';
  $('categoryEditorDescription').textContent=editing?'Endre navn, beskrivelse og type.':'Fyll ut kategorien og legg til produkter.';
  $('categoryTitle').value=String(section?.title||'');
  $('categoryNote').value=String(section?.note||'');
  $('categoryType').value=String(section?.type||'');
  $('categoryIdHint').textContent=editing?'Kategori-ID: '+String(section.id):'Ny kategori får automatisk en unik ID.';
  $('btnSaveCategoryModal').textContent=editing?'Lagre kategori':'Opprett kategori';
  $('btnCategorySaveAddProduct').hidden=editing;
  $('categoryEditor').hidden=false;
  $('categoryModalBackdrop').hidden=false;
  activeAdminModal='category';
  document.body.classList.add('admin-modal-open');
  $('categoryTitle').focus();
 }
 function commitCategoryForm(withProduct=false){
  if(activeAdminModal!=='category'||!state.menu)return;
  if(!$('categoryForm').reportValidity())return;
  const title=$('categoryTitle').value.trim(),
   note=$('categoryNote').value.trim(),
   type=$('categoryType').value.trim();
  if(!title){$('categoryTitle').focus();return}
  if(categoryModalTarget===null){
   const section={id:uid('cat'),title,note,items:[]};
   if(type)section.type=type;
   state.menu.sections.push(section);
   state.category=state.menu.sections.length-1;
   state.product=0;
   closeAdminModal();renderAll();setDirty();
   if(withProduct)addProduct();
   else notify('Tom kategori er et lokalt utkast. Legg til et produkt for å lagre den.');
   return;
  }
  const index=state.menu.sections.findIndex(section=>String(section.id)===categoryModalTarget);
  if(index<0){notify('Kategorien finnes ikke lenger. Hent siste meny.',true);return}
  const section=state.menu.sections[index];
  const previousType=String(section.type||'');
  const changed=String(section.title||'')!==title||String(section.note||'')!==note||previousType!==type;
  if(changed){
   section.title=title;section.note=note;
   if(type)section.type=type;else delete section.type;
  }
  closeAdminModal();
  if(changed){
   state.category=index;renderCategories();renderProducts();setDirty();
  }
 }
 function addCategory(){openCategoryModal()}
 function editCategory(){openCategoryModal(state.category)}
 function addProduct(){
  const s=category();if(!s)return;
  const newItem={id:uid('product'),name:'',description:'',ingredientRules:[],sizes:[{id:uid('size'),label:'',price:0}],optionGroupIds:[],optionGroupOrder:[]};
  draftProductSnapshots.set(String(newItem.id),JSON.stringify(newItem));
  s.items.push(newItem);state.product=s.items.length-1;renderProducts();renderProductEditor();setDirty();
  openAdminModal('product');$('pName').focus();
 }
 function removeProduct(index=state.product){
  const s=category(),p=s?.items?.[index];if(!p)return;
  if(!confirm('Slette produktet «'+p.name+'»? Endringen lagres automatisk.'))return;
  const wasSelected=index===state.product;
  draftProductSnapshots.delete(String(p.id));
  s.items.splice(index,1);
  if(wasSelected)state.product=Math.max(0,Math.min(index,s.items.length-1));
  else if(index<state.product)state.product--;
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>String(id)!==String(p.id));
  removeRecommendationIds([p.id]);renderProducts();renderProductEditor();setDirty();
 }
 function removeCategory(index=state.category){
  const s=state.menu?.sections?.[index];if(!s)return;
  if(state.menu.sections.length<=1){notify('Menyen må ha minst én kategori.',true);return}
  if(!confirm('Slette hele «'+s.title+'» og alle '+arr(s.items).length+' produktene? Endringen lagres automatisk.'))return;
  const current=category(),ids=new Set(arr(s.items).map(p=>String(p.id)));
  for(const id of ids)draftProductSnapshots.delete(id);
  state.menu.sections.splice(index,1);
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>!ids.has(String(id)));
  removeRecommendationIds(ids);
  state.category=state.menu.sections.indexOf(current);
  if(state.category<0){state.category=Math.min(index,state.menu.sections.length-1);state.product=0}
  renderAll();setDirty();
 }
 function addGroup(){
  const g={id:uid('group'),title:'',selectionMode:'single',required:false,maxSelections:1,allowQuantity:false,defaultOptionIds:[],options:[]};
  draftGroupSnapshots.set(String(g.id),JSON.stringify(g));
  state.menu.optionGroups.push(g);state.group=state.menu.optionGroups.length-1;
  renderGroups();renderGroupEditor();setDirty();openAdminModal('group');$('gTitle').focus();
 }
 function deleteGroup(index=state.group){
  const groups=state.menu?.optionGroups;
  const g=groups?.[index];if(!g)return;
  if(!confirm('Slette valggruppen «'+g.title+'» og fjerne den fra alle produkter? Endringen lagres automatisk.'))return;
  const id=String(g.id),selected=groups[state.group];
  if(activeAdminModal==='group')closeAdminModal();
  draftGroupSnapshots.delete(id);
  groups.splice(index,1);
  // Keep the menu consistent: remove every reference from products/sizes.
  for(const section of arr(state.menu.sections))for(const p of arr(section.items)){
   p.optionGroupIds=arr(p.optionGroupIds).filter(v=>String(v)!==id);
   p.optionGroupOrder=arr(p.optionGroupOrder).filter(v=>String(v)!==id);
   for(const size of arr(p.sizes)){
    size.optionGroupIds=arr(size.optionGroupIds).filter(v=>String(v)!==id);
    if(Array.isArray(size.optionGroupOrder))size.optionGroupOrder=size.optionGroupOrder.filter(v=>String(v)!==id);
   }
  }
  state.group=groups.indexOf(selected);
  if(state.group<0)state.group=Math.max(0,Math.min(index,groups.length-1));
  renderGroups();renderGroupEditor();renderAssignedGroupsIfVisible();setDirty();
 }
 function renderAssignedGroupsIfVisible(){if(product())renderSizes()}
 function addOption(){
  const g=group();if(!g)return;
  g.options=arr(g.options);
  g.options.push({id:uid('option'),label:'',price:0});
  renderOptionRows();setDirty();
 }
 function moveOption(index,step){
  const g=group();if(!g)return;
  if(moveIn(g.options,index,step)){renderOptionRows();setDirty()}
 }
 function changeDefault(index,checked){
  const g=group(),option=g?.options?.[index];if(!option)return;
  let ids=arr(g.defaultOptionIds).map(String);
  if(g.selectionMode==='multiple')ids=checked?[...new Set([...ids,String(option.id)])]:ids.filter(id=>id!==String(option.id));
  else ids=checked?[String(option.id)]:[];
  g.defaultOptionIds=ids;setDirty();renderOptionRows();
 }
 // The customer normalizer treats missing/non-numeric prices as zero. Older
 // menus may retain legacy prices. Unrelated edits must not rewrite them:
 // only freshly edited fields are validated on save.
 function originalProduct(p){
  for(const sec of arr(state.original?.sections)){
   const found=arr(sec.items).find(item=>String(item?.id)===String(p?.id));
   if(found)return found;
  }
  return null;
 }
 function originalOption(g,option){
  const old=arr(state.original?.optionGroups).find(x=>String(x?.id)===String(g?.id));
  return arr(old?.options).find(x=>String(x?.id)===String(option?.id))||null;
 }
 function menuPriceIsValid(raw){
  const n=Number(raw);
  return Number.isFinite(n)&&n>=0;
 }
 function sanitize(menu=state.menu){
  if(!menu.sections.length)throw Error('Menyen må ha minst én kategori.');
  const catIds=new Set(),prodIds=new Set(),groupIds=new Set();
  for(const section of menu.sections){
   if(!section.title?.trim())throw Error('Alle kategorier må ha navn.');
   if(catIds.has(String(section.id)))throw Error('Duplisert kategori-ID.');catIds.add(String(section.id));
   for(const p of section.items){
    if(!String(p.name||'').trim())throw Error('Et produkt mangler navn.');
    if(prodIds.has(String(p.id)))throw Error('Duplisert produkt-ID.');prodIds.add(String(p.id));
    for(const size of arr(p.sizes)){
     if(menuPriceIsValid(size.price))continue;
     const previous=arr(originalProduct(p)?.sizes).find(entry=>String(entry?.id)===String(size?.id));
     if(!previous||!Object.is(previous.price,size.price))throw Error('Ugyldig pris: '+p.name);
    }
   }
  }
  if(menu.cartSuggestionRules!==undefined){
   if(!Array.isArray(menu.cartSuggestionRules))throw Error('cartSuggestionRules må være en liste med produkt-ID-er.');
   const suggested=menu.cartSuggestionRules.map(String);
   if(suggested.length>10||new Set(suggested).size!==suggested.length||
      suggested.some(id=>!prodIds.has(id)))
    throw Error('Handlekurvforslag må ha opptil 10 gyldige, forskjellige produkter.');
  }
  for(const g of menu.optionGroups){
   if(!String(g.title||'').trim())throw Error('En valggruppe mangler navn.');
   if(groupIds.has(String(g.id)))throw Error('Duplisert valggruppe-ID.');groupIds.add(String(g.id));
   const ids=new Set();
   for(const o of arr(g.options)){
    const previous=originalOption(g,o);
    if(!String(o.label||'').trim()&&(!previous||!Object.is(previous.label,o.label)))
     throw Error('Et alternativ mangler navn i '+g.title);
    if(ids.has(String(o.id)))throw Error('Duplisert alternativ-ID i '+g.title);
    ids.add(String(o.id));
    if(!menuPriceIsValid(o.price)&&(!previous||!Object.is(previous.price,o.price)))
     throw Error('Ugyldig alternativpris i '+g.title+' · '+(o.label||o.id));
   }
  }
 }
 function buildDelta(oldValue,newValue){
  const list=[],MAX=18;let full=false;
  const walk=(a,b,path,depth)=>{
   if(full)return;
   if(JSON.stringify(a)===JSON.stringify(b))return;
   if(depth>9){full=true;return}
   if(Array.isArray(a)&&Array.isArray(b)){
    if(a.length!==b.length){full=true;return}
    for(let i=0;i<b.length;i++)walk(a[i],b[i],path+'/'+i,depth+1);
    return;
   }
   if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
    const keys=new Set([...Object.keys(a),...Object.keys(b)]);
    for(const key of keys){if(key==='updatedAt'||key==='changeFeed')continue;walk(a[key],b[key],path+'/'+key,depth+1)}
    return;
   }
   // An intermediate object/array replacement requires one full menu refresh.
   if(b&&typeof b==='object'||a&&typeof a==='object'){full=true;return}
   if(path.split('/').length<3){full=true;return}
   list.push({path:'menu'+path,value:b===undefined?null:b});
   if(list.length>MAX||JSON.stringify(list).length>5000)full=true;
  };
  walk(oldValue,newValue,'',0);
  return {changes:full?[]:list,requiresRefresh:full};
 }
 async function save(options={}){
  const auto=options?.auto===true;
  if(!state.menu||state.saving)return;
  cancelScheduledSave();
  if(!state.etag){
   if(!auto)notify('Hent siste meny før du lagrer.','error');
   return;
  }
  // Exclude empty new categories and only genuinely untouched new products.
  const prepared=menuWithoutIncompleteDrafts();
  if(persistableSignature(prepared)===persistableSignature(state.original)){
   syncSaveStatus();
   if(!auto&&hasUnfinishedDrafts())
    notify('Ufullstendige produkter, størrelser, valggrupper og tomme kategorier lagres ikke.');
   return;
  }
  try{sanitize(prepared)}catch(error){
   message(error.message,'error');
   if(!auto)notify(error.message,true);
   syncSaveStatus();
   return;
  }
  const revision=editRevision;
  const version=Math.max(Date.now(),Number(state.original.updatedAt||0)+1);
  const delta=buildDelta(state.original,prepared);
  const previousVersion=Number(state.original.updatedAt)||0;
  const next=prepared;
  next.updatedAt=version;
  next.changeFeed=next.changeFeed&&typeof next.changeFeed==='object'?next.changeFeed:{};
  next.changeFeed.latest={version,previousVersion,changes:delta.changes,requiresRefresh:delta.requiresRefresh};
  state.saving=true;$('btnSave').disabled=true;
  $('saveStatus').className='status dirty';$('saveStatus').textContent='Lagrer…';
  try{
   const response=await fetch(await menuAuthURL(),{method:'PUT',
    headers:{'Content-Type':'application/json','if-match':state.etag},
    body:JSON.stringify(next),cache:'no-store'});
   if(response.status===412){
    clearAdminMenuCache();state.etag=null;
    throw Error('En annen administrator endret menyen. Ingen data ble overskrevet. Hent siste meny og legg inn endringene på nytt.');
   }
   if(response.status===401||response.status===403)
    throw Error('Firebase avviste skriving. Kontroller admin UID og Database Rules.');
   if(!response.ok)throw Error('Kunne ikke lagre til Firebase: HTTP '+response.status);
   // Keep the unsaved editor state intact even if the user changes a field
   // while this PUT is in flight; the next run will save those later edits.
   state.original=clone(next);
   for(const section of arr(next.sections))for(const item of arr(section.items))
    draftProductSnapshots.delete(String(item.id));
   for(const item of arr(next.optionGroups))draftGroupSnapshots.delete(String(item.id));
   state.menu.updatedAt=version;
   state.menu.changeFeed=clone(next.changeFeed);
   let etag=response.headers.get('ETag');
   if(!etag){
    const fresh=await fetch(await menuAuthURL(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
    if(fresh.ok){
     etag=fresh.headers.get('ETag');
     if(etag)state.original=await fresh.json();
    }
   }
   state.etag=etag||null;
   if(etag)storeAdminMenuCache(state.original,etag);
   else clearAdminMenuCache();
   // No renderAll here: it would replace focused text fields during autosave.
   refreshHeader();
   const more=syncSaveStatus();
   if(!auto)notify('Lagret i Firebase');
   if(!etag)message('Lagret, men ETag kunne ikke leses. Hent siste meny før neste endring.','warn');
   // A change made during a network request must be persisted separately.
   if(etag&&more&&editRevision!==revision)scheduleAutoSave();
  }catch(error){
   message(error.message||'Lagring feilet','error');
   $('saveStatus').className='status dirty';
   $('saveStatus').textContent='Lagring feilet';
   if(!auto)notify(error.message||'Lagring feilet',true);
  }finally{
   state.saving=false;
   const nextPrepared=menuWithoutIncompleteDrafts();
   $('btnSave').disabled=!state.etag||
    persistableSignature(nextPrepared)===persistableSignature(state.original);
  }
 }
 function handleEvents(){
 $('authForm').addEventListener('submit',login);
 $('btnSignOut').addEventListener('click',async()=>{
  if(state.dirty&&!confirm('Forkast ulagrede endringer og logg ut?'))return;
  cancelScheduledSave();draftProductSnapshots.clear();draftGroupSnapshots.clear();
  await auth?.signOut();state.menu=null;state.etag=null;state.original=null;state.dirty=false;showLogin();
 });
  $('btnRetry').addEventListener('click',()=>{void startAdmin()});
  for(const [id,kind] of [['btnCloseCategoryModal','category'],['btnCancelCategoryModal','category'],['categoryModalBackdrop','category'],['btnCloseProductModal','product'],['btnCloseProductBottom','product'],['productModalBackdrop','product'],['btnCloseGroupModal','group'],['btnCloseGroupBottom','group'],['groupModalBackdrop','group']]){
   $(id).addEventListener('click',()=>{if(activeAdminModal===kind)closeAdminModal()});
  }
  $('categoryForm').addEventListener('submit',event=>{event.preventDefault();commitCategoryForm()});
  $('btnCategorySaveAddProduct').addEventListener('click',()=>commitCategoryForm(true));
  $('btnSaveProductModal').addEventListener('click',()=>{void saveAdminModal('product')});
  $('btnSaveGroupModal').addEventListener('click',()=>{void saveAdminModal('group')});
  $('productEditor').querySelectorAll('[data-product-tab]').forEach(button=>
   button.addEventListener('click',()=>setAdminModalTab('product',button.dataset.productTab)));
  $('groupEditor').querySelectorAll('[data-group-tab]').forEach(button=>
   button.addEventListener('click',()=>setAdminModalTab('group',button.dataset.groupTab)));
  document.addEventListener('keydown',modalKeyboard);

  $('btnSave').addEventListener('click',save);
  $('btnReload').addEventListener('click',()=>loadMenu().then(ok=>{if(ok)notify('Siste meny er hentet')}).catch(e=>notify(e.message,true)));
  $('btnExportMenuBackup').addEventListener('click',exportOriginalMenuBackup);
  $('btnUndo').addEventListener('click',()=>{if(!state.original||!confirm('Forkast alle ulagrede endringer?'))return;
   draftProductSnapshots.clear();draftGroupSnapshots.clear();
   state.menu=clone(state.original);state.category=0;state.product=0;state.group=0;renderAll();setClean()});
  document.querySelectorAll('#adminNavTrack [data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  const navTrack=$('adminNavScroll');
  navTrack.addEventListener('scroll',updateAdminNavArrows,{passive:true});
  // Arrow keys navigate only the two tab choices; Verktøy stays accessible.
  navTrack.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const tabs=[...navTrack.querySelectorAll('[data-tab]')];
   if(!tabs.includes(document.activeElement))return;
   event.preventDefault();
   const at=tabs.indexOf(document.activeElement);
   const to=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   tabs[to].focus();setTab(tabs[to].dataset.tab);
  });
  for(const [id,direction] of [['adminNavPrev',-1],['adminNavNext',1]]){
   $(id).addEventListener('click',()=>navTrack.scrollBy({left:direction*220,behavior:'smooth'}));
  }
  window.addEventListener('resize',updateAdminNavArrows);
  const tools=$('adminToolsMenu');
  // Each time Verktøy opens, show both groups and all their actions.
  // Individual sections can still be collapsed during that open session.
  tools.addEventListener('toggle',()=>{
   if(!tools.open)return;
   tools.querySelectorAll('.admin-tools-accordion').forEach(section=>{section.open=true});
  });
  tools.addEventListener('click',event=>{
   if(event.target.closest('.admin-tools-items button,.admin-tools-items a'))tools.open=false;
  });
  document.addEventListener('pointerdown',event=>{
   if(tools.open&&!tools.contains(event.target))tools.open=false;
  });
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&tools.open){
    event.preventDefault();tools.open=false;
    tools.querySelector('summary').focus();
   }
  });
  $('categoryList').addEventListener('click',event=>{
   const row=event.target.closest('[data-category]');if(!row)return;
   const index=Number(row.dataset.category);
   if(event.target.closest('[data-category-delete]')){removeCategory(index);return}
   if(event.target.closest('[data-category-edit]')){
    state.category=index;state.product=0;renderCategories();renderProducts();renderProductEditor();
    editCategory();return;
   }
   if(!event.target.closest('[data-category-select]')&&!event.target.closest('.admin-row-main'))return;
   state.category=index;state.product=0;renderCategories();renderProducts();renderProductEditor();
  });
  $('productList').addEventListener('click',event=>{
   const row=event.target.closest('[data-product]');if(!row)return;
   const index=Number(row.dataset.product);
   if(event.target.closest('[data-product-delete]')){removeProduct(index);return}
   if(!event.target.closest('[data-product-edit]')&&!event.target.closest('[data-product-select]'))return;
   state.product=index;renderProducts();renderProductEditor();openAdminModal('product');
  });
  initAdminDragReorder('category');
  initAdminDragReorder('product');
  $('groupList').addEventListener('click',event=>{
   const row=event.target.closest('[data-group]');if(!row)return;
   const index=Number(row.dataset.group);
   if(event.target.closest('[data-group-delete]')){deleteGroup(index);return}
   if(!event.target.closest('[data-group-edit]')&&!event.target.closest('[data-group-select]'))return;
   state.group=index;renderGroups();renderGroupEditor();openAdminModal('group');
  });
  document.querySelectorAll('[data-group-view]').forEach(button=>
   button.addEventListener('click',()=>setGroupView(button.dataset.groupView)));
  setGroupView(groupViewMode);
  $('productSearch').addEventListener('input',renderProducts);
  $('groupSearch').addEventListener('input',renderGroups);
  $('addCategory').addEventListener('click',addCategory);
  $('addProduct').addEventListener('click',addProduct);
  for(const [id,key]of [['pName','name'],['pDescription','description']])
   $(id).addEventListener('input',event=>updateItemField(key,event.target.value));
  $('pIngredientsFromDescription').addEventListener('click',()=>{
   const p=product();if(!p)return;
   const description=String(p.description||'').trim();
   if(!description){notify('Beskrivelsen er tom. Skriv en beskrivelse først.',true);return}
   const target=$('pIngredientRules');
   if(target.value.trim()&&!confirm('Erstatte nåværende ingrediensliste med innhold fra beskrivelsen?'))return;
   const names=description.split(/[,;\n]+/).map(text=>text.trim().replace(/[.!?]+$/,'').trim()).filter(Boolean);
   target.value=names.join(', ').slice(0,1800);
   target.dispatchEvent(new Event('input',{bubbles:true}));
   notify('Hentet fra beskrivelse · kontroller og lagre');
  });
  $('pIngredientRules').addEventListener('input',event=>{
   const p=product();if(!p)return;
   const previous=arr(p.ingredientRules);
   const seen=new Set();
   const names=event.target.value.split(/[,;\n]+/).map(name=>name.trim().replace(/\s+/g,' ').slice(0,100))
    .filter(name=>{const key=name.toLocaleLowerCase('no');if(!key||seen.has(key))return false;seen.add(key);return true});
   // Keep any existing object metadata for matching ingredients; do not
   // silently alter the configuration of unaffected ingredient rules.
   const updated=names.map(name=>{
    const old=previous.find(entry=>String(typeof entry==='string'?entry:entry?.name||'').trim().toLocaleLowerCase('no')===name.toLocaleLowerCase('no'));
    return old&&typeof old==='object'?{...old,name}:name;
   });
   if(JSON.stringify(previous)===JSON.stringify(updated))return;
   p.ingredientRules=updated;
   setDirty();
  });
  $('pImage').addEventListener('change',readAndSetImage);
  $('pKitchenNotes').addEventListener('input',e=>{
   const p=product();if(!p)return;
   p.quickKitchenNotes=e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);setDirty();
  });
  $('allergenChoices').addEventListener('change',event=>{
   const input=event.target.closest('[data-product-allergen]');if(input)setProductAllergen(input.dataset.productAllergen,input.checked);
  });
  $('pPreview').addEventListener('error',()=>{$('pPreview').hidden=true});
  for(const [id,key]of [['pSoldOut','soldOut'],['pHidden','hidden']])
   $(id).addEventListener('change',event=>{updateItemField(key,event.target.checked);renderProducts()});
  $('pPopular').addEventListener('change',event=>{
   const p=product();if(!p)return;
   const ids=arr(state.menu.popularItemIds).map(String),id=String(p.id);
   state.menu.popularItemIds=event.target.checked?[...new Set([...ids,id])]:ids.filter(x=>x!==id);
   setDirty();
  });
  $('pCartSuggestion').addEventListener('change',event=>toggleCartSuggestion(event.target.checked));
  $('sizeRows').addEventListener('input',event=>{
   const p=product(),t=event.target;if(!p)return;
   if(t.matches('[data-size-name]')){const size=p.sizes[Number(t.dataset.sizeName)];size.label=t.value;delete size.labelId;setDirty()}
   if(t.matches('[data-size-price]')){p.sizes[Number(t.dataset.sizePrice)].price=Number(t.value);setDirty();renderProducts()}
  });
  $('commonGroupList').addEventListener('change',event=>{
   const input=event.target.closest('[data-common-group]');
   if(input)updateCommonGroup(input.dataset.commonGroup,input.checked);
  });
  $('sizeRows').addEventListener('change',event=>{
   const input=event.target.closest('[data-size-group]');
   if(input)updateSizeGroup(Number(input.dataset.sizeGroup),input.value,input.checked);
  });
  $('sizeRows').addEventListener('click',event=>{
   const move=event.target.closest('[data-size-move]');
   if(move){
    moveSizeGroup(Number(move.dataset.sizeMove),move.dataset.groupId,Number(move.dataset.groupStep));
    return;
   }
   const del=event.target.closest('[data-size-remove]');
   if(!del)return;
   const p=product();p.sizes.splice(Number(del.dataset.sizeRemove),1);
   renderSizes(true);setDirty();
  });
  $('addSize').addEventListener('click',()=>{
   const p=product();if(!p)return;
   p.sizes=arr(p.sizes);
   p.sizes.push({id:uid('size'),label:'',price:0,optionGroupIds:[]});
   renderSizes();setDirty();
  });
  $('addGroup').addEventListener('click',addGroup);
  for(const [id,key]of [['gTitle','title'],['gMode','selectionMode']])
   $(id).addEventListener('change',event=>{
    updateGroupField(key,event.target.value);
    if(id==='gMode'&&event.target.value==='single'){group().maxSelections=1;group().allowQuantity=false;group().defaultOptionIds=arr(group().defaultOptionIds).slice(0,1);renderGroupEditor()}
   });
  $('gMax').addEventListener('change',e=>updateGroupField('maxSelections',Math.max(1,Math.min(30,Number(e.target.value)||1))));
  $('gRequired').addEventListener('change',e=>updateGroupField('required',e.target.checked));
  $('gQuantity').addEventListener('change',e=>updateGroupField('allowQuantity',e.target.checked));
  $('addOption').addEventListener('click',addOption);
  $('optionRows').addEventListener('input',event=>{
   const t=event.target,g=group();if(!g)return;
   if(t.matches('[data-option-label]')){g.options[Number(t.dataset.optionLabel)].label=t.value;setDirty()}
   if(t.matches('[data-option-price]')){g.options[Number(t.dataset.optionPrice)].price=Number(t.value);setDirty()}
  });
  $('optionRows').addEventListener('change',event=>{
   const t=event.target,g=group();if(!g)return;
   if(t.matches('[data-option-default]'))changeDefault(Number(t.dataset.optionDefault),t.checked);
   if(t.matches('[data-option-soldout]')){g.options[Number(t.dataset.optionSoldout)].soldOut=t.checked;setDirty()}
  });
  $('optionRows').addEventListener('click',event=>{
   const t=event.target,g=group();if(!g)return;
   const del=t.closest('[data-option-delete]');
   if(del){const i=Number(del.dataset.optionDelete),removed=g.options.splice(i,1)[0];g.defaultOptionIds=arr(g.defaultOptionIds).filter(id=>String(id)!==String(removed.id));renderOptionRows();setDirty();return}
   const up=t.closest('[data-option-up]'),down=t.closest('[data-option-down]');
   if(up)moveOption(Number(up.dataset.optionUp),-1);
   if(down)moveOption(Number(down.dataset.optionDown),1);
  });
  window.addEventListener('beforeunload',event=>{
   if(!state.dirty)return;
   event.preventDefault();event.returnValue='';
  });
 }
 handleEvents();
 void bootAuth();
})();