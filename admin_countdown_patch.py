from pathlib import Path
import re

repo = Path('.')

# ---------------- admin.html ----------------
path = repo / 'demo/admin.html'
text = path.read_text(encoding='utf-8')
text = re.sub(
    r'<nav class="orders-tabs" aria-label="Filtrer bestillinger">.*?</nav>',
    '<nav class="orders-tabs" aria-label="Bestillinger">\n                            <button class="orders-tab is-active" data-order-filter="all" type="button">Alle</button>\n                        </nav>',
    text,
    flags=re.S,
)
text = re.sub(r'/demo/css/admin\.css\?v=[^"\']+', '/demo/css/admin.css?v=20260915-countdown1', text)
text = re.sub(r'/demo/js/admin\.js\?v=[^"\']+', '/demo/js/admin.js?v=20260915-countdown1', text)
path.write_text(text, encoding='utf-8')

# ---------------- admin.js ----------------
path = repo / 'demo/js/admin.js'
text = path.read_text(encoding='utf-8')
text = text.replace(
    "orderFilterBtns: document.querySelectorAll('.filter-btn[data-order-filter]'),",
    "orderFilterBtns: document.querySelectorAll('.orders-tab[data-order-filter]'),"
)

old = """function filteredOrders() {
  const orders = getOrders();
  if (ui.orderFilter === 'all') return orders;
  if (ui.orderFilter === 'active') {
    return orders.filter((order) => ['mottatt', 'bekreftet', 'tilberedning'].includes(order.status));
  }
  if (ui.orderFilter === 'klar') return orders.filter((order) => order.status === 'klar');
  return orders;
}"""
new = """function filteredOrders() {
  ui.orderFilter = 'all';
  return getOrders();
}"""
if old in text:
    text = text.replace(old, new)

old = """function renderOrderTabs(allOrders) {
  const counts = {
    all: allOrders.length,
    active: allOrders.filter((order) => ['mottatt', 'bekreftet', 'tilberedning'].includes(order.status)).length,
    klar: allOrders.filter((order) => order.status === 'klar').length,
  };
  const labels = { all: 'Alle', active: 'Pågår', klar: 'Klar' };
  el.orderFilterBtns.forEach((button) => {
    const key = button.dataset.orderFilter;
    button.classList.toggle('is-active', key === ui.orderFilter);
    button.innerHTML = `<span>${labels[key] || key}</span><b>${counts[key] ?? 0}</b>`;
  });
}"""
new = """function renderOrderTabs(allOrders) {
  ui.orderFilter = 'all';
  el.orderFilterBtns.forEach((button) => {
    button.classList.add('is-active');
    button.innerHTML = `<span>Alle</span><b>${allOrders.length}</b>`;
  });
}"""
if old in text:
    text = text.replace(old, new)

# Add live detail countdown variable.
needle = """  const shortId = String(order.id || '').slice(-8).toUpperCase();
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const isPending = order.status === 'mottatt';"""
replacement = """  const shortId = String(order.id || '').slice(-8).toUpperCase();
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const countdown = orderCountdown(order);
  const isPending = order.status === 'mottatt';"""
text = text.replace(needle, replacement)

# Replace detail header with close button.
needle = """      <header class=\"pos-detail-top\">\n        <div class=\"pos-detail-total\">${formatPrice(order.total)}</div>\n        <div class=\"pos-detail-pills\"><span>${escapeHtml(pickupType)}</span><span>${escapeHtml(payment)}</span></div>\n      </header>"""
replacement = """      <header class=\"pos-detail-top\">\n        <div class=\"pos-detail-heading\">\n          <div class=\"pos-detail-total\">${formatPrice(order.total)}</div>\n          <div class=\"pos-detail-pills\"><span>${escapeHtml(pickupType)}</span><span>${escapeHtml(payment)}</span></div>\n        </div>\n        <button class=\"pos-detail-close\" data-close-order-detail type=\"button\" aria-label=\"Lukk bestillingen og gå tilbake til listen\">×</button>\n      </header>"""
if needle not in text:
    raise SystemExit('admin detail header marker not found')
text = text.replace(needle, replacement)

# Replace static expected-time meta with second-by-second countdown.
needle = """          ${estimated ? `<div><span>Forventet</span><strong>Ca. ${estimated} min</strong></div>` : ''}"""
replacement = """          ${estimated && !isPending ? `<div class=\"pos-meta-countdown\"><span>Tid igjen</span><strong data-detail-countdown=\"${escapeHtml(order.id)}\">${escapeHtml(countdown || '00:00')}</strong></div>` : ''}"""
if needle not in text:
    raise SystemExit('admin expected time marker not found')
