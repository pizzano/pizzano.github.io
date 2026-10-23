/**
 * KØL compact customer rollup — only six customer fields per phone, with
 * a bounded technical loyalty state for coupons and idempotency.
 * Written by the restaurant admin against the existing Firebase RTDB.
 *
 * /customers/{phone}:
 *   name, email, totalOrders, totalLargePizzas, totalSpent,
 *   bonusCount, bonusCycle, bonusConsent, bonusReservations,
 *   countedOrders (compact string), schemaVersion.
 * The phone is already the Firebase child key and is not duplicated.
 *
 * Old /pizzaBonus/{phone} records are read once for migration, never written.
 * countedOrders is a single pipe-separated string of still-live order IDs,
 * not a growing Firebase subtree or lifetime history.
 * ETag transactions keep counted totals and coupon reservations consistent.
 */
import { DB_URL, getOrders, ready, store, subscribe } from './data.js?v=20261024-customersslim2';
import { historicalPizzaEvents, loyaltyPhone, pizzaBonus } from './loyalty.js?v=20261023-customerprofile1';

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const processed = new Map();
let timer = null;
let running = false;
let rerun = false;
let initialHistoryReconciliation = true;

function verifiedOrders(phone) {
  return getOrders().filter(order => order?.id &&
    loyaltyPhone(order.phone) === phone &&
    ['bekreftet', 'tilberedning', 'klar', 'fullfort'].includes(order.status));
}

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
  return [...groups].map(([phone, ids]) => ({
    phone, signature: ids.sort().join('|'),
  })).filter(({phone, signature}) => processed.get(phone) !== signature).slice(0, 20);
}

function amount(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function integer(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}
function cents(value) {
  return Math.round((Number(value) || 0) * 100);
}
function normalizeName(value) {
  return String(value || '').trim().slice(0, 120);
}
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 180);
}
function nextBonus(customer, event) {
  const paidPizzas = integer(event.quantity);
  const current = Math.min(10, integer(customer.bonusCount));
  if (event.redeemed && current + paidPizzas >= 10) {
    customer.bonusCount = 0;
    customer.bonusCycle = String(event.id);
  } else {
    customer.bonusCount = Math.min(10, current + paidPizzas);
  }
}
function seenIds(value) {
  // Version 3 stored individual keys; version 4 is one compact text field.
  if (typeof value === 'string') return value.split('|').filter(Boolean);
  if (value && typeof value === 'object')
    return Object.keys(value).filter(id => value[id]);
  return [];
}
function hasSeen(value, orderId) {
  return seenIds(value).includes(orderId);
}
function currentSeen(seen, phone) {
  const activeIds = new Set(getOrders().filter(order =>
    loyaltyPhone(order.phone) === phone && order?.id).map(order => order.id));
  const ids = new Set(seenIds(seen).filter(id =>
    activeIds.has(id) && /^ord_[a-z0-9]{7,40}$/i.test(id)));
  // At most the number of still-retained orders, normally around 100.
  return [...ids].sort().join('|');
}
function addSeen(seen, orderId) {
  const ids = new Set(seenIds(seen));
  ids.add(orderId);
  return [...ids].sort().join('|');
}

