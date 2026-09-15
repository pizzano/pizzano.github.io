from pathlib import Path
import re

# ---------------- customer live auto-ready ----------------
p = Path('demo/js/customer.js')
text = p.read_text(encoding='utf-8')

start = text.index('function activeCustomerOrders() {')
end = text.index('function activeOrderCardHtml(order) {', start)
new_active = r'''function effectiveCustomerOrder(order) {
  if (!order) return order;
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (
    readyAt > 0 &&
    readyAt <= Date.now() &&
    ['bekreftet', 'tilberedning'].includes(order.status)
  ) {
    return {
      ...order,
      status: 'klar',
      statusUpdatedAt: readyAt,
      autoReady: true,
    };
  }
  return order;
}

function activeCustomerOrders() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const seen = readySeenIds();
  return mergedCustomerOrders().map(effectiveCustomerOrder).filter((order) => {
    if (!order?.id || order.status === 'fullfort' || order.status === 'avvist') return false;
    if (order.status === 'klar') {
      if (seen.has(order.id)) return false;
      const readyAt = Number(order.statusUpdatedAt) || Number(order.createdAt) || Date.now();
      if (Date.now() - readyAt >= 5 * 60 * 1000) return false;
    }
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}

'''
text = text[:start] + new_active + text[end:]

text = text.replace(
    'const readyDismissTimers = new Map();\n',
    'const readyDismissTimers = new Map();\nconst scheduledReadyTransitions = new Map();\n'
)

marker = 'function notifyReadyOrders(orders) {'
if 'function syncScheduledReadyTransitions(orders)' not in text:
    insert = r'''function syncScheduledReadyTransitions(orders) {
  const keep = new Set();
  for (const order of orders) {
    if (!order?.id || !['bekreftet', 'tilberedning'].includes(order.status)) continue;
    const readyAt = Number(order.estimatedReadyAt) || 0;
    if (!readyAt) continue;
    keep.add(order.id);
    const existing = scheduledReadyTransitions.get(order.id);
    if (existing && existing.readyAt === readyAt) continue;
    if (existing) window.clearTimeout(existing.timer);
    const delay = Math.max(0, readyAt - Date.now()) + 80;
    const timer = window.setTimeout(() => {
      scheduledReadyTransitions.delete(order.id);
      renderActiveOrders();
      if (ui.view === 'profile') renderProfile();
    }, delay);
    scheduledReadyTransitions.set(order.id, { timer, readyAt });
  }
  for (const [orderId, entry] of scheduledReadyTransitions.entries()) {
    if (keep.has(orderId)) continue;
    window.clearTimeout(entry.timer);
    scheduledReadyTransitions.delete(orderId);
  }
}

'''
    text = text.replace(marker, insert + marker)

text = text.replace(
    '  syncActiveOrderWatchers(orders.map((order) => order.id));\n  notifyReadyOrders(orders);',
    '  syncScheduledReadyTransitions(orders);\n  syncActiveOrderWatchers(orders.map((order) => order.id));\n  notifyReadyOrders(orders);'
)
p.write_text(text, encoding='utf-8')

# ---------------- admin auto ready + list-only workflow ----------------
p = Path('demo/js/admin.js')
text = p.read_text(encoding='utf-8')

text = text.replace(
    'let actionOrderId = null;\n',
    'let actionOrderId = null;\nlet lastAutoOpenedPendingId = null;\nconst autoReadyBusy = new Set();\n'
)

if 'function syncOrdersWorkspaceLayout()' not in text:
    marker = 'function filteredOrders() {'
    insert = r'''function syncOrdersWorkspaceLayout() {
  const workspace = document.querySelector('.orders-app');
  if (!workspace) return;
  workspace.classList.toggle('is-list-only', !selectedOrderId);
}

'''
    text = text.replace(marker, insert + marker)

start = text.index('function renderOrders() {')
end = text.index('el.orderFilterBtns.forEach((button) => {', start)
new_render = r'''function renderOrders() {
  const all = getOrders();
  renderOrderTabs(all);
  el.ordersSummary.textContent = `${all.length} bestillinger · ${all.filter((order) => order.status === 'mottatt').length} nye`;
  const visible = filteredOrders();

  if (selectedOrderId && !visible.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = null;
  }

  const newestPending = visible.find((order) => order.status === 'mottatt');
  if (newestPending && newestPending.id !== lastAutoOpenedPendingId) {
    selectedOrderId = newestPending.id;
    lastAutoOpenedPendingId = newestPending.id;
  }

  renderOrderList();
  if (selectedOrderId) {
    renderOrderDetail(selectedOrderId);
  } else {
    el.orderDetailEmpty.hidden = false;
    el.orderDetailLive.hidden = true;
    el.orderDetailLive.innerHTML = '';
  }
  syncOrdersWorkspaceLayout();
}

'''
text = text[:start] + new_render + text[end:]

