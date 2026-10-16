/** Mock-only order transition rules, designed for future server-side reuse. */
export const ORDER_STATES=Object.freeze(['mottatt','bekreftet','klar','fullfort','avvist']);
const ALLOWED=Object.freeze({
  mottatt:['bekreftet','avvist'], bekreftet:['klar','avvist'],
  klar:['fullfort'], fullfort:[], avvist:[]
});
export function createTestOrder(input, now=Date.now()) {
  const customerName=String(input.customerName||'').trim().slice(0,100);
  const phone=String(input.phone||'').replace(/\D/g,'');
  const email=String(input.email||'').trim().toLowerCase().slice(0,254);
  if(!customerName) throw new Error('Fyll inn hele navnet');
  if(!/^[49]\d{7}$/.test(phone)) throw new Error('Oppgi et gyldig norsk mobilnummer');
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ugyldig e-postadresse');
  if(!Array.isArray(input.lines) || !input.lines.length) throw new Error('Handlekurven er tom');
  const total=Number(input.total);
  if(!Number.isSafeInteger(total)||total<0) throw new Error('Ugyldig total');
  return {
    id:'beta_'+now.toString(36)+'_'+Math.random().toString(36).slice(2,8),
    customerName, phone, email, lines:input.lines.map(line=>({...line})),
    total, status:'mottatt',createdAt:now,statusUpdatedAt:now,
    estimatedReadyAt:null,staffReadyAt:null,
    notifications:{sms:'disabled',email:'disabled'}
  };
}
export function canTransition(order,nextStatus) {
  return Boolean(order && ALLOWED[order.status]?.includes(nextStatus));
}
export function transitionTestOrder(order,nextStatus,{minutes=20,now=Date.now()}={}) {
  if(!canTransition(order,nextStatus)) throw new Error('Ugyldig statusovergang');
  const result={...order,status:nextStatus,statusUpdatedAt:now};
  if(nextStatus==='bekreftet') {
    if(!Number.isInteger(minutes) || minutes<1 || minutes>180) throw new Error('Ugyldig hentetid');
    result.estimatedReadyAt=now+minutes*60000;
  }
  if(nextStatus==='klar') result.staffReadyAt=now;
  return result;
}
