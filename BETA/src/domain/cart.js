/** Immutable, browser-independent cart rules. Prices are NOK integers. */
export function addToCart(cart, product, sizeId) {
  if (!product || !Array.isArray(product.sizes)) throw new Error('Ukjent produkt');
  const size=product.sizes.find(entry=>entry.id===sizeId);
  if(!size || !Number.isInteger(size.price) || size.price<0) throw new Error('Ukjent størrelse');
  const key=product.id+':'+size.id;
  const current=cart.find(line=>line.key===key);
  return current
    ? cart.map(line=>line.key===key ? {...line,quantity:Math.min(99,line.quantity+1)} : line)
    : [...cart,{key,productId:product.id,sizeId:size.id,name:product.name,sizeLabel:size.label,price:size.price,quantity:1}];
}
export function changeQuantity(cart,key,delta) {
  if(!Number.isInteger(delta) || ![-1,1].includes(delta)) throw new Error('Ugyldig endring');
  return cart.map(line=>line.key===key ? {...line,quantity:Math.min(99,Math.max(0,line.quantity+delta))} : line)
    .filter(line=>line.quantity>0);
}
export function cartTotal(cart) {
  return cart.reduce((sum,line)=>sum+line.price*line.quantity,0);
}
export function cartQuantity(cart) {
  return cart.reduce((sum,line)=>sum+line.quantity,0);
}
export function validateCart(cart) {
  return Array.isArray(cart) && cart.every(line=>line
    && typeof line.key==='string' && typeof line.name==='string'
    && Number.isInteger(line.price) && line.price>=0
    && Number.isInteger(line.quantity) && line.quantity>=1 && line.quantity<=99);
}
