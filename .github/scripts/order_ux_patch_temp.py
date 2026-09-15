from pathlib import Path
import re

# data.js: add a small field update helper for the manual ETA sent by admin.
p = Path('demo/js/data.js')
t = p.read_text(encoding='utf-8')
if 'export async function updateOrderEstimate' not in t:
    marker = '/** Alle ordre, nyeste først. */'
    code = '''/** Oppdaterer forventet ventetid på en ordre (admin). */
export async function updateOrderEstimate(orderId, minutes) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const value = Math.max(0, Math.min(180, Math.round(Number(minutes) || 0)));
  const previous = {
    estimatedMinutes: order.estimatedMinutes,
    estimatedAt: order.estimatedAt,
    estimatedReadyAt: order.estimatedReadyAt,
  };
  const now = Date.now();
  order.estimatedMinutes = value || null;
  order.estimatedAt = value ? now : null;
  order.estimatedReadyAt = value ? now + value * 60 * 1000 : null;
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        estimatedMinutes: order.estimatedMinutes,
        estimatedAt: order.estimatedAt,
        estimatedReadyAt: order.estimatedReadyAt,
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
    if marker not in t:
        raise SystemExit('data.js order marker missing')
    t = t.replace(marker, code + marker, 1)
p.write_text(t, encoding='utf-8')

# admin.js: compact ticket-like order cards, new orders on top, manual ETA, four statuses.
p = Path('demo/js/admin.js')
t = p.read_text(encoding='utf-8')
if '  updateOrderEstimate,' not in t:
    t = t.replace('  updateOrderStatus,\n', '  updateOrderStatus,\n  updateOrderEstimate,\n', 1)
if 'const ADMIN_ORDER_STATUSES' not in t:
    marker = '/* ------------------------------------------------------------------ *\n * Bestillinger\n * ------------------------------------------------------------------ */\n'
    if marker not in t:
        raise SystemExit('admin.js order marker missing')
    t = t.replace(marker, marker + "\nconst ADMIN_ORDER_STATUSES = ORDER_STATUSES.filter((status) => ['mottatt', 'bekreftet', 'tilberedning', 'klar'].includes(status.id));\n", 1)

render_block = '''function adminOrderCardHtml(order, isNew = false) {
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  return `
    <article class="order-card admin-order-card${isNew ? ' is-new-order' : ''}" data-order="${escapeHtml(order.id)}">
      <header class="admin-order-head">
        <div>
          <div class="admin-order-number-row">
            <strong>#${escapeHtml(shortId)}</strong>
            ${isNew ? '<span class="new-order-badge">NY</span>' : ''}
          </div>
          <span>${escapeHtml(timeStamp(order.createdAt))}</span>
        </div>
        <span class="status-pill" data-status="${escapeHtml(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>
      </header>
      <div class="admin-order-customer">
        <strong>${escapeHtml(order.customerName || '—')}</strong>
        <span>${escapeHtml(order.phone || '—')}</span>
      </div>
      <div class="admin-order-pickup"><span>Hentetid</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>
      <div class="admin-order-lines">
        ${(order.lines || []).map((line) => `
          <div class="admin-order-line">
            <span class="admin-order-qty">${Number(line.quantity) || 1}×</span>
            <div>
              <strong>${escapeHtml(line.name || 'Produkt')}</strong>
              ${line.size ? `<small>${escapeHtml(line.size)}</small>` : ''}
              ${(line.options || []).length ? `<small>${line.options.map((opt) => escapeHtml(opt)).join(' · ')}</small>` : ''}
              ${line.comment ? `<small class="admin-order-comment">«${escapeHtml(line.comment)}»</small>` : ''}
            </div>
            <b>${formatPrice(line.price)}</b>
          </div>`).join('')}
      </div>
      <div class="admin-order-total"><span>Totalt</span><strong>${formatPrice(order.total)}</strong></div>
      <div class="admin-order-estimate">
        <div class="admin-order-estimate-copy">
          <strong>Forventet tid</strong>
          <span>${estimated ? `Kunden ser ca. ${estimated} min` : 'Skriv tiden kunden skal se'}</span>
        </div>
        <div class="admin-order-estimate-control">
          <input class="input" data-estimate-input="${escapeHtml(order.id)}" type="number" inputmode="numeric" min="1" max="180" step="1" value="${estimated || ''}" placeholder="10">
          <span>min</span>
          <button class="btn btn-primary btn-xs" data-save-estimate="${escapeHtml(order.id)}" type="button">Send tid</button>
        </div>
      </div>
      <div class="admin-order-status-actions" role="group" aria-label="Endre status">
        ${ADMIN_ORDER_STATUSES.map((status) => `<button class="admin-status-btn${status.id === order.status ? ' is-active' : ''}" data-set-list-status="${escapeHtml(status.id)}" data-order-id="${escapeHtml(order.id)}" type="button">${escapeHtml(status.label)}</button>`).join('')}
      </div>
      <button class="admin-order-detail-btn" data-order-detail="${escapeHtml(order.id)}" type="button">Se detaljer</button>
    </article>`;
}