function currentReservations(reservations, cycle) {
  const existing = reservations && typeof reservations === 'object'
    ? reservations[cycle] : null;
  // Reservations prevent concurrent redemption. Keep only the active cycle
  // while it can still reserve an order; don't retain old coupon history.
  const age = Date.now() - (Number(existing?.at) || 0);
  return existing?.orderId && age >= -300000 && age < 15 * 60 * 1000
    ? { [cycle]: existing }
    : {};
}
function contactInfo(account, phone, orders) {
  const newest = [...orders].sort((a, b) =>
    (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  const legacy = account.customerProfile || {};
  return {
    phone,
    name: normalizeName(newest?.customerName || account.name || legacy.name),
    email: normalizeEmail(newest?.email || account.email || legacy.email),
  };
}

function migrateLegacy(account, phone, history, orders) {
  // Migrate the previous flat /pizzaBonus/{phone}/loyalty structure first,
  // or older per-order events when no compact rollup exists.
  if (account.loyalty?.version === 2) {
    const cycle = String(account.loyalty.cycle || 'start');
    return {
      name: normalizeName(account.name),
      email: normalizeEmail(account.email),
      totalOrders: integer(account.totalOrders),
      totalLargePizzas: integer(account.totalLargePizzas),
      totalSpent: amount(account.totalSpent),
      bonusCount: Math.min(10, integer(account.loyalty.count)),
      bonusCycle: cycle,
      bonusConsent: account.loyalty.offersConsent === true,
      bonusReservations: currentReservations(account.loyalty.reservations, cycle),
      countedOrders: currentSeen(account.loyalty.seen, phone),
      schemaVersion: 4,
    };
  }
  const savedEvents = account.events && typeof account.events === 'object'
    ? account.events : {};
  const events = { ...history, ...savedEvents };
  for (const [id, recent] of Object.entries(history)) {
    const older = events[id];
    if (!older) continue;
    events[id] = {
      ...older,
      ...(older.largePizzaTotal == null ? { largePizzaTotal: recent.largePizzaTotal } : {}),
      ...(older.totalPaid == null ? { totalPaid: recent.totalPaid } : {}),
    };
  }
  const entries = Object.values(events).filter(event => event?.id);
  const derived = pizzaBonus(events);
  const profile = account.customerProfile || {};
  const totalOrders = Math.max(entries.length, integer(profile.confirmedOrderCount));
  const totalLargePizzas = Math.max(
    entries.reduce((sum, item) => sum + integer(item.largePizzaTotal ?? item.quantity), 0),
    integer(profile.largePizzaCountRecorded)
  );
  const totalSpent = Math.max(
    Math.round(entries.reduce((sum, item) => sum + amount(item.totalPaid), 0) * 100) / 100,
    amount(profile.totalSpentRecorded)
  );
  const cycle = entries.length ? derived.cycle : String(account.pizzaCycle || 'start');
  return {
    name: normalizeName(account.name || profile.name),
    email: normalizeEmail(account.email || profile.email),
    totalOrders,
    totalLargePizzas,
    totalSpent,
    bonusCount: entries.length ? derived.count : Math.min(10, integer(account.pizzaCount)),
    bonusCycle: cycle,
    bonusConsent: account.loyalty?.offersConsent === true || account.offersConsent === true,
    bonusReservations: currentReservations(account.loyalty?.reservations || account.reservations, cycle),
    countedOrders: currentSeen(Object.fromEntries(entries.map(event => [event.id, 1])), phone),
    schemaVersion: 4,
  };
}

async function readOldCustomer(phone) {
  // No deletion here: a legacy tab might still be open. A separate
  // verified cleanup can retire /pizzaBonus after all users switch.
  const response = await fetch(DB_URL + '/pizzaBonus/' + encodeURIComponent(phone) + '.json', {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Gammelt kunderegister HTTP ' + response.status);
  return await response.json() || {};
}

async function syncPhone(phone) {
  const orders = verifiedOrders(phone);
  const history = historicalPizzaEvents(orders, phone, store.sections);
  const url = DB_URL + '/customers/' + encodeURIComponent(phone) + '.json';
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      method: 'GET', headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store',
    });
    if (!response.ok) throw new Error('Customers GET ' + response.status);
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Customers ETag mangler.');
    const existing = await response.json() || {};
    const compact = existing.schemaVersion === 4;
    // A v3 customer already has authoritative lifetime totals. Upgrade it
    // locally instead of re-importing stale data from old /pizzaBonus.
    const fromV3 = existing.schemaVersion === 3;
    const old = compact || fromV3 ? null : await readOldCustomer(phone);
    const migrated = compact || fromV3 ? existing : migrateLegacy(old, phone, history, orders);
    // A customer can reserve a free pizza before the restaurant has
    // migrated their legacy counters. Preserve that newer reservation.
    const reservations = compact
      ? migrated.bonusReservations
      : { ...(migrated.bonusReservations || {}), ...(existing.bonusReservations || {}) };
    const next = {
      name: normalizeName(migrated.name),
      email: normalizeEmail(migrated.email),
      totalOrders: integer(migrated.totalOrders),
      totalLargePizzas: integer(migrated.totalLargePizzas),
      totalSpent: amount(migrated.totalSpent),
      bonusCount: Math.min(10, integer(migrated.bonusCount)),
      bonusCycle: String(migrated.bonusCycle || 'start'),
      bonusConsent: compact
        ? existing.bonusConsent === true
        : (Object.prototype.hasOwnProperty.call(existing, 'bonusConsent')
          ? existing.bonusConsent === true
          : migrated.bonusConsent === true),
      bonusReservations: currentReservations(reservations, String(migrated.bonusCycle || 'start')),
      countedOrders: currentSeen(migrated.countedOrders, phone),
      schemaVersion: 4,
    };
    const contact = contactInfo(next, phone, orders);
    next.name = contact.name;
    next.email = contact.email;
    const fresh = Object.values(history).filter(event => event?.id &&
      !hasSeen(next.countedOrders, event.id))
      .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)
        || String(a.id).localeCompare(String(b.id)));
    for (const event of fresh) {
      next.totalOrders += 1;
      next.totalLargePizzas += integer(event.largePizzaTotal ?? event.quantity);
      next.totalSpent = Math.round(cents(next.totalSpent) + cents(amount(event.totalPaid))) / 100;
      nextBonus(next, event);
      next.countedOrders = addSeen(next.countedOrders, event.id);
    }
    next.bonusReservations = currentReservations(next.bonusReservations, next.bonusCycle);
    if (compact && JSON.stringify(next) === JSON.stringify(existing)) return;
    // A short-lived placeholder written by a customer's consent toggle
    // cannot override the lifetime totals from the old account.
    const saved = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(next),
    });
    if (saved.status === 412) continue;
    if (!saved.ok) throw new Error('Customers PUT ' + saved.status);
    return;
  }
  throw new Error('Kunderegisteret ble endret samtidig. Forsøk igjen.');
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
        console.warn('Kunderegister synkronisering venter:', error.message);
      }
    }
    if (initialHistoryReconciliation) {
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
// One-time, rate-limited migration of historical /pizzaBonus accounts,
// including customers whose orders were already removed from /orders.
// Firebase may deny shallow reads at /pizzaBonus; in that case ordinary
// per-phone migration continues when a customer orders again.
let historicalQueue = [];
let historicalTimer = null;
let historicalBusy = false;
let historicalDiscovered = false;
async function discoverHistoricalPhones() {
  if (historicalDiscovered || !DB_URL || document.hidden || navigator.onLine === false) return;
  try {
    const response = await fetch(DB_URL + '/pizzaBonus.json?shallow=true', { cache: 'no-store' });
    if (!response.ok) return;
    const names = await response.json() || {};
    historicalQueue = Object.keys(names).filter(phone => loyaltyPhone(phone) === phone);
    historicalDiscovered = true;
    scheduleHistoricalMigration();
  } catch (error) {
    console.warn('Historiske bonuskontoer kan ikke listes; migreres ved neste bestilling:', error?.message);
  }
}
function scheduleHistoricalMigration() {
  if (historicalTimer || !historicalQueue.length) return;
  historicalTimer = setTimeout(() => {
    historicalTimer = null;
    void migrateHistoricalBatch();
  }, 3500);
}
async function migrateHistoricalBatch() {
  if (historicalBusy || document.hidden || navigator.onLine === false) return;
  historicalBusy = true;
  try {
    // Four per batch: avoid spikes in Firebase traffic during restaurant service.
    for (let i = 0; i < 4 && historicalQueue.length; i++) {
      const phone = historicalQueue.shift();
      try { await syncPhone(phone); }
      catch (error) {
        console.warn('Historisk kundekonto venter til neste pålogging:', error?.message);
      }
    }
  } finally {
    historicalBusy = false;
    scheduleHistoricalMigration();
  }
}

subscribe((_state, origin) => { if (origin === 'remote') scheduleSync(); });
ready().then(() => {
  scheduleSync();
  // Start after the live orders have had priority for acceptance/notifications.
  setTimeout(() => { void discoverHistoricalPhones(); }, 30000);
});
window.addEventListener('online', () => {
  scheduleSync();
  if (!historicalDiscovered) void discoverHistoricalPhones();
  else scheduleHistoricalMigration();
});
window.addEventListener('kol-order-confirmed', scheduleSync);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    scheduleSync();
    if (!historicalDiscovered) void discoverHistoricalPhones();
    else scheduleHistoricalMigration();
  }
});
setInterval(() => { void syncRecentlyAccepted(); }, 60 * 1000);
