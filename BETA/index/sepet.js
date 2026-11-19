/* FATIH1 basket feature: cart storage, item handling, suggestions and presentation.
 * Loaded before app.js; shared functions use the page's existing global state.
 */
'use strict';
const CART_KEY='kol-beta-cart-v1';
let cart=loadCart(),editingCartIndex=null;
const calculateCartTotal=items=>items.reduce((sum,line)=>sum+(Number(line.qty)||0)*(Number(line.unitPrice)||0),0);
function loadCart(){try{const c=JSON.parse(localStorage.getItem(CART_KEY));return Array.isArray(c)?c:[]}catch{return []}}
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}renderCartIndicators();updateCartBadges()}

function addToCart(){
 if(!current||$('productSheet').classList.contains('is-sheet-closing'))return;
 if(!productById(current.id)){
  showFatih1Toast('Produktet er ikke lenger tilgjengelig','error');
  closeProductSheet();
  return;
 }
 const availability=getOrderingState();
 const error=optionValidation();
 if(error){
  renderOptions();
  const notice=$('sheetOrderNotice');notice.hidden=false;notice.textContent=error;showFatih1Toast(error,'error');return;
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
 saveCart();
 // Keep the sheet visible until the same 260 ms downward close finishes.
 // Editing returns to the basket; regular adds return to menu, or basket if closed.
 closeProductSheet(()=>{
  if(edited&&fatih1HistoryState()?.view==='product')fatih1HistoryBack();
  else if(!availability.orderable){
   fatih1HistoryWrite({view:'cart',step:'cart'},true);
   hideAll();showCart();
  }else fatih1HistoryToMenu();
 });
 showFatih1Toast(entry.name+(edited?' oppdatert i handlekurven':' lagt i handlekurven'));
}
function renderCartIndicators(){const n=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0);$('cartCount').hidden=!n;$('cartCount').textContent=n}
// Cart-specific menu data and screen integration live in sepet.js.
function normalizeCartSuggestionRules(value){
 return list(value).map(x=>typeof x==='object'?(x.id??x.value):x).filter(Boolean);
}
function cleanupRetiredCartStorage(){
 try{
  for(const key of ['kol-beta-cart-suggestions-once-v1','kol-beta-cart-dismissed-v1']){
   if(localStorage.getItem(key)!==null)localStorage.removeItem(key);
  }
 }catch{}
}
function cartBadgeMarkup(id){
 const amount=cartQuantityForProduct(id);
 return amount?'<span class="in-cart">🛒 '+amount+' i kurven</span>':'';
}
function refreshCartRecommendationsIfOpen(){
 if(!$('cartSheet').hidden)renderCartRecommendations();
}
function refreshCartAfterMenuRender(){
 renderCartIndicators();
 const review=reconcileCartWithMenu();
 if(!$('cartSheet').hidden){
  renderCartContents();
  if(review.repriced)showFatih1Toast('Prisene i handlekurven er oppdatert','info');
 }
}
function updateCartRestaurantBrand(name){
 const node=$('cartRestaurantName');
 if(node)node.textContent=name;
}
function resetCartEditState(){editingCartIndex=null}
function restoreCartEditFromIndex(index){
 if(index!==null&&cart[index])restoreCartLineForEdit(cart[index],index);
}
function cartProductHistoryEditIndex(){return editingCartIndex}
function cartHistoryView(id){
 return id==='cartSheet'?{view:'cart',step:'cart'}:null;
}
function restoreCartHistoryState(state){
 showCart();
 if(state.step&&state.step!=='cart')checkoutNavigate(state.step);
}
function hideCartSheet(){$('cartSheet').hidden=true}
function shouldCartGoBackOnEscape(){
 return !$('cartSheet').hidden&&checkoutStep!=='cart';
}
// Show all eligible products selected by the administrator (maximum ten).
// Preserve the admin's configured order and omit unavailable/already-added items.
function suggestedCartItems(){
 if(!menu||!cart.length)return [];
 const included=new Set(cart.map(line=>String(line.id)));
 const products=new Map(list(menu.sections).filter(section=>section.hidden!==true)
  .flatMap(section=>list(section.items).map(item=>[String(item.id),item])));
 const ids=normalizeCartSuggestionRules(menu.cartSuggestionRules);
 const selected=[],seen=new Set();
 for(const rawId of ids){
  const id=String(rawId);
  if(seen.has(id))continue;
  seen.add(id);
  const item=products.get(id);
  if(!item||included.has(id)||item.hidden||item.soldOut)continue;
  selected.push({item});
  if(selected.length>=10)break;
 }
 return selected;
}
// Only one tiny Firebase GET per page session, on first cart opening.
// Reconcile any outdated IndexedDB menu cache without fetching /menu again.
let fatih1SuggestionChecked=false,fatih1SuggestionPending=null;
async function refreshCartSuggestionIdsOnce(){
 if(fatih1SuggestionChecked||fatih1SuggestionPending||!menu||navigator.onLine===false)return fatih1SuggestionPending;
 fatih1SuggestionPending=(async()=>{
  try{
   const response=await fetch(BASE+'/menu/cartSuggestionRules.json',{cache:'no-store'});
   if(!response.ok)throw Error('Firebase recommendations HTTP '+response.status);
   const data=await response.json();
   const ids=Array.isArray(data)?data:data&&typeof data==='object'?
    Object.keys(data).sort((a,b)=>Number(a)-Number(b)).map(key=>data[key]):[];
   const unique=[...new Set(ids.filter(id=>id!==null&&id!==undefined).map(String))].slice(0,10);
   const previous=Array.isArray(menu.cartSuggestionRules)?menu.cartSuggestionRules.map(String):[];
   if(JSON.stringify(previous)!==JSON.stringify(unique)){
    menu.cartSuggestionRules=unique;
    try{await localPut(menu)}catch{}
    if(!$('cartSheet').hidden)renderCartRecommendations();
   }
   fatih1SuggestionChecked=true;
  }catch(error){console.warn('BestillOnline cart recommendation refresh:',error)}
  finally{fatih1SuggestionPending=null}
 })();
 return fatih1SuggestionPending;
}
function renderCartRecommendations(){
 const host=$('cartRecommendations'),items=$('cartRecommendationsItems');
 const disclosure=$('cartSuggestionsDisclosure');
 const thumbnails=$('cartSuggestionsThumbnails'),count=$('cartSuggestionsCount'),action=$('cartSuggestionsAction');
 const suggestions=suggestedCartItems();
 host.hidden=!suggestions.length;
 if(!suggestions.length){
  disclosure.open=false;
  thumbnails.replaceChildren();
  items.replaceChildren();
  count.textContent='';
  action.textContent='Vis alle';
  return;
 }
 const preview=suggestions.slice(0,4);
 thumbnails.innerHTML=preview.map(({item})=>
  '<span class="cart-suggestion-thumb">'+imgEl(item.imageUrl,item.name,'suggestion-photo')+'</span>'
 ).join('');
 count.textContent=suggestions.length+' forslag';
 action.textContent=disclosure.open?(suggestions.length>4?'Bla i listen':'Vis mindre'):'Vis alle';
 thumbnails.querySelectorAll('img[data-image]').forEach(img=>void setCachedImage(img,img.dataset.image));
 // Do not build or fetch full-size suggestions until the guest asks to see them.
 if(!disclosure.open){items.replaceChildren();return}
 items.innerHTML=suggestions.map(({item})=>'<article class="cart-recommendation">'+
  '<div class="cart-suggestion-image">'+imgEl(item.imageUrl,'','suggestion-photo')+'</div>'+
  '<div class="cart-recommendation-copy"><strong>'+esc(item.name)+'</strong><span>'+money(basePrice(item))+'</span></div>'+
  '<button type="button" class="cart-suggest-add" data-suggest-add="'+esc(item.id)+'" aria-label="Legg til '+esc(item.name)+'">+</button>'+
  '</article>').join('');
 items.querySelectorAll('img[data-image]').forEach(img=>void setCachedImage(img,img.dataset.image));
}
const cartTrashIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
const cartEditIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 4 4 4-9.4 9.4-4.1 1.1 1.1-4.1L17 5a2.1 2.1 0 0 1 3 3"/></svg>';
function cartLineDetails(line){
 const rows=[],price=Number(line.unitPrice)||0;
 // The size line shows the base price; paid extras are listed separately.
 const extras=(line.choices||[]).reduce((sum,group)=>sum+(group.options||[]).reduce((n,opt)=>n+(Number(opt.price)||0)*Math.max(1,Number(opt.count)||1),0),0);
 const sizePrice=price-extras;
 const size=line.size?.label||'Standard';
 // One size row per cart line, irrespective of quantity. The Sum row
 // already multiplies the item price by the quantity.
 rows.push('<div class="cart-line-detail"><span><b>Størrelse:</b> '+esc(size)+'</span><strong>'+money(sizePrice)+'</strong></div>');
 for(const group of line.choices||[]){
  for(const option of group.options||[]){
   const count=Math.max(1,Number(option.count)||1);
   const label=(count>1?count+'× ':'')+String(option.label||'');
   const optionPrice=Number(option.price)||0;
   const priceText=optionPrice>0?'+ '+money(optionPrice)+(count>1?' / stk':''):optionPrice<0?money(optionPrice):'Inkludert';
   rows.push('<div class="cart-line-detail"><span><b>'+esc(group.group||'Valg')+':</b> '+esc(label)+'</span><small>'+priceText+'</small></div>');
  }
 }
 if((line.removedIngredients||[]).length)
  rows.push('<div class="cart-line-detail is-alert"><span><b>Uten:</b> '+esc(line.removedIngredients.join(', '))+'</span></div>');
 if(line.comment){
  const comment=String(line.comment).split(/\r?\n/).map(note=>note.trim()).filter(Boolean).join(' · ');
  if(comment)rows.push('<div class="cart-line-detail is-alert"><span><b>Kommentar:</b> '+esc(comment)+'</span></div>');
 }
 return rows.join('');
}
// FATIH1: recalculate local cart prices from the current menu. Never discard
// existing selections: removed products/options must be corrected by the guest.
let cartMenuIssues=[],cartPricesChanged=false;
function reconcileCartWithMenu(){
 if(!menu||!Array.isArray(menu.sections))return {issues:[],repriced:false};
 let changed=false,repriced=false;
 const issues=[];
 const write=(obj,key,value)=>{if(obj[key]!==value){obj[key]=value;changed=true}};
 for(let index=0;index<cart.length;index++){
  const line=cart[index];
  const issue=reason=>issues.push({index,reason});
  if(!line||typeof line!=='object'){issue('Ugyldig vare i handlekurven');continue}
  const item=productById(line.id);
  if(!item||item.hidden||item.soldOut){issue('Produktet er ikke lenger tilgjengelig');continue}
  const sizes=list(item.sizes),size=sizes.find(x=>String(x.id)===String(line.size?.id));
  if(sizes.length&&!size){issue('Størrelsen er endret eller fjernet');continue}
  let price=Number(size?.price??item.price),invalid='';
  if(!Number.isFinite(price)||price<0){issue('Produktprisen må kontrolleres');continue}
  const groups=groupsFor(item,size),allowed=new Map(groups.map(g=>[String(g.id),g]));
  const chosen=Array.isArray(line.choices)?line.choices:[];
  const seen=new Set(),updates=[];
  for(const cg of chosen){
   const group=allowed.get(String(cg.groupId));
   if(!group||seen.has(String(group.id))){invalid='Et tidligere tilvalg finnes ikke lenger';break}
   seen.add(String(group.id));
   let countTotal=0;
   const optionUpdates=[];
   for(const co of (Array.isArray(cg.options)?cg.options:[])){
    const option=list(group.options).find(o=>String(o.id)===String(co.id));
    const n=Number(co.count??1),p=Number(option?.price??0);
    if(!option||option.soldOut||!Number.isInteger(n)||n<1||(!group.allowQuantity&&n>1)){
     invalid='Et valgt tillegg er endret eller utsolgt';break;
    }
    if(!Number.isFinite(p)){invalid='Tilleggsprisen må kontrolleres';break}
    price+=p*n;countTotal+=n;
    optionUpdates.push({target:co,label:option.label||option.name||'',price:p});
   }
   if(invalid)break;
   if(countTotal>Math.max(1,Number(group.maxSelections)||1)||
      (group.selectionMode!=='multiple'&&countTotal>1)){
    invalid='Antall tilvalg er ikke lenger gyldig';break;
   }
   updates.push({target:cg,label:group.title||'',options:optionUpdates});
  }
  if(!invalid)for(const group of groups){
   if(!group.required)continue;
   const cg=chosen.find(x=>String(x.groupId)===String(group.id));
   const n=(cg?.options||[]).reduce((sum,x)=>sum+(Number(x.count)||1),0);
   if(n<Math.max(1,Number(group.minSelections)||1)){invalid='Et påkrevd tilvalg mangler';break}
  }
  if(!invalid&&(!Number.isFinite(price)||price<0))invalid='Prisen må kontrolleres';
  if(invalid){issue(invalid);continue}
  if(Number(line.unitPrice)!==price){repriced=true;write(line,'unitPrice',price)}
  write(line,'name',item.name);
  if(size&&line.size)write(line.size,'label',size.label||size.name||'');
  for(const group of updates){
   write(group.target,'group',group.label);
   for(const option of group.options){
    write(option.target,'label',option.label);write(option.target,'price',option.price);
   }
  }
 }
 cartMenuIssues=issues;
 if(repriced)cartPricesChanged=true;
 if(changed)saveCart();
 return {issues,repriced};
}
// The menu's real category order determines display order; the saved cart
// remains untouched so edit, plus/minus and remove still use original indices.
function sortedCartEntries(){
 const categoryRank=new Map();
 const sections=Array.isArray(menu?.sections)?menu.sections:[];
 sections.forEach((section,rank)=>{
  for(const item of list(section?.items)){
   const id=String(item?.id);
   if(!categoryRank.has(id))categoryRank.set(id,rank);
  }
 });
 const afterCategories=sections.length;
 return cart.map((line,index)=>({line,index,rank:categoryRank.get(String(line?.id))??afterCategories}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index);
}
function renderCartContents(){
 const review=reconcileCartWithMenu();
 const total=cart.reduce((sum,x)=>sum+(Number(x.qty)||0)*(Number(x.unitPrice)||0),0);
 $('cartTotal').textContent=review.issues.length?'Kontroller varer':money(total);
 $('cartFooterAmount').textContent=review.issues.length?'Kontroller':money(total);
 const warning=$('cartPriceNotice');
 warning.hidden=!review.issues.length&&!cartPricesChanged;
 warning.textContent=review.issues.length?'Varer er endret eller ikke tilgjengelige. Rediger eller fjern dem før du fortsetter.':
  cartPricesChanged?'Prisene er oppdatert etter endringer i menyen.':'';
 $('cartNext').disabled=!cart.length||!!review.issues.length;
 const cartTopQuantity=cart.reduce((sum,x)=>sum+(Number(x.qty)||0),0);
 $('cartTopCount').textContent=cartTopQuantity;
 $('cartTopCount').hidden=cartTopQuantity===0;
 $('cartClear').hidden=!cart.length;
 $('cartSummary').hidden=!cart.length;
 $('cartItems').innerHTML=cart.length?sortedCartEntries().map(({line,index})=>{
  const issue=cartMenuIssues.find(entry=>entry.index===index);
  return '<article class="cart-product-card" data-cart-line="'+index+'">'+
   '<div class="cart-product-heading"><div class="cart-product-copy"><strong class="cart-product-name">'+esc(line.name)+'</strong>'+
   '<button type="button" class="cart-product-edit" data-edit="'+index+'" aria-label="Endre '+esc(line.name)+'" title="Endre produkt">'+cartEditIcon+'</button></div>'+
   '<div class="cart-product-stepper"><button data-cart-minus="'+index+'" aria-label="'+(Number(line.qty)>1?'Reduser antall':'Fjern produkt')+'">'+(Number(line.qty)>1?'−':cartTrashIcon)+'</button><b>'+line.qty+'</b><button data-cart-plus="'+index+'" aria-label="Øk antall">+</button></div></div>'+
   '<div class="cart-product-details">'+cartLineDetails(line)+'</div>'+
   (issue?'<p class="cart-line-warning" role="alert">'+esc(issue.reason)+' · Endre eller fjern varen.</p>':'')+
   '<div class="cart-product-totalrow"><span>Sum</span><strong>'+
   (issue?'Må kontrolleres':money(line.qty*line.unitPrice))+
   '</strong></div></article>';
 }).join(''):'<div class="cart-empty"><span>🛒</span><strong>Handlekurven er tom</strong><p>Velg noe godt fra menyen.</p></div>';
 renderCartRecommendations();
 $('cartItems').querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}

// One shared source of details for the basket and final pickup review.
function pickupSummary(){
 // Same cart product card and detail renderer as the basket, read-only here.
 const count=cart.reduce((sum,line)=>sum+(Number(line.qty)||0),0);
 $('draftPickupItemCount').textContent=count+' '+(count===1?'vare':'varer');
 $('draftPickupOrderItems').innerHTML=sortedCartEntries().map(({line})=>{
  const qty=Number(line.qty)||0;
  return '<article class="cart-product-card draft-pickup-product">'+
   '<div class="cart-product-heading"><div class="cart-product-copy">'+
   '<strong class="cart-product-name">'+esc(line.name)+' × '+qty+'</strong>'+
   '</div></div>'+
   '<div class="cart-product-details">'+cartLineDetails(line)+'</div>'+
   '<div class="cart-product-totalrow"><span>Sum'+(qty>1?' ('+qty+' × '+money(line.unitPrice)+')':'')+
   '</span><strong>'+money(qty*(Number(line.unitPrice)||0))+'</strong></div>'+
   '</article>';
 }).join('')+
 '<div class="draft-pickup-line is-total"><strong>Totalt</strong><strong>'+money(calculateCartTotal(cart))+'</strong></div>';
}
function showCart(){$('cartSuggestionsDisclosure').open=false;renderCartContents();show('cartSheet');checkoutNavigate('cart');updateOrderingControls();void refreshCartSuggestionIdsOnce()}

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
 // Reopen ingredient customization when editing a cart item with removals.
 // Fresh product sheets still start with this section collapsed.
 ingredientEditorExpanded=removedIngredients.size>0;
 const allowed=kitchenNotesFor(current);
 selectedKitchenNotes=new Set((line.quickNotes||[]).filter(n=>allowed.includes(n)));
 const raw=String(line.comment||'');
 $('comment').value=raw.split('\n').filter(x=>!selectedKitchenNotes.has(x)).join('\n');
 renderOptions();
 $('add').firstChild.textContent='Oppdater kurven ';
}

