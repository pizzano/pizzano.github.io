from pathlib import Path
import re

def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker)) if start >= 0 else -1
    if start < 0 or end < 0:
        raise SystemExit(f'{label} boundaries not found')
    return text[:start] + replacement + text[end:]

# ---------------- customer.js ----------------
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')

s = replace_between(
    s,
    'function mergedCustomerOrders() {',
    '\nfunction readySeenIds() {',
    '''function mergedCustomerOrders() {
  const localOrders = getLocalOrders();
  const liveOrders = getOrders();
  const local = Array.isArray(localOrders) ? localOrders : [];
  const live = Array.isArray(liveOrders) ? liveOrders : [];
  const byId = new Map(local.filter((order) => order?.id).map((order) => [order.id, order]));
  for (const remote of live) {
    if (!remote?.id) continue;
    const previous = byId.get(remote.id) || {};
    byId.set(remote.id, {
      ...previous,
      ...remote,
      status: remote.status || previous.status || 'mottatt',
      statusUpdatedAt: remote.statusUpdatedAt ?? previous.statusUpdatedAt ?? null,
      estimatedMinutes: remote.estimatedMinutes ?? null,
      estimatedAt: remote.estimatedAt ?? null,
      estimatedReadyAt: remote.estimatedReadyAt ?? null,
      lines: remote.lines?.length ? remote.lines : (previous.lines || []),
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );
}
''',
    'mergedCustomerOrders'
)

s = re.sub(r'\nfunction effectiveCustomerOrder\(order\) \{.*?\n\}\n', '\n', s, count=1, flags=re.S)
s = s.replace('return mergedCustomerOrders().map(effectiveCustomerOrder).filter((order) => {', 'return mergedCustomerOrders().filter((order) => {')

s = replace_between(
    s,
    'function customerOrderCountdown(order) {',
    '\nfunction activeOrderCardHtml(order) {',
    '''function customerOrderCountdown(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return 'Klar nå';
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')} igjen`;
}
''',
    'customerOrderCountdown'
)

s = replace_between(
    s,
    'function refreshCustomerOrderCountdowns() {',
    '\nfunction scheduleReadyDismiss(order) {',
    '''function refreshCustomerOrderCountdowns() {
  const visibleOrders = activeCustomerOrders();
  const byId = new Map(visibleOrders.map((order) => [order.id, order]));
  document.querySelectorAll('[data-customer-countdown]').forEach((node) => {
    const order = byId.get(node.dataset.customerCountdown);
    if (!order) return;
    const countdown = customerOrderCountdown(order);
    node.textContent = countdown || (Number(order.estimatedMinutes) > 0 ? `Ca. ${Number(order.estimatedMinutes)} min` : '');
  });

  // Use the raw live order state for the transition. Presentation helpers must
  // never mark an order ready only visually without persisting it to Firebase.
  for (const order of mergedCustomerOrders()) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    if (readyAt > 0 && readyAt <= Date.now() && ['bekreftet', 'tilberedning'].includes(order.status)) {
      void promoteCustomerExpiredOrder(order);
    }
  }
}
''',
    'refreshCustomerOrderCountdowns'
)

s = s.replace('const scheduledReadyTransitions = new Map();\n', '')
s = re.sub(r'\nfunction syncScheduledReadyTransitions\(orders\) \{.*?\n\}\n', '\n', s, count=1, flags=re.S)
s = s.replace('  syncScheduledReadyTransitions(orders);\n', '')
p.write_text(s, encoding='utf-8')

# ---------------- data.js ----------------
p = Path('demo/js/data.js')
s = p.read_text(encoding='utf-8')
s = replace_between(
    s,
    'function applyRemoteOrders(value) {',
    '\n/** Henter siste versjon fra databasen. */',
    '''function applyRemoteOrders(value) {
  const next = normalizeOrders(value);
  const snapshot = (orders) => JSON.stringify((orders || []).map((o) => [
    o.id,
    o.status,
    Number(o.statusUpdatedAt) || 0,
    Number(o.estimatedMinutes) || 0,
    Number(o.estimatedAt) || 0,
    Number(o.estimatedReadyAt) || 0,
    o.pickup || '',
    Number(o.total) || 0,
    Array.isArray(o.lines) ? o.lines.length : 0,
  ]));
  const before = snapshot(store.orders);
  const after = snapshot(next);
  store.orders = next;
  return before !== after;
}

''',
    'applyRemoteOrders'
)
p.write_text(s, encoding='utf-8')

# ---------------- admin.js ----------------
p = Path('demo/js/admin.js')
s = p.read_text(encoding='utf-8')
s = s.replace("orderFilterBtns: document.querySelectorAll('.filter-btn[data-order-filter]'),", "orderFilterBtns: document.querySelectorAll('.orders-tab[data-order-filter]'),")

# Countdown should never linger as 00:00; readiness is handled immediately.
s = replace_between(
    s,
    'function orderCountdown(order) {',
    '\nfunction orderListStatus(order) {',
    '''function orderCountdown(order) {
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return '';
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
''',
    'orderCountdown'
)

start = s.find('function orderListRowHtml(order, isNew = false) {')
end = s.find('\nfunction renderOrderTabs(allOrders) {', start)
if start < 0 or end < 0:
    raise SystemExit('order list row boundaries not found')
