import { confirmationRemaining, confirmationExpired } from './order-confirmation.js';
import { detectIngredientRules } from './ingredient-detection.js';
import { getDisplayComment } from './order-comments.js';
import { CUSTOMER_PALETTES } from './palette.js';
import { sortCartByCategory } from './cart-order.js';
/**
 * admin.js — Adminpanel for Restauranten.
 *
 * Fire sider: produkter/kategorier, valggruppe-bibliotek, bestillinger og
 * restaurantinnstillinger. Alt skrives til det delte datalaget (Firebase RTDB
 * via REST) og treffer kundesiden umiddelbart.
 */

import {
  store,
  importMenuJSON,
  exportMenuJSON,
  subscribe,
  ready,
  mutate,
  saveNow,
  onStatus,
  hasUnsavedChanges,
  backendInfo,
  uid,
  clone,
  formatPrice,
  getItemBasePrice,
  getItemOptionGroups,
  removeItemOptionGroup,
  getItemIngredientRules,
  countProductsUsingGroup,
  findItem,
  findOptionGroup,
  getAllergenCatalog,
  getOpenState,
  getPickupSlots,
  getWeeklyHours,
  RESTAURANT_WEEKDAYS,
  getStats,
  getOrders,
  updateOrderStatus,
  markOrderReadyManually,
  updateOrderEstimate,
  acceptOrderWithEstimate,
  acceptScheduledOrder,
  rejectOrder,
  refreshFromDatabase,
  orderStatusLabel,
} from './data.js?v=20261014-settings-weekly108';

/* ------------------------------------------------------------------ *
 * UI-tilstand
 * ------------------------------------------------------------------ */

const initialGroupView = (() => {
  try {
    return localStorage.getItem('kol-admin-group-view') === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
})();

const initialSettingsView = (() => {
  try {
    return localStorage.getItem('kol-admin-settings-view') === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
})();

const SETTINGS_SECTIONS = new Set(['status', 'pickup', 'menu', 'interface', 'contact']);
const initialSettingsSection = (() => {
  try {
    const saved = localStorage.getItem('kol-admin-settings-section');
    return SETTINGS_SECTIONS.has(saved) ? saved : 'status';
  } catch {
    return 'status';
  }
})();

const ui = {
  page: 'products',
  openCategoryId: null,
  focusedCategoryId: null,
  selectedItemId: null,
  search: '',
  filter: 'all',
  groupSearch: '',
  groupFilter: 'all',
  groupOpenId: null,
  groupOpenInitialized: false,
  groupView: initialGroupView,
  settingsView: initialSettingsView,
  settingsSection: initialSettingsSection,
  orderFilter: 'all',
  activeChip: 'produkt',
};

/** Sant når panelet ikke skal bygges på nytt (bevarer fokus i tekstfelt). */
let skipPanelRender = false;
/** Aktiv valggruppe-editor. */
let editorDraft = null;
/** Aktiv kategori-editor. */
let categoryDraft = null;
/** Callback for bekreftelsesmodalen. */
let confirmAction = null;
/** Produkt som skal få gruppen fra bibliotek-modalen. */
let attachTargetItemId = null;
/** Åpen ordre i detaljmodalen. */
let openOrderId = null;
let selectedOrderId = null;
let actionOrderId = null;

const $ = (id) => document.getElementById(id);

const el = {
  sideLinks: document.querySelectorAll('.side-link[data-nav]'),
  productsMenuBlock: $('productsMenuBlock'),
  productsSubnav: $('productsSubnav'),
  pages: {
    products: $('pageProducts'),
    groups: $('pageGroups'),
    orders: $('pageOrders'),
    settings: $('pageSettings'),
  },
  saveState: $('saveState'),
  saveText: $('saveText'),
  btnSaveNow: $('btnSaveNow'),
  backendHint: $('backendHint'),
  openBadge: $('openBadge'),
  openBadgeText: $('openBadgeText'),
  navOrderBadge: $('navOrderBadge'),
  statRow: $('statRow'),
  productsSummary: $('productsSummary'),
  productSearch: $('productSearch'),
  filterBtns: document.querySelectorAll('.filter-btn[data-filter]'),
  btnNewCategory: $('btnNewCategory'),
  categoryList: $('categoryList'),
  groupsSummary: $('groupsSummary'),
  groupSearch: $('groupSearch'),
  groupViewBtns: document.querySelectorAll('[data-group-view]'),
  btnNewGroup: $('btnNewGroup'),
  groupLibrary: $('groupLibrary'),
  settingsGrid: $('settingsGrid'),
  settingsViewBtns: document.querySelectorAll('[data-settings-view]'),
  settingsSectionBtns: document.querySelectorAll('[data-settings-section-tab]'),
  settingsSectionCards: document.querySelectorAll('[data-settings-section]'),
  btnAdminTheme: $('btnAdminTheme'),
  ordersSummary: $('ordersSummary'),
  orderStatRow: $('orderStatRow'),
  orderList: $('orderList'),
  orderFilterBtns: document.querySelectorAll('.orders-tab[data-order-filter]'),
  btnRefreshOrders: $('btnRefreshOrders'),
  btnOrdersSidebarToggle: $('btnOrdersSidebarToggle'),
  orderDetailPane: $('orderDetailPane'),
  orderDetailEmpty: $('orderDetailEmpty'),
  orderDetailLive: $('orderDetailLive'),
  settingsCol: $('settingsCol'),
  productEditorBackdrop: $('productEditorBackdrop'),
  settingsWrap: $('settingsWrap'),
  settingsName: $('settingsName'),
  settingsPath: $('settingsPath'),
  btnCloseSettings: $('btnCloseSettings'),
  chipNav: $('chipNav'),
  settingsScroll: $('settingsScroll'),
  fName: $('fName'),
  fDesc: $('fDesc'),
  fIngredientNew: $('fIngredientNew'),
  btnAddIngredient: $('btnAddIngredient'),
  btnDetectIngredients: $('btnDetectIngredients'),
  btnResetIngredients: $('btnResetIngredients'),
  ingredientRuleList: $('ingredientRuleList'),
  fImage: $('fImage'),
  fImagePreview: $('fImagePreview'),
  fPopular: $('fPopular'),
  sizeRows: $('sizeRows'),
  btnAddSize: $('btnAddSize'),
  allergenGrid: $('allergenGrid'),
  attachedGroups: $('attachedGroups'),
  btnAttachGroup: $('btnAttachGroup'),
  fVisible: $('fVisible'),
  fSoldOut: $('fSoldOut'),
  fMoveCategory: $('fMoveCategory'),
  btnDuplicateProduct: $('btnDuplicateProduct'),
  btnDeleteProduct: $('btnDeleteProduct'),
  modalBackdrop: $('modalBackdrop'),
  modalLibrary: $('modalLibrary'),
  libraryList: $('libraryList'),
  btnNewGroupFromModal: $('btnNewGroupFromModal'),
  modalEditor: $('modalEditor'),
  editorTitle: $('editorTitle'),
  gTitle: $('gTitle'),
  gModeSingle: $('gModeSingle'),
  gModeMultiple: $('gModeMultiple'),
  gOptionRows: $('gOptionRows'),
  btnAddOption: $('btnAddOption'),
  gRequired: $('gRequired'),
  gMaxWrap: $('gMaxWrap'),
  gMax: $('gMax'),
  editorErr: $('editorErr'),
  btnDeleteGroup: $('btnDeleteGroup'),
  btnSaveGroup: $('btnSaveGroup'),
  modalCategory: $('modalCategory'),
  categoryTitle: $('categoryTitle'),
  cTitle: $('cTitle'),
  cNote: $('cNote'),
  cImage: $('cImage'),
  categoryErr: $('categoryErr'),
  btnSaveCategory: $('btnSaveCategory'),
  modalOrder: $('modalOrder'),
  orderTitle: $('orderTitle'),
  orderBody: $('orderBody'),
  modalAcceptOrder: $('modalAcceptOrder'),
  acceptOrderTitle: $('acceptOrderTitle'),
  acceptQuickTimes: $('acceptQuickTimes'),
  acceptMinutes: $('acceptMinutes'),
  acceptManualTime: $('acceptManualTime'),
  acceptTimeEyebrow: $('acceptTimeEyebrow'),
  acceptTimeLead: $('acceptTimeLead'),
  scheduledAcceptCard: $('scheduledAcceptCard'),
  scheduledAcceptTime: $('scheduledAcceptTime'),
  btnAcceptConfirm: $('btnAcceptConfirm'),
  modalRejectOrder: $('modalRejectOrder'),
  rejectOrderTitle: $('rejectOrderTitle'),
  rejectCallBtn: $('rejectCallBtn'),
  rejectReasons: $('rejectReasons'),
  rejectMessage: $('rejectMessage'),
  btnRejectConfirm: $('btnRejectConfirm'),
  modalConfirm: $('modalConfirm'),
  confirmTitle: $('confirmTitle'),
  confirmBody: $('confirmBody'),
  btnConfirmCancel: $('btnConfirmCancel'),
  btnConfirmOk: $('btnConfirmOk'),
  toast: $('adminToast'),
  settings: {
    manualClosed: $('sManualClosed'),
    closedMessage: $('sClosedMessage'),
    openStateLine: $('openStateLine'),
    orderOpenTime: $('sOpenTime'),
    orderCloseTime: $('sCloseTime'),
    openingDays: $('sOpeningDays'),
    prepMinutes: $('sPrepMinutes'),
    slotIntervalMinutes: $('sSlotInterval'),
    slotPreview: $('slotPreview'),
    adminMobileEnabled: $('sAdminMobileEnabled'),
    adminDarkModeEnabled: $('sAdminDarkModeEnabled'),
    customerDarkModeEnabled: $('sCustomerDarkModeEnabled'),
    customerPalette: $('sCustomerPalette'),
    shopInfoEnabled: $('sShopInfoEnabled'),
    ingredientCustomizationEnabled: $('sIngredientCustomizationEnabled'),
    restaurantName: $('sRestaurantName'),
    restaurantLogo: $('sRestaurantLogo'),
    streetAddress: $('sStreetAddress'),
    postalCode: $('sPostalCode'),
    city: $('sCity'),
    phone: $('sPhone'),
    pickupInfo: $('sPickupInfo'),
    paymentInfo: $('sPaymentInfo'),
    orderAlarmUrl: $('sOrderAlarmUrl'),
  },
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
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 2200);
}

function selectedItem() {
  if (!ui.selectedItemId) return { item: null, section: null };
  return findItem(ui.selectedItemId);
}

function timeStamp(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

/* ------------------------------------------------------------------ *
 * Sidebar-navigasjon
 * ------------------------------------------------------------------ */

function setOrdersSidebarCollapsed(collapsed) {
  const shouldCollapse = ui.page === 'orders' && Boolean(collapsed);
  document.body.classList.toggle('orders-sidebar-collapsed', shouldCollapse);
  if (el.btnOrdersSidebarToggle) {
    el.btnOrdersSidebarToggle.setAttribute('aria-expanded', String(!shouldCollapse));
  }
}

function setPage(page) {
  if (page !== 'products' && ui.selectedItemId) {
    ui.selectedItemId = null;
    renderPanel();
  }
  ui.page = page;
  for (const [name, node] of Object.entries(el.pages)) {
    node.hidden = name !== page;
    node.classList.toggle('is-active', name === page);
  }
  el.sideLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.nav === page);
  });

  const inProductsArea = page === 'products' || page === 'groups';
  if (el.productsMenuBlock) {
    el.productsMenuBlock.classList.toggle('is-expanded', inProductsArea);
    el.productsMenuBlock.classList.toggle('has-active-child', page === 'groups');
  }
  if (el.productsSubnav) el.productsSubnav.hidden = false;

  const productsLink = Array.from(el.sideLinks).find((link) => link.dataset.nav === 'products');
  if (productsLink) {
    productsLink.setAttribute('aria-expanded', String(inProductsArea));
    productsLink.classList.toggle('has-active-child', page === 'groups');
  }

  setOrdersSidebarCollapsed(page === 'orders');
  renderAll();
}

el.sideLinks.forEach((link) => {
  link.addEventListener('click', () => setPage(link.dataset.nav));
});

if (el.btnOrdersSidebarToggle) {
  el.btnOrdersSidebarToggle.addEventListener('click', () => {
    setOrdersSidebarCollapsed(false);
  });
}

/* ------------------------------------------------------------------ *
 * Lagringsstatus
 * ------------------------------------------------------------------ */

const SAVE_LABELS = {
  saved: 'Lagret',
  dirty: 'Endringer ikke lagret',
  saving: 'Lagrer…',
  error: 'Lagringsfeil',
};

onStatus(({ state, message }) => {
  el.saveState.dataset.state = state;
  el.saveText.textContent = SAVE_LABELS[state] || 'Lagret';
  el.saveState.title = message || '';
});

async function saveRestaurantChanges(){
  if(!validateWeeklyForm()){toast('Kontroller åpningstidene før du lagrer.');return;}
  const ok=await saveNow();
  toast(ok?'Alle endringer er lagret.':'Kunne ikke lagre i Firebase. Prøv igjen.');
}
el.btnSaveNow.addEventListener('click',saveRestaurantChanges);
document.getElementById('btnSaveSettings').addEventListener('click',saveRestaurantChanges);

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});

/* ------------------------------------------------------------------ *
 * Oppsummering
 * ------------------------------------------------------------------ */

function dashboardStatIcon(label) {
  const icons = {"Kategorier":"<path d=\"M3 6a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v10H3z\"/><path d=\"M3 10h18\"/>","Produkter":"<path d=\"m12 2.5 8.5 5v9L12 21l-8.5-4.5v-9zM3.5 7.5l8.5 5 8.5-5M12 12.5V21\"/>","Utsolgt":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m5.6 18.4 12.8-12.8\"/>","Skjult":"<path d=\"M3 3l18 18M10 5.2A11 11 0 0 1 12 5c4.8 0 8.5 3 10 7a13 13 0 0 1-3.3 4.4M6.4 6.6A13 13 0 0 0 2 12c1.5 4 5.2 7 10 7 1.1 0 2-.2 3-.5\"/><path d=\"M10 10a3 3 0 0 0 4 4\"/>","Valggrupper":"<path d=\"m12 2.5 9 5.5-9 5.5-9-5.5zM3 12.5l9 5.5 9-5.5M3 17l9 5.5 9-5.5\"/>","Nye bestillinger":"<path d=\"M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21zM9 8h6M9 12h6M9 16h4\"/>"};
  const tones = {"Kategorier":"orange","Produkter":"blue","Utsolgt":"red","Skjult":"slate","Valggrupper":"purple","Nye bestillinger":"green"};
  return `<span class="stat-card-icon stat-card-icon--${tones[label] || 'slate'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[label] || icons.Kategorier}</svg></span>`;
}
function renderStats() {
  const stats = getStats();
  const state = getOpenState();

  el.openBadge.dataset.open = String(state.open);
  el.openBadgeText.textContent = state.open
    ? `Åpent · stenger ${state.closesAt}`
    : `Stengt · åpner ${state.opensAt}`;

  const productsHeading = document.getElementById('productsHeading');
  if (productsHeading) productsHeading.textContent = `${stats.categoryCount} Kategorier | ${stats.itemCount} Produkter`;
  el.navOrderBadge.hidden = stats.newOrders === 0;
  el.navOrderBadge.textContent = String(stats.newOrders);

  const cards = [
    { label: 'Kategorier', value: stats.categoryCount },
    { label: 'Produkter', value: stats.itemCount },
    { label: 'Utsolgt', value: stats.soldOutCount, tone: stats.soldOutCount ? 'warn' : '' },
    { label: 'Skjult', value: stats.hiddenCount },
    { label: 'Valggrupper', value: stats.groupCount },
    {
      label: 'Nye bestillinger',
      value: stats.newOrders,
      tone: stats.newOrders ? 'accent' : '',
    },
  ];
  el.statRow.innerHTML = cards
    .map(
      (card) =>
        `<div class="stat-card${card.tone ? ` is-${card.tone}` : ''}">${dashboardStatIcon(card.label)}<span class="stat-card-info"><strong>${escapeHtml(
          String(card.value)
        )}</strong><span>${escapeHtml(card.label)}</span></span></div>`
    )
    .join('');

  el.orderStatRow.innerHTML = [
    { label: 'Nye', value: stats.newOrders, tone: stats.newOrders ? 'accent' : '' },
    { label: 'Aktive nå', value: stats.activeOrders },
    { label: 'Bestillinger i dag', value: stats.todayOrders },
    { label: 'Omsetning i dag', value: formatPrice(stats.todayRevenue) },
  ]
    .map(
      (card) =>
        `<div class="stat-card${card.tone ? ` is-${card.tone}` : ''}"><strong>${escapeHtml(
          String(card.value)
        )}</strong><span>${escapeHtml(card.label)}</span></div>`
    )
    .join('');
}