function closeProductSheet(onClosed=null){
 editingCartIndex=null;
 const sheet=$('productSheet');
 if(!sheet||sheet.hidden||sheet.classList.contains('is-sheet-closing'))return;
 const finishNavigation=()=>{if(typeof onClosed==='function')onClosed();else fatih1HistoryBack()};
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  sheet.classList.remove('is-sheet-opening','is-dragging','is-drag-settling');
  sheet.style.removeProperty('--product-drag-y');
  finishNavigation();
  return;
 }
 sheet.classList.remove('is-sheet-opening','is-dragging','is-drag-settling');
 sheet.classList.add('is-sheet-closing');
 let finished=false;
 const finish=()=>{
  if(finished)return;
  finished=true;
  sheet.removeEventListener('animationend',onEnd);
  // Only navigate if this is still the closing sheet, not a later screen.
  if(!sheet.hidden&&sheet.classList.contains('is-sheet-closing'))finishNavigation();
 };
 const onEnd=event=>{
  if(event.target===sheet&&event.animationName==='fatih1SheetFall')finish();
 };
 sheet.addEventListener('animationend',onEnd);
 // Animation events can be dropped when a browser suspends or backgrounds a tab.
 window.setTimeout(finish,370);
}
function updateCartQuantityControls(){
 const cartPanel=$('cartSheet');
 if(cartPanel&&!cartPanel.hidden)cartPanel.querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}
