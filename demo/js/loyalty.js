/** One capped pizza reward per phone; confirmed redemption starts a new cycle. */
export function loyaltyPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0047/, '').replace(/^47(?=\d{8}$)/, '');
  return /^[49]\d{7}$/.test(digits) ? digits : '';
}
export function largePizza(section, size) {
  return (section?.type === 'pizza' || /pizza/i.test(section?.title || '')) && /^(stor|store|large|big|büyük)\b/i.test(String(size?.label || size || '').trim());
}
export function pizzaBonus(events) {
  let count = 0, cycle = 'start';
  for (const event of Object.values(events || {}).sort((a,b) => a.at - b.at || String(a.id).localeCompare(String(b.id)))) {
    if (event.redeemed && count === 10) { count = 0; cycle = event.id; }
    else count = Math.min(10, count + Math.max(0, Number(event.quantity) || 0));
  }
  return { count, cycle, ready: count === 10 };
}
export function historicalPizzaEvents(orders, phone, sections) {
  const events = {};
  for (const order of orders || []) {
    if (loyaltyPhone(order.phone) !== phone || !['bekreftet','tilberedning','klar','fullfort'].includes(order.status)) continue;
    const quantity = (order.lines || []).reduce((sum,line) => {
      const section = sections.find(s => s.items?.some(item => item.id === line.itemId));
      return sum + (!line.loyaltyFree && (line.loyaltyEligible || largePizza(section, line.size)) ? Number(line.quantity) || 0 : 0);
    },0);
    events[order.id] = { id: order.id, at: order.loyaltyConfirmedAt || order.createdAt, quantity, redeemed: Boolean(order.loyaltyReward) };
  }
  return events;
}
