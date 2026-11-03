/* Pending-order recovery across reloads. Stores ONLY opaque order ID, SHA-256
 * digest and timestamp; never cart, phone, email or Firebase order data.
 * No automatic resend: customer must explicitly press Send/Prøv igjen. */
const KEY = 'kol_pending_order_intent_v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
const ORDER_ID = /^ord_[a-z0-9]{8,50}$/;
const HEX_256 = /^[a-f0-9]{64}$/;

export function readPendingIntent(storage, now = Date.now()) {
  try {
    const data = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!data || !ORDER_ID.test(data.id) || !HEX_256.test(data.hash) ||
        !Number.isFinite(data.at) || data.at > now + 60000 ||
        now - data.at > MAX_AGE) return null;
    return data;
  } catch { return null; }
}

export async function fingerprintHash(text, cryptoSource = globalThis.crypto) {
  if (!cryptoSource?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(String(text));
  const digest = await cryptoSource.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export async function pendingOrderIdFor(fingerprint, makeId, storage = null,
  now = Date.now(), cryptoSource = globalThis.crypto) {
  if (!storage) { try { storage = globalThis.localStorage; } catch { /* disabled */ } }
  const hash = await fingerprintHash(fingerprint, cryptoSource).catch(() => null);
  const stored = readPendingIntent(storage, now);
  if (hash && stored?.hash === hash) return stored.id;
  const id = makeId();
  if (hash && ORDER_ID.test(id)) {
    try { storage?.setItem(KEY, JSON.stringify({ id, hash, at: now })); }
    catch { /* Incognito/storage quota: in-page retry still works. */ }
  }
  return id;
}

export function clearPendingIntent(id, storage = null) {
  try {
    if (!storage) storage = globalThis.localStorage;
    const entry = readPendingIntent(storage);
    if (entry?.id === id) storage?.removeItem(KEY);
  } catch { /* Non-blocking cleanup. */ }
}