function cartQuantityForProduct(id){
 return cart.reduce((sum,line)=>sum+(String(line.id)===String(id)?Number(line.qty||0):0),0);
}
function initCartEvents(){
$('plus').onclick=()=>{qty++;$('quantity').textContent=qty;updatePrice();showFatih1Toast('Antall økt til '+qty)};$('minus').onclick=()=>{if(qty<=1)return;qty--;$('quantity').textContent=qty;updatePrice();showFatih1Toast('Antall redusert til '+qty)};
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
 const line=cart[index],name=line.name,previous=Number(line.qty)||0;
 let message='';
 if(remove){cart.splice(index,1);message=name+' fjernet fra handlekurven'}
 else if(plus){
  line.qty=Math.min(99,previous+1);
  if(line.qty===previous)return;
  message=name+': '+line.qty+' i handlekurven';
 }else if(minus){
  line.qty=previous-1;
  if(line.qty<=0){cart.splice(index,1);message=name+' fjernet fra handlekurven'}
  else message=name+': '+line.qty+' i handlekurven';
 }
 saveCart();renderCartContents();
 showFatih1Toast(message);
});
$('cartSuggestionsDisclosure').addEventListener('toggle',()=>{
 renderCartRecommendations();
 const panel=$('cartSuggestionsDisclosure');
 if(!panel.open)return;
 // Scroll the cart's own viewport after the expanded choices have been laid out.
 // Keep the preview heading visible at the top so the guest sees the new options.
 requestAnimationFrame(()=>{
  if(!panel.open||$('cartSheet').hidden)return;
  const viewport=$('cartScroll');
  const offset=panel.getBoundingClientRect().top-viewport.getBoundingClientRect().top;
  const target=Math.max(0,Math.min(
   viewport.scrollHeight-viewport.clientHeight,
   viewport.scrollTop+offset-12
  ));
  viewport.scrollTo({
   top:target,
   behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'
  });
 });
});
$('cartRecommendationsItems').addEventListener('click',event=>{
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
 showFatih1Toast(item.name+' lagt i handlekurven');
});
$('cartClear').addEventListener('click',()=>{
 if(!cart.length)return;
 cart=[];saveCart();renderCartContents();
 showFatih1Toast('Handlekurven er tømt');
});

