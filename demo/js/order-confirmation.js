export const ORDER_CONFIRM_WAIT_MS = 3 * 60 * 1000;
export function confirmationDeadline(order) {
  if (order?.confirmationNoTimeout === true) return 0;
  return Number(order?.confirmationDeadline) || (Number(order?.createdAt) > 0 ? Number(order.createdAt) + ORDER_CONFIRM_WAIT_MS : 0);
}
export function confirmationExpired(order, now = Date.now()) {
  const deadline = confirmationDeadline(order);
  return order?.status === 'mottatt' && deadline > 0 && now >= deadline;
}
export function confirmationRemaining(order, now = Date.now()) {
  if (order?.confirmationNoTimeout === true) return 'Uten tidsfrist';
  const seconds = Math.max(0, Math.ceil((confirmationDeadline(order) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}


/** Alarm is only for unconfirmed orders. Preorders stay silent until opening.
 * Opening never adds a three-minute deadline to a preorder. */
export function shouldSoundPendingOrder(order, restaurantOpen, now = Date.now()) {
  return order?.status === 'mottatt'
    && !confirmationExpired(order, now)
    && (!order.confirmationNoTimeout || restaurantOpen === true);
}

/**
 * Order links follow the deployed page URL, never a hard-coded domain or /demo/.
 *
 * https://site.no/demo/index.html -> https://site.no/demo/
 * https://site.no/demo/admin.html -> https://site.no/demo/
 * https://site.no/index.html      -> https://site.no/
 * https://other.no/shop/          -> https://other.no/shop/
 */
export function customerPageBaseUrl(pageUrl = window.location.href) {
  const current = new URL(pageUrl);
  if (!['https:', 'http:'].includes(current.protocol)) {
    throw new Error('Ugyldig adresse til bestillingssiden.');
  }
  const path = current.pathname;
  const directory = path.endsWith('/')
    ? path
    : path.slice(0, path.lastIndexOf('/') + 1);
  return current.origin + directory;
}

export function customerOrderLink(orderId, pageUrl = window.location.href) {
  const id = String(orderId || '').trim();
  if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(id)) {
    throw new Error('Ugyldig bestillings-ID.');
  }
  const link = new URL(customerPageBaseUrl(pageUrl));
  link.searchParams.set('order', id);
  return link.href;
}