/* ------------------------------------------------------------------ *
 * Kategorier og produkter
 * ------------------------------------------------------------------ */

function matchesFilter(item) {
  if (ui.filter === 'soldout') return item.soldOut;
  if (ui.filter === 'hidden') return item.hidden;
  return true;
}

function matchesSearch(item) {
  if (!ui.search) return true;
  const needle = ui.search.toLowerCase();
  return (
    (item.name || '').toLowerCase().includes(needle) ||
    (item.description || '').toLowerCase().includes(needle) ||
    (item.ingredients || '').toLowerCase().includes(needle)
  );
}

function dashboardCategoryImage(section) {
  const item = (section.items || []).find(product => product && typeof product.imageUrl === 'string' && product.imageUrl.trim());
  const raw = String(item?.imageUrl || section.imageUrl || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}
function dashboardCategoryEmoji(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('pizza')) return '🍕';
  if (t.includes('kebab')) return '🥙';
  if (t.includes('burger')) return '🍔';
  if (t.includes('vegetar') || t.includes('salat')) return '🥬';
  if (t.includes('tilbeh') || t.includes('dressing')) return '🥣';
  if (t.includes('barn')) return '🧀';
  if (t.includes('drikk')) return '🥤';
  return '🍽️';
}
function renderCategories() {
  const sections = store.sections || [];
  const totalItems = sections.reduce(
    (sum, section) => sum + (section.items || []).length,
    0
  );
  el.productsSummary.textContent = `${sections.length} kategorier · ${totalItems} produkter · dra i håndtaket for å endre rekkefølge`;

  if (!sections.length) {
    el.categoryList.innerHTML =
      '<div class="empty-card"><strong>Ingen kategorier</strong><p>Lag din første kategori for å legge inn produkter.</p></div>';
    return;
  }

  el.categoryList.innerHTML = sections
    .map((section, index) => {
      const items = (section.items || []).filter(
        (item) => matchesFilter(item) && matchesSearch(item)
      );
      const isOpen = ui.openCategoryId === section.id || Boolean(ui.search);
      const categoryImage = dashboardCategoryImage(section);
      const categoryEmoji = dashboardCategoryEmoji(section.title);
      const hiddenCount = (section.items || []).filter((item) => item.hidden).length;
      const soldOutCount = (section.items || []).filter((item) => item.soldOut).length;

      return `
      <section class="cat-card${isOpen ? ' is-open' : ''}${
        ui.focusedCategoryId === section.id ? ' is-focus-target' : ''
      }" data-category="${escapeHtml(
        section.id
      )}" draggable="false">
        <header class="cat-card-head">
          <span class="drag-handle" data-drag-cat="${escapeHtml(
            section.id
          )}" draggable="true" title="Dra for å flytte kategorien" aria-hidden="true">⋮⋮</span>
          <button class="cat-toggle" data-toggle="${escapeHtml(section.id)}" type="button" aria-expanded="${isOpen}" aria-label="Vis produkter i ${escapeHtml(section.title || 'Uten navn')}">
            <span class="cat-category-thumb cat-category-thumb--${index % 6}" aria-hidden="true">
              <span class="cat-category-fallback">${categoryEmoji}</span>
              ${categoryImage ? `<img src="${escapeHtml(categoryImage)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
            </span>
            <span class="cat-labels">
              <span class="cat-name">${escapeHtml(section.title || 'Uten navn')}</span>
              <span class="cat-meta">${(section.items || []).length} produkter${
        soldOutCount ? ` · ${soldOutCount} utsolgt` : ''
      }${hiddenCount ? ` · ${hiddenCount} skjult` : ''}</span>
            </span>
          </button>
          <span class="cat-tools">
            <button class="icon-btn" data-edit-cat="${escapeHtml(
              section.id
            )}" type="button" aria-label="Rediger kategorien" title="Rediger kategorien">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h3l9-9-3-3-9 9v3z"/><path d="M14.5 6.5l3 3"/></svg>
            </button>
            <button class="icon-btn" data-add-item="${escapeHtml(
              section.id
            )}" type="button" aria-label="Nytt produkt" title="Nytt produkt">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="icon-btn is-danger" data-del-cat="${escapeHtml(
              section.id
            )}" type="button" aria-label="Slett kategorien" title="Slett kategorien">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>
            </button>
            </span>
          <button class="cat-expand-btn" data-toggle="${escapeHtml(section.id)}" type="button" aria-label="${isOpen ? 'Lukk' : 'Vis'} produkter i ${escapeHtml(section.title || 'Uten navn')}" aria-expanded="${isOpen}">
            <svg class="chev${isOpen ? ' is-open' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </header>
        <div class="cat-body"${isOpen ? '' : ' hidden'}>
          ${
            items.length
              ? items
                  .map(
                    (item) => `
            <div class="item-row${
              item.id === ui.selectedItemId ? ' is-selected' : ''
            }" data-item="${escapeHtml(item.id)}" data-section="${escapeHtml(section.id)}">
              <span class="drag-handle" data-drag-item="${escapeHtml(
                item.id
              )}" draggable="true" title="Dra for å flytte produktet" aria-hidden="true">⋮⋮</span>
              ${
                item.imageUrl
                  ? `<img class="item-thumb" src="${escapeHtml(
                      item.imageUrl
                    )}" alt="" loading="lazy">`
                  : '<span class="item-thumb item-thumb-empty" aria-hidden="true"></span>'
              }
              <span class="item-main">
                <span class="item-name">${escapeHtml(item.name || 'Uten navn')}</span>
                <span class="item-sub">${escapeHtml(
                  item.description || item.ingredients || 'Ingen beskrivelse'
                )}</span>
              </span>
              <span class="item-tags">
                ${
                  item.soldOut
                    ? '<span class="pill pill-warn">Utsolgt</span>'
                    : '<span class="pill pill-ok">Tilgjengelig</span>'
                }
                ${item.hidden ? '<span class="pill pill-muted">Skjult</span>' : ''}
                ${
                  (item.optionGroupIds || []).length
                    ? `<span class="pill">${item.optionGroupIds.length} valggr.</span>`
                    : ''
                }
              </span>
              <span class="item-price">${formatPrice(getItemBasePrice(item))}</span>
              <button class="btn btn-outline btn-xs" data-open-item="${escapeHtml(
                item.id
              )}" type="button">Innstillinger</button>
            </div>`
                  )
                  .join('')
              : `<p class="cat-empty">${
                  ui.search || ui.filter !== 'all'
                    ? 'Ingen produkter passer søket eller filteret.'
                    : 'Ingen produkter i denne kategorien ennå.'
                }</p>`
          }
        </div>
      </section>`;
    })
    .join('');
}

// Fall back to the category symbol when the first product photo fails.
el.categoryList.addEventListener('error', event => {
  if (event.target?.matches?.('.cat-category-thumb img')) event.target.remove();
}, true);

/* ------------------------------------------------------------------ *
 * Dra-og-slipp
 * ------------------------------------------------------------------ */

let dragKind = null;
let dragId = null;

el.categoryList.addEventListener('dragstart', (event) => {
  const catHandle = event.target.closest('[data-drag-cat]');
  const itemHandle = event.target.closest('[data-drag-item]');
  if (catHandle) {
    dragKind = 'category';
    dragId = catHandle.dataset.dragCat;
  } else if (itemHandle) {
    dragKind = 'item';
    dragId = itemHandle.dataset.dragItem;
  } else {
    return;
  }
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragId);
});

el.categoryList.addEventListener('dragover', (event) => {
  if (!dragKind) return;
  event.preventDefault();
  const target =
    dragKind === 'category'
      ? event.target.closest('.cat-card')
      : event.target.closest('.item-row');
  el.categoryList.querySelectorAll('.is-drop').forEach((node) => {
    node.classList.remove('is-drop');
  });
  if (target) target.classList.add('is-drop');
});

el.categoryList.addEventListener('dragleave', (event) => {
  const target = event.target.closest('.cat-card, .item-row');
  if (target) target.classList.remove('is-drop');
});

el.categoryList.addEventListener('drop', (event) => {
  if (!dragKind) return;
  event.preventDefault();
  el.categoryList.querySelectorAll('.is-drop').forEach((node) => {
    node.classList.remove('is-drop');
  });

  if (dragKind === 'category') {
    const card = event.target.closest('.cat-card');
    if (!card || card.dataset.category === dragId) return resetDrag();
    mutate((state) => {
      const from = state.sections.findIndex((section) => section.id === dragId);
      const to = state.sections.findIndex(
        (section) => section.id === card.dataset.category
      );
      if (from < 0 || to < 0) return;
      const [moved] = state.sections.splice(from, 1);
      state.sections.splice(to, 0, moved);
    });
    toast('Rekkefølgen på kategoriene er endret.');
  } else {
    const row = event.target.closest('.item-row');
    const card = event.target.closest('.cat-card');
    mutate((state) => {
      let sourceSection = null;
      let movedItem = null;
      for (const section of state.sections) {
        const index = (section.items || []).findIndex((item) => item.id === dragId);
        if (index >= 0) {
          sourceSection = section;
          [movedItem] = section.items.splice(index, 1);
          break;
        }
      }
      if (!movedItem) return;
      const targetSectionId = row ? row.dataset.section : card && card.dataset.category;
      const targetSection =
        state.sections.find((section) => section.id === targetSectionId) || sourceSection;
      if (row && row.dataset.item !== dragId) {
        const index = targetSection.items.findIndex((item) => item.id === row.dataset.item);
        targetSection.items.splice(index < 0 ? targetSection.items.length : index, 0, movedItem);
      } else {
        targetSection.items.push(movedItem);
      }
    });
    toast('Produktet er flyttet.');
  }
  resetDrag();
});

function resetDrag() {
  dragKind = null;
  dragId = null;
}

el.categoryList.addEventListener('dragend', resetDrag);

function scrollCategoryToTop(categoryId, behavior = 'smooth') {
  const scroller = el.categoryList.closest('.scroll-area');
  const card = el.categoryList.querySelector(`[data-category="${CSS.escape(categoryId)}"]`);
  if (!scroller || !card) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const targetTop = scroller.scrollTop + cardRect.top - scrollerRect.top - 8;

  scroller.scrollTo({
    top: Math.max(0, targetTop),
    behavior,
  });
}

/* ------------------------------------------------------------------ *
 * Klikk i kategorilisten
 * ------------------------------------------------------------------ */

el.categoryList.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    const categoryId = toggle.dataset.toggle;
    const opening = ui.openCategoryId !== categoryId;
    ui.openCategoryId = opening ? categoryId : null;
    ui.focusedCategoryId = opening ? categoryId : null;
    renderCategories();
    if (opening) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollCategoryToTop(categoryId));
      });
    }
    return;
  }

  const addItem = event.target.closest('[data-add-item]');
  if (addItem) {
    createProduct(addItem.dataset.addItem);
    return;
  }

  const editCat = event.target.closest('[data-edit-cat]');
  if (editCat) {
    openCategoryModal(editCat.dataset.editCat);
    return;
  }

  const delCat = event.target.closest('[data-del-cat]');
  if (delCat) {
    const section = (store.sections || []).find((s) => s.id === delCat.dataset.delCat);
    if (!section) return;
    askConfirm(
      'Slette kategorien?',
      `«${section.title}» og ${(section.items || []).length} produkter fjernes fra kundemenyen.`,
      () => {
        mutate((state) => {
          state.sections = state.sections.filter((s) => s.id !== section.id);
        });
        if (ui.openCategoryId === section.id) ui.openCategoryId = null;
        if ((section.items || []).some((item) => item.id === ui.selectedItemId)) {
          ui.selectedItemId = null;
        }
        toast('Kategorien er slettet.');
      }
    );
    return;
  }

  const openItem = event.target.closest('[data-open-item]');
  const row = event.target.closest('.item-row');
  const itemId = openItem ? openItem.dataset.openItem : row && row.dataset.item;
  if (itemId && !event.target.closest('[data-drag-item]')) {
    ui.selectedItemId = itemId;
    ui.activeChip = 'produkt';
    if (row?.dataset.section) ui.focusedCategoryId = row.dataset.section;
    renderCategories();
    renderPanel();
    el.settingsScroll.scrollTop = 0;
  }
});

function createProduct(sectionId) {
  const newId = uid('it');
  mutate((state) => {
    const section = state.sections.find((entry) => entry.id === sectionId);
    if (!section) return;
    section.items.push({
      id: newId,
      name: 'Nytt produkt',
      description: '',
      ingredients: '',
      ingredientRules: [],
      imageUrl: '',
      sizes: [{ id: uid('sz'), label: 'Normal', price: 0 }],
      defaultSizeIndex: 0,
      allergens: [],
      optionGroupIds: [],
      hidden: true,
      soldOut: false,
    });
  });
  ui.openCategoryId = sectionId;
  ui.focusedCategoryId = sectionId;
  ui.selectedItemId = newId;
  ui.activeChip = 'produkt';
  renderCategories();
  renderPanel();
  el.fName.focus();
  el.fName.select();
  toast('Produktet er opprettet som skjult. Fyll inn og slå på «Vis produktet».');
}

/* ------------------------------------------------------------------ *
 * Kategori-modal
 * ------------------------------------------------------------------ */

function openCategoryModal(sectionId) {
  const section = sectionId
    ? (store.sections || []).find((entry) => entry.id === sectionId)
    : null;
  categoryDraft = section
    ? { id: section.id, isNew: false }
    : { id: null, isNew: true };
  el.categoryTitle.textContent = section ? 'Rediger kategori' : 'Ny kategori';
  el.cTitle.value = section ? section.title : '';
  el.cNote.value = section ? section.note : '';
  el.cImage.value = section ? section.imageUrl : '';
  el.categoryErr.hidden = true;
  openModal(el.modalCategory);
  el.cTitle.focus();
}

el.btnNewCategory.addEventListener('click', () => openCategoryModal(null));

el.btnSaveCategory.addEventListener('click', () => {
  if (!categoryDraft) return;
  const title = el.cTitle.value.trim();
  if (!title) {
    el.categoryErr.textContent = 'Kategorien må ha et navn.';
    el.categoryErr.hidden = false;
    return;
  }
  const payload = {
    title,
    note: el.cNote.value.trim(),
    imageUrl: el.cImage.value.trim(),
  };

  if (categoryDraft.isNew) {
    const newId = uid('sec');
    mutate((state) => {
      state.sections.push({
        id: newId,
        type: '',
        items: [],
        ...payload,
      });
    });
    ui.openCategoryId = newId;
    toast('Kategorien er opprettet.');
  } else {
    mutate((state) => {
      const section = state.sections.find((entry) => entry.id === categoryDraft.id);
      if (section) Object.assign(section, payload);
    });
    toast('Kategorien er oppdatert.');
  }
  categoryDraft = null;
  closeModals();
});

/* ------------------------------------------------------------------ *
 * Produktpanel
 * ------------------------------------------------------------------ */

