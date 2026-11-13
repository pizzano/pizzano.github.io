/* BETA basket feature: cart storage, item handling, suggestions and presentation.
 * Loaded before app.js; shared functions use the page's existing global state.
 */
'use strict';
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
 const host=$('demoPickupOrderItems');
 const totalQuantity=cart.reduce((count,line)=>count+(Number(line.qty)||0),0);
 $('demoPickupItemCount').textContent=totalQuantity+' '+(totalQuantity===1?'vare':'varer');
 host.innerHTML=cart.map(line=>{
  const count=Math.max(1,Number(line.qty)||1);
  const unitPrice=Number(line.unitPrice)||0;
  const linePrice=count*unitPrice;
  return '<article class="demo-pickup-product">'+
   '<div class="demo-pickup-product-heading"><strong>'+esc(line.name)+' × '+count+'</strong>'+
   '<strong>'+money(linePrice)+'</strong></div>'+
   '<div class="demo-pickup-product-details">'+cartLineDetails(line)+'</div>'+
   (count>1?'<div class="demo-pickup-unit-price">'+money(unitPrice)+' / stk · '+count+' stk</div>':'')+
   '</article>';
 }).join('')+
 '<div class="demo-pickup-line is-total"><strong>Totalt</strong><strong>'+money(demoTotal(cart))+'</strong></div>';
}
function showCart(){$('cartSuggestionsDisclosure').open=false;renderCartContents();show('cartSheet');checkoutNavigate('cart');updateOrderingControls()}
