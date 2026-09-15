from pathlib import Path
import re

# ---------------- admin.html ----------------
p = Path('demo/admin.html')
text = p.read_text(encoding='utf-8')
start = text.index('            <section class="page" id="pageOrders" hidden>')
end = text.index('            <section class="page" id="pageSettings" hidden>', start)
orders_html = '''            <section class="page orders-page" id="pageOrders" hidden>
                <header class="orders-topbar">
                    <div class="orders-title-block">
                        <h1>Bestillinger</h1>
                        <p id="ordersSummary">—</p>
                    </div>
                    <div class="orders-top-actions">
                        <span class="orders-live-label"><i></i> Live</span>
                        <button class="btn btn-outline btn-sm" id="btnRefreshOrders" type="button">Oppdater</button>
                    </div>
                </header>
                <div id="orderStatRow" hidden></div>
                <div class="orders-app">
                    <aside class="orders-inbox" aria-label="Bestillingsliste">
                        <nav class="orders-tabs" aria-label="Filtrer bestillinger">
                            <button class="orders-tab is-active" data-order-filter="all" type="button">Alle</button>
                            <button class="orders-tab" data-order-filter="active" type="button">Pågår</button>
                            <button class="orders-tab" data-order-filter="klar" type="button">Klar</button>
                        </nav>
                        <div id="orderList" class="orders-list"></div>
                    </aside>
                    <section class="order-detail-pane" id="orderDetailPane" aria-label="Bestillingsdetaljer">
                        <div class="order-detail-empty" id="orderDetailEmpty">
                            <div class="order-detail-empty-icon">↗</div>
                            <strong>Velg en bestilling</strong>
                            <p>Trykk på en bestilling til venstre for å se varer og håndtere den.</p>
                        </div>
                        <div class="order-detail-live" id="orderDetailLive" hidden></div>
                    </section>
                </div>
            </section>

'''
text = text[:start] + orders_html + text[end:]

accept_modal = '''
    <div class="modal modal-order-action modal-accept-order" id="modalAcceptOrder" role="dialog" aria-modal="true" aria-label="Godta bestilling" hidden>
        <header class="modal-head order-action-head">
            <button class="order-action-back" data-close-modal type="button" aria-label="Tilbake">←</button>
            <h2 id="acceptOrderTitle">Godta bestilling</h2>
        </header>
        <div class="modal-body order-action-body">
            <span class="order-action-eyebrow">FORVENTET TID</span>
            <p class="order-action-lead">Velg hvor mange minutter kunden skal se.</p>
            <div class="accept-quick-times" id="acceptQuickTimes">
                <button type="button" data-accept-minutes="10">10 min</button>
                <button type="button" data-accept-minutes="15" class="is-active">15 min</button>
                <button type="button" data-accept-minutes="20">20 min</button>
                <button type="button" data-accept-minutes="30">30 min</button>
            </div>
            <label class="accept-manual-time">
                <span>Manuelt</span>
                <span class="accept-manual-control"><input id="acceptMinutes" type="number" min="1" max="180" step="1" value="15" inputmode="numeric"><b>min</b></span>
            </label>
        </div>
        <footer class="modal-foot order-action-foot">
            <button class="order-accept-confirm" id="btnAcceptConfirm" type="button">Godta bestilling</button>
        </footer>
    </div>

    <div class="modal modal-order-action modal-reject-order" id="modalRejectOrder" role="dialog" aria-modal="true" aria-label="Avvis bestilling" hidden>
        <header class="modal-head order-action-head">
            <button class="order-action-back" data-close-modal type="button" aria-label="Tilbake">←</button>
            <h2 id="rejectOrderTitle">Avvis bestilling</h2>
        </header>
        <div class="modal-body order-action-body">
            <div class="reject-call-card">
                <p>Vi anbefaler å ringe kunden først hvis problemet kan løses raskt.</p>
                <a id="rejectCallBtn" href="#">Ring kunden</a>
            </div>
            <span class="order-action-eyebrow">VELG ÅRSAK</span>
            <div class="reject-reasons" id="rejectReasons">
                <label><input type="radio" name="rejectReason" value="Ingen spesifikk grunn" checked><span>Ingen spesifikk grunn</span></label>
                <label><input type="radio" name="rejectReason" value="Vi har det travelt"><span>Vi har det travelt</span></label>
                <label><input type="radio" name="rejectReason" value="Utsolgt"><span>Utsolgt</span></label>
                <label><input type="radio" name="rejectReason" value="Kan ikke levere"><span>Kan ikke levere</span></label>
                <label><input type="radio" name="rejectReason" value="Egendefinert melding"><span>Egendefinert melding</span></label>
            </div>
            <textarea id="rejectMessage" class="reject-message" rows="3" placeholder="Valgfri melding / intern kommentar"></textarea>
        </div>
        <footer class="modal-foot order-action-foot">
            <button class="order-reject-confirm" id="btnRejectConfirm" type="button">Avvis bestilling</button>
        </footer>
    </div>
'''
modal_marker = '    <div class="modal modal-confirm" id="modalConfirm"'
if 'id="modalAcceptOrder"' not in text:
    text = text.replace(modal_marker, accept_modal + '\n' + modal_marker)
