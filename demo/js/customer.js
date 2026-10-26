import { confirmationDeadline } from './order-confirmation.js';
import { sortCartByCategory } from './cart-order.js';
import { renderSavedOrderProduct } from './order-product-summary.js?v=20261023-sharedorders1';
import { loyaltyPhone, largePizza, automaticPizzaIndex } from './loyalty.js?v=20261023-customerprofile1';
import { getDisplayComment } from './order-comments.js';
import { applyCustomerPalette } from './palette.js';
/**
 * customer.js — Kundelogikk for Restauranten.
 *
 * Hele menyen vises i én rullende liste. Kategoribaren scroller horisontalt og
 * følger sидen: når kunden scroller, markeres riktig kategori og baren flytter
 * seg til den. Åpningstid, hentetider og meny styres fra adminpanelet.
 */

import {
  store,
  backendInfo,
  getPizzaBonus,
  setPizzaOffersConsent,
  saveCustomerContact,
  DB_URL,
  subscribe,
  ready,
  formatPrice,
  getItemBasePrice,
  getSizePrice,
  getDefaultSize,
  getItemOptionGroups,
  getItemIngredientRules,
  computeLinePrice,
  describeSelection,
  findItem,
  submitOrder,
  getOrders,
  getOpenState,
  getPickupSlots,
  allergenLabels,
  orderStatusLabel,
  uid,
} from './data.js?v=20261026-godta-simple1';

/* ------------------------------------------------------------------ *
 * Lokal kundetilstand
 * ------------------------------------------------------------------ */

const PROFILE_KEY = 'bestill_profile_v2';
const CART_KEY = 'bestill_cart_v2';
const ALLERGEN_VISIBILITY_KEY = 'kol_show_allergens_v1';
const LEGACY_CHECKOUT_KEY = 'bestill_checkout_contact_v2';
const LEGACY_NOTICE_KEYS = {
  notified: 'kol_ready_notified_v1',
  readySeen: 'kol_ready_seen_v1',
  rejectedSeen: 'kol_rejected_seen_v1',
};
const LOCAL_ORDER_LIMIT = 4;

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
    return true;
  } catch (err) {
    return false;
  }
}

const profile = Object.assign(
  { name: '', phone: '', email: '', favorites: [] },
  loadJSON(PROFILE_KEY, {})
);
profile.favorites = Array.isArray(profile.favorites) ? profile.favorites : [];
profile.email = typeof profile.email === 'string' ? profile.email : '';
profile.orderNotices = profile.orderNotices && typeof profile.orderNotices === 'object'
  ? profile.orderNotices : {};

/** One-time consolidation: keep checkout contact and notice state in profile. */
function migrateOldCustomerStorage() {
  let modified = false;
  const draft = loadJSON(LEGACY_CHECKOUT_KEY, null);
  if (draft && typeof draft === 'object') {
    if (!profile.name && String(draft.name || '').trim()) {
      profile.name = String(draft.name).trim().slice(0, 120);
      modified = true;
    }
    if (!profile.phone && String(draft.phone || '').trim()) {
      profile.phone = String(draft.phone).replace(/\D/g, '').slice(0, 8);
      modified = true;
    }
  }
  for (const [kind, key] of Object.entries(LEGACY_NOTICE_KEYS)) {
    const old = loadJSON(key, []);
    if (!Array.isArray(old) || !old.length) continue;
    const original = Array.isArray(profile.orderNotices[kind])
      ? profile.orderNotices[kind] : [];
    profile.orderNotices[kind] = [...new Set([...original, ...old])]
      .filter(id => typeof id === 'string').slice(-LOCAL_ORDER_LIMIT * 2);
    modified = true;
  }
  // Never delete the only existing copy of a draft/notification until
  // it is safely stored under the profile key.
  if (modified && !saveJSON(PROFILE_KEY, profile)) return;
  // Retire old names even if the profile already contains their values.
  // No new writes to these old keys occur in this version.
  try {
    localStorage.removeItem(LEGACY_CHECKOUT_KEY);
    for (const key of Object.values(LEGACY_NOTICE_KEYS)) localStorage.removeItem(key);
  } catch (_) { /* browser storage may be disabled */ }
}
migrateOldCustomerStorage();

function orderNoticeIds(kind) {
  const saved = profile.orderNotices?.[kind];
  return new Set(Array.isArray(saved) ? saved : []);
}
function saveOrderNoticeIds(kind, values) {
  profile.orderNotices[kind] = [...values]
    .filter(id => typeof id === 'string').slice(-LOCAL_ORDER_LIMIT * 2);
  saveJSON(PROFILE_KEY, profile);
}

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
  showAllergens: loadJSON(ALLERGEN_VISIBILITY_KEY, false) === true,
  orderSubmitting: false,
  orderSendFailed: false,
  pendingOrderId: null,
  pendingOrderFingerprint: '',
  focusedOrderId: '',
};

/** Åpent produkt i sheet. */
let draft = null;
let bonusState = null;
let bonusLoading = false;
let choosingBonus = false;
let cartBonusLoading = false;
let cartBonusFetchedAt = 0;
/** Hindrer at scroll-spy overstyrer mens vi scroller programmatisk. */
let spyLocked = false;
let spyLockTimer = null;

function persistProfile() {
  // theme.js shares this key: retain the freshest UI theme even when the
  // customer module was initialized before a dark-mode toggle.
  const stored = loadJSON(PROFILE_KEY, {});
  if (stored && (stored.theme === 'light' || stored.theme === 'dark'))
    profile.theme = stored.theme;
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
  allergenVisibilityToggle: $('allergenVisibilityToggle'),
  openStatus: $('openStatus'),
  openDot: $('openDot'),
  closedBanner: $('closedBanner'),
  closedTitle: $('closedTitle'),
  closedText: $('closedText'),
  btnBack: $('btnBack'),
  profileThemeToggle: $('profileThemeToggle'),
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
  cartHeaderActions: $('cartHeaderActions'),
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
  custEmail: $('custEmail'),
  errEmail: $('errEmail'),
  errName: $('errName'),
  errPhone: $('errPhone'),
  timeGrid: $('timeGrid'),
  pickupChoices: $('pickupChoices'),
  pickupHint: $('pickupHint'),
  errTime: $('errTime'),
  reviewCard: $('reviewCard'),
  btnStepBack: $('btnStepBack'),
  btnStepNext: $('btnStepNext'),
  profileHome: $('profileHome'),
  profileDetail: $('profileDetail'),
  profileHeroAvatar: $('profileHeroAvatar'),
  profileHeroName: $('profileHeroName'),
  profileHeroPhone: $('profileHeroPhone'),
  profileContactMeta: $('profileContactMeta'),
  profileOrdersMeta: $('profileOrdersMeta'),
  profilePanelTitle: $('profilePanelTitle'),
  profileContactHelp: $('profileContactHelp'),
  profName: $('profName'),
  profPhone: $('profPhone'),
  profEmail: $('profEmail'),
  errProfName: $('errProfName'),
  errProfPhone: $('errProfPhone'),
  errProfEmail: $('errProfEmail'),
  btnSaveProfile: $('btnSaveProfile'),
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
  return (section.items || []).filter((item) => {
    if (item.hidden) return false;
    if (!query) return true;
    const sizeLabels = (item.sizes || []).map((size) => size.label).join(' ');
    const optionLabels = getItemOptionGroups(item, '*')
      .flatMap((group) => [group.title, ...(group.options || []).map((option) => option.label)])
      .join(' ');
    const searchText = [
      item.name,
      item.description,
      item.ingredients,
      section.title,
      section.note,
      sizeLabels,
      optionLabels,
      allergenLabels(item).join(' '),
    ].filter(Boolean).join(' ').toLocaleLowerCase('no');
    return searchText.includes(query);
  });
}

const ALLERGEN_ICONS = { 'Hvete / gluten': '🌾', Melk: '🥛', Egg: '🥚', Soya: '🌱', Selleri: '🌿', Sennep: '🟡', Sesam: '⚪', Fisk: '🐟', Skalldyr: '🦐', Peanøtter: '🥜', Nøtter: '🌰', Sulfitter: '🍷' };

function renderAllergenVisibilityControl() {
  if (!el.allergenVisibilityToggle) return;
  el.allergenVisibilityToggle.checked = Boolean(ui.showAllergens);
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
  // Network reads and SSE messages can finish out of order. Never let an
  // older "mottatt" snapshot replace an already confirmed order locally.
  if (Number(previous.statusUpdatedAt || 0) > Number(incoming.statusUpdatedAt || 0)) {
    for (const key of ['status', 'statusUpdatedAt', 'staffReadyAt', 'rejectionCode',
      'rejectionReason', 'rejectionMessage', 'estimatedMinutes', 'estimatedAt',
      'estimatedReadyAt', 'estimateUpdatedAt', 'loyaltyConfirmedAt']) {
      if (Object.prototype.hasOwnProperty.call(previous, key)) next[key] = previous[key];
    }
  }
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

// The order history shown here exists only when Firebase currently has it.
// Memory protects status from out-of-order replies within this page session.
function mergedCustomerOrders() {
  const active=getOrders().filter(order=>order?.id);
  const activeIds=new Set(active.map(order=>order.id));
  for(const id of stableCustomerOrderSnapshots.keys()){
    if(!activeIds.has(id))stableCustomerOrderSnapshots.delete(id);
  }
  return active.map(order=>rememberCustomerOrder(order))
    .sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
}

function readySeenIds() {
  return orderNoticeIds('readySeen');
}

function markReadySeen(orderId) {
  if (!orderId) return;
  const seen = readySeenIds();
  seen.add(orderId);
  saveOrderNoticeIds('readySeen', seen);
}

function rejectedSeenIds() {
  return orderNoticeIds('rejectedSeen');
}

function markRejectedSeen(orderId) {
  if (!orderId) return;
  const seen = rejectedSeenIds();
  seen.add(orderId);
  saveOrderNoticeIds('rejectedSeen', seen);
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
    // The likely-ready message is only a visual hint. Hide the customer card
    // five minutes after the estimated pickup time, without changing Firebase
    // order status or triggering any "ready" SMS/e-mail.
    if (isEstimatedPickupTimeReached(order) &&
        Date.now() - Number(order.estimatedReadyAt) >= 5 * 60 * 1000) return false;
    const createdAt = Number(order.createdAt) || 0;
    return !createdAt || createdAt >= cutoff;
  });
}


function isEstimatedPickupTimeReached(order) {
  return ['bekreftet', 'tilberedning'].includes(order?.status) && Number(order?.estimatedReadyAt) > 0 && Number(order.estimatedReadyAt) <= Date.now();
}

