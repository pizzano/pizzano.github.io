from pathlib import Path
import re

VERSION = '20260915-orderfix3'

# data.js: keep rejection fields when normalizing orders.
p = Path('demo/js/data.js')
s = p.read_text(encoding='utf-8')
needle = "        estimatedReadyAt: Number(order.estimatedReadyAt) || null,\n"
insert = needle + "        rejectionReason: String(order.rejectionReason || ''),\n        rejectionMessage: String(order.rejectionMessage || ''),\n"
if "rejectionReason: String(order.rejectionReason" not in s:
    if needle not in s:
        raise SystemExit('data normalize timer line not found')
    s = s.replace(needle, insert, 1)

snap_needle = "    Number(o.estimatedReadyAt) || 0,\n    o.pickup || '',\n"
snap_repl = "    Number(o.estimatedReadyAt) || 0,\n    o.rejectionReason || '',\n    o.rejectionMessage || '',\n    o.pickup || '',\n"
if snap_needle in s:
    s = s.replace(snap_needle, snap_repl, 1)
p.write_text(s, encoding='utf-8')

# install.js: the traffic guard used to copy only status/statusUpdatedAt into kol_orders_v1.
# Copy the complete remote order snapshot so synthetic root polls cannot erase timers/rejection data.
p = Path('demo/js/install.js')
s = p.read_text(encoding='utf-8')
old = '''        let changed = false;
        const merged = orders.map((order) => {
          const remote = byId.get(order.id);
          if (!remote) return order;
          if (remote.status === order.status && remote.statusUpdatedAt === order.statusUpdatedAt) return order;
          changed = true;
          return {
            ...order,
            status: remote.status || order.status,
            statusUpdatedAt: Number(remote.statusUpdatedAt) || order.statusUpdatedAt,
          };
        });

        if (changed) writeStoredJSON(ORDERS_LOCAL_KEY, merged);'''
new = '''        let changed = false;
        const merged = orders.map((order) => {
          const remote = byId.get(order.id);
          if (!remote) return order;
          const next = {
            ...order,
            ...remote,
            id: order.id,
            lines: Array.isArray(remote.lines) && remote.lines.length ? remote.lines : (order.lines || []),
          };
          const beforeKey = JSON.stringify([
            order.status || '', Number(order.statusUpdatedAt) || 0,
            Number(order.estimatedMinutes) || 0, Number(order.estimatedAt) || 0,
            Number(order.estimatedReadyAt) || 0, order.rejectionReason || '', order.rejectionMessage || ''
          ]);
          const afterKey = JSON.stringify([
            next.status || '', Number(next.statusUpdatedAt) || 0,
            Number(next.estimatedMinutes) || 0, Number(next.estimatedAt) || 0,
            Number(next.estimatedReadyAt) || 0, next.rejectionReason || '', next.rejectionMessage || ''
          ]);
          if (beforeKey !== afterKey) changed = true;
          return next;
        });

        if (changed) writeStoredJSON(ORDERS_LOCAL_KEY, merged);'''
if old not in s:
    raise SystemExit('install.js status-only merge block not found')
s = s.replace(old, new, 1)
s = re.sub(r"loadModule\('allergenUiModule', '/demo/js/allergen-ui\.js\?v=[^']+'\);", f"loadModule('allergenUiModule', '/demo/js/allergen-ui.js?v={VERSION}');", s)
p.write_text(s, encoding='utf-8')

# customer.js
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"from './data\.js(?:\?v=[^']+)?';", f"from './data.js?v={VERSION}';", s)

key_needle = "const READY_SEEN_KEY = 'kol_ready_seen_v1';\n"
key_repl = key_needle + "const CUSTOMER_ORDERS_KEY = 'kol_orders_v1';\nconst REJECTED_SEEN_KEY = 'kol_rejected_seen_v1';\n"
if "const CUSTOMER_ORDERS_KEY" not in s:
    if key_needle not in s:
        raise SystemExit('customer keys location not found')
    s = s.replace(key_needle, key_repl, 1)