text = re.sub(r'/demo/css/admin\.css\?v=[^"\']+', '/demo/css/admin.css?v=20260915-orderspro1', text)
text = re.sub(r'/demo/js/admin\.js\?v=[^"\']+', '/demo/js/admin.js?v=20260915-orderspro1', text)
p.write_text(text, encoding='utf-8')

# ---------------- data.js ----------------
p = Path('demo/js/data.js')
text = p.read_text(encoding='utf-8')
if 'export async function rejectOrder' not in text:
    marker = '/** Alle ordre, nyeste først. */'
    insert = r'''
/** Avviser en ordre og lagrer årsaken. */
export async function rejectOrder(orderId, reason = '', message = '') {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    rejectionReason: order.rejectionReason,
    rejectionMessage: order.rejectionMessage,
  };
  order.status = 'avvist';
  order.statusUpdatedAt = Date.now();
  order.rejectionReason = String(reason || 'Ingen spesifikk grunn');
  order.rejectionMessage = String(message || '').trim();
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        status: order.status,
        statusUpdatedAt: order.statusUpdatedAt,
        rejectionReason: order.rejectionReason,
        rejectionMessage: order.rejectionMessage,
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
    text = text.replace(marker, insert + marker)
p.write_text(text, encoding='utf-8')

# ---------------- admin.js ----------------
p = Path('demo/js/admin.js')
text = p.read_text(encoding='utf-8')
if '  rejectOrder,\n' not in text:
    text = text.replace('  updateOrderEstimate,\n', '  updateOrderEstimate,\n  rejectOrder,\n')
text = text.replace("  orderFilter: 'active',", "  orderFilter: 'all',")
if "  orderDetailPane: $('orderDetailPane')," not in text:
    text = text.replace(
        "  btnRefreshOrders: $('btnRefreshOrders'),\n",
        "  btnRefreshOrders: $('btnRefreshOrders'),\n  orderDetailPane: $('orderDetailPane'),\n  orderDetailEmpty: $('orderDetailEmpty'),\n  orderDetailLive: $('orderDetailLive'),\n"
    )
if "  modalAcceptOrder: $('modalAcceptOrder')," not in text:
    text = text.replace(
        "  orderBody: $('orderBody'),\n",
        "  orderBody: $('orderBody'),\n  modalAcceptOrder: $('modalAcceptOrder'),\n  acceptOrderTitle: $('acceptOrderTitle'),\n  acceptQuickTimes: $('acceptQuickTimes'),\n  acceptMinutes: $('acceptMinutes'),\n  btnAcceptConfirm: $('btnAcceptConfirm'),\n  modalRejectOrder: $('modalRejectOrder'),\n  rejectOrderTitle: $('rejectOrderTitle'),\n  rejectCallBtn: $('rejectCallBtn'),\n  rejectReasons: $('rejectReasons'),\n  rejectMessage: $('rejectMessage'),\n  btnRejectConfirm: $('btnRejectConfirm'),\n"
    )
if 'let selectedOrderId = null;' not in text:
    text = text.replace('let openOrderId = null;\n', "let openOrderId = null;\nlet selectedOrderId = null;\nlet actionOrderId = null;\n")

start = text.index('/* ------------------------------------------------------------------ *\n * Bestillinger\n * ------------------------------------------------------------------ */')
end = text.index('/* ------------------------------------------------------------------ *\n * Restaurantinnstillinger\n * ------------------------------------------------------------------ */', start)
orders_js = r'''/* ------------------------------------------------------------------ *
 * Bestillinger
 * ------------------------------------------------------------------ */

const ADMIN_ORDER_STATUSES = ORDER_STATUSES.filter((status) =>
  ['bekreftet', 'tilberedning', 'klar'].includes(status.id)
);

function filteredOrders() {
  const orders = getOrders();
  if (ui.orderFilter === 'all') return orders;
  if (ui.orderFilter === 'active') {
    return orders.filter((order) => ['mottatt', 'bekreftet', 'tilberedning'].includes(order.status));
  }
  if (ui.orderFilter === 'klar') return orders.filter((order) => order.status === 'klar');
  return orders;
}

function compactOrderTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function orderElapsed(order) {
  const seconds = Math.max(0, Math.floor((Date.now() - (Number(order.createdAt) || Date.now())) / 1000));
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
  const hours = Math.floor(seconds / 3600);
  return `${hours}t ${Math.floor((seconds % 3600) / 60)}m`;
}

function orderCountdown(order) {
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const seconds = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function orderListStatus(order) {
  if (order.status === 'mottatt') return 'Venter på svar';
  if (order.status === 'bekreftet') return 'Godtatt';
  if (order.status === 'tilberedning') return 'Tilberedes';
  if (order.status === 'klar') return 'Klar for henting';
  if (order.status === 'avvist') return 'Avvist';
  if (order.status === 'fullfort') return 'Ferdig';
  return orderStatusLabel(order.status);
}

function orderListRowHtml(order, isNew = false) {
  const selected = order.id === selectedOrderId;
  const countdown = orderCountdown(order);
  const timer = order.status === 'mottatt' ? orderElapsed(order) : (countdown || formatPrice(order.total));
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
      <span class="orders-list-side">
        <strong class="orders-live-time" data-order-clock="${escapeHtml(order.id)}">${escapeHtml(timer)}</strong>
        <small>${escapeHtml(compactOrderTime(order.createdAt))}</small>
      </span>
    </button>`;
}

function renderOrderTabs(allOrders) {
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
}

function renderOrderList() {
  const orders = filteredOrders();
  const newOrders = orders.filter((order) => order.status === 'mottatt');
  const otherOrders = orders.filter((order) => order.status !== 'mottatt');
  const sections = [];
  if (newOrders.length) {
    sections.push(`
      <section class="orders-list-section is-new-section">
        <div class="orders-list-section-title"><span><i></i>Nye bestillinger</span><b>${newOrders.length}</b></div>
        ${newOrders.map((order) => orderListRowHtml(order, true)).join('')}
      </section>`);
  }
  if (otherOrders.length) {
    sections.push(`
      <section class="orders-list-section">
        <div class="orders-list-section-title"><span>${ui.orderFilter === 'all' ? 'Andre' : 'Bestillinger'}</span><b>${otherOrders.length}</b></div>
        ${otherOrders.map((order) => orderListRowHtml(order, false)).join('')}
      </section>`);
  }
  el.orderList.innerHTML = sections.join('') || '<div class="orders-list-empty"><strong>Ingen bestillinger</strong><span>Det er ingenting i denne visningen.</span></div>';
}

function detailLineHtml(line) {
  const options = Array.isArray(line.options) ? line.options : [];
  const optionDetails = Array.isArray(line.optionDetails) ? line.optionDetails : [];
  const optionText = optionDetails.length
    ? optionDetails.map((item) => item && item.label).filter(Boolean)
    : options;
  return `
    <div class="pos-order-line">
      <span class="pos-order-qty">${Number(line.quantity) || 1}×</span>
      <div class="pos-order-line-body">
        <strong>${escapeHtml(line.name || 'Produkt')}</strong>
        ${line.size ? `<small>${escapeHtml(line.size)}</small>` : ''}
        ${optionText.length ? `<small>${optionText.map((item) => escapeHtml(item)).join(' · ')}</small>` : ''}
        ${line.comment ? `<small class="pos-order-note">${escapeHtml(line.comment)}</small>` : ''}
      </div>
      <b>${formatPrice(line.price)}</b>
    </div>`;
}

function renderOrderDetail(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) {
    selectedOrderId = null;
    el.orderDetailEmpty.hidden = false;
    el.orderDetailLive.hidden = true;
    el.orderDetailLive.innerHTML = '';
    return;
  }
  selectedOrderId = order.id;
  const shortId = String(order.id || '').slice(-8).toUpperCase();
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const isPending = order.status === 'mottatt';
  const phone = String(order.phone || '').trim();
  const tel = phone.replace(/[^+\d]/g, '');
  const pickupType = String(order.type || 'henting').toLocaleLowerCase('no').includes('lever') ? 'LEVERING' : 'HENTING';
  const payment = String(store.settings?.paymentInfo || 'Ved henting').toUpperCase();
  const actionHtml = isPending
    ? `<button class="pos-reject-btn" data-open-reject="${escapeHtml(order.id)}" type="button" aria-label="Avvis bestilling">×</button>
       <button class="pos-accept-btn" data-open-accept="${escapeHtml(order.id)}" type="button">GODTA${estimated ? ` (${estimated} MIN)` : ''}</button>`
    : order.status === 'avvist' || order.status === 'fullfort'
      ? `<div class="pos-closed-status">${escapeHtml(orderStatusLabel(order.status))}</div>`
      : `<div class="pos-progress-actions">${ADMIN_ORDER_STATUSES.map((status) => `<button class="${status.id === order.status ? 'is-active' : ''}" data-detail-status="${escapeHtml(status.id)}" type="button">${escapeHtml(status.label)}</button>`).join('')}</div>`;

  el.orderDetailEmpty.hidden = true;
  el.orderDetailLive.hidden = false;
  el.orderDetailLive.innerHTML = `
    <article class="pos-order-detail">
      <header class="pos-detail-top">
        <div class="pos-detail-total">${formatPrice(order.total)}</div>
        <div class="pos-detail-pills"><span>${escapeHtml(pickupType)}</span><span>${escapeHtml(payment)}</span></div>
      </header>
      <div class="pos-detail-scroll">
        <section class="pos-meta-block">
          <div><span>Order ID</span><strong>${escapeHtml(shortId)}</strong></div>
          <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || 'Snarest')}</strong></div>
          <div><span>Mottatt</span><strong>${escapeHtml(timeStamp(order.createdAt))}</strong></div>
          ${estimated ? `<div><span>Forventet</span><strong>Ca. ${estimated} min</strong></div>` : ''}
        </section>
        <section class="pos-customer-block">
          <div class="pos-customer-name"><strong>${escapeHtml(order.customerName || 'Ukjent kunde')}</strong><span>★ Kunde</span></div>
          ${phone ? `<a class="pos-customer-phone" href="tel:${escapeHtml(tel)}">${escapeHtml(phone)}</a>` : ''}
        </section>
        <section class="pos-items-block">
          <h3>Order items</h3>
          <div class="pos-order-lines">${(order.lines || []).map(detailLineHtml).join('')}</div>
          ${order.comment ? `<div class="pos-order-general-note">${escapeHtml(order.comment)}</div>` : ''}
        </section>
        <section class="pos-totals-block">
          <div><span>Sub-total</span><strong>${formatPrice(order.subtotal ?? order.total)}</strong></div>
          <div class="is-total"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
        </section>
        ${!isPending && !['avvist', 'fullfort'].includes(order.status) ? `
          <section class="pos-estimate-editor">
            <div><strong>Forventet tid</strong><span>Kunden ser denne tiden live.</span></div>
            <label><input data-detail-estimate type="number" min="1" max="180" step="1" value="${estimated || ''}" placeholder="15"><b>min</b></label>
            <button data-save-detail-estimate="${escapeHtml(order.id)}" type="button">Oppdater</button>
          </section>` : ''}
      </div>
      <footer class="pos-detail-actions">${actionHtml}</footer>
    </article>`;
}

function renderOrders() {
  const all = getOrders();
  renderOrderTabs(all);
  el.ordersSummary.textContent = `${all.length} bestillinger · ${all.filter((order) => order.status === 'mottatt').length} nye`;
  const visible = filteredOrders();
  if (!selectedOrderId || !visible.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = visible.find((order) => order.status === 'mottatt')?.id || visible[0]?.id || null;
  }
  renderOrderList();
  if (selectedOrderId) renderOrderDetail(selectedOrderId);
  else {
    el.orderDetailEmpty.hidden = false;
    el.orderDetailLive.hidden = true;
  }
}

el.orderFilterBtns.forEach((button) => {
  button.addEventListener('click', () => {
    ui.orderFilter = button.dataset.orderFilter;
    selectedOrderId = null;
    renderOrders();
  });
});

el.orderList.addEventListener('click', (event) => {
  const row = event.target.closest('[data-select-order]');
  if (!row) return;
  selectedOrderId = row.dataset.selectOrder;
  renderOrders();
});

function openAcceptOrder(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) return;
  actionOrderId = order.id;
  const shortId = String(order.id).slice(-6).toUpperCase();
  el.acceptOrderTitle.textContent = `Godta #${shortId}`;
  const minutes = Math.max(1, Number(order.estimatedMinutes) || 15);
  el.acceptMinutes.value = String(minutes);
  el.acceptQuickTimes.querySelectorAll('[data-accept-minutes]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.acceptMinutes) === minutes);
  });
  openModal(el.modalAcceptOrder);
}

