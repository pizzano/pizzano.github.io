from pathlib import Path
import re

# data.js: accept + timer must be one atomic Firebase PATCH
p = Path('demo/js/data.js')
s = p.read_text(encoding='utf-8')
if 'export async function acceptOrderWithEstimate' not in s:
    marker = '\n\n/** Avviser en ordre og lagrer årsaken. */'
    if marker not in s:
        raise SystemExit('data.js insertion marker not found')
    fn = r'''

/** Godtar en ordre og starter ventetiden i én atomisk oppdatering. */
export async function acceptOrderWithEstimate(orderId, minutes) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const value = Math.max(1, Math.min(180, Math.round(Number(minutes) || 0)));
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    estimatedMinutes: order.estimatedMinutes,
    estimatedAt: order.estimatedAt,
    estimatedReadyAt: order.estimatedReadyAt,
  };
  const now = Date.now();
  const readyAt = now + value * 60 * 1000;
  order.status = 'bekreftet';
  order.statusUpdatedAt = now;
  order.estimatedMinutes = value;
  order.estimatedAt = now;
  order.estimatedReadyAt = readyAt;
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        status: 'bekreftet',
        statusUpdatedAt: now,
        estimatedMinutes: value,
        estimatedAt: now,
        estimatedReadyAt: readyAt,
      });
      remoteOnline = true;
    }
    setSaveState('saved');
    return true;
  } catch (err) {
    Object.assign(order, previous);
    emitData('local');
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}
'''
    s = s.replace(marker, fn + marker, 1)
p.write_text(s, encoding='utf-8')

# admin.js
p = Path('demo/js/admin.js')
s = p.read_text(encoding='utf-8')
if 'acceptOrderWithEstimate,' not in s:
    s = s.replace('  updateOrderEstimate,\n', '  updateOrderEstimate,\n  acceptOrderWithEstimate,\n', 1)
s = s.replace('let lastAutoOpenedPendingId = null;\n', '')

# Do not auto-open a newly arrived order. Admin explicitly chooses it from the list.
s = re.sub(
    r'''\n  const newestPending = visible\.find\(\(order\) => order\.status === 'mottatt'\);\n  if \(newestPending && newestPending\.id !== lastAutoOpenedPendingId\) \{\n    selectedOrderId = newestPending\.id;\n    lastAutoOpenedPendingId = newestPending\.id;\n  \}\n''',
    '\n',
    s,
    count=1,
)
s = s.replace('    if (selectedOrderId) lastAutoOpenedPendingId = selectedOrderId;\n', '')

old = '''function orderCenterText(order) {
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
}'''
new = '''function orderCenterText(order) {
  if (order.status === 'klar') return 'Klar for henting';
  if (order.status === 'mottatt') return 'Venter på svar';
  if (['bekreftet', 'tilberedning'].includes(order.status)) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    const label = order.status === 'bekreftet' ? 'Godtatt' : 'Tilberedes';
    if (readyAt) {
      const remainingMs = readyAt - Date.now();
      if (remainingMs <= 0) return `${label} · Klar nå`;
      const seconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${label} · ${minutes}:${String(secs).padStart(2, '0')} igjen`;
    }
    return label;
  }
  return orderListStatus(order);
}'''
if old not in s:
    raise SystemExit('orderCenterText block not found')
s = s.replace(old, new, 1)

old = '''el.btnAcceptConfirm.addEventListener('click', async () => {
  if (!actionOrderId) return;
  const acceptedOrderId = actionOrderId;
  const minutes = Math.max(1, Math.min(180, Math.round(Number(el.acceptMinutes.value) || 0)));
  if (!minutes) {
    toast('Velg eller skriv minutter.');
    el.acceptMinutes.focus();
    return;
  }
  el.btnAcceptConfirm.disabled = true;
  const timeOk = await updateOrderEstimate(actionOrderId, minutes);
  const statusOk = timeOk ? await updateOrderStatus(actionOrderId, 'bekreftet') : false;
  el.btnAcceptConfirm.disabled = false;
  if (!statusOk) {
    toast('Kunne ikke godta bestillingen.');
    return;
  }
  lastAutoOpenedPendingId = acceptedOrderId;
  selectedOrderId = null;
  closeModals();
  renderOrders();
  renderStats();
  toast(`Bestillingen er godtatt · ca. ${minutes} min.`);
});'''
new = '''el.btnAcceptConfirm.addEventListener('click', async () => {
  if (!actionOrderId) return;
  const minutes = Math.max(1, Math.min(180, Math.round(Number(el.acceptMinutes.value) || 0)));
  if (!minutes) {
    toast('Velg eller skriv minutter.');
    el.acceptMinutes.focus();
    return;
  }
  el.btnAcceptConfirm.disabled = true;
  const ok = await acceptOrderWithEstimate(actionOrderId, minutes);
  el.btnAcceptConfirm.disabled = false;
  if (!ok) {
    toast('Kunne ikke godta bestillingen.');
    return;
  }
  selectedOrderId = null;
  closeModals();
  renderOrders();
  renderStats();
  toast(`Bestillingen er godtatt · ${minutes} min.`);
});'''
if old not in s:
    raise SystemExit('accept confirm block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# customer.js: never render a guessed/stale 0-minute estimate. Only show a real live deadline.
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')
s = s.replace(
    "  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);\n  const progress = CUSTOMER_STATUS_FLOW.map",
    "  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);\n  const hasLiveEstimate = estimated > 0 && Number(order.estimatedReadyAt) > 0 && ['bekreftet', 'tilberedning'].includes(order.status);\n  const progress = CUSTOMER_STATUS_FLOW.map",
    1,
)
s = s.replace(
    '${estimated && !readyNow ? `<div class="active-order-estimate">',
    '${hasLiveEstimate && !readyNow ? `<div class="active-order-estimate">',
    1,
)
s = s.replace(
    "    node.textContent = countdown || (Number(order.estimatedMinutes) > 0 ? `Ca. ${Number(order.estimatedMinutes)} min` : '');",
    "    node.textContent = countdown || '';",
    1,
)
p.write_text(s, encoding='utf-8')

# admin.css: smaller centered live state; show status and time as one calm POS label.
p = Path('demo/css/admin.css')
s = p.read_text(encoding='utf-8')
marker = '/* Atomic accept timer polish 2026-09-15 */'
if marker in s:
    s = s.split(marker)[0].rstrip() + '\n'
s += r'''

/* Atomic accept timer polish 2026-09-15 */
.orders-app.is-list-only .orders-list-center {
  font-size: clamp(15px, 1.35vw, 20px) !important;
  font-weight: 750 !important;
  letter-spacing: -.01em !important;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 900px) {
  .orders-app.is-list-only .orders-list-center {
    font-size: 15px !important;
  }
}
'''
p.write_text(s, encoding='utf-8')

# Cache busting
p = Path('demo/admin.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/admin\.js\?v=[^\"\']+', '/demo/js/admin.js?v=20260915-atomic2', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', '/demo/js/customer.js?v=20260915-atomic2', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v46';", s)
p.write_text(s, encoding='utf-8')