function renderPanel() {
  const { item, section } = selectedItem();
  if (!item) {
    el.settingsCol.hidden = true;
    el.productEditorBackdrop.hidden = true;
    document.body.classList.remove('product-editor-open');
    return;
  }
  el.settingsCol.hidden = false;
  el.productEditorBackdrop.hidden = false;
  el.settingsWrap.hidden = false;
  document.body.classList.add('product-editor-open');

  el.settingsName.textContent = item.name || 'Uten navn';
  el.settingsPath.textContent = `${section.title} · ${formatPrice(
    getItemBasePrice(item)
  )} · ${(item.sizes || []).length} størrelser`;

  el.fName.value = item.name || '';
  el.fDesc.value = item.description || '';
  renderIngredientRules(item);
  el.fImage.value = item.imageUrl || '';
  el.fImagePreview.src = item.imageUrl || '';
  el.fImagePreview.style.display = item.imageUrl ? 'block' : 'none';
  el.fPopular.checked = (store.popularItemIds || []).includes(item.id);
  el.fVisible.checked = !item.hidden;
  el.fSoldOut.checked = Boolean(item.soldOut);

  // Størrelser
  el.sizeRows.innerHTML = (item.sizes || [])
    .map(
      (size, index) => `
    <div class="size-row" data-size="${escapeHtml(size.id)}">
      <label class="radio-cell">
        <input type="radio" name="defSize" data-default="${index}" ${
        index === item.defaultSizeIndex ? 'checked' : ''
      } aria-label="Standard størrelse">
      </label>
      <input class="input" type="text" data-size-label="${escapeHtml(
        size.id
      )}" value="${escapeHtml(size.label)}" placeholder="F.eks. Medium">
      <input class="input" type="number" min="0" step="1" data-size-price="${escapeHtml(
        size.id
      )}" value="${Number(size.price) || 0}">
      <button class="icon-btn is-danger" data-del-size="${escapeHtml(
        size.id
      )}" type="button" aria-label="Fjern størrelsen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>
      </button>
    </div>`
    )
    .join('');

  // Allergener
  el.allergenGrid.innerHTML = getAllergenCatalog()
    .map(
      (entry) => `
    <label class="check-chip${
      (item.allergens || []).includes(entry.id) ? ' is-on' : ''
    }">
      <input type="checkbox" data-allergen="${escapeHtml(entry.id)}" ${
        (item.allergens || []).includes(entry.id) ? 'checked' : ''
      }>
      <span>${escapeHtml(entry.label)}</span>
    </label>`
    )
    .join('');

  // Valggrupper
  const groups = getItemOptionGroups(item, '*');
  el.attachedGroups.innerHTML = groups.length
    ? groups
        .map(
          (group) => `
      <div class="attached-row" data-attached-group="${escapeHtml(group.id)}">
        <button type="button" class="icon-btn group-drag-handle" aria-label="Dra for å flytte ${escapeHtml(group.title)}" title="Dra for å endre rekkefølgen">⠿</button>
        <div class="group-move-buttons"><button type="button" class="icon-btn" data-move-group="${escapeHtml(group.id)}" data-direction="-1" aria-label="Flytt opp">↑</button><button type="button" class="icon-btn" data-move-group="${escapeHtml(group.id)}" data-direction="1" aria-label="Flytt ned">↓</button></div>
        <div class="attached-main">
          <strong>${escapeHtml(group.title || 'Uten navn')}</strong>
          <span>${
            group.selectionMode === 'multiple'
              ? `Flere valg · maks ${group.maxSelections}`
              : 'Ett valg'
          } · ${group.required ? 'Obligatorisk' : 'Valgfritt'} · ${
            (group.options || []).length
          } alternativer</span>
          <small>${(item.optionGroupIds || []).includes(group.id) ? 'Alle størrelser' : escapeHtml((item.sizes || []).filter(size => (size.optionGroupIds || []).includes(group.id)).map(size => size.label).join(', '))} · Brukes av ${countProductsUsingGroup(group.id)} produkter</small>
        </div>
        <button class="btn btn-outline btn-xs" data-edit-group="${escapeHtml(
          group.id
        )}" type="button">Rediger</button>
        <button class="icon-btn is-danger" data-detach-group="${escapeHtml(
          group.id
        )}" type="button" aria-label="Fjern fra produktet" title="Fjern fra produktet">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>`
        )
        .join('')
    : '<p class="cat-empty">Ingen valggrupper på produktet ennå.</p>';

  // Flytt til kategori
  el.fMoveCategory.innerHTML = (store.sections || [])
    .map(
      (entry) =>
        `<option value="${escapeHtml(entry.id)}"${
          entry.id === section.id ? ' selected' : ''
        }>${escapeHtml(entry.title)}</option>`
    )
    .join('');

  setActiveChip(ui.activeChip || 'produkt');
  centerActiveEditorChip(ui.activeChip || 'produkt', 'auto');
}

function normalizedIngredientRules(item = selectedItem().item) {
  return getItemIngredientRules(item).map((rule) => ({
    name: String(rule.name || '').trim(),
    removable: rule.removable !== false,
  })).filter((rule) => rule.name);
}

function syncIngredientRules(item, rules) {
  const seen = new Set();
  const cleaned = [];
  for (const rule of rules || []) {
    const name = String(rule.name || '').trim().replace(/\s+/g, ' ');
    const key = name.toLocaleLowerCase('no');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ name, removable: rule.removable !== false });
  }
  item.ingredientDetectionInitialized = true;
  item.ingredientRulesEdited = true;
  item.ingredientRules = cleaned;
  item.ingredients = cleaned.map((rule) => rule.name).join(', ');
}

function renderIngredientRules(item = selectedItem().item) {
  if (!el.ingredientRuleList) return;
  const rules = normalizedIngredientRules(item);
  el.ingredientRuleList.innerHTML = rules.length
    ? rules.map((rule, index) => `
        <div class="ingredient-admin-row" data-ingredient-row="${index}">
          <input class="input ingredient-name-input" type="text" data-ingredient-name="${index}" value="${escapeHtml(rule.name)}" aria-label="Ingrediensnavn">
          <label class="ingredient-remove-toggle">
            <span>Kan fjernes</span>
            <input class="switch" type="checkbox" data-ingredient-removable="${index}" ${rule.removable ? 'checked' : ''} aria-label="Kan ${escapeHtml(rule.name)} fjernes av kunden">
          </label>
          <button class="icon-btn is-danger ingredient-delete-btn" data-delete-ingredient="${index}" type="button" aria-label="Slett ${escapeHtml(rule.name)}" title="Slett ingrediens">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>
          </button>
        </div>`).join('')
    : '<div class="ingredient-admin-empty">Ingen ingredienser ennå. Legg til én tagg om gangen.</div>';
}


/** Endrer valgt produkt uten å bygge panelet på nytt. */
function updateItem(updater, { rerenderPanel = false } = {}) {
  const { item } = selectedItem();
  if (!item) return;
  skipPanelRender = !rerenderPanel;
  mutate(() => updater(item));
  renderCategories();
  renderStats();
  if (rerenderPanel) renderPanel();
}

el.fName.addEventListener('input', () => {
  updateItem((item) => {
    item.name = el.fName.value;
  });
  el.settingsName.textContent = el.fName.value || 'Uten navn';
});

el.fDesc.addEventListener('input', () => {
  updateItem((item) => {
    item.description = el.fDesc.value;
  });
});
el.fDesc.addEventListener('change', () => {
  const { item } = selectedItem();
  if (!item || item.ingredientRulesEdited) return;
  const rules = detectIngredientRules(item.description);
  updateItem(target => {
    syncIngredientRules(target, rules);
    target.ingredientRulesEdited = false;
    if (!target.ingredientDefaults?.length) target.ingredientDefaults = rules.map(rule => ({...rule}));
  });
  renderIngredientRules();
});

function addIngredientFromAdmin() {
  const name = el.fIngredientNew.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    el.fIngredientNew.focus();
    return;
  }
  const { item } = selectedItem();
  if (!item) return;
  const rules = normalizedIngredientRules(item);
  if (rules.some((rule) => rule.name.toLocaleLowerCase('no') === name.toLocaleLowerCase('no'))) {
    toast('Ingrediensen finnes allerede.');
    el.fIngredientNew.select();
    return;
  }
  updateItem((target) => {
    syncIngredientRules(target, [...rules, { name, removable: true }]);
  });
  el.fIngredientNew.value = '';
  renderIngredientRules();
  el.fIngredientNew.focus();
}

el.btnAddIngredient.addEventListener('click', addIngredientFromAdmin);
el.btnDetectIngredients.addEventListener('click', () => {
  const { item } = selectedItem();
  if (!item) return;
  const existing = normalizedIngredientRules(item);
  const names = new Set(existing.map(rule => rule.name.toLocaleLowerCase('no')));
  const added = detectIngredientRules(item.description).filter(rule => !names.has(rule.name.toLocaleLowerCase('no')));
  updateItem(target => syncIngredientRules(target, [...existing, ...added]));
  renderIngredientRules();
  toast(added.length ? `${added.length} ingredienser lagt til. Kontroller listen.` : 'Ingen nye ingredienser funnet. Du kan legge til manuelt.');
});
el.btnResetIngredients.addEventListener('click', () => {
  const { item } = selectedItem();
  if (!item) return;
  updateItem(target => syncIngredientRules(target, target.ingredientDefaults || []));
  renderIngredientRules();
  toast('Den opprinnelige ingredienslisten er gjenopprettet.');
});
el.fIngredientNew.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addIngredientFromAdmin();
});

el.ingredientRuleList.addEventListener('change', (event) => {
  const nameIndex = event.target.dataset.ingredientName;
  const removableIndex = event.target.dataset.ingredientRemovable;
  if (nameIndex === undefined && removableIndex === undefined) return;

  const { item } = selectedItem();
  if (!item) return;
  const rules = normalizedIngredientRules(item);
  const index = Number(nameIndex !== undefined ? nameIndex : removableIndex);
  if (!rules[index]) return;

  if (nameIndex !== undefined) {
    const nextName = event.target.value.trim().replace(/\s+/g, ' ');
    if (!nextName) {
      toast('Ingrediensnavnet kan ikke være tomt.');
      renderIngredientRules();
      return;
    }
    const duplicate = rules.some(
      (rule, ruleIndex) =>
        ruleIndex !== index &&
        rule.name.toLocaleLowerCase('no') === nextName.toLocaleLowerCase('no')
    );
    if (duplicate) {
      toast('Ingrediensen finnes allerede.');
      renderIngredientRules();
      return;
    }
    rules[index].name = nextName;
  } else {
    rules[index].removable = event.target.checked;
  }

  updateItem((target) => syncIngredientRules(target, rules));
  renderIngredientRules();
});

el.ingredientRuleList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-ingredient]');
  if (!button) return;
  const index = Number(button.dataset.deleteIngredient);
  const { item } = selectedItem();
  if (!item) return;
  const rules = normalizedIngredientRules(item);
  const removed = rules[index];
  if (!removed) return;
  rules.splice(index, 1);
  updateItem((target) => syncIngredientRules(target, rules));
  renderIngredientRules();
  toast(`«${removed.name}» er slettet.`);
});

el.fImage.addEventListener('input', () => {
  const url = el.fImage.value.trim();
  updateItem((item) => {
    item.imageUrl = url;
  });
  el.fImagePreview.src = url;
  el.fImagePreview.style.display = url ? 'block' : 'none';
});

el.fPopular.addEventListener('change', () => {
  const { item } = selectedItem();
  if (!item) return;
  skipPanelRender = true;
  mutate((state) => {
    const list = state.popularItemIds || [];
    if (el.fPopular.checked) {
      if (!list.includes(item.id)) list.push(item.id);
    } else {
      state.popularItemIds = list.filter((id) => id !== item.id);
    }
  });
  toast(el.fPopular.checked ? 'Lagt i «Mest bestilt».' : 'Fjernet fra «Mest bestilt».');
});

el.fVisible.addEventListener('change', () => {
  updateItem((item) => {
    item.hidden = !el.fVisible.checked;
  });
  toast(el.fVisible.checked ? 'Produktet vises i menyen.' : 'Produktet er skjult.');
});

el.fSoldOut.addEventListener('change', () => {
  updateItem((item) => {
    item.soldOut = el.fSoldOut.checked;
  });
  toast(el.fSoldOut.checked ? 'Markert som utsolgt.' : 'Produktet kan bestilles igjen.');
});

el.sizeRows.addEventListener('input', (event) => {
  const labelField = event.target.dataset.sizeLabel;
  const priceField = event.target.dataset.sizePrice;
  if (!labelField && !priceField) return;
  const sizeId = labelField || priceField;
  updateItem((item) => {
    const size = (item.sizes || []).find((entry) => entry.id === sizeId);
    if (!size) return;
    if (labelField) size.label = event.target.value;
    else size.price = Math.max(0, Number(event.target.value) || 0);
  });
});

el.sizeRows.addEventListener('change', (event) => {
  if (event.target.dataset.default === undefined) return;
  const index = Number(event.target.dataset.default);
  updateItem((item) => {
    item.defaultSizeIndex = index;
  });
});

el.sizeRows.addEventListener('click', (event) => {
  const del = event.target.closest('[data-del-size]');
  if (!del) return;
  const { item } = selectedItem();
  if (!item) return;
  if ((item.sizes || []).length <= 1) {
    toast('Produktet må ha minst én størrelse.');
    return;
  }
  updateItem(
    (target) => {
      target.sizes = target.sizes.filter((size) => size.id !== del.dataset.delSize);
      target.defaultSizeIndex = Math.min(
        target.defaultSizeIndex,
        target.sizes.length - 1
      );
    },
    { rerenderPanel: true }
  );
});

el.btnAddSize.addEventListener('click', () => {
  updateItem(
    (item) => {
      item.sizes.push({ id: uid('sz'), label: 'Ny størrelse', price: 0 });
    },
    { rerenderPanel: true }
  );
});

el.allergenGrid.addEventListener('change', (event) => {
  const allergenId = event.target.dataset.allergen;
  if (!allergenId) return;
  updateItem(
    (item) => {
      const list = item.allergens || [];
      if (event.target.checked) {
        if (!list.includes(allergenId)) list.push(allergenId);
      } else {
        item.allergens = list.filter((entry) => entry !== allergenId);
      }
    },
    { rerenderPanel: true }
  );
});

let groupDrag = null;
el.attachedGroups.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.group-drag-handle');
  const { item } = selectedItem();
  if (!handle || !item || event.button !== 0) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  const row = handle.closest('[data-attached-group]');
  groupDrag = { row, itemId: item.id, pointerId: event.pointerId };
  row.classList.add('is-dragging');
});
el.attachedGroups.addEventListener('pointermove', event => {
  if (!groupDrag || event.pointerId !== groupDrag.pointerId) return;
  event.preventDefault();
  const rows = [...el.attachedGroups.querySelectorAll('[data-attached-group]')].filter(row => row !== groupDrag.row);
  const before = rows.find(row => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
  if (before) el.attachedGroups.insertBefore(groupDrag.row, before);
  else el.attachedGroups.appendChild(groupDrag.row);
});
function finishGroupDrag(event) {
  if (!groupDrag || event.pointerId !== groupDrag.pointerId) return;
  const { item } = selectedItem();
  const ids = [...el.attachedGroups.querySelectorAll('[data-attached-group]')].map(row => row.dataset.attachedGroup);
  groupDrag.row.classList.remove('is-dragging');
  const itemId = groupDrag.itemId;
  groupDrag = null;
  if (event.type === 'pointercancel') { renderPanel(); return; }
  if (item?.id === itemId) updateItem(target => { target.optionGroupOrder = ids; }, { rerenderPanel: true });
}
el.attachedGroups.addEventListener('pointerup', finishGroupDrag);
el.attachedGroups.addEventListener('pointercancel', finishGroupDrag);

el.attachedGroups.addEventListener('click', (event) => {
  const move = event.target.closest('[data-move-group]');
  if (move) {
    const { item } = selectedItem();
    if (!item) return;
    const ids = getItemOptionGroups(item, '*').map(group => group.id);
    const from = ids.indexOf(move.dataset.moveGroup), to = from + Number(move.dataset.direction);
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    updateItem(target => { target.optionGroupOrder = ids; }, { rerenderPanel: true });
    return;
  }

  const edit = event.target.closest('[data-edit-group]');
  if (edit) {
    openEditor(edit.dataset.editGroup);
    return;
  }
  const detach = event.target.closest('[data-detach-group]');
  if (!detach) return;
  updateItem(
    (item) => {
      removeItemOptionGroup(item, detach.dataset.detachGroup);
    },
    { rerenderPanel: true }
  );
  toast('Valggruppen er fjernet fra produktet.');
});

el.btnAttachGroup.addEventListener('click', () => {
  const { item } = selectedItem();
  if (!item) return;
  attachTargetItemId = item.id;
  renderLibraryModal();
  openModal(el.modalLibrary);
});

el.fMoveCategory.addEventListener('change', () => {
  const { item, section } = selectedItem();
  if (!item || !section) return;
  const targetId = el.fMoveCategory.value;
  if (targetId === section.id) return;
  mutate((state) => {
    const from = state.sections.find((entry) => entry.id === section.id);
    const to = state.sections.find((entry) => entry.id === targetId);
    if (!from || !to) return;
    const index = from.items.findIndex((entry) => entry.id === item.id);
    if (index < 0) return;
    const [moved] = from.items.splice(index, 1);
    to.items.push(moved);
  });
  ui.openCategoryId = targetId;
  ui.focusedCategoryId = targetId;
  renderCategories();
  renderPanel();
  toast('Produktet er flyttet til ny kategori.');
});

el.btnDuplicateProduct.addEventListener('click', () => {
  const { item, section } = selectedItem();
  if (!item || !section) return;
  const copyId = uid('it');
  mutate((state) => {
    const target = state.sections.find((entry) => entry.id === section.id);
    if (!target) return;
    const copy = clone(item);
    copy.id = copyId;
    copy.name = `${item.name} (kopi)`;
    copy.hidden = true;
    copy.sizes = copy.sizes.map((size) => ({ ...size, id: uid('sz') }));
    const index = target.items.findIndex((entry) => entry.id === item.id);
    target.items.splice(index + 1, 0, copy);
  });
  ui.selectedItemId = copyId;
  renderCategories();
  renderPanel();
  toast('Produktet er kopiert som skjult.');
});

el.btnDeleteProduct.addEventListener('click', () => {
  const { item, section } = selectedItem();
  if (!item) return;
  askConfirm(
    'Slette produktet?',
    `«${item.name}» fjernes fra kundemenyen umiddelbart.`,
    () => {
      mutate((state) => {
        const target = state.sections.find((entry) => entry.id === section.id);
        if (target) target.items = target.items.filter((entry) => entry.id !== item.id);
        state.popularItemIds = (state.popularItemIds || []).filter(
          (id) => id !== item.id
        );
      });
      ui.selectedItemId = null;
      renderCategories();
      renderPanel();
      toast('Produktet er slettet.');
    }
  );
});

function closeProductEditor() {
  ui.selectedItemId = null;
  renderCategories();
  renderPanel();
}

el.btnCloseSettings.addEventListener('click', closeProductEditor);
el.productEditorBackdrop.addEventListener('click', closeProductEditor);

/* ------------------------------------------------------------------ *
 * Scroll-spy i høyre panel
 * ------------------------------------------------------------------ */

let chipScrollLock = null;

function editorSectionNodes() {
  return Array.from(el.settingsScroll.querySelectorAll('.set-section[data-section]'));
}

function centerActiveEditorChip(name, behavior = 'smooth') {
  const chip = el.chipNav.querySelector(`[data-chip="${CSS.escape(name)}"]`);
  if (!chip) return;
  const targetLeft = chip.offsetLeft - (el.chipNav.clientWidth - chip.offsetWidth) / 2;
  const maxLeft = Math.max(0, el.chipNav.scrollWidth - el.chipNav.clientWidth);
  el.chipNav.scrollTo({
    left: Math.max(0, Math.min(targetLeft, maxLeft)),
    behavior,
  });
}

function scrollEditorToSection(name, behavior = 'smooth') {
  const target = editorSectionNodes().find((node) => node.dataset.section === name);
  if (!target) return;

  if (chipScrollLock) clearTimeout(chipScrollLock);
  setActiveChip(name);
  centerActiveEditorChip(name, behavior);

  const scrollerRect = el.settingsScroll.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetTop =
    el.settingsScroll.scrollTop + targetRect.top - scrollerRect.top - 8;

  el.settingsScroll.scrollTo({
    top: Math.max(0, targetTop),
    behavior,
  });

  chipScrollLock = setTimeout(() => {
    chipScrollLock = null;
    setActiveChip(name);
  }, behavior === 'smooth' ? 550 : 0);
}

el.chipNav.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  scrollEditorToSection(chip.dataset.chip);
});