function customerOrderCountdown(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return 'Sannsynligvis klar for henting';
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function activeOrderCardHtml(order) {
  const rejectedNow = order.status === 'avvist';
  const readyNow = order.status === 'klar';
  const estimatedReadyNow = !readyNow && isEstimatedPickupTimeReached(order);
  const confirmedNow = ['bekreftet', 'tilberedning'].includes(order.status);
  // Visually reach "Klar" when estimated pickup time has passed, without
  // changing the saved order status or implying staff confirmed readiness.
  const progressStatus = estimatedReadyNow
    ? 'klar'
    : (order.status === 'tilberedning' ? 'bekreftet' : order.status);
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
    } else if (estimatedReadyNow) {
      statusPanel = `<div class="active-order-status-box is-confirmed is-text"><div><strong>Maten din er sannsynligvis klar for henting.</strong><small>Estimert hentetid er passert.</small></div></div>`;
    } else if (hasLiveEstimate) {
      statusPanel = `
        <div class="active-order-status-box is-confirmed">
          <span class="active-order-status-label">Estimert hentetid om</span>
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

  return `<section class="active-order-card${readyNow ? ' is-ready' : ''}${estimatedReadyNow ? ' is-estimated-ready' : ''}${rejectedNow ? ' is-rejected' : ''}" data-active-order-card="${escapeHtml(order.id)}" aria-label="Aktiv bestilling">
    <div class="active-order-head">
      <div><span class="active-order-kicker">${rejectedNow ? 'BESTILLING' : 'Aktiv bestilling'}</span>${rejectedNow ? `<strong class="active-order-live-status">${order.rejectionCode === 'confirmation_timeout' ? 'Avbrutt' : 'Avvist'}</strong>` : ''}</div>
      <div class="active-order-head-actions"><span class="active-order-number">#${escapeHtml(shortId)}</span>${readyNow ? `<button class="active-order-dismiss" data-ready-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk klar-meldingen">×</button>` : ''}${rejectedNow ? `<button class="active-order-dismiss" data-rejected-dismiss="${escapeHtml(order.id)}" type="button" aria-label="Lukk avvisningsmeldingen">×</button>` : ''}</div>
    </div>
    ${!rejectedNow ? `<div class="order-progress" aria-label="${estimatedReadyNow ? 'Estimert klar for henting, ikke bekreftet av restauranten' : 'Bestillingsstatus'}">${progress}</div>` : ''}
    ${statusPanel}
    ${rejectedNow ? `<div class="active-order-rejected-callout"><span class="rejected-mark">×</span><div><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionDetail ? `<small>${escapeHtml(rejectionDetail)}</small>` : ''}</div></div>` : ''}
    <button class="active-order-open" data-active-orders="${escapeHtml(order.id)}" type="button">Se bestillingen</button>
  </section>`;
}

// The shared data layer streams /orders.json via Firebase SSE.
// Do not create another SSE connection and a 5-second fetch loop per order.
const activeOrderFetchBusy = new Set();
const initialActiveOrderChecks = new Set();
const readyDismissTimers = new Map();

function upsertLiveOrder(orderId, remote) {
  if (!remote || !orderId) return;
  const latest = (store.orders || []).find(entry => entry?.id === orderId)
    || stableCustomerOrderSnapshots.get(orderId);
  // Discard an older REST response BEFORE touching the persistent snapshot.
  if (latest && Number(latest.statusUpdatedAt || 0) > Number(remote.statusUpdatedAt || 0)) return;
  const normalized = rememberCustomerOrder({ ...remote, id: remote.id || orderId });


  const orders = Array.isArray(store.orders) ? [...store.orders] : [];
  const index = orders.findIndex((entry) => entry?.id === orderId);
  if (index >= 0) {
    const previous = orders[index] || {};
    // A one-off HTTP response might arrive after a newer live SSE patch.
    // Never put a stale status or pickup-time estimate back on the screen.
    if (Number(previous.statusUpdatedAt) > Number(normalized.statusUpdatedAt) ||
        Number(previous.estimateUpdatedAt) > Number(normalized.estimateUpdatedAt)) return;
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
    const response = await fetch(DB_URL + '/orders/' + encodeURIComponent(orderId) + '.json?ts=' + Date.now(), {
      cache: 'no-store', headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote) return;
    upsertLiveOrder(orderId, remote);
    renderActiveOrders();
    if (ui.view === 'profile') renderProfile();
    // React as soon as Firebase confirms, not only on the one-second tick.
    if (orderConfirmOrderId === orderId && !orderConfirmResolved && !el.confirmModal.hidden) {
      checkOrderConfirmationWait();
    }
  } catch (_) {
  } finally {
    activeOrderFetchBusy.delete(orderId);
  }
}

function syncActiveOrderWatchers(orderIds) {
  const wanted = new Set(orderIds.filter(Boolean).slice(0, 8));
  for (const id of initialActiveOrderChecks) if (!wanted.has(id)) initialActiveOrderChecks.delete(id);
  for (const id of wanted) {
    if (initialActiveOrderChecks.has(id)) continue;
    initialActiveOrderChecks.add(id);
    // One targeted read when an active order first appears; after that the
    // shared SSE updates store.orders immediately with no periodic GET.
    void fetchActiveOrderNow(id);
  }
}

function refreshCustomerOrderCountdowns() {
  const visibleOrders = activeCustomerOrders();
  const visibleIds = new Set(visibleOrders.map((order) => order.id));
  if (document.querySelector('[data-active-order-card]') && [...document.querySelectorAll('[data-active-order-card]')].some((node) => !visibleIds.has(node.dataset.activeOrderCard))) {
    renderActiveOrders();
    return;
  }
  const byId = new Map(visibleOrders.map((order) => [order.id, order]));
  document.querySelectorAll('[data-customer-countdown]').forEach((node) => {
    const order = byId.get(node.dataset.customerCountdown);
    if (!order) return;
    const countdown = customerOrderCountdown(order);
    if (isEstimatedPickupTimeReached(order)) {
      renderActiveOrders();
      return;
    } else {
      node.textContent = countdown || '';
    }
  });

  // Time passing never changes status. Only staff can confirm the food is ready.
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
  const notified = orderNoticeIds('notified');
  let changed = false;
  for (const order of orders) {
    if (order.status !== 'klar' || notified.has(order.id)) continue;
    notified.add(order.id);
    changed = true;
    toast('✓ Maten din er klar – kom og hent nå.');
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(store.settings.restaurantName || 'Bestill', { body: 'Maten din er klar – kom og hent nå.' });
      } catch (_) {}
    }
  }
  if (changed) saveOrderNoticeIds('notified', notified);
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

// Keep the selection across live refreshes; enforce one expanded order even
// on browsers without native named-details grouping.
document.addEventListener('toggle', event => {
  const card = event.target;
  if (!(card instanceof HTMLDetailsElement) || !card.isConnected || !card.matches('.order-history-card[data-order-card-id]')) return;
  if (card.open) {
    ui.focusedOrderId = card.dataset.orderCardId;
    document.querySelectorAll('.order-history-card[open]').forEach(other => { if (other !== card) other.open = false; });
  } else if (ui.focusedOrderId === card.dataset.orderCardId) {
    ui.focusedOrderId = '';
  }
}, true);

function openActiveOrderInProfile(orderId) {
  if (!orderId) return;
  ui.focusedOrderId = orderId;
  setView('profile');
  setProfileTab('orders');
}

/** Open the exact order linked from the SMS, even on a different device
 * with no previous customer LocalStorage. Full order IDs are bearer links.
 */
async function openOrderFromSmsLink() {
  const raw = new URLSearchParams(window.location.search).get('order');
  if (raw === null) return;
  const orderId = String(raw).trim();
  if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(orderId)) {
    toast('Ugyldig bestillingslenke.', 'warning');
    return;
  }
  try {
    const response = await fetch(
      DB_URL + '/orders/' + encodeURIComponent(orderId) + '.json',
      { cache: 'no-store', headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error('Kunne ikke hente bestillingen.');
    const order = await response.json();
    if (!order || (order.id && order.id !== orderId)) {
      toast('Bestillingen finnes ikke lenger.', 'warning');
      return;
    }
    // Reuse the existing order snapshot pipeline and live Firebase tracking.
    upsertLiveOrder(orderId, { ...order, id: orderId });
    openActiveOrderInProfile(orderId);
  } catch (error) {
    console.warn('SMS bestillingslenke kunne ikke åpnes:', error);
    toast('Kunne ikke hente bestillingen. Sjekk tilkoblingen og prøv igjen.', 'warning');
  }
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

/* iPhone Safari: keyboard changes the visual viewport without always resizing
 * 100dvh. Keep checkout's inner scroll area in the visible portion, and allow
 * native Safari focus scrolling instead of issuing competing scrollIntoView calls. */
function setupIOSContactKeyboard() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  const root = document.documentElement;
  const isContactField = (node) => node instanceof HTMLElement
    && node.matches('#profName, #profPhone, #custName, #custPhone');
  let frame = 0;

  function updateVisibleHeight() {
    if (!root.classList.contains('ios-contact-keyboard-open')) return;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!root.classList.contains('ios-contact-keyboard-open')) return;
      const viewport = window.visualViewport;
      if (viewport && viewport.height > 0) {
        root.style.setProperty('--ios-contact-viewport', `${Math.round(viewport.height)}px`);
      }
    });
  }

  document.addEventListener('focusin', (event) => {
    if (!isContactField(event.target)) return;
    root.classList.add('ios-contact-keyboard-open');
    updateVisibleHeight();
  });
  document.addEventListener('focusout', (event) => {
    if (!isContactField(event.target)) return;
    // A focus switch between the name and phone fields must not flicker the layout.
    window.setTimeout(() => {
      if (isContactField(document.activeElement)) return;
      root.classList.remove('ios-contact-keyboard-open');
      root.style.removeProperty('--ios-contact-viewport');
    }, 100);
  });
  window.visualViewport?.addEventListener('resize', updateVisibleHeight);
  window.addEventListener('orientationchange', updateVisibleHeight);
}

setupIOSContactKeyboard();

// The menu scrolls inside main on mouse devices and in the page on touch devices.
function pageScrollTarget() {
  const main = document.getElementById('main');
  return main && getComputedStyle(main).overflowY === 'auto' ? main : window;
}

function scrollPage(options) {
  pageScrollTarget().scrollTo(options);
}

function setView(view) {
  ui.view = view;
  for (const [name, node] of Object.entries(el.views)) {
    node.hidden = name !== view;
  }
  el.catBar.hidden = view !== 'menu';
  el.btnBack.hidden = view === 'menu';
  for (const [button, active] of [[el.btnProfile, view === 'profile'], [el.btnCart, view === 'cart' || view === 'checkout']]) {
    button.classList.toggle('is-on', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (view === 'menu') el.brandHome.setAttribute('aria-current', 'page');
  else el.brandHome.removeAttribute('aria-current');
  scrollPage({ top: 0 });
  renderActiveOrders();
  if (view === 'cart') renderCart();
  if (view === 'checkout') renderCheckout();
  if (view === 'profile') {
    showProfileHome();
    renderProfile();
  }
}

/* ------------------------------------------------------------------ *
 * Kategoribar: horisontal scroll + scroll-spy
 * ------------------------------------------------------------------ */

function categoryIcon(block) {
  const title = String(block?.title || '').toLocaleLowerCase('no');
  const icons = {
    favorites: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    popular: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    pizza: '<path d="M5 3c5-1 10 1 14 5L5 21Z M5 7c4-1 7 1 11 4"/><circle cx="8" cy="10" r="1"/><circle cx="11" cy="13" r="1"/><circle cx="7" cy="16" r="1"/>',
    kebab: '<path d="m6 8 7 13 8-7L8 5Z M6 8l-2-3 4-3 3 3 M12 8l4-4m-1 7 5-3M9 12l3-3m0 8 3-3"/>',
    burger: '<path d="M4 10a8 8 0 0 1 16 0Z M3 13h18M4 16h16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z M8 7h.01M12 5h.01M16 7h.01"/>',
    drink: '<path d="M6 7h12l-2 14H8Z M5 7h14M12 7l2-5h4"/>',
    children: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
    vegetarian: '<path d="M20 3C9 2 4 6 5 13c1 5 7 6 11 2 3-3 4-7 4-12Z M4 21 16 8M9 16v-5m0 5h5"/>',
    meal: '<circle cx="14" cy="12" r="7"/><path d="M2 3v5a2 2 0 0 0 4 0V3M4 3v18M22 3v18"/>',
  };
  const key = block?.key === 'favorites' ? 'favorites' : block?.key === 'popular' ? 'popular'
    : title.includes('pizza') ? 'pizza' : title.includes('kebab') ? 'kebab'
    : title.includes('burger') ? 'burger' : title.includes('drikk') ? 'drink'
    : title.includes('barn') ? 'children' : title.includes('veget') ? 'vegetarian' : 'meal';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[key]}</svg>`;
}

function renderCategories() {
  const blocks = menuBlocks();
  if (!blocks.some((block) => block.key === ui.activeCategory)) {
    ui.activeCategory = blocks.length ? blocks[0].key : '';
  }
  const searchControl = ui.searchOpen
    ? `<label class="tab-search" aria-label="Søk i menyen"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg><input id="menuSearch" type="search" placeholder="Søk pizza, kebab, kylling…" value="${escapeHtml(ui.search)}"><button id="closeMenuSearch" type="button" aria-label="Lukk søk">×</button></label>`
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
  const target = pageScrollTarget();
  const top = target === window
    ? block.getBoundingClientRect().top + window.scrollY - headerOffset() - 8
    : block.getBoundingClientRect().top - target.getBoundingClientRect().top + target.scrollTop - 8;
  target.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  setActiveCategory(key);
}

/** Finner blokken som er i toppen av synlig område. */
function spyActiveCategory() {
  if (ui.view !== 'menu' || spyLocked) return;
  const blocks = Array.from(el.menuList.querySelectorAll('[data-block]'));
  if (!blocks.length) return;
  const target = pageScrollTarget();
  const line = (target === window ? headerOffset() : target.getBoundingClientRect().top) + 24;

  // Nederst på siden: siste kategori er aktiv.
  const atBottom = target === window
    ? window.innerHeight + window.scrollY >= document.body.scrollHeight - 24
    : target.clientHeight + target.scrollTop >= target.scrollHeight - 24;
  if (atBottom) {
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
document.getElementById('main')?.addEventListener('scroll', spyActiveCategory, { passive: true });
window.addEventListener('resize', () => centerActiveTab(false));

/* ------------------------------------------------------------------ *
 * Rendering: meny
 * ------------------------------------------------------------------ */

function productCartQuantity(itemId) {
  return cart.reduce(
    (sum, line) => sum + (line.itemId === itemId ? Number(line.quantity) || 0 : 0),
    0
  );
}

function productCartBadgeHtml(itemId) {
  const quantity = productCartQuantity(itemId);
  return quantity > 0
    ? `<span class="prod-cart-badge" aria-label="${quantity} i kurven"><span aria-hidden="true">✓</span> ${quantity} i kurven</span>`
    : '';
}

function refreshProductCartBadges() {
  if (!el.menuList) return;
  el.menuList.querySelectorAll('.prod-card[data-item]').forEach((card) => {
    const media = card.querySelector('.prod-media');
    if (!media) return;
    const quantity = productCartQuantity(card.dataset.item);
    let badge = media.querySelector('.prod-cart-badge');
    if (quantity <= 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'prod-cart-badge';
      media.appendChild(badge);
    }
    badge.setAttribute('aria-label', `${quantity} i kurven`);
    badge.innerHTML = `<span aria-hidden="true">✓</span> ${quantity} i kurven`;
  });
}

function productCardHtml(item, section) {
  const soldOut = item.soldOut;
  const price = getItemBasePrice(item);
  const multi = (item.sizes || []).length > 1;
  const ingredientCustomizationEnabled = store.settings?.ingredientCustomizationEnabled !== false;
  const needsChoice =
    multi ||
    getItemOptionGroups(item).length > 0 ||
    (ingredientCustomizationEnabled &&
      getItemIngredientRules(item).some((rule) => rule.removable));
  const desc = item.description || item.ingredients || section.note || '';
  const cardAllergens = ui.showAllergens ? allergenLabels(item) : [];
  return `
    <div class="prod-card${soldOut ? ' is-soldout' : ''}" data-item="${escapeHtml(item.id)}">
      <div class="prod-media">
        ${
          item.imageUrl
            ? `<img class="prod-thumb" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`
            : '<span class="prod-thumb prod-thumb-empty" aria-hidden="true"></span>'
        }
        ${productCartBadgeHtml(item.id)}
      </div>
      <div class="prod-info">
        <p class="prod-name">
          ${escapeHtml(item.name)}
          ${soldOut ? '<span class="tag tag-soldout">Utsolgt</span>' : ''}
        </p>
        <p class="prod-desc">${escapeHtml(desc)}</p>
        ${cardAllergens.length ? `<p class="prod-list-allergens">Inneholder ${escapeHtml(cardAllergens.join(', '))}</p>` : ''}
      </div>
      <div class="prod-side">
        ${soldOut
          ? '<span class="prod-soldout-badge">Utsolgt</span>'
          : needsChoice
            ? `<button class="add-btn is-select" data-open="${escapeHtml(item.id)}" type="button" aria-label="Velg og legg til ${escapeHtml(item.name)}">+</button>`
            : `<button class="add-btn" data-quick-add="${escapeHtml(item.id)}" type="button" aria-label="Legg ${escapeHtml(item.name)} i kurven">+</button>`}
        <p class="prod-price">${multi ? '<small>fra </small>' : ''}${formatPrice(price)}</p>
      </div>
    </div>`;
}

function renderMenu() {
  const blocks = menuBlocks();
  const specialBlockLimit = 4;
  if (!blocks.length) {
    el.menuList.innerHTML = ui.search.trim()
      ? '<div class="empty-note"><strong>Ingen treff</strong>Prøv et annet søkeord.</div>'
      : '<div class="empty-note"><strong>Menyen er tom</strong>Kom tilbake litt senere.</div>';
    return;
  }
  el.menuList.innerHTML = blocks
    .map(
      (block) => {
      const collapsible = block.key === 'favorites' || block.key === 'popular';
      const expanded = collapsible && ui.expandedBlocks.has(block.key);
      const visibleCount = collapsible && !expanded
        ? Math.min(specialBlockLimit, block.items.length)
        : block.items.length;
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
        ${collapsible && block.items.length > specialBlockLimit ? `<button class="show-more" data-toggle-block="${escapeHtml(block.key)}" type="button" aria-expanded="${expanded}">${expanded ? 'Vis mindre' : `Vis mer (${block.items.length - specialBlockLimit})`}</button>` : ''}
      </section>`;
      }
    )
    .join('');
}

/** Åpen/stengt-status øverst i menyen. */
let customerMenuReady = false;
function renderOpenState() {
  // Until the first Firebase menu/settings response is resolved, default
  // settings must never be presented as the restaurant's real opening hours.
  if (!customerMenuReady || backendInfo.mode !== 'firebase') {
    el.openStatus.textContent = customerMenuReady
      ? 'Åpningstider utilgjengelige' : 'Henter åpningstider…';
    document.getElementById('pickupDetails').textContent = customerMenuReady
      ? 'Prøv igjen når forbindelsen er tilbake' : 'Vennligst vent';
    // Ikke vis en rød «stengt»-indikator før åpningstidene er verifisert.
    el.openDot.classList.remove('is-closed');
    el.openDot.classList.add('is-pending');
    el.closedBanner.hidden = true;
    el.btnToCheckout.disabled = true;
    el.cartClosedHint.hidden = true;
    return {open:false,pending:true};
  }
  const state = getOpenState();
  const settings = store.settings || {};
  el.openDot.classList.remove('is-pending');
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
    const valid = new Set((group.options || []).filter(opt=>!opt.soldOut).map((opt) => opt.id));
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
    toast('Produktet er utsolgt akkurat nå.', 'warning');
    return;
  }
  const defaultSize = getDefaultSize(item);
  draft = {
    itemId: item.id,
    loyaltyAuto: Boolean(editLine?.loyaltyAuto),
    loyaltyFree: Boolean(editLine?.loyaltyFree),
    loyaltyCycle: editLine?.loyaltyCycle || null,
    sizeId: editLine ? editLine.sizeId : defaultSize ? defaultSize.id : null,
    selections: editLine
      ? JSON.parse(JSON.stringify(editLine.selections))
      : defaultSelectionFor(item),
    comment: editLine ? getDisplayComment(editLine) : '',
    removedIngredients: editLine && Array.isArray(editLine.removedIngredients)
      ? [...editLine.removedIngredients]
      : [],
    ingredientsOpen: Boolean(editLine && Array.isArray(editLine.removedIngredients) && editLine.removedIngredients.length),
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
  if (choosingBonus && !editLine && bonusState?.ready && !bonusState.pending && !cart.some(line => line.loyaltyFree)) {
    const { section } = findItem(itemId);
    const large = item.sizes.find(size => largePizza(section, size));
    if (large) { draft.loyaltyFree = true; draft.loyaltyCycle = bonusState.cycle; draft.sizeId = large.id; }
  }
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

  for (const group of getItemOptionGroups(item, draft.sizeId)) {
    const picked = draft.selections[group.id] || [];
    if (group.required && new Set(picked).size < (group.minSelections || 1)) {
      problems.add(group.id);
      if (!message) message = `Velg i «${group.title}» for å fortsette.`;
    }
    if (group.selectionMode === 'multiple' &&
        (group.allowQuantity ? picked.length : new Set(picked).size) > group.maxSelections) {
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
  return bonusLinePrice(item, draft, optionIds, draft.quantity);
}

function optionGroupHtml(group, problems) {
  const picked = draft.selections[group.id] || [];
  const isMulti = group.selectionMode === 'multiple';
  const servingMode = isMulti && Boolean(group.allowQuantity);
  const selectedCount = servingMode ? picked.length : new Set(picked).size;
  const maxCount = Math.max(1,Math.min(30,Number(group.maxSelections)||1));
  const atMax = isMulti && selectedCount >= maxCount;
  const badges = `<span class="opt-guidance">${group.required ? 'Påkrevd' : 'Valgfritt'}</span>${
    servingMode ? `<span class="opt-guidance opt-serving-limit">Maks ${maxCount} stk · ${selectedCount} valgt</span>` : ''
  }`;

  const rows = (group.options || [])
    .filter((option) => option.label)
    .map((option) => {
      const count = picked.filter(id => id === option.id).length;
      const checked = count > 0;
      const blocked = option.soldOut || (atMax && !checked);
      return `
        <label class="opt-row${checked ? ' is-checked' : ''}${blocked ? ' is-blocked' : ''}${servingMode ? ' is-serving' : ''}">
          <input type="${isMulti ? 'checkbox' : 'radio'}" name="grp_${escapeHtml(group.id)}"
                 data-group="${escapeHtml(group.id)}" data-option="${escapeHtml(option.id)}"
                 ${checked ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
          <span class="opt-label">${escapeHtml(option.label)}</span>
          <span class="opt-price">${option.price > 0 ? `+${formatPrice(option.price)} / stk` : 'Inkludert'}</span>
          ${servingMode ? `<span class="option-quantity" role="group" aria-label="Antall ${escapeHtml(option.label)}">
            <button type="button" data-addon-quantity="-1" data-addon-group="${escapeHtml(group.id)}" data-addon-option="${escapeHtml(option.id)}" aria-label="Færre ${escapeHtml(option.label)}" ${count === 0 || option.soldOut ? 'disabled' : ''}>−</button>
            <b aria-live="polite">${count}</b>
            <button type="button" data-addon-quantity="1" data-addon-group="${escapeHtml(group.id)}" data-addon-option="${escapeHtml(option.id)}" aria-label="Flere ${escapeHtml(option.label)}" ${atMax || option.soldOut ? 'disabled' : ''}>+</button>
          </span>` : ''}
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

  const groups = getItemOptionGroups(item, draft.sizeId);
  const activeGroups = new Set(groups.map(group=>group.id));
  for (const id of Object.keys(draft.selections)) if (!activeGroups.has(id)) delete draft.selections[id];
  for (const group of groups) if (!Array.isArray(draft.selections[group.id])) draft.selections[group.id] = [...(group.defaultOptionIds || [])];
  const { problems, message } = validateDraft();
  const allergens = allergenLabels(item);
  const ingredientCustomizationEnabled =
    store.settings?.ingredientCustomizationEnabled !== false;
  const removableIngredients = ingredientCustomizationEnabled
    ? getItemIngredientRules(item).filter((rule) => rule.removable)
    : [];
  if (!ingredientCustomizationEnabled) {
    draft.removedIngredients = [];
    draft.ingredientsOpen = false;
  }
  const removedSet = new Set((draft.removedIngredients || []).map((name) => String(name).toLocaleLowerCase('no')));
  const removedNames = removableIngredients
    .filter((rule) => removedSet.has(rule.name.toLocaleLowerCase('no')))
    .map((rule) => rule.name);
  draft.removedIngredients = removedNames;
  const ingredientCustomizeHtml = removableIngredients.length
    ? `
      <div class="ingredient-customize${draft.ingredientsOpen ? ' is-open' : ''}">
        <button class="ingredient-customize-toggle" data-toggle-ingredients type="button" aria-expanded="${draft.ingredientsOpen}">
          <span class="ingredient-customize-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--palette-surface)"/><circle cx="15" cy="17" r="2.5" fill="var(--palette-surface)"/></svg></span>
          <span class="ingredient-customize-copy">
            <strong>Tilpass ingredienser</strong>
            <small>${removedNames.length ? `Uten: ${escapeHtml(removedNames.join(', '))}` : 'Ingen endringer'}</small>
          </span>
          <i aria-hidden="true">›</i>
        </button>
        <div class="ingredient-customize-body"${draft.ingredientsOpen ? '' : ' hidden'}>
          <div class="ingredient-customize-head">
            <strong>Ingredienser</strong>
            <span>Trykk for å fjerne</span>
          </div>
          <div class="ingredient-chip-list">
            ${removableIngredients.map((rule) => {
              const removed = removedSet.has(rule.name.toLocaleLowerCase('no'));
              return `<button class="ingredient-chip${removed ? ' is-removed' : ''}" data-remove-ingredient="${escapeHtml(rule.name)}" type="button" aria-pressed="${removed}">
                <span aria-hidden="true">${removed ? '−' : '✓'}</span>${escapeHtml(rule.name)}
              </button>`;
            }).join('')}
          </div>
          <p class="ingredient-customize-help">Fjernede ingredienser kan legges tilbake med ett trykk.</p>
        </div>
      </div>`
    : '';

  const sizeHtml =
    (item.sizes || []).length > 0
      ? `
      <div class="opt-group opt-group--size">
        <div class="opt-head">
          <h3 class="opt-title">Størrelse</h3>
          <span class="opt-guidance">Påkrevd</span>
          ${(item.sizes || []).find(size => size.id === draft.sizeId)
            ? `<span class="opt-selected-size"><span class="opt-selected-check" aria-hidden="true">✓</span>${escapeHtml((item.sizes || []).find(size => size.id === draft.sizeId).label)}</span>`
            : ''}
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
    ${item.description || item.ingredients ? `<p class="sheet-desc">${escapeHtml(item.description || item.ingredients)}</p>` : ''}
    ${ingredientCustomizeHtml}
    ${sizeHtml}
    ${groups.map((group) => optionGroupHtml(group, problems)).join('')}
    <div class="opt-group opt-group--comment">
      <div class="opt-head"><h3 class="opt-title">Kommentar til kjøkkenet</h3></div>
      <textarea class="comment-area" id="draftComment" placeholder="F.eks. godt stekt, saus ved siden av…">${escapeHtml(
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
    </div>
`;

  if (draft.loyaltyFree && !draft.loyaltyAuto) {
    draft.quantity = 1;
    el.sheetBody.querySelectorAll('[data-size]').forEach(input => { input.disabled = input.dataset.size !== draft.sizeId; });
  }
  el.qtyPlus.disabled = Boolean(draft.loyaltyFree && !draft.loyaltyAuto);
  el.qtyMinus.disabled = Boolean(draft.loyaltyFree && !draft.loyaltyAuto);
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

function lineSignature(itemId, sizeId, selections, comment, removedIngredients = []) {
  const optionIds = Object.values(selections).flat().slice().sort().join(',');
  const removed = (removedIngredients || [])
    .map((name) => String(name || '').trim().toLocaleLowerCase('no'))
    .filter(Boolean)
    .sort()
    .join(',');
  return `${itemId}|${sizeId}|${optionIds}|${removed}|${(comment || '').trim().toLowerCase()}`;
}

function addDraftToCart() {
  if (!draft) return;
  const { item } = findItem(draft.itemId);
  if (!item) return;
  const commentField = document.getElementById('draftComment');
  if (commentField) draft.comment = commentField.value.trim();

  if (draft.loyaltyFree && cart.some(line => line.loyaltyFree && line.lineId !== draft.editingLineId)) { toast('Du har allerede en gratis pizza i kurven.', 'warning'); return; }
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
    draft.comment,
    draft.removedIngredients
  );

  if (draft.editingLineId) {
    cart = cart.filter((line) => line.lineId !== draft.editingLineId);
  }

  const existing = cart.find((line) => line.signature === signature && Boolean(line.loyaltyFree) === Boolean(draft?.loyaltyFree));
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
      removedIngredients: [...(draft.removedIngredients || [])],
      loyaltyAuto: Boolean(draft.loyaltyAuto),
      loyaltyFree: Boolean(draft.loyaltyFree),
      loyaltyCycle: draft.loyaltyCycle || null,
      quantity: draft.loyaltyFree && !draft.loyaltyAuto ? 1 : draft.quantity,
    });
  }

  if (draft.loyaltyFree) choosingBonus = false;
  resetPendingOrderSubmission();
  persistCart();
  toast(
    draft.editingLineId ? 'Handlekurven er oppdatert.' : `${item.name} lagt i kurven.`
  );
  closeSheet();
  renderCartCount();
  if (ui.view === 'cart') renderCart();
  if (ui.view === 'checkout') renderCheckout();
}

function quickAddProduct(itemId) {
  if (choosingBonus) { openProduct(itemId); return; }
  const { item } = findItem(itemId);
  if (!item || item.hidden || item.soldOut) return;
  const sizes = item.sizes || [];
  const groups = getItemOptionGroups(item);
  const hasIngredientChoices = getItemIngredientRules(item).some((rule) => rule.removable);
  if (sizes.length > 1 || groups.length > 0 || hasIngredientChoices) {
    openProduct(itemId);
    return;
  }

  const size = getDefaultSize(item);
  const sizeId = size ? size.id : null;
  const selections = {};
  const signature = lineSignature(item.id, sizeId, selections, '', []);
  const existing = cart.find((line) => line.signature === signature && (!line.loyaltyFree || line.loyaltyAuto));
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      lineId: uid('ln'),
      signature,
      itemId: item.id,
      sizeId,
      selections,
      comment: '',
      removedIngredients: [],
      quantity: 1,
    });
  }

  resetPendingOrderSubmission();
  persistCart();
  renderCartCount();
  if (ui.view === 'cart') renderCart();
  if (ui.view === 'checkout') renderCheckout();
  toast(`${item.name} lagt i kurven.`);
}

