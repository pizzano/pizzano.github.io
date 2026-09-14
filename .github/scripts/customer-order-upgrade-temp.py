from pathlib import Path
import re


def sub_once(text, pattern, replacement, label, flags=0):
    rx = re.compile(pattern, flags)
    match = rx.search(text)
    if not match:
        raise SystemExit(f'Pattern not found: {label}')
    value = replacement(match) if callable(replacement) else replacement
    return text[:match.start()] + value + text[match.end():]


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Pattern not found: {label}')
    return text.replace(old, new, 1)


# ---------------- data.js ----------------
path = Path('demo/js/data.js')
data = path.read_text(encoding='utf-8')
data = sub_once(
    data,
    r"export const ORDER_STATUSES = \[.*?\n\];",
    """export const ORDER_STATUSES = [
  { id: 'mottatt', label: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet' },
  { id: 'tilberedning', label: 'Tilberedes' },
  { id: 'klar', label: 'Klar for henting' },
  { id: 'fullfort', label: 'Ferdig' },
  { id: 'avvist', label: 'Avvist' },
];""",
    'ORDER_STATUSES',
    re.S,
)
data = sub_once(
    data,
    r"export async function submitOrder\(order\) \{.*?\n\}\n\n/\*\* Oppdaterer status på en ordre \(admin\)\. \*/",
    """export async function submitOrder(order) {
  const now = Date.now();
  const record = {
    ...order,
    id: order && order.id ? String(order.id) : uid('ord'),
    createdAt: Number(order && order.createdAt) || now,
    status: 'mottatt',
    statusUpdatedAt: now,
  };

  // Vis aldri ordren som mottatt før Firebase faktisk har bekreftet den.
  // Ved retry brukes samme ordre-ID, så et nytt trykk kan ikke lage en duplikat.
  if (!remoteEnabled) throw new Error('Bestillingstjenesten er ikke tilgjengelig.');
  try {
    await restPut(`${ORDERS_PATH}/${record.id}`, record);
    remoteOnline = true;
  } catch (err) {
    remoteOnline = false;
    throw new Error('Bestillingen kunne ikke sendes. Prøv igjen.');
  }

  try {
    const existing = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    const deduped = Array.isArray(existing)
      ? existing.filter((entry) => entry && entry.id !== record.id)
      : [];
    deduped.unshift(record);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(deduped.slice(0, 30)));
  } catch (err) {
    console.warn('Kunne ikke lagre ordre lokalt:', err);
  }
  store.orders = normalizeOrders([record, ...store.orders.filter((entry) => entry.id !== record.id)]);
  emitData('local');
  return record;
}

/** Oppdaterer status på en ordre (admin). */""",
    'submitOrder',
    re.S,
)
data = sub_once(
    data,
    r"const active = \(store\.orders \|\| \[\]\)\.filter\(\s*\(order\) => order\.status === 'mottatt' \|\| order\.status === 'tilberedning'\s*\);",
    "const activeStatuses = new Set(['mottatt', 'bekreftet', 'tilberedning', 'klar']);\n  const active = (store.orders || []).filter((order) => activeStatuses.has(order.status));",
    'active stats statuses',
    re.S,
)
path.write_text(data, encoding='utf-8')


# ---------------- customer.js ----------------
path = Path('demo/js/customer.js')
js = path.read_text(encoding='utf-8')
js = replace_once(js, "const ALLERGEN_KEY = 'kol_allergens_v1';", "const ALLERGEN_KEY = 'kol_allergens_v1';\nconst READY_NOTIFIED_KEY = 'kol_ready_notified_v1';", 'ready key')
js = replace_once(
    js,
    "  allergenSearch: '',\n};",
    "  allergenSearch: '',\n  orderSubmitting: false,\n  orderSendFailed: false,\n  pendingOrderId: null,\n  pendingOrderFingerprint: '',\n};",
    'ui order state',
)
js = replace_once(
    js,
    "  orderList: $('orderList'),\n  infoName: $('infoName'),",
    "  orderList: $('orderList'),\n  activeOrderMenu: $('activeOrderMenu'),\n  activeOrderProfile: $('activeOrderProfile'),\n  infoName: $('infoName'),",
    'active order refs',
)
js = replace_once(
    js,
    "function toast(message) {\n  el.toast.textContent = message;",
    "function toast(message, tone = 'success') {\n  el.toast.textContent = message;\n  el.toast.dataset.tone = tone;",
    'toast tone',
)