function setActiveChip(name) {
  ui.activeChip = name;
  el.chipNav.querySelectorAll('.chip').forEach((chip) => {
    const on = chip.dataset.chip === name;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-selected', String(on));
  });

  editorSectionNodes().forEach((section) => {
    section.classList.toggle('is-focus-target', section.dataset.section === name);
  });
}

el.settingsScroll.addEventListener(
  'scroll',
  () => {
    if (chipScrollLock) return;
    const nodes = editorSectionNodes();
    if (!nodes.length) return;

    const scrollerTop = el.settingsScroll.getBoundingClientRect().top;
    const line = scrollerTop + 28;
    let current = nodes[0];

    for (const node of nodes) {
      if (node.getBoundingClientRect().top <= line) current = node;
    }

    if (current) {
      setActiveChip(current.dataset.section);
      centerActiveEditorChip(current.dataset.section, 'auto');
    }
  },
  { passive: true }
);

/* ------------------------------------------------------------------ *
 * Valggruppe-bibliotek
 * ------------------------------------------------------------------ */


const GROUP_ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const GROUP_PENCIL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h3l9-9-3-3-9 9v3zM14.5 6.5l3 3"/></svg>';
const GROUP_PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const GROUP_TRASH='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>';
function groupChoiceSummary(group) {
  if (group.selectionMode !== 'multiple') return 'Ett valg';
  const max = Number(group.maxSelections);
  return max > 0 ? 'Flere valg · maks ' + max : 'Flere valg';
}
function renderGroupLibrary() {
  el.groupLibrary.classList.toggle('is-list',ui.groupView==='list');
  el.groupLibrary.classList.toggle('is-grid',ui.groupView==='grid');
  el.groupViewBtns.forEach(button=>{
    const active=button.dataset.groupView===ui.groupView;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  const all=store.optionGroups||[];
  const requiredCount=all.filter(g=>Boolean(g.required)).length;
  document.querySelectorAll('[data-group-filter]').forEach(button=>{
    const f=button.dataset.groupFilter;
    const count=f==='required'?requiredCount:f==='optional'?all.length-requiredCount:all.length;
    const name=f==='required'?'Obligatorisk':f==='optional'?'Valgfritt':'Alle';
    button.textContent=name+' ('+count+')';
    button.classList.toggle('is-active',f===ui.groupFilter);
    button.setAttribute('aria-pressed',String(f===ui.groupFilter));
  });
  const needle=ui.groupSearch.toLocaleLowerCase('nb-NO');
  const groups=all.filter(g=>(ui.groupFilter==='all'||Boolean(g.required)===(ui.groupFilter==='required'))
    && (!needle||(g.title||'').toLocaleLowerCase('nb-NO').includes(needle)));
  if(!ui.groupOpenInitialized&&groups.length){
    ui.groupOpenId=groups[0].id;ui.groupOpenInitialized=true;
  }else if(ui.groupOpenId&&groups.length&&!groups.some(g=>g.id===ui.groupOpenId)){
    ui.groupOpenId=groups[0].id;
  }
  el.groupLibrary.innerHTML=groups.length?groups.map(group=>{
    const id=escapeHtml(group.id);
    const title=escapeHtml(group.title||'Uten navn');
    const open=ui.groupOpenId===group.id;
    const options=group.options||[];
    const productCount=countProductsUsingGroup(group.id);
    const required=Boolean(group.required);
    const choiceCount=options.length+' '+(options.length===1?'alternativ':'alternativer');
    const tableId='group-options-'+id;
    return `
      <article class="group-card${open?' is-open':''}" data-library-group="${id}">
        <header class="group-card-head">
          <button class="group-expand-toggle" type="button" data-toggle-library-group="${id}"
             aria-expanded="${open}" aria-controls="${tableId}" aria-label="${open?'Lukk':'Vis'} ${title}">${GROUP_ARROW}</button>
          <button class="group-heading-button" type="button" data-toggle-library-group="${id}"
             aria-expanded="${open}" aria-controls="${tableId}">
            <span class="group-card-name">${title}</span>
            <span class="group-pills">
              <span class="group-pill">${productCount} ${productCount===1?'produkt':'produkter'}</span>
              <span class="group-pill${required?' group-pill-required':''}">${required?'<i class="group-required-dot" aria-hidden="true"></i>Obligatorisk':'Valgfritt'}</span>
              <span class="group-pill">${escapeHtml(groupChoiceSummary(group))}</span>
              ${open?'':`<span class="group-option-count">${choiceCount}</span>`}
            </span>
          </button>
          <div class="group-card-actions">
            <button class="group-action" data-edit-group="${id}" type="button">${GROUP_PENCIL} Rediger</button>
            <button class="group-action" data-add-group-option="${id}" type="button">${GROUP_PLUS} Legg til</button>
            <button class="group-action group-action-delete" data-del-group="${id}" type="button">${GROUP_TRASH} Slett</button>
          </div>
        </header>
        <div class="group-card-detail" id="${tableId}" ${open?'':'hidden'}>
          <div class="group-option-table">
            <div class="group-option-table-head"><span>Alternativer (${options.length})</span><span>Pris / Status</span><span></span></div>
            ${options.length?options.map(option=>`
              <div class="group-option-line" data-library-parent="${id}" data-library-option="${escapeHtml(option.id)}">
                <span class="group-option-grip" draggable="true" data-drag-library-option="${escapeHtml(option.id)}" data-library-parent="${id}" title="Dra for å endre rekkefølgen">⋮⋮</span>
                <span class="group-option-name">${escapeHtml(option.label||'Uten navn')}</span>
                <span class="group-option-price">${Number(option.price)>0?'+'+escapeHtml(formatPrice(option.price)):'Inkludert'}</span>
                <button class="group-option-more" type="button" data-edit-library-option="${escapeHtml(option.id)}" data-library-parent="${id}" aria-label="Rediger alternativ"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
              </div>`).join(''):'<div class="group-option-empty">Ingen alternativer ennå.</div>'}
          </div>
          <button class="group-add-alternative" data-add-group-option="${id}" type="button">
            <span class="group-add-dot">${GROUP_PLUS}</span> Legg til nytt alternativ
          </button>
        </div>
      </article>`;
  }).join(''):'<div class="empty-card group-library-empty"><strong>Ingen valggrupper funnet</strong><p>Prøv et annet søk eller filter, eller lag en ny valggruppe.</p></div>';
}
function addGroupOptionFromLibrary(groupId){
  openEditor(groupId);
  if(!editorDraft)return;
  const newOption={id:uid('opt'),label:'',price:0};
  editorDraft.options.push(newOption);
  renderEditorRows();
  el.gOptionRows.querySelector('[data-label="'+CSS.escape(newOption.id)+'"]')?.focus();
}
el.groupLibrary.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-toggle-library-group]');
  if(toggle){
    const id=toggle.dataset.toggleLibraryGroup;
    ui.groupOpenId=ui.groupOpenId===id?null:id;ui.groupOpenInitialized=true;
    renderGroupLibrary();return;
  }
  const add=event.target.closest('[data-add-group-option]');
  if(add){addGroupOptionFromLibrary(add.dataset.addGroupOption);return;}
  const option=event.target.closest('[data-edit-library-option]');
  if(option){
    openEditor(option.dataset.libraryParent);
    el.gOptionRows.querySelector('[data-label="'+CSS.escape(option.dataset.editLibraryOption)+'"]')?.focus();
    return;
  }
  const edit=event.target.closest('[data-edit-group]');
  if(edit){openEditor(edit.dataset.editGroup);return;}
  const del=event.target.closest('[data-del-group]');
  if(!del)return;
  const group=findOptionGroup(del.dataset.delGroup);
  if(!group)return;
  askConfirm('Slette valggruppen?',`«${group.title}» fjernes fra ${countProductsUsingGroup(group.id)} produkter.`,
    ()=>deleteGroup(group.id));
});
let draggingLibraryOption=null;
el.groupLibrary.addEventListener('dragstart',event=>{
  const grip=event.target.closest('[data-drag-library-option]');
  if(!grip)return;
  draggingLibraryOption={id:grip.dataset.dragLibraryOption,groupId:grip.dataset.libraryParent};
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',draggingLibraryOption.id);
});
el.groupLibrary.addEventListener('dragover',event=>{
  const row=event.target.closest('[data-library-option]');
  if(row&&draggingLibraryOption&&row.dataset.libraryParent===draggingLibraryOption.groupId)
    event.preventDefault();
});
el.groupLibrary.addEventListener('drop',event=>{
  const row=event.target.closest('[data-library-option]');
  const drag=draggingLibraryOption;draggingLibraryOption=null;
  if(!drag||!row||row.dataset.libraryParent!==drag.groupId||row.dataset.libraryOption===drag.id)return;
  event.preventDefault();
  mutate(state=>{
    const group=state.optionGroups.find(g=>g.id===drag.groupId);
    if(!group||!Array.isArray(group.options))return;
    const from=group.options.findIndex(o=>o.id===drag.id);
    const to=group.options.findIndex(o=>o.id===row.dataset.libraryOption);
    if(from<0||to<0)return;
    const [moved]=group.options.splice(from,1);
    group.options.splice(to,0,moved);
  });
  renderGroupLibrary();
  toast('Rekkefølgen er endret.');
});
el.groupLibrary.addEventListener('dragend',()=>{draggingLibraryOption=null;});
document.querySelectorAll('[data-group-filter]').forEach(button=>{
  button.addEventListener('click',()=>{ui.groupFilter=button.dataset.groupFilter;renderGroupLibrary();});
});
el.groupSearch.addEventListener('input',()=>{
  ui.groupSearch=el.groupSearch.value.trim();
  renderGroupLibrary();
});
el.groupViewBtns.forEach(button=>{
  button.addEventListener('click',()=>{
    ui.groupView=button.dataset.groupView==='grid'?'grid':'list';
    try{localStorage.setItem('kol-admin-group-view',ui.groupView);}catch{}
    renderGroupLibrary();
  });
});
el.btnNewGroup.addEventListener('click',()=>openEditor(null));