function openRejectOrder(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) return;
  actionOrderId = order.id;
  const shortId = String(order.id).slice(-6).toUpperCase();
  el.rejectOrderTitle.textContent = `Avvis #${shortId}`;
  const phone = String(order.phone || '').trim();
  const tel = phone.replace(/[^+\d]/g, '');
  el.rejectCallBtn.textContent = phone ? `Ring ${phone}` : 'Telefon mangler';
  el.rejectCallBtn.href = phone ? `tel:${tel}` : '#';
  el.rejectCallBtn.classList.toggle('is-disabled', !phone);
  const defaultReason = el.rejectReasons.querySelector('input[value="Ingen spesifikk grunn"]');
  if (defaultReason) defaultReason.checked = true;
  el.rejectMessage.value = '';
  openModal(el.modalRejectOrder);
}

el.orderDetailLive.addEventListener('click', async (event) => {
  const accept = event.target.closest('[data-open-accept]');
  if (accept) {
    openAcceptOrder(accept.dataset.openAccept);
    return;
  }
  const reject = event.target.closest('[data-open-reject]');
  if (reject) {
    openRejectOrder(reject.dataset.openReject);
    return;
  }
  const status = event.target.closest('[data-detail-status]');
  if (status && selectedOrderId) {
    const ok = await updateOrderStatus(selectedOrderId, status.dataset.detailStatus);
    renderOrders();
    renderStats();
    toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');
    return;
  }
  const saveEstimate = event.target.closest('[data-save-detail-estimate]');
  if (saveEstimate) {
    const input = el.orderDetailLive.querySelector('[data-detail-estimate]');
    const minutes = Math.max(0, Math.min(180, Math.round(Number(input?.value) || 0)));
    if (!minutes) {
      toast('Skriv antall minutter først.');
      input?.focus();
      return;
    }
    const ok = await updateOrderEstimate(saveEstimate.dataset.saveDetailEstimate, minutes);
    renderOrders();
    toast(ok ? `Ca. ${minutes} min er sendt til kunden.` : 'Kunne ikke sende tiden.');
  }
});

