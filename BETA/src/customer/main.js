import {sampleCatalog,sampleCategories,findProduct} from '../data/catalog.js';
import {addToCart,changeQuantity,cartQuantity,cartTotal} from '../domain/cart.js';
import {createTestOrder} from '../domain/orders.js';
import {loadCart,saveCart,saveOrder,getOrder} from '../data/mock-db.js';
import {nok,timeOf,safeText} from '../shared/format.js';
import {BETA_CONFIG} from '../config.js';

const byId=id=>document.getElementById(id);
const state={category:'Alle',query:'',cart:loadCart(),lastOrderId:null};
try {state.lastOrderId=localStorage.getItem(BETA_CONFIG.storagePrefix+':lastOrderId');}
catch { /* localStorage might be unavailable in privacy mode */ }

function updateCart(next){
  try {saveCart(next);state.cart=next;renderCart();}
  catch(error){message(error.message);}
}
function message(text,success=false){
  const node=byId('formMessage');
  node.textContent=text;
  node.classList.toggle('success',success);
}
function renderCategories(){
  const nav=byId('categories');
  nav.innerHTML=sampleCategories.map(category=>`<button type="button" class="category-tab"
    data-category="${safeText(category)}" aria-pressed="${String(state.category===category)}">${safeText(category)}</button>`).join('');
}
function renderProducts(){
  const query=state.query.toLocaleLowerCase('nb-NO');
  const products=sampleCatalog.filter(product=>
    (state.category==='Alle'||product.category===state.category) &&
    (product.name.toLocaleLowerCase('nb-NO').includes(query)
      || product.description.toLocaleLowerCase('nb-NO').includes(query)));
  byId('products').innerHTML=products.length?products.map(product=>`
    <article class="product-card">
      <div><div class="product-category">${safeText(product.category)}</div>
        <h3>${safeText(product.name)}</h3></div>
      <p>${safeText(product.description)}</p>
      <div class="product-controls">
        <select id="size-${safeText(product.id)}" aria-label="Størrelse for ${safeText(product.name)}">
          ${product.sizes.map(size=>`<option value="${safeText(size.id)}">${safeText(size.label)} · ${nok(size.price)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" type="button" data-add="${safeText(product.id)}">+ Legg til</button>
      </div>
    </article>`).join(''):'<div class="empty-state">Ingen produkter funnet.</div>';
}
function renderCart(){
  const qty=cartQuantity(state.cart);
  byId('cartCount').textContent=String(qty);
  byId('cartTotal').textContent=nok(cartTotal(state.cart));
  byId('placeOrder').disabled=qty===0;
  byId('cartLines').innerHTML=state.cart.length?state.cart.map(line=>`
    <div class="cart-row">
      <div class="cart-name">${safeText(line.name)}</div>
      <div class="cart-meta">${safeText(line.sizeLabel)} · ${nok(line.price)} per stk.</div>
      <div class="cart-controls">
        <span class="counter"><button data-qty="-1" data-key="${safeText(line.key)}" type="button" aria-label="Fjern én ${safeText(line.name)}">−</button>
          ${line.quantity}
          <button data-qty="1" data-key="${safeText(line.key)}" type="button" aria-label="Legg til én ${safeText(line.name)}">+</button></span>
        <strong>${nok(line.price*line.quantity)}</strong>
      </div>
    </div>`).join(''):'<div class="cart-empty">Handlekurven er tom. Legg til noe godt fra menyen!</div>';
}
function renderRecent(){
  const node=byId('recentOrder');
  const order=state.lastOrderId?getOrder(state.lastOrderId):null;
  node.hidden=!order;
  if(!order){node.innerHTML='';return;}
  const ready=order.estimatedReadyAt?` · Hentetid ${timeOf(order.estimatedReadyAt)}`:'';
  node.innerHTML=`<h3>Siste testbestilling</h3>
    <p class="micro-note">${safeText(order.id)} · ${timeOf(order.createdAt)}</p>
    <p><span class="status-chip">${safeText(order.status.toUpperCase())}${safeText(ready)}</span></p>
    <p class="micro-note">Ingen ekte SMS eller e-post sendes fra BETA.</p>`;
}
byId('categories').addEventListener('click',event=>{
  const button=event.target.closest('[data-category]');
  if(!button)return;
  state.category=button.dataset.category;renderCategories();renderProducts();
});
byId('productSearch').addEventListener('input',event=>{state.query=event.target.value.trim();renderProducts();});
byId('products').addEventListener('click',event=>{
  const button=event.target.closest('[data-add]');
  if(!button)return;
  const product=findProduct(button.dataset.add);
  if(!product)return;
  const size=byId('size-'+product.id)?.value;
  updateCart(addToCart(state.cart,product,size));
  message('');
});
byId('cartLines').addEventListener('click',event=>{
  const button=event.target.closest('[data-qty]');
  if(!button)return;
  updateCart(changeQuantity(state.cart,button.dataset.key,Number(button.dataset.qty)));
});
byId('checkoutForm').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;
  try {
    const order=createTestOrder({
      customerName:byId('customerName').value,
      phone:byId('customerPhone').value,
      email:byId('customerEmail').value,
      lines:state.cart,total:cartTotal(state.cart)
    });
    saveOrder(order);
    updateCart([]);
    state.lastOrderId=order.id;
    try{localStorage.setItem(BETA_CONFIG.storagePrefix+':lastOrderId',order.id);}catch{}
    message('Testbestilling opprettet! Åpne Restaurantvisning for å bekrefte.',true);
    renderRecent();
    form.querySelector('button[type="submit"]').blur();
  }catch(error){message(error.message);}
});
window.addEventListener('storage',event=>{
  if(event.key?.startsWith(BETA_CONFIG.storagePrefix+':')){
    state.cart=loadCart();renderCart();renderRecent();
  }
});
window.addEventListener('beta:orders-updated',renderRecent);
renderCategories();renderProducts();renderCart();renderRecent();