text = text.replace(needle, replacement)

# Add close click handling.
needle = """el.orderDetailLive.addEventListener('click', async (event) => {
  const accept = event.target.closest('[data-open-accept]');"""
replacement = """el.orderDetailLive.addEventListener('click', async (event) => {
  const closeDetail = event.target.closest('[data-close-order-detail]');
  if (closeDetail) {
    if (selectedOrderId) lastAutoOpenedPendingId = selectedOrderId;
    selectedOrderId = null;
    renderOrders();
    return;
  }
  const accept = event.target.closest('[data-open-accept]');"""
if needle not in text:
    raise SystemExit('admin detail click marker not found')
text = text.replace(needle, replacement)

# Update both list and detail clocks every second.
needle = """function refreshOrderClocks() {
  if (ui.page !== 'orders') return;
  document.querySelectorAll('[data-order-clock]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderClock);
    if (!order) return;
    node.textContent = order.status === 'mottatt' ? orderElapsed(order) : (orderCountdown(order) || formatPrice(order.total));
  });
}"""
replacement = """function refreshOrderClocks() {
  if (ui.page !== 'orders') return;
  document.querySelectorAll('[data-order-clock]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderClock);
    if (!order) return;
    node.textContent = order.status === 'mottatt' ? orderElapsed(order) : (orderCountdown(order) || (order.status === 'klar' ? 'Klar' : formatPrice(order.total)));
  });
  document.querySelectorAll('[data-detail-countdown]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.detailCountdown);
    if (!order) return;
    node.textContent = orderCountdown(order) || (order.status === 'klar' ? 'Klar nå' : '00:00');
  });
}"""
if needle not in text:
    raise SystemExit('admin refreshOrderClocks marker not found')
text = text.replace(needle, replacement)
path.write_text(text, encoding='utf-8')

# ---------------- customer.js ----------------
path = repo / 'demo/js/customer.js'
text = path.read_text(encoding='utf-8')

# Countdown formatter before activeOrderCardHtml.
needle = "\nfunction activeOrderCardHtml(order) {"
insert = """
function customerOrderCountdown(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const seconds = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')} igjen`;
}

function activeOrderCardHtml(order) {"""
if needle not in text:
    raise SystemExit('customer activeOrderCardHtml marker not found')
text = text.replace(needle, '\n' + insert, 1)

needle = """    ${estimated && !readyNow ? `<div class=\"active-order-estimate\"><span>⏱</span><strong>Ca. ${estimated} min</strong><small>oppgitt av restauranten</small></div>` : ''}"""
replacement = """    ${estimated && !readyNow ? `<div class=\"active-order-estimate\"><span>⏱</span><strong data-customer-countdown=\"${escapeHtml(order.id)}\">${escapeHtml(customerOrderCountdown(order) || `Ca. ${estimated} min`)}</strong><small>oppgitt av restauranten</small></div>` : ''}"""
if needle not in text:
    raise SystemExit('customer estimate marker not found')
text = text.replace(needle, replacement)

# Add customer auto-ready busy set.
needle = """const activeOrderStreams = new Map();
const activeOrderFetchBusy = new Set();
let activeOrderFallbackTimer = null;
const readyDismissTimers = new Map();"""
replacement = """const activeOrderStreams = new Map();
const activeOrderFetchBusy = new Set();
const customerAutoReadyBusy = new Set();
let activeOrderFallbackTimer = null;
const readyDismissTimers = new Map();"""
if needle not in text:
    raise SystemExit('customer active order constants marker not found')
text = text.replace(needle, replacement)

# Insert promotion/countdown refresh before scheduleReadyDismiss.
needle = "\nfunction scheduleReadyDismiss(order) {"
insert = r'''
async function promoteCustomerExpiredOrder(order) {
  if (!order?.id || customerAutoReadyBusy.has(order.id)) return;
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (!readyAt || readyAt > Date.now() || !['bekreftet', 'tilberedning'].includes(order.status)) return;
  customerAutoReadyBusy.add(order.id);
  const now = Date.now();
  const optimistic = { ...order, status: 'klar', statusUpdatedAt: now };
  upsertLiveOrder(order.id, optimistic);
  renderActiveOrders();
  if (ui.view === 'profile') renderProfile();
  try {
    const response = await fetch(`${DB_URL}/orders/${encodeURIComponent(order.id)}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'klar', statusUpdatedAt: now }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (_) {
    await fetchActiveOrderNow(order.id);
  } finally {
    customerAutoReadyBusy.delete(order.id);
  }
}

function refreshCustomerOrderCountdowns() {
  const orders = activeCustomerOrders();
  const byId = new Map(orders.map((order) => [order.id, order]));
  document.querySelectorAll('[data-customer-countdown]').forEach((node) => {
    const order = byId.get(node.dataset.customerCountdown);
    if (!order) return;
    node.textContent = customerOrderCountdown(order) || (order.status === 'klar' ? 'Klar nå' : `Ca. ${Math.max(0, Number(order.estimatedMinutes) || 0)} min`);
  });
  for (const order of orders) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    if (readyAt > 0 && readyAt <= Date.now() && ['bekreftet', 'tilberedning'].includes(order.status)) {
      void promoteCustomerExpiredOrder(order);
    }
  }
}

function scheduleReadyDismiss(order) {'''
if needle not in text:
    raise SystemExit('customer scheduleReadyDismiss marker not found')