function renderOrders() {
  const orders = filteredOrders();
  const all = getOrders();
  const newOrders = orders.filter((order) => order.status === 'mottatt');
  const otherOrders = orders.filter((order) => order.status !== 'mottatt');
  el.ordersSummary.textContent = `${all.length} bestillinger totalt · ${all.filter((order) => order.status === 'mottatt').length} nye venter`;
  const sections = [];
  if (newOrders.length) {
    sections.push(`<section class="admin-order-section is-new-section"><div class="admin-order-section-head"><div><span class="admin-order-live-dot"></span><strong>Nye bestillinger</strong></div><span>${newOrders.length}</span></div><div class="admin-order-grid">${newOrders.map((order) => adminOrderCardHtml(order, true)).join('')}</div></section>`);
  }
  if (otherOrders.length) {
    sections.push(`<section class="admin-order-section"><div class="admin-order-section-head"><div><strong>${ui.orderFilter === 'active' ? 'Pågående bestillinger' : 'Bestillinger'}</strong></div><span>${otherOrders.length}</span></div><div class="admin-order-grid">${otherOrders.map((order) => adminOrderCardHtml(order, false)).join('')}</div></section>`);
  }
  el.orderList.innerHTML = sections.join('') || '<div class="empty-card"><strong>Ingen bestillinger</strong><p>Nye bestillinger fra kundesiden vises her automatisk.</p></div>';
  if (openOrderId && !el.modalOrder.hidden) renderOrderDetail(openOrderId);
}

el.orderFilterBtns'''
pat = re.compile(r"function renderOrders\(\) \{.*?\n\}\n\nel\.orderFilterBtns", re.S)
t, n = pat.subn(render_block, t, count=1)
if n != 1:
    raise SystemExit('admin renderOrders replacement failed')

click_block = '''el.orderList.addEventListener('click', async (event) => {
  const statusBtn = event.target.closest('[data-set-list-status]');
  if (statusBtn) {
    const ok = await updateOrderStatus(statusBtn.dataset.orderId, statusBtn.dataset.setListStatus);
    renderOrders();
    renderStats();
    toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');
    return;
  }
  const estimateBtn = event.target.closest('[data-save-estimate]');
  if (estimateBtn) {
    const orderId = estimateBtn.dataset.saveEstimate;
    const card = estimateBtn.closest('[data-order]');
    const input = card?.querySelector('[data-estimate-input]');
    const minutes = Math.max(0, Math.min(180, Math.round(Number(input?.value) || 0)));
    if (!minutes) {
      toast('Skriv antall minutter først.');
      if (input) input.focus();
      return;
    }
    const ok = await updateOrderEstimate(orderId, minutes);
    renderOrders();
    toast(ok ? `Ca. ${minutes} min er sendt til kunden.` : 'Kunne ikke sende tiden.');
    return;
  }
  const detail = event.target.closest('[data-order-detail]');
  if (!detail) return;
  openOrderId = detail.dataset.orderDetail;
  renderOrderDetail(openOrderId);
  openModal(el.modalOrder);
});

el.orderList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !event.target.matches('[data-estimate-input]')) return;
  event.preventDefault();
  event.target.closest('[data-order]')?.querySelector('[data-save-estimate]')?.click();
});