nav_marker = """/* ------------------------------------------------------------------ *
 * Navigasjon mellom visninger
 * ------------------------------------------------------------------ */"""
helpers = r'''const CUSTOMER_STATUS_FLOW = [
  { id: 'mottatt', label: 'Mottatt', short: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet', short: 'Bekreftet' },
  { id: 'tilberedning', label: 'Tilberedes', short: 'Lages' },
  { id: 'klar', label: 'Klar for henting', short: 'Klar' },
  { id: 'fullfort', label: 'Ferdig', short: 'Ferdig' },
];

function mergedCustomerOrders() {
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
      lines: remote.lines?.length ? remote.lines : (previous.lines || []),
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );
}

function activeCustomerOrders() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return mergedCustomerOrders().filter((order) => {
    if (!order?.id || order.status === 'fullfort' || order.status === 'avvist') return false;
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}

function activeOrderCardHtml(order, extraCount = 0) {
  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === order.status);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const progress = CUSTOMER_STATUS_FLOW.map((step, stepIndex) => {
    const complete = stepIndex < index;
    const current = stepIndex === index;
    return `<div class="order-progress-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}">
      <span class="order-progress-dot">${complete ? '✓' : ''}</span>
      <small>${escapeHtml(step.short)}</small>
    </div>`;
  }).join('');
  return `<section class="active-order-card${order.status === 'klar' ? ' is-ready' : ''}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div>
        <span class="active-order-kicker">Aktiv bestilling${extraCount ? ` · +${extraCount}` : ''}</span>
        <strong>${escapeHtml(orderStatusLabel(order.status))}</strong>
      </div>
      <span class="active-order-number">#${escapeHtml(shortId)}</span>
    </div>
    <div class="order-progress" aria-label="Bestillingsstatus">${progress}</div>
    <div class="active-order-meta">
      <span>Henting <b>${escapeHtml(order.pickup || '—')}</b></span>
      <span><b>${formatPrice(order.total)}</b></span>
    </div>
    <button class="active-order-open" data-active-orders type="button">Se bestillingen</button>
  </section>`;
}

function notifyReadyOrders(orders) {
  const notified = new Set(loadJSON(READY_NOTIFIED_KEY, []));
  let changed = false;
  for (const order of orders) {
    if (order.status !== 'klar' || notified.has(order.id)) continue;
    notified.add(order.id);
    changed = true;
    toast('✓ Bestillingen din er klar for henting.');
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('KØL Grill & Pizza', { body: 'Bestillingen din er klar for henting.' });
      } catch (_) {}
    }
  }
  if (changed) saveJSON(READY_NOTIFIED_KEY, Array.from(notified).slice(-30));
}

function renderActiveOrders() {
  const orders = activeCustomerOrders();
  const html = orders.length ? activeOrderCardHtml(orders[0], Math.max(0, orders.length - 1)) : '';
  for (const target of [el.activeOrderMenu, el.activeOrderProfile]) {
    if (!target) continue;
    target.hidden = !orders.length;
    target.innerHTML = html;
  }
  notifyReadyOrders(orders);
}

function resetPendingOrderSubmission() {
  if (ui.orderSubmitting) return;
  ui.orderSendFailed = false;
  ui.pendingOrderId = null;
  ui.pendingOrderFingerprint = '';
}

'''
js = replace_once(js, nav_marker, helpers + nav_marker, 'customer helper insertion')

js = sub_once(
    js,
    r'''      <div class="prod-side">\s*<button class="add-btn" data-open="\$\{escapeHtml\(item\.id\)\}" type="button" \$\{\s*soldOut \? 'disabled aria-label="Utsolgt"' : 'aria-label="Åpne produkt og velg"'\s*\}>\+</button>\s*</div>''',
    '''      <div class="prod-side">
        ${soldOut
          ? '<span class="prod-soldout-badge">Utsolgt</span>'
          : `<button class="add-btn" data-open="${escapeHtml(item.id)}" type="button" aria-label="Åpne produkt og velg">+</button>`}
      </div>''',
    'soldout card control',
    re.S,
)
js = replace_once(
    js,
    "  el.btnStepNext.textContent = step === 3 ? 'Send bestilling' : 'Neste: Hentetid';",
    "  el.btnStepNext.textContent = step === 3 ? (ui.orderSubmitting ? 'Sender…' : ui.orderSendFailed ? 'Prøv igjen' : 'Send bestilling') : 'Neste: Hentetid';",
    'send button label',
)
js = replace_once(js, "  el.btnStepNext.disabled = false;\n  updateContactValidation();", "  el.btnStepNext.disabled = ui.orderSubmitting;\n  updateContactValidation();", 'checkout submit disabled')

