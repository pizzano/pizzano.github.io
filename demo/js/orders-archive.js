/**
 * Keep /orders small without dropping live work or pizza points.
 * Restaurant-admin maintenance only; never part of the customer checkout,
 * employee acceptance, email/SMS or printer paths.
 *
 * A completed order is first copied to /orderArchive/{id}, read back and
 * verified. Only then is /orders/{id} removed using its original ETag.
 */
import { DB_URL, getOrders, ready, subscribe } from './data.js?v=20261016-orders100a';
import { loyaltyPhone } from './loyalty.js';

const LIVE_LIMIT = 100;
const NOTIFICATION_GRACE_MS = 72 * 60 * 60 * 1000;
const BATCH_SIZE = 12;
const CLOSED_STATUSES = new Set(['fullfort', 'avvist', 'klar']);
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const archivedInPage = new Set();
let scheduled = 0;
let running = false;

function eligible(order, now) {
  if (!order?.id || !CLOSED_STATUSES.has(order.status)) return false;
  const created = Number(order.createdAt) || 0;
  const lastUpdate = Number(order.statusUpdatedAt) || 0;
  if (!created || !lastUpdate || lastUpdate < created) return false;
  // Email poller reads up to 48h of status events. Allow 72h from final
  // status to avoid dropping a notification after a short Apps Script outage.
  if (now - Math.max(created, lastUpdate) < NOTIFICATION_GRACE_MS) return false;
  // Ready orders that were never marked collected need extra caution: never
  // archive them if the staff ready marker is absent.
  if (order.status === 'klar' && !(Number(order.staffReadyAt) > 0)) return false;
  return true;
}

function candidates(now = Date.now()) {
  const ordered = [...getOrders()].filter(order => order?.id)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
      || String(b.id).localeCompare(String(a.id)));
  // Preserve the newest 100 plus ANY still-active orders even if over limit.
  if (ordered.length <= LIVE_LIMIT) return [];
  return ordered.slice(LIVE_LIMIT).filter(order => eligible(order, now))
    .reverse().slice(0, BATCH_SIZE);
}

function compactArchive(order, archivedAt) {
  return {
    id: String(order.id),
    createdAt: Number(order.createdAt) || 0,
    status: String(order.status),
    statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
    staffReadyAt: Number(order.staffReadyAt) || null,
    customerName: String(order.customerName || ''),
    phone: String(order.phone || ''),
    email: String(order.email || ''),
    pickup: String(order.pickup || ''),
    pickupMode: order.pickupMode || 'asap',
    scheduledPickupAt: Number(order.scheduledPickupAt) || null,
    total: Number(order.total) || 0,
    loyaltyConfirmedAt: Number(order.loyaltyConfirmedAt) || null,
    loyaltyReward: order.loyaltyReward || null,
    lines: Array.isArray(order.lines) ? order.lines.map(line => ({
      itemId: line.itemId || '',
      name: line.name || '',
      size: line.size || '',
      quantity: Number(line.quantity) || 1,
      price: Number(line.price) || 0,
      options: Array.isArray(line.options) ? line.options : [],
      optionDetails: Array.isArray(line.optionDetails) ? line.optionDetails : [],
      removedIngredients: Array.isArray(line.removedIngredients) ? line.removedIngredients : [],
      comment: line.comment || '',
      loyaltyFree: line.loyaltyFree === true,
    })) : [],
    archivedAt,
  };
}

async function fetchChecked(url, options) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok && response.status !== 412) {
    throw new Error('Ordrearkiv Firebase HTTP ' + response.status);
  }
  return response;
}

async function archiveOne(snapshot) {
  if (!DB_URL || !snapshot?.id || archivedInPage.has(snapshot.id)) return false;
  const key = encodeURIComponent(snapshot.id);
  const sourceUrl = DB_URL + '/orders/' + key + '.json';
  const archiveUrl = DB_URL + '/orderArchive/' + key + '.json';

  // ETag guards against a late staff update between copy and deletion.
  const response = await fetchChecked(sourceUrl, {
    headers: { 'X-Firebase-ETag': 'true' },
  });
  if (response.status === 412) return false;
  const etag = response.headers.get('ETag');
  const original = await response.json();
  if (!etag || !original || original.id !== snapshot.id ||
      !eligible(original, Date.now())) return false;

  // Confirm loyalty was permanently credited before removing the order.
  const phone = loyaltyPhone(original.phone);
  if (phone && Number(original.loyaltyConfirmedAt) > 0) {
    const bonusUrl = DB_URL + '/pizzaBonus/' + phone +
      '/events/' + key + '.json';
    const bonus = await (await fetchChecked(bonusUrl)).json();
    if (!bonus?.id || bonus.id !== original.id) return false;
  }

  const archive = compactArchive(original, Date.now());
  await fetchChecked(archiveUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(archive),
  });
  const saved = await (await fetchChecked(archiveUrl)).json();
  if (!saved || saved.id !== archive.id ||
      saved.statusUpdatedAt !== archive.statusUpdatedAt ||
      saved.createdAt !== archive.createdAt ||
      JSON.stringify(saved.lines) !== JSON.stringify(archive.lines)) {
    throw new Error('Arkivkopi kunne ikke verifiseres.');
  }

  const deleted = await fetchChecked(sourceUrl, {
    method: 'DELETE', headers: { 'if-match': etag },
  });
  if (deleted.status === 412) return false; // Order changed: keep it live.
  archivedInPage.add(original.id);
  return true;
}

async function maintainArchive() {
  if (!DB_URL || running || document.hidden || navigator.onLine === false) return;
  running = true;
  let archived = 0;
  try {
    for (const order of candidates()) {
      try {
        if (await archiveOne(order)) archived++;
      } catch (error) {
        console.warn('Arkivering av gammel ordre venter:', error.message);
      }
    }
  } finally {
    running = false;
    // Small batches prevent spikes; repeat if more eligible records exist.
    if (archived) scheduleArchive(10000);
  }
}

function scheduleArchive(delay = 15000) {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = 0;
    void maintainArchive();
  }, delay);
}

subscribe((_state, origin) => {
  if (origin === 'remote' && getOrders().length > LIVE_LIMIT) scheduleArchive();
});
ready().then(() => scheduleArchive(2000));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleArchive(2000);
});
window.addEventListener('online', () => scheduleArchive(2000));
setInterval(() => { void maintainArchive(); }, CHECK_INTERVAL_MS);
