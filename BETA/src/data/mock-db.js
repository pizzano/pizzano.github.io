import { BETA_CONFIG } from '../config.js';
import { validateCart } from '../domain/cart.js';
const CART_KEY=BETA_CONFIG.storagePrefix+':cart';
const ORDERS_KEY=BETA_CONFIG.storagePrefix+':orders';

function read(key, fallback) {
  try { const data=JSON.parse(localStorage.getItem(key)||'null');return data??fallback; }
  catch { return fallback; }
}
function write(key,data){localStorage.setItem(key,JSON.stringify(data));}
export function loadCart(){const cart=read(CART_KEY,[]);return validateCart(cart)?cart:[];}
export function saveCart(cart){if(!validateCart(cart))throw new Error('Ugyldig handlekurv');write(CART_KEY,cart);}
export function loadOrders(){
  const orders=read(ORDERS_KEY,[]);
  if(!Array.isArray(orders))return [];
  return orders.filter(row=>row && typeof row.id==='string' && typeof row.status==='string')
    .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))
    .slice(0,BETA_CONFIG.maxMockOrders);
}
export function saveOrder(order){
  const orders=loadOrders().filter(item=>item.id!==order.id);
  write(ORDERS_KEY,[order,...orders].slice(0,BETA_CONFIG.maxMockOrders));
  window.dispatchEvent(new CustomEvent('beta:orders-updated'));
}
export function getOrder(id){return loadOrders().find(order=>order.id===id)||null;}
export function clearMockData(){
  localStorage.removeItem(CART_KEY);localStorage.removeItem(ORDERS_KEY);
  window.dispatchEvent(new CustomEvent('beta:orders-updated'));
}
