/**
 * customer.js — Kundelogikk for KØL Grill & Pizza.
 *
 * Hele menyen vises i én rullende liste. Kategoribaren scroller horisontalt og
 * følger sидen: når kunden scroller, markeres riktig kategori og baren flytter
 * seg til den. Åpningstid, hentetider og meny styres fra adminpanelet.
 */

import {
  store,
  DB_URL,
  subscribe,
  ready,
  formatPrice,
  getItemBasePrice,
  getSizePrice,
  getDefaultSize,
  getItemOptionGroups,
  computeLinePrice,
  describeSelection,
  findItem,
  submitOrder,
  getLocalOrders,
  getOrders,
  getOpenState,
  getPickupSlots,
  allergenLabels,
  orderStatusLabel,
  uid,
} from './data.js?v=20260915-scheduled-pickup1';

/* ------------------------------------------------------------------ *
 * Lokal kundetilstand
 * ------------------------------------------------------------------ */

const PROFILE_KEY = 'kol_profile_v1';
const CART_KEY = 'kol_cart_v1';
const ALLERGEN_KEY = 'kol_allergens_v1';
const READY_NOTIFIED_KEY = 'kol_ready_notified_v1';
const READY_SEEN_KEY = 'kol_ready_seen_v1';
const CUSTOMER_ORDERS_KEY = 'kol_orders_v1';
const REJECTED_SEEN_KEY = 'kol_rejected_seen_v1';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    /* ignorer */
  }
}

const profile = Object.assign(
  { name: '', phone: '', favorites: [] },
  loadJSON(PROFILE_KEY, {})
);
profile.favorites = Array.isArray(profile.favorites) ? profile.favorites : [];

let cart = Array.isArray(loadJSON(CART_KEY, [])) ? loadJSON(CART_KEY, []) : [];

const ui = {
  view: 'menu',
  activeCategory: '',
  search: '',
  searchOpen: false,
  checkoutStep: 2,
  pickup: null,
  pickupMode: null,
  editingLineId: null,
  expandedBlocks: new Set(),
  allergensOpen: false,
  selectedAllergens: loadJSON(ALLERGEN_KEY, []),
  allergenSearch: '',
  orderSubmitting: false,
  orderSendFailed: false,
  pendingOrderId: null,
  pendingOrderFingerprint: '',
  focusedOrderId: '',
};

/** Åpent produkt i sheet. */
let draft = null;
/** Hindrer at scroll-spy overstyrer mens vi scroller programmatisk. */
let spyLocked = false;
let spyLockTimer = null;

function persistProfile() {
  saveJSON(PROFILE_KEY, profile);
}

function persistCart() {
  saveJSON(CART_KEY, cart);
}

/* ------------------------------------------------------------------ *
 * DOM-referanser
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const el = {
  appHeader: $('appHeader'),
  catBar: $('catBar'),
  catScroll: $('catScroll'),
  menuSearch: null,
  menuList: $('menuList'),
  btnAllergens: $('btnAllergens'),
  allergenModal: $('allergenModal'),
  allergenPicker: $('allergenPicker'),
  allergenSearch: $('allergenSearch'),
  allergenClose: $('allergenClose'),
  allergenReset: $('allergenReset'),
  openStatus: $('openStatus'),
  openDot: $('openDot'),
  closedBanner: $('closedBanner'),
  closedTitle: $('closedTitle'),
  closedText: $('closedText'),
  btnBack: $('btnBack'),
  btnProfile: $('btnProfile'),
  btnCart: $('btnCart'),
  cartCount: $('cartCount'),
  brandHome: $('brandHome'),
  views: {
    menu: $('viewMenu'),
    cart: $('viewCart'),
    checkout: $('viewCheckout'),
    profile: $('viewProfile'),
  },
  cartLines: $('cartLines'),
  cartSummary: $('cartSummary'),
  cartTotal: $('cartTotal'),
  cartClosedHint: $('cartClosedHint'),
  cartActions: $('cartActions'),
  btnToCheckout: $('btnToCheckout'),
  btnKeepShopping: $('btnKeepShopping'),
  stepper: $('stepper'),
  step2: $('step2'),
  step3: $('step3'),
  custName: $('custName'),
  custPhone: $('custPhone'),
  errName: $('errName'),
  errPhone: $('errPhone'),
  timeGrid: $('timeGrid'),
  pickupChoices: $('pickupChoices'),
  pickupHint: $('pickupHint'),
  errTime: $('errTime'),
  reviewCard: $('reviewCard'),
  btnStepBack: $('btnStepBack'),
  btnStepNext: $('btnStepNext'),
  profName: $('profName'),
  profPhone: $('profPhone'),
  btnSaveProfile: $('btnSaveProfile'),
  profileSaved: $('profileSaved'),
  favList: $('favList'),
  orderList: $('orderList'),
  activeOrderMenu: $('activeOrderMenu'),
  activeOrderProfile: $('activeOrderProfile'),
  sheet: $('productSheet'),
  sheetBackdrop: $('sheetBackdrop'),
  sheetTitle: $('sheetTitle'),
  sheetBody: $('sheetBody'),
  sheetClose: $('sheetClose'),
  sheetFav: $('sheetFav'),
  sheetErr: $('sheetErr'),
  sheetTotal: $('sheetTotal'),
  btnAddToCart: $('btnAddToCart'),
  qtyMinus: $('qtyMinus'),
  qtyPlus: $('qtyPlus'),
  qtyValue: $('qtyValue'),
  confirmModal: $('confirmModal'),
  confirmBackdrop: $('confirmBackdrop'),
  confirmText: $('confirmText'),
  confirmMeta: $('confirmMeta'),
  btnConfirmDone: $('btnConfirmDone'),
  toast: $('toast'),
};

/* ------------------------------------------------------------------ *
 * Hjelpere
 * ------------------------------------------------------------------ */

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function toast(message, tone = 'success') {
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 2000);
}

function isFavorite(itemId) {
  return profile.favorites.includes(itemId);
}

function toggleFavorite(itemId) {
  const index = profile.favorites.indexOf(itemId);
  if (index >= 0) profile.favorites.splice(index, 1);
  else profile.favorites.push(itemId);
  persistProfile();
}

function visibleItems(section) {
  const query = ui.search.trim().toLocaleLowerCase('no');
  return (section.items || []).filter((item) => !item.hidden && (!query || `${item.name} ${item.description} ${item.ingredients}`.toLocaleLowerCase('no').includes(query)));
}

const ALLERGEN_ICONS = { 'Hvete / gluten': '🌾', Melk: '🥛', Egg: '🥚', Soya: '🌱', Selleri: '🌿', Sennep: '🟡', Sesam: '⚪', Fisk: '🐟', Skalldyr: '🦐', Peanøtter: '🥜', Nøtter: '🌰', Sulfitter: '🍷' };

function renderAllergenPicker() {
  const query = ui.allergenSearch.trim().toLocaleLowerCase('no');
  const labels = [...new Set((store.allergenCatalog || []).map((item) => item.label))]
    .filter((label) => !query || label.toLocaleLowerCase('no').includes(query));
  el.allergenModal.hidden = !ui.allergensOpen;
  el.btnAllergens.classList.toggle('is-on', ui.allergensOpen || ui.selectedAllergens.length > 0);
  el.allergenSearch.value = ui.allergenSearch;
  el.allergenPicker.innerHTML = labels.map((label) => `<button class="allergen-choice${ui.selectedAllergens.includes(label) ? ' is-on' : ''}" data-allergen="${escapeHtml(label)}" type="button" aria-pressed="${ui.selectedAllergens.includes(label)}">${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}</button>`).join('') || '<p class="hint">Ingen allergener funnet.</p>';
}

/** Alle blokker som vises i menylisten, i rekkefølge. */
function menuBlocks() {
  const blocks = [];

  const favItems = profile.favorites
    .map((id) => findItem(id))
    .filter(({ item }) => item && visibleItems({ items: [item] }).length);
  if (favItems.length) {
    blocks.push({
      key: 'favorites',
      title: 'Mine favoritter',
      note: 'Produktene du har markert',
      items: favItems,
    });
  }

  const popularItems = (store.popularItemIds || [])
    .map((id) => findItem(id))
    .filter(({ item }) => item && visibleItems({ items: [item] }).length);
  if (popularItems.length) {
    blocks.push({
      key: 'popular',
      title: 'Mest bestilt',
      note: 'Gjestenes favoritter',
      items: popularItems,
    });
  }

  for (const section of store.sections || []) {
    const items = visibleItems(section);
    if (!items.length) continue;
    blocks.push({
      key: section.id,
      title: section.title,
      note: section.note,
      items: items.map((item) => ({ item, section })),
    });
  }
  return blocks;
}

/** Høyden på den sticky headeren (header + kategoribar). */
function headerOffset() {
  return el.appHeader ? el.appHeader.getBoundingClientRect().height : 96;
}