/** Fjerner kurvlinjer som ikke lenger er gyldige (skjult/utsolgt/slettet). */
function reconcileCart() {
  let changed = false;
  const kept = [];
  let hasReward = false;
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
    if (line.loyaltyFree) {
      const { section } = findItem(line.itemId);
      const size = item.sizes.find(size => size.id === line.sizeId);
      if (hasReward || !largePizza(section, size)) { changed = true; continue; }
      hasReward = true;
      if (!line.loyaltyAuto && line.quantity !== 1) { line.quantity = 1; changed = true; }
    }
    const groups = getItemOptionGroups(item, line.sizeId);
    const groupIds = new Set(groups.map((group) => group.id));
    for (const key of Object.keys(line.selections || {})) {
      if (!groupIds.has(key)) {
        delete line.selections[key];
        changed = true;
      }
    }
    for (const group of groups) {
      const valid = new Set((group.options || []).filter(opt=>!opt.soldOut).map((opt) => opt.id));
      const before = line.selections[group.id] || [];
      let after = before.filter((id) => valid.has(id));
      if (group.allowQuantity && group.selectionMode === 'multiple')
        after = after.slice(0,Math.max(1,Math.min(30,Number(group.maxSelections)||1)));
      else after = [...new Set(after)].slice(0, group.selectionMode === 'single' ? 1 : group.maxSelections);
      if (after.length !== before.length || after.some((id,i)=>id!==before[i])) changed = true;
      line.selections[group.id] = after;
    }
    const removableNames = new Set(
      getItemIngredientRules(item)
        .filter((rule) => rule.removable)
        .map((rule) => rule.name.toLocaleLowerCase('no'))
    );
    line.removedIngredients = (Array.isArray(line.removedIngredients) ? line.removedIngredients : [])
      .filter((name) => removableNames.has(String(name).toLocaleLowerCase('no')));
    line.signature = lineSignature(
      line.itemId,
      line.sizeId,
      line.selections,
      line.comment,
      line.removedIngredients
    );
    kept.push(line);
  }
  if (kept.length !== cart.length) changed = true;
  cart = kept;
  if (changed) persistCart();
  return changed;
}

