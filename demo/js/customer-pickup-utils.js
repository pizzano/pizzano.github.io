/* Pure customer-side contact and pickup calculations.
   Keep order-writing logic in data.js and checkout events in customer.js. */
export function validPhone(value) {
  return /^[49]\d{7}$/.test(String(value).replace(/\s/g, ''));
}

export function resolveScheduledPickupAt(value, now = new Date()) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}