function renderLibraryModal() {
  const { item } = selectedItem();
  const attached = new Set((item && item.optionGroupIds) || []);
  const groups = store.optionGroups || [];
  el.libraryList.innerHTML = groups.length
    ? groups
        .map(
          (group) => `
      <div class="lib-row">
        <div class="lib-main">
          <strong>${escapeHtml(group.title || 'Uten navn')}</strong>
          <span>${
            group.selectionMode === 'multiple'
              ? `Flere valg · maks ${group.maxSelections}`
              : 'Ett valg'
          } · ${(group.options || []).length} alternativer · brukes av ${countProductsUsingGroup(
            group.id
          )}</span>
        </div>
        ${
          attached.has(group.id)
            ? '<span class="pill pill-ok">Lagt til</span>'
            : `<button class="btn btn-primary btn-xs" data-attach="${escapeHtml(
                group.id
              )}" type="button">Legg til</button>`
        }
      </div>`
        )
        .join('')
    : '<p class="cat-empty">Biblioteket er tomt. Lag en ny valggruppe.</p>';
}

el.libraryList.addEventListener('click', (event) => {
  const attach = event.target.closest('[data-attach]');
  if (!attach || !attachTargetItemId) return;
  const groupId = attach.dataset.attach;
  mutate(() => {
    const { item } = findItem(attachTargetItemId);
    if (!item) return;
    if (!item.optionGroupIds.includes(groupId)) item.optionGroupIds.push(groupId);
  });
  renderPanel();
  renderLibraryModal();
  toast('Valggruppen er lagt til produktet.');
});

el.btnNewGroupFromModal.addEventListener('click', () => {
  closeModals();
  openEditor(null, attachTargetItemId);
});

/* ------------------------------------------------------------------ *
 * Valggruppe-editor
 * ------------------------------------------------------------------ */

function openEditor(groupId, attachToItemId = null) {
  const existing = groupId ? findOptionGroup(groupId) : null;
  editorDraft = existing
    ? { ...clone(existing), isNew: false, attachToItemId }
    : {
        id: uid('og'),
        title: '',
        selectionMode: 'single',
        required: false,
        maxSelections: 1,
        defaultOptionIds: [],
        options: [
          { id: uid('opt'), label: '', price: 0 },
          { id: uid('opt'), label: '', price: 0 },
        ],
        isNew: true,
        attachToItemId,
      };

  el.editorTitle.textContent = existing ? 'Rediger valggruppe' : 'Ny valggruppe';
  el.gTitle.value = editorDraft.title;
  el.gModeSingle.checked = editorDraft.selectionMode === 'single';
  el.gModeMultiple.checked = editorDraft.selectionMode === 'multiple';
  el.gRequired.checked = Boolean(editorDraft.required);
  el.gMax.value = editorDraft.maxSelections || 1;
  el.btnDeleteGroup.hidden = Boolean(editorDraft.isNew);
  el.editorErr.hidden = true;
  renderEditorRows();
  openModal(el.modalEditor);
  el.gTitle.focus();
}

function renderEditorRows() {
  const isMulti = editorDraft.selectionMode === 'multiple';
  el.gMaxWrap.hidden = !isMulti;
  el.gOptionRows.innerHTML = editorDraft.options
    .map(
      (option) => `
    <div class="opt-row-edit" data-option="${escapeHtml(option.id)}">
      <label class="radio-cell">
        <input type="${isMulti ? 'checkbox' : 'radio'}" name="gDefault" data-default="${escapeHtml(
        option.id
      )}" ${
        editorDraft.defaultOptionIds.includes(option.id) ? 'checked' : ''
      } aria-label="Forhåndsvalgt">
      </label>
      <input class="input" type="text" data-label="${escapeHtml(
        option.id
      )}" value="${escapeHtml(option.label)}" placeholder="F.eks. Hvitløksaus">
      <input class="input" type="number" min="0" step="1" data-price="${escapeHtml(
        option.id
      )}" value="${Number(option.price) || 0}">
      <button class="icon-btn is-danger" data-del-option="${escapeHtml(
        option.id
      )}" type="button" aria-label="Fjern alternativet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>
      </button>
    </div>`
    )
    .join('');
}

el.gTitle.addEventListener('input', () => {
  editorDraft.title = el.gTitle.value;
});

[el.gModeSingle, el.gModeMultiple].forEach((radio) => {
  radio.addEventListener('change', () => {
    editorDraft.selectionMode = el.gModeMultiple.checked ? 'multiple' : 'single';
    if (editorDraft.selectionMode === 'single') {
      editorDraft.maxSelections = 1;
      editorDraft.defaultOptionIds = editorDraft.defaultOptionIds.slice(0, 1);
    } else {
      editorDraft.maxSelections = Math.max(
        Number(el.gMax.value) || 2,
        1
      );
      el.gMax.value = editorDraft.maxSelections;
    }
    renderEditorRows();
  });
});

el.gRequired.addEventListener('change', () => {
  editorDraft.required = el.gRequired.checked;
});

el.gMax.addEventListener('input', () => {
  editorDraft.maxSelections = Math.max(1, Number(el.gMax.value) || 1);
});

el.gOptionRows.addEventListener('input', (event) => {
  const labelId = event.target.dataset.label;
  const priceId = event.target.dataset.price;
  if (!labelId && !priceId) return;
  const option = editorDraft.options.find(
    (entry) => entry.id === (labelId || priceId)
  );
  if (!option) return;
  if (labelId) option.label = event.target.value;
  else option.price = Math.max(0, Number(event.target.value) || 0);
});

el.gOptionRows.addEventListener('change', (event) => {
  const defaultId = event.target.dataset.default;
  if (!defaultId) return;
  if (editorDraft.selectionMode === 'single') {
    editorDraft.defaultOptionIds = [defaultId];
  } else {
    const set = new Set(editorDraft.defaultOptionIds);
    if (event.target.checked) set.add(defaultId);
    else set.delete(defaultId);
    editorDraft.defaultOptionIds = Array.from(set);
  }
});

el.gOptionRows.addEventListener('click', (event) => {
  const del = event.target.closest('[data-del-option]');
  if (!del) return;
  if (editorDraft.options.length <= 1) {
    toast('Gruppen må ha minst ett alternativ.');
    return;
  }
  const optionId = del.dataset.delOption;
  editorDraft.options = editorDraft.options.filter((entry) => entry.id !== optionId);
  editorDraft.defaultOptionIds = editorDraft.defaultOptionIds.filter(
    (id) => id !== optionId
  );
  renderEditorRows();
});

el.btnAddOption.addEventListener('click', () => {
  editorDraft.options.push({ id: uid('opt'), label: '', price: 0 });
  renderEditorRows();
});

el.btnSaveGroup.addEventListener('click', () => {
  const title = (editorDraft.title || '').trim();
  const options = editorDraft.options
    .map((option) => ({ ...option, label: (option.label || '').trim() }))
    .filter((option) => option.label);

  if (!title) {
    el.editorErr.textContent = 'Valggruppen må ha et navn.';
    el.editorErr.hidden = false;
    return;
  }
  if (!options.length) {
    el.editorErr.textContent = 'Legg til minst ett alternativ med navn.';
    el.editorErr.hidden = false;
    return;
  }

  const validIds = new Set(options.map((option) => option.id));
  let defaults = editorDraft.defaultOptionIds.filter((id) => validIds.has(id));
  if (editorDraft.selectionMode === 'single') defaults = defaults.slice(0, 1);
  if (editorDraft.required && editorDraft.selectionMode === 'single' && !defaults.length) {
    defaults = [options[0].id];
  }

  const payload = {
    id: editorDraft.id,
    title,
    selectionMode: editorDraft.selectionMode,
    required: Boolean(editorDraft.required),
    maxSelections:
      editorDraft.selectionMode === 'single'
        ? 1
        : Math.min(Math.max(Number(editorDraft.maxSelections) || 1, 1), options.length),
    defaultOptionIds: defaults,
    options,
  };

  const attachTo = editorDraft.attachToItemId;
  const isNew = editorDraft.isNew;

  mutate((state) => {
    const index = state.optionGroups.findIndex((group) => group.id === payload.id);
    if (index >= 0) state.optionGroups[index] = payload;
    else state.optionGroups.push(payload);

    if (attachTo) {
      const { item } = findItem(attachTo);
      if (item && !item.optionGroupIds.includes(payload.id)) {
        item.optionGroupIds.push(payload.id);
      }
    }
  });

  editorDraft = null;
  closeModals();
  renderAll();
  toast(isNew ? 'Valggruppen er opprettet.' : 'Valggruppen er oppdatert.');
});

el.btnDeleteGroup.addEventListener('click', () => {
  const groupId = editorDraft && editorDraft.id;
  if (!groupId) return;
  const used = countProductsUsingGroup(groupId);
  askConfirm(
    'Slette valggruppen?',
    `Gruppen fjernes fra ${used} produkter og kan ikke gjenopprettes.`,
    () => {
      closeModals();
      deleteGroup(groupId);
    }
  );
});

function deleteGroup(groupId) {
  mutate((state) => {
    state.optionGroups = state.optionGroups.filter((group) => group.id !== groupId);
    for (const section of state.sections) {
      for (const item of section.items) {
        removeItemOptionGroup(item, groupId);
      }
    }
  });
  editorDraft = null;
  renderAll();
  toast('Valggruppen er slettet.');
}

/* ------------------------------------------------------------------ *
 * Bestillinger
 * ------------------------------------------------------------------ */

const pendingOrderMinutes = new Map();
const acknowledgedOrders = new Set();
const activeOrderSounds = new Set();
let acceptedDetailCloseTimer = null;
let orderAudio = null;
let orderMp3 = null;
let orderMp3Url = '';
let failedOrderMp3Url = '';
let orderAlarmPreview = null;
function validOrderAlarmUrl(value) {
  if (!value.trim()) return '';
  try { const url = new URL(value.trim(), location.href); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
const ORDER_SOUND_KEY = 'bestill_admin_order_sound';
let orderSoundEnabled = true;
try { orderSoundEnabled = localStorage.getItem(ORDER_SOUND_KEY) !== 'off'; } catch {}
let orderSoundBlocked = false;
let orderMp3Starting = false;
function renderOrderSoundPreference() {
  const button = document.getElementById('btnOrderSound');
  button.setAttribute('aria-pressed', String(orderSoundEnabled));
  button.classList.toggle('is-on', orderSoundEnabled && !orderSoundBlocked);
  button.classList.toggle('is-warning', orderSoundEnabled && orderSoundBlocked);
  button.classList.toggle('is-muted', !orderSoundEnabled);
  const info = orderSoundEnabled
    ? (orderSoundBlocked ? 'Bestillingslyd er på, men nettleseren venter på et klikk for å tillate lyd.' : 'Bestillingslyd er på · trykk for å slå av.')
    : 'Bestillingslyd er av · trykk for å slå på.';
  button.querySelector('.orders-light-tooltip').textContent = info;
  button.title = info;
  button.setAttribute('aria-label',orderSoundEnabled ? 'Bestillingslyd på – slå av' : 'Bestillingslyd av – slå på');
}
renderOrderSoundPreference();
async function unlockOrderSound() {
  if (!orderSoundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!orderAudio && AudioContextClass) orderAudio = new AudioContextClass();
    if (orderAudio?.state !== 'running') await orderAudio?.resume();
  } catch {}
  orderSoundBlocked = false;
  renderOrderSoundPreference();
  if (getOrders().some(order => order.status === 'mottatt' && !confirmationExpired(order))) playOrderAlert();
}
function unlockOrderSoundFromGesture(event) {
  if (event.target.closest?.('#btnOrderSound')) return;
  void unlockOrderSound();
}
document.addEventListener('pointerdown', unlockOrderSoundFromGesture);
document.addEventListener('keydown', unlockOrderSoundFromGesture);
function playOrderAlert() {
  if (!orderSoundEnabled) return;
  const url = validOrderAlarmUrl(String(store.settings?.orderAlarmUrl || ''));
  if (url && url !== failedOrderMp3Url) {
    if (!orderMp3 || orderMp3Url !== url) {
      orderMp3?.pause();
      orderMp3 = new Audio(url); orderMp3Url = url; orderMp3.loop = true;
      orderMp3.onerror = () => { failedOrderMp3Url = url; orderMp3?.pause(); toast('MP3-filen kunne ikke spilles. Standardalarmen brukes.'); playOrderAlert(); };
    }
    if (orderMp3.paused && !orderMp3Starting && !orderSoundBlocked) {
      const clip = orderMp3;
      orderMp3Starting = true;
      clip.play().then(() => {
        if (!orderSoundEnabled || clip !== orderMp3 || !getOrders().some(order => order.status === 'mottatt' && !confirmationExpired(order))) clip.pause();
        orderSoundBlocked = false;
        renderOrderSoundPreference();
      }).catch(error => {
        if (clip !== orderMp3 || !orderSoundEnabled) return;
        if (error.name === 'NotAllowedError') {
          orderSoundBlocked = true;
          renderOrderSoundPreference();
          return;
        }
        if (error.name === 'AbortError') return;
        failedOrderMp3Url = url;
        toast('MP3-filen kunne ikke spilles. Standardalarmen brukes.');
        playOrderAlert();
      }).finally(() => { orderMp3Starting = false; });
    }
    return;
  }
  orderMp3?.pause();
  if (!orderSoundEnabled || !orderAudio || orderAudio.state !== 'running' || activeOrderSounds.size) return;
  const oscillator = orderAudio.createOscillator();
  const gain = orderAudio.createGain();
  activeOrderSounds.add(oscillator);
  oscillator.onended = () => { activeOrderSounds.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.connect(gain); gain.connect(orderAudio.destination);
  oscillator.frequency.setValueAtTime(660, orderAudio.currentTime);
  oscillator.frequency.setValueAtTime(880, orderAudio.currentTime + .18);
  gain.gain.setValueAtTime(.12, orderAudio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, orderAudio.currentTime + .6);
  oscillator.start(); oscillator.stop(orderAudio.currentTime + .6);
}
document.getElementById('btnOrderSound').addEventListener('click', async () => {
  orderSoundEnabled = !orderSoundEnabled;
  try { localStorage.setItem(ORDER_SOUND_KEY, orderSoundEnabled ? 'on' : 'off'); } catch {}
  renderOrderSoundPreference();
  if (orderSoundEnabled) { failedOrderMp3Url = ''; await unlockOrderSound(); }
  else { orderSoundBlocked = false; stopOrderAlert(); }
});
function stopOrderAlert() {
  orderMp3?.pause();
  if (orderMp3) orderMp3.currentTime = 0;
  for (const oscillator of activeOrderSounds) { try { oscillator.stop(); } catch {} }
  activeOrderSounds.clear();
}
window.setInterval(() => {
  if (getOrders().some(order => order.status === 'mottatt' && !confirmationExpired(order))) playOrderAlert();
  else stopOrderAlert();
}, 2000);
function syncOrdersWorkspaceLayout() {
  document.querySelector('.orders-app')?.classList.toggle('has-selection', Boolean(selectedOrderId));
}
// Use the precise pickup timestamp saved with the order, falling back to
// the creation date for older scheduled orders without scheduledPickupAt.
function scheduledPickupTimestamp(order) {
  if (!order || !isScheduledPickupOrder(order)) return null;
  const saved = Number(order.scheduledPickupAt);
  if (Number.isFinite(saved) && saved > 0) return saved;
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(order.pickup || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const parsed = Number(order.createdAt) || Date.parse(order.createdAt);
  const createdAt = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  const pickup = new Date(createdAt);
  pickup.setHours(hour, minute, 0, 0);
  if (pickup.getTime() <= createdAt) pickup.setDate(pickup.getDate() + 1);
  return pickup.getTime();
}

function isUpcomingScheduledOrder(order) {
  const pickupAt = scheduledPickupTimestamp(order);
  // "Planlagte" is only for future pickup times. Past orders remain in "Alle".
  return ['mottatt', 'bekreftet', 'tilberedning', 'klar'].includes(order?.status)
    && pickupAt !== null && pickupAt > Date.now();
}

function filteredOrders() {
  const query = (document.getElementById('orderSearch')?.value || '').trim().toLocaleLowerCase('nb-NO');
  return getOrders().filter(order =>
    (ui.orderFilter !== 'scheduled' || isUpcomingScheduledOrder(order))
    && (!query || [order.id, order.customerName, order.phone, order.pickup]
      .some(value => String(value || '').toLocaleLowerCase('nb-NO').includes(query)))
  );
}
document.getElementById('orderSearch').addEventListener('input', renderOrderList);
function pendingWait(order) {
  return confirmationExpired(order) ? 'Svarfristen er ute' : `Ny · ${confirmationRemaining(order)} igjen`;
}
function compactOrderTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function orderCountdown(order) {
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return '';
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function orderSummaryCountdown(order) {
  const readyAt = isScheduledPickupOrder(order)
    ? scheduledPickupTimestamp(order)
    : Number(order.estimatedReadyAt) || 0;
  if (!readyAt) return '';
  return orderCountdown({ estimatedReadyAt: readyAt });
}
function orderListStatus(order) {
  if (order.status === 'mottatt') return pendingWait(order);
  if (order.status === 'bekreftet') return 'Godtatt';
  if (order.status === 'tilberedning') return 'Tilberedes';
  if (order.status === 'klar') return 'Klar for henting';
  if (order.status === 'avvist') return order.rejectionCode === 'confirmation_timeout' ? 'Avbrutt · ingen bekreftelse' : 'Avvist';
  if (order.status === 'fullfort') return 'Ferdig';
  return orderStatusLabel(order.status);
}

function orderCenterText(order) {
  if (order.status === 'klar') return 'Klar for henting';
  if (order.status === 'mottatt') return pendingWait(order);
  if (isUpcomingScheduledOrder(order) && ['bekreftet', 'tilberedning'].includes(order.status)) {
    const pickupAt = scheduledPickupTimestamp(order);
    const remaining = pickupAt - Date.now();
    const label = order.status === 'bekreftet' ? 'Godtatt' : 'Tilberedes';
    if (remaining <= 0) return label + ' · Hentetid nå';
    const minutesLeft = Math.ceil(remaining / 60000);
    const days = Math.floor(minutesLeft / 1440);
    const hours = Math.floor((minutesLeft % 1440) / 60);
    const minutes = minutesLeft % 60;
    const duration = days ? days + ' d ' + hours + ' t'
      : hours ? hours + ' t ' + minutes + ' min' : minutes + ' min';
    return label + ' · ' + duration + ' igjen';
  }
  if (['bekreftet', 'tilberedning'].includes(order.status)) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    const label = order.status === 'bekreftet' ? 'Godtatt' : 'Tilberedes';
    if (readyAt) {
      const remainingMs = readyAt - Date.now();
      if (remainingMs <= 0) return `${label} · Tid utløpt`;
      const seconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${label} · ${minutes}:${String(secs).padStart(2, '0')} igjen`;
    }
    return label;
  }
  return orderListStatus(order);
}


function shortOrderCode(order) {
  return '#' + String(order.id || '').slice(-6).toUpperCase();
}

function orderListPickupTime(order) {
  // SENERE has a customer-chosen pickup time, even before staff acceptance.
  if (isScheduledPickupOrder(order)) {
    const selected = String(order.pickup || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(selected)) return selected;
    const scheduledAt = Number(order.scheduledPickupAt) || 0;
    return scheduledAt > 0 ? compactOrderTime(scheduledAt) : '—';
  }

  // SNAREST shows when the order will be ready, never when it was received.
  const readyAt = Number(order.estimatedReadyAt) || 0;
  if (readyAt > 0) return compactOrderTime(readyAt);

  // Recover older orders where only the estimate start and minutes were stored.
  const estimatedAt = Number(order.estimatedAt) || 0;
  const minutes = Number(order.estimatedMinutes) || 0;
  return estimatedAt > 0 && minutes > 0
    ? compactOrderTime(estimatedAt + minutes * 60000)
    : '—'; // No pickup time exists until the ASAP order is accepted.
}