function renderOrderDetail'''
pat = re.compile(r"el\.orderList\.addEventListener\('click', \(event\) => \{.*?\n\}\);\n\nfunction renderOrderDetail", re.S)
t, n = pat.subn(click_block, t, count=1)
if n != 1:
    raise SystemExit('admin order click replacement failed')

t = t.replace(
    "      <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>\n      <div><span>Status</span>",
    "      <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>\n      <div><span>Forventet tid</span><strong>${Number(order.estimatedMinutes) > 0 ? `Ca. ${Number(order.estimatedMinutes)} min` : '—'}</strong></div>\n      <div><span>Status</span>",
    1,
)
t = t.replace('${ORDER_STATUSES.map(', '${ADMIN_ORDER_STATUSES.map(')
p.write_text(t, encoding='utf-8')

# customer.js: keep ready for 5 min (or X), multiple live orders in horizontal carousel, show manual ETA.
p = Path('demo/js/customer.js')
t = p.read_text(encoding='utf-8')
pat = re.compile(r"function activeCustomerOrders\(\) \{.*?\n\}\n\nfunction activeOrderCardHtml", re.S)
replacement = '''function activeCustomerOrders() {
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
}

function activeOrderCardHtml'''
t, n = pat.subn(replacement, t, count=1)
if n != 1:
    raise SystemExit('customer active orders replacement failed')

pat = re.compile(r"function activeOrderCardHtml\(order, extraCount = 0\) \{.*?\n\}\n\nlet activeOrderStream", re.S)
replacement = '''function activeOrderCardHtml(order) {
  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === order.status);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const readyNow = order.status === 'klar';
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const progress = CUSTOMER_STATUS_FLOW.map((step, stepIndex) => {
    const complete = stepIndex < index;
    const current = stepIndex === index;
    return `<div class="order-progress-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}"><span class="order-progress-dot">${complete ? '✓' : ''}</span><small>${escapeHtml(step.short)}</small></div>`;
  }).join('');
  return `<section class="active-order-card${readyNow ? ' is-ready' : ''}" data-active-order-card="${escapeHtml(order.id)}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div><span class="active-order-kicker">Aktiv bestilling</span><strong class="active-order-live-status">${escapeHtml(readyNow ? 'Klar for henting' : orderStatusLabel(order.status))}</strong></div>
      <div class="active-order-head-actions"><span class="active-order-number">#${escapeHtml(shortId)}</span>${readyNow ? `<button class="active-order-dismiss" data-ready-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk klar-meldingen">×</button>` : ''}</div>
    </div>
    <div class="order-progress" aria-label="Bestillingsstatus">${progress}</div>
    ${estimated && !readyNow ? `<div class="active-order-estimate"><span>⏱</span><strong>Ca. ${estimated} min</strong><small>oppgitt av restauranten</small></div>` : ''}
    ${readyNow ? `<div class="active-order-ready-callout"><span class="ready-check">✓</span><div><strong>Maten din er klar</strong><small>Kom og hent bestillingen nå.</small></div></div>` : ''}
    <div class="active-order-meta"><span>Henting <b>${escapeHtml(order.pickup || '—')}</b></span><span><b>${formatPrice(order.total)}</b></span></div>
    <button class="active-order-open" data-active-orders="${escapeHtml(order.id)}" type="button">Se bestillingen</button>
  </section>`;
}

let activeOrderStream'''
t, n = pat.subn(replacement, t, count=1)
if n != 1:
    raise SystemExit('customer active order card replacement failed')

pat = re.compile(r"let activeOrderStream = null;.*?function notifyReadyOrders", re.S)
replacement = '''const activeOrderStreams = new Map();
const activeOrderFetchBusy = new Set();
let activeOrderFallbackTimer = null;
const readyDismissTimers = new Map();

function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const normalized = { ...remote, id: remote.id || orderId };
  const orders = Array.isArray(store.orders) ? [...store.orders] : [];
  const index = orders.findIndex((entry) => entry?.id === orderId);
  if (index >= 0) {
    const previous = orders[index] || {};
    orders[index] = { ...previous, ...normalized, lines: normalized.lines?.length ? normalized.lines : (previous.lines || []) };
  } else {
    orders.unshift(normalized);
  }
  store.orders = orders;
}

async function fetchActiveOrderNow(orderId) {
  if (!orderId || activeOrderFetchBusy.has(orderId)) return;
  activeOrderFetchBusy.add(orderId);
  try {
    const response = await fetch(`${DB_URL}/orders/${encodeURIComponent(orderId)}.json?ts=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote) return;
    upsertLiveOrder(orderId, remote);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
  } catch (_) {
  } finally {
    activeOrderFetchBusy.delete(orderId);
  }
}