start = s.index('function mergedCustomerOrders() {')
end = s.index('\nfunction readySeenIds()', start)
replacement = '''const stableCustomerOrderSnapshots = new Map();

function mergeStableCustomerOrder(previous = {}, incoming = {}) {
  const next = { ...previous, ...incoming };
  for (const key of ['estimatedMinutes', 'estimatedAt', 'estimatedReadyAt', 'rejectionReason', 'rejectionMessage']) {
    const value = incoming ? incoming[key] : null;
    if ((value === undefined || value === null || value === '') && previous[key] !== undefined && previous[key] !== null && previous[key] !== '') {
      next[key] = previous[key];
    }
  }
  if ((!Array.isArray(next.lines) || !next.lines.length) && Array.isArray(previous.lines)) next.lines = previous.lines;
  return next;
}

function rememberCustomerOrder(order) {
  if (!order?.id) return order || {};
  const previous = stableCustomerOrderSnapshots.get(order.id) || {};
  const next = mergeStableCustomerOrder(previous, order);
  stableCustomerOrderSnapshots.set(order.id, next);
  return next;
}

function persistCustomerOrderSnapshot(order) {
  if (!order?.id) return;
  const remembered = rememberCustomerOrder(order);
  const current = loadJSON(CUSTOMER_ORDERS_KEY, []);
  const list = Array.isArray(current) ? [...current] : [];
  const index = list.findIndex((entry) => entry?.id === remembered.id);
  if (index >= 0) list[index] = mergeStableCustomerOrder(list[index], remembered);
  else list.unshift(remembered);
  saveJSON(CUSTOMER_ORDERS_KEY, list.slice(0, 30));
}

function mergedCustomerOrders() {
  const localOrders = getLocalOrders();
  const liveOrders = getOrders();
  const local = Array.isArray(localOrders) ? localOrders : [];
  const live = Array.isArray(liveOrders) ? liveOrders : [];
  const byId = new Map();

  for (const order of local) {
    if (!order?.id) continue;
    byId.set(order.id, rememberCustomerOrder(order));
  }

  for (const remote of live) {
    if (!remote?.id) continue;
    const previous = byId.get(remote.id) || stableCustomerOrderSnapshots.get(remote.id) || {};
    const merged = rememberCustomerOrder(mergeStableCustomerOrder(previous, remote));
    byId.set(remote.id, merged);
  }

  for (const [orderId, snapshot] of stableCustomerOrderSnapshots.entries()) {
    if (!byId.has(orderId)) continue;
    byId.set(orderId, mergeStableCustomerOrder(byId.get(orderId), snapshot));
  }

  return Array.from(byId.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );
}
'''
s = s[:start] + replacement + s[end:]

ready_block = '''function markReadySeen(orderId) {
  if (!orderId) return;
  const seen = readySeenIds();
  seen.add(orderId);
  saveJSON(READY_SEEN_KEY, Array.from(seen).slice(-30));
}
'''
rejected_block = ready_block + '''
function rejectedSeenIds() {
  return new Set(loadJSON(REJECTED_SEEN_KEY, []));
}

function markRejectedSeen(orderId) {
  if (!orderId) return;
  const seen = rejectedSeenIds();
  seen.add(orderId);
  saveJSON(REJECTED_SEEN_KEY, Array.from(seen).slice(-30));
}
'''
if 'function rejectedSeenIds()' not in s:
    if ready_block not in s:
        raise SystemExit('ready seen block not found')
    s = s.replace(ready_block, rejected_block, 1)

old_active = '''function activeCustomerOrders() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const seen = readySeenIds();
  return mergedCustomerOrders().filter((order) => {
    if (!order?.id || order.status === 'fullfort' || order.status === 'avvist') return false;
    if (order.status === 'klar') {
      if (seen.has(order.id)) return false;
      const readyAt = Number(order.statusUpdatedAt) || Number(order.createdAt) || Date.now();
      if (Date.now() - readyAt >= 5 * 60 * 1000) return false;
    }
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}'''
new_active = '''function activeCustomerOrders() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const readySeen = readySeenIds();
  const rejectedSeen = rejectedSeenIds();
  return mergedCustomerOrders().filter((order) => {
    if (!order?.id || order.status === 'fullfort') return false;
    if (order.status === 'avvist') {
      if (rejectedSeen.has(order.id)) return false;
      const createdAt = Number(order.createdAt) || 0;
      return !createdAt || createdAt >= cutoff;
    }
    if (order.status === 'klar') {
      if (readySeen.has(order.id)) return false;
      const readyAt = Number(order.statusUpdatedAt) || Number(order.createdAt) || Date.now();
      if (Date.now() - readyAt >= 5 * 60 * 1000) return false;
    }
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}'''
if old_active not in s:
    raise SystemExit('activeCustomerOrders block not found')
s = s.replace(old_active, new_active, 1)