function orderListRemainingTime(order) {
  if (['fullfort', 'avvist'].includes(order.status)) return '';
  if (order.status === 'klar') return 'Klar nå';
  const pickupAt = isScheduledPickupOrder(order) ? scheduledPickupTimestamp(order) : (
    Number(order.estimatedReadyAt) ||
    (Number(order.estimatedAt) > 0 && Number(order.estimatedMinutes) > 0
      ? Number(order.estimatedAt) + Number(order.estimatedMinutes) * 60000
      : 0)
  );
  if (!pickupAt) return '';
  const milliseconds = pickupAt - Date.now();
  if (milliseconds <= 0) return 'Tid utløpt';
  if (milliseconds < 60000) return Math.ceil(milliseconds / 1000) + ' sek';
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes < 60) return minutes + ' min';
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + ' t' + (rest ? ' ' + rest + ' m' : '');
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.ceil((minutes % 1440) / 60);
  return days + ' d' + (hours ? ' ' + hours + ' t' : '');
}

function orderListRowHtml(order, isNew = false) {
  const pickupScheduled = isScheduledPickupOrder(order);
  const displayTime = orderListPickupTime(order);
  const timeTitle = pickupScheduled ? 'Valgt hentetid' : (displayTime === '—' ? 'Hentetid ikke satt ennå' : 'Estimert hentetid');
  const pickupLabel = pickupScheduled ? 'SENERE' : 'SNAREST';
  const remainingTime = orderListRemainingTime(order);
  return `<button data-order-status="${escapeHtml(order.status)}" class="orders-list-row${isNew ? ' is-new' : ''}${acknowledgedOrders.has(order.id) ? ' is-seen' : ''}${order.id === selectedOrderId ? ' is-selected' : ''}${isUpcomingScheduledOrder(order) ? ' is-scheduled' : ''}" data-select-order="${escapeHtml(order.id)}" type="button" aria-pressed="${order.id === selectedOrderId}">
    <span class="orders-list-main">
      <span class="orders-list-name-row"><strong>${escapeHtml(order.customerName || 'Ukjent kunde')}</strong><span class="orders-row-sms" data-order-sms="${escapeHtml(order.id)}" title="SMS ble sendt via Traccar" aria-label="SMS ble sendt via Traccar" ${smsReceiptSent(order.id) ? '' : 'hidden'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="15" rx="3"/><path d="M7 9h10M7 13h6"/><path d="m15 17 2 2 4-4"/></svg></span>${isNew ? '<b class="orders-new-pill">NY</b>' : ''}</span>
      <span class="orders-list-meta">
        <span class="orders-list-method"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V7a5 5 0 0 1 10 0v2"/><path d="M5 9h14l-1 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9Z"/></svg><span>${pickupLabel}</span></span>
        <span class="orders-list-divider" aria-hidden="true"></span>
        <span class="orders-list-time" title="${escapeHtml(timeTitle)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>${escapeHtml(displayTime)}</span><span class="orders-list-remaining" data-order-remaining="${escapeHtml(order.id)}" ${remainingTime ? '' : 'hidden'}>${escapeHtml(remainingTime)}</span></span>
      </span>
    </span>
    <span class="orders-list-price">${formatPrice(order.total)}</span>
    <span class="orders-list-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 4 8 8-8 8"/></svg></span>
    <span class="orders-list-center" data-order-center="${escapeHtml(order.id)}">${escapeHtml(orderCenterText(order))}</span>
  </button>`;
}

function renderOrderTabs(allOrders) {
  const scheduledCount = allOrders.filter(isUpcomingScheduledOrder).length;
  el.orderFilterBtns.forEach(button => {
    const active = button.dataset.orderFilter === ui.orderFilter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    const count = button.querySelector('b');
    if (count) count.textContent = String(button.dataset.orderFilter === 'scheduled' ? scheduledCount : allOrders.length);
  });
}
function renderOrderList() {
  // Keep the employee's place when Firebase refreshes the order list.
  const previousScrollTop = el.orderList.scrollTop;
  const orders = filteredOrders().sort((a, b) => {
    if (ui.orderFilter === 'scheduled') {
      return (scheduledPickupTimestamp(a) ?? Infinity) - (scheduledPickupTimestamp(b) ?? Infinity)
        || Number(a.createdAt || 0) - Number(b.createdAt || 0);
    }
    // ALLE: Sort exclusively by received time (Mottatt), newest first.
    // Scheduled pickup, estimated ready time and order status have no priority here.
    return (Number(b.createdAt) || Date.parse(b.createdAt) || 0)
      - (Number(a.createdAt) || Date.parse(a.createdAt) || 0)
      || String(b.id || '').localeCompare(String(a.id || ''));
  });
  el.orderList.innerHTML = orders.map((order) => orderListRowHtml(order, order.status === 'mottatt')).join('') || '<div class="orders-list-empty"><strong>Ingen bestillinger</strong><span>' + (ui.orderFilter === 'scheduled' ? 'Ingen aktive planlagte hentinger.' : 'Ingen bestillinger å vise.') + '</span></div>';
  el.orderList.scrollTop = previousScrollTop;
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
        ${line.loyaltyFree ? '<small class="order-bonus-label">Gratis pizza</small>' : ''}
        ${line.size ? `<small>${escapeHtml(line.size)}</small>` : ''}
        ${optionText.length ? `<small>${optionText.map((item) => escapeHtml(item)).join(' · ')}</small>` : ''}
        ${Array.isArray(line.removedIngredients) && line.removedIngredients.length ? `<small class="pos-order-removed">UTEN: ${line.removedIngredients.map((name) => escapeHtml(String(name).toLocaleUpperCase('no'))).join(', ')}</small>` : ''}
        ${getDisplayComment(line) ? `<small class="pos-order-note">${escapeHtml(getDisplayComment(line))}</small>` : ''}
      </div>
      <b>${formatPrice(line.price)}</b>
    </div>`;
}

function renderOrderDetail(orderId) {
  const previousDetail = el.orderDetailLive.querySelector('[data-order-detail-id]');
  const scrollTop = previousDetail?.dataset.orderDetailId === orderId ? (el.orderDetailLive.querySelector('.pos-detail-scroll')?.scrollTop || 0) : 0;
  const editing = el.orderDetailLive.querySelector('[data-detail-estimate]');
  const draft = editing && document.activeElement === editing ? { id: selectedOrderId, value: editing.value } : null;
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) {
    selectedOrderId = null;
    el.orderDetailEmpty.hidden = false;
    el.orderDetailLive.hidden = true;
    el.orderDetailLive.innerHTML = '';
    return;
  }
  selectedOrderId = order.id;
  // Older orders may have been saved in the original add-to-cart order.
  const sortedLines = sortCartByCategory(order.lines || [], store.sections);
  const estimated = Math.max(0, Number(order.estimatedMinutes) || 0);
  const isPending = order.status === 'mottatt';
  const scheduledPickup = isScheduledPickupOrder(order);
  const phone = String(order.phone || '').trim();
  const tel = phone.replace(/[^+\d]/g, '');
  const proposedMinutes = pendingOrderMinutes.get(order.id) || 15;
  const readyTime = scheduledPickup ? String(order.pickup || '—') : compactOrderTime(order.estimatedReadyAt);
  const pickupModeLabel = scheduledPickup ? 'SENERE' : 'SNAREST';
  const readinessCountdown = orderSummaryCountdown(order);
  const actionHtml = isPending
    ? `<div class="order-preparation">${scheduledPickup
        ? `<strong>Henting ${escapeHtml(order.pickup)}</strong>`
        : `<span class="order-preparation-label"><span class="order-preparation-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg></span>Klar om</span><div class="order-minute-buttons" aria-label="Forberedelsestid">${[10,15,20,30].map(minutes => `<button data-order-minutes="${minutes}" class="${proposedMinutes === minutes ? 'is-active' : ''}" aria-pressed="${proposedMinutes === minutes}" type="button">${minutes} min</button>`).join('')}<button data-open-accept="${escapeHtml(order.id)}" type="button">Annen tid</button></div>`}</div>
      <div class="order-decision-buttons"><button class="pos-reject-btn" data-open-reject="${escapeHtml(order.id)}" type="button">Avvis</button>
      <button class="pos-accept-btn" data-accept-inline="${escapeHtml(order.id)}" type="button">Godta · ${scheduledPickup ? escapeHtml(order.pickup) : `${proposedMinutes} min`}</button></div>`
    : ['avvist', 'fullfort'].includes(order.status)
      ? `<div class="pos-closed-status">${escapeHtml(orderListStatus(order))}</div>`
      : `<div class="order-ready-summary"><span class="order-ready-clock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><strong>${order.status === 'klar' ? 'Klar for henting' : `${pickupModeLabel} ${readyTime}`}</strong>${order.status !== 'klar' && readinessCountdown ? `<span data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(readinessCountdown)}</span>` : ''}${!scheduledPickup && order.status !== 'klar' ? `<button data-edit-order-time type="button">Endre tid</button>` : ''}</div>
        <div class="pos-progress-actions"><button data-detail-status="${order.status === 'klar' ? 'fullfort' : 'klar'}" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>${order.status === 'klar' ? 'Utlevert · fullfør bestilling' : 'Marker klar for henting'}</button></div>`;
  el.orderDetailEmpty.hidden = true;
  el.orderDetailLive.hidden = false;
  el.orderDetailLive.innerHTML = `
    <article class="pos-order-detail" data-order-detail-id="${escapeHtml(order.id)}">
      <header class="pos-detail-top">
        <button class="pos-detail-close" data-close-order-detail type="button" aria-label="Lukk bestillingsdetaljer" title="Lukk bestillingsdetaljer">×</button>
        <section class="order-facts" aria-label="Bestillingsinformasjon">
          <div class="order-fact-received"><span class="order-fact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg></span><div class="order-fact-copy"><span>Mottatt</span><strong>${escapeHtml(timeStamp(order.createdAt))}</strong></div></div>
          ${phone ? `<a class="order-call" href="tel:${escapeHtml(tel)}" aria-label="Ring ${escapeHtml(phone)}"><span class="order-fact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.48-1.29a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92Z"/></svg></span><span class="order-fact-copy"><span>Telefonnummer</span><strong>${escapeHtml(phone)}</strong></span></a>` : `<div><span class="order-fact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.48-1.29a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92Z"/></svg></span><div class="order-fact-copy"><span>Telefonnummer</span><strong>Ikke oppgitt</strong></div></div>`}
        </section>
        <span class="order-status-badge pos-header-status" data-status="${escapeHtml(order.status)}">${isPending ? `<span data-pending-countdown="${escapeHtml(order.id)}">${escapeHtml(pendingWait(order))}</span>` : escapeHtml(orderListStatus(order))}</span>
        <div class="pos-detail-heading">
          <div class="order-customer-heading order-customer-heading--centered">
            <div class="order-customer-title"><h2>${escapeHtml(order.customerName || 'Ukjent kunde')}</h2><div class="order-detail-code">Bestillingskode <strong>${escapeHtml(shortOrderCode(order))}</strong></div><div class="pos-detail-sms-feedback" data-detail-sms="${escapeHtml(order.id)}" ${smsReceiptSent(order.id) ? '' : 'hidden'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2l4 3v-3"/><path d="m14 17 2 2 5-5"/></svg><span data-detail-sms-label>${escapeHtml(smsReceiptDetail(order.id))}</span></div></div>
            <span class="order-header-divider" aria-hidden="true"></span>
          </div>
        </div>
      </header>
      <div class="pos-detail-scroll">

        <section class="pos-items-block">
          <div class="pos-items-heading"><h3>Bestilte varer</h3><span>${sortedLines.reduce((sum, line) => sum + Math.max(1, Number(line.quantity) || 1), 0)} varer</span></div>
          <div class="pos-order-lines">${sortedLines.map(detailLineHtml).join('')}</div>
          ${order.rejectionReason ? `<div class="pos-order-general-note">Avvist: ${escapeHtml(order.rejectionReason)}${order.rejectionMessage ? ` · ${escapeHtml(order.rejectionMessage)}` : ''}</div>` : ''}
          ${order.comment ? `<div class="pos-order-general-note">${escapeHtml(order.comment)}</div>` : ''}
        </section>
        ${!isPending && !scheduledPickup && ['bekreftet', 'tilberedning'].includes(order.status) ? `
          <section class="pos-estimate-editor" ${draft ? '' : 'hidden'}>
            <label><input data-detail-estimate aria-label="Forventet tid i minutter" autocomplete="off" type="number" min="1" max="180" step="1" value="${estimated || ''}" placeholder="15"><b>min</b></label>
            <button data-save-detail-estimate="${escapeHtml(order.id)}" type="button">Oppdater tid</button>
          </section>` : ''}
      </div>
      <footer class="pos-detail-actions">${actionHtml}</footer>
    </article>`;
  el.orderDetailLive.querySelector('.pos-detail-scroll').scrollTop = scrollTop;
  if (draft?.id === order.id) {
    const input = el.orderDetailLive.querySelector('[data-detail-estimate]');
    if (input) { input.value = draft.value; input.focus({ preventScroll: true }); }
  }
}


/* Reads only non-sensitive sender health info from an optional backend.
   Green requires a fresh (<90s) verified gateway heartbeat AND enabled sending.
   Manual SMS tests do not turn automatic-order SMS green. */
let smsStatusFetching = false;

/* No phone heartbeat or MacroDroid: Android battery/internet are checked manually. */
function displaySmsStatus(mode, text, help) {
  const badge = document.getElementById('ordersSmsStatus');
  if (!badge) return;
  badge.classList.toggle('is-pending', mode === 'pending');
  badge.classList.toggle('is-active', mode === 'active');
  badge.classList.toggle('is-error', mode === 'error');
  badge.querySelector('[data-sms-status-text]').textContent = text + ' · ' + help;
  badge.title = text + ': ' + help;
  badge.setAttribute('aria-label', 'SMS: ' + text);
}
async function refreshSmsStatus() {
  const configured = String(window.BESTILL_CONFIG?.smsStatusUrl || '').trim();
  if (!configured) {
    displaySmsStatus('pending','SMS ikke aktiv','Traccar sendte en test-SMS, men automatisk ordrebekreftelse er ikke koblet til.');
    return;
  }
  if (smsStatusFetching) return;
  smsStatusFetching = true;
  try {
    const endpoint = new URL(configured, location.href);
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && endpoint.origin === location.origin)) {
      throw new Error('Invalid SMS URL');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response;
    try {
      response = await fetch(endpoint.href, {cache:'no-store',credentials:'omit',signal:controller.signal});
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('SMS status failure');
    const status = await response.json();
    const age = Date.now() - Date.parse(String(status?.lastGatewayCheckAt || ''));
    const online = status?.smsEnabled === true && status?.gatewayOnline === true
      && Number.isFinite(age) && age >= 0 && age < 90000;
    if (online) {
      displaySmsStatus('active','SMS API aktiv','Apps Script kjører i LIVE og Traccar har nylig godtatt en SMS. Samsungs strøm og internett kontrolleres ikke fra panelet.');
    } else if (status?.smsEnabled === true) {
      displaySmsStatus('error','SMS frakoblet','SMS er aktivert, men tilkoblingen er ikke bekreftet.');
    } else {
      displaySmsStatus('pending','SMS ikke aktiv','Automatisk SMS er ennå ikke aktivert.');
    }
  } catch (_) {
    displaySmsStatus('error','SMS utilgjengelig','Kunne ikke kontakte SMS-statusserveren.');
  } finally { smsStatusFetching = false; }
}
void refreshSmsStatus();
window.setInterval(refreshSmsStatus, 45000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshSmsStatus();
});


/* The list shows actual successful gateway submissions, never guessed SMS status. */
const smsReceiptCache = new Map();
let smsReceiptFetching = false;
function smsReceiptSent(id) {
  const receipt = smsReceiptCache.get(String(id));
  return Boolean(receipt && (receipt.acceptedAt || receipt.readyAt || receipt.estimateUpdatedAt));
}
function smsReceiptDetail(id) {
  const r = smsReceiptCache.get(String(id));
  if (!r) return '';
  const types = [];
  if (r.acceptedAt) types.push('Bekreftelse');
  if (r.estimateUpdatedAt) types.push('Endret hentetid');
  if (r.readyAt) types.push('Klar for henting');
  return types.length ? 'SMS ble sendt · ' + types.join(' · ') : '';
}
function updateSmsReceiptMarkers() {
  document.querySelectorAll('[data-order-sms]').forEach(node => {
    node.hidden = !smsReceiptSent(node.dataset.orderSms);
  });
  document.querySelectorAll('[data-detail-sms]').forEach(node => {
    const id = node.dataset.detailSms;
    node.hidden = !smsReceiptSent(id);
    const label = node.querySelector('[data-detail-sms-label]');
    if (label) label.textContent = smsReceiptDetail(id);
  });
}
async function refreshSmsReceipts() {
  if (document.hidden || smsReceiptFetching || ui.page !== 'orders') return;
  const visible = filteredOrders()
    .filter(o => o.status !== 'mottatt' && /^ord_[a-z0-9]{7,40}$/i.test(o.id))
    .sort((a,b) => (Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  const ids = visible.slice(0,39).map(o=>o.id);
  if (selectedOrderId && /^ord_[a-z0-9]{7,40}$/i.test(selectedOrderId) && !ids.includes(selectedOrderId)) ids.push(selectedOrderId);
  if (!ids.length) return;
  smsReceiptFetching = true;
  try {
    const query = new URLSearchParams({ids:ids.join(',')});
    const response = await fetch('https://pizzano-github-io.vercel.app/api/sms-receipts?' + query,
      {cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(7500)});
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload || !payload.receipts || typeof payload.receipts !== 'object') return;
    for (const id of ids) {
      const info = payload.receipts[id];
      if (!info || typeof info !== 'object') continue;
      const time = key => Number.isSafeInteger(Number(info[key])) && Number(info[key]) > 0 ? Number(info[key]) : null;
      smsReceiptCache.set(id, {acceptedAt:time('acceptedAt'),readyAt:time('readyAt'),estimateUpdatedAt:time('estimateUpdatedAt')});
    }
    updateSmsReceiptMarkers();
  } catch (_) {
    // Missing receipts must never be shown as successfully sent.
  } finally { smsReceiptFetching = false; }
}
window.setInterval(() => { void refreshSmsReceipts(); }, 25000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshSmsReceipts(); });

function updateOrdersConnection() {
  const connection = document.getElementById('ordersConnection');
  const connected = navigator.onLine && backendInfo.mode === 'firebase';
  connection.classList.toggle('is-offline', !connected);
  connection.classList.toggle('is-on', connected);
  const detail = connected
    ? 'Nettleseren er på nett og Firebase er konfigurert. Dette er ikke en egen Firebase-helsetest.'
    : 'Nettleseren har ingen nettforbindelse eller Firebase er ikke tilgjengelig som datakilde.';
  connection.querySelector('[data-light-net-text]').textContent = (connected ? 'Nettilkobling' : 'Nett frakoblet') + ' · ' + detail;
  connection.title = detail;
  connection.setAttribute('aria-label',connected ? 'Nett: tilkoblet' : 'Nett: frakoblet');
}
function renderOrders() {
  const all = getOrders();
  if (all.some(order => order.status === 'mottatt' && !confirmationExpired(order))) playOrderAlert();
  else stopOrderAlert();
  updateOrdersConnection();
  renderOrderTabs(all);
  el.ordersSummary.textContent = `${all.length} bestillinger · ${all.filter((order) => order.status === 'mottatt').length} nye`;
  const visible = filteredOrders();

  if (selectedOrderId && !visible.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = null;
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
  void refreshSmsReceipts();
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
  clearTimeout(acceptedDetailCloseTimer);
  selectedOrderId = row.dataset.selectOrder;
  acknowledgedOrders.add(selectedOrderId);
  renderOrders();
});

function isScheduledPickupOrder(order) {
  if (!order) return false;
  if (order.pickupMode === 'scheduled') return true;
  return /^(\d{1,2}):(\d{2})$/.test(String(order.pickup || '').trim());
}

function openAcceptOrder(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order || order.status !== 'mottatt') { toast('Bestillingen er allerede behandlet.'); return; }
  actionOrderId = order.id;
  const shortId = String(order.id).slice(-6).toUpperCase();
  const scheduled = isScheduledPickupOrder(order);
  el.acceptOrderTitle.textContent = `Godta #${shortId}`;
  el.scheduledAcceptCard.hidden = !scheduled;
  el.acceptQuickTimes.hidden = scheduled;
  el.acceptManualTime.hidden = scheduled;
  if (scheduled) {
    const pickupTime = String(order.pickup || '').trim();
    el.acceptTimeEyebrow.textContent = 'HENTETID';
    el.acceptTimeLead.textContent = 'Kunden har allerede valgt hentetid. Godta bestillingen uten å sette ekstra minutter.';
    el.scheduledAcceptTime.textContent = pickupTime || 'Planlagt';
    el.btnAcceptConfirm.textContent = pickupTime ? `Godta · henting ${pickupTime}` : 'Godta bestilling';
  } else {
    el.acceptTimeEyebrow.textContent = 'FORVENTET TID';
    el.acceptTimeLead.textContent = 'Velg hvor mange minutter kunden skal se.';
    el.btnAcceptConfirm.textContent = 'Godta bestilling';
    const minutes = Math.max(1, Number(order.estimatedMinutes) || 15);
    el.acceptMinutes.value = String(minutes);
    el.acceptQuickTimes.querySelectorAll('[data-accept-minutes]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.acceptMinutes) === minutes);
    });
  }
  openModal(el.modalAcceptOrder);
}

