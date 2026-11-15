/* KØL BETA menu administrator. Only /menu is read/written. Admin access
 * is protected by Firebase Authentication and Realtime Database Rules.
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
function apiKey(){return FIREBASE_WEB_API_KEY}
function showLogin(err=''){
 $('adminMain').hidden=true;$('authScreen').hidden=false;$('btnSignOut').hidden=true;
 $('authError').textContent=err;$('authError').hidden=!err;
 $('authPassword').value='';
}
async function configure(){
 if(!window.firebase?.auth)throw Error('Firebase Authentication kunne ikke lastes.');
 const key=apiKey();
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
  if(!apiKey())return;
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
 let toastTimer=0;
 function notify(message,error=false){
  const node=$('toast');node.textContent=message;node.classList.toggle('error',error);node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2300);
 }
 function message(text,type=''){
  const node=$('adminMessage');node.textContent=text;node.className='banner'+(type?' '+type:'');
 }
 function setDirty(){
  if(!state.menu)return;
  state.dirty=true;
  $('btnSave').disabled=state.saving||!state.etag;
  const node=$('saveStatus');node.className='status dirty';node.textContent='Ikke lagret';
 }
 function setClean(){
  state.dirty=false;
  $('btnSave').disabled=true;
  const node=$('saveStatus');node.className='status ok';node.textContent='Menyen er synkronisert';
 }
 function assertMenu(payload){
  if(!payload||!Array.isArray(payload.sections)||!Array.isArray(payload.optionGroups)||!Array.isArray(payload.images))
   throw Error('Uventet menyformat. For å unngå datatap åpner ikke redigereren dette formatet.');
  if(!payload.sections.every(s=>s&&Array.isArray(s.items)))throw Error('Kategorier mangler items-lister.');
  if(!payload.optionGroups.every(g=>g&&Array.isArray(g.options)))throw Error('Valggrupper har et eldre format som må migreres før redigering. Ingen data ble endret.');
 }
 function category(){return state.menu?.sections?.[state.category]||null}
 function product(){return category()?.items?.[state.product]||null}
 function recommendationIds(){
  return arr(state.menu?.cartSuggestionRules).map(String).filter(Boolean);
 }
 function toggleCartSuggestion(checked){
  const p=product();if(!p)return;
  const id=String(p.id),ids=recommendationIds();
  if(checked&&!ids.includes(id)&&ids.length>=4){
   $('pCartSuggestion').checked=false;
   notify('Maks 4 produkter kan anbefales i handlekurven.',true);
   return;
  }
  const next=checked?[...new Set([...ids,id])]:ids.filter(value=>value!==id);
  state.menu.cartSuggestionRules=next;
  $('cartSuggestionLimit').textContent=next.length+' av 4 valgt · Lagres under /menu/cartSuggestionRules';
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
 
 function usedGroupIds(p){
  return [...new Set([...arr(p.optionGroupIds),...arr(p.sizes).flatMap(s=>arr(s.optionGroupIds))].map(String))];
 }
 function refreshHeader(){
  const n=state.menu?.sections.reduce((sum,s)=>sum+arr(s.items).length,0)||0;
  message(state.menu?'Menyversjon: '+(state.menu.updatedAt||'ukjent')+' · '+n+' produkter · '+state.menu.optionGroups.length+' valggrupper':'Ingen meny lastet inn');
 }
 // Direct menu connection, with no login request or authentication token.
 async function menuURL(){return menuAuthURL()}
 async function startAdmin(){
  $('loadingCard').hidden=false;
  $('adminRoot').hidden=true;
  $('loadError').hidden=true;
  $('btnRetry').disabled=true;
  $('saveStatus').className='status';
  $('saveStatus').textContent='Kobler til Firebase…';
  try{
   await loadMenu(false);
   $('loadingCard').hidden=true;
   $('adminRoot').hidden=false;
   notify('Menyen er lastet fra Firebase');
  }catch(error){
   console.warn('BETA menu admin load failed:',error);
   $('loadError').textContent=error.message||'Kunne ikke laste menyen.';
   $('loadError').hidden=false;
   $('saveStatus').textContent='Kunne ikke koble til';
  }finally{$('btnRetry').disabled=false}
 }
 async function loadMenu(confirmDiscard=true){
  if(confirmDiscard&&state.dirty&&!confirm('Forkast ulagrede endringer og hent menyen på nytt?'))return false;
  const response=await fetch(await menuURL(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
  if(!response.ok)throw Error('Firebase avviste menylesing ('+response.status+'). Kontroller database Rules.');
  const payload=await response.json();
  assertMenu(payload);
  const etag=response.headers.get('ETag');
  if(!etag)throw Error('ETag mangler. Lagring stoppet for å beskytte eksisterende meny.');
  state.menu=payload;state.original=clone(payload);state.etag=etag;state.category=0;state.product=0;state.group=0;
  setClean();renderAll();refreshHeader();
  return true;
 }
 function setTab(tab){
  state.tab=tab;
  $('productsPage').hidden=tab!=='products';$('groupsPage').hidden=tab!=='groups';
  for(const b of document.querySelectorAll('[data-tab]')){
   const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));
  }
 }

 let activeAdminModal=null,adminModalReturnFocus=null;
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
  activeAdminModal=null;
  $(kind==='product'?'productEditor':'groupEditor').hidden=true;
  $(kind==='product'?'productModalBackdrop':'groupModalBackdrop').hidden=true;
  document.body.classList.remove('admin-modal-open');
  const toFocus=adminModalReturnFocus;
  adminModalReturnFocus=null;
  if(toFocus?.isConnected&&typeof toFocus.focus==='function')toFocus.focus();
 }
 async function saveAdminModal(kind){
  // Ensure the image URL is committed even if the user clicks Save before blurring.
  if(kind==='product'&&product()&&$('pImage').value!==productImage(product()))readAndSetImage();
  if(!state.dirty){closeAdminModal();return}
  await save();
  if(!state.dirty)closeAdminModal();
 }
 function modalKeyboard(event){
  if(!activeAdminModal)return;
  if(event.key==='Escape'){event.preventDefault();closeAdminModal();return}
  if(event.key!=='Tab')return;
  const modal=$(activeAdminModal==='product'?'productEditor':'groupEditor');
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
 function categoryButton(s,i){
  const count=arr(s.items).length;
  return '<button class="item'+(i===state.category?' active':'')+'" type="button" data-category="'+i+'"><span class="item-icon">'+esc(String(s.title||'?').slice(0,1).toUpperCase())+'</span><span class="item-copy"><strong>'+esc(s.title||'Kategori')+'</strong><small>'+count+' produkter</small></span><span aria-hidden="true">›</span></button>';
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
   return '<button class="item'+(i===state.product?' active':'')+(p.hidden?' dim':'')+'" type="button" data-product="'+i+'">'+img+'<span class="item-copy"><strong>'+esc(p.name||'Nytt produkt')+'</strong><small>'+
    esc(arr(p.sizes).map(v=>Math.round(Number(v.price)||0)+' kr').join(' · ')||String(p.price||0)+' kr')+
    (recommendationIds().includes(String(p.id))?' · Anbefales i kurven':'')+
    (p.soldOut?' · Utsolgt':'')+(p.hidden?' · Skjult':'')+'</small></span><span aria-hidden="true">›</span></button>';
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
    '<input data-size-name="'+i+'" aria-label="Størrelsesnavn" value="'+esc(sizeLabel(size))+'">'+
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
  $('cartSuggestionLimit').textContent=recommendationIds().length+' av 4 valgt · Lagres under /menu/cartSuggestionRules';
  renderSizes(true);
 }
 function renderGroups(){
  const query=$('groupSearch').value.trim().toLocaleLowerCase('no');
  $('groupList').innerHTML=state.menu.optionGroups.map((g,i)=>{
   if(query&&!String(g.title||'').toLocaleLowerCase('no').includes(query))return '';
   const count=arr(g.options).length;
   return '<button type="button" data-group="'+i+'" class="item'+(state.group===i?' active':'')+'"><span class="item-icon">＋</span><span class="item-copy"><strong>'+esc(g.title||'Valggruppe')+'</strong><small>'+count+' alternativer · '+(g.selectionMode==='multiple'?'Flere valg':'Ett valg')+'</small></span><span>›</span></button>';
  }).join('')||'<p class="empty">Ingen valggrupper</p>';
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
 function changeCategory(step){
  if(moveIn(state.menu.sections,state.category,step)){state.category+=step;renderCategories();renderProducts();renderProductEditor();setDirty()}
 }
 function changeProduct(step){
  const s=category();if(s&&moveIn(s.items,state.product,step)){state.product+=step;renderProducts();renderProductEditor();setDirty()}
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
 function addCategory(){
  const title=prompt('Navn på ny kategori:','Ny kategori');
  if(!title?.trim())return;
  state.menu.sections.push({id:uid('cat'),title:title.trim(),note:'',items:[]});
  state.category=state.menu.sections.length-1;state.product=0;renderAll();setDirty();
 }
 function editCategory(){
  const s=category();if(!s)return;
  const title=prompt('Kategorinavn:',s.title||'');
  if(title===null)return;
  if(!title.trim()){notify('Kategorinavn kan ikke være tomt',true);return}
  const note=prompt('Kort kategoribeskrivelse:',s.note||'');
  s.title=title.trim();if(note!==null)s.note=note.trim();
  renderCategories();renderProducts();setDirty();
 }
 function addProduct(){
  const s=category();if(!s)return;
  const newItem={id:uid('product'),name:'Nytt produkt',description:'',ingredients:'',sizes:[{id:uid('size'),label:'Stor',price:0}],optionGroupIds:[],optionGroupOrder:[]};
  s.items.push(newItem);state.product=s.items.length-1;renderProducts();renderProductEditor();setDirty();
  openAdminModal('product');$('pName').focus();
 }
 function duplicateProduct(){
  const s=category(),p=product();if(!s||!p)return;
  const duplicated=clone(p);duplicated.id=uid('product');duplicated.name=(p.name||'Produkt')+' (kopi)';
  s.items.splice(state.product+1,0,duplicated);state.product++;renderProducts();renderProductEditor();setDirty();
  openAdminModal('product');
 }
 function removeProduct(){
  const s=category(),p=product();if(!s||!p)return;
  if(!confirm('Slette produktet '+p.name+'? Endringen lagres først når du trykker Lagre.'))return;
  closeAdminModal();s.items.splice(state.product,1);state.product=Math.min(state.product,s.items.length-1);
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>String(id)!==String(p.id));
  removeRecommendationIds([p.id]);
  renderProducts();renderProductEditor();setDirty();
 }
 function removeCategory(){
  const s=category();if(!s||!confirm('Slette hele '+s.title+' og alle produktene?'))return;
  const ids=new Set(s.items.map(p=>String(p.id)));state.menu.sections.splice(state.category,1);
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>!ids.has(String(id)));
  removeRecommendationIds(ids);
  state.category=Math.max(0,Math.min(state.category,state.menu.sections.length-1));state.product=0;
  renderAll();setDirty();
 }
 function addGroup(){
  const g={id:uid('group'),title:'Ny valggruppe',selectionMode:'single',required:false,maxSelections:1,allowQuantity:false,defaultOptionIds:[],options:[]};
  state.menu.optionGroups.push(g);state.group=state.menu.optionGroups.length-1;renderGroups();renderGroupEditor();setDirty();openAdminModal('group');$('gTitle').focus();
 }
 function deleteGroup(){
  const g=group();if(!g||!confirm('Slette valggruppen '+g.title+' fra alle produkter?'))return;
  const id=String(g.id);
  closeAdminModal();state.menu.optionGroups.splice(state.group,1);
  for(const section of state.menu.sections)for(const p of section.items){
   p.optionGroupIds=arr(p.optionGroupIds).filter(v=>String(v)!==id);
   p.optionGroupOrder=arr(p.optionGroupOrder).filter(v=>String(v)!==id);
   for(const size of arr(p.sizes)){
    size.optionGroupIds=arr(size.optionGroupIds).filter(v=>String(v)!==id);
    if(Array.isArray(size.optionGroupOrder))size.optionGroupOrder=size.optionGroupOrder.filter(v=>String(v)!==id);
   }
  }
  state.group=Math.min(state.group,state.menu.optionGroups.length-1);
  renderGroups();renderGroupEditor();renderAssignedGroupsIfVisible();setDirty();
 }
 function renderAssignedGroupsIfVisible(){if(product())renderSizes()}
 function addOption(){
  const g=group();if(!g)return;
  g.options=arr(g.options);
  g.options.push({id:uid('option'),label:'Nytt alternativ',price:0});
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
 // DEMO normalizer treats missing/non-numeric menu prices as zero. BETA may
 // inherit these legacy values. An unrelated photo/name edit must never fail
 // because of an untouched old extra price. Do not rewrite legacy values:
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
 function sanitize(){
  const menu=state.menu;
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
   if(suggested.length>4||new Set(suggested).size!==suggested.length||
      suggested.some(id=>!prodIds.has(id)))
    throw Error('Handlekurvforslag må ha opptil 4 gyldige, forskjellige produkter.');
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
 async function save(){
  if(!state.dirty||state.saving)return;
  if(!state.etag){notify('Hent siste meny før du lagrer.','error');return}
  try{sanitize()}catch(error){notify(error.message,true);return}
  const version=Math.max(Date.now(),Number(state.original.updatedAt||0)+1);
  const delta=buildDelta(state.original,state.menu);
  const previousVersion=Number(state.original.updatedAt)||0;
  // No menu data is lost: the original complete menu is preserved and mutated.
  const next=clone(state.menu);
  next.updatedAt=version;
  next.changeFeed=next.changeFeed&&typeof next.changeFeed==='object'?next.changeFeed:{};
  next.changeFeed.latest={version,previousVersion,changes:delta.changes,requiresRefresh:delta.requiresRefresh};
  state.saving=true;$('btnSave').disabled=true;
  try{
   const response=await fetch(await menuURL(),{method:'PUT',headers:{'Content-Type':'application/json','if-match':state.etag},body:JSON.stringify(next),cache:'no-store'});
   if(response.status===412)throw Error('En annen administrator endret menyen. Ingen data ble overskrevet. Hent siste meny og legg inn endringene på nytt.');
   if(response.status===401||response.status===403)throw Error('Firebase avviste skriving. Kontroller admin UID og Database Rules.');
   if(!response.ok)throw Error('Kunne ikke lagre til Firebase: HTTP '+response.status);
   state.menu=next;state.original=clone(next);
   // New ETag is usually included, otherwise safely GET a fresh ETag before another save.
   let etag=response.headers.get('ETag');
   if(!etag){
    const fresh=await fetch(await menuURL(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
    if(fresh.ok){etag=fresh.headers.get('ETag');if(etag){const latest=await fresh.json();state.original=clone(latest);state.menu=latest}}
   }
   state.etag=etag||null;setClean();renderAll();refreshHeader();
   notify('Lagret i Firebase · BETA varsles automatisk');
   if(!etag)message('Lagret, men ETag kunne ikke leses. Hent siste meny før neste endring.','warn');
  }catch(error){message(error.message||'Lagring feilet','error');notify(error.message||'Lagring feilet',true)}
  finally{state.saving=false;$('btnSave').disabled=!state.dirty||!state.etag}
 }
 function handleEvents(){
 $('authForm').addEventListener('submit',login);
 $('btnSignOut').addEventListener('click',async()=>{
  if(state.dirty&&!confirm('Forkast ulagrede endringer og logg ut?'))return;
  await auth?.signOut();state.menu=null;state.etag=null;state.original=null;state.dirty=false;showLogin();
 });
  $('btnRetry').addEventListener('click',()=>{void startAdmin()});
  for(const [id,kind] of [['btnCloseProductModal','product'],['btnCloseProductBottom','product'],['productModalBackdrop','product'],['btnCloseGroupModal','group'],['btnCloseGroupBottom','group'],['groupModalBackdrop','group']]){
   $(id).addEventListener('click',()=>{if(activeAdminModal===kind)closeAdminModal()});
  }
  $('btnSaveProductModal').addEventListener('click',()=>{void saveAdminModal('product')});
  $('btnSaveGroupModal').addEventListener('click',()=>{void saveAdminModal('group')});
  $('btnDuplicateProductModal').addEventListener('click',duplicateProduct);
  $('btnRemoveProductModal').addEventListener('click',removeProduct);
  $('productEditor').querySelectorAll('[data-product-tab]').forEach(button=>
   button.addEventListener('click',()=>setAdminModalTab('product',button.dataset.productTab)));
  $('groupEditor').querySelectorAll('[data-group-tab]').forEach(button=>
   button.addEventListener('click',()=>setAdminModalTab('group',button.dataset.groupTab)));
  document.addEventListener('keydown',modalKeyboard);

  $('btnSave').addEventListener('click',save);
  $('btnReload').addEventListener('click',()=>loadMenu().then(ok=>{if(ok)notify('Siste meny er hentet')}).catch(e=>notify(e.message,true)));
  $('btnUndo').addEventListener('click',()=>{if(!state.original||!confirm('Forkast alle ulagrede endringer?'))return;
   state.menu=clone(state.original);state.category=0;state.product=0;state.group=0;renderAll();setClean()});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('categoryList').addEventListener('click',event=>{
   const button=event.target.closest('[data-category]');if(!button)return;
   const i=Number(button.dataset.category);
   if(i===state.category){editCategory();return}
   state.category=i;state.product=0;renderCategories();renderProducts();renderProductEditor();
  });
  $('productList').addEventListener('click',event=>{
   const button=event.target.closest('[data-product]');if(!button)return;
   state.product=Number(button.dataset.product);renderProducts();renderProductEditor();openAdminModal('product');
  });
  $('groupList').addEventListener('click',event=>{
   const button=event.target.closest('[data-group]');if(!button)return;
   state.group=Number(button.dataset.group);renderGroups();renderGroupEditor();openAdminModal('group');
  });
  $('productSearch').addEventListener('input',renderProducts);
  $('groupSearch').addEventListener('input',renderGroups);
  $('addCategory').addEventListener('click',addCategory);
  $('renameCategory').addEventListener('click',editCategory);
  $('moveCategoryUp').addEventListener('click',()=>changeCategory(-1));
  $('moveCategoryDown').addEventListener('click',()=>changeCategory(1));
  $('removeCategory').addEventListener('click',removeCategory);
  $('addProduct').addEventListener('click',addProduct);
  $('moveProductUp').addEventListener('click',()=>changeProduct(-1));
  $('moveProductDown').addEventListener('click',()=>changeProduct(1));
  $('duplicateProduct').addEventListener('click',duplicateProduct);
  $('removeProduct').addEventListener('click',removeProduct);
  for(const [id,key]of [['pName','name'],['pDescription','description']])
   $(id).addEventListener('input',event=>updateItemField(key,event.target.value));
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
   p.sizes.push({id:uid('size'),label:'Ny størrelse',price:0,optionGroupIds:[]});
   renderSizes();setDirty();
  });
  $('addGroup').addEventListener('click',addGroup);
  $('deleteGroup').addEventListener('click',deleteGroup);
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