function syncActiveOrderWatchers(orderIds) {
  const wanted = new Set(orderIds.filter(Boolean).slice(0, 8));
  for (const [orderId, source] of activeOrderStreams.entries()) {
    if (wanted.has(orderId)) continue;
    try { source.close(); } catch (_) {}
    activeOrderStreams.delete(orderId);
  }
  for (const orderId of wanted) {
    if (activeOrderStreams.has(orderId)) continue;
    fetchActiveOrderNow(orderId);
    if ('EventSource' in window) {
      try {
        const source = new EventSource(`${DB_URL}/orders/${encodeURIComponent(orderId)}.json`);
        const refresh = () => fetchActiveOrderNow(orderId);
        source.addEventListener('put', refresh);
        source.addEventListener('patch', refresh);
        source.onerror = () => {};
        activeOrderStreams.set(orderId, source);
      } catch (_) {}
    }
  }
  if (activeOrderFallbackTimer) clearInterval(activeOrderFallbackTimer);
  activeOrderFallbackTimer = wanted.size ? window.setInterval(() => {
    if (!document.hidden) for (const orderId of wanted) fetchActiveOrderNow(orderId);
  }, 5000) : null;
}

function scheduleReadyDismiss(order) {
  if (!order || order.status !== 'klar' || readySeenIds().has(order.id) || readyDismissTimers.has(order.id)) return;
  const readyAt = Number(order.statusUpdatedAt) || Date.now();
  const remaining = Math.max(0, 5 * 60 * 1000 - (Date.now() - readyAt));
  if (!remaining) {
    markReadySeen(order.id);
    return;
  }
  const timer = window.setTimeout(() => {
    readyDismissTimers.delete(order.id);
    markReadySeen(order.id);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
  }, remaining);
  readyDismissTimers.set(order.id, timer);
}

function notifyReadyOrders'''
t, n = pat.subn(replacement, t, count=1)
if n != 1:
    raise SystemExit('customer watcher replacement failed')

pat = re.compile(r"function renderActiveOrders\(\) \{.*?\n\}\n\nfunction openActiveOrderInProfile", re.S)
replacement = '''function renderActiveOrders() {
  const orders = activeCustomerOrders();
  const cards = orders.map((order) => activeOrderCardHtml(order)).join('');
  const html = orders.length ? `<div class="active-orders-carousel">${orders.length > 1 ? `<div class="active-orders-carousel-head"><strong>${orders.length} aktive bestillinger</strong><div><button data-order-carousel="prev" type="button" aria-label="Forrige bestilling">‹</button><button data-order-carousel="next" type="button" aria-label="Neste bestilling">›</button></div></div>` : ''}<div class="active-orders-track" data-active-orders-track>${cards}</div></div>` : '';
  for (const target of [el.activeOrderMenu, el.activeOrderProfile]) {
    if (!target) continue;
    target.hidden = !orders.length;
    target.innerHTML = html;
  }
  syncActiveOrderWatchers(orders.map((order) => order.id));
  notifyReadyOrders(orders);
  orders.filter((order) => order.status === 'klar').forEach(scheduleReadyDismiss);
}

function openActiveOrderInProfile'''
t, n = pat.subn(replacement, t, count=1)
if n != 1:
    raise SystemExit('customer carousel replacement failed')

needle = "  const activeOrdersBtn = event.target.closest('[data-active-orders]');\n"
if needle not in t:
    raise SystemExit('customer active order click hook missing')
inject = '''  const readyDismiss = event.target.closest('[data-ready-dismiss]');
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
  const carouselBtn = event.target.closest('[data-order-carousel]');
  if (carouselBtn) {
    const track = carouselBtn.closest('.active-orders-carousel')?.querySelector('[data-active-orders-track]');
    if (track) {
      const direction = carouselBtn.dataset.orderCarousel === 'prev' ? -1 : 1;
      track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.88, 260), behavior: 'smooth' });
    }
    return;
  }
  const activeOrdersBtn = event.target.closest('[data-active-orders]');
'''
t = t.replace(needle, inject, 1)
p.write_text(t, encoding='utf-8')

# Styles: admin ticket cards inspired by the reference, and customer live-order carousel/pulse.
p = Path('demo/css/admin.css')
t = p.read_text(encoding='utf-8')
if '/* Order intake cards 2026-09-15 */' not in t:
    t += '''

