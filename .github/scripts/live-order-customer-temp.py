from pathlib import Path
import re

js_path = Path('demo/js/customer.js')
js = js_path.read_text(encoding='utf-8')

if "  DB_URL,\n" not in js:
    js = js.replace("  store,\n  subscribe,", "  store,\n  DB_URL,\n  subscribe,", 1)

if "const READY_SEEN_KEY" not in js:
    js = js.replace(
        "const READY_NOTIFIED_KEY = 'kol_ready_notified_v1';",
        "const READY_NOTIFIED_KEY = 'kol_ready_notified_v1';\nconst READY_SEEN_KEY = 'kol_ready_seen_v1';",
        1,
    )

if "focusedOrderId:" not in js:
    js = js.replace(
        "  pendingOrderFingerprint: '',\n};",
        "  pendingOrderFingerprint: '',\n  focusedOrderId: '',\n};",
        1,
    )

js = re.sub(
    r"const CUSTOMER_STATUS_FLOW = \[.*?\n\];",
    """const CUSTOMER_STATUS_FLOW = [
  { id: 'mottatt', label: 'Mottatt', short: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet', short: 'Bekreftet' },
  { id: 'tilberedning', label: 'Tilberedes', short: 'Lages' },
  { id: 'klar', label: 'Klar for henting', short: 'Klar' },
];""",
    js,
    count=1,
    flags=re.S,
)

