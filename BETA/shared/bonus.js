'use strict';
/* Shared pure pizza bonus calculations. No network or browser dependencies. */
function bonusPlan(items,sections,sizeLabels=[]){
 const arr=v=>Array.isArray(v)?v:Object.values(v||{});
 const products=new Map();
 for(const section of arr(sections))for(const product of arr(section.items))products.set(String(product.id),{section,product});
 let count=0,index=-1,discount=0;
 items.forEach((line,i)=>{
  const match=products.get(String(line.id));if(!match)return;
  const {section,product}=match;
  const size=arr(product.sizes).find(x=>String(x.id)===String(line.size?.id));
  if(!size||!(section.type==='pizza'||/pizza/i.test(section.title||section.name||''))||!/^(stor|store|large|big|büyük)\b/i.test(String(sizeLabels[size.labelId]||size.label||size.name||'')))return;
  const qty=Number(line.qty),price=Number(size.price??product.price);
  if(!Number.isInteger(qty)||qty<1||qty>99||!Number.isFinite(price)||price<=0)return;
  count+=qty;
  if(index<0||price<discount){index=i;discount=price;}
 });
 return {count,index,discount};
}
function bonusBalance(count,last,now=Date.now()){
 return Number(last)>0&&now-Number(last)>=365*86400000?0:Math.min(11,Math.max(0,Math.floor(Number(count)||0)));
}
function bonusCanRedeem(balance,count){return count>0&&balance+count>=11;}
function bonusAfterApproval(balance,count,redeemed){return Math.min(11,balance+count-(redeemed?11:0));}