replacement = r'''function orderCenterText(order) {
  if (order.status === 'klar') return 'Klar for henting';
  if (order.status === 'mottatt') return 'Venter på svar';
  if (['bekreftet', 'tilberedning'].includes(order.status)) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    if (readyAt) {
      const remainingMs = readyAt - Date.now();
      if (remainingMs <= 0) return 'Klar nå';
      const seconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes} min. ${String(secs).padStart(2, '0')} sek.`;
    }
  }
  return orderListStatus(order);
}

function orderListRowHtml(order, isNew = false) {
  const selected = order.id === selectedOrderId;
  return `
    <button class="orders-list-row${isNew ? ' is-new' : ''}${selected ? ' is-selected' : ''}" data-select-order="${escapeHtml(order.id)}" type="button">
      <span class="orders-list-icon" aria-hidden="true">${order.type === 'levering' ? '🛵' : '🥡'}</span>
      <span class="orders-list-main">
        <span class="orders-list-name-row">
          <strong>${escapeHtml(order.customerName || 'Ukjent kunde')}</strong>
          ${isNew ? '<b class="orders-new-pill">NY</b>' : ''}
        </span>
        <small><i class="orders-status-mark"></i>${escapeHtml(orderListStatus(order))}</small>
      </span>
      <span class="orders-list-center" data-order-center="${escapeHtml(order.id)}">${escapeHtml(orderCenterText(order))}</span>
      <span class="orders-list-side">
        <strong>${order.status === 'klar' ? 'Klar' : formatPrice(order.total)}</strong>
        <small>${escapeHtml(compactOrderTime(order.createdAt))}</small>
      </span>
    </button>`;
}
'''
s = s[:start] + replacement + s[end:]

# Only Alle exists; keep filter state single-source.
s = re.sub(r'function filteredOrders\(\) \{.*?\n\}\n\nfunction compactOrderTime', "function filteredOrders() {\n  ui.orderFilter = 'all';\n  return getOrders();\n}\n\nfunction compactOrderTime", s, count=1, flags=re.S)

# Show both the assigned duration and the live remaining time inside the order.
old_meta = '''${estimated && !isPending ? `<div class="pos-meta-countdown"><span>Tid igjen</span><strong data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(countdown || '00:00')}</strong></div>` : ''}'''
new_meta = '''${estimated && !isPending ? `<div><span>Gitt tid</span><strong>${estimated} min</strong></div>
          <div class="pos-meta-countdown"><span>Tid igjen</span><strong data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(countdown || (order.status === 'klar' ? 'Klar nå' : '—'))}</strong></div>` : ''}'''
if old_meta not in s:
    raise SystemExit('current admin countdown meta row not found')
s = s.replace(old_meta, new_meta, 1)
s = s.replace('data-detail-estimate type="number"', 'data-detail-estimate autocomplete="off" type="number"', 1)

s = replace_between(
    s,
    'function refreshOrderClocks() {',
    '\n/* ------------------------------------------------------------------ *\n * Restaurantinnstillinger',
    '''function refreshOrderClocks() {
  if (ui.page !== 'orders') return;
  document.querySelectorAll('[data-order-center]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderCenter);
    if (!order) return;
    node.textContent = orderCenterText(order);
  });
  document.querySelectorAll('[data-detail-countdown]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.detailCountdown);
    if (!order) return;
    node.textContent = orderCountdown(order) || (order.status === 'klar' ? 'Klar nå' : '—');
  });
}

''',
    'refreshOrderClocks'
)
p.write_text(s, encoding='utf-8')

# ---------------- admin.css ----------------
p = Path('demo/css/admin.css')
s = p.read_text(encoding='utf-8')
marker = '/* Centered live order state 2026-09-15 */'
if marker in s:
    s = s.split(marker)[0].rstrip() + '\n'
s += r'''

/* Centered live order state 2026-09-15 */
.orders-list-center { display: none; }
.orders-app.is-list-only .orders-list-row {
  grid-template-columns: 52px minmax(220px, 360px) minmax(260px, 1fr) 120px !important;
  min-height: 108px;
  column-gap: 18px;
}
.orders-app.is-list-only .orders-list-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  color: #2dbd59;
  font-size: clamp(18px, 1.75vw, 25px);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -.02em;
  text-align: center;
  white-space: nowrap;
}
.orders-app.is-list-only .orders-list-row.is-new .orders-list-center {
  color: #f06c00;
  font-size: clamp(16px, 1.4vw, 20px);
}
.orders-app.is-list-only .orders-list-side,
.orders-app.is-list-only .orders-list-main { align-self: center; }
.pos-meta-countdown strong { color:#2dbd59; font-weight:800; }
@media (max-width: 900px) {
  .orders-app.is-list-only .orders-list-row {
    grid-template-columns: 44px minmax(0, 1fr) auto !important;
  }
  .orders-app.is-list-only .orders-list-center {
    grid-column: 2 / -1;
    justify-content: flex-start;
    margin-top: 4px;
    font-size: 17px;
    white-space: normal;
  }
}
'''
p.write_text(s, encoding='utf-8')

# ---------------- cache bust ----------------
p = Path('demo/admin.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/css/admin\.css\?v=[^\"\']+', '/demo/css/admin.css?v=20260915-orderstable2', s)
s = re.sub(r'/demo/js/admin\.js\?v=[^\"\']+', '/demo/js/admin.js?v=20260915-orderstable2', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', '/demo/js/customer.js?v=20260915-orderstable2', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v45';", s)
p.write_text(s, encoding='utf-8')