el.acceptQuickTimes.addEventListener('click', (event) => {
  const button = event.target.closest('[data-accept-minutes]');
  if (!button) return;
  const minutes = Number(button.dataset.acceptMinutes) || 15;
  el.acceptMinutes.value = String(minutes);
  el.acceptQuickTimes.querySelectorAll('[data-accept-minutes]').forEach((entry) => entry.classList.toggle('is-active', entry === button));
});

el.acceptMinutes.addEventListener('input', () => {
  const minutes = Number(el.acceptMinutes.value) || 0;
  el.acceptQuickTimes.querySelectorAll('[data-accept-minutes]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.acceptMinutes) === minutes);
  });
});

el.btnAcceptConfirm.addEventListener('click', async () => {
  if (!actionOrderId) return;
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
  selectedOrderId = actionOrderId;
  closeModals();
  renderOrders();
  renderStats();
  toast(`Bestillingen er godtatt · ca. ${minutes} min.`);
});

el.btnRejectConfirm.addEventListener('click', async () => {
  if (!actionOrderId) return;
  const reason = el.rejectReasons.querySelector('input[name="rejectReason"]:checked')?.value || 'Ingen spesifikk grunn';
  const message = el.rejectMessage.value.trim();
  el.btnRejectConfirm.disabled = true;
  const ok = await rejectOrder(actionOrderId, reason, message);
  el.btnRejectConfirm.disabled = false;
  if (!ok) {
    toast('Kunne ikke avvise bestillingen.');
    return;
  }
  selectedOrderId = null;
  closeModals();
  renderOrders();
  renderStats();
  toast('Bestillingen er avvist.');
});

el.btnRefreshOrders.addEventListener('click', async () => {
  const online = await refreshFromDatabase();
  renderAll();
  toast(online ? 'Bestillingene er oppdatert.' : 'Kunne ikke nå databasen.');
});

function refreshOrderClocks() {
  if (ui.page !== 'orders') return;
  document.querySelectorAll('[data-order-clock]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderClock);
    if (!order) return;
    node.textContent = order.status === 'mottatt' ? orderElapsed(order) : (orderCountdown(order) || formatPrice(order.total));
  });
}

