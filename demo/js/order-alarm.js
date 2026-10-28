import { confirmationExpired } from './order-confirmation.js';

/** Alarm is only for unconfirmed orders. Preorders stay silent until opening.
 * Opening never adds a three-minute deadline to a preorder. */
export function shouldSoundPendingOrder(order, restaurantOpen, now = Date.now()) {
  return order?.status === 'mottatt'
    && !confirmationExpired(order, now)
    && (!order.confirmationNoTimeout || restaurantOpen === true);
}
