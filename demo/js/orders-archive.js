/**
 * Keep only the newest 100 orders in /orders, without any order archive.
 * Runs only in the restaurant admin. Never interrupts order acceptance,
 * customer order tracking, SMS/e-mail delivery or the pizza bonus counter.
 *
 * Older closed orders are permanently deleted only after the 72-hour
 * notification safety window, with their original Firebase ETag.
 * Active orders are retained even when /orders temporarily exceeds 100.
 *
 * Legacy filename kept so existing admin entrypoints continue to work.
 */
import { DB_URL, getOrders, ready, subscribe } from './data.js?v=20261028-firebase4';
import { loyaltyPhone } from './loyalty.js?v=20261023-customerprofile1';

const LIVE_LIMIT = 100;
const NOTIFICATION_GRACE_MS = 72 * 60 * 60 * 1000;
const BATCH_SIZE = 12;
const CLOSED_STATUSES = new Set(['fullfort', 'avvist', 'klar']);
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const deletedInPage = new Set();
let scheduled = 0;
let running = false;

function eligible(order, now) {
  if (!order?.id || !CLOSED_STATUSES.has(order.status)) return false;
  const created = Number(order.createdAt) || 0;
  const lastUpdate = Number(order.statusUpdatedAt) || 0;
  if (!created || !lastUpdate || lastUpdate < created) return false;
  // Give the SMS and email pollers time to deliver messages after outages.
  if (now - Math.max(created, lastUpdate) < NOTIFICATION_GRACE_MS) return false;
  if (order.status === 'klar' && !(Number(order.staffReadyAt) > 0)) return false;
  return true;
}

function candidates(now = Date.now()) {
  const ordered = [...getOrders()].filter(order => order?.id)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
      || String(b.id).localeCompare(String(a.id)));
  if (ordered.length <= LIVE_LIMIT) return [];
  // Never delete one of the 100 newest, or an order still being processed.
  return ordered.slice(LIVE_LIMIT).filter(order => eligible(order, now))
    .reverse().slice(0, BATCH_SIZE);
}

async function fetchChecked(url, options) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok && response.status !== 412) {
    throw new Error('Firebase ordreopprydding HTTP ' + response.status);
  }
  return response;
}

async function deleteOldOrder(snapshot) {
  if (!DB_URL || !snapshot?.id || deletedInPage.has(snapshot.id)) return false;
  const key = encodeURIComponent(snapshot.id);
  const sourceUrl = DB_URL + '/orders/' + key + '.json';

  // A late status update must prevent deletion.
  const response = await fetchChecked(sourceUrl, {
    headers: { 'X-Firebase-ETag': 'true' },
  });
  if (response.status === 412) return false;
  const etag = response.headers.get('ETag');
  const current = await response.json();
  if (!etag || !current || current.id !== snapshot.id ||
      !eligible(current, Date.now()) ||
      !candidates().some(order => order.id === current.id)) return false;

  // Retain confirmed pizza points before deleting their source order.
  const phone = loyaltyPhone(current.phone);
  if (phone && ['bekreftet','tilberedning','klar','fullfort'].includes(current.status)) {
    const accountUrl = DB_URL + '/customers/' + phone + '.json';
    const account = await (await fetchChecked(accountUrl)).json();
    // Never prune an order before its data is committed to /customers.
    // Legacy /pizzaBonus-only accounts remain protected until migration.
    const accounted = typeof account?.countedOrders === 'string'
      ? account.countedOrders.split('|').includes(current.id)
      : account?.countedOrders?.[current.id] === 1;
    if (![3, 4].includes(account?.schemaVersion) ||
        !accounted ||
        !Number.isFinite(Number(account.totalOrders)) ||
        !Number.isFinite(Number(account.totalLargePizzas)) ||
        !Number.isFinite(Number(account.totalSpent))) return false;
  }

  const deleted = await fetchChecked(sourceUrl, {
    method: 'DELETE', headers: { 'if-match': etag },
  });
  if (deleted.status === 412) return false;
  deletedInPage.add(current.id);
  return true;
}

// Historical /orderArchive records are never deleted by routine maintenance.
// Only individually eligible old /orders entries are pruned after safeguards.

async function maintainOrders() {
  if (!DB_URL || running || document.hidden || navigator.onLine === false) return;
  running = true;
  let deleted = 0;
  try {
    for (const order of candidates()) {
      try {
        if (await deleteOldOrder(order)) deleted++;
      } catch (error) {
        console.warn('Sletting av gammel ordre venter:', error.message);
      }
    }
  } finally {
    running = false;
    // Work in small batches so incoming orders are never blocked.
    if (deleted) scheduleCleanup(10000);
  }
}

function scheduleCleanup(delay = 15000) {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = 0;
    void maintainOrders();
  }, delay);
}

subscribe((_state, origin) => {
  if (origin === 'remote' && getOrders().length > LIVE_LIMIT) scheduleCleanup();
});
ready().then(() => scheduleCleanup(2000));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleCleanup(2000);
});
window.addEventListener('online', () => scheduleCleanup(2000));
setInterval(() => { void maintainOrders(); }, CHECK_INTERVAL_MS);