function applyAutomaticPizzaBonus() {
  for (const line of cart) if (line.loyaltyAuto) { line.loyaltyFree = false; line.loyaltyAuto = false; line.loyaltyCycle = null; }
  const phone = loyaltyPhone(el.custPhone.value || profile.phone);
  const state = bonusState?.phone === phone ? bonusState : null;
  if (!state?.consent || state.pending || cart.some(line=>line.loyaltyFree)) return;
  const index = automaticPizzaIndex(cart.map(line=>{
    const {item,section}=findItem(line.itemId);
    return { quantity: line.quantity, eligible: largePizza(section,item?.sizes?.find(size=>size.id===line.sizeId)), basePrice: item ? getSizePrice(item,line.sizeId) : Infinity };
  }),state.count);
  if (index >= 0) Object.assign(cart[index], { loyaltyFree: true, loyaltyAuto: true, loyaltyCycle: state.cycle });
}

function refreshCartPizzaBonus(force = false) {
  const phone = loyaltyPhone(el.custPhone.value || profile.phone);
  if (!phone || cartBonusLoading || (!force && bonusState?.phone === phone && Date.now()-cartBonusFetchedAt<10000)) return;
  cartBonusLoading = true;
  getPizzaBonus(phone).then(state=>{ bonusState=state;cartBonusFetchedAt=Date.now(); applyAutomaticPizzaBonus(); persistCart(); if(ui.view==='cart') renderCart();if(ui.view==='checkout') renderCheckout(); }).catch(()=>{}).finally(()=>{cartBonusLoading=false;});
}

function bonusLinePrice(item, line, optionIds, quantity) {
  const price = computeLinePrice(item, line.sizeId, optionIds, quantity);
  return line.loyaltyFree ? Math.max(0, price - getSizePrice(item, line.sizeId)) : price;
}

function cartSubtotal() {
  return cart.reduce((sum, line) => {
    const { item } = findItem(line.itemId);
    if (!item) return sum;
    const optionIds = Object.values(line.selections || {}).flat();
    return sum + bonusLinePrice(item, line, optionIds, line.quantity);
  }, 0);
}

