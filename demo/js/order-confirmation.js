export const ORDER_CONFIRM_WAIT_MS = 3 * 60 * 1000;
export function confirmationDeadline(order) {
  return Number(order?.confirmationDeadline) || (Number(order?.createdAt) > 0 ? Number(order.createdAt) + ORDER_CONFIRM_WAIT_MS : 0);
}
export function confirmationExpired(order, now = Date.now()) {
  const deadline = confirmationDeadline(order);
  return order?.status === 'mottatt' && deadline > 0 && now >= deadline;
}
export function confirmationRemaining(order, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((confirmationDeadline(order) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