js = sub_once(
    js,
    r"  el\.reviewCard\.innerHTML = `\s*<div><span>Navn</span>.*?<div><span>Å betale ved henting</span><strong>\$\{formatPrice\(total\)\}</strong></div>`;",
    r'''  const reviewLines = cart.map((line) => cartLineHtml(line, true)).join('');
  el.reviewCard.innerHTML = `
    <div class="checkout-review-head">
      <div><span>Kontroller bestillingen</span><strong>Din bestilling</strong></div>
      <button class="link-btn" data-review-cart type="button">Endre kurv</button>
    </div>
    <div class="checkout-review-lines">${reviewLines}</div>
    <div class="checkout-review-meta">
      <div><span>Navn</span><strong>${escapeHtml(el.custName.value || '—')}</strong></div>
      <div><span>Telefon</span><strong>${el.custPhone.value ? `+47 ${escapeHtml(el.custPhone.value)}` : '—'}</strong></div>
      <div><span>Hentetid</span><strong>${ui.pickup ? (ui.pickup === 'asap' ? 'Snarest' : escapeHtml(ui.pickup)) : 'Ikke valgt'}</strong></div>
      <div class="checkout-review-total"><span>Å betale ved henting</span><strong>${formatPrice(total)}</strong></div>
    </div>`;
  if (ui.checkoutStep === 3) {
    el.btnStepNext.disabled = ui.orderSubmitting;
    el.btnStepNext.textContent = ui.orderSubmitting ? 'Sender…' : ui.orderSendFailed ? 'Prøv igjen' : 'Send bestilling';
  }''',
    'checkout final review',
    re.S,
)

js = sub_once(
    js,
    r"async function placeOrder\(\) \{.*?\n\}\n\n/\* ------------------------------------------------------------------ \*\n \* Profil",
    r'''async function placeOrder() {
  if (ui.orderSubmitting) return;
  const state = getOpenState();
  if (!state.open) {
    toast(`Restauranten er stengt. Vi åpner ${state.opensAt}.`, 'error');
    return;
  }
  const name = el.custName.value.trim();
  const phone = el.custPhone.value.replace(/\s/g, '');
  if (!name || !validPhone(phone)) {
    setStep(2);
    el.errName.hidden = Boolean(name);
    el.errPhone.hidden = validPhone(phone);
    return;
  }
  if (!ui.pickup || (ui.pickupMode === 'scheduled' && !getPickupSlots().some((slot) => slot.value === ui.pickup))) {
    ui.pickup = null;
    renderCheckout();
    el.errTime.hidden = false;
    return;
  }
  el.errTime.hidden = true;

  const unavailable = cart.find((line) => {
    const { item } = findItem(line.itemId);
    return !item || item.hidden || item.soldOut;
  });
  if (unavailable) {
    reconcileCart();
    renderCartCount();
    renderBottomBar();
    setView('cart');
    toast('En vare er ikke lenger tilgjengelig. Handlekurven er oppdatert.', 'error');
    return;
  }

  const subtotal = cartSubtotal();
  const total = subtotal;
  const lines = cart.map((line) => {
    const { item } = findItem(line.itemId);
    const size = (item.sizes || []).find((s) => s.id === line.sizeId);
    const optionIds = Object.values(line.selections || {}).flat();
    const optionDetails = describeSelection(optionIds).map((addon) => ({
      groupTitle: addon.groupTitle || 'Tilvalg',
      label: addon.label,
      price: Number(addon.price) || 0,
    }));
    return {
      itemId: line.itemId,
      name: item ? item.name : 'Ukjent',
      sizeId: size ? size.id : line.sizeId || null,
      size: size ? size.label : '',
      quantity: line.quantity,
      selections: JSON.parse(JSON.stringify(line.selections || {})),
      optionIds: [...optionIds],
      options: optionDetails.map((addon) => addon.label),
      optionDetails,
      comment: line.comment || '',
      unitPrice: computeLinePrice(item, line.sizeId, optionIds, 1),
      price: computeLinePrice(item, line.sizeId, optionIds, line.quantity),
    };
  });

  const fingerprint = JSON.stringify({
    name,
    phone,
    pickup: ui.pickup,
    cart: cart.map((line) => [line.itemId, line.sizeId, line.quantity, line.selections, line.comment]),
  });
  if (!ui.pendingOrderId || ui.pendingOrderFingerprint !== fingerprint) {
    ui.pendingOrderId = uid('ord');
    ui.pendingOrderFingerprint = fingerprint;
  }

  ui.orderSubmitting = true;
  ui.orderSendFailed = false;
  renderCheckout();

  let order;
  try {
    order = await submitOrder({
      id: ui.pendingOrderId,
      customerName: name,
      phone: `+47${phone}`,
      pickup: ui.pickup === 'asap' ? 'Snarest' : ui.pickup,
      type: 'henting',
      lines,
      subtotal,
      total,
    });
  } catch (err) {
    ui.orderSubmitting = false;
    ui.orderSendFailed = true;
    renderCheckout();
    toast('Bestillingen ble ikke sendt. Trykk «Prøv igjen».', 'error');
    return;
  }

  ui.orderSubmitting = false;
  ui.orderSendFailed = false;
  ui.pendingOrderId = null;
  ui.pendingOrderFingerprint = '';
  cart = [];
  persistCart();
  ui.pickup = null;
  ui.pickupMode = null;

  el.confirmText.textContent = `Takk, ${name}! Bestillingen er mottatt av restauranten.`;
  el.confirmMeta.innerHTML = `
    <div><span>Ordrenummer</span><strong>${escapeHtml(order.id.slice(-6).toUpperCase())}</strong></div>
    <div><span>Status</span><strong>Mottatt</strong></div>
    <div><span>Hentetid</span><strong>${escapeHtml(order.pickup)}</strong></div>
    <div><span>Å betale ved henting</span><strong>${formatPrice(order.total)}</strong></div>`;
  el.confirmBackdrop.hidden = false;
  el.confirmModal.hidden = false;
  renderCartCount();
  renderActiveOrders();
}

/* ------------------------------------------------------------------ *
 * Profil''',
    'placeOrder',
    re.S,
)