# Close detail after accepting so list expands; next waiting order opens automatically.
old_accept = """el.btnAcceptConfirm.addEventListener('click', async () => {\n  if (!actionOrderId) return;\n  const minutes = Math.max(1, Math.min(180, Math.round(Number(el.acceptMinutes.value) || 0)));"""
new_accept = """el.btnAcceptConfirm.addEventListener('click', async () => {\n  if (!actionOrderId) return;\n  const acceptedOrderId = actionOrderId;\n  const minutes = Math.max(1, Math.min(180, Math.round(Number(el.acceptMinutes.value) || 0)));"""
text = text.replace(old_accept, new_accept)
text = text.replace(
    """  selectedOrderId = actionOrderId;\n  closeModals();\n  renderOrders();""",
    """  lastAutoOpenedPendingId = acceptedOrderId;\n  selectedOrderId = null;\n  closeModals();\n  renderOrders();"""
)

# When manually marking ready, close the detail panel as well.
old_status = """  if (status && selectedOrderId) {\n    const ok = await updateOrderStatus(selectedOrderId, status.dataset.detailStatus);\n    renderOrders();\n    renderStats();\n    toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');\n    return;\n  }"""
new_status = """  if (status && selectedOrderId) {\n    const orderId = selectedOrderId;\n    const nextStatus = status.dataset.detailStatus;\n    const ok = await updateOrderStatus(orderId, nextStatus);\n    if (ok && nextStatus === 'klar') selectedOrderId = null;\n    renderOrders();\n    renderStats();\n    toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');\n    return;\n  }"""
text = text.replace(old_status, new_status)

if 'async function promoteExpiredOrdersToReady()' not in text:
    marker = 'function refreshOrderClocks() {'
    insert = r'''async function promoteExpiredOrdersToReady() {
  const now = Date.now();
  const due = getOrders().filter((order) => {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    return readyAt > 0 && readyAt <= now && ['bekreftet', 'tilberedning'].includes(order.status);
  });
  for (const order of due) {
    if (autoReadyBusy.has(order.id)) continue;
    autoReadyBusy.add(order.id);
    try {
      const ok = await updateOrderStatus(order.id, 'klar');
      if (!ok) continue;
      if (selectedOrderId === order.id) selectedOrderId = null;
      renderOrders();
      renderStats();
      toast(`#${String(order.id).slice(-6).toUpperCase()} er automatisk klar for henting.`);
    } finally {
      autoReadyBusy.delete(order.id);
    }
  }
}

'''
    text = text.replace(marker, insert + marker)

text = text.replace(
    'setInterval(refreshOrderClocks, 1000);\nrenderAll();',
    "setInterval(() => {\n  refreshOrderClocks();\n  void promoteExpiredOrdersToReady();\n}, 1000);\nvoid promoteExpiredOrdersToReady();\nrenderAll();"
)
p.write_text(text, encoding='utf-8')

# ---------------- admin CSS: collapse detail and stretch list ----------------
p = Path('demo/css/admin.css')
css = p.read_text(encoding='utf-8')
marker = '/* Orders auto-ready + list-only workspace 2026-09-15 */'
if marker not in css:
    css += r'''

/* Orders auto-ready + list-only workspace 2026-09-15 */
.orders-app.is-list-only {
  grid-template-columns: minmax(0, 1fr) !important;
}
.orders-app.is-list-only .order-detail-pane {
  display: none !important;
}
.orders-app.is-list-only .orders-inbox {
  width: 100%;
  max-width: none;
  border-right: 0;
}
.orders-app.is-list-only .orders-list-row {
  grid-template-columns: 54px minmax(0, 1fr) minmax(130px, auto);
  min-height: 104px;
  padding: 15px 28px;
}
.orders-app.is-list-only .orders-list-icon {
  width: 48px;
  height: 48px;
  font-size: 19px;
}
.orders-app.is-list-only .orders-list-main strong {
  font-size: 16px;
}
.orders-app.is-list-only .orders-list-main small {
  font-size: 12.5px;
}
.orders-app.is-list-only .orders-list-side strong {
  font-size: 16px;
}
.orders-app.is-list-only .orders-list-section-title {
  padding-left: 28px;
  padding-right: 28px;
}
@media (max-width: 760px) {
  .orders-app.is-list-only .orders-list-row {
    grid-template-columns: 46px minmax(0, 1fr) auto;
    min-height: 88px;
    padding: 12px 14px;
  }
  .orders-app.is-list-only .orders-list-icon {
    width: 40px;
    height: 40px;
  }
  .orders-app.is-list-only .orders-list-section-title {
    padding-left: 14px;
    padding-right: 14px;
  }
}
'''
p.write_text(css, encoding='utf-8')

# ---------------- cache busting ----------------
p = Path('demo/admin.html')
text = p.read_text(encoding='utf-8')
text = re.sub(r'/demo/css/admin\.css\?v=[^"\']+', '/demo/css/admin.css?v=20260915-orderspro2', text)
text = re.sub(r'/demo/js/admin\.js\?v=[^"\']+', '/demo/js/admin.js?v=20260915-orderspro2', text)
p.write_text(text, encoding='utf-8')

p = Path('demo/index.html')
text = p.read_text(encoding='utf-8')
text = re.sub(r'/demo/js/customer\.js\?v=[^"\']+', '/demo/js/customer.js?v=20260915-autoready1', text)
p.write_text(text, encoding='utf-8')

p = Path('demo/service-worker.js')
text = p.read_text(encoding='utf-8')
text = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v43';", text)
p.write_text(text, encoding='utf-8')
