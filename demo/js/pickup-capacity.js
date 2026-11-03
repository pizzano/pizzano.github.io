/* Privacy-safe pickup load: aggregate counts only; never customer details.
 * Advisory until a backend-enforced atomic reservation service exists. */
export const LOAD_FRESH_MS = 90000;
const statuses = new Set(['mottatt','bekreftet','tilberedning']);

function osloParts(time, timezone = 'Europe/Oslo') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(new Date(time));
  const take = key => parts.find(p => p.type === key)?.value || '00';
  return {date:take('year') + take('month') + take('day'),
    clock: take('hour') + take('minute'),
    minutes: Number(take('hour')) * 60 + Number(take('minute'))};
}
function nextDate(date) {
  const y=Number(date.slice(0,4)),m=Number(date.slice(4,6)),d=Number(date.slice(6,8));
  const next = new Date(Date.UTC(y,m-1,d+1));
  return next.toISOString().slice(0,10).replace(/-/g,'');
}

export function pickupSlotKey(clock, {at=Date.now(), preOpen=false,openMinute=null,
  timezone='Europe/Oslo'} = {}) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(clock))) return '';
  const now = osloParts(at,timezone);
  const minute=Number(clock.slice(0,2))*60+Number(clock.slice(3));
  const crossesMidnight = preOpen
    ? Number.isInteger(openMinute) && minute < openMinute
    : minute < now.minutes;
  return (crossesMidnight?nextDate(now.date):now.date) + '_' + clock.replace(':','');
}

export function publicPickupLoad(orders, at=Date.now(),timezone='Europe/Oslo') {
  const slots={};
  for(const order of orders || []) {
    if (!order || !statuses.has(order.status)) continue;
    const when=Number(order.scheduledPickupAt)||0;
    // Exclude older or implausibly far-out orders; do not infer missing timestamps.
    if (!when || when < at - 900000 || when > at + 2*86400000) continue;
    const local=osloParts(when,timezone);
    const key=local.date+'_'+local.clock;
    slots[key]=(slots[key]||0)+1;
  }
  return {updatedAt:at,slots};
}

export function pickupLoadFresh(snapshot,at=Date.now()) {
  const timestamp=Number(snapshot?.updatedAt);
  return !!snapshot && Number.isFinite(timestamp) && timestamp>0 &&
    timestamp <= at+60000 && at-timestamp < LOAD_FRESH_MS &&
    snapshot.slots && typeof snapshot.slots==='object' && !Array.isArray(snapshot.slots);
}

export function capacityFilteredSlots(slots,settings={},snapshot=null,
  context={}) {
  if (settings.pickupCapacityEnabled !== true) return slots;
  const limit = Math.round(Number(settings.pickupCapacityMax)||0);
  if (limit < 1 || !pickupLoadFresh(snapshot,context.at)) return slots;
  return slots.filter(slot=>{
    const key=pickupSlotKey(slot.value,context);
    const count=Number(snapshot.slots[key])||0;
    return !key || count < limit;
  });
}

export function effectivePickupLead(settings={}) {
  const base=Math.min(240,Math.max(15,Math.round(Number(settings.pickupLeadMinutes)||30)));
  const extra=settings.busyModeEnabled===true
    ? Math.max(0,Math.min(90,Math.round(Number(settings.busyExtraMinutes)||0))) : 0;
  return Math.min(240,base+extra);
}

export function busyAcceptMinutes(settings={}) {
  const extra=settings.busyModeEnabled===true
    ? Math.max(0,Math.min(90,Math.round(Number(settings.busyExtraMinutes)||0))) : 0;
  return Math.min(180,15+extra);
}