js = replace_once(js, "function renderProfile() {\n  el.profName.value", "function renderProfile() {\n  renderActiveOrders();\n  el.profName.value", 'profile active render')
js = replace_once(js, "if (value.includes('klar') || value.includes('fullført')) return 'is-done';\n    if (value.includes('tilbered')) return 'is-active';", "if (value.includes('klar') || value.includes('ferdig') || value.includes('fullført')) return 'is-done';\n    if (value.includes('bekreftet') || value.includes('tilbered')) return 'is-active';", 'history status class')
js = replace_once(
    js,
    "  const toggleBlock = event.target.closest('[data-toggle-block]');",
    """  const activeOrdersBtn = event.target.closest('[data-active-orders]');
  if (activeOrdersBtn) {
    setView('profile');
    setProfileTab('orders');
    return;
  }
  const reviewCartBtn = event.target.closest('[data-review-cart]');
  if (reviewCartBtn) {
    setView('cart');
    return;
  }
  const toggleBlock = event.target.closest('[data-toggle-block]');""",
    'customer click handlers',
)
js = replace_once(js, "  persistCart();\n  toast(\n    draft.editingLineId", "  resetPendingOrderSubmission();\n  persistCart();\n  toast(\n    draft.editingLineId", 'reset after add')
js = replace_once(js, "  persistCart();\n  renderCart();\n  renderCartCount();", "  resetPendingOrderSubmission();\n  persistCart();\n  renderCart();\n  renderCartCount();", 'reset after cart change')
js = replace_once(js, "    persistCart();\n    renderCartCount();\n    renderBottomBar();", "    resetPendingOrderSubmission();\n    persistCart();\n    renderCartCount();\n    renderBottomBar();", 'reset after reorder')
js = replace_once(js, "  ui.pickupMode = button.dataset.pickupMode;", "  ui.orderSendFailed = false;\n  ui.pickupMode = button.dataset.pickupMode;", 'pickup retry reset')
js = replace_once(js, "  ui.pickup = btn.dataset.time;", "  ui.orderSendFailed = false;\n  ui.pickup = btn.dataset.time;", 'time retry reset')
js = sub_once(
    js,
    r"(function setView\(view\) \{.*?renderBottomBar\(\);)",
    lambda m: m.group(1) + "\n  renderActiveOrders();",
    'active render setView',
    re.S,
)
js = sub_once(
    js,
    r"(function renderAll\(\) \{.*?renderBottomBar\(\);)",
    lambda m: m.group(1) + "\n  renderActiveOrders();",
    'active render renderAll',
    re.S,
)
path.write_text(js, encoding='utf-8')