const CUSTOMER_STATUS_FLOW = [
  { id: 'mottatt', label: 'Mottatt', short: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet', short: 'Bekreftet' },
  { id: 'klar', label: 'Klar for henting', short: 'Klar' },
];

const stableCustomerOrderSnapshots = new Map();

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

function readySeenIds() {
  return new Set(loadJSON(READY_SEEN_KEY, []));
}

function markReadySeen(orderId) {
  if (!orderId) return;
  const seen = readySeenIds();
  seen.add(orderId);
  saveJSON(READY_SEEN_KEY, Array.from(seen).slice(-30));
}

function rejectedSeenIds() {
  return new Set(loadJSON(REJECTED_SEEN_KEY, []));
}

function markRejectedSeen(orderId) {
  if (!orderId) return;
  const seen = rejectedSeenIds();
  seen.add(orderId);
  saveJSON(REJECTED_SEEN_KEY, Array.from(seen).slice(-30));
}


function activeCustomerOrders() {
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
}


function customerOrderCountdown(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return 'Klar nå';
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function activeOrderCardHtml(order) {
  const rejectedNow = order.status === 'avvist';
  const readyNow = order.status === 'klar';
  const confirmedNow = ['bekreftet', 'tilberedning'].includes(order.status);
  const progressStatus = order.status === 'tilberedning' ? 'bekreftet' : order.status;
  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === progressStatus);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const shortId = String(order.id || '').slice(-6).toUpperCase();
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const hasLiveEstimate =
    confirmedNow && estimated > 0 && Number(order.estimatedReadyAt) > 0;
  const rejectionReason = String(order.rejectionReason || '').trim();
  const rejectionMessage = String(order.rejectionMessage || '').trim();
  const rejectionTitle =
    rejectionReason && rejectionReason !== 'Egendefinert melding'
      ? rejectionReason
      : 'Bestillingen ble avvist';
  const rejectionDetail =
    rejectionMessage ||
    (rejectionReason === 'Egendefinert melding'
      ? ''
      : 'Kontakt restauranten hvis du lurer på noe.');

  const progress = CUSTOMER_STATUS_FLOW.map((step, stepIndex) => {
    const complete = stepIndex < index;
    const current = stepIndex === index;
    const checked = complete || (readyNow && current);
    return `<div class="order-progress-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}"><span class="order-progress-dot">${checked ? '✓' : ''}</span><small>${escapeHtml(step.short)}</small></div>`;
  }).join('');

  let statusPanel = '';
  if (!rejectedNow) {
    if (readyNow) {
      statusPanel = `
        <div class="active-order-status-box is-ready">
          <span class="active-order-status-check" aria-hidden="true">✓</span>
          <div>
            <strong>Klar for henting</strong>
            <small>Bestillingen din er klar.</small>
          </div>
        </div>`;
    } else if (hasLiveEstimate) {
      statusPanel = `
        <div class="active-order-status-box is-confirmed">
          <span class="active-order-status-label">Maten er klar om</span>
          <span class="active-order-status-clock" aria-hidden="true">⏱</span>
          <strong data-customer-countdown="${escapeHtml(order.id)}">${escapeHtml(customerOrderCountdown(order))}</strong>
        </div>`;
    } else if (confirmedNow) {
      statusPanel = `
        <div class="active-order-status-box is-confirmed is-text">
          <div>
            <strong>Bestillingen er bekreftet</strong>
            <small>Restauranten gjør klar bestillingen.</small>
          </div>
        </div>`;
    } else {
      statusPanel = `
        <div class="active-order-status-box is-waiting">
          <span class="active-order-status-dot" aria-hidden="true"></span>
          <div>
            <strong>Venter på bekreftelse</strong>
            <small>Restauranten har mottatt bestillingen.</small>
          </div>
        </div>`;
    }
  }

  return `<section class="active-order-card${readyNow ? ' is-ready' : ''}${rejectedNow ? ' is-rejected' : ''}" data-active-order-card="${escapeHtml(order.id)}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div><span class="active-order-kicker">${rejectedNow ? 'BESTILLING' : 'Aktiv bestilling'}</span>${rejectedNow ? '<strong class="active-order-live-status">Avvist</strong>' : ''}</div>
      <div class="active-order-head-actions"><span class="active-order-number">#${escapeHtml(shortId)}</span>${readyNow ? `<button class="active-order-dismiss" data-ready-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk klar-meldingen">×</button>` : ''}${rejectedNow ? `<button class="active-order-dismiss" data-rejected-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk avvisningsmeldingen">×</button>` : ''}</div>
    </div>
    ${!rejectedNow ? `<div class="order-progress" aria-label="Bestillingsstatus">${progress}</div>` : ''}
    ${statusPanel}
    ${rejectedNow ? `<div class="active-order-rejected-callout"><span class="rejected-mark">×</span><div><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionDetail ? `<small>${escapeHtml(rejectionDetail)}</small>` : ''}</div></div>` : ''}
    <button class="active-order-open" data-active-orders="${escapeHtml(order.id)}" type="button">Se bestillingen</button>
  </section>`;
}

const activeOrderStreams = new Map();
const activeOrderFetchBusy = new Set();
const customerAutoReadyBusy = new Set();
let activeOrderFallbackTimer = null;
const readyDismissTimers = new Map();

