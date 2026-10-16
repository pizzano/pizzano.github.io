/** Sample content only — no production menu or prices are imported. */
export const sampleCatalog = Object.freeze([
  { id:'pizza-margherita', category:'Pizza', name:'Margherita', description:'Tomatsaus, mozzarella og basilikum', sizes:[
    {id:'medium',label:'Medium',price:199},{id:'stor',label:'Stor',price:269}] },
  { id:'pizza-pepperoni', category:'Pizza', name:'Pepperoni', description:'Tomatsaus, ost og pepperoni', sizes:[
    {id:'medium',label:'Medium',price:219},{id:'stor',label:'Stor',price:294}] },
  { id:'burger-classic', category:'Burger', name:'Hamburger Tallerken', description:'Burger med pommes frites og salat', sizes:[
    {id:'standard',label:'Standard',price:209}] },
  { id:'kebab-pita', category:'Kebab', name:'Kebab i pita', description:'Kebabkjøtt, grønnsaker og dressing', sizes:[
    {id:'standard',label:'Standard',price:159}] },
]);
export const sampleCategories = Object.freeze(['Alle', ...new Set(sampleCatalog.map(p=>p.category))]);
export function findProduct(id) { return sampleCatalog.find(product=>product.id===id) || null; }