text = text.replace(needle, '\n' + insert, 1)

# Add per-second customer timer before final renderAll.
needle = """// Status og åpningstid holdes oppdatert mens siden er åpen.
setInterval(() => {
  updateSyncBadge();
  renderOpenState();
}, 5000);

renderAll();"""
replacement = """// Status og åpningstid holdes oppdatert mens siden er åpen.
setInterval(() => {
  updateSyncBadge();
  renderOpenState();
}, 5000);

// Vis resttid sekund for sekund. Når tiden er ute, går ordren automatisk til Klar.
setInterval(refreshCustomerOrderCountdowns, 1000);
refreshCustomerOrderCountdowns();

renderAll();"""
if needle not in text:
    raise SystemExit('customer timer marker not found')
text = text.replace(needle, replacement)
path.write_text(text, encoding='utf-8')

# ---------------- admin.css ----------------
path = repo / 'demo/css/admin.css'
text = path.read_text(encoding='utf-8')
marker = '/* Single-tab orders + live countdown 2026-09-15 */'
if marker in text:
    text = text.split(marker)[0].rstrip() + '\n'
text += r'''

/* Single-tab orders + live countdown 2026-09-15 */
.orders-tabs {
  grid-template-columns: minmax(0, 180px) !important;
  justify-content: start;
}
.orders-tab {
  width: 100%;
}
.pos-detail-top {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-right: 72px !important;
}
.pos-detail-heading {
  min-width: 0;
  display: grid;
  gap: 10px;
}
.pos-detail-close {
  position: absolute;
  top: 18px;
  right: 22px;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid #dfe4e9;
  border-radius: 50%;
  background: #fff;
  color: #56606d;
  font-size: 25px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(28, 35, 43, .06);
}
.pos-detail-close:hover {
  border-color: #cdd4dc;
  background: #f7f8f9;
  color: #171c22;
}
.pos-meta-countdown strong,
.orders-live-time {
  font-variant-numeric: tabular-nums;
}
.pos-meta-countdown strong {
  color: #ef6c00 !important;
  font-size: 18px !important;
  letter-spacing: .03em;
}
.orders-list-row:not(.is-new) .orders-live-time {
  color: #ef6c00;
}
@media (max-width: 760px) {
  .orders-tabs { grid-template-columns: 1fr !important; }
  .pos-detail-top { padding-right: 64px !important; }
  .pos-detail-close { top: 14px; right: 14px; }
}
'''
path.write_text(text, encoding='utf-8')

# ---------------- customer.css ----------------
path = repo / 'demo/css/customer.css'
text = path.read_text(encoding='utf-8')
marker = '/* Customer live order countdown 2026-09-15 */'
if marker in text:
    text = text.split(marker)[0].rstrip() + '\n'
text += r'''

/* Customer live order countdown 2026-09-15 */
.active-order-estimate strong[data-customer-countdown] {
  font-variant-numeric: tabular-nums;
  letter-spacing: .02em;
  color: #247d49;
  font-size: 16px;
}
'''
path.write_text(text, encoding='utf-8')

# ---------------- index.html cache bust ----------------
path = repo / 'demo/index.html'
text = path.read_text(encoding='utf-8')
text = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', '/demo/css/customer.css?v=20260915-countdown1', text)
text = re.sub(r'/demo/js/customer\.js\?v=[^"\']+', '/demo/js/customer.js?v=20260915-countdown1', text)
path.write_text(text, encoding='utf-8')

# ---------------- service worker ----------------
path = repo / 'demo/service-worker.js'
text = path.read_text(encoding='utf-8')
text = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v44';", text)
path.write_text(text, encoding='utf-8')