start = s.index('function activeOrderCardHtml(order) {')
end = s.index('\nconst activeOrderStreams', start)
card_fn = '''function activeOrderCardHtml(order) {
  const rejectedNow = order.status === 'avvist';
  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === order.status);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const readyNow = order.status === 'klar';
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const hasLiveEstimate = estimated > 0 && Number(order.estimatedReadyAt) > 0 && ['bekreftet', 'tilberedning'].includes(order.status);
  const rejectionReason = String(order.rejectionReason || '').trim();
  const rejectionMessage = String(order.rejectionMessage || '').trim();
  const rejectionTitle = rejectionReason && rejectionReason !== 'Egendefinert melding' ? rejectionReason : 'Bestillingen ble avvist';
  const rejectionDetail = rejectionMessage || (rejectionReason === 'Egendefinert melding' ? '' : 'Kontakt restauranten hvis du lurer på noe.');
  const progress = CUSTOMER_STATUS_FLOW.map((step, stepIndex) => {
    const complete = stepIndex < index;
    const current = stepIndex === index;
    return `<div class="order-progress-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}"><span class="order-progress-dot">${complete ? '✓' : ''}</span><small>${escapeHtml(step.short)}</small></div>`;
  }).join('');
  return `<section class="active-order-card${readyNow ? ' is-ready' : ''}${rejectedNow ? ' is-rejected' : ''}" data-active-order-card="${escapeHtml(order.id)}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div><span class="active-order-kicker">${rejectedNow ? 'BESTILLING' : 'Aktiv bestilling'}</span><strong class="active-order-live-status">${escapeHtml(rejectedNow ? 'Avvist' : (readyNow ? 'Klar for henting' : orderStatusLabel(order.status)))}</strong></div>
      <div class="active-order-head-actions"><span class="active-order-number">#${escapeHtml(shortId)}</span>${readyNow ? `<button class="active-order-dismiss" data-ready-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk klar-meldingen">×</button>` : ''}${rejectedNow ? `<button class="active-order-dismiss" data-rejected-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk avvisningsmeldingen">×</button>` : ''}</div>
    </div>
    ${!rejectedNow ? `<div class="order-progress" aria-label="Bestillingsstatus">${progress}</div>` : ''}
    ${hasLiveEstimate && !readyNow && !rejectedNow ? `<div class="active-order-estimate"><span>⏱</span><strong data-customer-countdown="${escapeHtml(order.id)}">${escapeHtml(customerOrderCountdown(order))}</strong><small>oppgitt av restauranten</small></div>` : ''}
    ${readyNow ? `<div class="active-order-ready-callout"><span class="ready-check">✓</span><div><strong>Maten din er klar</strong><small>Kom og hent bestillingen nå.</small></div></div>` : ''}
    ${rejectedNow ? `<div class="active-order-rejected-callout"><span class="rejected-mark">×</span><div><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionDetail ? `<small>${escapeHtml(rejectionDetail)}</small>` : ''}</div></div>` : ''}
    <div class="active-order-meta"><span>Henting <b>${escapeHtml(order.pickup || '—')}</b></span><span><b>${formatPrice(order.total)}</b></span></div>
    <button class="active-order-open" data-active-orders="${escapeHtml(order.id)}" type="button">Se bestillingen</button>
  </section>`;
}
'''
s = s[:start] + card_fn + s[end:]

upsert_needle = '''function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const normalized = { ...remote, id: remote.id || orderId };
  const orders = Array.isArray(store.orders) ? [...store.orders] : [];'''
upsert_repl = '''function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const normalized = rememberCustomerOrder({ ...remote, id: remote.id || orderId });
  persistCustomerOrderSnapshot(normalized);
  const orders = Array.isArray(store.orders) ? [...store.orders] : [];'''
if upsert_needle not in s:
    raise SystemExit('upsertLiveOrder header not found')
s = s.replace(upsert_needle, upsert_repl, 1)

click_needle = '''  const readyDismiss = event.target.closest('[data-ready-dismiss]');
  if (readyDismiss) {
    const orderId = readyDismiss.dataset.readyDismiss;
    const timer = readyDismissTimers.get(orderId);
    if (timer) clearTimeout(timer);
    readyDismissTimers.delete(orderId);
    markReadySeen(orderId);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
    return;
  }
'''
click_repl = click_needle + '''  const rejectedDismiss = event.target.closest('[data-rejected-dismiss]');
  if (rejectedDismiss) {
    markRejectedSeen(rejectedDismiss.dataset.rejectedDismiss);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
    return;
  }
'''
if "data-rejected-dismiss" not in s[s.index('document.addEventListener'):]:
    if click_needle not in s:
        raise SystemExit('ready dismiss handler not found')
    s = s.replace(click_needle, click_repl, 1)

