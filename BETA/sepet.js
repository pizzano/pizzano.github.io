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
// Admin selects up to ten products in /menu/cartSuggestionRules.
// A stable per-opening shuffle shows four at a time. Dismissing one reveals
// the next eligible entry, without reordering every time the cart rerenders.
let dismissedSuggestions=new Set();
let suggestionRandomOrder=[],suggestionRandomKey='';
function randomizedCartSuggestionIds(){
 const ids=Array.isArray(menu?.cartSuggestionRules)?
  [...new Set(menu.cartSuggestionRules.filter(v=>v!==null&&v!==undefined).map(String))].slice(0,10):[];
 const key=JSON.stringify(ids);
 if(key!==suggestionRandomKey){
  suggestionRandomKey=key;
  suggestionRandomOrder=ids.slice();
  for(let n=suggestionRandomOrder.length-1;n>0;n--){
   const j=Math.floor(Math.random()*(n+1));
   [suggestionRandomOrder[n],suggestionRandomOrder[j]]=[suggestionRandomOrder[j],suggestionRandomOrder[n]];
  }
 }
 return suggestionRandomOrder;
}
function suggestedCartItems(){
 if(!menu||!cart.length)return [];
 const included=new Set(cart.map(line=>String(line.id)));
 const products=new Map(menu.sections.flatMap(section=>(section.items||[]).map(item=>[String(item.id),item])));
 const selected=[];
 for(const id of randomizedCartSuggestionIds()){
  const item=products.get(id);
  if(!item||included.has(id)||dismissedSuggestions.has(id)||item.hidden||item.soldOut)continue;
  selected.push({item});
  if(selected.length===4)break;
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
  }catch(error){console.warn('FATIH1 cart recommendation refresh:',error)}
  finally{fatih1SuggestionPending=null}
 })();
 return fatih1SuggestionPending;
}
function renderCartRecommendations(){
 const host=$('cartRecommendations'),items=$('cartRecommendationsItems');
 const disclosure=$('cartSuggestionsDisclosure');
 const thumbnails=$('cartSuggestionsThumbnails'),count=$('cartSuggestionsCount');
 const suggestions=suggestedCartItems();
 host.hidden=!suggestions.length;
 if(!suggestions.length){
  disclosure.open=false;
  thumbnails.replaceChildren();
  items.replaceChildren();
  count.textContent='';
  return;
 }
 const preview=suggestions.slice(0,4);
 thumbnails.innerHTML=preview.map(({item})=>
  '<span class="cart-suggestion-thumb">'+imgEl(item.imageUrl,item.name,'suggestion-photo')+'</span>'
 ).join('');
 count.textContent=suggestions.length+' forslag';
 thumbnails.querySelectorAll('img[data-image]').forEach(img=>void setCachedImage(img,img.dataset.image));
 // Do not build or fetch full-size suggestions until the guest asks to see them.
 if(!disclosure.open){items.replaceChildren();return}
 items.innerHTML=suggestions.map(({item})=>'<article class="cart-recommendation">'+
  '<div class="cart-suggestion-image">'+imgEl(item.imageUrl,'','suggestion-photo')+'</div>'+
  '<div class="cart-recommendation-copy"><strong>'+esc(item.name)+'</strong><span>'+money(basePrice(item))+'</span></div>'+
  '<button type="button" class="cart-suggest-add" data-suggest-add="'+esc(item.id)+'" aria-label="Legg til '+esc(item.name)+'">+</button>'+
  '<button type="button" class="cart-suggest-dismiss" data-suggest-dismiss="'+esc(item.id)+'" aria-label="Skjul '+esc(item.name)+'">×</button>'+
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
 $('cartItems').innerHTML=cart.length?cart.map((line,index)=>
  '<article class="cart-product-card" data-cart-line="'+index+'">'+
  '<div class="cart-product-heading"><div class="cart-product-copy"><strong class="cart-product-name">'+esc(line.name)+'</strong>'+
  '<button type="button" class="cart-product-edit" data-edit="'+index+'" aria-label="Endre '+esc(line.name)+'" title="Endre produkt">'+cartEditIcon+'</button></div>'+
  '<div class="cart-product-stepper"><button data-cart-minus="'+index+'" aria-label="'+(Number(line.qty)>1?'Reduser antall':'Fjern produkt')+'">'+(Number(line.qty)>1?'−':cartTrashIcon)+'</button><b>'+line.qty+'</b><button data-cart-plus="'+index+'" aria-label="Øk antall">+</button></div></div>'+
  '<div class="cart-product-details">'+cartLineDetails(line)+'</div>'+
  (cartMenuIssues.some(issue=>issue.index===index)?'<p class="cart-line-warning" role="alert">'+
  esc(cartMenuIssues.find(issue=>issue.index===index).reason)+' · Endre eller fjern varen.</p>':'')+
  '<div class="cart-product-totalrow"><span>Sum</span><strong>'+
  (cartMenuIssues.some(issue=>issue.index===index)?'Må kontrolleres':money(line.qty*line.unitPrice))+
  '</strong></div></article>'
 ).join(''):'<div class="cart-empty"><span>🛒</span><strong>Handlekurven er tom</strong><p>Velg noe godt fra menyen.</p></div>';
 renderCartRecommendations();
 $('cartItems').querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}


// One shared source of details for the basket and final pickup review.
function pickupSummary(){
 // Same cart product card and detail renderer as the basket, read-only here.
 const count=cart.reduce((sum,line)=>sum+(Number(line.qty)||0),0);
 $('draftPickupItemCount').textContent=count+' '+(count===1?'vare':'varer');
 $('draftPickupOrderItems').innerHTML=cart.map(line=>{
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
function showCart(){suggestionRandomKey='';$('cartSuggestionsDisclosure').open=false;renderCartContents();show('cartSheet');checkoutNavigate('cart');updateOrderingControls();void refreshCartSuggestionIdsOnce()}

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
 const dismiss=event.target.closest('[data-suggest-dismiss]');
 if(dismiss){
  dismissedSuggestions.add(String(dismiss.dataset.suggestDismiss));
  renderCartRecommendations();showFatih1Toast('Forslaget er skjult','info');return;
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
const FATIH1_LOCAL_ORDER_STORAGE_KEY='kol-beta-demo-order-v1';
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
 card.hidden=!localOrder;
 if(!localOrder)return;
 const pending=localOrderStatus()==='pending';
 $('draftActiveNumber').textContent='#'+localOrder.id;
 $('draftActiveTitle').textContent='Bestillingsoversikt';
 $('draftActiveSubtitle').textContent='Lagret på denne enheten · Ikke sendt til restauranten';
 if(!$('draftConfirmation').hidden)renderDraftConfirmation();
 if(pending&&!localOrderExpiryTimer){
  // Only one local expiry callback is needed; there is no live countdown.
  const remaining=Math.max(1,Number(localOrder.expiresAt)-Date.now()+1);
  localOrderExpiryTimer=window.setTimeout(()=>{
   localOrderExpiryTimer=null;
   if(localOrder)renderDraftActiveOrder();
  },Math.min(remaining,2147483647));
 }
}
function renderDraftConfirmation(){
 if(!localOrder)return;
 localOrderStatus();
 $('draftConfirmationTitle').textContent='Bestillingsoversikt';
 $('draftConfirmationIntro').textContent='Takk, '+(localOrder.customer?.fullName||'')+'! Her er bestillingsoversikten din.';
 $('draftConfirmationNumber').textContent=localOrder.id;
 $('draftConfirmationPickup').textContent=localOrder.pickup?.label||'Snarest';
 $('draftConfirmationTotal').textContent=money(localOrder.total);
 $('draftConfirmationStatus').textContent='Ikke sendt til restauranten';
 $('draftConfirmationTimer').textContent='Oversikten er lagret på denne enheten';
}
function showDraftConfirmation(){
 if(!localOrder)return;
 fatih1HistoryWrite({view:'confirmation'},true);
 hideAll();
 renderDraftConfirmation();
 show('draftConfirmation');
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
   console.warn('FATIH1 customer contact sync failed:',error);
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
 $('cartNext').textContent=step==='cart'?'Neste: Kontakt':step==='contact'?'Neste: Hentetid':'Lagre bestillingsoversikt';
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
function submitDraftOrder(){
 if(!cart.length){checkoutNavigate('cart');return}
 const currentReview=reconcileCartWithMenu();
 if(currentReview.issues.length||currentReview.repriced){
  checkoutNavigate('cart');renderCartContents();
  showCheckoutError('Menyen er endret. Kontroller varer og priser.');return;
 }
 if(!validateDraftContact()){checkoutNavigate('contact');showCheckoutError('Kontroller kontaktinformasjonen.');return}
 const pickup=pickupSelection.mode==='scheduled'?
  {mode:'scheduled',time:pickupSelection.time,label:$('draftPickupTime').selectedOptions[0]?.textContent||pickupSelection.label}:
  {mode:'asap',time:null,label:'Snarest'};
 if(pickup.mode==='scheduled'&&!draftPickupSlots().some(x=>x.value===pickup.time)){
  showCheckoutError('Velg en gyldig hentetid.','draftPickupTime');return;
 }
 const timestamp=Date.now();
 // Future admin connection point: send this versioned shape to the order API.
 // For the draft the ONLY side effect is localStorage; no network requests.
 const newOrder={
  schema:1,source:'FATIH1_LOCAL_DEMO',channel:'web',fulfillment:'pickup',
  id:localOrderId(),status:'pending',
  createdAt:new Date(timestamp).toISOString(),expiresAt:timestamp+180000,
  customer:{fullName:customerContact.name,phone:'+47'+customerContact.phone,email:customerContact.email||null},
  pickup:{...pickup,timeZone:'Europe/Oslo'},
  items:JSON.parse(JSON.stringify(cart)),total:calculateCartTotal(cart),currency:'NOK'
 };
 // Single integration seam: later replace this local persistence with an
 // explicit admin-order submission, without changing the form or prices.
 if(!writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,newOrder)){
  showCheckoutError('Kunne ikke lagre testbestillingen lokalt. Kontroller nettleserens lagring.');
  return;
 }
 localOrder=newOrder;
 cart=[];saveCart();
 renderDraftActiveOrder();
 showDraftConfirmation();
 showFatih1Toast('Bestillingsoversikten er lagret lokalt');
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
 }else submitDraftOrder();
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
$('draftClearOrder').onclick=()=>{localOrder=null;writeLocalData(FATIH1_LOCAL_ORDER_STORAGE_KEY,null);if(localOrderExpiryTimer){clearTimeout(localOrderExpiryTimer);localOrderExpiryTimer=null}renderDraftActiveOrder();showFatih1Toast('Bestillingsoversikten er fjernet')};
}