# ---------------- index.html ----------------
path = Path('demo/index.html')
html = path.read_text(encoding='utf-8')
html = replace_once(html, '<div id="menuList" class="menu-list"></div>', '<div id="activeOrderMenu" class="active-order-slot" hidden></div>\n            <div id="menuList" class="menu-list"></div>', 'menu active slot')
html = replace_once(html, '<div id="orderList" class="mini-list"></div>', '<div id="activeOrderProfile" class="active-order-slot active-order-slot-profile" hidden></div>\n        <div id="orderList" class="mini-list"></div>', 'profile active slot')
html = re.sub(r'/demo/css/customer\.css\?v=[^\"\']+', '/demo/css/customer.css?v=20260914-3', html, count=1)
html = re.sub(r'/demo/js/install\.js\?v=[^\"\']+', '/demo/js/install.js?v=20260914-1', html, count=1)
html = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', '/demo/js/customer.js?v=20260914-1', html, count=1)
path.write_text(html, encoding='utf-8')


# ---------------- customer.css ----------------
path = Path('demo/css/customer.css')
css = path.read_text(encoding='utf-8')
marker = '/* ======================== Active order + checkout confidence ======================== */'
if marker not in css:
    css += r'''

/* ======================== Active order + checkout confidence ======================== */
.active-order-slot { margin: 0 0 14px; }
.active-order-slot-profile { margin: 0 0 12px; }
.active-order-card { border: 1px solid #cfe7d7; border-radius: 14px; padding: 12px; background: #f8fcf9; box-shadow: 0 2px 8px rgba(25,31,38,.05); }
.active-order-card.is-ready { border-color: #83cf9d; background: #effaf3; }
.active-order-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.active-order-head > div { display: grid; gap: 2px; }
.active-order-kicker { color: #47805a; font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .04em; }
.active-order-head strong { color: #173f25; font-size: 15px; line-height: 1.2; }
.active-order-number { color: #65736a; font-size: 11px; font-weight: 700; }
.order-progress { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 0; margin: 12px 0 10px; }
.order-progress-step { position: relative; display: grid; justify-items: center; gap: 4px; color: #9aa39d; font-size: 10px; text-align: center; }
.order-progress-step::before { content: ''; position: absolute; top: 8px; left: -50%; width: 100%; height: 2px; background: #dfe6e1; }
.order-progress-step:first-child::before { display: none; }
.order-progress-dot { position: relative; z-index: 1; width: 18px; height: 18px; display: grid; place-items: center; border: 2px solid #d5ddd8; border-radius: 50%; background: #fff; color: #fff; font-size: 9px; font-weight: 800; }
.order-progress-step.is-complete,.order-progress-step.is-current { color: #267943; font-weight: 700; }
.order-progress-step.is-complete::before,.order-progress-step.is-current::before { background: #65b980; }
.order-progress-step.is-complete .order-progress-dot { border-color: #2f9653; background: #2f9653; }
.order-progress-step.is-current .order-progress-dot { border-color: #2f9653; box-shadow: 0 0 0 4px rgba(47,150,83,.12); }
.active-order-meta { display: flex; justify-content: space-between; gap: 8px; padding-top: 9px; border-top: 1px solid #dde9e0; color: #66736b; font-size: 11.5px; }
.active-order-meta b { color: #263d2e; }
.active-order-open { width: 100%; min-height: 34px; margin-top: 10px; border: 1px solid #b9dcc5; border-radius: 9px; background: #fff; color: #267943; font: inherit; font-size: 12px; font-weight: 750; }
.prod-soldout-badge { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 0 8px; border-radius: 9px; background: #f1f3f4; color: #747c83; font-size: 10.5px; font-weight: 750; white-space: nowrap; }
.review-card { display: block !important; padding: 0 !important; overflow: hidden; }
.checkout-review-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 12px; border-bottom: 1px solid var(--line); background: #fbfbfb; }
.checkout-review-head > div { display: grid; gap: 1px; }
.checkout-review-head span { color: var(--ink-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }
.checkout-review-head strong { font-size: 14px; }
.checkout-review-head .link-btn { font-size: 11.5px; }
.checkout-review-lines { padding: 2px 12px; }
.checkout-review-lines .cart-line { padding: 9px 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; box-shadow: none; }
.checkout-review-lines .cart-line:last-child { border-bottom: 0; }
.checkout-review-lines .line-qty { min-width: 28px; height: 28px; }
.checkout-review-lines .line-name { font-size: 12.5px; }
.checkout-review-lines .line-details,.checkout-review-lines .line-comment { font-size: 10.5px; }
.checkout-review-lines .line-price { font-size: 12px; }
.checkout-review-meta { display: grid; gap: 7px; padding: 11px 12px; border-top: 1px solid var(--line); background: #fff; }
.checkout-review-meta > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--ink-2); font-size: 11.5px; }
.checkout-review-meta strong { color: var(--ink); text-align: right; }
.checkout-review-total { margin-top: 2px; padding-top: 9px; border-top: 1px solid var(--line); }
.checkout-review-total strong { font-size: 15px; }
.toast[data-tone="error"] { border-color: #f1b8b5 !important; background: #fff2f1 !important; color: #a2322c !important; }
@media (max-width: 639px) {
  .active-order-slot { margin-bottom: 10px; }
  .active-order-card { padding: 10px; border-radius: 12px; }
  .active-order-head strong { font-size: 13.5px; }
  .active-order-kicker,.active-order-number { font-size: 10px; }
  .order-progress { margin: 10px 0 8px; }
  .order-progress-step small { font-size: 8.5px; line-height: 1.1; }
  .order-progress-dot { width: 16px; height: 16px; }
  .order-progress-step::before { top: 7px; }
  .active-order-meta { font-size: 10.5px; }
  .active-order-open { min-height: 32px; margin-top: 8px; font-size: 11px; }
  .checkout-review-lines { padding: 1px 10px; }
  .checkout-review-head,.checkout-review-meta { padding-left: 10px; padding-right: 10px; }
}
'''
path.write_text(css, encoding='utf-8')


