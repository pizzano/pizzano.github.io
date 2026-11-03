/* Pure pickup slot calculation. All times are minutes on the restaurant's
   local clock. The caller supplies opening state and the Oslo-local minute.
   This never reads Firebase or the user's machine timezone. */
export function calculatePickupSlots({
  open = false,
  preOpen = false,
  minutesToClose = 0,
  nowMinute = 0,
  openMinute = null,
  closeMinute = null,
  pickupLeadMinutes = 30,
  interval = 15,
  closingBuffer = 10,
  limit = 96,
} = {}) {
  if (!open && !preOpen) return [];
  const prep = Math.min(240, Math.max(15, Number(pickupLeadMinutes) || 30));
  const remaining = Number(minutesToClose) || 0;
  if (open && remaining <= 0) return [];
  if (preOpen && (!Number.isInteger(openMinute) || !Number.isInteger(closeMinute))) return [];
  const latest = preOpen
    ? closeMinute + (closeMinute <= openMinute ? 1440 : 0) - closingBuffer
    : nowMinute + remaining - closingBuffer;
  const first = preOpen ? openMinute + prep : nowMinute + prep;
  const format = m => {
    const n = ((Math.round(m) % 1440) + 1440) % 1440;
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' +
      String(n % 60).padStart(2, '0');
  };
  const slots = [];
  for (let m = Math.ceil(first / interval) * interval;
       m <= latest && slots.length < limit; m += interval) {
    const value = format(m);
    slots.push({ value, label: value });
  }
  return slots;
}
