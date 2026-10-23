/**
 * KØL compact customer rollup — only six customer fields per phone, with
 * a bounded technical loyalty state for coupons and idempotency.
 * Written by the restaurant admin against the existing Firebase RTDB.
 *
 * /pizzaBonus/{phone}:
 *   phone, name, email, totalOrders, totalLargePizzas, totalSpent,
 *   loyalty: { version, count, cycle, offersConsent, reservations, seen }
 *
 * seen stores only IDs of confirmed orders still retained in /orders.
 * It is NOT a historical list and does not grow with lifetime purchases.
 * ETag CAS makes migration and incremental totals atomic per phone.
 */
import { DB_URL, getOrders, ready, store, subscribe } from './data.js?v=20261024-compact1';
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
function nextBonus(loyalty, event) {
  const paidPizzas = integer(event.quantity);
  const current = Math.min(10, integer(loyalty.count));
  if (event.redeemed && current + paidPizzas >= 10) {
    loyalty.count = 0;
    loyalty.cycle = String(event.id);
  } else {
    loyalty.count = Math.min(10, current + paidPizzas);
  }
}
function currentSeen(seen, phone) {
  const activeIds = new Set(getOrders().filter(order =>
    loyaltyPhone(order.phone) === phone && order?.id).map(order => order.id));
  const retained = {};
  for (const id of Object.keys(seen || {})) {
    if (activeIds.has(id) && /^ord_[a-z0-9]{7,40}$/i.test(id))
      retained[id] = 1;
  }
  // Keep all IDs currently in /orders, including a temporary overflow
  // above 100. Dropping a still-live ID would count it again next sync.
  // IDs disappear naturally once the order is pruned from /orders.
  return retained;
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
  const savedEvents = account.events && typeof account.events === 'object'
    ? account.events : {};
  // Recorded events take priority over re-discovered orders; do not count
  // the same order twice. All older events are compacted before removal.
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
  const legacy = account.customerProfile || {};
  const totals = {
    totalOrders: entries.length,
    totalLargePizzas: entries.reduce((sum, item) =>
      sum + integer(item.largePizzaTotal ?? item.quantity), 0),
    totalSpent: Math.round(entries.reduce((sum, item) => sum + amount(item.totalPaid), 0) * 100) / 100,
  };
  // A profile can be the only remaining source of historical totals after
  // earlier maintenance. Never reduce a previously recorded lifetime value.
  totals.totalOrders = Math.max(totals.totalOrders, integer(legacy.confirmedOrderCount));
  totals.totalLargePizzas = Math.max(totals.totalLargePizzas, integer(legacy.largePizzaCountRecorded));
  totals.totalSpent = Math.max(totals.totalSpent, amount(legacy.totalSpentRecorded));
  const existingCount = integer(account.pizzaCount);
  const hasEvents = entries.length > 0;
  const loyalty = {
    version: 2,
    count: hasEvents ? derived.count : Math.min(10, existingCount),
    cycle: hasEvents ? derived.cycle : String(account.pizzaCycle || 'start'),
    offersConsent: account.loyalty?.offersConsent === true || account.offersConsent === true,
    reservations: currentReservations(account.reservations, hasEvents ? derived.cycle : String(account.pizzaCycle || 'start')),
    seen: currentSeen(Object.fromEntries(entries.map(event => [event.id, 1])), phone),
  };
  return { ...contactInfo(account, phone, orders), ...totals, loyalty };
}

async function syncPhone(phone) {
  const orders = verifiedOrders(phone);
  const history = historicalPizzaEvents(orders, phone, store.sections);
  // Sections are only needed as fallback when old orders lack loyaltyEligible.
  const url = DB_URL + '/pizzaBonus/' + encodeURIComponent(phone) + '.json';
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      method: 'GET', headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store',
    });
    if (!response.ok) throw new Error('Bonus GET ' + response.status);
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Bonus ETag mangler.');
    const account = await response.json() || {};
    const compact = account.loyalty?.version === 2;
    const next = compact
      ? {
          phone,
          name: normalizeName(account.name),
          email: normalizeEmail(account.email),
          totalOrders: integer(account.totalOrders),
          totalLargePizzas: integer(account.totalLargePizzas),
          totalSpent: amount(account.totalSpent),
          loyalty: {
            ...account.loyalty,
            count: Math.min(10, integer(account.loyalty.count)),
            cycle: String(account.loyalty.cycle || 'start'),
            reservations: currentReservations(account.loyalty.reservations, String(account.loyalty.cycle || 'start')),
            seen: currentSeen(account.loyalty.seen, phone),
          },
        }
      : migrateLegacy(account, phone, history, orders);

    // Do not lose the only existing name or e-mail if the latest order did
    // not supply it (the email field is optional for customers).
    const contact = contactInfo(next, phone, orders);
    next.name = contact.name;
    next.email = contact.email;

    const fresh = Object.values(history).filter(event => event?.id &&
      !Object.prototype.hasOwnProperty.call(next.loyalty.seen, event.id))
      .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)
        || String(a.id).localeCompare(String(b.id)));
    for (const event of fresh) {
      next.totalOrders += 1;
      next.totalLargePizzas += integer(event.largePizzaTotal ?? event.quantity);
      next.totalSpent = Math.round((cents(next.totalSpent) + cents(amount(event.totalPaid)))) / 100;
      nextBonus(next.loyalty, event);
      next.loyalty.seen[event.id] = 1;
    }
    next.loyalty.reservations = currentReservations(next.loyalty.reservations, next.loyalty.cycle);
    // A clean v2 account with no newly confirmed orders needs no write.
    // Any legacy account is migrated with its old events removed only
    // after the complete ETag-protected snapshot is committed.
    if (compact && JSON.stringify(next) === JSON.stringify(account)) return;
    const saved = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(next),
    });
    if (saved.status === 412) continue;
    if (!saved.ok) throw new Error('Bonus PUT ' + saved.status);
    return;
  }
  throw new Error('Kundekonto ble endret samtidig. Forsøk igjen.');
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
// One-time, rate-limited cleanup of historical phone accounts, including
// customers whose orders have already been removed from /orders.
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