# ---------------- install.js ----------------
path = Path('demo/js/install.js')
install = path.read_text(encoding='utf-8')
install = replace_once(install, 'const ORDER_CHECK_MS = 60 * 1000;', 'const ORDER_CHECK_MS = 30 * 1000;', 'order polling')
path.write_text(install, encoding='utf-8')


# ---------------- admin.js ----------------
path = Path('demo/js/admin.js')
admin = path.read_text(encoding='utf-8')
admin = sub_once(
    admin,
    r"return orders\.filter\(\s*\(order\) => order\.status === 'mottatt' \|\| order\.status === 'tilberedning'\s*\);",
    "return orders.filter((order) => ['mottatt', 'bekreftet', 'tilberedning', 'klar'].includes(order.status));",
    'admin active order filter',
    re.S,
)
path.write_text(admin, encoding='utf-8')


# ---------------- admin.html ----------------
path = Path('demo/admin.html')
admin_html = path.read_text(encoding='utf-8')
admin_html = sub_once(
    admin_html,
    r'''<button class="filter-btn" data-order-filter="mottatt" type="button">Ny</button>\s*<button class="filter-btn" data-order-filter="tilberedning" type="button">Under tilberedning</button>\s*<button class="filter-btn" data-order-filter="klar" type="button">Klar</button>\s*<button class="filter-btn" data-order-filter="fullfort" type="button">Fullført</button>''',
    '''<button class="filter-btn" data-order-filter="mottatt" type="button">Mottatt</button>
                            <button class="filter-btn" data-order-filter="bekreftet" type="button">Bekreftet</button>
                            <button class="filter-btn" data-order-filter="tilberedning" type="button">Tilberedes</button>
                            <button class="filter-btn" data-order-filter="klar" type="button">Klar</button>
                            <button class="filter-btn" data-order-filter="fullfort" type="button">Ferdig</button>''',
    'admin order filters',
    re.S,
)
admin_html = re.sub(r'/demo/css/admin\.css\?v=[^\"\']+', '/demo/css/admin.css?v=20260914-1', admin_html, count=1)
admin_html = re.sub(r'/demo/js/admin\.js\?v=[^\"\']+', '/demo/js/admin.js?v=20260914-1', admin_html, count=1)
path.write_text(admin_html, encoding='utf-8')


# ---------------- admin.css ----------------
path = Path('demo/css/admin.css')
admin_css = path.read_text(encoding='utf-8')
if '.status-pill[data-status="bekreftet"]' not in admin_css:
    admin_css += '\n.status-pill[data-status="bekreftet"] { background: #eef6ff; border-color: #c9ddf4; color: #2d6598; }\n'
path.write_text(admin_css, encoding='utf-8')


# ---------------- service-worker.js ----------------
path = Path('demo/service-worker.js')
sw = path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v32';", sw, count=1)
path.write_text(sw, encoding='utf-8')
