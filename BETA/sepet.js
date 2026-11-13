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
 initCheckoutEvents();
}

/* BETA basket steps: contact, pickup and local order review.
 * Contact details may sync to Firebase; orders are still local-only.
 */
const DEMO_CONTACT_KEY='kol-beta-demo-contact-v1';
const DEMO_PICKUP_KEY='kol-beta-demo-pickup-v1';
const DEMO_ORDER_KEY='kol-beta-demo-order-v1';
function demoRead(key,fallback){
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');return saved&&typeof saved==='object'?saved:fallback}
 catch{return fallback}
}
function demoStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
let demoContact=demoRead(DEMO_CONTACT_KEY,{name:'',phone:'',email:''});
let demoPickup=demoRead(DEMO_PICKUP_KEY,{mode:'asap',time:'',label:''});
let demoOrder=demoRead(DEMO_ORDER_KEY,null);
let checkoutStep='cart',demoClock=null;
function formatDemoClock(ms){
 const seconds=Math.max(0,Math.ceil(ms/1000));
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function demoStatus(){
 if(!demoOrder)return 'none';
 if(demoOrder.status==='pending'&&Number(demoOrder.expiresAt)<=Date.now()){
  demoOrder.status='expired';
  demoStore(DEMO_ORDER_KEY,demoOrder);
 }
 return demoOrder.status;
}
function renderDemoActiveOrder(){
 const card=$('demoActiveOrder');
 if(!card)return;
 card.hidden=!demoOrder;
 if(!demoOrder)return;
 const pending=demoStatus()==='pending';
 $('demoActiveNumber').textContent='#'+demoOrder.id;
 $('demoActiveTitle').textContent=pending?'Bestillingsoversikt':'Bestillingsoversikt';
 $('demoActiveSubtitle').textContent=pending?
  'Lagret på denne enheten · Ikke sendt til restauranten':
  'Lagret på denne enheten · Ikke sendt til restauranten';
 if(!$('demoConfirmation').hidden)renderDemoConfirmation();
 if(pending&&!demoClock){
  demoClock=window.setInterval(()=>{
   if(!demoOrder){clearInterval(demoClock);demoClock=null;return}
   renderDemoActiveOrder();
   if(demoStatus()!=='pending'){clearInterval(demoClock);demoClock=null}
  },1000);
 }
}
function renderDemoConfirmation(){
 if(!demoOrder)return;
 const pending=demoStatus()==='pending';
 $('demoConfirmationTitle').textContent='Bestillingsoversikt';
 $('demoConfirmationIntro').textContent='Takk, '+(demoOrder.customer?.fullName||'')+'! Her er bestillingsoversikten din.';
 $('demoConfirmationNumber').textContent=demoOrder.id;
 $('demoConfirmationPickup').textContent=demoOrder.pickup?.label||'Snarest';
 $('demoConfirmationTotal').textContent=money(demoOrder.total);
 $('demoConfirmationStatus').textContent='Ikke sendt til restauranten';
 $('demoConfirmationTimer').textContent=pending?
  'Oversikten er lagret på denne enheten':
  'Oversikten er lagret på denne enheten';
}
function showDemoConfirmation(){
 if(!demoOrder)return;
 hideAll();
 renderDemoConfirmation();
 show('demoConfirmation');
}
function showCheckoutError(message,field){
 const error=$('checkoutError');
 error.textContent=message;
 error.hidden=!message;
 if(field)$(field).focus();
}
function updateContactValidation(){
 const fields=[
  ['demoFullName',v=>v.trim().length>=2],
  ['demoPhone',v=>/^[49]\d{7}$/.test(v.replace(/\D/g,''))],
  ['demoEmail',v=>v.trim().length>0&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())]
 ];
 for(const [id,check] of fields){
  const input=$(id);
  input?.closest('.checkout-field')?.classList.toggle('is-valid',check(input?.value||''));
 }
}
function saveDemoContact(){
 demoContact={
  name:$('demoFullName').value.trim(),
  phone:$('demoPhone').value.replace(/\D/g,'').slice(0,8),
  email:$('demoEmail').value.trim()
 };
 demoStore(DEMO_CONTACT_KEY,demoContact);
}
// BETA contact is saved only when the customer proceeds from the contact step.
// Use the same 8-digit customer key as the existing loyalty rollup.
let customerSavedSignature='',customerSavePending=null;
async function syncBetaCustomer(){
 const name=demoContact.name.trim().replace(/\s+/g,' ').slice(0,120);
 const phone=demoContact.phone;
 const email=demoContact.email.trim().toLowerCase().slice(0,200);
 if(name.length<2||!/^[49]\d{7}$/.test(phone)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return false;
 const signature=JSON.stringify([name,phone,email]);
 if(signature===customerSavedSignature)return true;
 if(customerSavePending)await customerSavePending;
 if(signature===customerSavedSignature)return true;
 customerSavePending=(async()=>{
  try{
   // PATCH touches contact fields only; loyalty totals remain untouched.
   const response=await fetch(BASE+'/customers/'+phone+'.json',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,email})
   });
   if(!response.ok)throw new Error('Firebase HTTP '+response.status);
   customerSavedSignature=signature;
   return true;
  }catch(error){
   console.warn('BETA customer sync failed:',error);
   return false;
  }
 })();
 try{return await customerSavePending}
 finally{customerSavePending=null}
}
function validateDemoContact(){
 saveDemoContact();
 if(demoContact.name.length<2){showCheckoutError('Skriv inn hele navnet ditt.','demoFullName');return false}
 if(!/^[49]\d{7}$/.test(demoContact.phone)){showCheckoutError('Mobilnummer må ha 8 siffer.','demoPhone');return false}
 if(demoContact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demoContact.email)){
  showCheckoutError('Kontroller e-postadressen, eller la feltet stå tomt.','demoEmail');return false
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
function demoPickupSlots(){
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
function renderDemoPickupChoices(){
 const asap=demoPickup.mode!=='scheduled';
 $('demoAsapOption').classList.toggle('is-selected',asap);
 $('demoScheduledOption').classList.toggle('is-selected',!asap);
 document.querySelectorAll('input[name="demoPickupMode"]').forEach(x=>x.checked=x.value===(asap?'asap':'scheduled'));
 $('demoPickupTimeBox').hidden=asap;
 const slots=demoPickupSlots(),select=$('demoPickupTime');
 select.replaceChildren(...slots.map(slot=>new Option(slot.label,slot.value)));
 if(slots.some(x=>x.value===demoPickup.time))select.value=demoPickup.time;
 else{
  demoPickup.time=slots[0]?.value||'';
  demoPickup.label=slots[0]?.label||'';
 }
 select.disabled=!slots.length;
 if(!asap)demoStore(DEMO_PICKUP_KEY,demoPickup);
}
function checkoutNavigate(step){
 checkoutStep=step;
 $('cartCartStep').hidden=step!=='cart';
 $('cartContactStep').hidden=step!=='contact';
 $('cartPickupStep').hidden=step!=='pickup';
 const rank={cart:0,contact:1,pickup:2};
 document.querySelectorAll('.cart-steps [data-checkout-step]').forEach(el=>{
  const index=rank[el.dataset.checkoutStep];
  el.classList.toggle('is-current',index===rank[step]);
  el.classList.toggle('is-done',index<rank[step]);
 });
 $('continue').textContent=step==='cart'?'Fortsett å handle':step==='contact'?'Tilbake: Kurv':'Tilbake: Kontakt';
 $('cartNext').textContent=step==='cart'?'Neste: Kontakt':step==='contact'?'Neste: Hentetid':'Lagre bestillingsoversikt';
 $('cartNext').disabled=step==='cart'&&!cart.length;
 showCheckoutError('');
 if(step==='contact'){
  $('demoFullName').value=demoContact.name||'';
  $('demoPhone').value=demoContact.phone||'';
  $('demoEmail').value=demoContact.email||'';
  updateContactValidation();
 }
 if(step==='pickup'){
  $('cartPickupStep').querySelector('.checkout-order-preview').open=false;
  renderDemoPickupChoices();
  pickupSummary();
 }
 $('cartScroll').scrollTo({top:0,behavior:'instant'});
}
function demoOrderId(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const bytes=new Uint8Array(6);
 if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
 else for(let i=0;i<6;i++)bytes[i]=Math.floor(Math.random()*256);
 return Array.from(bytes,x=>alphabet[x%alphabet.length]).join('');
}
function submitDemoOrder(){
 if(!cart.length){checkoutNavigate('cart');return}
 if(!validateDemoContact()){checkoutNavigate('contact');showCheckoutError('Kontroller kontaktinformasjonen.');return}
 const pickup=demoPickup.mode==='scheduled'?
  {mode:'scheduled',time:demoPickup.time,label:$('demoPickupTime').selectedOptions[0]?.textContent||demoPickup.label}:
  {mode:'asap',time:null,label:'Snarest'};
 if(pickup.mode==='scheduled'&&!demoPickupSlots().some(x=>x.value===pickup.time)){
  showCheckoutError('Velg en gyldig hentetid.','demoPickupTime');return;
 }
 const timestamp=Date.now();
 // Future admin connection point: send this versioned shape to the order API.
 // For the demo the ONLY side effect is localStorage; no network requests.
 const newOrder={
  schema:1,source:'BETA_LOCAL_DEMO',channel:'web',fulfillment:'pickup',
  id:demoOrderId(),status:'pending',
  createdAt:new Date(timestamp).toISOString(),expiresAt:timestamp+180000,
  customer:{fullName:demoContact.name,phone:'+47'+demoContact.phone,email:demoContact.email||null},
  pickup:{...pickup,timeZone:'Europe/Oslo'},
  items:JSON.parse(JSON.stringify(cart)),total:demoTotal(cart),currency:'NOK'
 };
 // Single integration seam: later replace this local persistence with an
 // explicit admin-order submission, without changing the form or prices.
 if(!demoStore(DEMO_ORDER_KEY,newOrder)){
  showCheckoutError('Kunne ikke lagre testbestillingen lokalt. Kontroller nettleserens lagring.');
  return;
 }
 demoOrder=newOrder;
 cart=[];saveCart();
 renderDemoActiveOrder();
 showDemoConfirmation();
}
async function demoNext(){
 if(checkoutStep==='cart'){
  if(cart.length)checkoutNavigate('contact');
 }else if(checkoutStep==='contact'){
  if(validateDemoContact()){
   $('cartNext').disabled=true;
   try{
    if(await syncBetaCustomer())checkoutNavigate('pickup');
    else showCheckoutError('Kundeopplysningene kunne ikke lagres. Prøv igjen, eller kontakt restauranten.');
   }finally{$('cartNext').disabled=false}
  }
 }else submitDemoOrder();
}
function demoBack(){
 if(checkoutStep==='cart')hideAll();
 else checkoutNavigate(checkoutStep==='pickup'?'contact':'cart');
}


function returnToMenu(){
 hideAll();
 $('appViewport').scrollTo({top:0,behavior:'instant'});
 window.scrollTo({top:0,behavior:'instant'});
 $('appViewport').classList.remove('nav-hidden');
}

function initCheckoutEvents(){
$('continue').onclick=demoBack;
$('cartNext').onclick=demoNext;
['demoFullName','demoPhone','demoEmail'].forEach(id=>$(id).addEventListener('input',()=>{saveDemoContact();updateContactValidation();showCheckoutError('')}));
$('cartContactStep').addEventListener('submit',event=>{event.preventDefault();demoNext()});
document.querySelectorAll('input[name="demoPickupMode"]').forEach(input=>input.addEventListener('change',event=>{demoPickup.mode=event.target.value;renderDemoPickupChoices();demoStore(DEMO_PICKUP_KEY,demoPickup)}));
$('demoPickupTime').addEventListener('change',event=>{demoPickup.time=event.target.value;demoPickup.label=event.target.selectedOptions[0]?.textContent||'';demoStore(DEMO_PICKUP_KEY,demoPickup)});
$('demoViewOrder').onclick=showDemoConfirmation;
$('demoConfirmationClose').onclick=returnToMenu;
$('demoClearOrder').onclick=()=>{demoOrder=null;demoStore(DEMO_ORDER_KEY,null);if(demoClock){clearInterval(demoClock);demoClock=null}renderDemoActiveOrder()};
}
