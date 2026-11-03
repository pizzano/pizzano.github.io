/* Admin-only aggregate load publisher. No customer data or order IDs leave
 * this module. Customers never read the private /orders collection.
 * Best-effort guidance, not atomic capacity reservations. */
import { DB_URL, ready, subscribe, store, getOrders } from './data.js?v=20261104-type5-1';
import { publicPickupLoad } from './pickup-capacity.js';

const status = document.getElementById('pickupLoadPublishStatus');
let pendingTimer = null;
let sending = false;
let lastSlots = '';
let lastSuccess = 0;
function setStatus(message) { if (status) status.textContent = message; }

async function publish() {
  pendingTimer = null;
  if (sending || document.hidden || store.settings?.pickupCapacityEnabled !== true) return;
  if (!DB_URL || navigator.onLine === false) {
    setStatus('Kapasitetsstatus kunne ikke publiseres (ingen nettverk).');
    return;
  }
  const snapshot = publicPickupLoad(getOrders(), Date.now(),
    store.settings?.timezone || 'Europe/Oslo');
  const slots = JSON.stringify(snapshot.slots);
  if (slots === lastSlots && Date.now() - lastSuccess < 45000) return;
  sending = true;
  try {
    const response = await fetch(DB_URL + '/publicPickupLoad.json', {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    lastSlots = slots;
    lastSuccess = snapshot.updatedAt;
    setStatus('Anonym kapasitetsoversikt oppdatert. Adminpanelet må være åpent for løpende oppdatering.');
  } catch {
    setStatus('Kapasitetsoversikten ble ikke oppdatert. Kontroller Firebase-tilgang. Kundene får normale tider ved manglende status.');
  } finally {
    sending = false;
  }
}
function queue() {
  if (store.settings?.pickupCapacityEnabled !== true) {
    if (status) setStatus('Kapasitetsgrense er av. Ingen ekstra Firebase-skriving.');
    return;
  }
  if (!pendingTimer && !sending) pendingTimer = window.setTimeout(() => { void publish(); }, 2500);
}
subscribe(queue);
ready().then(queue).catch(() => setStatus('Firebase er ikke tilgjengelig.'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(); });
window.addEventListener('online', queue);
window.setInterval(queue, 25000);