'''
text = text[:start] + orders_js + text[end:]
if '    el.modalAcceptOrder,\n' not in text:
    text = text.replace(
        "    el.modalOrder,\n    el.modalConfirm,",
        "    el.modalOrder,\n    el.modalAcceptOrder,\n    el.modalRejectOrder,\n    el.modalConfirm,"
    )
text = text.replace('  openOrderId = null;\n  actionOrderId = null;\n}', '  openOrderId = null;\n  actionOrderId = null;\n}')
if '  actionOrderId = null;\n}' not in text[text.index('function closeModals()'):text.index('document.addEventListener', text.index('function closeModals()'))]:
    text = text.replace('  openOrderId = null;\n}', '  openOrderId = null;\n  actionOrderId = null;\n}', 1)
# add one timer at file bottom, not inside setPage
if 'setInterval(refreshOrderClocks, 1000);' not in text:
    pos = text.rfind('\nrenderAll();')
    if pos < 0:
        raise RuntimeError('Final renderAll marker not found')
    text = text[:pos] + '\nsetInterval(refreshOrderClocks, 1000);' + text[pos:]
p.write_text(text, encoding='utf-8')

# ---------------- admin.css ----------------
p = Path('demo/css/admin.css')
css = p.read_text(encoding='utf-8')
old_marker = '/* Order intake cards 2026-09-15 */'
if old_marker in css:
    css = css.split(old_marker)[0].rstrip() + '\n'
marker = '/* Professional orders workspace 2026-09-15 */'
if marker in css:
    css = css.split(marker)[0].rstrip() + '\n'
css += r'''