status_needle = '''            const current = live.find((entry) => entry.id === order.id);
            const status = orderStatusLabel(current ? current.status : order.status);
            const details = (order.lines || []).map(orderHistoryLineHtml).join('');'''
status_repl = '''            const current = live.find((entry) => entry.id === order.id);
            const displayOrder = current ? mergeStableCustomerOrder(order, current) : order;
            const status = orderStatusLabel(displayOrder.status);
            const rejectionReason = String(displayOrder.rejectionReason || '').trim();
            const rejectionMessage = String(displayOrder.rejectionMessage || '').trim();
            const rejectionTitle = rejectionReason && rejectionReason !== 'Egendefinert melding' ? rejectionReason : 'Bestillingen ble avvist';
            const details = (order.lines || []).map(orderHistoryLineHtml).join('');'''
if status_needle not in s:
    raise SystemExit('profile order status block not found')
s = s.replace(status_needle, status_repl, 1)

hist_needle = '''                <div class="order-history-details">
                  <div class="order-history-lines">${details || '<p class="hint">Ingen varelinjer lagret.</p>'}</div>'''
hist_repl = '''                <div class="order-history-details">
                  ${displayOrder.status === 'avvist' ? `<div class="order-history-rejection"><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionMessage ? `<span>${escapeHtml(rejectionMessage)}</span>` : ''}</div>` : ''}
                  <div class="order-history-lines">${details || '<p class="hint">Ingen varelinjer lagret.</p>'}</div>'''
if hist_needle not in s:
    raise SystemExit('history details block not found')
s = s.replace(hist_needle, hist_repl, 1)
p.write_text(s, encoding='utf-8')

# Keep all modules on the same data.js URL.
for file in ['demo/js/admin.js', 'demo/js/allergen-ui.js']:
    p = Path(file)
    s = p.read_text(encoding='utf-8')
    s = re.sub(r"from './data\.js(?:\?v=[^']+)?';", f"from './data.js?v={VERSION}';", s)
    p.write_text(s, encoding='utf-8')

# customer.css rejected state.
p = Path('demo/css/customer.css')
s = p.read_text(encoding='utf-8')
marker = '/* Rejected order notice 2026-09-15 */'
if marker not in s:
    s += '''

/* Rejected order notice 2026-09-15 */
.active-order-card.is-rejected {
  border-color: #efb6b1;
  background: #fff9f8;
}
.active-order-card.is-rejected .active-order-kicker,
.active-order-card.is-rejected .active-order-live-status {
  color: #b6332d;
}
.active-order-card.is-rejected .active-order-dismiss {
  color: #b6332d;
  border-color: #efc7c3;
  background: #fff;
}
.active-order-rejected-callout {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 10px 0 8px;
  padding: 12px;
  border: 1px solid #efc7c3;
  border-radius: 14px;
  background: #fff1ef;
  color: #8f2b27;
}
.active-order-rejected-callout .rejected-mark {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #d94c43;
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}
.active-order-rejected-callout > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.active-order-rejected-callout strong {
  font-size: 13px;
  line-height: 1.25;
  font-weight: 800;
}
.active-order-rejected-callout small {
  color: #8d5a56;
  font-size: 11.5px;
  line-height: 1.4;
}
.order-history-rejection {
  display: grid;
  gap: 4px;
  margin: 0 0 12px;
  padding: 11px 12px;
  border: 1px solid #efc7c3;
  border-radius: 12px;
  background: #fff1ef;
  color: #8f2b27;
}
.order-history-rejection strong { font-size: 12.5px; }
.order-history-rejection span { font-size: 11.5px; line-height: 1.4; }
'''
p.write_text(s, encoding='utf-8')

# Cache bust modified customer/admin scripts and service worker.
p = Path('demo/index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/install\.js\?v=[^"\']+', f'/demo/js/install.js?v={VERSION}', s)
s = re.sub(r'/demo/js/customer\.js\?v=[^"\']+', f'/demo/js/customer.js?v={VERSION}', s)
s = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', f'/demo/css/customer.css?v={VERSION}', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/admin.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/admin\.js\?v=[^"\']+', f'/demo/js/admin.js?v={VERSION}', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v48';", s)
p.write_text(s, encoding='utf-8')
