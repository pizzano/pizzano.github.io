/**
 * KØL — background pizza coupon counter (restaurant admin only).
 * Reuses the existing order listener. Never delays order acceptance.
 */
import { DB_URL, getOrders, ready, store, subscribe } from './data.js?v=20261017-email1';
import { historicalPizzaEvents, loyaltyPhone, pizzaBonus } from './loyalty.js';

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const processed = new Map();
let timer = null, running = false, rerun = false;

function recentPhones() {
  const cutoff = Date.now() - LOOKBACK_MS;
  const groups = new Map();
  for (const order of getOrders()) {
    if (!order?.id || !['bekreftet','tilberedning','klar','fullfort'].includes(order.status)) continue;
    const at = Number(order.loyaltyConfirmedAt) || 0;
    if (at < cutoff) continue;
    const phone = loyaltyPhone(order.phone);
    if (!phone) continue;
    if (!groups.has(phone)) groups.set(phone, []);
    groups.get(phone).push(order.id + ':' + at);
  }
  // getOrders() is newest-first; prioritize new orders, never old history.
  return [...groups].map(([phone, ids]) => ({
    phone, signature: ids.sort().join('|'),
  })).slice(0, 50);
}

async function syncPhone(phone) {
  // Existing orders are already in the admin's memory: no extra /orders GET.
  const history = historicalPizzaEvents(getOrders(), phone, store.sections);
  const url = DB_URL + '/pizzaBonus/' + encodeURIComponent(phone) + '.json';
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      method: 'GET', headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store',
    });
    if (!response.ok) throw new Error('Bonus GET ' + response.status);
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Bonus ETag mangler.');
    const account = await response.json() || {};
    const existingEvents = account.events && typeof account.events === 'object'
      ? account.events : {};
    const events = { ...history, ...existingEvents };
    const state = pizzaBonus(events);
    const eventCount = Object.keys(events).length;
    const consent = account.offersConsent === true;
    const missing = Object.keys(history).some(id =>
      !Object.prototype.hasOwnProperty.call(existingEvents, id));
    if (!missing && account.pizzaCountSynced === true &&
        account.pizzaCount === state.count &&
        account.pizzaCycle === state.cycle &&
        account.pizzaReady === state.ready &&
        account.pizzaCountedEvents === eventCount &&
        account.offersConsent === consent) return;
    const next = {
      ...account, events,
      pizzaCount: state.count,
      pizzaCycle: state.cycle,
      pizzaReady: state.ready,
      pizzaCountedEvents: eventCount,
      pizzaCountSynced: true,
      offersConsent: consent,
    };
    const saved = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(next),
    });
    if (saved.status === 412) continue;
    if (!saved.ok) throw new Error('Bonus PUT ' + saved.status);
    return;
  }
  throw new Error('Bonus-konto ble endret samtidig.');
}

async function syncRecentlyAccepted() {
  if (running) { rerun = true; return; }
  if (!DB_URL || document.hidden || navigator.onLine === false) return;
  running = true;
  try {
    for (const { phone, signature } of recentPhones()) {
      if (processed.get(phone) === signature) continue;
      try {
        await syncPhone(phone);
        processed.set(phone, signature);
      } catch (error) {
        console.warn('Pizzabonus synkronisering venter:', error.message);
      }
    }
  } finally {
    running = false;
    if (rerun) { rerun = false; scheduleSync(); }
  }
}

function scheduleSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncRecentlyAccepted(); }, 1400);
}

// Only remote-confirmed status changes are counted, not optimistic local UI.
subscribe((_state, origin) => { if (origin === 'remote') scheduleSync(); });
ready().then(scheduleSync);
window.addEventListener('online', scheduleSync);
window.addEventListener('kol-order-confirmed', scheduleSync);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleSync();
});
setInterval(() => { void syncRecentlyAccepted(); }, 60 * 1000);