/* Order intake cards 2026-09-15 */
.admin-order-section{margin:0 0 18px}.admin-order-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:0 2px}.admin-order-section-head>div{display:flex;align-items:center;gap:8px}.admin-order-section-head strong{font-size:15px;font-weight:800}.admin-order-section-head>span{min-width:26px;height:26px;padding:0 8px;display:grid;place-items:center;border-radius:999px;background:var(--surface-3);color:var(--ink-2);font-size:12px;font-weight:800}.is-new-section .admin-order-section-head strong{color:#b94f07}.is-new-section .admin-order-section-head>span{background:#fff0e6;color:#c4560c}.admin-order-live-dot{width:9px;height:9px;border-radius:50%;background:#f26b0a;box-shadow:0 0 0 0 rgba(242,107,10,.35);animation:adminOrderPulse 1.4s ease-out infinite}@keyframes adminOrderPulse{0%{box-shadow:0 0 0 0 rgba(242,107,10,.34)}70%{box-shadow:0 0 0 7px rgba(242,107,10,0)}100%{box-shadow:0 0 0 0 rgba(242,107,10,0)}}.admin-order-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.admin-order-card{position:relative;overflow:hidden;padding:0!important;border:1px solid #e4e7eb!important;border-radius:16px!important;background:#fff!important;box-shadow:0 6px 22px rgba(22,28,36,.06)!important}.admin-order-card.is-new-order{border-color:#f6c79f!important;box-shadow:0 8px 24px rgba(217,102,20,.10)!important}.admin-order-card.is-new-order:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:#ef6b0b}.admin-order-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:14px 15px 10px}.admin-order-head>div>span{display:block;margin-top:3px;color:var(--ink-3);font-size:11.5px}.admin-order-number-row{display:flex;align-items:center;gap:7px}.admin-order-number-row strong{font-size:17px;letter-spacing:.02em}.new-order-badge{display:inline-flex!important;align-items:center;min-height:20px;margin:0!important;padding:0 7px;border-radius:999px;background:#fff0e6;color:#c45509!important;font-size:10px!important;font-weight:850;letter-spacing:.05em}.admin-order-customer{display:grid;gap:2px;padding:0 15px 10px}.admin-order-customer strong{font-size:14.5px}.admin-order-customer span{color:var(--ink-2);font-size:12.5px}.admin-order-pickup{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 15px 10px;padding:9px 11px;border-radius:10px;background:#f7f8f9}.admin-order-pickup span{color:var(--ink-3);font-size:11.5px;font-weight:650}.admin-order-pickup strong{font-size:13px}.admin-order-lines{display:grid;gap:0;margin:0 15px;border-top:1px solid var(--line)}.admin-order-line{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:start;padding:9px 0;border-bottom:1px solid var(--line)}.admin-order-qty{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:#fff1e8;color:#c65b0d;font-size:11px;font-weight:800}.admin-order-line>div{min-width:0;display:grid;gap:2px}.admin-order-line>div strong{font-size:12.8px;line-height:1.3}.admin-order-line small{display:block;color:var(--ink-3);font-size:11px;line-height:1.35;overflow-wrap:anywhere}.admin-order-comment{color:#8a5a37!important;font-style:italic}.admin-order-line>b{font-size:12.5px;white-space:nowrap}.admin-order-total{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px}.admin-order-total span{color:var(--ink-2);font-size:12px}.admin-order-total strong{font-size:16px}.admin-order-estimate{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 15px 12px;padding:10px 11px;border:1px solid #dfe8e2;border-radius:11px;background:#f7fbf8}.admin-order-estimate-copy{min-width:0;display:grid;gap:2px}.admin-order-estimate-copy strong{font-size:12.5px}.admin-order-estimate-copy span{color:var(--ink-3);font-size:10.8px}.admin-order-estimate-control{display:flex;align-items:center;gap:6px;flex:none}.admin-order-estimate-control .input{width:62px;height:32px;text-align:center}.admin-order-estimate-control>span{color:var(--ink-3);font-size:11px}.admin-order-status-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.admin-status-btn{min-height:38px;padding:6px 5px;border:0;border-right:1px solid var(--line);background:#fff;color:var(--ink-2);font-size:11.5px;font-weight:700}.admin-status-btn:last-child{border-right:0}.admin-status-btn:hover{background:#f7f8f9}.admin-status-btn.is-active{background:#f0670a;color:#fff}.admin-order-detail-btn{width:100%;min-height:38px;border:0;background:#fff;color:#b6530e;font-size:12px;font-weight:750}.admin-order-detail-btn:hover{background:#fff8f3}@media(max-width:700px){.admin-order-grid{grid-template-columns:1fr}.admin-order-estimate{align-items:flex-start;flex-direction:column}.admin-order-estimate-control{width:100%}.admin-order-estimate-control .input{flex:1;width:auto}.admin-order-estimate-control .btn{flex:none}.admin-status-btn{font-size:10.5px}}
'''
p.write_text(t, encoding='utf-8')

p = Path('demo/css/customer.css')
t = p.read_text(encoding='utf-8')
if '/* Multi live order carousel 2026-09-15 */' not in t:
    t += '''

/* Multi live order carousel 2026-09-15 */
.active-orders-carousel{width:100%;min-width:0}.active-orders-carousel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;padding:0 2px}.active-orders-carousel-head strong{color:var(--ink);font-size:12px;font-weight:800}.active-orders-carousel-head>div{display:flex;gap:6px}.active-orders-carousel-head button{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font-size:20px;line-height:1;box-shadow:0 2px 7px rgba(25,31,38,.06)}.active-orders-track{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-inline:contain;padding:1px 1px 4px}.active-orders-track::-webkit-scrollbar{display:none}.active-orders-track .active-order-card{flex:0 0 min(420px,calc(100vw - 34px));scroll-snap-align:start;min-width:0}.active-order-head-actions{display:flex;align-items:center;gap:8px}.active-order-dismiss{width:28px;height:28px;display:grid;place-items:center;border:1px solid #b9ddc4;border-radius:50%;background:#fff;color:#3b8054;font-size:18px;line-height:1}.active-order-estimate{display:flex;align-items:center;gap:7px;margin:10px 0 2px;padding:9px 10px;border:1px solid #dbe8de;border-radius:10px;background:#f4faf6}.active-order-estimate>span{font-size:14px}.active-order-estimate strong{color:#22633a;font-size:13px}.active-order-estimate small{margin-left:auto;color:#6f7f74;font-size:10.5px}.order-progress-step.is-current .order-progress-dot{background:#28a65a!important;border-color:#28a65a!important;box-shadow:0 0 0 0 rgba(40,166,90,.38);animation:customerStatusPulse 1.35s ease-out infinite}.order-progress-step.is-current small{color:#258448!important;font-weight:800}.active-order-live-status{animation:customerLiveText 1.55s ease-in-out infinite}@keyframes customerStatusPulse{0%{box-shadow:0 0 0 0 rgba(40,166,90,.4);transform:scale(1)}55%{box-shadow:0 0 0 8px rgba(40,166,90,0);transform:scale(1.08)}100%{box-shadow:0 0 0 0 rgba(40,166,90,0);transform:scale(1)}}@keyframes customerLiveText{0%,100%{opacity:1}50%{opacity:.58}}.active-order-card.is-ready .active-order-live-status{animation:none}@media(min-width:900px){.active-orders-track .active-order-card{flex-basis:calc(50% - 5px)}}@media(max-width:520px){.active-orders-track .active-order-card{flex-basis:calc(100vw - 44px)}.active-order-estimate{flex-wrap:wrap}.active-order-estimate small{width:100%;margin-left:21px}}
'''
p.write_text(t, encoding='utf-8')

# Cache-bust both customer/admin styles and service-worker cache.
p = Path('demo/index.html')
t = p.read_text(encoding='utf-8')
t = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', '/demo/css/customer.css?v=20260915-liveorder2', t)
p.write_text(t, encoding='utf-8')

p = Path('demo/admin.html')
t = p.read_text(encoding='utf-8')
t = re.sub(r'/demo/css/admin\.css\?v=[^"\']+', '/demo/css/admin.css?v=20260915-orders2', t)
p.write_text(t, encoding='utf-8')

p = Path('demo/service-worker.js')
t = p.read_text(encoding='utf-8')
t = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v41';", t)
p.write_text(t, encoding='utf-8')