function openRejectOrder(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order || order.status !== 'mottatt') { toast('Bestillingen er allerede behandlet.'); return; }
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
  const closeDetail = event.target.closest('[data-close-order-detail]');
  if (closeDetail) {
    selectedOrderId = null;
    renderOrders();
    return;
  }
  const minuteChoice = event.target.closest('[data-order-minutes]');
  if (minuteChoice && selectedOrderId) {
    pendingOrderMinutes.set(selectedOrderId, Number(minuteChoice.dataset.orderMinutes));
    renderOrderDetail(selectedOrderId); return;
  }
  const inlineAccept = event.target.closest('[data-accept-inline]');
  if (inlineAccept) {
    if (inlineAccept.disabled) return;
    const order = getOrders().find(entry => entry.id === inlineAccept.dataset.acceptInline);
    if (!order || order.status !== 'mottatt') { renderOrders(); return; }
    actionOrderId = order.id;
    el.acceptMinutes.value = String(pendingOrderMinutes.get(order.id) || 15);
    inlineAccept.disabled = true;
    await confirmAcceptOrder();
    if (inlineAccept.isConnected) inlineAccept.disabled = false;
    return;
  }
  if (event.target.closest('[data-edit-order-time]')) {
    const editor = el.orderDetailLive.querySelector('.pos-estimate-editor');
    if (editor) { editor.hidden = !editor.hidden; if (!editor.hidden) { editor.querySelector('input').focus(); editor.scrollIntoView({ block: 'nearest' }); } }
    return;
  }
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
    const orderId = selectedOrderId;
    const nextStatus = status.dataset.detailStatus;
    const currentOrder = getOrders().find((entry) => entry.id === orderId);
    const currentStatus = currentOrder?.status === 'tilberedning' ? 'bekreftet' : currentOrder?.status;

    if (!((currentStatus === 'bekreftet' && nextStatus === 'klar') || (currentStatus === 'klar' && nextStatus === 'fullfort'))) {
      renderOrders(); return;
    }
    if (status.disabled) return;
    status.disabled = true;
    // Explicit employee press is required for ready status and SMS.
    const ok = nextStatus === 'klar'
      ? await markOrderReadyManually(orderId)
      : await updateOrderStatus(orderId, nextStatus);
    if (ok && nextStatus === 'fullfort') selectedOrderId = null;
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
    toast(ok ? 'Ny hentetid lagret. SMS sendes automatisk hvis aktiv.' : 'Kunne ikke lagre ny tid.');
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

async function confirmAcceptOrder() {
  if (!actionOrderId) return;
  const acceptedOrderId = actionOrderId;
  const order = getOrders().find((entry) => entry.id === acceptedOrderId);
  if (!order || order.status !== 'mottatt' || el.btnAcceptConfirm.disabled) return;
  const scheduled = isScheduledPickupOrder(order);
  let minutes = 0;
  if (!scheduled) {
    minutes = Number(el.acceptMinutes.value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      toast('Velg eller skriv minutter.');
      el.acceptMinutes.focus();
      return;
    }
  }
  el.btnAcceptConfirm.disabled = true;
  const ok = scheduled
    ? await acceptScheduledOrder(acceptedOrderId)
    : await acceptOrderWithEstimate(acceptedOrderId, minutes);
  el.btnAcceptConfirm.disabled = false;
  if (!ok) {
    toast(scheduled ? 'Kunne ikke godta den planlagte hentetiden.' : 'Kunne ikke godta bestillingen.');
    return;
  }
  acknowledgedOrders.add(acceptedOrderId);
  selectedOrderId = acceptedOrderId;
  closeModals();
  renderOrders();
  renderStats();
  toast(scheduled ? `Bestillingen er godtatt · henting ${order.pickup}.` : `Bestillingen er godtatt · ${minutes} min.`);
  clearTimeout(acceptedDetailCloseTimer);
  acceptedDetailCloseTimer = window.setTimeout(() => {
    if (selectedOrderId !== acceptedOrderId) return;
    selectedOrderId = null;
    renderOrders();
  }, 1000);

}
el.btnAcceptConfirm.addEventListener('click', confirmAcceptOrder);

el.btnRejectConfirm.addEventListener('click', async () => {
  if (!actionOrderId || el.btnRejectConfirm.disabled) return;
  if (getOrders().find(order => order.id === actionOrderId)?.status !== 'mottatt') { closeModals(); renderOrders(); toast('Bestillingen er allerede behandlet.'); return; }
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
  el.btnRefreshOrders.disabled = true;
  const online = await refreshFromDatabase();
  el.btnRefreshOrders.disabled = false;
  renderAll();
  toast(online ? 'Bestillingene er oppdatert.' : 'Kunne ikke nå databasen.');
});

function refreshOrderClocks() {
  if (ui.page !== 'orders') return;
  updateOrdersConnection();
  renderOrderTabs(getOrders());
  // When a pickup time passes, remove it immediately from Planlagte even
  // when no Firebase update occurs. Avoid rerendering if the list is current.
  if (ui.orderFilter === 'scheduled') {
    const visibleIds = [...el.orderList.querySelectorAll('[data-select-order]')]
      .map(node => node.dataset.selectOrder);
    const upcomingIds = filteredOrders().map(order => order.id);
    if (visibleIds.length !== upcomingIds.length
        || upcomingIds.some(id => !visibleIds.includes(id))) renderOrderList();
  }
  document.querySelectorAll('[data-pending-countdown]').forEach(node => {
    const order = getOrders().find(entry => entry.id === node.dataset.pendingCountdown);
    if (order) node.textContent = pendingWait(order);
  });
  document.querySelectorAll('[data-order-center]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderCenter);
    if (!order) return;
    node.textContent = orderCenterText(order);
  });
  // Keep the small pickup countdown live without re-rendering the order cards.
  document.querySelectorAll('[data-order-remaining]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.orderRemaining);
    if (!order) return;
    const remaining = orderListRemainingTime(order);
    node.textContent = remaining;
    node.hidden = !remaining;
  });
  document.querySelectorAll('[data-detail-countdown]').forEach((node) => {
    const order = getOrders().find((entry) => entry.id === node.dataset.detailCountdown);
    if (!order) return;
    node.textContent = orderSummaryCountdown(order) || (order.status === 'klar' ? 'Klar nå' : 'Estimert tid passert');
  });
}


/* ------------------------------------------------------------------ *
 * Restaurantinnstillinger
 * ------------------------------------------------------------------ */

function renderSettingsLayout() {
  if (!el.settingsGrid) return;

  // Restaurantinnstillinger uses one focused category at a time.
  el.settingsGrid.classList.remove('is-grid');
  el.settingsGrid.classList.add('is-list', 'is-sectioned');

  const section = SETTINGS_SECTIONS.has(ui.settingsSection)
    ? ui.settingsSection
    : 'status';
  ui.settingsSection = section;

  el.settingsSectionBtns.forEach((button) => {
    const active = button.dataset.settingsSectionTab === section;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });

  el.settingsSectionCards.forEach((card) => {
    card.hidden = card.dataset.settingsSection !== section;
  });
}

function applyAdminInterfaceSettings(settings = store.settings || {}) {
  const mobileEnabled = ui.page === 'orders' || settings.adminMobileEnabled !== false;
  const darkEnabled = settings.adminDarkModeEnabled !== false;
  const viewport = document.querySelector('meta[name="viewport"]');

  document.documentElement.dataset.adminMobile = mobileEnabled ? 'on' : 'off';
  document.documentElement.style.minWidth = mobileEnabled ? '' : '1180px';
  document.body.style.minWidth = mobileEnabled ? '' : '1180px';

  if (viewport) {
    viewport.setAttribute(
      'content',
      mobileEnabled ? 'width=device-width, initial-scale=1.0' : 'width=1180'
    );
  }

  if (el.btnAdminTheme) {
    el.btnAdminTheme.hidden = !darkEnabled;
    el.btnAdminTheme.style.display = darkEnabled ? '' : 'none';
  }
  if (!darkEnabled && window.KolTheme?.get?.() === 'dark') {
    window.KolTheme.set('light');
  }
}

const BOOLEAN_SETTING_FIELDS = [
  'adminMobileEnabled',
  'adminDarkModeEnabled',
  'customerDarkModeEnabled',
  'shopInfoEnabled',
  'ingredientCustomizationEnabled',
];

const SETTING_FIELDS = [
  ['customerPalette', 'text'],
  ['restaurantName', 'text'],
  ['restaurantLogo', 'text'],
  ['streetAddress', 'text'],
  ['postalCode', 'text'],
  ['city', 'text'],
  ['phone', 'text'],
  ['pickupInfo', 'text'],
  ['paymentInfo', 'text'],
  ['orderAlarmUrl', 'alarmUrl'],
  ['openingDays', 'text'],
  ['closedMessage', 'text'],
  ['orderOpenTime', 'text'],
  ['orderCloseTime', 'text'],
  ['prepMinutes', 'number'],
  ['slotIntervalMinutes', 'number'],
];

el.settings.customerPalette.replaceChildren(...Object.entries(CUSTOMER_PALETTES).map(([key, palette]) => new Option(palette.label, key)));
function renderPalettePreview() {
  const palette = CUSTOMER_PALETTES[store.settings?.customerPalette] || CUSTOMER_PALETTES.reference;
  $('customerPalettePreview').replaceChildren(...['light', 'dark'].map(mode => {
    const group = document.createElement('div');
    group.className = 'palette-mode-preview';
    const title = document.createElement('strong');
    title.textContent = mode === 'light' ? 'Lys modus' : 'Mørk modus';
    group.append(title);
    const labels = ['Hovedfarge', 'Bakgrunn', 'Kort', 'Tekst', 'Kantlinje', 'Bekreftelse', 'Uten / varsel'];
    palette[mode].forEach((color, index) => {
      const swatch = document.createElement('span');
      swatch.style.backgroundColor = color;
      swatch.style.color = [0, 3, 5, 6].includes(index) && mode === 'light' || mode === 'dark' && [1, 2, 4].includes(index) ? '#FFFFFF' : '#212226';
      swatch.textContent = labels[index] + ' ' + color;
      group.append(swatch);
    });
    return group;
  }));
}

