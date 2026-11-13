/* BETA basket feature: cart storage, item handling, suggestions and presentation.
 * Loaded before app.js; shared functions use the page's existing global state.
 */
'use strict';
const CART_KEY='kol-beta-cart-v1';
let cart=loadCart(),editingCartIndex=null;
const demoTotal=items=>items.reduce((sum,line)=>sum+(Number(line.qty)||0)*(Number(line.unitPrice)||0),0);
function loadCart(){try{const c=JSON.parse(localStorage.getItem(CART_KEY));return Array.isArray(c)?c:[]}catch{return []}}
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}renderCartIndicators();updateCartBadges()}

function addToCart(){
 if(!current)return;
 const availability=getOrderingState();
 const error=optionValidation();
 if(error){
  renderOptions();
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
 $('cartItems').querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}


// One shared source of details for the basket and final pickup review.
function pickupSummary(){
 // Same cart product card and detail renderer as the basket, read-only here.
 const count=cart.reduce((sum,line)=>sum+(Number(line.qty)||0),0);
 $('demoPickupItemCount').textContent=count+' '+(count===1?'vare':'varer');
 $('demoPickupOrderItems').innerHTML=cart.map(line=>{
  const qty=Number(line.qty)||0;
  return '<article class="cart-product-card demo-pickup-product">'+
   '<div class="cart-product-heading"><div class="cart-product-copy">'+
   '<strong class="cart-product-name">'+esc(line.name)+' × '+qty+'</strong>'+
   '</div></div>'+
   '<div class="cart-product-details">'+cartLineDetails(line)+'</div>'+
   '<div class="cart-product-totalrow"><span>Sum'+(qty>1?' ('+qty+' × '+money(line.unitPrice)+')':'')+
   '</span><strong>'+money(qty*(Number(line.unitPrice)||0))+'</strong></div>'+
   '</article>';
 }).join('')+
 '<div class="demo-pickup-line is-total"><strong>Totalt</strong><strong>'+money(demoTotal(cart))+'</strong></div>';
}
function showCart(){$('cartSuggestionsDisclosure').open=false;renderCartContents();show('cartSheet');checkoutNavigate('cart');updateOrderingControls()}

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
 const allowed=kitchenNotesFor(current);
 selectedKitchenNotes=new Set((line.quickNotes||[]).filter(n=>allowed.includes(n)));
 const raw=String(line.comment||'');
 $('comment').value=raw.split('\n').filter(x=>!selectedKitchenNotes.has(x)).join('\n');
 renderOptions();
 $('add').firstChild.textContent='Oppdater kurven ';
}

function closeProductSheet(){const wasEditing=editingCartIndex!==null;editingCartIndex=null;hideAll();if(wasEditing)showCart()}
function updateCartQuantityControls(){
 const cartPanel=$('cartSheet');
 if(cartPanel&&!cartPanel.hidden)cartPanel.querySelectorAll('[data-cart-plus]').forEach(button=>button.disabled=false);
}
function cartQuantityForProduct(id){
 return cart.reduce((sum,line)=>sum+(String(line.id)===String(id)?Number(line.qty||0):0),0);
}
function initCartEvents(){
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
});

$('cartBrandHome').addEventListener('click',returnToMenu);
$('cartClose').onclick=hideAll;
$('sheetClose').onclick=closeProductSheet;
}