live_block = r'''function readySeenIds() {
  return new Set(loadJSON(READY_SEEN_KEY, []));
}

function markReadySeen(orderId) {
  if (!orderId) return;
  const seen = readySeenIds();
  seen.add(orderId);
  saveJSON(READY_SEEN_KEY, Array.from(seen).slice(-30));
}

function activeCustomerOrders() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const seen = readySeenIds();
  return mergedCustomerOrders().filter((order) => {
    if (!order?.id || order.status === 'fullfort' || order.status === 'avvist') return false;
    if (order.status === 'klar' && seen.has(order.id)) return false;
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}

function activeOrderCardHtml(order, extraCount = 0) {
  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === order.status);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const readyNow = order.status === 'klar';
  const progress = CUSTOMER_STATUS_FLOW.map((step, stepIndex) => {
    const complete = stepIndex < index;
    const current = stepIndex === index;
    return `<div class="order-progress-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}">
      <span class="order-progress-dot">${complete ? '✓' : ''}</span>
      <small>${escapeHtml(step.short)}</small>
    </div>`;
  }).join('');
  return `<section class="active-order-card${readyNow ? ' is-ready' : ''}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div>
        <span class="active-order-kicker">Aktiv bestilling${extraCount ? ` · +${extraCount}` : ''}</span>
        <strong class="active-order-live-status">${escapeHtml(readyNow ? 'Klar for henting' : orderStatusLabel(order.status))}</strong>
      </div>
      <span class="active-order-number">#${escapeHtml(shortId)}</span>
    </div>
    <div class="order-progress" aria-label="Bestillingsstatus">${progress}</div>
    ${readyNow ? `<div class="active-order-ready-callout"><span class="ready-check">✓</span><div><strong>Maten din er klar</strong><small>Kom og hent bestillingen nå.</small></div></div>` : ''}
    <div class="active-order-meta">
      <span>Henting <b>${escapeHtml(order.pickup || '—')}</b></span>
      <span><b>${formatPrice(order.total)}</b></span>
    </div>
    <button class="active-order-open" data-active-orders="${escapeHtml(order.id)}" type="button">Se bestillingen</button>
  </section>`;
}

let activeOrderStream = null;
let activeOrderStreamId = '';
let activeOrderFallbackTimer = null;
let activeOrderFetchBusy = false;
let readyDismissTimer = null;
let readyDismissOrderId = '';

function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const normalized = { ...remote, id: remote.id || orderId };
  const orders = Array.isArray(store.orders) ? [...store.orders] : [];
  const index = orders.findIndex((entry) => entry?.id === orderId);
  if (index >= 0) {
    const previous = orders[index] || {};
    orders[index] = {
      ...previous,
      ...normalized,
      lines: normalized.lines?.length ? normalized.lines : (previous.lines || []),
    };
  } else {
    orders.unshift(normalized);
  }
  store.orders = orders;
}

async function fetchActiveOrderNow(orderId) {
  if (!orderId || activeOrderFetchBusy) return;
  activeOrderFetchBusy = true;
  try {
    const response = await fetch(`${DB_URL}/orders/${encodeURIComponent(orderId)}.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote) return;
    upsertLiveOrder(orderId, remote);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
  } catch (_) {
    /* normal sync remains as fallback */
  } finally {
    activeOrderFetchBusy = false;
  }
}

function stopActiveOrderWatcher() {
  if (activeOrderStream) {
    activeOrderStream.close();
    activeOrderStream = null;
  }
  if (activeOrderFallbackTimer) {
    clearInterval(activeOrderFallbackTimer);
    activeOrderFallbackTimer = null;
  }
  activeOrderStreamId = '';
}

function watchActiveOrder(orderId) {
  if (!orderId) {
    stopActiveOrderWatcher();
    return;
  }
  if (activeOrderStreamId === orderId) return;
  stopActiveOrderWatcher();
  activeOrderStreamId = orderId;
  fetchActiveOrderNow(orderId);

  if ('EventSource' in window) {
    try {
      const source = new EventSource(`${DB_URL}/orders/${encodeURIComponent(orderId)}.json`);
      const refresh = () => fetchActiveOrderNow(orderId);
      source.addEventListener('put', refresh);
      source.addEventListener('patch', refresh);
      activeOrderStream = source;
    } catch (_) {}
  }

  activeOrderFallbackTimer = window.setInterval(() => {
    if (!document.hidden && activeOrderStreamId === orderId) fetchActiveOrderNow(orderId);
  }, 4000);
}

function scheduleReadyDismiss(order) {
  if (!order || order.status !== 'klar' || readySeenIds().has(order.id) || document.hidden) return;
  if (readyDismissTimer && readyDismissOrderId === order.id) return;
  if (readyDismissTimer) clearTimeout(readyDismissTimer);
  readyDismissOrderId = order.id;
  readyDismissTimer = window.setTimeout(() => {
    markReadySeen(order.id);
    readyDismissTimer = null;
    readyDismissOrderId = '';
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
  }, 12000);
}

function notifyReadyOrders(orders) {
  const notified = new Set(loadJSON(READY_NOTIFIED_KEY, []));
  let changed = false;
  for (const order of orders) {
    if (order.status !== 'klar' || notified.has(order.id)) continue;
    notified.add(order.id);
    changed = true;
    toast('✓ Maten din er klar – kom og hent nå.');
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('KØL Grill & Pizza', { body: 'Maten din er klar – kom og hent nå.' });
      } catch (_) {}
    }
  }
  if (changed) saveJSON(READY_NOTIFIED_KEY, Array.from(notified).slice(-30));
}

function renderActiveOrders() {
  const orders = activeCustomerOrders();
  const current = orders[0] || null;
  const html = current ? activeOrderCardHtml(current, Math.max(0, orders.length - 1)) : '';
  for (const target of [el.activeOrderMenu, el.activeOrderProfile]) {
    if (!target) continue;
    target.hidden = !current;
    target.innerHTML = html;
  }
  watchActiveOrder(current?.id || '');
  notifyReadyOrders(orders);
  if (current?.status === 'klar') scheduleReadyDismiss(current);
}

function openActiveOrderInProfile(orderId) {
  if (!orderId) return;
  ui.focusedOrderId = orderId;
  setView('profile');
  setProfileTab('orders');
  window.requestAnimationFrame(() => {
    const selectorId = window.CSS?.escape ? CSS.escape(orderId) : orderId.replace(/"/g, '\\"');
    const card = document.querySelector(`.order-history-card[data-order-card-id="${selectorId}"]`);
    if (!card) return;
    card.open = true;
    card.classList.add('is-focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.classList.remove('is-focused'), 2200);
  });
}
'''

pattern = r"function activeCustomerOrders\(\) \{.*?\nfunction resetPendingOrderSubmission\(\) \{"
replacement = live_block + "\nfunction resetPendingOrderSubmission() {"
js, count = re.subn(pattern, replacement, js, count=1, flags=re.S)
if count != 1:
    raise SystemExit('Could not replace active order block')