$('cartBrandHome').addEventListener('click',returnToMenu);
$('cartClose').onclick=fatih1HistoryToMenu;
$('sheetClose').onclick=closeProductSheet;
 initCheckoutEvents();
}

/* FATIH1 basket steps: contact, pickup and local order review.
 * Contact details may sync to Firebase; orders are still local-only.
 */
const FATIH1_CONTACT_STORAGE_KEY='kol-beta-demo-contact-v1';
const FATIH1_PICKUP_STORAGE_KEY='kol-beta-demo-pickup-v1';
const FATIH1_LOCAL_ORDER_STORAGE_KEY='bestillonline-last-sent-order-v1';
function readLocalData(key,fallback){
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');return saved&&typeof saved==='object'?saved:fallback}
 catch{return fallback}
}
function writeLocalData(key,value){
 try{
  const encoded=JSON.stringify(value);
  // Avoid unnecessary localStorage writes when checkout data is unchanged.
  if(localStorage.getItem(key)!==encoded)localStorage.setItem(key,encoded);
  return true;
 }catch{return false}
}
let customerContact=readLocalData(FATIH1_CONTACT_STORAGE_KEY,{name:'',phone:'',email:''});
let pickupSelection=readLocalData(FATIH1_PICKUP_STORAGE_KEY,{mode:'asap',time:'',label:''});
let localOrder=readLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,null);
let checkoutStep='cart',localOrderExpiryTimer=null;
const ORDER_CARD_GRACE_MS=15*60*1000;
function osloScheduledPickupAt(order){
 const raw=order?.pickup?.mode==='scheduled'?order.pickup.time:null;
 if(typeof raw!=='string')return 0;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
 if(!match)return 0;
 const [year,month,day,hour,minute]=match.slice(1).map(Number);
 const wall=Date.UTC(year,month-1,day,hour,minute);
 const valid=new Date(wall);
 if(valid.getUTCFullYear()!==year||valid.getUTCMonth()!==month-1||valid.getUTCDate()!==day||valid.getUTCHours()!==hour||valid.getUTCMinutes()!==minute)return 0;
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(const hours of [2,1]){
  const candidate=wall-hours*3600000;
  const parts=formatter.formatToParts(new Date(candidate));
  const part=type=>parts.find(p=>p.type===type)?.value||'';
  if(part('year')+'-'+part('month')+'-'+part('day')+'T'+part('hour')+':'+part('minute')===raw)return candidate;
 }
 return 0;
}
// Older accepted orders may contain a prep-time estimate earlier than the
// customer's pre-order slot. Keep the promised slot unless a later time was confirmed.
function visiblePickupAt(order){
 const scheduled=osloScheduledPickupAt(order);
 const confirmed=Number(order?.statusPublic?.expectedReadyAt)||0;
 return Math.max(scheduled,confirmed);
}