/* Professional orders workspace 2026-09-15 */
.orders-page{background:#eef1f4}.orders-topbar{height:72px;display:flex;align-items:center;gap:16px;padding:0 22px;background:#fff;border-bottom:1px solid #e4e8ec;flex:none}.orders-title-block{margin-right:auto}.orders-title-block h1{margin:0;font-size:22px;font-weight:750;letter-spacing:-.02em}.orders-title-block p{margin:3px 0 0;color:#8a929d;font-size:12px}.orders-top-actions{display:flex;align-items:center;gap:10px}.orders-live-label{display:inline-flex;align-items:center;gap:7px;color:#65707d;font-size:12px;font-weight:700}.orders-live-label i{width:8px;height:8px;border-radius:50%;background:#4fbe65;box-shadow:0 0 0 5px rgba(79,190,101,.12)}.orders-app{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:0;flex:1;overflow:hidden}.orders-inbox{min-width:0;background:#fff;border-right:1px solid #e3e7eb;display:flex;flex-direction:column;overflow:hidden}.orders-tabs{height:58px;display:grid;grid-template-columns:repeat(3,1fr);padding:0 18px;border-bottom:1px solid #edf0f2;flex:none}.orders-tab{position:relative;border:0;background:transparent;color:#9299a3;font-size:13px;font-weight:650;display:flex;align-items:center;justify-content:center;gap:6px}.orders-tab b{min-width:18px;height:18px;padding:0 5px;border-radius:10px;background:#f0f2f4;color:#7f8790;font-size:10px;display:grid;place-items:center}.orders-tab.is-active{color:#e96b12}.orders-tab.is-active:after{content:'';position:absolute;left:8px;right:8px;bottom:0;height:3px;border-radius:3px 3px 0 0;background:#ef790f}.orders-tab.is-active b{background:#fff0e4;color:#d96009}.orders-list{flex:1;min-height:0;overflow:auto;background:#fff}.orders-list-section-title{height:34px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;background:#fafbfc;border-bottom:1px solid #eef0f2;color:#a0a6ad;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.orders-list-section-title span{display:flex;align-items:center;gap:7px}.orders-list-section-title i{width:8px;height:8px;border-radius:50%;background:#4fc264;box-shadow:0 0 0 0 rgba(79,194,100,.38);animation:newOrderPulse 1.4s ease-out infinite}.orders-list-section-title b{font-size:10px}@keyframes newOrderPulse{0%{box-shadow:0 0 0 0 rgba(79,194,100,.38)}70%{box-shadow:0 0 0 7px rgba(79,194,100,0)}100%{box-shadow:0 0 0 0 rgba(79,194,100,0)}}.orders-list-row{width:100%;min-height:84px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:11px;align-items:center;padding:12px 14px;border:0;border-bottom:1px solid #edf0f2;background:#fff;text-align:left;transition:background .14s ease,box-shadow .14s ease}.orders-list-row:hover{background:#fafbfd}.orders-list-row.is-new{background:#f8fbfe}.orders-list-row.is-selected{background:#f0f6fb;box-shadow:inset 3px 0 #4d94c7}.orders-list-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#f1f3f5;font-size:18px}.orders-list-main{min-width:0;display:grid;gap:4px}.orders-list-name-row{display:flex;align-items:center;gap:6px;min-width:0}.orders-list-name-row strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.orders-new-pill{flex:none;padding:2px 6px;border-radius:999px;background:#fff0e5;color:#df620b;font-size:9px;font-weight:850;letter-spacing:.05em}.orders-list-main small{display:flex;align-items:center;gap:6px;color:#969da6;font-size:11.5px}.orders-status-mark{width:9px;height:9px;border:1.5px solid #9da4ac;border-radius:50%;position:relative}.is-new .orders-status-mark{border-color:#e06b16}.is-new .orders-status-mark:after{content:'';position:absolute;inset:2px;border-radius:50%;background:#e06b16}.orders-list-side{text-align:right;display:grid;gap:4px}.orders-list-side strong{font-size:13px;color:#f05c55;font-weight:750}.orders-list-side small{font-size:10.5px;color:#a0a6ad}.orders-list-empty{padding:32px 20px;text-align:center;color:#9aa1aa}.orders-list-empty strong{display:block;color:#555e68;margin-bottom:4px}.orders-list-empty span{font-size:12px}.order-detail-pane{min-width:0;min-height:0;overflow:hidden;background:#eef1f4;display:flex;align-items:stretch;justify-content:center}.order-detail-empty{margin:auto;max-width:320px;text-align:center;color:#8c949e}.order-detail-empty-icon{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#bdc3ca;font-size:22px;box-shadow:0 4px 16px rgba(29,36,44,.06)}.order-detail-empty strong{display:block;color:#59616b;font-size:15px}.order-detail-empty p{font-size:12px;line-height:1.5}.order-detail-live{width:100%;max-width:760px;min-height:0;background:#fff;border-left:1px solid #e4e7eb;border-right:1px solid #e4e7eb;box-shadow:0 8px 30px rgba(28,35,44,.08)}.pos-order-detail{height:100%;display:flex;flex-direction:column;background:#fff}.pos-detail-top{padding:22px 30px 16px;border-bottom:1px solid #eceff2;flex:none}.pos-detail-total{font-size:26px;font-weight:750;letter-spacing:-.03em;color:#202834}.pos-detail-pills{display:flex;gap:8px;margin-top:10px}.pos-detail-pills span{min-height:24px;display:inline-flex;align-items:center;padding:0 11px;border:1px solid #3b4654;border-radius:999px;color:#3c4653;font-size:10px;font-weight:800;letter-spacing:.08em}.pos-detail-pills span:first-child{background:#3d4754;color:#fff}.pos-detail-scroll{flex:1;min-height:0;overflow:auto}.pos-meta-block{padding:18px 30px;display:grid;grid-template-columns:1fr 1fr;gap:12px 26px;border-bottom:1px solid #edf0f2}.pos-meta-block>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:center}.pos-meta-block span{color:#606975;font-size:12px}.pos-meta-block strong{font-size:12.5px;color:#45505c}.pos-customer-block{padding:18px 30px;border-bottom:1px solid #edf0f2;display:flex;align-items:center;justify-content:space-between;gap:18px}.pos-customer-name{display:flex;align-items:center;gap:10px}.pos-customer-name strong{font-size:16px}.pos-customer-name span{color:#4e8dc7;font-size:11px}.pos-customer-phone{color:#4e8dc7;font-size:12.5px;text-decoration:none;font-weight:650}.pos-items-block{padding:24px 30px 12px}.pos-items-block h3{margin:0 0 12px;font-size:16px;font-weight:700}.pos-order-lines{display:grid;gap:2px}.pos-order-line{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:start;padding:7px 0}.pos-order-qty{font-size:13px;color:#323b46}.pos-order-line-body{min-width:0}.pos-order-line-body strong{display:block;font-size:13px;font-weight:500}.pos-order-line-body small{display:block;margin-top:2px;color:#68727e;font-size:11.5px}.pos-order-line-body .pos-order-note{color:#ee524d}.pos-order-line>b{font-size:13px;font-weight:500;white-space:nowrap}.pos-order-general-note{margin-top:10px;padding:10px 12px;border-radius:8px;background:#fff4f3;color:#d64f48;font-size:12px}.pos-totals-block{margin:0 30px;padding:16px 0 20px;border-top:1px solid #edf0f2}.pos-totals-block>div{display:flex;align-items:center;justify-content:space-between;padding:4px 0;color:#616b76;font-size:13px}.pos-totals-block .is-total{margin-top:4px;color:#26303b;font-size:15px;font-weight:750}.pos-estimate-editor{margin:0 30px 24px;padding:12px 14px;border:1px solid #e2e6e9;border-radius:10px;background:#fafbfb;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}.pos-estimate-editor>div{display:grid;gap:2px}.pos-estimate-editor>div strong{font-size:12px}.pos-estimate-editor>div span{color:#8b929a;font-size:10.5px}.pos-estimate-editor label{height:34px;display:flex;align-items:center;border:1px solid #d7dce0;border-radius:18px;background:#fff;overflow:hidden}.pos-estimate-editor input{width:55px;height:100%;border:0;outline:0;text-align:right;padding:0 4px 0 9px}.pos-estimate-editor label b{padding-right:10px;color:#6f7780;font-size:10px}.pos-estimate-editor button{height:34px;padding:0 12px;border:0;border-radius:7px;background:#404a56;color:#fff;font-size:11px;font-weight:700}.pos-detail-actions{flex:none;min-height:86px;display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:14px 30px 18px;border-top:1px solid #e6e9ec;background:#fff;box-shadow:0 -8px 20px rgba(30,37,45,.035)}.pos-reject-btn{border:0;border-radius:7px;background:#f44e4b;color:#fff;font-size:34px;font-weight:200;line-height:1}.pos-accept-btn{border:0;border-radius:7px;background:#56c45f;color:#fff;font-size:15px;font-weight:750;letter-spacing:.06em}.pos-progress-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pos-progress-actions button{height:48px;border:1px solid #dfe4e7;border-radius:7px;background:#fff;color:#66717d;font-size:12px;font-weight:700}.pos-progress-actions button.is-active{background:#56c45f;border-color:#56c45f;color:#fff}.pos-closed-status{grid-column:1/-1;display:grid;place-items:center;border-radius:7px;background:#f1f3f4;color:#6f7882;font-weight:700}.modal-order-action{width:390px;max-width:calc(100vw - 28px);border-radius:14px}.order-action-head{padding:14px 16px}.order-action-back{width:32px;height:32px;border:0;background:transparent;color:#4e5965;font-size:20px}.order-action-head h2{font-size:15px}.order-action-body{padding:18px 20px}.order-action-eyebrow{display:block;margin-bottom:7px;color:#9da3aa;font-size:9.5px;font-weight:800;letter-spacing:.09em}.order-action-lead{font-size:12.5px!important;color:#606a75!important}.accept-quick-times{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:15px 0}.accept-quick-times button{height:38px;border:1px solid #d8dde1;border-radius:20px;background:#fff;color:#53606c;font-size:12px;font-weight:700}.accept-quick-times button.is-active{border-color:#ef7b12;background:#fff8f1;color:#dd680d}.accept-manual-time{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border:1px solid #e1e5e8;border-radius:9px}.accept-manual-time>span:first-child{color:#626c77;font-size:12px}.accept-manual-control{display:flex;align-items:center;gap:5px}.accept-manual-control input{width:56px;border:0;outline:0;text-align:right;font-size:16px;font-weight:700}.accept-manual-control b{font-size:11px;color:#818991}.order-action-foot{padding:12px 20px 18px;background:#fff}.order-accept-confirm,.order-reject-confirm{width:100%;height:48px;border:0;border-radius:7px;color:#fff;font-size:13px;font-weight:800;letter-spacing:.05em}.order-accept-confirm{background:#56c45f}.order-reject-confirm{background:#f04f4b}.reject-call-card{margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #eceff1}.reject-call-card p{font-size:12.5px!important;line-height:1.5!important;color:#5c6672!important}.reject-call-card a{height:44px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#f78a16;color:#fff;text-decoration:none;font-size:13px;font-weight:750}.reject-call-card a.is-disabled{pointer-events:none;opacity:.45}.reject-reasons{display:grid;gap:3px}.reject-reasons label{min-height:42px;display:flex;align-items:center;gap:10px;padding:0 4px;color:#59636e;font-size:12.5px}.reject-reasons input{width:18px;height:18px;accent-color:#55bd60}.reject-message{width:100%;margin-top:10px;padding:9px 10px;border:1px solid #dfe3e6;border-radius:8px;resize:vertical;font:inherit}.btn:disabled,.order-accept-confirm:disabled,.order-reject-confirm:disabled{opacity:.55;cursor:wait}@media(max-width:980px){.orders-app{grid-template-columns:310px minmax(0,1fr)}.pos-detail-top,.pos-meta-block,.pos-customer-block,.pos-items-block{padding-left:20px;padding-right:20px}.pos-totals-block,.pos-estimate-editor{margin-left:20px;margin-right:20px}.pos-detail-actions{padding-left:20px;padding-right:20px}}@media(max-width:760px){.orders-app{grid-template-columns:1fr}.orders-inbox{border-right:0}.order-detail-pane{display:none}.orders-topbar{padding:0 14px}.orders-title-block h1{font-size:19px}}
'''
p.write_text(css, encoding='utf-8')

# ---------------- cache bump ----------------
sw = Path('demo/service-worker.js')
sw_text = sw.read_text(encoding='utf-8')
sw_text = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v42';", sw_text)
sw.write_text(sw_text, encoding='utf-8')