js = js.replace(
    "    const orders = getLocalOrders();",
    "    const orders = mergedCustomerOrders();",
    1,
)

old_details = '              <details class="order-history-card">'
new_details = '              <details class="order-history-card${ui.focusedOrderId === order.id ? \' is-focused\' : \'\'}" data-order-card-id="${escapeHtml(order.id)}"${ui.focusedOrderId === order.id ? \' open\' : \'\'}>'
if old_details not in js:
    raise SystemExit('Order history details block not found')
js = js.replace(old_details, new_details, 1)

old_handler = """  const activeOrdersBtn = event.target.closest('[data-active-orders]');
  if (activeOrdersBtn) {
    setView('profile');
    setProfileTab('orders');
    return;
  }"""
new_handler = """  const activeOrdersBtn = event.target.closest('[data-active-orders]');
  if (activeOrdersBtn) {
    openActiveOrderInProfile(activeOrdersBtn.dataset.activeOrders);
    return;
  }"""
if old_handler not in js:
    raise SystemExit('Active order button handler not found')
js = js.replace(old_handler, new_handler, 1)

if "live-order-visibility-refresh" not in js:
    js += """

// live-order-visibility-refresh
window.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const current = activeCustomerOrders()[0];
  if (current) {
    fetchActiveOrderNow(current.id);
    if (current.status === 'klar') scheduleReadyDismiss(current);
  }
});
"""

js_path.write_text(js, encoding='utf-8')

css_path = Path('demo/css/customer.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Live active order polish 2026-09-15 */'
if marker in css:
    css = css.split(marker)[0].rstrip() + '\n'
css += r'''

/* Live active order polish 2026-09-15 */
.active-order-card {
  position: relative;
  overflow: hidden;
}
.active-order-live-status {
  display: inline-flex !important;
  align-items: center;
  gap: 7px;
  color: #18783b !important;
}
.active-order-live-status::before {
  content: '';
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: #2e9f58;
  box-shadow: 0 0 0 0 rgba(46,159,88,.40);
  animation: kol-live-status-pulse 1.45s ease-out infinite;
}
.order-progress-step.is-current .order-progress-dot {
  border-color: #2e9f58 !important;
  background: #effaf3 !important;
  box-shadow: 0 0 0 0 rgba(46,159,88,.34);
  animation: kol-live-status-pulse 1.45s ease-out infinite;
}
.order-progress-step.is-current small {
  color: #16733a !important;
  font-weight: 800 !important;
}
@keyframes kol-live-status-pulse {
  0% { box-shadow: 0 0 0 0 rgba(46,159,88,.36); }
  70% { box-shadow: 0 0 0 9px rgba(46,159,88,0); }
  100% { box-shadow: 0 0 0 0 rgba(46,159,88,0); }
}
.active-order-ready-callout {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 2px;
  padding: 10px 12px;
  border: 1px solid #8bd2a0;
  border-radius: 12px;
  background: #f0faf3;
  color: #176f37;
}
.active-order-ready-callout .ready-check {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #2e9f58;
  color: #fff;
  font-weight: 900;
}
.active-order-ready-callout > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.active-order-ready-callout strong {
  font-size: 13px;
  font-weight: 800;
}
.active-order-ready-callout small {
  font-size: 11.5px;
  color: #43815a;
}
.order-history-card.is-focused {
  border-color: #75c98d !important;
  box-shadow: 0 0 0 3px rgba(67,170,99,.12), 0 7px 18px rgba(30,92,49,.10) !important;
  animation: kol-focused-order 1.1s ease-in-out 2;
}
@keyframes kol-focused-order {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .active-order-live-status::before,
  .order-progress-step.is-current .order-progress-dot,
  .order-history-card.is-focused { animation: none !important; }
}
'''
css_path.write_text(css, encoding='utf-8')

index_path = Path('demo/index.html')
index = index_path.read_text(encoding='utf-8')
index = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', '/demo/css/customer.css?v=20260915-liveorder1', index)
index = re.sub(r'/demo/js/customer\.js\?v=[^"\']+', '/demo/js/customer.js?v=20260915-liveorder1', index)
index_path.write_text(index, encoding='utf-8')

sw_path = Path('demo/service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v40';", sw)
sw_path.write_text(sw, encoding='utf-8')