function localOrderExpiresAt(order){
 if(!order)return 0;
 const status=order.statusPublic?.status||order.status;
 // Do not hide a pending or rejected order automatically.
 if(status!=='godkjent'&&status!=='klar')return 0;
 const expected=visiblePickupAt(order);
 const ready=status==='klar'?Number(order.statusPublic?.updatedAt)||0:0;
 const base=Math.max(expected,ready);
 return base>0?base+ORDER_CARD_GRACE_MS:0;
}
function clearActiveOrder(showNotice=false){
 stopCustomerStatus();
 localOrder=null;
 writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,null);
 if(localOrderExpiryTimer){clearTimeout(localOrderExpiryTimer);localOrderExpiryTimer=null}
 const card=$('draftActiveOrder');if(card)card.hidden=true;
 if(showNotice)showFatih1Toast('Bestillingsoversikten er fjernet fra denne enheten.');
}
function scheduleActiveOrderExpiry(){
 if(localOrderExpiryTimer){clearTimeout(localOrderExpiryTimer);localOrderExpiryTimer=null}
 if(!localOrder)return false;
 const expiresAt=localOrderExpiresAt(localOrder);
 if(!expiresAt)return false;
 const remaining=expiresAt-Date.now();
 if(remaining<=0){clearActiveOrder();return true}
 localOrderExpiryTimer=setTimeout(()=>{
  localOrderExpiryTimer=null;
  if(localOrder&&localOrderExpiresAt(localOrder)<=Date.now()){
   clearActiveOrder();
  }else scheduleActiveOrderExpiry();
 },Math.min(remaining,2147483647));
 return false;
}
function shortRemaining(time){
 const seconds=Math.max(0,Math.ceil((Number(time)-Date.now())/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
function updateCustomerCountdown(){
 const order=localOrder;
 const state=order?localPublicStatus().status:'none';
 const deadline=Number(order?.acceptDeadlineAt)||0;
 const pickup=order?visiblePickupAt(order):0;
 const pending=state==='mottatt'&&deadline>0;
 const preparing=state==='godkjent'&&pickup>0;
 const expired=pending&&Date.now()>=deadline;
 const content=pending?
  (expired?'5 minutter har gått. Ring restauranten hvis du ikke har fått bekreftelse.':'Tid til bekreftelse: '+shortRemaining(deadline)):
  preparing?(pickup>Date.now()?'Klar om '+shortRemaining(pickup):'Forventet hentetid er nådd. Vent på bekreftelse om at maten er klar.'):'';
 for(const id of ['draftActiveCountdown','draftConfirmationCountdown']){
  const node=$(id);if(!node)continue;
  node.hidden=!content;
  node.textContent=content;
  node.classList.toggle('is-expired',expired);
 }
 if(expired){
  const active=$('draftActiveTitle'),confirmation=$('draftConfirmationStatus');
  if(active)active.textContent='Ikke bekreftet i tide';
  if(confirmation)confirmation.textContent='Ikke bekreftet i tide';
 }
}
const ORDER_STATUS_LABELS={
 mottatt:'Venter på godkjenning',
 godkjent:'Bestillingen er godkjent',
 klar:'Klar til henting',
 avvist:'Bestillingen er avvist'
};
// The customer's own order: one EventSource stream (Firebase REST onValue
// equivalent). The server sends the first state and subsequent changes.
// No timer or repeated GET; the stream closes when the tab is hidden, order
// is cleared or the status becomes final.
let customerStatusStream=null,customerStatusId='';
function stopCustomerStatus(){
 if(customerStatusStream){customerStatusStream.close();customerStatusStream=null}
 customerStatusId='';
}
function pickupClock(timestamp){
 const date=new Date(Number(timestamp));
 if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(date);
}
function localPublicStatus(){
 const value=localOrder?.statusPublic;
 return value&&Object.hasOwn(ORDER_STATUS_LABELS,value.status)?value:{status:'mottatt'};
}
function displayLiveOrderStatus(){
 if(!localOrder)return;
 const state=localPublicStatus(),confirmedAt=visiblePickupAt(localOrder);
 const label=ORDER_STATUS_LABELS[state.status]||ORDER_STATUS_LABELS.mottatt;
 const accepted=state.status==='godkjent',ready=state.status==='klar',rejected=state.status==='avvist';
 const pickupDate=confirmedAt?new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(new Date(confirmedAt)):'';
 const adjusted=!!state.pickupTimeAdjusted;
 const supplement=accepted&&confirmedAt?' · Henting '+pickupDate:'';
 const subtitle=$('draftActiveSubtitle');
 if(subtitle)subtitle.textContent=(accepted?'Bekreftet av restauranten':label)+supplement;
 const status=$('draftConfirmationStatus');
 if(status)status.textContent=label;
 const info=$('draftConfirmationTimer');
 if(info)info.textContent=accepted&&confirmedAt?
  (adjusted?'Hentetiden er endret til ':'Bekreftet hentetid: ')+pickupDate:
  ready?'Bestillingen er klar til henting nå.':
  rejected?(state.rejectReason?'Årsak: '+state.rejectReason:'Kontakt restauranten.'):
  'Restauranten bekrefter hentetid når bestillingen godtas.';
 const title=$('draftConfirmationTitle');
 if(title)title.textContent=accepted?'Bestillingen er godkjent!':ready?'Bestillingen er klar til henting!':rejected?'Bestillingen er avvist':'Bestillingen er sendt';
 const intro=$('draftConfirmationIntro');
 if(intro)intro.textContent=accepted?'Restauranten har godkjent bestillingen din.':ready?'Du kan hente bestillingen din nå.':rejected?'Restauranten kunne ikke godta bestillingen din.':'Takk, '+(localOrder.customer?.fullName||'')+'! Restauranten har mottatt bestillingen din.';
 const sent=$('draftConfirmationSent');
 if(sent)sent.textContent=accepted?'✓ Bekreftet av restauranten':ready?'✓ Klar til henting':rejected?'Bestillingen ble avvist':'Sendt til restauranten · Avventer godkjenning';
 const pickup=$('draftConfirmationPickup'),pickupLabel=$('draftConfirmationPickupLabel');
 if(pickupLabel)pickupLabel.textContent=adjusted&&accepted?'Endret hentetid':'Hentetid';
 if(pickup)pickup.textContent=confirmedAt&&(!rejected)?pickupDate:(localOrder.pickup?.label||'Snarest');
 const confirmation=$('draftConfirmation');
 if(confirmation){
  confirmation.dataset.orderStatus=state.status;
  const marker=confirmation.querySelector('.draft-confirmation-mark');
  if(marker)marker.textContent=rejected?'!':'✓';
 }
 const activeTitle=$('draftActiveTitle');
 if(activeTitle)activeTitle.textContent=accepted?'Bestillingen er godkjent':ready?'Klar til henting':rejected?'Bestillingen er avvist':'Bestilling sendt';
 const tracker=$('draftActiveOrder')?.querySelectorAll('.draft-tracking > span');
 if(tracker)tracker.forEach((step,index)=>{
  step.classList.toggle('is-done',index===0||(index===1&&(accepted||ready))||(index===2&&ready));
  step.classList.toggle('is-preparing',index===2&&accepted);
 });
 updateCustomerCountdown();
}
function onCustomerStatusUpdate(value){
 if(!localOrder||!value||typeof value!=='object'||
    !Object.hasOwn(ORDER_STATUS_LABELS,value.status))return;
 const incoming=Number(value.updatedAt)||0;
 if(incoming<(Number(localOrder.statusPublic?.updatedAt)||0))return;
 const statusPublic={
  status:value.status,updatedAt:incoming,
  ...(Number(value.expectedReadyAt)>0?{expectedReadyAt:Number(value.expectedReadyAt)}:{}),
  ...(value.pickupTimeAdjusted?{pickupTimeAdjusted:true}:{}),
  ...(value.rejectReason?{rejectReason:String(value.rejectReason).slice(0,180)}:{})
 };
 const previousStatus=localPublicStatus().status;
 const changed=JSON.stringify(localOrder.statusPublic)!==JSON.stringify(statusPublic);
 if(changed){
  localOrder.statusPublic=statusPublic;
  localOrder.status=statusPublic.status;
  writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,localOrder);
 }
 displayLiveOrderStatus();
 if(changed&&previousStatus!==statusPublic.status&&statusPublic.status!=='mottatt'){
  const message=statusPublic.status==='godkjent'
   ?'Bestillingen er godkjent'+(visiblePickupAt(localOrder)?' · Henting kl. '+pickupClock(visiblePickupAt(localOrder)):'')
   :statusPublic.status==='klar'?'Bestillingen er klar til henting'
   :'Bestillingen er avvist';
  showFatih1Toast(message,statusPublic.status==='avvist'?'error':'info');
  if(!document.hidden&&'Notification' in window&&Notification.permission==='granted'){
   try{new Notification('KØL Grill & Pizza',{body:message,tag:'kol-order-'+localOrder.id})}catch{}
  }
 }
 if(changed&&statusPublic.status!=='mottatt')renderDraftActiveOrder();
 if(value.status==='klar'||value.status==='avvist')stopCustomerStatus();
}
function beginCustomerStatus(){
 if(document.hidden||!localOrder?.id)return;
 const id=String(localOrder.id);
 if(!/^ord_[0-9]{13}_[a-f0-9]{12}$/.test(id))return;
 if(customerStatusStream&&customerStatusId===id)return;
 stopCustomerStatus();
 if(['klar','avvist'].includes(localPublicStatus().status))return;
 customerStatusId=id;
 const stream=new EventSource(BASE+'/ORDERS/'+encodeURIComponent(id)+'/statusPublic.json');
 customerStatusStream=stream;
 let snapshot=null;
 const update=(event,patch)=>{
  if(customerStatusStream!==stream||localOrder?.id!==id)return;
  try{
   const data=JSON.parse(event.data),path=String(data.path||'/');
   if(!patch||path==='/')snapshot=data.data&&typeof data.data==='object'?data.data:null;
   else if(snapshot&&path.startsWith('/')){
    const keys=path.split('/').filter(Boolean);
    let target=snapshot;
    for(const key of keys.slice(0,-1)){
     if(typeof target[key]!=='object'||target[key]===null)target[key]={};
     target=target[key];
    }
    if(data.data===null)delete target[keys.at(-1)];
    else target[keys.at(-1)]=data.data;
   }
   onCustomerStatusUpdate(snapshot);
  }catch(error){console.warn('BestillOnline: statusoppdatering kunne ikke leses',error)}
 };
 stream.addEventListener('put',event=>update(event,false));
 stream.addEventListener('patch',event=>update(event,true));
 stream.addEventListener('cancel',()=>{if(customerStatusStream===stream)stopCustomerStatus()});
 stream.addEventListener('auth_revoked',()=>{if(customerStatusStream===stream)stopCustomerStatus()});
 // Native EventSource reconnects on temporary connection loss.
}

function localOrderStatus(){
 if(!localOrder)return 'none';
 if(localOrder.status==='pending'&&Number(localOrder.expiresAt)<=Date.now()){
  localOrder.status='expired';
  writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,localOrder);
 }
 return localOrder.status;
}
function renderDraftActiveOrder(){
 const card=$('draftActiveOrder');
 if(!card)return;
 if(!localOrder){card.hidden=true;return}
 if(scheduleActiveOrderExpiry())return;
 card.hidden=false;
 $('draftActiveNumber').textContent='#'+String(localOrder.id||'').slice(-6).toUpperCase();
 displayLiveOrderStatus();
 if(!$('draftConfirmation').hidden)renderDraftConfirmation();
}
function renderDraftConfirmationItems(){
 const panel=$('draftConfirmationItems'),host=$('draftConfirmationItemsList');
 if(!panel||!host||!localOrder)return;
 const items=Array.isArray(localOrder.items)?localOrder.items:[];
 const count=items.reduce((sum,line)=>sum+Math.max(0,Number(line.qty)||0),0);
 $('draftConfirmationItemsCount').textContent=count+' '+(count===1?'vare':'varer');
 host.innerHTML=items.length?items.map(line=>{
  const quantity=Math.max(1,Number(line.qty)||1);
  const price=Number(line.unitPrice)||0;
  const quickNotes=Array.isArray(line.quickNotes)?line.quickNotes.filter(Boolean):[];
  return '<article class="cart-product-card draft-confirmation-product">'+
   '<div class="cart-product-heading"><strong class="cart-product-name">'+quantity+' × '+esc(String(line.name||'Produkt'))+'</strong></div>'+
   '<div class="cart-product-details">'+cartLineDetails(line)+
    (quickNotes.length?'<div class="cart-line-detail is-alert"><span><b>Beskjed:</b> '+esc(quickNotes.join(', '))+'</span></div>':'')+
   '</div>'+
   '<div class="cart-product-totalrow"><span>Sum'+(quantity>1?' ('+quantity+' × '+money(price)+')':'')+'</span><strong>'+money(quantity*price)+'</strong></div>'+
   '</article>';
 }).join('')+'<div class="draft-confirmation-total"><strong>Totalt</strong><strong>'+money(localOrder.total)+'</strong></div>':
 '<p class="draft-confirmation-empty">Ingen produktdetaljer tilgjengelig.</p>';
}
function renderDraftConfirmation(){
 if(!localOrder)return;
 localOrderStatus();
 $('draftConfirmationNumber').textContent=String(localOrder.id||'').slice(-6).toUpperCase();
 $('draftConfirmationTotal').textContent=money(localOrder.total);
 renderDraftConfirmationItems();
 displayLiveOrderStatus();
}
function showDraftConfirmation(){
 if(!localOrder)return;
 fatih1HistoryWrite({view:'confirmation'},true);
 hideAll();
 const itemPanel=$('draftConfirmationItems');if(itemPanel)itemPanel.open=false;
 renderDraftConfirmation();
 show('draftConfirmation');
 beginCustomerStatus();
}
function showCheckoutError(message,field){
 const error=$('checkoutError');
 error.textContent=message;
 error.hidden=!message;
 if(field)$(field).focus();
}
function updateContactValidation(){
 const fields=[
  ['draftFullName',v=>v.trim().length>=2],
  ['draftPhone',v=>/^[49]\d{7}$/.test(v.replace(/\D/g,''))],
  ['draftEmail',v=>v.trim().length>0&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())]
 ];
 for(const [id,check] of fields){
  const input=$(id);
  input?.closest('.checkout-field')?.classList.toggle('is-valid',check(input?.value||''));
 }
}
const CONTACT_SYNC_KEY='kol-beta-contact-synced-v1';
// Keep one local contact record and avoid rewriting it on unchanged input.
let fatih1LastContactLocal=JSON.stringify(customerContact);
function persistDraftContactIfChanged(value){
 const snapshot=JSON.stringify(value);
 if(snapshot===fatih1LastContactLocal)return true;
 if(!writeLocalData(FATIH1_CONTACT_STORAGE_KEY,value))return false;
 fatih1LastContactLocal=snapshot;
 return true;
}
function saveDraftContact(){
 const updated={
  name:$('draftFullName').value.trim(),
  phone:$('draftPhone').value.replace(/\D/g,'').slice(0,8),
  email:$('draftEmail').value.trim()
 };
 if(JSON.stringify(customerContact)!==JSON.stringify(updated))customerContact=updated;
 persistDraftContactIfChanged(customerContact);
}
function fatih1ContactSignature(contact){
 return JSON.stringify([
  String(contact?.name||'').trim().replace(/\s+/g,' ').slice(0,120),
  String(contact?.phone||'').replace(/\D/g,'').slice(0,8),
  String(contact?.email||'').trim().toLowerCase().slice(0,200)
 ]);
}
let customerSavedSignature='',customerSavePending=null;
function fatih1ContactIsSynced(contact=customerContact){
 const signature=fatih1ContactSignature(contact);
 if(customerSavedSignature===signature)return true;
 try{return localStorage.getItem(CONTACT_SYNC_KEY)===signature}catch{return false}
}
// 'saved': new Firebase update; 'unchanged': already synchronized; false: failed.
async function syncFatih1Customer(){
 const [name,phone,email]=JSON.parse(fatih1ContactSignature(customerContact));
 if(name.length<2||!/^[49]\d{7}$/.test(phone)||
    (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return false;
 const normalized={name,phone,email},signature=fatih1ContactSignature(normalized);
 if(fatih1ContactIsSynced(normalized))return 'unchanged';
 if(customerSavePending)await customerSavePending;
 if(fatih1ContactIsSynced(normalized))return 'unchanged';
 customerSavePending=(async()=>{
  try{
   let previous=null;
   try{previous=JSON.parse(localStorage.getItem(CONTACT_SYNC_KEY)||'null')}catch{}
   const changed=Array.isArray(previous)&&previous[1]===phone?
    [['name',name,previous[0]],['email',email,previous[2]]]:
    [['name',name,null],['email',email,null]];
   for(const [field,value,last] of changed){
    if(last===value)continue;
    const response=await fetch(BASE+'/customers/'+phone+'/'+field+'.json',{
     method:'PUT',headers:{'Content-Type':'application/json'},
     body:JSON.stringify(value),cache:'no-store'
    });
    if(!response.ok)throw new Error('Firebase '+field+' HTTP '+response.status);
   }
   if(!persistDraftContactIfChanged(normalized))throw Error('Local contact storage unavailable');
   customerSavedSignature=signature;
   try{localStorage.setItem(CONTACT_SYNC_KEY,signature)}catch{}
   return 'saved';
  }catch(error){
   console.warn('BestillOnline customer contact sync failed:',error);
   return false;
  }
 })();
 try{return await customerSavePending}finally{customerSavePending=null}
}
function validateDraftContact(){
 saveDraftContact();
 if(customerContact.name.length<2){showCheckoutError('Skriv inn hele navnet ditt.','draftFullName');return false}
 if(!/^[49]\d{7}$/.test(customerContact.phone)){showCheckoutError('Mobilnummer må ha 8 siffer.','draftPhone');return false}
 if(customerContact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerContact.email)){
  showCheckoutError('Kontroller e-postadressen, eller la feltet stå tomt.','draftEmail');return false
 }
 showCheckoutError('');
 return true;
}
function osloCalendar(){
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date());
 const get=k=>Number(parts.find(x=>x.type===k)?.value||0);
 return {year:get('year'),month:get('month'),day:get('day'),minute:get('hour')*60+get('minute')};
}
function draftPickupSlots(){
 const now=osloCalendar(),mondayIndex=osloTime().day,days=openingDays(menu?.settings||{});
 const startDay=Date.UTC(now.year,now.month-1,now.day),slots=[];
 for(let offset=0;offset<8&&slots.length<120;offset++){
  const cfg=days[(mondayIndex+offset)%7];
  if(!cfg.enabled)continue;
  const open=clockMinutes(cfg.open),close=clockMinutes(cfg.close);
  if(open===null||close===null)continue;
  const end=close<=open?close+1440:close;
  for(let min=Math.ceil(open/15)*15;min<end&&slots.length<120;min+=15){
   if(offset===0&&min<now.minute+30)continue;
   const shift=Math.floor(min/1440),date=new Date(startDay+(offset+shift)*86400000);
   const day=date.toISOString().slice(0,10),time=String(Math.floor(min%1440/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
   const dayLabel=offset+shift===0?'I dag':offset+shift===1?'I morgen':
    new Intl.DateTimeFormat('nb-NO',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(date);
   slots.push({value:day+'T'+time,label:dayLabel+' kl. '+time});
  }
 }
 return slots;
}
function renderDraftPickupChoices(){
 const asap=pickupSelection.mode!=='scheduled';
 $('draftAsapOption').classList.toggle('is-selected',asap);
 $('draftScheduledOption').classList.toggle('is-selected',!asap);
 document.querySelectorAll('input[name="draftPickupMode"]').forEach(x=>x.checked=x.value===(asap?'asap':'scheduled'));
 $('draftPickupTimeBox').hidden=asap;
 const slots=draftPickupSlots(),select=$('draftPickupTime');
 select.replaceChildren(...slots.map(slot=>new Option(slot.label,slot.value)));
 if(slots.some(x=>x.value===pickupSelection.time))select.value=pickupSelection.time;
 else{
  pickupSelection.time=slots[0]?.value||'';
  pickupSelection.label=slots[0]?.label||'';
 }
 select.disabled=!slots.length;
 if(!asap)writeLocalData(FATIH1_PICKUP_STORAGE_KEY,pickupSelection);
}
function checkoutNavigate(step){
 const prevStep=checkoutStep;
 checkoutStep=step;
 if(!$('cartSheet').hidden&&step!==prevStep)fatih1HistoryWrite({view:'cart',step});
 $('cartCartStep').hidden=step!=='cart';
 $('cartContactStep').hidden=step!=='contact';
 $('cartPickupStep').hidden=step!=='pickup';
 const rank={cart:0,contact:1,pickup:2};
 document.querySelectorAll('.cart-steps [data-checkout-step]').forEach(el=>{
  const index=rank[el.dataset.checkoutStep];
  el.classList.toggle('is-current',index===rank[step]);
  el.classList.toggle('is-done',index<rank[step]);
 });
 $('cartFooterTotal').hidden=step!=='cart';
 $('continue').hidden=step==='cart';
 $('continue').textContent=step==='pickup'?'Tilbake: Kontakt':'Tilbake: Kurv';
 $('cartNext').textContent=step==='cart'?'Neste: Kontakt':step==='contact'?'Neste: Hentetid':'Send bestilling';
 if(step==='cart'){
  const review=reconcileCartWithMenu();
  $('cartNext').disabled=!cart.length||!!review.issues.length;
 }
 showCheckoutError('');
 if(step==='contact'){
  $('draftFullName').value=customerContact.name||'';
  $('draftPhone').value=customerContact.phone||'';
  $('draftEmail').value=customerContact.email||'';
  updateContactValidation();
 }
 if(step==='pickup'){
  $('cartPickupStep').querySelector('.checkout-order-preview').open=false;
  renderDraftPickupChoices();
  pickupSummary();
 }
 $('cartScroll').scrollTo({top:0,behavior:'instant'});
}
function localOrderId(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const bytes=new Uint8Array(6);
 if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
 else for(let i=0;i<6;i++)bytes[i]=Math.floor(Math.random()*256);
 return Array.from(bytes,x=>alphabet[x%alphabet.length]).join('');
}
let orderSubmissionBusy=false;
function createFirebaseOrderId(now){
 const random=new Uint8Array(6);window.crypto.getRandomValues(random);
 return 'ord_'+String(now).padStart(13,'0')+'_'+[...random].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function submitDraftOrder(){
 if(orderSubmissionBusy)return;
 if(!cart.length){checkoutNavigate('cart');return}
 if(!menu){showCheckoutError('Menyen er ikke lastet. Prøv igjen.');return}
 if(cart.length>60||cart.some(line=>!Number.isInteger(Number(line.qty))||Number(line.qty)<1||Number(line.qty)>99)){
  showCheckoutError('Kontroller antall varer i handlekurven (maks 60 produktlinjer og 99 per linje).');
  checkoutNavigate('cart');return;
 }
 const review=reconcileCartWithMenu();
 if(review.issues.length||review.repriced){
  checkoutNavigate('cart');renderCartContents();showCheckoutError('Menyen er endret. Kontroller varer og priser.');return;
 }
 if(!validateDraftContact()){checkoutNavigate('contact');return}
 const pickup=pickupSelection.mode==='scheduled'?
  {mode:'scheduled',time:pickupSelection.time,label:$('draftPickupTime').selectedOptions[0]?.textContent||pickupSelection.label}:
  {mode:'asap',time:null,label:'Snarest'};
 if(pickup.mode==='scheduled'&&!draftPickupSlots().some(x=>x.value===pickup.time)){
  showCheckoutError('Velg en gyldig hentetid.','draftPickupTime');return;
 }
 if(pickup.mode==='asap'&&!getOrderingState().open){
  showCheckoutError('Restauranten er stengt. Velg hentetid ved forhåndsbestilling.');return;
 }
 if(!window.crypto?.getRandomValues){
  showCheckoutError('Sikker tilkobling kreves for å sende bestillingen.');return;
 }
 const now=Date.now(),id=createFirebaseOrderId(now);
 const items=cart.map(line=>({
  id:String(line.id||'').slice(0,100),name:String(line.name||'Produkt').slice(0,120),
  qty:Math.max(1,Math.min(99,Number(line.qty)||1)),
  unitPrice:Number(line.unitPrice)||0,size:line.size||null,
  choices:Array.isArray(line.choices)?line.choices:[],
  removedIngredients:Array.isArray(line.removedIngredients)?line.removedIngredients:[],
  quickNotes:Array.isArray(line.quickNotes)?line.quickNotes:[],
  comment:String(line.comment||'').slice(0,500)
 }));
 const order={
  schema:1,id,source:'BestillOnline',channel:'web',fulfillment:'pickup',
  status:'mottatt',statusPublic:{status:'mottatt',updatedAt:now},createdAt:now,currency:'NOK',
  // No five-minute acceptance deadline for orders placed before opening.
  ...(getOrderingState().open?{acceptDeadlineAt:now+300000}:{}),
  name:customerContact.name.slice(0,120),phone:'+47'+customerContact.phone,
  ...(customerContact.email?{email:customerContact.email.slice(0,200)}:{}),
  pickup:{...pickup,timeZone:'Europe/Oslo'},items,total:calculateCartTotal(cart)
 };
 orderSubmissionBusy=true;$('cartNext').disabled=true;
 $('cartNext').textContent='Sender bestilling…';showCheckoutError('');
 try{
  const result=await fetch(BASE+'/ORDERS/'+encodeURIComponent(id)+'.json?print=silent',{
   method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(order),cache:'no-store'
  });
  if(!result.ok){
   if(result.status===401||result.status===403)
    throw Error('Restauranten kan ikke motta bestillinger ennå (Firebase-regler mangler).');
   throw Error('Kunne ikke sende bestillingen (HTTP '+result.status+').');
  }
  stopCustomerStatus();
  localOrder={...order,customer:{fullName:order.name,phone:order.phone,email:order.email||null}};

  writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,localOrder);
  cart=[];saveCart();
  renderDraftActiveOrder();showDraftConfirmation();
  showFatih1Toast('Bestillingen er sendt til restauranten');
 }catch(error){
  console.warn('BestillOnline order submission failed:',error);
  showCheckoutError(error.message+' Handlekurven er beholdt. Kontroller med restauranten før du prøver igjen.');
 }finally{
  orderSubmissionBusy=false;$('cartNext').disabled=false;$('cartNext').textContent='Send bestilling';
 }
}
async function checkoutNext(){
 if(checkoutStep==='cart'){
  const review=reconcileCartWithMenu();
  if(review.issues.length){
   renderCartContents();showCheckoutError('Kontroller varer som er endret i menyen.');return;
  }
  if(cart.length)checkoutNavigate('contact');
 }else if(checkoutStep==='contact'){
  if(validateDraftContact()){
   $('cartNext').disabled=true;
   try{
    const syncResult=await syncFatih1Customer();
    if(syncResult){checkoutNavigate('pickup');if(syncResult==='saved')showFatih1Toast('Kontaktinformasjonen er lagret i Firebase')}
    else{showCheckoutError('Kunne ikke lagre kontaktinformasjonen i Firebase. Kontroller tilgang og prøv igjen.');showFatih1Toast('Kunne ikke lagre kontaktinformasjonen','error')}
   }finally{$('cartNext').disabled=false}
  }
 }else await submitDraftOrder();
}
function checkoutBack(){
 if(checkoutStep==='cart')fatih1HistoryToMenu();
 else fatih1HistoryBack();
}

function returnToMenu(){
 fatih1HistoryToMenu();
 $('appViewport').scrollTo({top:0,behavior:'instant'});
 window.scrollTo({top:0,behavior:'instant'});
 $('appViewport').classList.remove('nav-hidden');
}

function initCheckoutEvents(){
$('continue').onclick=checkoutBack;
$('cartNext').onclick=checkoutNext;
['draftFullName','draftPhone','draftEmail'].forEach(id=>$(id).addEventListener('input',()=>{saveDraftContact();updateContactValidation();showCheckoutError('')}));
$('cartContactStep').addEventListener('submit',event=>{event.preventDefault();checkoutNext()});
document.querySelectorAll('input[name="draftPickupMode"]').forEach(input=>input.addEventListener('change',event=>{pickupSelection.mode=event.target.value;renderDraftPickupChoices();writeLocalData(FATIH1_PICKUP_STORAGE_KEY,pickupSelection);showFatih1Toast(pickupSelection.mode==='asap'?'Henting: Snarest':'Henting: Velg tid','info')}));
$('draftPickupTime').addEventListener('change',event=>{pickupSelection.time=event.target.value;pickupSelection.label=event.target.selectedOptions[0]?.textContent||'';writeLocalData(FATIH1_PICKUP_STORAGE_KEY,pickupSelection);showFatih1Toast('Hentetid: '+pickupSelection.label,'info')});
$('draftViewOrder').onclick=showDraftConfirmation;
$('draftConfirmationClose').onclick=returnToMenu;
$('draftClearOrder').onclick=()=>clearActiveOrder(true);
}

// Cart owns its own initialization and stored draft order display.
document.addEventListener('DOMContentLoaded',()=>{
 // Local clock only: zero Firebase reads for either countdown.
 setInterval(()=>{if(!document.hidden&&localOrder)updateCustomerCountdown()},1000);
 cleanupRetiredCartStorage();
 renderDraftActiveOrder();
 beginCustomerStatus();
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)stopCustomerStatus();
  else {renderDraftActiveOrder();beginCustomerStatus()}
 });
 window.addEventListener('pagehide',stopCustomerStatus);
 initCartEvents();
});
