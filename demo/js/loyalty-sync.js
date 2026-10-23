/**
 * KØL — background pizza coupon counter (restaurant admin only).
 * Reuses the existing order listener. Never delays order acceptance.
 */
import { DB_URL, getOrders, ready, store, subscribe } from './data.js?v=20261023-timeoutretry-clean1';
import { historicalPizzaEvents, loyaltyPhone, pizzaBonus } from './loyalty.js';

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const processed = new Map();
let timer = null, running = false, rerun = false;
let initialHistoryReconciliation = true;

function recentPhones() {
  const cutoff = initialHistoryReconciliation ? 0 : Date.now() - LOOKBACK_MS;
  const groups = new Map();
  for (const order of getOrders()) {
    if (!order?.id) continue;
    const at = Number(order.createdAt) || 0;
    if (at < cutoff) continue;
    const phone = loyaltyPhone(order.phone);
    if (!phone) continue;
    if (!groups.has(phone)) groups.set(phone, []);
    groups.get(phone).push(order.id + ':' + at + ':' + order.status);
  }
  // getOrders() is newest-first; prioritize new orders, never old history.
  return [...groups].map(([phone, ids]) => ({
    phone, signature: ids.sort().join('|'),
  })).filter(({phone,signature}) => processed.get(phone) !== signature).slice(0, 20);
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
    // Keep the original coupon event (quantity, redeemed) authoritative.
    // Enrich legacy events from retained confirmed orders when the historic
    // event did not store totals, without double counting an order ID.
    let financialEventsEnriched = false;
    for (const [id, recent] of Object.entries(history)) {
      const existing = events[id];
      if (!existing) continue;
      const update = {};
      if (existing.totalPaid == null && recent.totalPaid != null) update.totalPaid = recent.totalPaid;
      if (existing.largePizzaTotal == null && recent.largePizzaTotal != null)
        update.largePizzaTotal = recent.largePizzaTotal;
      if (Object.keys(update).length) {
        events[id] = { ...existing, ...update };
        financialEventsEnriched = true;
      }
    }
    // Accepted pizza events (including quantity:0) survive order pruning.
    // Recover the oldest known order from those events, from orders still
    // present and from any first-order marker written by the customer.
    const candidates = [
      account.customerFirstOrder?.orderId && {
        orderId: String(account.customerFirstOrder.orderId),
        at: Number(account.customerFirstOrder.at) || 0,
      },
      ...Object.values(events).map(event => ({
        orderId: String(event.id || ''), at: Number(event.at) || 0,
      })),
      ...getOrders().filter(order => loyaltyPhone(order.phone) === phone)
        .map(order => ({ orderId: String(order.id || ''), at: Number(order.createdAt) || 0 })),
    ].filter(entry => entry && entry.orderId && entry.at > 0);
    candidates.sort((a,b) => a.at-b.at || a.orderId.localeCompare(b.orderId));
    const firstOrder = candidates[0] || null;
    const firstSaved = account.customerFirstOrder;
    const firstNeedsSave = firstOrder && (
      firstOrder.orderId !== firstSaved?.orderId ||
      firstOrder.at !== Number(firstSaved?.at)
    );
    const state = pizzaBonus(events);
    const allEvents = Object.values(events).filter(event => event?.id);
    const eventCount = allEvents.length;
    const totalBig = allEvents.reduce((sum, event) => {
      // Old events stored only paid large-pizza coupon quantity, so these
      // counts are lower bounds when a historic free pizza is not tracked.
      const quantity = event.largePizzaTotal ?? event.quantity ?? 0;
      return sum + Math.max(0, Number(quantity) || 0);
    }, 0);
    const withoutBigDetail = allEvents.filter(event => event.largePizzaTotal == null).length;
    const knownSpending = allEvents.filter(event =>
      event.totalPaid != null && Number.isFinite(Number(event.totalPaid)) &&
      Number(event.totalPaid) >= 0
    );
    const knownSpent = Math.round(knownSpending.reduce((sum, event) =>
      sum + Number(event.totalPaid), 0) * 100) / 100;
    const missingAmounts = eventCount - knownSpending.length;
    const retained = getOrders().filter(order => loyaltyPhone(order.phone) === phone)
      .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const latest = retained[0];
    const existingProfile = account.customerProfile || {};
    const latestAt = Number(latest?.createdAt) || 0;
    const profileUpdated = Number(existingProfile.lastOrderAt) || 0;
    const customerProfile = {
      phone,
      name: latestAt >= profileUpdated
        ? String(latest?.customerName || existingProfile.name || '').trim().slice(0,120)
        : String(existingProfile.name || '').trim().slice(0,120),
      email: latestAt >= profileUpdated
        ? String(latest?.email || existingProfile.email || '').trim().slice(0,180)
        : String(existingProfile.email || '').trim().slice(0,180),
      lastOrderAt: Math.max(latestAt, profileUpdated),
      confirmedOrderCount: eventCount,
      largePizzaCountRecorded: totalBig,
      largePizzaCountPartial: withoutBigDetail > 0,
      totalSpentRecorded: knownSpent,
      ordersMissingAmount: missingAmounts,
    };
    const profileChanged = JSON.stringify(customerProfile) !== JSON.stringify(existingProfile);
    const consent = account.offersConsent === true;
    const missing = Object.keys(history).some(id =>
      !Object.prototype.hasOwnProperty.call(existingEvents, id));
    if (!firstNeedsSave && !missing && !financialEventsEnriched && !profileChanged &&
        account.pizzaCountSynced === true &&
        account.pizzaCount === state.count &&
        account.pizzaCycle === state.cycle &&
        account.pizzaReady === state.ready &&
        account.pizzaCountedEvents === eventCount &&
        account.offersConsent === consent) return;
    const next = {
      ...account, events,
      ...(firstOrder ? { customerFirstOrder: firstOrder } : {}),
      customerProfile,
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
    const batch = recentPhones();
    for (const { phone, signature } of batch) {
      try {
        await syncPhone(phone);
        processed.set(phone, signature);
      } catch (error) {
        console.warn('Pizzabonus synkronisering venter:', error.message);
      }
    }
    if (initialHistoryReconciliation) {
      // Process all retained historical orders in small batches, not just
      // the last 48h, before permitting the normal windowed poll.
      if (recentPhones().length) rerun = true;
      else initialHistoryReconciliation = false;
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
