/* KØL BETA menu administrator. Inspired by DEMO product/choices editors.
 * Only kol-grill-pizza-1 RTDB /menu is read/written. No customers/orders/settings.
 * Direct REST connection (no login); Firebase Rules determine write permissions.
 */
'use strict';
(()=>{
 const DB='https://kol-grill-pizza-1-default-rtdb.firebaseio.com';
 const $=id=>document.getElementById(id);
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
 function menuURL(){return DB+'/menu.json'}
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
  const response=await fetch(menuURL(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
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
    (p.soldOut?' · Utsolgt':'')+(p.hidden?' · Skjult':'')+'</small></span><span aria-hidden="true">›</span></button>';
  }).join(''):'<p class="empty">Velg en kategori</p>';
 }
 function sizeLabel(size){
  return size.label||state.menu.sizeLabels?.[size.labelId]||size.name||String(size.id||'Størrelse');
 }
 function renderSizes(){
  const p=product(),sizes=arr(p.sizes),groups=state.menu.optionGroups;
  $('sizeRows').innerHTML=sizes.map((size,i)=>{
   const html='<div class="size-row"><input aria-label="Størrelsesnavn" data-size-name="'+i+'" value="'+esc(sizeLabel(size))+'"><input type="number" min="0" max="99999" step="1" aria-label="Pris i kroner" data-size-price="'+i+'" value="'+esc(size.price??0)+'"><button type="button" data-size-remove="'+i+'" aria-label="Slett størrelse">×</button></div>';
   const assigned=arr(size.optionGroupIds).map(String);
   return '<div class="group-card">'+html+'<details><summary style="font-size:12px;cursor:pointer">Valggrupper bare for denne størrelsen</summary><div class="stack compact">'+groups.map(g=>'<label class="checkbox"><input type="checkbox" data-size-group="'+i+'" value="'+esc(g.id)+'"'+(assigned.includes(String(g.id))?' checked':'')+'> '+esc(g.title||g.id)+'</label>').join('')+'</div></details></div>';
  }).join('')||'<p class="empty">Ingen størrelser. Legg til en størrelse.</p>';
 }
 function renderAssignedGroups(){
  const p=product(),selected=arr(p.optionGroupIds).map(String),ids=usedGroupIds(p),order=[...new Set([...arr(p.optionGroupOrder).map(String).filter(id=>ids.includes(id)),...ids])];
  const library=state.menu.optionGroups;
  $('assignedGroups').innerHTML=library.map(g=>{
   const id=String(g.id),orderIdx=order.indexOf(id),inSizes=arr(p.sizes).some(s=>arr(s.optionGroupIds).map(String).includes(id));
   return '<div class="pill-row"><label class="checkbox" style="flex:1"><input type="checkbox" data-product-group="'+esc(id)+'"'+(selected.includes(id)?' checked':'')+'>'+esc(g.title||g.id)+(inSizes?' <small>(størrelse)</small>':'')+'</label>'+
    (orderIdx>=0?'<span style="font-size:11px;color:#728979">'+(orderIdx+1)+'</span><button type="button" class="mini" data-order-id="'+esc(id)+'" data-order-step="-1" aria-label="Flytt opp">↑</button><button type="button" class="mini" data-order-id="'+esc(id)+'" data-order-step="1" aria-label="Flytt ned">↓</button>':'')+'</div>';
  }).join('');
 }
 function renderProductEditor(){
  const p=product();$('productFields').hidden=!p;
  if(!p){$('productEditorTitle').textContent='Velg et produkt';return}
  $('productEditorTitle').textContent=p.name||'Nytt produkt';
  $('pName').value=p.name||'';$('pDescription').value=p.description||'';$('pIngredients').value=p.ingredients||'';
  $('pKitchenNotes').value=arr(p.quickKitchenNotes).join('\n');
  renderAllergenChoices();
  $('pImage').value=productImage(p);$('pPreviewName').textContent=p.name||'Produktbilde';
  const img=$('pPreview');img.src=productImage(p)||'';img.hidden=!productImage(p);
  $('pSoldOut').checked=p.soldOut===true;$('pHidden').checked=p.hidden===true;
  $('pPopular').checked=arr(state.menu.popularItemIds).some(id=>String(id)===String(p.id));
  renderSizes();renderAssignedGroups();
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
    '<input type="number" min="0" max="99999" aria-label="Tilleggspris" data-option-price="'+i+'" value="'+esc(o.price??0)+'">'+
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
 function productGroupIds(){
  const p=product();return [...new Set([...arr(p.optionGroupIds),...arr(p.sizes).flatMap(size=>arr(size.optionGroupIds))].map(String))];
 }
 function normalizeProductOrder(){
  const p=product(),allowed=productGroupIds();
  p.optionGroupOrder=[...new Set([...arr(p.optionGroupOrder).map(String).filter(id=>allowed.includes(id)),...allowed])];
 }
 function selectProductGroup(id,checked){
  const p=product();if(!p)return;
  const selected=arr(p.optionGroupIds).map(String);
  p.optionGroupIds=checked?[...new Set([...selected,id])]:selected.filter(x=>x!==id);
  normalizeProductOrder();renderAssignedGroups();setDirty();
 }
 function moveProductGroup(id,step){
  const p=product();if(!p)return;
  normalizeProductOrder();let index=p.optionGroupOrder.indexOf(id);
  if(moveIn(p.optionGroupOrder,index,step)){renderAssignedGroups();setDirty()}
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
  $('pName').focus();
 }
 function duplicateProduct(){
  const s=category(),p=product();if(!s||!p)return;
  const duplicated=clone(p);duplicated.id=uid('product');duplicated.name=(p.name||'Produkt')+' (kopi)';
  s.items.splice(state.product+1,0,duplicated);state.product++;renderProducts();renderProductEditor();setDirty();
 }
 function removeProduct(){
  const s=category(),p=product();if(!s||!p)return;
  if(!confirm('Slette produktet '+p.name+'? Endringen lagres først når du trykker Lagre.'))return;
  s.items.splice(state.product,1);state.product=Math.min(state.product,s.items.length-1);
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>String(id)!==String(p.id));
  renderProducts();renderProductEditor();setDirty();
 }
 function removeCategory(){
  const s=category();if(!s||!confirm('Slette hele '+s.title+' og alle produktene?'))return;
  const ids=new Set(s.items.map(p=>String(p.id)));state.menu.sections.splice(state.category,1);
  if(Array.isArray(state.menu.popularItemIds))state.menu.popularItemIds=state.menu.popularItemIds.filter(id=>!ids.has(String(id)));
  state.category=Math.max(0,Math.min(state.category,state.menu.sections.length-1));state.product=0;
  renderAll();setDirty();
 }
 function addGroup(){
  const g={id:uid('group'),title:'Ny valggruppe',selectionMode:'single',required:false,maxSelections:1,allowQuantity:false,defaultOptionIds:[],options:[]};
  state.menu.optionGroups.push(g);state.group=state.menu.optionGroups.length-1;renderGroups();renderGroupEditor();setDirty();$('gTitle').focus();
 }
 function deleteGroup(){
  const g=group();if(!g||!confirm('Slette valggruppen '+g.title+' fra alle produkter?'))return;
  const id=String(g.id);
  state.menu.optionGroups.splice(state.group,1);
  for(const section of state.menu.sections)for(const p of section.items){
   p.optionGroupIds=arr(p.optionGroupIds).filter(v=>String(v)!==id);
   p.optionGroupOrder=arr(p.optionGroupOrder).filter(v=>String(v)!==id);
   for(const size of arr(p.sizes))size.optionGroupIds=arr(size.optionGroupIds).filter(v=>String(v)!==id);
  }
  state.group=Math.min(state.group,state.menu.optionGroups.length-1);
  renderGroups();renderGroupEditor();renderAssignedGroupsIfVisible();setDirty();
 }
 function renderAssignedGroupsIfVisible(){if(product())renderAssignedGroups()}
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
    for(const size of arr(p.sizes)){if(!Number.isFinite(Number(size.price))||Number(size.price)<0)throw Error('Ugyldig pris: '+p.name)}
   }
  }
  for(const g of menu.optionGroups){
   if(!String(g.title||'').trim())throw Error('En valggruppe mangler navn.');
   if(groupIds.has(String(g.id)))throw Error('Duplisert valggruppe-ID.');groupIds.add(String(g.id));
   const ids=new Set();
   for(const o of arr(g.options)){
    if(!String(o.label||'').trim())throw Error('Et alternativ mangler navn i '+g.title);
    if(ids.has(String(o.id)))throw Error('Duplisert alternativ-ID i '+g.title);
    ids.add(String(o.id));
    if(!Number.isFinite(Number(o.price))||Number(o.price)<0)throw Error('Ugyldig alternativpris i '+g.title);
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
   const response=await fetch(menuURL(),{method:'PUT',headers:{'Content-Type':'application/json','if-match':state.etag},body:JSON.stringify(next),cache:'no-store'});
   if(response.status===412)throw Error('En annen administrator endret menyen. Ingen data ble overskrevet. Hent siste meny og legg inn endringene på nytt.');
   if(response.status===401||response.status===403)throw Error('Firebase avviste skriving. /menu må tillate skriving uten innlogging i Database Rules.');
   if(!response.ok)throw Error('Kunne ikke lagre til Firebase: HTTP '+response.status);
   state.menu=next;state.original=clone(next);
   // New ETag is usually included, otherwise safely GET a fresh ETag before another save.
   let etag=response.headers.get('ETag');
   if(!etag){
    const fresh=await fetch(menuURL(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
    if(fresh.ok){etag=fresh.headers.get('ETag');if(etag){const latest=await fresh.json();state.original=clone(latest);state.menu=latest}}
   }
   state.etag=etag||null;setClean();renderAll();refreshHeader();
   notify('Lagret i Firebase · BETA varsles automatisk');
   if(!etag)message('Lagret, men ETag kunne ikke leses. Hent siste meny før neste endring.','warn');
  }catch(error){message(error.message||'Lagring feilet','error');notify(error.message||'Lagring feilet',true)}
  finally{state.saving=false;$('btnSave').disabled=!state.dirty||!state.etag}
 }
 function handleEvents(){
  $('btnRetry').addEventListener('click',()=>{void startAdmin()});
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
   state.product=Number(button.dataset.product);renderProducts();renderProductEditor();
  });
  $('groupList').addEventListener('click',event=>{
   const button=event.target.closest('[data-group]');if(!button)return;
   state.group=Number(button.dataset.group);renderGroups();renderGroupEditor();
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
  for(const [id,key]of [['pName','name'],['pDescription','description'],['pIngredients','ingredients']])
   $(id).addEventListener('input',event=>updateItemField(key,event.target.value));
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
  $('sizeRows').addEventListener('input',event=>{
   const p=product(),t=event.target;if(!p)return;
   if(t.matches('[data-size-name]')){const size=p.sizes[Number(t.dataset.sizeName)];size.label=t.value;delete size.labelId;setDirty()}
   if(t.matches('[data-size-price]')){p.sizes[Number(t.dataset.sizePrice)].price=Number(t.value);setDirty();renderProducts()}
  });
  $('sizeRows').addEventListener('change',event=>{
   const t=event.target;
   if(!t.matches('[data-size-group]'))return;
   const size=product()?.sizes?.[Number(t.dataset.sizeGroup)];if(!size)return;
   let ids=arr(size.optionGroupIds).map(String);
   size.optionGroupIds=t.checked?[...new Set([...ids,t.value])]:ids.filter(x=>x!==t.value);
   normalizeProductOrder();renderAssignedGroups();setDirty();
  });
  $('sizeRows').addEventListener('click',event=>{
   const t=event.target.closest('[data-size-remove]');if(!t)return;
   const p=product();p.sizes.splice(Number(t.dataset.sizeRemove),1);
   normalizeProductOrder();renderSizes();renderAssignedGroups();setDirty();
  });
  $('addSize').addEventListener('click',()=>{
   const p=product();if(!p)return;
   p.sizes=arr(p.sizes);p.sizes.push({id:uid('size'),label:'Ny størrelse',price:0,optionGroupIds:[]});
   renderSizes();setDirty();
  });
  $('assignedGroups').addEventListener('change',event=>{
   const input=event.target.closest('[data-product-group]');if(input)selectProductGroup(input.dataset.productGroup,input.checked);
  });
  $('assignedGroups').addEventListener('click',event=>{
   const button=event.target.closest('[data-order-id]');if(button)moveProductGroup(button.dataset.orderId,Number(button.dataset.orderStep));
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
 void startAdmin();
})();