/* Weekly opening times share siteSettings with the customer order page. */
const weeklyRowsEl=document.getElementById('weeklyHoursRows');
const weeklyErrorEl=document.getElementById('weeklyHoursError');
const temporaryClosePanel=document.getElementById('temporaryClosePanel');
const TIME_PATTERN=/^([01]\d|2[0-3]):[0-5]\d$/;
function timeIsValid(value){return TIME_PATTERN.test(String(value||''));}
function validateWeeklyForm(){
  if(ui.page!=='settings')return true;
  for(const row of weeklyRowsEl.querySelectorAll('[data-week-row]')){
    if(row.classList.contains('is-closed'))continue;
    const opening=row.querySelector('[data-week-open]');
    const closing=row.querySelector('[data-week-close]');
    if(!timeIsValid(opening.value)||!timeIsValid(closing.value)){
      weeklyErrorEl.textContent='Ugyldig klokkeslett. Bruk HH:mm (00:00–23:59).';
      weeklyErrorEl.hidden=false;return false;
    }
    if(opening.value===closing.value){
      weeklyErrorEl.textContent='Åpner og stenger kan ikke ha samme tid: '+row.dataset.weekRow+'.';
      weeklyErrorEl.hidden=false;return false;
    }
  }
  weeklyErrorEl.hidden=true;return true;
}
function renderWeeklyHours(settings){
  if(document.activeElement?.closest?.('#weeklyHoursRows'))return;
  const days=getWeeklyHours(settings);
  weeklyRowsEl.innerHTML=days.map((day,i)=>{
    const label=RESTAURANT_WEEKDAYS[i];
    const id=label.id;
    const closed=!day.enabled;
    const dateLabel=label.name;
    return '<div class="restaurant-schedule-row'+(closed?' is-closed':'')+'" role="row" data-week-row="'+id+'">'
      +'<div class="restaurant-day-name" role="cell"><span class="restaurant-day-tag">'+label.short+'</span><span>'+dateLabel+'</span></div>'
      +'<div role="cell"><label class="restaurant-day-switch" aria-label="'+dateLabel+' åpen">'
      +'<input type="checkbox" data-week-toggle="'+id+'" '+(closed?'':'checked')+'><span aria-hidden="true"></span></label></div>'
      +'<div class="restaurant-time-cell" role="cell"><input type="time" step="60" aria-label="Åpner '+dateLabel+'" data-week-open="'+id+'" value="'+day.open+'" '+(closed?'disabled':'')+'>'
      +'<span class="restaurant-stengt">Stengt</span></div>'
      +'<div class="restaurant-time-cell" role="cell"><input type="time" step="60" aria-label="Stenger '+dateLabel+'" data-week-close="'+id+'" value="'+day.close+'" '+(closed?'disabled':'')+'>'
      +'<span class="restaurant-stengt">Stengt</span></div></div>';
  }).join('');
}
function renderRestaurantStatus(){
  const status=getOpenState();
  const container=document.querySelector('.restaurant-settings-status');
  if(container)container.dataset.open=String(status.open);
  const manuallyClosed=status.reason==='manuelt';
  document.getElementById('restaurantStatusTitle').textContent=status.open?'Restauranten er åpen':manuallyClosed?'Midlertidig stengt':'Restauranten er stengt';
  document.getElementById('restaurantStatusDetail').textContent=status.open?'Stenger kl. '+status.closesAt
    :status.opensAt==='—'?'Ingen planlagt åpningstid':'Åpner kl. '+status.opensAt;
  let extra='';
  if(manuallyClosed&&status.manualClosedUntil){
    try {
      extra=' Midlertidig stengt til '+new Intl.DateTimeFormat('nb-NO',{
        timeZone:store.settings?.timezone||'Europe/Oslo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
      }).format(new Date(status.manualClosedUntil))+'.';
    }catch {extra=' Midlertidig stengt.';}
  } else if(manuallyClosed)extra=' Manuelt stengt til du åpner igjen.';
  el.settings.openStateLine.textContent=(status.open
    ?'Åpent for bestilling – stenger '+status.closesAt+'.'
    :'Stengt for bestilling – åpner '+status.opensAt+'.')+extra;
  el.settings.openStateLine.dataset.open=String(status.open);
  const settings=store.settings||{};
  const effectiveManualClose=settings.manualClosed===true
    &&(!settings.manualClosedUntil||Number(settings.manualClosedUntil)>Date.now());
  document.getElementById('temporaryCloseLabel').textContent=effectiveManualClose?'Åpne igjen':'Steng midlertidig';
  el.settings.manualClosed.checked=effectiveManualClose;
}
function updateWeeklyDay(dayId,key,value){
  mutate(state=>{
    const week=getWeeklyHours(state.settings).map(day=>({...day}));
    const entry=week.find(day=>day.id===dayId);
    if(entry){entry[key]=value;state.settings.weeklyHours=week;}
  });
  renderStats();renderSettingsPreviewOnly();
}
weeklyRowsEl.addEventListener('change',event=>{
  const toggle=event.target.closest('[data-week-toggle]');
  if(toggle){
    const row=toggle.closest('[data-week-row]');
    const enabled=toggle.checked;
    row.classList.toggle('is-closed',!enabled);
    row.querySelectorAll('input[type=time]').forEach(input=>input.disabled=!enabled);
    updateWeeklyDay(toggle.dataset.weekToggle,'enabled',enabled);
    validateWeeklyForm();return;
  }
  const field=event.target;
  const key=field.matches('[data-week-open]')?'open':field.matches('[data-week-close]')?'close':null;
  if(!key)return;
  if(!validateWeeklyForm()){field.reportValidity();return;}
  updateWeeklyDay(field.closest('[data-week-row]').dataset.weekRow,key,field.value);
});
document.getElementById('btnTemporaryClose').addEventListener('click',()=>{
  const settings=store.settings||{};
  const closed=settings.manualClosed===true
    &&(!settings.manualClosedUntil||Number(settings.manualClosedUntil)>Date.now());
  if(closed){
    askConfirm('Åpne nettbestilling igjen?','Den manuelle stengingen fjernes. Åpningstidsplanen beholdes.',()=>{
      mutate(state=>{state.settings.manualClosed=false;state.settings.manualClosedUntil=0;});
      temporaryClosePanel.hidden=true;renderStats();renderSettingsPreviewOnly();
    });return;
  }
  temporaryClosePanel.hidden=!temporaryClosePanel.hidden;
});
document.getElementById('btnCancelTemporaryClose').addEventListener('click',()=>temporaryClosePanel.hidden=true);
document.getElementById('btnApplyTemporaryClose').addEventListener('click',()=>{
  const minutes=Number(document.getElementById('temporaryCloseDuration').value)||0;
  askConfirm('Stenge nettbestilling?',minutes>0
    ?'Nettbestillingen stenges i '+minutes+' minutter. Ukesplanen endres ikke.'
    :'Nettbestillingen stenges inntil du åpner igjen. Ukesplanen endres ikke.',()=>{
      mutate(state=>{
        state.settings.manualClosed=true;
        state.settings.manualClosedUntil=minutes>0?Date.now()+minutes*60000:0;
      });
      temporaryClosePanel.hidden=true;renderStats();renderSettingsPreviewOnly();
    });
});
window.setInterval(()=>{
  if(ui.page==='settings'){renderRestaurantStatus();renderStats();}
},60000);

function renderSettings() {
  renderPalettePreview();
  const settings = store.settings || {};
  renderSettingsLayout();
  applyAdminInterfaceSettings(settings);

  for (const [key] of SETTING_FIELDS) {
    const field = el.settings[key];
    if (!field || field === document.activeElement) continue;
    field.value = settings[key] == null ? '' : String(settings[key]);
  }
  if (el.settings.manualClosed !== document.activeElement) {
    el.settings.manualClosed.checked = Boolean(settings.manualClosed);
  }
  BOOLEAN_SETTING_FIELDS.forEach((key) => {
    const field = el.settings[key];
    if (field && field !== document.activeElement) {
      field.checked = settings[key] !== false;
    }
  });

  renderWeeklyHours(settings);
  renderRestaurantStatus();
  const slots = getPickupSlots();
  el.settings.slotPreview.innerHTML = slots.length
    ? `<span class="preview-title">Kundens hentetider nå:</span>${slots
        .slice(0, 8)
        .map((slot) => `<span class="slot-chip">${escapeHtml(slot.label)}</span>`)
        .join('')}${
        slots.length > 8 ? `<span class="slot-chip is-more">+${slots.length - 8}</span>` : ''
      }`
    : '<span class="preview-title">Ingen hentetider — restauranten er stengt nå.</span>';
}

$('btnTestOrderAlarm').addEventListener('click', async event => {
  const button = event.currentTarget;
  if (orderAlarmPreview && !orderAlarmPreview.paused) {
    orderAlarmPreview.pause(); button.textContent = 'Test lyd'; return;
  }
  const field = el.settings.orderAlarmUrl;
  const url = validOrderAlarmUrl(field.value);
  if (!url) { toast('Legg inn en gyldig MP3-lenke først.'); field.focus(); return; }
  orderAlarmPreview = new Audio(url);
  orderAlarmPreview.onended = () => { button.textContent = 'Test lyd'; };
  orderAlarmPreview.onerror = () => { button.textContent = 'Test lyd'; toast('Lydfilen kunne ikke spilles. Kontroller lenken.'); };
  try { await orderAlarmPreview.play(); button.textContent = 'Stopp test'; }
  catch { button.textContent = 'Test lyd'; toast('Lydfilen kunne ikke spilles. Kontroller lenken.'); }
});

function bindSettingField(key, type) {
  const field = el.settings[key];
  if (!field) return;
  const handler = () => {
    const raw = field.value;
    if (type === 'alarmUrl') {
      const url = validOrderAlarmUrl(raw);
      field.setCustomValidity(url === null ? 'Bruk en gyldig HTTP- eller HTTPS-lenke til lydfilen.' : '');
      if (url === null) return;
      failedOrderMp3Url = '';
    }
    mutate(
      (state) => {
        if (type === 'number') {
          state.settings[key] = Math.max(0, Number(raw) || 0);
        } else {
          state.settings[key] = raw;
        }
        state.settings.openingTime = `${state.settings.orderOpenTime} - ${state.settings.orderCloseTime}`;
      },
      { silent: false }
    );
    renderStats();
    renderSettingsPreviewOnly();
  };
  field.addEventListener('input', handler);
  field.addEventListener('change', handler);
}

/** Oppdaterer bare forhåndsvisningen, slik at fokus i feltet beholdes. */
function renderSettingsPreviewOnly() {
  renderPalettePreview();
  renderRestaurantStatus();
  const slots = getPickupSlots();
  el.settings.slotPreview.innerHTML = slots.length
    ? `<span class="preview-title">Kundens hentetider nå:</span>${slots
        .slice(0, 8)
        .map((slot) => `<span class="slot-chip">${escapeHtml(slot.label)}</span>`)
        .join('')}${
        slots.length > 8 ? `<span class="slot-chip is-more">+${slots.length - 8}</span>` : ''
      }`
    : '<span class="preview-title">Ingen hentetider — restauranten er stengt nå.</span>';
}

SETTING_FIELDS.forEach(([key, type]) => bindSettingField(key, type));

el.settingsSectionBtns.forEach((button) => {
  button.addEventListener('click', () => {
    const section = button.dataset.settingsSectionTab;
    if (!SETTINGS_SECTIONS.has(section)) return;

    ui.settingsSection = section;
    try {
      localStorage.setItem('kol-admin-settings-section', section);
    } catch {
      // Kategorien fungerer fortsatt uten lokal lagring.
    }

    renderSettingsLayout();

    const scroller = el.settingsGrid?.closest('.settings-section-scroll');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

BOOLEAN_SETTING_FIELDS.forEach((key) => {
  const field = el.settings[key];
  if (!field) return;
  field.addEventListener('change', () => {
    const enabled = field.checked;
    mutate((state) => {
      state.settings[key] = enabled;
    });
    applyAdminInterfaceSettings(store.settings || {});
    const labels = {
      adminMobileEnabled: 'Mobilvisning i admin',
      adminDarkModeEnabled: 'Mørk modus i admin',
      customerDarkModeEnabled: 'Mørk modus for kunder',
      shopInfoEnabled: 'Butikkinformasjon for kunder',
      ingredientCustomizationEnabled: 'Tilpass ingredienser',
    };
    toast(`${labels[key] || 'Funksjonen'} er ${enabled ? 'på' : 'av'}.`);
  });
});

el.settings.manualClosed.addEventListener('change', () => {
  const closed = el.settings.manualClosed.checked;
  mutate((state) => {
    state.settings.manualClosed = closed;
  });
  renderStats();
  renderSettingsPreviewOnly();
  toast(
    closed
      ? 'Bestillinger er stengt for kunden.'
      : 'Bestillinger er åpne igjen (innenfor åpningstiden).'
  );
});

/* ------------------------------------------------------------------ *
 * Søk og filter
 * ------------------------------------------------------------------ */

el.productSearch.addEventListener('input', () => {
  ui.search = el.productSearch.value.trim();
  renderCategories();
});

el.filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    ui.filter = btn.dataset.filter;
    el.filterBtns.forEach((entry) => entry.classList.toggle('is-active', entry === btn));
    renderCategories();
  });
});

/* ------------------------------------------------------------------ *
 * Modaler
 * ------------------------------------------------------------------ */

function openModal(node) {
  el.modalBackdrop.hidden = false;
  node.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModals() {
  el.modalBackdrop.hidden = true;
  [
    el.modalLibrary,
    el.modalEditor,
    el.modalCategory,
    el.modalOrder,
    el.modalAcceptOrder,
    el.modalRejectOrder,
    el.modalConfirm,
  ].forEach((node) => {
    node.hidden = true;
  });
  document.body.style.overflow = '';
  attachTargetItemId = null;
  openOrderId = null;
  actionOrderId = null;
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-modal]')) closeModals();
});

el.modalBackdrop.addEventListener('click', closeModals);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!el.modalBackdrop.hidden) {
    closeModals();
    return;
  }
  if (!el.settingsCol.hidden) closeProductEditor();
});

function askConfirm(title, body, action) {
  el.confirmTitle.textContent = title;
  el.confirmBody.textContent = body;
  confirmAction = action;
  openModal(el.modalConfirm);
}

el.btnConfirmCancel.addEventListener('click', () => {
  confirmAction = null;
  closeModals();
});

el.btnConfirmOk.addEventListener('click', () => {
  const action = confirmAction;
  confirmAction = null;
  closeModals();
  if (action) action();
});

/* ------------------------------------------------------------------ *
 * Oppstart
 * ------------------------------------------------------------------ */

function renderAll() {
  const brandLogo = document.querySelector('.side-brand img');
  if (brandLogo) brandLogo.src = store.settings.restaurantLogo || '/demo/icons/restaurant.svg';
  document.querySelector('.side-brand strong')?.replaceChildren(document.createTextNode(store.settings.restaurantName ? store.settings.restaurantName + ' Admin' : 'Admin'));
  renderStats();
  if (ui.page === 'products') {
    renderCategories();
    if (skipPanelRender) skipPanelRender = false;
    else renderPanel();
  } else if (ui.page === 'groups') {
    renderGroupLibrary();
  } else if (ui.page === 'orders') {
    renderOrders();
  } else if (ui.page === 'settings') {
    renderSettings();
  }
  el.backendHint.textContent = `Lagring: ${backendInfo.label}`;
}

subscribe(() => renderAll());

ready().then(() => {
  renderAll();
});

// Viser tilkoblingsstatus og åpningstid mens panelet er åpent.
setInterval(() => {
  el.backendHint.textContent = `Lagring: ${backendInfo.label}`;
  renderStats();
  if (ui.page === 'settings') renderSettingsPreviewOnly();
}, 5000);

setInterval(() => {
  // A pickup estimate must never imply the kitchen has actually finished.
  refreshOrderClocks();
}, 1000);
renderAll();

let pendingMenuImport = null;
$('btnImportMenu').addEventListener('click', ()=>$('menuImportFile').click());
$('menuImportFile').addEventListener('change', async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try {
    const raw=JSON.parse(await file.text()); const menu=raw?.menu||raw;
    if(!Array.isArray(menu?.sections))throw new Error('Velg en Bestill meny-JSON med sections. Andre formater må konverteres først.');
    pendingMenuImport=raw;
    $('menuImportSummary').textContent=`${menu.sections.length} kategorier, ${menu.sections.reduce((sum,s)=>sum+(s.items?.length||0),0)} produkter. Menyen erstattes. Bestillinger og pizzabonus beholdes.`;
    $('menuImportPreview').hidden=false;
  }catch(error){toast(error.message,'error');}
  event.target.value='';
});
$('btnCancelMenuImport').addEventListener('click',()=>{pendingMenuImport=null;$('menuImportPreview').hidden=true;});
$('btnApplyMenuImport').addEventListener('click',async event=>{
  if(!pendingMenuImport)return;event.target.disabled=true;
  try{await importMenuJSON(pendingMenuImport);pendingMenuImport=null;$('menuImportPreview').hidden=true;toast('Menyen er importert.');}catch(error){toast(error.message,'error');}finally{event.target.disabled=false;}
});
$('btnExportMenu').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportMenuJSON(),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='menu.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