function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const normalized = rememberCustomerOrder({ ...remote, id: remote.id || orderId });
  persistCustomerOrderSnapshot(normalized);
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
  const visibleOrders = activeCustomerOrders();
  const byId = new Map(visibleOrders.map((order) => [order.id, order]));
  document.querySelectorAll('[data-customer-countdown]').forEach((node) => {
    const order = byId.get(node.dataset.customerCountdown);
    if (!order) return;
    const countdown = customerOrderCountdown(order);
    node.textContent = countdown || '';
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

function openActiveOrderInProfile(orderId) {
  if (!orderId) return;
  ui.focusedOrderId = orderId;
  setView('profile');
  setProfileTab('orders');
  window.requestAnimationFrame(() => {
    const selectorId = window.CSS?.escape ? CSS.escape(orderId) : orderId.replace(/"/g, '\"');
    const card = document.querySelector(`.order-history-card[data-order-card-id="${selectorId}"]`);
    if (!card) return;
    card.open = true;
    card.classList.add('is-focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.classList.remove('is-focused'), 2200);
  });
}

function resetPendingOrderSubmission() {
  if (ui.orderSubmitting) return;
  ui.orderSendFailed = false;
  ui.pendingOrderId = null;
  ui.pendingOrderFingerprint = '';
}

/* ------------------------------------------------------------------ *
 * Navigasjon mellom visninger
 * ------------------------------------------------------------------ */

function setView(view) {
  ui.view = view;
  for (const [name, node] of Object.entries(el.views)) {
    node.hidden = name !== view;
  }
  el.catBar.hidden = view !== 'menu';
  el.btnBack.hidden = view === 'menu';
  el.btnProfile.classList.toggle('is-on', view === 'profile');
  el.btnCart.classList.toggle('is-on', view === 'cart' || view === 'checkout');
  window.scrollTo({ top: 0 });
  renderActiveOrders();
  if (view === 'cart') renderCart();
  if (view === 'checkout') renderCheckout();
  if (view === 'profile') renderProfile();
}

/* ------------------------------------------------------------------ *
 * Kategoribar: horisontal scroll + scroll-spy
 * ------------------------------------------------------------------ */

function categoryIcon(block) {
  const title = String(block?.title || '').toLocaleLowerCase('no');
  if (block?.key === 'favorites') return '♥';
  if (block?.key === 'popular') return '★';
  if (title.includes('pizza')) return '🍕';
  if (title.includes('kebab')) return '🌯';
  if (title.includes('burger')) return '🍔';
  if (title.includes('drikk')) return '🥤';
  if (title.includes('barn')) return '☺';
  if (title.includes('veget')) return '🥗';
  if (title.includes('diverse') || title.includes('andre')) return '🍽';
  return '•';
}

function renderCategories() {
  const blocks = menuBlocks();
  if (!blocks.some((block) => block.key === ui.activeCategory)) {
    ui.activeCategory = blocks.length ? blocks[0].key : '';
  }
  const searchControl = ui.searchOpen
    ? `<label class="tab-search" aria-label="Søk i menyen"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg><input id="menuSearch" type="search" placeholder="Søk i menyen" value="${escapeHtml(ui.search)}"><button id="closeMenuSearch" type="button" aria-label="Lukk søk">×</button></label>`
    : `<button class="search-tab" id="openMenuSearch" type="button" aria-label="Søk i menyen"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg></button>`;
  const categoryTabs = ui.searchOpen ? '' : blocks
    .map(
      (block) =>
        `<button class="cat-tab${block.key === ui.activeCategory ? ' is-active' : ''}" role="tab" aria-selected="${
          block.key === ui.activeCategory
        }" data-cat="${escapeHtml(block.key)}" type="button"><span class="cat-icon" aria-hidden="true">${categoryIcon(block)}</span><span class="cat-label">${escapeHtml(block.title)}</span></button>`
    )
    .join('');
  el.catScroll.innerHTML = searchControl + categoryTabs;
  el.menuSearch = $('menuSearch');
  const openSearch = $('openMenuSearch');
  const closeSearch = $('closeMenuSearch');
  if (openSearch) openSearch.addEventListener('click', () => {
    ui.searchOpen = true;
    renderCategories();
    requestAnimationFrame(() => el.menuSearch && el.menuSearch.focus());
  });
  if (closeSearch) closeSearch.addEventListener('click', () => {
    ui.search = '';
    ui.searchOpen = false;
    renderCategories();
    renderMenu();
  });
  if (el.menuSearch) el.menuSearch.addEventListener('input', () => {
    ui.search = el.menuSearch.value;
    renderMenu();
  });
  centerActiveTab(false);
}

/** Sentrerer aktiv fane i baren uten å røre sidens scroll. */
function centerActiveTab(smooth = true) {
  const tab = el.catScroll.querySelector('.cat-tab.is-active');
  if (!tab) return;
  const target =
    tab.offsetLeft - (el.catScroll.clientWidth - tab.offsetWidth) / 2;
  const max = el.catScroll.scrollWidth - el.catScroll.clientWidth;
  el.catScroll.scrollTo({
    left: Math.max(0, Math.min(target, Math.max(max, 0))),
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function setActiveCategory(key, { center = true } = {}) {
  if (!key || ui.activeCategory === key) return;
  ui.activeCategory = key;
  el.catScroll.querySelectorAll('.cat-tab').forEach((tab) => {
    const on = tab.dataset.cat === key;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', String(on));
  });
  if (center) centerActiveTab(true);
}

/** Scroller siden til en kategoriblokk. */
function scrollToCategory(key) {
  const block = document.getElementById(`blk_${key}`);
  if (!block) return;
  spyLocked = true;
  if (spyLockTimer) clearTimeout(spyLockTimer);
  spyLockTimer = setTimeout(() => {
    spyLocked = false;
  }, 700);
  const top = block.getBoundingClientRect().top + window.scrollY - headerOffset() - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  setActiveCategory(key);
}

/** Finner blokken som er i toppen av synlig område. */
function spyActiveCategory() {
  if (ui.view !== 'menu' || spyLocked) return;
  const blocks = Array.from(el.menuList.querySelectorAll('[data-block]'));
  if (!blocks.length) return;
  const line = headerOffset() + 24;

  // Nederst på siden: siste kategori er aktiv.
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 24) {
    setActiveCategory(blocks[blocks.length - 1].dataset.block);
    return;
  }

  let current = blocks[0].dataset.block;
  for (const block of blocks) {
    if (block.getBoundingClientRect().top <= line) current = block.dataset.block;
  }
  setActiveCategory(current);
}

window.addEventListener('scroll', spyActiveCategory, { passive: true });
window.addEventListener('resize', () => centerActiveTab(false));

/* ------------------------------------------------------------------ *
 * Rendering: meny
 * ------------------------------------------------------------------ */

function productCardHtml(item, section) {
  const soldOut = item.soldOut;
  const price = getItemBasePrice(item);
  const multi = (item.sizes || []).length > 1;
  const desc = item.description || item.ingredients || section.note || '';
  const selectedAllergens = new Set(ui.selectedAllergens);
  const cardAllergens = allergenLabels(item)
    .filter((label) => selectedAllergens.has(label))
    .slice(0, 2);
  return `
    <div class="prod-card${soldOut ? ' is-soldout' : ''}" data-item="${escapeHtml(item.id)}">
      ${
        item.imageUrl
          ? `<img class="prod-thumb" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`
          : '<span class="prod-thumb prod-thumb-empty" aria-hidden="true"></span>'
      }
      <div class="prod-info">
        <p class="prod-name">
          ${escapeHtml(item.name)}
          ${soldOut ? '<span class="tag tag-soldout">Utsolgt</span>' : ''}
        </p>
        <p class="prod-desc">${escapeHtml(desc)}</p>
        ${cardAllergens.length ? `<div class="prod-allergens">${cardAllergens.map((label) => `<span class="allergen-mini-chip">${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}</span>`).join('')}</div>` : ''}
        <p class="prod-price">${multi ? '<small>fra </small>' : ''}${formatPrice(price)}</p>
      </div>
      <div class="prod-side">
        ${soldOut
          ? '<span class="prod-soldout-badge">Utsolgt</span>'
          : `<button class="add-btn" data-open="${escapeHtml(item.id)}" type="button" aria-label="Åpne produkt og velg">+</button>`}
      </div>
    </div>`;
}

function renderMenu() {
  const blocks = menuBlocks();
  if (!blocks.length) {
    el.menuList.innerHTML =
      '<div class="empty-note"><strong>Menyen er tom</strong>Kom tilbake litt senere.</div>';
    return;
  }
  el.menuList.innerHTML = blocks
    .map(
      (block) => {
      const collapsible = block.key === 'favorites' || block.key === 'popular';
      const visibleCount = collapsible && !ui.expandedBlocks.has(block.key) ? 4 : block.items.length;
      return `
      <section class="cat-block" id="blk_${escapeHtml(block.key)}" data-block="${escapeHtml(block.key)}">
        <header class="cat-head">
          <div class="cat-title-row">
            <h2>${escapeHtml(block.title)}</h2>
          </div>
          ${block.note ? `<p class="cat-description">${escapeHtml(block.note)}</p>` : ''}
        </header>
        <div class="prod-grid">
          ${block.items.slice(0, visibleCount).map(({ item, section }) => productCardHtml(item, section)).join('')}
        </div>
        ${collapsible && block.items.length > 4 ? `<button class="show-more" data-toggle-block="${escapeHtml(block.key)}" type="button">${ui.expandedBlocks.has(block.key) ? 'Vis mindre' : 'Vis mer'}</button>` : ''}
      </section>`;
      }
    )
    .join('');
}

/** Åpen/stengt-status øverst i menyen. */
function renderOpenState() {
  const state = getOpenState();
  const settings = store.settings || {};
  el.openStatus.textContent = state.label;
  document.getElementById('pickupDetails').textContent = state.open
    ? `Kun henting · stenger ${state.closesAt}`
    : `Kun henting · åpner ${state.opensAt}`;
  el.openDot.classList.toggle('is-closed', !state.open);
  el.closedBanner.hidden = state.open || !settings.closedMessage;
  if (!state.open) {
    el.closedTitle.textContent = 'Restauranten er stengt';
    el.closedText.textContent =
      settings.closedMessage || `Vi tar imot bestillinger fra ${state.opensAt}.`;
  }
  el.btnToCheckout.disabled = !state.open;
  el.cartClosedHint.hidden = state.open;
  return state;
}

function defaultSelectionFor(item) {
  const selections = {};
  for (const group of getItemOptionGroups(item)) {
    const valid = new Set((group.options || []).map((opt) => opt.id));
    let defaults = (group.defaultOptionIds || []).filter((id) => valid.has(id));
    if (group.selectionMode === 'single') defaults = defaults.slice(0, 1);
    else defaults = defaults.slice(0, group.maxSelections);
    selections[group.id] = defaults;
  }
  return selections;
}

function openProduct(itemId, editLine = null) {
  const { item } = findItem(itemId);
  if (!item || item.hidden) return;
  if (item.soldOut && !editLine) {
    toast('Produktet er utsolgt akkurat nå.');
    return;
  }
  const defaultSize = getDefaultSize(item);
  draft = {
    itemId: item.id,
    sizeId: editLine ? editLine.sizeId : defaultSize ? defaultSize.id : null,
    selections: editLine
      ? JSON.parse(JSON.stringify(editLine.selections))
      : defaultSelectionFor(item),
    comment: editLine ? editLine.comment : '',
    quantity: editLine ? editLine.quantity : 1,
    editingLineId: editLine ? editLine.lineId : null,
    showErrors: false,
  };
  ui.editingLineId = draft.editingLineId;
  el.sheetTitle.textContent = item.name;
  el.sheetFav.classList.toggle('is-on', isFavorite(item.id));
  el.sheetBackdrop.hidden = false;
  el.sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  renderSheet();
  el.sheetBody.scrollTop = 0;
}

function closeSheet() {
  draft = null;
  ui.editingLineId = null;
  el.sheet.hidden = true;
  el.sheetBackdrop.hidden = true;
  el.sheetErr.hidden = true;
  document.body.style.overflow = '';
}

/** Validerer valggrupper. Returnerer { valid, problems: Set<groupId>, message }. */
function validateDraft() {
  const { item } = findItem(draft.itemId);
  const problems = new Set();
  let message = '';
  if (!item) return { valid: false, problems, message: 'Produktet finnes ikke.' };

  for (const group of getItemOptionGroups(item)) {
    const picked = draft.selections[group.id] || [];
    if (group.required && picked.length === 0) {
      problems.add(group.id);
      if (!message) message = `Velg i «${group.title}» for å fortsette.`;
    }
    if (group.selectionMode === 'multiple' && picked.length > group.maxSelections) {
      problems.add(group.id);
      if (!message) message = `Du kan velge maks ${group.maxSelections} i «${group.title}».`;
    }
  }
  return { valid: problems.size === 0, problems, message };
}

function draftTotal() {
  const { item } = findItem(draft.itemId);
  if (!item) return 0;
  const optionIds = Object.values(draft.selections).flat();
  return computeLinePrice(item, draft.sizeId, optionIds, draft.quantity);
}

function optionGroupHtml(group, problems) {
  const picked = draft.selections[group.id] || [];
  const isMulti = group.selectionMode === 'multiple';
  const atMax = isMulti && picked.length >= group.maxSelections;
  const badges = `<span class="opt-guidance">${group.required ? (isMulti ? 'Velg opptil' : 'Velg') : 'Valgfritt · opptil'} ${isMulti ? group.maxSelections : 1}${group.required && isMulti && group.minSelections > 0 && group.minSelections !== group.maxSelections ? ` (minst ${group.minSelections})` : ''}</span>`;

  const rows = (group.options || [])
    .filter((option) => option.label)
    .map((option) => {
      const checked = picked.includes(option.id);
      const blocked = atMax && !checked;
      return `
        <label class="opt-row${checked ? ' is-checked' : ''}${blocked ? ' is-blocked' : ''}">
          <input type="${isMulti ? 'checkbox' : 'radio'}" name="grp_${escapeHtml(group.id)}"
                 data-group="${escapeHtml(group.id)}" data-option="${escapeHtml(option.id)}"
                 ${checked ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
          <span class="opt-label">${escapeHtml(option.label)}</span>
          <span class="opt-price">${
            option.price > 0 ? `+${formatPrice(option.price)}` : 'Inkludert'
          }</span>
        </label>`;
    })
    .join('');

  return `
    <div class="opt-group${problems.has(group.id) && draft.showErrors ? ' opt-invalid' : ''}">
      <div class="opt-head">
        <h3 class="opt-title">${escapeHtml(group.title)}</h3>
        ${badges}
      </div>
      <div class="opt-rows">${rows || '<p class="hint">Ingen alternativer.</p>'}</div>
    </div>`;
}

function renderSheet() {
  if (!draft) return;
  const { item } = findItem(draft.itemId);
  if (!item) {
    closeSheet();
    return;
  }

  // Sørg for at valgt størrelse fortsatt finnes (admin kan ha endret den).
  if (!(item.sizes || []).some((size) => size.id === draft.sizeId)) {
    const fallback = getDefaultSize(item);
    draft.sizeId = fallback ? fallback.id : null;
  }

  const { problems, message } = validateDraft();
  const groups = getItemOptionGroups(item);
  const allergens = allergenLabels(item);

  const sizeHtml =
    (item.sizes || []).length > 0
      ? `
      <div class="opt-group">
        <div class="opt-head">
          <h3 class="opt-title">Velg størrelse</h3>
          <span class="opt-guidance">Velg én</span>
        </div>
        <div class="opt-rows">
          ${item.sizes
            .map(
              (size) => `
            <label class="opt-row${size.id === draft.sizeId ? ' is-checked' : ''}">
              <input type="radio" name="size" data-size="${escapeHtml(size.id)}" ${
                size.id === draft.sizeId ? 'checked' : ''
              }>
              <span class="opt-label">${escapeHtml(size.label)}</span>
              <span class="opt-price">${formatPrice(size.price)}</span>
            </label>`
            )
            .join('')}
        </div>
      </div>`
      : '';

  el.sheetBody.innerHTML = `
    ${
      item.imageUrl
        ? `<img class="sheet-hero" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">`
        : ''
    }
    ${item.soldOut ? '<p class="tag tag-soldout">Utsolgt</p>' : ''}
    <p class="sheet-desc">${escapeHtml(item.description || item.ingredients || '')}</p>
    ${sizeHtml}
    ${groups.map((group) => optionGroupHtml(group, problems)).join('')}
    <div class="opt-group">
      <div class="opt-head"><h3 class="opt-title">Kommentar til kjøkkenet</h3></div>
      <textarea class="comment-area" id="draftComment" placeholder="F.eks. uten løk, godt stekt">${escapeHtml(
        draft.comment
      )}</textarea>
    </div>
    <div class="sheet-allergens" aria-label="Allergener">
      <span class="sheet-allergens-label">Allergener</span>
      <div class="sheet-allergen-chips">
        ${allergens.length
          ? allergens.map((label) => `<span class="sheet-allergen-chip">${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}</span>`).join('')
          : '<span class="sheet-allergen-none">Ingen registrerte allergener</span>'}
      </div>
    </div>`;

  el.qtyValue.textContent = String(draft.quantity);
  el.sheetTotal.textContent = formatPrice(draftTotal());
  el.btnAddToCart.querySelector('span').textContent = draft.editingLineId
    ? 'Oppdater handlekurven'
    : 'Legg til';
  el.btnAddToCart.disabled = item.soldOut;

  if (draft.showErrors && message) {
    el.sheetErr.textContent = message;
    el.sheetErr.hidden = false;
  } else {
    el.sheetErr.hidden = true;
  }
}

/* ------------------------------------------------------------------ *
 * Handlekurv
 * ------------------------------------------------------------------ */

function lineSignature(itemId, sizeId, selections, comment) {
  const optionIds = Object.values(selections).flat().slice().sort().join(',');
  return `${itemId}|${sizeId}|${optionIds}|${(comment || '').trim().toLowerCase()}`;
}

function addDraftToCart() {
  if (!draft) return;
  const { item } = findItem(draft.itemId);
  if (!item) return;
  const commentField = document.getElementById('draftComment');
  if (commentField) draft.comment = commentField.value.trim();

  const check = validateDraft();
  if (!check.valid) {
    draft.showErrors = true;
    renderSheet();
    return;
  }

  const signature = lineSignature(
    draft.itemId,
    draft.sizeId,
    draft.selections,
    draft.comment
  );

  if (draft.editingLineId) {
    cart = cart.filter((line) => line.lineId !== draft.editingLineId);
  }

  const existing = cart.find((line) => line.signature === signature);
  if (existing) {
    existing.quantity += draft.quantity;
  } else {
    cart.push({
      lineId: uid('ln'),
      signature,
      itemId: draft.itemId,
      sizeId: draft.sizeId,
      selections: JSON.parse(JSON.stringify(draft.selections)),
      comment: draft.comment,
      quantity: draft.quantity,
    });
  }

  resetPendingOrderSubmission();
  persistCart();
  toast(
    draft.editingLineId ? 'Handlekurven er oppdatert.' : `${item.name} lagt i handlekurven.`
  );
  closeSheet();
  renderCartCount();
  if (ui.view === 'cart') renderCart();
  if (ui.view === 'checkout') renderCheckout();
}

/** Fjerner kurvlinjer som ikke lenger er gyldige (skjult/utsolgt/slettet). */
function reconcileCart() {
  let changed = false;
  const kept = [];
  for (const line of cart) {
    const { item } = findItem(line.itemId);
    if (!item || item.hidden || item.soldOut) {
      changed = true;
      continue;
    }
    if (!(item.sizes || []).some((size) => size.id === line.sizeId)) {
      const fallback = getDefaultSize(item);
      line.sizeId = fallback ? fallback.id : null;
      changed = true;
    }
    const groups = getItemOptionGroups(item);
    const groupIds = new Set(groups.map((group) => group.id));
    for (const key of Object.keys(line.selections || {})) {
      if (!groupIds.has(key)) {
        delete line.selections[key];
        changed = true;
      }
    }
    for (const group of groups) {
      const valid = new Set((group.options || []).map((opt) => opt.id));
      const before = line.selections[group.id] || [];
      let after = before.filter((id) => valid.has(id));
      if (group.selectionMode === 'single') after = after.slice(0, 1);
      else after = after.slice(0, group.maxSelections);
      if (after.length !== before.length) changed = true;
      line.selections[group.id] = after;
    }
    line.signature = lineSignature(
      line.itemId,
      line.sizeId,
      line.selections,
      line.comment
    );
    kept.push(line);
  }
  if (kept.length !== cart.length) changed = true;
  cart = kept;
  if (changed) persistCart();
  return changed;
}

function cartSubtotal() {
  return cart.reduce((sum, line) => {
    const { item } = findItem(line.itemId);
    if (!item) return sum;
    const optionIds = Object.values(line.selections || {}).flat();
    return sum + computeLinePrice(item, line.sizeId, optionIds, line.quantity);
  }, 0);
}

function cartCount() {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

function cartLineHtml(line) {
  const { item } = findItem(line.itemId);
  if (!item) return '';
  const size = (item.sizes || []).find((s) => s.id === line.sizeId);
  const optionIds = Object.values(line.selections || {}).flat();
  const price = computeLinePrice(item, line.sizeId, optionIds, line.quantity);
  const addons = describeSelection(optionIds);
  const addonGroups = addons.reduce((groups, addon) => {
    let group = groups.find((entry) => entry.title === addon.groupTitle);
    if (!group) {
      group = { title: addon.groupTitle, items: [] };
      groups.push(group);
    }
    group.items.push(addon);
    return groups;
  }, []);

  return `
    <div class="cart-line" data-line="${escapeHtml(line.lineId)}">
      <span class="line-qty">${line.quantity}×</span>
      <div class="line-body">
        <p class="line-name">${escapeHtml(item.name)}</p>
        <div class="line-details">
          ${
            size
              ? `<div class="line-size">
                   <span>Størrelse</span>
                   <strong>${escapeHtml(size.label)}</strong>
                   <span>${formatPrice(getSizePrice(item, line.sizeId))}</span>
                 </div>`
              : ''
          }
          ${addonGroups
            .map(
              (group) => `
                <div class="line-addon-group">
                  <span class="line-detail-label">${escapeHtml(group.title || 'Tilvalg')}</span>
                  <ul class="line-addon-list">
                    ${group.items
                      .map(
                        (addon) => `
                          <li>
                            <span>${escapeHtml(addon.label)}</span>
                            ${addon.price > 0 ? `<strong>+${formatPrice(addon.price)}</strong>` : ''}
                          </li>`
                      )
                      .join('')}
                  </ul>
                </div>`
            )
            .join('')}
        </div>
        ${line.comment ? `<p class="line-comment">«${escapeHtml(line.comment)}»</p>` : ''}
        <div class="line-actions">
                 <button class="link-btn" data-edit="${escapeHtml(line.lineId)}" type="button">Endre</button>
                 <button class="link-btn is-danger" data-remove="${escapeHtml(line.lineId)}" type="button">Fjern</button>
               </div>
      </div>
      <div class="line-right">
        <span class="line-price">${formatPrice(price)}</span>
        <span class="line-step">
                 <button data-dec="${escapeHtml(line.lineId)}" type="button" aria-label="Færre">−</button>
                 <span>${line.quantity}</span>
                 <button data-inc="${escapeHtml(line.lineId)}" type="button" aria-label="Flere">+</button>
               </span>
      </div>
    </div>`;
}

function renderCart() {
  if (!cart.length) {
    el.cartLines.innerHTML =
      '<div class="empty-note"><strong>Handlekurven er tom</strong>Legg til noe godt fra menyen.</div>';
    el.cartSummary.hidden = true;
    el.cartActions.hidden = true;
    return;
  }
  el.cartLines.innerHTML = cart.map((line) => cartLineHtml(line)).join('');
  const subtotal = cartSubtotal();
  el.cartTotal.textContent = formatPrice(subtotal);
  el.cartSummary.hidden = false;
  el.cartActions.hidden = false;
}

function renderCartCount() {
  const count = cartCount();
  el.cartCount.textContent = String(count);
  el.cartCount.hidden = count === 0;
}


/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */

function setStep(step) {
  ui.checkoutStep = step;
  el.step2.hidden = step !== 2;
  el.step3.hidden = step !== 3;
  el.stepper.querySelectorAll('.step').forEach((node) => {
    const value = Number(node.dataset.step);
    node.classList.toggle('is-active', value === step);
    if (value === step) node.setAttribute('aria-current', 'step');
    else node.removeAttribute('aria-current');
    node.classList.toggle('is-done', value < step);
  });
  el.btnStepBack.textContent = 'Tilbake';
  el.btnStepNext.textContent = step === 3 ? (ui.orderSubmitting ? 'Sender…' : ui.orderSendFailed ? 'Prøv igjen' : 'Send bestilling') : 'Neste: Hentetid';
  renderCheckout();
}

function renderCheckout() {
  if (!cart.length) {
    setView('cart');
    return;
  }
  const subtotal = cartSubtotal();
  const total = subtotal;

  el.custName.value = el.custName.value || profile.name || '';
  el.custPhone.value = el.custPhone.value || profile.phone || '';
  el.btnStepNext.disabled = ui.orderSubmitting;
  el.views.checkout.classList.toggle('is-submitting', ui.orderSubmitting);
  updateContactValidation();

  const state = getOpenState();
  const slots = getPickupSlots();
  if (ui.pickupMode === 'scheduled' && !slots.some((slot) => slot.value === ui.pickup)) ui.pickup = null;
  if (!state.open) ui.pickup = null;
  el.pickupChoices.hidden = !state.open;
  el.pickupChoices.querySelectorAll('[data-pickup-mode]').forEach((button) => {
    const active = button.dataset.pickupMode === ui.pickupMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const showTimes = state.open && ui.pickupMode === 'scheduled';
  el.timeGrid.hidden = !showTimes;
  el.timeGrid.innerHTML = showTimes
    ? slots.map((slot) => `<button class="time-btn${ui.pickup === slot.value ? ' is-active' : ''}" aria-pressed="${ui.pickup === slot.value}" data-time="${escapeHtml(slot.value)}" type="button">${escapeHtml(slot.label)}</button>`).join('')
    : '';
  el.pickupHint.textContent = !state.open
    ? `Vi åpner ${state.opensAt}.`
    : showTimes
      ? slots.length ? 'Velg et ledig klokkeslett nedenfor.' : 'Ingen ledige klokkeslett. Velg Snarest mulig.'
      : ui.pickupMode === 'asap' ? 'Vi lager bestillingen så snart vi kan.' : 'Velg når du vil hente bestillingen.';

  const reviewCount = cartCount();
  const reviewLabel = `${reviewCount} ${reviewCount === 1 ? 'vare' : 'varer'}`;
  const reviewItems = cart.map((line) => {
    const { item } = findItem(line.itemId);
    if (!item) return '';
    const size = (item.sizes || []).find((entry) => entry.id === line.sizeId);
    const optionIds = Object.values(line.selections || {}).flat();
    const linePrice = computeLinePrice(item, line.sizeId, optionIds, line.quantity);
    const addons = describeSelection(optionIds);
    const addonGroups = addons.reduce((groups, addon) => {
      let group = groups.find((entry) => entry.title === addon.groupTitle);
      if (!group) {
        group = { title: addon.groupTitle || 'Tilvalg', items: [] };
        groups.push(group);
      }
      group.items.push(addon);
      return groups;
    }, []);

    return `
      <article class="checkout-review-item">
        <div class="checkout-review-item-top">
          <span class="checkout-review-item-qty">${line.quantity}×</span>
          <div class="checkout-review-item-main">
            <div class="checkout-review-title-row">
              <strong class="checkout-review-item-name">${escapeHtml(item.name)}</strong>
              <strong class="checkout-review-item-total">${formatPrice(linePrice)}</strong>
            </div>
            ${size ? `
              <div class="checkout-review-meta-row">
                <span>Størrelse</span>
                <strong>${escapeHtml(size.label)}</strong>
                <small>${formatPrice(getSizePrice(item, line.sizeId))}</small>
              </div>` : ''}
            ${addonGroups.length ? `
              <div class="checkout-review-addon-wrap">
                ${addonGroups.map((group) => `
                  <section class="checkout-review-addon-group">
                    <span class="checkout-review-addon-title">${escapeHtml(group.title)}</span>
                    ${group.items.map((addon) => `
                      <div class="checkout-review-addon-row">
                        <span class="checkout-review-addon-name">• ${escapeHtml(addon.label)}</span>
                        <strong class="checkout-review-addon-price">${addon.price > 0 ? `+${formatPrice(addon.price)}` : 'Inkludert'}</strong>
                      </div>`).join('')}
                  </section>`).join('')}
              </div>` : ''}
            ${line.comment ? `
              <div class="checkout-review-comment">
                <span>Kommentar</span>
                <p>${escapeHtml(line.comment)}</p>
              </div>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');

  el.reviewCard.innerHTML = `
    <div class="checkout-review-head">
      <div class="checkout-review-head-copy">
        <span>Kontroller bestillingen</span>
        <strong>Din bestilling</strong>
      </div>
      <button class="link-btn" data-review-cart type="button">Endre kurv</button>
    </div>
    <details class="checkout-review-toggle">
      <summary class="checkout-review-summary">
        <strong class="checkout-review-count">${escapeHtml(reviewLabel)}</strong>
        <span class="checkout-review-summary-hint">Se innhold og detaljer</span>
        <span class="checkout-review-summary-action" aria-hidden="true"></span>
      </summary>
      <div class="checkout-review-details">
        <div class="checkout-review-items">${reviewItems || '<div class="checkout-review-empty">Ingen varer i kurven.</div>'}</div>
        <section class="checkout-review-info" aria-label="Din informasjon">
          <h4>Din informasjon</h4>
          <div class="checkout-review-info-row"><span>Navn</span><strong>${escapeHtml(el.custName.value || '—')}</strong></div>
          <div class="checkout-review-info-row"><span>Telefon</span><strong>${el.custPhone.value ? `+47 ${escapeHtml(el.custPhone.value)}` : '—'}</strong></div>
          <div class="checkout-review-info-row"><span>Hentetid</span><strong>${ui.pickup ? (ui.pickup === 'asap' ? 'Snarest' : escapeHtml(ui.pickup)) : 'Ikke valgt'}</strong></div>
          <div class="checkout-review-info-row is-total"><span>Å betale ved henting</span><strong>${formatPrice(total)}</strong></div>
        </section>
      </div>
    </details>`;
  if (ui.checkoutStep === 3) {
    el.btnStepNext.disabled = ui.orderSubmitting;
    el.btnStepNext.textContent = ui.orderSubmitting ? 'Sender…' : ui.orderSendFailed ? 'Prøv igjen' : 'Send bestilling';
  }
}

function updateContactValidation() {
  for (const [name, phone] of [[el.custName, el.custPhone], [el.profName, el.profPhone]]) {
    for (const input of [name, phone]) {
      const valid = input === name ? Boolean(input.value.trim()) : validPhone(input.value);
      const wrapper = input.closest('.validated-input');
      wrapper.classList.toggle('is-valid', valid);
      wrapper.querySelector('.valid-check').hidden = !valid;
    }
  }
  if (ui.checkoutStep === 2) el.btnStepNext.disabled = !el.custName.value.trim() || !validPhone(el.custPhone.value);
}

function validPhone(value) {
  return /^[49]\d{7}$/.test(String(value).replace(/\s/g, ''));
}


function resolveScheduledPickupAt(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const now = new Date();
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}


/* Order confirmation wait flow 2026-09-15 */
const ORDER_CONFIRM_WAIT_MS = 3 * 60 * 1000;
let orderConfirmTimer = null;
let orderConfirmOrderId = '';
let orderConfirmDeadline = 0;
let orderConfirmTimedOut = false;
let orderConfirmResolved = false;
let orderConfirmAcceptedTimer = null;
let orderConfirmRedirectTimer = null;

function stopOrderConfirmationWait() {
  if (orderConfirmTimer) {
    clearInterval(orderConfirmTimer);
    orderConfirmTimer = null;
  }
  if (orderConfirmAcceptedTimer) {
    clearInterval(orderConfirmAcceptedTimer);
    orderConfirmAcceptedTimer = null;
  }
  if (orderConfirmRedirectTimer) {
    clearTimeout(orderConfirmRedirectTimer);
    orderConfirmRedirectTimer = null;
  }
  orderConfirmOrderId = '';
  orderConfirmDeadline = 0;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
}

function confirmationRestaurantPhone() {
  const settings = store.settings || {};
  const label = String(settings.phone || '').trim();
  const tel = label.replace(/[^+\d]/g, '');
  return { label, tel };
}

function confirmationOrderSnapshot(orderId) {
  if (!orderId) return null;
  const live = mergedCustomerOrders().find((order) => order?.id === orderId);
  if (live) return live;
  return stableCustomerOrderSnapshots.get(orderId) || null;
}

function confirmationTimeLeftText() {
  const remaining = Math.max(0, orderConfirmDeadline - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function confirmationReadyLeftText(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) {
    const minutes = Math.max(0, Number(order?.estimatedMinutes) || 0);
    return minutes > 0 ? `ca. ${minutes} min igjen` : 'Bekreftet';
  }
  const remaining = Math.max(0, readyAt - Date.now());
  if (!remaining) return 'Klar nå';
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')} igjen`;
}

function confirmationBaseRows(order) {
  return `
    <div><span>Ordrenummer</span><strong>${escapeHtml(String(order.id || '').slice(-6).toUpperCase())}</strong></div>
    <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || 'Snarest')}</strong></div>
    <div><span>Beløp</span><strong>${formatPrice(order.total)}</strong></div>`;
}

function renderConfirmationWaiting(order, name) {
  const title = el.confirmModal.querySelector('h2');
  if (title) title.textContent = 'Venter på bekreftelse';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = 'waiting';
  if (el.btnConfirmDone) el.btnConfirmDone.hidden = true;
  el.confirmText.textContent = `Takk, ${name}! Bestillingen er sendt. Vi venter nå på svar fra restauranten.`;
  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-wait-status">
      <span class="confirm-live-dot" aria-hidden="true"></span>
      <div>
        <strong>Venter på restauranten</strong>
        <small>Vi holder deg her i opptil 3 minutter · <b data-confirm-countdown>${confirmationTimeLeftText()}</b> igjen</small>
      </div>
    </div>`;
}

function renderConfirmationAccepted(order) {
  const title = el.confirmModal.querySelector('h2');
  const minutes = Math.max(0, Number(order.estimatedMinutes) || 0);
  const scheduled = order.pickupMode === 'scheduled' || (order.pickup && order.pickup !== 'Snarest');
  const readyNow = order.status === 'klar';
  if (title) title.textContent = readyNow ? 'Klar for henting' : 'Bestillingen er bekreftet';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = readyNow ? 'ready' : 'accepted';
  if (el.btnConfirmDone) el.btnConfirmDone.hidden = true;

  el.confirmText.textContent = readyNow
    ? 'Maten din er klar.'
    : scheduled
      ? `Henting ${order.pickup}.`
      : minutes > 0
        ? `Ca. ${minutes} minutter.`
        : 'Bestillingen er tatt imot.';

  const statusLine = readyNow
    ? '<strong>Klar nå</strong>'
    : scheduled
      ? `<strong>${escapeHtml(order.pickup || '')}</strong>`
      : minutes > 0
        ? `<strong data-confirm-ready-countdown>${escapeHtml(confirmationReadyLeftText(order))}</strong>`
        : '<strong>Bekreftet</strong>';

  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-accepted-status">
      <span class="confirm-accepted-check" aria-hidden="true">✓</span>
      <div>${statusLine}</div>
    </div>`;
}

function startAcceptedConfirmationHold(order) {
  if (orderConfirmAcceptedTimer) clearInterval(orderConfirmAcceptedTimer);
  if (orderConfirmRedirectTimer) clearTimeout(orderConfirmRedirectTimer);

  orderConfirmAcceptedTimer = window.setInterval(() => {
    const current = confirmationOrderSnapshot(order.id) || order;
    const node = el.confirmMeta.querySelector('[data-confirm-ready-countdown]');
    if (node) node.textContent = confirmationReadyLeftText(current);
  }, 500);

  // Show the compact confirmation briefly, then return to the main menu.
  orderConfirmRedirectTimer = window.setTimeout(() => {
    if (orderConfirmAcceptedTimer) {
      clearInterval(orderConfirmAcceptedTimer);
      orderConfirmAcceptedTimer = null;
    }
    orderConfirmRedirectTimer = null;
    el.confirmModal.dataset.waiting = 'false';
    orderConfirmOrderId = '';
    orderConfirmDeadline = 0;
    closeConfirm();
    renderActiveOrders();
  }, 3000);
}

function renderConfirmationTimeout(order) {
  const title = el.confirmModal.querySelector('h2');
  const phone = confirmationRestaurantPhone();
  if (title) title.textContent = 'Vi venter fortsatt på svar';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = 'timeout';
  el.confirmText.textContent = 'Det har gått 3 minutter uten bekreftelse. Vi kan være opptatt i restauranten akkurat nå.';
  const phoneAction = phone.tel
    ? `<a class="confirm-call-button" href="tel:${escapeHtml(phone.tel)}">Ring ${escapeHtml(phone.label || phone.tel)}</a>`
    : '<span class="confirm-phone-missing">Telefonnummer er ikke tilgjengelig akkurat nå.</span>';
  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-timeout-status">
      <strong>Ikke bekreftet ennå</strong>
      <small>Ring oss for å sjekke bestillingen eller bestille på telefon. Hvis vi bekrefter her etterpå, oppdateres denne siden automatisk.</small>
      ${phoneAction}
    </div>`;
}

function checkOrderConfirmationWait() {
  if (!orderConfirmOrderId || el.confirmModal.hidden || orderConfirmResolved) return;
  const order = confirmationOrderSnapshot(orderConfirmOrderId);
  if (!order) return;
  persistCustomerOrderSnapshot(order);

  if (order.status === 'avvist') {
    orderConfirmResolved = true;
    if (orderConfirmTimer) {
      clearInterval(orderConfirmTimer);
      orderConfirmTimer = null;
    }
    const title = el.confirmModal.querySelector('h2');
    const phone = confirmationRestaurantPhone();
    if (title) title.textContent = 'Bestillingen ble ikke godkjent';
    el.confirmModal.dataset.waiting = 'false';
    el.confirmModal.dataset.state = 'rejected';
    el.confirmText.textContent = order.rejectionMessage || order.rejectionReason || 'Restauranten kunne dessverre ikke ta imot bestillingen.';
    const phoneAction = phone.tel ? `<a class="confirm-call-button" href="tel:${escapeHtml(phone.tel)}">Ring ${escapeHtml(phone.label || phone.tel)}</a>` : '';
    el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}<div class="confirm-timeout-status">${phoneAction}</div>`;
    return;
  }

  if (['bekreftet', 'tilberedning', 'klar'].includes(order.status)) {
    orderConfirmResolved = true;
    if (orderConfirmTimer) {
      clearInterval(orderConfirmTimer);
      orderConfirmTimer = null;
    }
    ui.focusedOrderId = order.id;
    renderConfirmationAccepted(order);
    renderActiveOrders();
    startAcceptedConfirmationHold(order);
    return;
  }

  if (!orderConfirmTimedOut && Date.now() >= orderConfirmDeadline) {
    orderConfirmTimedOut = true;
    renderConfirmationTimeout(order);
    return;
  }

  if (!orderConfirmTimedOut) {
    const countdown = el.confirmMeta.querySelector('[data-confirm-countdown]');
    if (countdown) countdown.textContent = confirmationTimeLeftText();
  }
}

function startOrderConfirmationWait(order, name) {
  if (!order?.id) return;
  if (orderConfirmTimer) clearInterval(orderConfirmTimer);
  if (orderConfirmAcceptedTimer) clearInterval(orderConfirmAcceptedTimer);
  if (orderConfirmRedirectTimer) clearTimeout(orderConfirmRedirectTimer);
  orderConfirmAcceptedTimer = null;
  orderConfirmRedirectTimer = null;
  orderConfirmOrderId = order.id;
  orderConfirmDeadline = Date.now() + ORDER_CONFIRM_WAIT_MS;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
  ui.focusedOrderId = order.id;
  rememberCustomerOrder(order);
  persistCustomerOrderSnapshot(order);

  // Show the waiting screen FIRST. A watcher failure must never leave the customer on "Sender…".
  renderConfirmationWaiting(order, name);
  el.confirmBackdrop.hidden = false;
  el.confirmModal.hidden = false;

  // Current live-order implementation uses the multi-order watcher API.
  syncActiveOrderWatchers([order.id]);
  void fetchActiveOrderNow(order.id);
  checkOrderConfirmationWait();
  orderConfirmTimer = window.setInterval(checkOrderConfirmationWait, 1000);
}


async function placeOrder() {
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
      pickupMode: ui.pickupMode === 'scheduled' ? 'scheduled' : 'asap',
      scheduledPickupAt: ui.pickupMode === 'scheduled' ? resolveScheduledPickupAt(ui.pickup) : null,
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

  startOrderConfirmationWait(order, name);
  renderCartCount();
  renderActiveOrders();
}

/* ------------------------------------------------------------------ *
 * Profil
 * ------------------------------------------------------------------ */

  function previousOrderSelections(item, line) {
    const groups = getItemOptionGroups(item);
    const savedSelections =
      line && line.selections && typeof line.selections === 'object'
        ? line.selections
        : {};
    const savedIds = new Set([
      ...(Array.isArray(line.optionIds) ? line.optionIds : []),
      ...Object.values(savedSelections)
        .flat()
        .filter((id) => typeof id === 'string'),
    ]);
    const savedLabels = new Set([
      ...(Array.isArray(line.options) ? line.options : []),
      ...(Array.isArray(line.optionDetails)
        ? line.optionDetails.map((entry) => entry && entry.label)
        : []),
    ].filter(Boolean).map((label) => String(label)));

    const selections = {};
    for (const group of groups) {
      const options = group.options || [];
      const validIds = new Set(options.map((option) => option.id));
      let picked = Array.isArray(savedSelections[group.id])
        ? savedSelections[group.id].filter((id) => validIds.has(id))
        : [];

      if (!picked.length && savedIds.size) {
        picked = options.filter((option) => savedIds.has(option.id)).map((option) => option.id);
      }
      if (!picked.length && savedLabels.size) {
        picked = options
          .filter((option) => savedLabels.has(option.label))
          .map((option) => option.id);
      }
      if (!picked.length && group.required) {
        picked = (group.defaultOptionIds || []).filter((id) => validIds.has(id));
      }

      selections[group.id] = group.selectionMode === 'single'
        ? picked.slice(0, 1)
        : picked.slice(0, Math.max(Number(group.maxSelections) || picked.length, 1));
    }
    return selections;
  }

  function previousOrderOptionDetails(line) {
    if (Array.isArray(line.optionDetails) && line.optionDetails.length) {
      return line.optionDetails
        .filter((entry) => entry && entry.label)
        .map((entry) => ({
          groupTitle: entry.groupTitle || 'Tilvalg',
          label: entry.label,
          price: Number.isFinite(Number(entry.price)) ? Number(entry.price) : null,
        }));
    }

    const labels = Array.isArray(line.options) ? line.options.filter(Boolean) : [];
    if (!labels.length) return [];
    const remaining = new Set(labels.map((label) => String(label)));
    const details = [];
    const { item } = findItem(line.itemId);

    if (item) {
      for (const group of getItemOptionGroups(item)) {
        for (const option of group.options || []) {
          if (!remaining.has(option.label)) continue;
          details.push({
            groupTitle: group.title || 'Tilvalg',
            label: option.label,
            price: Number(option.price) || 0,
          });
          remaining.delete(option.label);
        }
      }
    }

    for (const label of remaining) {
      details.push({ groupTitle: 'Tilvalg', label, price: null });
    }
    return details;
  }

  function orderHistoryLineHtml(line) {
    const details = previousOrderOptionDetails(line);
    const grouped = new Map();
    for (const detail of details) {
      const key = detail.groupTitle || 'Tilvalg';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(detail);
    }
    const groupsHtml = Array.from(grouped.entries())
      .map(([title, items]) => `
        <div class="order-history-option-group">
          <span>${escapeHtml(title)}</span>
          <ul>${items.map((item) => `
            <li>
              <span>${escapeHtml(item.label)}</span>
              ${item.price > 0 ? `<strong>+${formatPrice(item.price)}</strong>` : ''}
            </li>`).join('')}</ul>
        </div>`)
      .join('');

    return `
      <div class="order-history-line">
        <div class="order-history-line-head">
          <strong>${escapeHtml(`${line.quantity || 1}× ${line.name || 'Produkt'}`)}</strong>
          <b>${formatPrice(Number(line.price) || 0)}</b>
        </div>
        ${line.size ? `<div class="order-history-size"><span>Størrelse</span><strong>${escapeHtml(line.size)}</strong></div>` : ''}
        ${groupsHtml}
        ${line.comment ? `<p class="order-history-comment">«${escapeHtml(line.comment)}»</p>` : ''}
      </div>`;
  }

  function orderStatusClass(status) {
    const value = String(status || '').toLocaleLowerCase('no');
    if (value.includes('avvist')) return 'is-rejected';
    if (value.includes('klar') || value.includes('ferdig') || value.includes('fullført')) return 'is-done';
    if (value.includes('bekreftet') || value.includes('tilbered')) return 'is-active';
    return 'is-new';
  }

function setProfileTab(tabName) {
  const validTabs = new Set(['contact', 'favorites', 'orders']);
  const activeTab = validTabs.has(tabName) ? tabName : 'contact';
  document.querySelectorAll('[data-profile-tab]').forEach((button) => {
    const active = button.dataset.profileTab === activeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-profile-panel]').forEach((panel) => {
    const active = panel.dataset.profilePanel === activeTab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
  const activeButton = document.querySelector('[data-profile-tab="' + activeTab + '"]');
  if (activeButton && typeof activeButton.scrollIntoView === 'function') {
    activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function renderProfile() {
  renderActiveOrders();
  el.profName.value = profile.name || '';
  el.profPhone.value = profile.phone || '';
  updateContactValidation();

  const favs = profile.favorites
    .map((id) => findItem(id))
    .filter(({ item }) => item && !item.hidden);
  el.favList.innerHTML = favs.length
    ? favs
        .map(
          ({ item }) => `
        <div class="mini-row">
          ${
            item.imageUrl
              ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`
              : ''
          }
          <div class="mini-body">
            <p class="mini-title">${escapeHtml(item.name)}</p>
            <p class="mini-sub">${formatPrice(getItemBasePrice(item))}</p>
          </div>
          <button class="link-btn" data-open="${escapeHtml(item.id)}" type="button">Bestill</button>
        </div>`
        )
        .join('')
    : '<p class="hint">Ingen favoritter ennå. Trykk hjerteikonet på et produkt.</p>';

    const live = getOrders();
    const orders = mergedCustomerOrders();
    el.orderList.innerHTML = orders.length
      ? orders
          .slice(0, 30)
          .map((order) => {
            const date = new Date(order.createdAt);
            const stamp = `${String(date.getDate()).padStart(2, '0')}.${String(
              date.getMonth() + 1
            ).padStart(2, '0')}.${date.getFullYear()} · ${String(date.getHours()).padStart(2, '0')}:${String(
              date.getMinutes()
            ).padStart(2, '0')}`;
            const summary = (order.lines || [])
              .map((line) => `${line.quantity}× ${line.name}`)
              .join(', ');
            const current = live.find((entry) => entry.id === order.id);
            const displayOrder = current ? mergeStableCustomerOrder(order, current) : order;
            const status = orderStatusLabel(displayOrder.status);
            const rejectionReason = String(displayOrder.rejectionReason || '').trim();
            const rejectionMessage = String(displayOrder.rejectionMessage || '').trim();
            const rejectionTitle = rejectionReason && rejectionReason !== 'Egendefinert melding' ? rejectionReason : 'Bestillingen ble avvist';
            const details = (order.lines || []).map(orderHistoryLineHtml).join('');
            const shortId = String(order.id || '').slice(-6).toUpperCase();
            return `
              <details class="order-history-card${ui.focusedOrderId === order.id ? ' is-focused' : ''}" data-order-card-id="${escapeHtml(order.id)}"${ui.focusedOrderId === order.id ? ' open' : ''}>
                <summary>
                  <div class="order-history-top">
                    <div class="order-history-total">
                      <strong>${formatPrice(order.total)}</strong>
                      <span>${escapeHtml(stamp)}</span>
                    </div>
                    <span class="order-status-pill ${orderStatusClass(status)}">${escapeHtml(status)}</span>
                  </div>
                  <p class="order-history-summary">${escapeHtml(summary)}</p>
                  <span class="order-history-toggle">Se detaljer <i aria-hidden="true">⌄</i></span>
                </summary>
                <div class="order-history-details">
                  ${displayOrder.status === 'avvist' ? `<div class="order-history-rejection"><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionMessage ? `<span>${escapeHtml(rejectionMessage)}</span>` : ''}</div>` : ''}
                  <div class="order-history-lines">${details || '<p class="hint">Ingen varelinjer lagret.</p>'}</div>
                  <div class="order-history-meta">
                    <div><span>Ordrenummer</span><strong>${escapeHtml(shortId || '—')}</strong></div>
                    <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>
                    <div><span>Totalt</span><strong>${formatPrice(order.total)}</strong></div>
                  </div>
                  <button class="btn btn-primary order-reorder-btn" data-reorder="${escapeHtml(order.id)}" type="button">Bestill samme igjen</button>
                </div>
              </details>`;
          })
          .join('')
      : '<p class="hint">Ingen tidligere bestillinger.</p>';
  }

  function reorder(orderId) {
    const order = getLocalOrders().find((entry) => entry.id === orderId);
    if (!order) return;
    let added = 0;
    for (const line of order.lines || []) {
      const { item } = findItem(line.itemId);
      if (!item || item.hidden || item.soldOut) continue;
      const size =
        (item.sizes || []).find((s) => s.id === line.sizeId) ||
        (item.sizes || []).find((s) => s.label === line.size) ||
        getDefaultSize(item);
      const selections = previousOrderSelections(item, line);
      const signature = lineSignature(
        item.id,
        size ? size.id : null,
        selections,
        line.comment
      );
      const existing = cart.find((entry) => entry.signature === signature);
      const quantity = Math.max(1, Number(line.quantity) || 1);
      if (existing) existing.quantity += quantity;
      else
        cart.push({
          lineId: uid('ln'),
          signature,
          itemId: item.id,
          sizeId: size ? size.id : null,
          selections,
          comment: line.comment || '',
          quantity,
        });
      added += quantity;
    }
    resetPendingOrderSubmission();
    persistCart();
    renderCartCount();
      if (added) {
      toast(`${added} ${added === 1 ? 'vare' : 'varer'} lagt i handlekurven med samme valg.`);
      setView('cart');
    } else {
      toast('Produktene er ikke tilgjengelige nå.');
    }
  }

  /* ------------------------------------------------------------------ *
   * Hendelser
 * ------------------------------------------------------------------ */

el.catScroll.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-cat]');
  if (!tab) return;
  scrollToCategory(tab.dataset.cat);
});

document.addEventListener('click', (event) => {
  const profileTab = event.target.closest('[data-profile-tab]');
  if (profileTab) {
    setProfileTab(profileTab.dataset.profileTab);
    return;
  }
  const readyDismiss = event.target.closest('[data-ready-dismiss]');
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
  const rejectedDismiss = event.target.closest('[data-rejected-dismiss]');
  if (rejectedDismiss) {
    markRejectedSeen(rejectedDismiss.dataset.rejectedDismiss);
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
  if (activeOrdersBtn) {
    openActiveOrderInProfile(activeOrdersBtn.dataset.activeOrders);
    return;
  }
  const reviewCartBtn = event.target.closest('[data-review-cart]');
  if (reviewCartBtn) {
    setView('cart');
    return;
  }
  const toggleBlock = event.target.closest('[data-toggle-block]');
  if (toggleBlock) {
    const key = toggleBlock.dataset.toggleBlock;
    if (ui.expandedBlocks.has(key)) ui.expandedBlocks.delete(key);
    else ui.expandedBlocks.add(key);
    renderMenu();
    return;
  }
  const openBtn = event.target.closest('[data-open]');
  if (openBtn) {
    openProduct(openBtn.dataset.open);
    return;
  }
  const card = event.target.closest('.prod-card');
  if (card) {
    openProduct(card.dataset.item);
    return;
  }
  const reorderBtn = event.target.closest('[data-reorder]');
  if (reorderBtn) reorder(reorderBtn.dataset.reorder);
});

el.cartLines.addEventListener('click', (event) => {
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  const remove = event.target.closest('[data-remove]');
  const edit = event.target.closest('[data-edit]');

  if (inc) {
    const line = cart.find((entry) => entry.lineId === inc.dataset.inc);
    if (line) line.quantity += 1;
  } else if (dec) {
    const line = cart.find((entry) => entry.lineId === dec.dataset.dec);
    if (line) {
      line.quantity -= 1;
      if (line.quantity <= 0) cart = cart.filter((entry) => entry.lineId !== line.lineId);
    }
  } else if (remove) {
    cart = cart.filter((entry) => entry.lineId !== remove.dataset.remove);
  } else if (edit) {
    const line = cart.find((entry) => entry.lineId === edit.dataset.edit);
    if (line) openProduct(line.itemId, line);
    return;
  } else {
    return;
  }

  resetPendingOrderSubmission();
  persistCart();
  renderCart();
  renderCartCount();
});

el.sheetBody.addEventListener('change', (event) => {
  if (!draft) return;
  const target = event.target;

  if (target.dataset.size) {
    draft.sizeId = target.dataset.size;
    renderSheet();
    return;
  }

  const groupId = target.dataset.group;
  const optionId = target.dataset.option;
  if (!groupId || !optionId) return;

  const group = getItemOptionGroups(findItem(draft.itemId).item).find(
    (entry) => entry.id === groupId
  );
  if (!group) return;

  if (group.selectionMode === 'single') {
    const current = draft.selections[groupId] || [];
    if (!group.required && current[0] === optionId) draft.selections[groupId] = [];
    else draft.selections[groupId] = [optionId];
  } else {
    const current = new Set(draft.selections[groupId] || []);
    if (target.checked) {
      if (current.size >= group.maxSelections) {
        target.checked = false;
        toast(`Maks ${group.maxSelections} valg i «${group.title}».`);
        return;
      }
      current.add(optionId);
    } else {
      current.delete(optionId);
    }
    draft.selections[groupId] = Array.from(current);
  }

  const check = validateDraft();
  if (check.valid) draft.showErrors = false;
  renderSheet();
});

// Product-sheet choice feedback
el.sheetBody.addEventListener('change', (event) => {
  if (!draft) return;
  const target = event.target;
  const { item } = findItem(draft.itemId);
  if (!item) return;

  if (target.dataset.size) {
    const size = (item.sizes || []).find((entry) => entry.id === target.dataset.size);
    toast(size ? `Størrelse valgt: ${size.label}.` : 'Størrelse oppdatert.');
    return;
  }

  const groupId = target.dataset.group;
  const optionId = target.dataset.option;
  if (!groupId || !optionId) return;
  const group = getItemOptionGroups(item).find((entry) => entry.id === groupId);
  const option = group?.options?.find((entry) => entry.id === optionId);
  if (!option) return;
  const selected = (draft.selections[groupId] || []).includes(optionId);
  toast(`${option.label} ${selected ? 'valgt.' : 'fjernet.'}`);
});

el.sheetBody.addEventListener('input', (event) => {
  if (draft && event.target.id === 'draftComment') draft.comment = event.target.value;
});

el.qtyMinus.addEventListener('click', () => {
  if (!draft) return;
  draft.quantity = Math.max(1, draft.quantity - 1);
  el.qtyValue.textContent = String(draft.quantity);
  el.sheetTotal.textContent = formatPrice(draftTotal());
});

el.qtyPlus.addEventListener('click', () => {
  if (!draft) return;
  draft.quantity = Math.min(30, draft.quantity + 1);
  el.qtyValue.textContent = String(draft.quantity);
  el.sheetTotal.textContent = formatPrice(draftTotal());
});

el.btnAddToCart.addEventListener('click', addDraftToCart);
el.sheetClose.addEventListener('click', closeSheet);
el.sheetBackdrop.addEventListener('click', closeSheet);
el.sheetTitle.addEventListener('click', closeSheet);
el.sheetTitle.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    closeSheet();
  }
});

el.sheetFav.addEventListener('click', () => {
  if (!draft) return;
  toggleFavorite(draft.itemId);
  el.sheetFav.classList.toggle('is-on', isFavorite(draft.itemId));
  renderCategories();
  renderMenu();
  toast(isFavorite(draft.itemId) ? 'Lagt til i favoritter.' : 'Fjernet fra favoritter.');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!el.sheet.hidden) closeSheet();
  else if (!el.confirmModal.hidden) closeConfirm();
});

el.btnBack.addEventListener('click', () => {
  if (ui.view === 'checkout') setView('cart');
  else setView('menu');
});

el.brandHome.addEventListener('click', (event) => {
  event.preventDefault();
  setView('menu');
});

el.btnProfile.addEventListener('click', () =>
  setView(ui.view === 'profile' ? 'menu' : 'profile')
);
document.querySelectorAll('.profile-section').forEach((section) => {
  section.addEventListener('toggle', () => {
    if (!section.open) return;
    document.querySelectorAll('.profile-section').forEach((other) => {
      if (other !== section) other.open = false;
    });
  });
});
el.btnCart.addEventListener('click', () => setView('cart'));
el.btnKeepShopping.addEventListener('click', () => setView('menu'));

el.btnToCheckout.addEventListener('click', () => {
  if (!cart.length) return;
  const state = getOpenState();
  if (!state.open) {
    toast(`Restauranten er stengt. Vi åpner ${state.opensAt}.`);
    return;
  }
  setView('checkout');
  setStep(2);
});

el.btnStepBack.addEventListener('click', () => {
  if (ui.checkoutStep === 2) setView('cart');
  else setStep(2);
});

el.btnStepNext.addEventListener('click', () => {
  if (ui.checkoutStep === 2) {
    const name = el.custName.value.trim();
    const phone = el.custPhone.value.replace(/\s/g, '');
    el.errName.hidden = Boolean(name);
    el.errPhone.hidden = validPhone(phone);
    if (!name || !validPhone(phone)) return;
    setStep(3);
    return;
  }
  placeOrder();
});

el.pickupChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pickup-mode]');
  if (!button) return;
  if (!getOpenState().open) return;
  ui.orderSendFailed = false;
  ui.pickupMode = button.dataset.pickupMode;
  ui.pickup = ui.pickupMode === 'asap' ? 'asap' : null;
  el.errTime.hidden = true;
  renderCheckout();
});

el.timeGrid.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-time]');
  if (!btn || ui.pickupMode !== 'scheduled' || !getPickupSlots().some((slot) => slot.value === btn.dataset.time)) return;
  ui.orderSendFailed = false;
  ui.pickup = btn.dataset.time;
  el.errTime.hidden = true;
  renderCheckout();
});

el.btnAllergens.addEventListener('click', () => {
  ui.allergensOpen = true;
  renderAllergenPicker();
});
el.allergenClose.addEventListener('click', () => { ui.allergensOpen = false; renderAllergenPicker(); });
el.allergenModal.addEventListener('click', (event) => { if (event.target === el.allergenModal) { ui.allergensOpen = false; renderAllergenPicker(); } });
el.allergenSearch.addEventListener('input', () => { ui.allergenSearch = el.allergenSearch.value; renderAllergenPicker(); });
el.allergenReset.addEventListener('click', () => {
  ui.selectedAllergens = [];
  saveJSON(ALLERGEN_KEY, ui.selectedAllergens);
  renderAllergenPicker();
  renderMenu();
  toast('Matallergier nullstilt.');
});
el.allergenPicker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-allergen]');
  if (!button) return;
  const label = button.dataset.allergen;
  const selected = ui.selectedAllergens.includes(label);
  ui.selectedAllergens = selected
    ? ui.selectedAllergens.filter((value) => value !== label)
    : [...ui.selectedAllergens, label];
  saveJSON(ALLERGEN_KEY, ui.selectedAllergens);
  renderAllergenPicker();
  renderMenu();
  toast(selected ? `${label} fjernet.` : `${label} lagret.`);
});

[el.custName, el.custPhone].forEach((input) => {
  input.addEventListener('input', () => {
    if (input === el.custName && input.value.trim()) el.errName.hidden = true;
    if (input === el.custPhone) {
      input.value = input.value.replace(/[^\d]/g, '').slice(0, 8);
      if (validPhone(input.value)) el.errPhone.hidden = true;
    }
  });
});

[el.custName, el.custPhone, el.profName, el.profPhone].forEach((input) => {
  input.addEventListener('input', updateContactValidation);
});

el.btnSaveProfile.addEventListener('click', () => {
  profile.name = el.profName.value.trim();
  profile.phone = el.profPhone.value.replace(/[^\d]/g, '').slice(0, 8);
  persistProfile();
  el.profileSaved.hidden = false;
  setTimeout(() => {
    el.profileSaved.hidden = true;
  }, 1800);
});

el.profPhone.addEventListener('input', () => {
  el.profPhone.value = el.profPhone.value.replace(/[^\d]/g, '').slice(0, 8);
});

function closeConfirm() {
  if (el.confirmModal.dataset.waiting === 'true') return;
  el.confirmModal.hidden = true;
  el.confirmBackdrop.hidden = true;
  setView('menu');
  renderMenu();
}

el.btnConfirmDone.addEventListener('click', closeConfirm);
el.confirmBackdrop.addEventListener('click', closeConfirm);

/* ------------------------------------------------------------------ *
 * Oppstart og live-oppdatering fra admin
 * ------------------------------------------------------------------ */

function renderAll() {
  const changed = reconcileCart();
  renderCategories();
  renderMenu();
  renderAllergenPicker();
  renderOpenState();
  renderCartCount();
  renderActiveOrders();
  if (ui.view === 'cart') renderCart();
  if (ui.view === 'checkout') renderCheckout();
  if (ui.view === 'profile') renderProfile();
  if (draft) renderSheet();
  return changed;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/demo/service-worker.js').catch(() => {});
  });
}

subscribe((_state, origin) => {
  const changed = renderAll();
  if (origin === 'remote' && changed) toast('Menyen er oppdatert av restauranten.');
});

ready().then(() => {
  renderAll();
  setView('menu');
});

// Status og åpningstid holdes oppdatert mens siden er åpen.
setInterval(() => {
  renderOpenState();
}, 5000);

// Vis resttid sekund for sekund. Når tiden er ute, går ordren automatisk til Klar.
setInterval(refreshCustomerOrderCountdowns, 1000);
refreshCustomerOrderCountdowns();

renderAll();


// live-order-visibility-refresh
window.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const current = activeCustomerOrders()[0];
  if (current) {
    fetchActiveOrderNow(current.id);
    if (current.status === 'klar') scheduleReadyDismiss(current);
  }
});