function cartCount() {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

function productSummaryHtml({name, size, quantity, basePrice, total, rows, lineId = '', free = false}) {
  const id = escapeHtml(lineId);
  const editable = Boolean(lineId);
  const productName = escapeHtml(name);
  const quantityHtml = editable ? `<div class="cart-product-stepper" role="group" aria-label="Antall ${productName}">
    ${quantity > 1 ? `<button class="cart-stepper-minus" data-dec="${id}" type="button" aria-label="Færre">−</button>` : `<button class="cart-stepper-trash" data-remove="${id}" type="button" aria-label="Fjern ${productName}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg></button>`}
    <span>${quantity}</span><button class="cart-stepper-plus" data-inc="${id}" type="button" aria-label="Flere">+</button></div>`
    : `<span class="cart-product-quantity" aria-label="Antall: ${quantity}">${quantity}×</span>`;

  // The gift is one free base pizza in the SAME grouped line; add-ons still
  // cost their normal price. Render one size/price row per unit without
  // altering cart totals, loyalty reservations or order payloads.
  const quantityCount = Math.max(1, Math.floor(Number(quantity) || 1));
  const sizeText = size ? `<b>Størrelse:</b> ${escapeHtml(size)}` : '';
  const visibleUnits = editable ? Math.min(quantityCount, 30) : 1;
  const sizeRows = Array.from({length: visibleUnits}, (_, index) => {
    const isFreeUnit = editable && free && index === 0;
    const price = isFreeUnit
      ? `<del class="cart-free-original-price" aria-label="Gratis pizza, ordinær pris ${escapeHtml(formatPrice(basePrice))}">${formatPrice(basePrice)}</del>`
      : formatPrice(basePrice);
    return `<span class="cart-detail-row cart-product-size${isFreeUnit ? ' is-free-unit' : ''}">
      <span class="cart-detail-left">${sizeText}${isFreeUnit ? ' <span class="cart-gift-size-caption">(gratis pizza)</span>' : ''}</span><b class="cart-detail-price">${price}</b>
    </span>`;
  });
  if (editable && quantityCount > visibleUnits) {
    sizeRows.push(`<span class="cart-detail-row cart-product-size"><span class="cart-detail-left">+ ${quantityCount - visibleUnits} stk ${size ? escapeHtml(size) : ''}</span><b class="cart-detail-price">${formatPrice(basePrice)} / stk</b></span>`);
  }
  if (!editable) {
    // Historic order details retain their original compact one-line summary.
    sizeRows[0] = `<span class="cart-detail-row cart-product-size"><span class="cart-detail-left">${sizeText}</span><b class="cart-detail-price">${free ? '1 gratis pizza' : `${formatPrice(basePrice)}${quantity > 1 ? ' / stk' : ''}`}</b></span>`;
  }

  const editIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 4 4 4-9.4 9.4-4.1 1.1 1.1-4.1L17 5a2.1 2.1 0 0 1 3 3"/></svg>`;
  const heading = editable
    ? `<div class="cart-product-copy cart-product-heading-copy">
         <span class="cart-product-titleline"><strong class="cart-product-name">${productName}</strong></span>
         <button class="cart-product-edit" type="button" data-edit="${id}" aria-label="Endre ${productName}" title="Endre produkt">${editIcon}</button>
       </div>`
    : `<div class="cart-product-copy"><span class="cart-product-titleline"><strong class="cart-product-name">${productName}</strong>${free ? `<span class="bonus-savings cart-product-savings">Du sparer ${formatPrice(basePrice)}</span>` : ''}</span></div>`;
  const giftBanner = editable && free ? `<div class="cart-product-gift-banner">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 9h20M12 9v12M12 9H7.7C4.3 9 4 4 7.4 4c2.6 0 4.6 5 4.6 5ZM12 9h4.3C19.7 9 20 4 16.6 4 14 4 12 9 12 9Z"/></svg>
    <strong>Gratis pizza aktivert</strong><span class="cart-gift-divider" aria-hidden="true"></span>
    <strong class="cart-gift-saving">Du sparer ${formatPrice(basePrice)}</strong>
  </div>` : '';
  const copyTag = editable ? 'button' : 'div';
  const editAttrs = editable ? ` type="button" data-edit="${id}" aria-label="Endre detaljer for ${productName}"` : '';
  // A subtle separator mirrors the reference between unit prices and extras.
  const detailsHtml = sizeRows.join('') +
    (editable && rows.length ? '<span class="cart-detail-section-divider" aria-hidden="true"></span>' : '') +
    rows.join('');
  return `<article class="cart-product-card${editable && free ? ' has-free-pizza' : ''}"${editable ? ` data-line="${id}"` : ''}>
    ${giftBanner}
    <div class="cart-product-heading">${heading}${quantityHtml}</div>
    <${copyTag} class="cart-product-copy cart-product-detailcopy"${editAttrs}><span class="cart-product-details">${detailsHtml}</span></${copyTag}>
    <div class="cart-product-totalrow"><span>Sum</span><strong class="cart-product-total">${formatPrice(total)}</strong></div>
  </article>`;
}

function cartLineHtml(line, editable = true) {
  const { item } = findItem(line.itemId);
  if (!item) return '';

  const size = (item.sizes || []).find((entry) => entry.id === line.sizeId);
  const optionIds = Object.values(line.selections || {}).flat();
  const lineTotal = bonusLinePrice(item, line, optionIds, line.quantity);
  const addons = describeSelection(optionIds);

  const addonGroups = addons.reduce((groups, addon) => {
    const title = String(addon.groupTitle || 'Tilvalg').trim() || 'Tilvalg';
    let group = groups.find((entry) => entry.title === title);
    if (!group) {
      group = { title, labels: [], price: 0 };
      groups.push(group);
    }
    group.labels.push(addon.label);
    group.price += Number(addon.price) || 0;
    return groups;
  }, []);

  const detailRows = [];
  addonGroups.forEach((group) => {
    const title = group.title.replace(/^velg\s+/i, '').replace(/\?/g, '').trim();
    const heading = title.charAt(0).toLocaleUpperCase('no') + title.slice(1);
    const rawLabels = group.labels.filter(label => !/^ja,?\s*takk!?$/i.test(label.trim()));
    // describeSelection() can prefix repeatable add-ons with "2 ×".
    // Multiply by product quantity for the total number of extras shown.
    const singleRepeat = rawLabels.length === 1 ? /^(\d+)\s*[×x]\s*/i.exec(rawLabels[0]) : null;
    const count = Math.max(1, Math.round(Number(line.quantity) || 1)) *
      (singleRepeat ? Math.max(1, Number(singleRepeat[1])) : 1);
    const labels = singleRepeat
      ? [rawLabels[0].slice(singleRepeat[0].length).trim()]
      : rawLabels;
    const paid = group.price > 0;
    const useOptionName = labels.length && (!paid ||
      /^(tilvalg|ekstra|extras|annet|tilbehør)$/i.test(heading) ||
      (labels.length === 1 && heading.toLocaleLowerCase('no') === labels[0].toLocaleLowerCase('no')));
    const description = useOptionName
      ? `<b>${escapeHtml(labels.join(', '))}</b>`
      : `<b>${escapeHtml(heading)}${labels.length ? ':' : ''}</b>${labels.length ? ` ${escapeHtml(labels.join(', '))}` : ''}`;
    const multiple = paid && count > 1
      ? `<span class="cart-extra-count" aria-label="Antall tilvalg: ${count}">${count}x</span>`
      : '';
    const price = paid
      ? `<b class="cart-detail-price">${formatPrice(group.price * line.quantity)}</b>`
      : '<span class="cart-detail-included"><span aria-hidden="true">•</span> inkludert</span>';
    detailRows.push(`<span class="cart-detail-row cart-extra-row">
      <span class="cart-detail-left">${multiple}${description}</span>${price}
    </span>`);
  });

  if (Array.isArray(line.removedIngredients) && line.removedIngredients.length) {
    detailRows.push(
      `<span class="cart-detail-row is-note">
        <span class="cart-detail-left"><b>Uten:</b> <span>${escapeHtml(line.removedIngredients.join(', '))}</span></span>
      </span>`
    );
  }

  if (getDisplayComment(line)) {
    detailRows.push(
      `<span class="cart-detail-row is-note">
        <span class="cart-detail-left"><b>Kommentar:</b> <span>${escapeHtml(getDisplayComment(line))}</span></span>
      </span>`
    );
  }

  return productSummaryHtml({name: item.name, size: size?.label, quantity: line.quantity,
    basePrice: getSizePrice(item, line.sizeId), total: lineTotal, rows: detailRows,
    lineId: editable ? line.lineId : '', free: line.loyaltyFree});
}

function renderCart() {
  applyAutomaticPizzaBonus();
  refreshCartPizzaBonus();
  if (!cart.length) {
    if (el.cartHeaderActions) el.cartHeaderActions.innerHTML = '';
    el.cartLines.innerHTML =
      '<div class="empty-note"><strong>Handlekurven er tom</strong>Legg til noe godt fra menyen.</div>';
    el.cartSummary.hidden = true;
    el.cartActions.hidden = true;
    return;
  }

  if (el.cartHeaderActions) {
    el.cartHeaderActions.innerHTML = `
      <button class="cart-clear-btn" data-clear-cart type="button" aria-label="Tøm handlekurv">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg><span>Tøm handlekurv</span>
      </button>
    `;
  }

  el.cartLines.innerHTML = sortCartByCategory(cart, store.sections).map((line) => cartLineHtml(line)).join('');
  const subtotal = cartSubtotal();
  el.cartTotal.textContent = formatPrice(subtotal);
  el.cartSummary.hidden = false;
  el.cartActions.hidden = false;
}

function renderCartCount() {
  const count = cartCount();
  el.cartCount.textContent = String(count);
  el.cartCount.hidden = count === 0;
  refreshProductCartBadges();
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
  if (step === 3 && !hasValidPickup()) showPickupFeedback(false);
}

function hasValidPickup() {
  return getOpenState().open && (ui.pickupMode === 'asap' && ui.pickup === 'asap'
    || ui.pickupMode === 'scheduled' && getPickupSlots().some((slot) => slot.value === ui.pickup));
}

function showPickupFeedback(showError = true) {
  const target = ui.pickupMode === 'scheduled' ? el.timeGrid : el.pickupChoices;
  const className = showError ? 'pickup-needs-choice' : 'pickup-choice-hint';
  target.classList.remove('pickup-needs-choice', 'pickup-choice-hint');
  void target.offsetWidth;
  target.classList.add(className);
  if (showError) {
    el.errTime.textContent = ui.pickupMode === 'scheduled'
      ? 'Velg et klokkeslett før du sender bestillingen.'
      : 'Velg Snarest eller Velg tid før du sender bestillingen.';
    el.errTime.hidden = false;
    el.errTime.scrollIntoView({ block: 'nearest' });
  }
}

function renderCheckout() {
  applyAutomaticPizzaBonus();
  refreshCartPizzaBonus();

  if (!cart.length) {
    setView('cart');
    return;
  }
  const total = cartSubtotal();

  el.custName.value = el.custName.value || profile.name || '';
  el.custPhone.value = el.custPhone.value || profile.phone || '';
  if (el.custEmail) el.custEmail.value = el.custEmail.value || profile.email || '';
  el.btnStepNext.disabled = ui.orderSubmitting;
  el.btnStepNext.removeAttribute('aria-disabled');
  el.views.checkout.classList.toggle('is-submitting', ui.orderSubmitting);
  updateContactValidation();

  const state = getOpenState();
  const slots = getPickupSlots();
  const asapChoice = el.pickupChoices.querySelector('[data-pickup-mode="asap"]');
  const asapTitle = asapChoice?.querySelector('strong');
  if (asapTitle) asapTitle.textContent = 'Snarest';
  if (ui.pickupMode === 'scheduled' && !slots.some((slot) => slot.value === ui.pickup)) ui.pickup = null;
  if (!state.open) { ui.pickup = null; ui.pickupMode = null; }
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
      : ui.pickupMode === 'asap' ? 'Estimert tid – restauranten bekrefter endelig tid.' : 'Velg når du vil hente bestillingen.';

  const reviewCount = cartCount();
  const reviewLabel = `${reviewCount} ${reviewCount === 1 ? 'vare' : 'varer'}`;
  const reviewItems = sortCartByCategory(cart, store.sections).map(line => cartLineHtml(line, false)).join('');

  el.reviewCard.innerHTML = `
    <details class="pickup-review">
      <summary class="pickup-review-summary">
        <div class="pickup-review-summary-copy">
          <strong>${escapeHtml(reviewLabel)}</strong>
          <span>Se innhold og detaljer</span>
        </div>
        <span class="pickup-review-summary-action" aria-hidden="true"></span>
      </summary>

      <div class="pickup-review-body">
        <div class="pickup-review-list">
          ${reviewItems || '<div class="pickup-review-empty">Ingen varer i kurven.</div>'}
        </div>

        <div class="product-summary-total"><span>Totalt</span><strong>${formatPrice(total)}</strong></div>
        <section class="pickup-review-info" aria-label="Din informasjon">
          <div class="pickup-review-info-head">
            <strong>Din informasjon</strong>
            ${hasValidPickup() ? `<span>${ui.pickup === 'asap' ? 'Snarest' : escapeHtml(ui.pickup)}</span>` : ''}
          </div>
          <div class="pickup-review-info-grid">
            <div><span>Navn</span><strong>${escapeHtml(el.custName.value || '—')}</strong></div>
            <div><span>Telefon</span><strong>${el.custPhone.value ? `+47 ${escapeHtml(el.custPhone.value)}` : '—'}</strong></div>
            ${el.custEmail?.value?.trim() ? `<div><span>E-post</span><strong>${escapeHtml(el.custEmail.value.trim())}</strong></div>` : ''}
          </div>
          <div class="pickup-review-pay">
            <span>Å betale ved henting</span>
            <strong>${formatPrice(total)}</strong>
          </div>
        </section>
      </div>
    </details>`;
  if (ui.checkoutStep === 3) {
    el.btnStepNext.disabled = ui.orderSubmitting;
    el.btnStepNext.setAttribute('aria-disabled', String(ui.orderSubmitting || !hasValidPickup()));
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
  const emailValid = validOptionalEmail(el.custEmail?.value);
  if (el.errEmail) el.errEmail.hidden = emailValid;
  if (ui.checkoutStep === 2) el.btnStepNext.disabled = !el.custName.value.trim() || !validPhone(el.custPhone.value) || !emailValid;
}

function validOptionalEmail(value) {
  const email = String(value || '').trim();
  if (!email) return true;
  if (email.length > 254) return false;
  // Use browser-native email validation to avoid escaping mistakes.
  const probe = document.createElement('input');
  probe.type = 'email';
  probe.value = email;
  return probe.validity.valid && email.includes('.');
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
let orderConfirmTimer = null;
let orderConfirmOrderId = '';
let orderConfirmDeadline = 0;
let orderConfirmTimedOut = false;
let orderConfirmResolved = false;
let orderConfirmAcceptedTimer = null;
let orderConfirmLastRemoteCheckAt = 0;
let orderConfirmRedirectTimer = null;

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
  if (!remaining) return 'Estimert hentetid er passert. Maten din er sannsynligvis klar for henting.';
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

function confirmationRestaurantCallAction() {
  const phone = confirmationRestaurantPhone();
  return phone.tel
    ? `<a class="confirm-call-button" href="tel:${escapeHtml(phone.tel)}">Ring ${escapeHtml(phone.label || phone.tel)}</a>`
    : '<span class="confirm-phone-missing">Telefonnummer er ikke tilgjengelig akkurat nå.</span>';
}

function confirmationTimeoutActions(order, canRetry = false) {
  const call = confirmationRestaurantCallAction();
  const retry = `<button class="confirm-reorder-button" type="button" data-confirm-reorder="${escapeHtml(order.id)}"${canRetry ? '' : ' disabled aria-disabled="true"'}>Prøv å bestille på nytt</button>`;
  return `<div class="confirm-timeout-status">
    <div class="confirm-timeout-actions">${call}${retry}</div>
    <small>${canRetry
      ? 'Varene legges i handlekurven. Kontroller bestillingen og send den på nytt.'
      : 'Ny bestilling blir mulig når avbruddet er bekreftet i Firebase.'}</small>
  </div>`;
}

function isConfirmedTimeoutCancellation(order) {
  return order?.status === 'avvist' &&
    (order?.rejectionCode === 'confirmation_timeout' ||
      order?.rejectionReason === 'Svarfristen er ute');
}

function renderConfirmationTimeout(order) {
  const title = el.confirmModal.querySelector('h2');
  if (title) title.textContent = 'Svarfristen er ute';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = 'timeout';
  el.confirmText.textContent = 'Det har gått 3 minutter uten bekreftelse. Vi kontrollerer at bestillingen blir avbrutt.';
  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}${confirmationTimeoutActions(order, false)}`;
}

function checkOrderConfirmationWait() {
  if (!orderConfirmOrderId || el.confirmModal.hidden || orderConfirmResolved) return;
  // A stream can look open yet miss the employee's approval. During the
  // three-minute confirmation modal, verify THIS order via Firebase REST
  // every four seconds; never download all customers' orders.
  const now = Date.now();
  if (!document.hidden && navigator.onLine !== false &&
      now - orderConfirmLastRemoteCheckAt >= 4000) {
    orderConfirmLastRemoteCheckAt = now;
    void fetchActiveOrderNow(orderConfirmOrderId);
  }
  const order = confirmationOrderSnapshot(orderConfirmOrderId);
  if (!order) return;


  if (order.status === 'avvist') {
    orderConfirmResolved = true;
    if (orderConfirmTimer) {
      clearInterval(orderConfirmTimer);
      orderConfirmTimer = null;
    }
    const title = el.confirmModal.querySelector('h2');
    const timedOut = isConfirmedTimeoutCancellation(order);
    if (title) title.textContent = timedOut ? 'Bestillingen er avbrutt' : 'Bestillingen ble ikke godkjent';
    el.confirmModal.dataset.waiting = 'false';
    el.confirmModal.dataset.state = 'rejected';
    el.confirmText.textContent = order.rejectionMessage || order.rejectionReason || 'Restauranten kunne dessverre ikke ta imot bestillingen.';
    el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}${timedOut
      ? confirmationTimeoutActions(order, true)
      : `<div class="confirm-timeout-status">${confirmationRestaurantCallAction()}</div>`}`;
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
  orderConfirmLastRemoteCheckAt = Date.now();
  orderConfirmDeadline = confirmationDeadline(order);
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
  ui.focusedOrderId = order.id;
  rememberCustomerOrder(order);


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
  if (!hasValidPickup()) {
    ui.pickup = null;
    renderCheckout();
    showPickupFeedback();
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

  const hadAutomaticReward = cart.some(line => line.loyaltyAuto);
  bonusState = await getPizzaBonus(phone).catch(() => null);
  if (!cart.length || ui.orderSubmitting) return;
  applyAutomaticPizzaBonus();
  if (hadAutomaticReward && !cart.some(line => line.loyaltyAuto)) {
    renderCheckout();
    toast('Pizzabonus kunne ikke bekreftes. Kontroller kurven før du sender på nytt.', 'warning');
    return;
  }
  const rewardLine = cart.find(line => line.loyaltyFree);
  if (rewardLine) {
    const state = await getPizzaBonus(phone).catch(() => null);
    const { section, item } = findItem(rewardLine.itemId);
    const size = item?.sizes?.find(size => size.id === rewardLine.sizeId);
    const paidCount = cart.reduce((sum,line)=>{const found=findItem(line.itemId);return sum+(largePizza(found.section,found.item?.sizes?.find(size=>size.id===line.sizeId)) ? line.quantity-(line.loyaltyFree?1:0) : 0)},0);
    if ((!state?.ready && !(rewardLine.loyaltyAuto && state?.consent && state.count + paidCount >= 10)) || (!rewardLine.loyaltyAuto && state.phone !== loyaltyPhone(profile.phone)) || state.cycle !== rewardLine.loyaltyCycle || !largePizza(section, size) || (!rewardLine.loyaltyAuto && rewardLine.quantity !== 1)) {
      toast('Gratispizza er ikke tilgjengelig for dette mobilnummeret.', 'error'); return;
    }
  }
  const total = cartSubtotal();
  // Persist the same category order the customer sees in Kurv and checkout.
  // Persist only a product snapshot, selected choices and the charged price.
  // Editable cart metadata (duplicate labels/option IDs, empty groups and
  // unitPrice) belongs in the cart, not in every Firebase order.
  const lines = sortCartByCategory(cart, store.sections).map((line) => {
    const { section, item } = findItem(line.itemId);
    const size = (item?.sizes || []).find(s => s.id === line.sizeId);
    const selections = Object.fromEntries(Object.entries(line.selections || {})
      .filter(([, ids]) => Array.isArray(ids) && ids.length)
      .map(([group, ids]) => [group, [...ids]]));
    const optionIds = Object.values(selections).flat();
    const optionDetails = describeSelection(optionIds).map(addon => ({
      groupTitle: addon.groupTitle || 'Tilvalg',
      label: addon.label,
      price: Number(addon.price) || 0,
    }));
    const quantity = Math.max(1, Number(line.quantity) || 1);
    const price = bonusLinePrice(item, line, optionIds, quantity);
    const free = Boolean(line.loyaltyFree);
    const large = largePizza(section, size);
    const removed = (line.removedIngredients || []).filter(Boolean);
    return {
      itemId: line.itemId,
      name: (item?.name || 'Ukjent') + (free ? ' · 1 gratis pizza' : ''),
      ...(size?.id ? { sizeId: size.id } : {}),
      ...(size?.label ? { size: size.label } : {}),
      quantity,
      price,
      ...(optionIds.length ? { optionIds } : {}),
      ...(optionDetails.length ? { optionDetails } : {}),
      ...(line.comment?.trim() ? { comment: line.comment.trim() } : {}),
      ...(removed.length ? { removedIngredients: [...removed] } : {}),
      ...(large ? { loyaltyEligible: true } : {}),
      ...(free ? { loyaltyFree: true, unitPrice: price / quantity } : {}),
    };
  });

  const fingerprint = JSON.stringify({
    name,
    phone,
    email: el.custEmail?.value?.trim() || '',
    pickup: ui.pickup,
    cart: cart.map((line) => [line.itemId, line.sizeId, line.quantity, line.selections, line.removedIngredients || [], line.comment, line.loyaltyFree, line.loyaltyCycle]),
  });
  if (!ui.pendingOrderId || ui.pendingOrderFingerprint !== fingerprint) {
    ui.pendingOrderId = uid('ord');
    ui.pendingOrderFingerprint = fingerprint;
  }

  if (!validOptionalEmail(el.custEmail?.value)) {
    ui.checkoutStep = 2;
    if (el.errEmail) el.errEmail.hidden = false;
    renderCheckout();
    el.custEmail.focus();
    return;
  }

  ui.orderSubmitting = true;
  ui.orderSendFailed = false;
  renderCheckout();

  let order;
  try {
    order = await submitOrder({
      id: ui.pendingOrderId,
      loyaltyReward: rewardLine ? { cycle: rewardLine.loyaltyCycle, automatic: Boolean(rewardLine.loyaltyAuto) } : null,
      customerName: name,
      phone: `+47${phone}`,
      email: (el.custEmail?.value || '').trim().toLowerCase(),
      pickup: ui.pickup === 'asap' ? 'Snarest' : ui.pickup,
      ...(ui.pickupMode === 'scheduled'
        ? { scheduledPickupAt: resolveScheduledPickupAt(ui.pickup) }
        : {}),
      lines,
      total,
    });
  } catch (err) {
    ui.orderSubmitting = false;
    ui.orderSendFailed = true;
    renderCheckout();
    toast(err?.message || 'Bestillingen ble ikke sendt. Trykk «Prøv igjen».', 'error');
    return;
  }

  ui.orderSubmitting = false;
  ui.orderSendFailed = false;
  ui.pendingOrderId = null;
  ui.pendingOrderFingerprint = '';
  // The completed checkout is the sole persistent customer contact.
  profile.name = name;
  profile.phone = phone;
  const checkoutEmail = (el.custEmail?.value || '').trim().toLowerCase();
  if (checkoutEmail) profile.email = checkoutEmail;
  persistProfile();
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
    const groups = getItemOptionGroups(item, item.sizes?.find(size=>size.label===line.size)?.id);
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
        // New compact orders keep optionIds in one list, including repeated
        // choices (for example 2x saus). Do not reduce that list to a Set
        // when reconstructing quantity-enabled option groups.
        const rawIds = Array.isArray(line?.optionIds) ? line.optionIds : [];
        if (group.allowQuantity) {
          const allowed = new Set(options.map(option => option.id));
          picked = rawIds.filter(id => allowed.has(id));
        } else {
          picked = options.filter(option => savedIds.has(option.id)).map(option => option.id);
        }
      }
      if (!picked.length && savedLabels.size) {
        picked = options
          .filter((option) => savedLabels.has(option.label))
          .map((option) => option.id);
      }
      if (!picked.length && group.required) {
        picked = (group.defaultOptionIds || []).filter((id) => validIds.has(id));
      }

      selections[group.id] = group.allowQuantity
        ? picked.slice(0,Math.max(1,Math.min(30,Number(group.maxSelections)||1)))
        : group.selectionMode === 'single'
        ? picked.slice(0, 1)
        : picked.slice(0, Math.max(Number(group.maxSelections) || picked.length, 1));
    }
    return selections;
  }

  function orderHistoryLineHtml(line) {
    const { item } = findItem(line.itemId);
    const size = item?.sizes?.find(size => size.id === line.sizeId || size.label === line.size);
    return renderSavedOrderProduct(line, {
      fallbackBasePrice: size ? Number(size.price) : null,
      comment: getDisplayComment(line),
    });
  }

  function orderStatusClass(status) {
    const value = String(status || '').toLocaleLowerCase('no');
    if (value.includes('avvist')) return 'is-rejected';
    if (value.includes('klar')) return 'is-ready';
    if (value.includes('ferdig') || value.includes('fullført')) return 'is-done';
    if (value.includes('bekreftet') || value.includes('tilbered')) return 'is-active';
    return 'is-new';
  }

function profileInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'K';
  if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase('no');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('no');
}

function formatProfilePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return 'Kundeprofil';
  return '+47 ' + digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

function showProfileHome() {
  if (el.profileHome) el.profileHome.hidden = false;
  if (el.profileDetail) el.profileDetail.hidden = true;
  document.querySelectorAll('[data-profile-tab]').forEach((button) => {
    button.classList.remove('is-active');
    button.removeAttribute('aria-current');
  });
}

function setProfileTab(tabName) {
  const validTabs = new Set(['contact', 'orders']);
  const activeTab = validTabs.has(tabName) ? tabName : 'contact';
  const titles = {
    contact: 'Rediger profil',
    orders: 'Mine bestillinger',
  };

  if (el.profileHome) el.profileHome.hidden = true;
  if (el.profileDetail) el.profileDetail.hidden = false;
  if (el.profilePanelTitle) el.profilePanelTitle.textContent = titles[activeTab];
  if (el.profileContactHelp) el.profileContactHelp.hidden = activeTab !== 'contact';

  document.querySelectorAll('[data-profile-tab]').forEach((button) => {
    const active = button.dataset.profileTab === activeTab;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  document.querySelectorAll('[data-profile-panel]').forEach((panel) => {
    const active = panel.dataset.profilePanel === activeTab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });

  scrollPage({ top: 0, behavior: 'smooth' });
}


function renderPizzaBonus() {
  const host = $('pizzaBonus');
  if (!host) return;
  const phone = loyaltyPhone(profile.phone);
  if (!phone) { host.innerHTML = '<h2>Din pizzabonus</h2><p>Lagre mobilnummeret ditt for å samle pizzabonus.</p>'; return; }
  const state = bonusState?.phone === phone ? bonusState : null;
  if (!state) host.innerHTML = '<h2>Din pizzabonus</h2><p>Henter pizzabonus…</p>';
  else {
    const paths = Array.from({length:10}, (_,i) => {
      const angle = i * 36 - 90, end = angle + 33;
      const xy = (r,a) => [120 + r*Math.cos(a*Math.PI/180),120+r*Math.sin(a*Math.PI/180)];
      const a=xy(104,angle),b=xy(104,end),c=xy(72,end),d=xy(72,angle),icon=xy(88,angle+16.5);
      return `<g class="bonus-segment ${i>=10-state.count?'earned':''}"><path class="bonus-wedge" d="M${a} A104 104 0 0 1 ${b} L${c} A72 72 0 0 0 ${d}Z"/><g class="bonus-pizza-icon" transform="translate(${icon[0]-10} ${icon[1]-10})"><path d="M4 3Q10-1 17 5L5 19Z M4 3Q10 1 16 6"/><circle cx="8" cy="7" r="1.2"/><circle cx="11" cy="10" r="1.2"/><circle cx="6.5" cy="13" r="1"/></g></g>`;
    }).join('');
    const gift = state.ready ? '<g class="bonus-gift" transform="translate(110 62) scale(.8)"><path d="M0 8h24v6H0zM3 14v16h18V14M12 8v22M12 8C2 8 2-3 7-1c4 1 5 9 5 9s1-8 5-9c5-2 5 9-5 9Z"/></g>' : '';
    host.innerHTML = `<h2>Din pizzabonus</h2><p>Kjøp 10 store pizzaer, få den 11. gratis</p><svg class="bonus-ring" viewBox="0 0 240 240" role="img" aria-label="${state.count} av 10 pizzaer registrert">${paths}${gift}<text class="bonus-count" x="120" y="${state.ready?128:119}" text-anchor="middle">${state.count}</text><text class="bonus-caption" x="120" y="${state.ready?149:141}" text-anchor="middle"><tspan x="120">pizza</tspan><tspan x="120" dy="15">registrert</tspan></text></svg><strong>${state.ready?'Du har fått en gratis pizza!':`${10-state.count} pizzaer igjen til din gratis pizza`}</strong>${state.ready?`<p>Din neste store pizza er gratis.</p><button class="btn btn-primary" id="usePizzaBonus" type="button" ${state.pending?'disabled':''}>${state.pending?'Gratispizza venter på bekreftelse':'Bestill gratis pizza'}</button>`:''}<small>Pizzaene registreres når bestillingen er bekreftet. Ekstra tilvalg betales separat.</small><label class="pizza-offers-consent"><input id="pizzaOffersConsent" type="checkbox" ${state.consent?'checked':''}><span>Varsle meg om gratis pizza og bruk pizzabonus automatisk.</span></label>`;
  }
  if (!bonusLoading) {
    bonusLoading = true;
    getPizzaBonus(phone).then(next => { bonusState = next; }).catch(() => { if (!state) host.innerHTML = '<h2>Din pizzabonus</h2><p>Kunne ikke hente bonus. Prøv igjen senere.</p>'; }).finally(() => { bonusLoading = false; if (loyaltyPhone(profile.phone) !== phone) renderPizzaBonus(); else if (bonusState?.phone === phone) { bonusLoading = true; renderPizzaBonus(); bonusLoading = false; } });
  }
}

$('pizzaBonus')?.addEventListener('click', event => {
  if (!event.target.closest('#usePizzaBonus') || !bonusState?.ready || bonusState.pending) return;
  if (cart.some(line => line.loyaltyFree)) { setView('cart'); return; }
  const section = store.sections.find(section => section.items.some(item => !item.hidden && !item.soldOut && item.sizes.some(size => largePizza(section, size))));
  if (!section) { toast('Ingen store pizzaer tilgjengelig akkurat nå.', 'warning'); return; }
  choosingBonus = true;
  ui.search = ''; ui.searchOpen = false;
  setView('menu'); renderMenu();
  scrollToCategory(section.id);
  toast('Velg din gratis store pizza. Ekstra tilvalg betales separat.');
});

function renderProfile() {
  renderPizzaBonus();
  renderActiveOrders();
  el.profName.value = profile.name || '';
  el.profPhone.value = profile.phone || '';
  el.profEmail.value = profile.email || '';
  updateProfileValidation();
  updateContactValidation();

  if (el.profileHeroAvatar) el.profileHeroAvatar.textContent = profileInitials(profile.name);
  if (el.profileHeroName) el.profileHeroName.textContent = profile.name || 'Min profil';
  if (el.profileHeroPhone) el.profileHeroPhone.textContent = formatProfilePhone(profile.phone);
  if (el.profileContactMeta) {
    el.profileContactMeta.textContent = profile.name || profile.phone
      ? (profile.email ? 'Navn, mobilnummer og e-post lagret' : 'Navn og mobilnummer lagret')
      : 'Navn, mobilnummer og e-post';
  }

    const live = getOrders();
    const orders = activeCustomerOrders();
    // Ready/completed orders may disappear from the active carousel, but an
    // explicit SMS link must still show the requested order details.
    const linked = ui.focusedOrderId
      ? mergedCustomerOrders().find(entry => entry.id === ui.focusedOrderId)
      : null;
    if (linked && !orders.some(entry => entry.id === linked.id)) orders.unshift(linked);
    if (el.profileOrdersMeta) {
      el.profileOrdersMeta.textContent = orders.length
        ? `${orders.length} ${orders.length === 1 ? 'bestilling' : 'bestillinger'}`
        : 'Ingen aktive bestillinger';
    }
    el.orderList.innerHTML = orders.length
      ? orders
          .slice(0, 30)
          .map((order) => {
            const current = live.find((entry) => entry.id === order.id);
const displayOrder = current ? mergeStableCustomerOrder(order, current) : order;
const date = new Date(displayOrder.createdAt || order.createdAt);
const validDate = !Number.isNaN(date.getTime());
const now = new Date();
const dayLabel = validDate && date.toDateString() === now.toDateString()
  ? 'IDAG'
  : validDate ? `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}` : 'BESTILLING';
const clock = validDate ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '—';
const lines = sortCartByCategory(displayOrder.lines?.length ? displayOrder.lines : (order.lines || []), store.sections);
const firstLine = lines[0];
const summary = firstLine
  ? `${Math.max(1, Number(firstLine.quantity) || 1)} × ${firstLine.name || 'Produkt'}${lines.length > 1 ? ` + ${lines.length - 1} til` : ''}`
  : 'Ingen varer';
const status = orderStatusLabel(displayOrder.status);
const statusClass = orderStatusClass(displayOrder.status);
const statusIcon = statusClass === 'is-rejected' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>' : statusClass === 'is-ready' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' : statusClass === 'is-done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const rejectionReason = String(displayOrder.rejectionReason || '').trim();
const rejectionMessage = String(displayOrder.rejectionMessage || '').trim();
const rejectionTitle = rejectionReason && rejectionReason !== 'Egendefinert melding' ? rejectionReason : 'Bestillingen ble avvist';
const details = lines.map(orderHistoryLineHtml).join('');
const shortId = String(order.id || '').slice(-6).toUpperCase();
const total = Number(displayOrder.total ?? order.total) || 0;
const pickup = String(displayOrder.pickup || order.pickup || '—');
return `
  <details name="customer-order-history" class="order-history-card ${statusClass}" data-order-card-id="${escapeHtml(order.id)}"${ui.focusedOrderId === order.id ? ' open' : ''}>
    <summary class="order-history-summary-shell">
      <span class="order-history-header">
        <span class="order-history-calendar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>
        <span class="order-history-heading">
          <strong>${escapeHtml(dayLabel)} <span class="order-history-mid-dot">·</span> kl. ${escapeHtml(clock)}</strong>
          <small>Bestillingsnr. #${escapeHtml(shortId || '—')}</small>
        </span>
        <span class="order-status-pill ${statusClass}"><span class="order-status-icon">${statusIcon}</span><span>${escapeHtml(status)}</span></span>
        <span class="order-history-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>
      </span>
      <span class="order-history-compact"><span>${escapeHtml(summary)}</span><strong>${formatPrice(total)}</strong></span>
    </summary>
    <div class="order-history-details">
      ${displayOrder.status === 'avvist' ? `<div class="order-history-rejection"><strong>${escapeHtml(rejectionTitle)}</strong>${rejectionMessage ? `<span>${escapeHtml(rejectionMessage)}</span>` : ''}</div>` : ''}
      <div class="order-history-lines order-history-cart-list order-product-list">${details || '<p class="hint">Ingen varelinjer lagret.</p>'}</div>
      <div class="order-history-grand-total"><span>Totalt</span><strong>${formatPrice(total)}</strong></div>
      <div class="order-history-footer">
        <div class="order-history-meta-item"><small>Hentetid</small><strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${escapeHtml(pickup)}</strong></div>
        <div class="order-history-meta-item"><small>Ordrenummer</small><strong>#${escapeHtml(shortId || '—')}</strong></div>
        <button class="btn btn-primary order-reorder-btn" data-reorder="${escapeHtml(order.id)}" type="button">Bestill samme igjen</button>
      </div>
    </div>
  </details>`;
          })
          .join('')
      : '<p class="hint">Ingen aktive bestillinger.</p>';
  }

  function reorder(orderId, fallbackOrder = null) {
    // Reorder only items from Firebase or the order currently displayed.
    const order = (fallbackOrder?.id === orderId && fallbackOrder?.lines?.length)
      ? fallbackOrder
      : mergedCustomerOrders().find((entry) => entry.id === orderId);
    if (!order?.lines?.length) {
      toast('Kunne ikke hente varene fra den tidligere bestillingen.', 'warning');
      return 0;
    }
    let added = 0;
    let skipped = 0;
    const hadReward = order.lines.some((line) => line.loyaltyFree);
    for (const line of order.lines) {
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const { item } = findItem(line.itemId);
      if (!item || item.hidden || item.soldOut) {
        skipped += quantity;
        continue;
      }
      const size =
        (item.sizes || []).find((s) => s.id === line.sizeId) ||
        (item.sizes || []).find((s) => s.label === line.size) ||
        getDefaultSize(item);
      if (!size) {
        skipped += quantity;
        continue;
      }
      const selections = previousOrderSelections(item, line);
      const allowedRemovals = new Set(
        getItemIngredientRules(item)
          .filter((rule) => rule.removable)
          .map((rule) => rule.name.toLocaleLowerCase('no'))
      );
      const removedIngredients = (Array.isArray(line.removedIngredients) ? line.removedIngredients : [])
        .filter((name) => allowedRemovals.has(String(name).toLocaleLowerCase('no')));
      const signature = lineSignature(
        item.id,
        size ? size.id : null,
        selections,
        line.comment,
        removedIngredients
      );
      const existing = cart.find((entry) => entry.signature === signature && (!entry.loyaltyFree || entry.loyaltyAuto));
      if (existing) existing.quantity += quantity;
      else
        cart.push({
          lineId: uid('ln'),
          signature,
          itemId: item.id,
          sizeId: size ? size.id : null,
          selections,
          comment: line.comment || '',
          removedIngredients,
          quantity,
        });
      added += quantity;
    }
    if (!added) {
      toast('Produktene er ikke tilgjengelige nå.', 'warning');
      return 0;
    }
    resetPendingOrderSubmission();
    persistCart();
    renderCartCount();
    setView('cart');
    if (skipped) {
      toast(`${added} varer lagt i kurven. ${skipped} utilgjengelige varer ble utelatt. Kontroller kurven.`, 'warning');
    } else if (hadReward) {
      // A reward from a cancelled order must be revalidated separately.
      // Reorder never blindly grants the old free pizza a second time.
      toast('Varene er lagt i kurven. Kontroller priser og pizzabonus før du sender på nytt.', 'warning');
    } else {
      toast(`${added} ${added === 1 ? 'vare' : 'varer'} lagt i kurven. Kontroller og send på nytt.`);
    }
    return added;
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
  const profileHomeButton = event.target.closest('[data-profile-home]');
  if (profileHomeButton) {
    showProfileHome();
    return;
  }

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
  const toggleBlock = event.target.closest('[data-toggle-block]');
  if (toggleBlock) {
    const key = toggleBlock.dataset.toggleBlock;
    if (ui.expandedBlocks.has(key)) ui.expandedBlocks.delete(key);
    else ui.expandedBlocks.add(key);
    renderMenu();
    return;
  }
  const quickAddBtn = event.target.closest('[data-quick-add]');
  if (quickAddBtn) {
    quickAddProduct(quickAddBtn.dataset.quickAdd);
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

el.cartHeaderActions?.addEventListener('click', (event) => {
  const clearCart = event.target.closest('[data-clear-cart]');
  if (!clearCart) return;

  cart = [];
  resetPendingOrderSubmission();
  persistCart();
  renderCart();
  renderCartCount();
});

el.cartLines.addEventListener('click', (event) => {
  const clearCart = event.target.closest('[data-clear-cart]');
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  const remove = event.target.closest('[data-remove]');
  const edit = event.target.closest('[data-edit]');

  if (clearCart) {
    cart = [];
  } else if (inc) {
    const line = cart.find((entry) => entry.lineId === inc.dataset.inc);
    if (line && (!line.loyaltyFree || line.loyaltyAuto)) line.quantity += 1;
  } else if (dec) {
    const line = cart.find((entry) => entry.lineId === dec.dataset.dec);
    if (line && line.quantity > 1) line.quantity -= 1;
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

el.sheetBody.addEventListener('click', (event) => {
  if (!draft) return;
  const quantityButton = event.target.closest('[data-addon-quantity]');
  if (quantityButton) {
    event.preventDefault();
    const {item} = findItem(draft.itemId);
    const group = getItemOptionGroups(item, draft.sizeId).find(group=>group.id===quantityButton.dataset.addonGroup);
    if (!group?.allowQuantity || group.selectionMode !== 'multiple') return;
    const ids = [...(draft.selections[group.id] || [])], id = quantityButton.dataset.addonOption;
    if (!group.options.some(option=>option.id===id && !option.soldOut)) return;
    const max = Math.max(1,Math.min(30,Number(group.maxSelections)||1));
    if (quantityButton.dataset.addonQuantity==='1') {
      if (ids.length >= max) { toast(`Maks ${max} stk i «${group.title}».`, 'warning');return; }
      ids.push(id);
    } else {
      const index = ids.indexOf(id);if (index >= 0) ids.splice(index,1);
    }
    draft.selections[group.id]=ids;
    if(validateDraft().valid)draft.showErrors=false;
    renderSheet();return;
  }
  const toggle = event.target.closest('[data-toggle-ingredients]');
  if (toggle) {
    draft.ingredientsOpen = !draft.ingredientsOpen;
    renderSheet();
    return;
  }

  const ingredientBtn = event.target.closest('[data-remove-ingredient]');
  if (!ingredientBtn) return;
  const { item } = findItem(draft.itemId);
  if (!item) return;
  const name = ingredientBtn.dataset.removeIngredient;
  const rule = getItemIngredientRules(item).find(
    (entry) => entry.removable && entry.name.toLocaleLowerCase('no') === String(name).toLocaleLowerCase('no')
  );
  if (!rule) return;

  const current = new Set((draft.removedIngredients || []).map((entry) => String(entry).toLocaleLowerCase('no')));
  const key = rule.name.toLocaleLowerCase('no');
  if (current.has(key)) {
    draft.removedIngredients = (draft.removedIngredients || []).filter(
      (entry) => String(entry).toLocaleLowerCase('no') !== key
    );
  } else {
    draft.removedIngredients = [...(draft.removedIngredients || []), rule.name];
  }
  draft.ingredientsOpen = true;
  renderSheet();
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

  const group = getItemOptionGroups(findItem(draft.itemId).item, draft.sizeId).find(
    (entry) => entry.id === groupId
  );
  if (!group) return;

  if (group.selectionMode === 'single') {
    const current = draft.selections[groupId] || [];
    if (!group.required && current[0] === optionId) draft.selections[groupId] = [];
    else draft.selections[groupId] = [optionId];
  } else if (group.allowQuantity) {
    // Checkbox toggles 0/1 while the adjacent +/- stepper allows repeats.
    // Preserve duplicate IDs: each occurrence represents one paid serving.
    const ids=[...(draft.selections[groupId]||[])];
    const max=Math.max(1,Math.min(30,Number(group.maxSelections)||1));
    if (target.checked) {
      if(ids.length>=max){
        target.checked=false;
        toast(`Maks ${max} stk i «${group.title}».`,'warning');
        return;
      }
      if(!ids.includes(optionId))ids.push(optionId);
    }else{
      draft.selections[groupId]=ids.filter(id=>id!==optionId);
    }
    if(target.checked)draft.selections[groupId]=ids;
  } else {
    const current = new Set(draft.selections[groupId] || []);
    if (target.checked) {
      if (current.size >= group.maxSelections) {
        target.checked = false;
        toast(`Maks ${group.maxSelections} valg i «${group.title}».`, 'warning');
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
  const group = getItemOptionGroups(item, draft.sizeId).find((entry) => entry.id === groupId);
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
  if (draft.loyaltyFree && !draft.loyaltyAuto) return;
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
el.btnCart.addEventListener('click', () => setView('cart'));
el.btnKeepShopping.addEventListener('click', () => setView('menu'));

el.btnToCheckout.addEventListener('click', () => {
  if (!cart.length) return;
  const state = getOpenState();
  if (!state.open) {
    toast(`Restauranten er stengt. Vi åpner ${state.opensAt}.`, 'warning');
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
  if (ui.orderSubmitting) return;
  if (ui.checkoutStep === 3 && !hasValidPickup()) { showPickupFeedback(); return; }
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
  if (!button || !['asap', 'scheduled'].includes(button.dataset.pickupMode)) return;
  if (!getOpenState().open) return;
  ui.orderSendFailed = false;
  ui.pickupMode = button.dataset.pickupMode;
  ui.pickup = ui.pickupMode === 'asap' ? 'asap' : null;
  el.errTime.hidden = true;
  el.pickupChoices.classList.remove('pickup-needs-choice', 'pickup-choice-hint');
  el.timeGrid.classList.remove('pickup-needs-choice', 'pickup-choice-hint');
  renderCheckout();
});

el.timeGrid.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-time]');
  if (!btn || ui.pickupMode !== 'scheduled' || !getPickupSlots().some((slot) => slot.value === btn.dataset.time)) return;
  ui.orderSendFailed = false;
  ui.pickup = btn.dataset.time;
  el.errTime.hidden = true;
  el.pickupChoices.classList.remove('pickup-needs-choice', 'pickup-choice-hint');
  el.timeGrid.classList.remove('pickup-needs-choice', 'pickup-choice-hint');
  renderCheckout();
});

if (el.allergenVisibilityToggle) {
  el.allergenVisibilityToggle.addEventListener('change', () => {
    ui.showAllergens = el.allergenVisibilityToggle.checked;
    saveJSON(ALLERGEN_VISIBILITY_KEY, ui.showAllergens);
    renderMenu();
  });
}


[el.custName, el.custPhone].forEach((input) => {
  input.addEventListener('input', () => {
    if (input === el.custName) {
      profile.name = input.value.trim();
      if (profile.name) el.errName.hidden = true;
    }
    if (input === el.custPhone) {
      input.value = input.value.replace(/[^\d]/g, '').slice(0, 8);
      profile.phone = input.value;
      if (validPhone(input.value)) el.errPhone.hidden = true;
    }
    // Previously a second checkout-contact key was used for the same fields.
    // Keeping them directly in the customer profile preserves drafts on reload.
    persistProfile();
  });
});

[el.custName, el.custPhone, el.profName, el.profPhone].forEach((input) => {
  input.addEventListener('input', updateContactValidation);
});

$('pizzaBonus').addEventListener('change', async event => {
  if (event.target.id !== 'pizzaOffersConsent') return;
  const enabled = event.target.checked;
  event.target.disabled = true;
  try {
    await setPizzaOffersConsent(profile.phone, enabled);
    bonusState = await getPizzaBonus(profile.phone);
    applyAutomaticPizzaBonus(); persistCart(); renderPizzaBonus();
  } catch (error) { event.target.checked = !enabled; toast(error.message || 'Kunne ikke lagre valget.', 'error'); }
  finally { event.target.disabled = false; }
});
el.custPhone.addEventListener('input',()=>{ cartBonusFetchedAt=0; refreshCartPizzaBonus(true); });

function updateProfileValidation({ showErrors = false } = {}) {
  const nameValid = Boolean(el.profName.value.trim());
  const phoneValid = validPhone(el.profPhone.value);
  const emailValue = el.profEmail.value.trim();
  const emailValid = validOptionalEmail(emailValue);
  for (const [input, valid] of [
    [el.profName, nameValid],
    [el.profPhone, phoneValid],
    [el.profEmail, emailValid && Boolean(emailValue)],
  ]) {
    const field = input.closest('.validated-input');
    if (!field) continue;
    field.classList.toggle('is-valid', valid);
    const check = field.querySelector('.valid-check');
    if (check) check.hidden = !valid;
  }
  el.errProfName.hidden = !showErrors || nameValid;
  el.errProfPhone.hidden = !showErrors || phoneValid;
  el.errProfEmail.hidden = emailValid || (!showErrors && !emailValue);
  return nameValid && phoneValid && emailValid;
}

el.btnSaveProfile.addEventListener('click', async () => {
  if (el.btnSaveProfile.disabled) return;
  if (!updateProfileValidation({ showErrors: true })) {
    const invalidInput = !el.profName.value.trim() ? el.profName
      : !validPhone(el.profPhone.value) ? el.profPhone : el.profEmail;
    toast('Kontroller kontaktopplysningene før du lagrer.', 'error');
    invalidInput.focus();
    return;
  }
  const nextName = el.profName.value.trim();
  const nextPhone = el.profPhone.value.replace(/[^\d]/g, '').slice(0, 8);
  const nextEmail = el.profEmail.value.trim().toLowerCase();
  const saveButtonText = el.btnSaveProfile.textContent;
  el.btnSaveProfile.disabled = true;
  el.btnSaveProfile.textContent = 'Lagrer…';
  try {
    // Save to /customers/{phone} now: do not wait for the first order.
    // All existing purchase totals and pizza-reward fields are preserved.
    await saveCustomerContact({
      name: nextName, phone: nextPhone, email: nextEmail
    });
  } catch (error) {
    console.warn('Kundeprofil ikke lagret i Firebase:', error);
    toast(error?.message || 'Kunne ikke lagre kundeprofilen. Prøv igjen.', 'error');
    return;
  } finally {
    el.btnSaveProfile.disabled = false;
    el.btnSaveProfile.textContent = saveButtonText;
  }

  const previousEmail = profile.email || '';
  profile.name = nextName;
  profile.phone = nextPhone;
  profile.email = nextEmail;
  persistProfile();

  // Saved profile details also populate the next checkout, without overwriting
  // text the customer has intentionally typed into the order form.
  if (!el.custName.value.trim()) el.custName.value = profile.name;
  if (!el.custPhone.value.trim()) el.custPhone.value = profile.phone;
  if (!el.custEmail.value.trim() || el.custEmail.value.trim().toLowerCase() === previousEmail.toLowerCase()) {
    el.custEmail.value = profile.email;
  }
  updateContactValidation();
  updateProfileValidation();
  if (el.profileHeroAvatar) el.profileHeroAvatar.textContent = profileInitials(profile.name);
  if (el.profileHeroName) el.profileHeroName.textContent = profile.name || 'Min profil';
  if (el.profileHeroPhone) el.profileHeroPhone.textContent = formatProfilePhone(profile.phone);
  if (el.profileContactMeta) {
    el.profileContactMeta.textContent = profile.email
      ? 'Navn, mobilnummer og e-post lagret'
      : 'Navn og mobilnummer lagret';
  }
  toast('✓ Profilen er lagret i kunderegisteret.');
});

for (const input of [el.profName, el.profPhone, el.profEmail]) {
  input.addEventListener('input', () => {
    if (input === el.profPhone) el.profPhone.value = el.profPhone.value.replace(/[^\d]/g, '').slice(0, 8);
    updateProfileValidation();
  });
}

if (el.custEmail) el.custEmail.addEventListener('input', () => {
  if (el.errEmail) el.errEmail.hidden = validOptionalEmail(el.custEmail.value);
  updateContactValidation();
});

function closeConfirm() {
  if (el.confirmModal.dataset.waiting === 'true') return;
  el.confirmModal.hidden = true;
  el.confirmBackdrop.hidden = true;
  setView('menu');
  renderMenu();
}

el.confirmMeta.addEventListener('click', (event) => {
  const retryButton = event.target.closest('[data-confirm-reorder]');
  if (!retryButton || retryButton.disabled) return;
  const orderId = retryButton.dataset.confirmReorder;
  // Allow resubmission only after the original order is definitely cancelled
  // in Firebase. Never re-use its ID or automatically submit the new order.
  const order = confirmationOrderSnapshot(orderId);
  if (!order || order.id !== orderConfirmOrderId || !isConfirmedTimeoutCancellation(order)) {
    toast('Vent til den forrige bestillingen er bekreftet avbrutt.', 'warning');
    return;
  }
  const added = reorder(orderId, order);
  if (!added) return;
  if (orderConfirmTimer) clearInterval(orderConfirmTimer);
  orderConfirmTimer = null;
  orderConfirmResolved = true;
  orderConfirmOrderId = '';
  orderConfirmDeadline = 0;
  el.confirmModal.hidden = true;
  el.confirmBackdrop.hidden = true;
  // reorder() already navigated to the cart. The customer selects a new
  // pickup time and explicitly sends a fresh order with a new order ID.
});

el.btnConfirmDone.addEventListener('click', closeConfirm);
el.confirmBackdrop.addEventListener('click', closeConfirm);

/* ------------------------------------------------------------------ *
 * Oppstart og live-oppdatering fra admin
 * ------------------------------------------------------------------ */

function applyCustomerInterfaceSettings() {
  const settings = store.settings || {};
  const darkEnabled = settings.customerDarkModeEnabled !== false;

  if (el.profileThemeToggle) {
    el.profileThemeToggle.hidden = !darkEnabled;
    el.profileThemeToggle.style.display = darkEnabled ? '' : 'none';
  }
  if (!darkEnabled && window.KolTheme?.get?.() === 'dark') {
    window.KolTheme.set('light');
  }
}

function renderAll() {
  // Ikke gjett restaurantidentiteten før første Firebase-forsøk er fullført.
  // Kundens første visning har kun en nøytral, ikke-merkevarebasert plassholder.
  const brandLoading = document.getElementById('brandLoading');
  if (brandLoading) brandLoading.hidden = customerMenuReady;
  el.brandHome.hidden = !customerMenuReady;
  if (customerMenuReady) {
    const restaurantName = String(store.settings.restaurantName || '').trim();
    const displayName = restaurantName || 'Online bestilling';
    const brandName = el.brandHome.querySelector('strong');
    if (brandName.textContent !== displayName) brandName.textContent = displayName;
    el.brandHome.setAttribute('aria-label', `${displayName} — til menyen`);

    const logo = el.brandHome.querySelector('img');
    const logoSrc = String(store.settings.restaurantLogo || '').trim();
    if (logoSrc) {
      if (logo.getAttribute('src') !== logoSrc) logo.src = logoSrc;
      logo.alt = restaurantName || 'Restaurantlogo';
      logo.hidden = false;
    } else {
      logo.hidden = true;
      logo.removeAttribute('src');
      logo.alt = '';
    }

    const pageTitle = restaurantName ? `${restaurantName} — Bestill online` : 'Online bestilling';
    document.title = pageTitle;
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', pageTitle);
    }
  }
  applyCustomerPalette(store.settings?.customerPalette);
  applyCustomerInterfaceSettings();
  const changed = reconcileCart();
  renderCategories();
  renderMenu();
  renderAllergenVisibilityControl();
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
    const workerUrl = new URL('../service-worker.js', import.meta.url);
    navigator.serviceWorker.register(workerUrl.href, { scope: new URL('../', import.meta.url).pathname }).catch(() => {});
  });
}

// Én startskjerm: kunden ser ikke delvis ferdig meny, feil logo eller
// en foreløpig restaurantstatus mens Firebase og sidens visning lastes.
let startupNavigationReady = false;
let startupReleaseScheduled = false;

function releaseStartupScreenIfReady() {
  if (!startupNavigationReady || !customerMenuReady || backendInfo.mode !== 'firebase') return;
  const screen = document.getElementById('appStartup');
  if (!screen || screen.hidden || startupReleaseScheduled) return;
  startupReleaseScheduled = true;

  // Vent til meny, kategorier, header og ordresporing har fått en full
  // nettleseropptegning før vi fjerner lasteskjermen.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    startupReleaseScheduled = false;
    if (backendInfo.mode !== 'firebase') return;
    window.clearTimeout(window.customerStartupTimeout);
    screen.hidden = true;
    screen.setAttribute('aria-busy', 'false');
  }));
}

subscribe((_state, origin) => {
  // 'init' er ferdig Firebase-forsøk. Senere 'remote' kan gjenopprette
  // forbindelsen, og samme gate åpner da kunden uten ny sideoppdatering.
  if (origin === 'init' || origin === 'remote') customerMenuReady = true;
  const changed = renderAll();
  if (origin === 'init' && backendInfo.mode !== 'firebase') {
    window.showCustomerStartupError?.();
  }
  releaseStartupScreenIfReady();
  if (origin === 'remote' && changed) toast('Menyen er oppdatert av restauranten.');
});

ready().then(async () => {
  renderAll();
  setView('menu');
  await openOrderFromSmsLink();
  startupNavigationReady = true;
  if (backendInfo.mode !== 'firebase') window.showCustomerStartupError?.();
  releaseStartupScreenIfReady();
}).catch(error => {
  console.error('Kunne ikke fullføre kundeoppstart:', error);
  window.showCustomerStartupError?.();
});

// Status og åpningstid holdes oppdatert mens siden er åpen.
setInterval(() => {
  renderOpenState();
}, 5000);

// Vis estimert resttid sekund for sekund. Kun en ansatt kan markere ordren som Klar.
setInterval(refreshCustomerOrderCountdowns, 1000);
refreshCustomerOrderCountdowns();

// Forsiden frigis først etter vellykket Firebase-lesing og klargjort UI.
// Feil eller timeout gir «Prøv igjen» i stedet for et uferdig grensesnitt.

// live-order-visibility-refresh
window.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const current = activeCustomerOrders()[0];
  if (current) {
    fetchActiveOrderNow(current.id);
    if (current.status === 'klar') scheduleReadyDismiss(current);
  }
});

document.addEventListener('kolthemechange', () => applyCustomerPalette(store.settings?.customerPalette));
