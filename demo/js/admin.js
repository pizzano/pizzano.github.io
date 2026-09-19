/**
 * admin.js — Adminpanel for KØL Grill & Pizza.
 *
 * Fire sider: produkter/kategorier, valggruppe-bibliotek, bestillinger og
 * restaurantinnstillinger. Alt skrives til det delte datalaget (Firebase RTDB
 * via REST) og treffer kundesiden umiddelbart.
 */

import {
  store,
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
  buildIngredientRules,
  getItemIngredientRules,
  countProductsUsingGroup,
  findItem,
  findOptionGroup,
  getAllergenCatalog,
  getOpenState,
  getPickupSlots,
  getStats,
  getOrders,
  updateOrderStatus,
  updateOrderEstimate,
  acceptOrderWithEstimate,
  acceptScheduledOrder,
  rejectOrder,
  refreshFromDatabase,
  ORDER_STATUSES,
  orderStatusLabel,
} from './data.js?v=20260920-ingredients1';

/* ------------------------------------------------------------------ *
 * UI-tilstand
 * ------------------------------------------------------------------ */

const ui = {
  page: 'products',
  openCategoryId: null,
  selectedItemId: null,
  search: '',
  filter: 'all',
  groupSearch: '',
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
const autoReadyBusy = new Set();

const $ = (id) => document.getElementById(id);

const el = {
  sideLinks: document.querySelectorAll('.side-link[data-nav]'),
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
  btnNewGroup: $('btnNewGroup'),
  groupLibrary: $('groupLibrary'),
  ordersSummary: $('ordersSummary'),
  orderStatRow: $('orderStatRow'),
  orderList: $('orderList'),
  orderFilterBtns: document.querySelectorAll('.orders-tab[data-order-filter]'),
  btnRefreshOrders: $('btnRefreshOrders'),
  btnOrdersSidebarToggle: $('btnOrdersSidebarToggle'),
  orderDetailPane: $('orderDetailPane'),
  orderDetailEmpty: $('orderDetailEmpty'),
  orderDetailLive: $('orderDetailLive'),
  settingsEmpty: $('settingsEmpty'),
  settingsWrap: $('settingsWrap'),
  settingsName: $('settingsName'),
  settingsPath: $('settingsPath'),
  btnCloseSettings: $('btnCloseSettings'),
  chipNav: $('chipNav'),
  settingsScroll: $('settingsScroll'),
  fName: $('fName'),
  fDesc: $('fDesc'),
  fIngredients: $('fIngredients'),
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
    restaurantName: $('sRestaurantName'),
    streetAddress: $('sStreetAddress'),
    postalCode: $('sPostalCode'),
    city: $('sCity'),
    phone: $('sPhone'),
    pickupInfo: $('sPickupInfo'),
    paymentInfo: $('sPaymentInfo'),
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
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )} kl. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
    2,
    '0'
  )}`;
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
  ui.page = page;
  for (const [name, node] of Object.entries(el.pages)) {
    node.hidden = name !== page;
    node.classList.toggle('is-active', name === page);
  }
  el.sideLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.nav === page);
  });
  document.body.classList.toggle('hide-settings-col', page !== 'products');
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

el.btnSaveNow.addEventListener('click', async () => {
  const ok = await saveNow();
  toast(ok ? 'Alle endringer er lagret.' : 'Kunne ikke lagre. Prøv igjen.');
});

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});

/* ------------------------------------------------------------------ *
 * Oppsummering
 * ------------------------------------------------------------------ */

function renderStats() {
  const stats = getStats();
  const state = getOpenState();

  el.openBadge.dataset.open = String(state.open);
  el.openBadgeText.textContent = state.open
    ? `Åpent · stenger ${state.closesAt}`
    : `Stengt · åpner ${state.opensAt}`;

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
        `<div class="stat-card${card.tone ? ` is-${card.tone}` : ''}"><strong>${escapeHtml(
          String(card.value)
        )}</strong><span>${escapeHtml(card.label)}</span></div>`
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
      const hiddenCount = (section.items || []).filter((item) => item.hidden).length;
      const soldOutCount = (section.items || []).filter((item) => item.soldOut).length;

      return `
      <section class="cat-card${isOpen ? ' is-open' : ''}" data-category="${escapeHtml(
        section.id
      )}" draggable="false">
        <header class="cat-card-head">
          <span class="drag-handle" data-drag-cat="${escapeHtml(
            section.id
          )}" draggable="true" title="Dra for å flytte kategorien" aria-hidden="true">⋮⋮</span>
          <button class="cat-toggle" data-toggle="${escapeHtml(section.id)}" type="button">
            <svg class="chev${isOpen ? ' is-open' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            <span class="cat-name">${escapeHtml(section.title || 'Uten navn')}</span>
            <span class="cat-meta">${(section.items || []).length} produkter${
        soldOutCount ? ` · ${soldOutCount} utsolgt` : ''
      }${hiddenCount ? ` · ${hiddenCount} skjult` : ''}</span>
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
            <span class="cat-index">${index + 1}</span>
          </span>
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

/* ------------------------------------------------------------------ *
 * Klikk i kategorilisten
 * ------------------------------------------------------------------ */

el.categoryList.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    ui.openCategoryId =
      ui.openCategoryId === toggle.dataset.toggle ? null : toggle.dataset.toggle;
    renderCategories();
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
    el.settingsEmpty.hidden = false;
    el.settingsWrap.hidden = true;
    return;
  }
  el.settingsEmpty.hidden = true;
  el.settingsWrap.hidden = false;

  el.settingsName.textContent = item.name || 'Uten navn';
  el.settingsPath.textContent = `${section.title} · ${formatPrice(
    getItemBasePrice(item)
  )} · ${(item.sizes || []).length} størrelser`;

  el.fName.value = item.name || '';
  el.fDesc.value = item.description || '';
  el.fIngredients.value = item.ingredients || '';
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
  const groups = getItemOptionGroups(item);
  el.attachedGroups.innerHTML = groups.length
    ? groups
        .map(
          (group) => `
      <div class="attached-row">
        <div class="attached-main">
          <strong>${escapeHtml(group.title || 'Uten navn')}</strong>
          <span>${
            group.selectionMode === 'multiple'
              ? `Flere valg · maks ${group.maxSelections}`
              : 'Ett valg'
          } · ${group.required ? 'Obligatorisk' : 'Valgfritt'} · ${
            (group.options || []).length
          } alternativer</span>
          <small>Brukes av ${countProductsUsingGroup(group.id)} produkter</small>
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
}

function renderIngredientRules(item = selectedItem().item) {
  if (!el.ingredientRuleList) return;
  const rules = getItemIngredientRules(item);
  el.ingredientRuleList.innerHTML = rules.length
    ? rules.map((rule, index) => `
        <label class="ingredient-admin-row">
          <span>
            <strong>${escapeHtml(rule.name)}</strong>
            <small>${rule.removable ? 'Kunden kan fjerne denne' : 'Låst – kan ikke fjernes'}</small>
          </span>
          <input class="switch" type="checkbox" data-ingredient-removable="${index}" ${rule.removable ? 'checked' : ''} aria-label="Kan ${escapeHtml(rule.name)} fjernes av kunden">
        </label>`).join('')
    : '<div class="ingredient-admin-empty">Ingen ingredienser ennå. Skriv ingrediensene over, adskilt med komma.</div>';
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

el.fIngredients.addEventListener('input', () => {
  updateItem((item) => {
    item.ingredients = el.fIngredients.value;
    item.ingredientRules = buildIngredientRules(
      item.ingredients,
      item.ingredientRules || []
    );
  });
  renderIngredientRules();
});

el.ingredientRuleList.addEventListener('change', (event) => {
  const rawIndex = event.target.dataset.ingredientRemovable;
  if (rawIndex === undefined) return;
  const index = Number(rawIndex);
  updateItem((item) => {
    item.ingredientRules = buildIngredientRules(
      item.ingredients,
      item.ingredientRules || []
    );
    if (!item.ingredientRules[index]) return;
    item.ingredientRules[index].removable = event.target.checked;
  });
  renderIngredientRules();
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

el.attachedGroups.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-group]');
  if (edit) {
    openEditor(edit.dataset.editGroup);
    return;
  }
  const detach = event.target.closest('[data-detach-group]');
  if (!detach) return;
  updateItem(
    (item) => {
      item.optionGroupIds = (item.optionGroupIds || []).filter(
        (id) => id !== detach.dataset.detachGroup
      );
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

el.btnCloseSettings.addEventListener('click', () => {
  ui.selectedItemId = null;
  renderCategories();
  renderPanel();
});

/* ------------------------------------------------------------------ *
 * Scroll-spy i høyre panel
 * ------------------------------------------------------------------ */

const sectionNodes = Array.from(document.querySelectorAll('.set-section[data-section]'));

el.chipNav.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  const target = sectionNodes.find((node) => node.dataset.section === chip.dataset.chip);
  if (!target) return;
  el.settingsScroll.scrollTo({
    top: target.offsetTop - 8,
    behavior: 'smooth',
  });
});

function setActiveChip(name) {
  if (ui.activeChip === name) return;
  ui.activeChip = name;
  el.chipNav.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.chip === name);
  });
}

el.settingsScroll.addEventListener(
  'scroll',
  () => {
    const line = el.settingsScroll.scrollTop + 60;
    let current = sectionNodes[0];
    for (const node of sectionNodes) {
      if (node.offsetTop <= line) current = node;
    }
    if (current) setActiveChip(current.dataset.section);
  },
  { passive: true }
);

/* ------------------------------------------------------------------ *
 * Valggruppe-bibliotek
 * ------------------------------------------------------------------ */

function renderGroupLibrary() {
  const groups = (store.optionGroups || []).filter((group) =>
    (group.title || '').toLowerCase().includes(ui.groupSearch.toLowerCase())
  );
  el.groupsSummary.textContent = `${
    (store.optionGroups || []).length
  } valggrupper i biblioteket — endring treffer alle produkter som bruker gruppen.`;

  el.groupLibrary.innerHTML = groups.length
    ? groups
        .map(
          (group) => `
      <article class="group-card">
        <header>
          <h3>${escapeHtml(group.title || 'Uten navn')}</h3>
          <span class="pill">${countProductsUsingGroup(group.id)} produkter</span>
        </header>
        <p class="group-meta">${
          group.selectionMode === 'multiple'
            ? `Flere valg · maks ${group.maxSelections}`
            : 'Ett valg'
        } · ${group.required ? 'Obligatorisk' : 'Valgfritt'}</p>
        <ul class="group-opts">
          ${(group.options || [])
            .slice(0, 5)
            .map(
              (option) =>
                `<li><span>${escapeHtml(option.label || 'Uten navn')}</span><span>${
                  option.price > 0 ? `+${formatPrice(option.price)}` : 'Inkludert'
                }</span></li>`
            )
            .join('')}
          ${
            (group.options || []).length > 5
              ? `<li class="more">+${(group.options || []).length - 5} flere</li>`
              : ''
          }
        </ul>
        <footer>
          <button class="btn btn-outline btn-xs" data-edit-group="${escapeHtml(
            group.id
          )}" type="button">Rediger</button>
          <button class="btn btn-danger btn-xs" data-del-group="${escapeHtml(
            group.id
          )}" type="button">Slett</button>
        </footer>
      </article>`
        )
        .join('')
    : '<div class="empty-card"><strong>Ingen valggrupper</strong><p>Lag din første gruppe, f.eks. «Velg saus».</p></div>';
}

el.groupLibrary.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-group]');
  if (edit) {
    openEditor(edit.dataset.editGroup);
    return;
  }
  const del = event.target.closest('[data-del-group]');
  if (!del) return;
  const group = findOptionGroup(del.dataset.delGroup);
  if (!group) return;
  askConfirm(
    'Slette valggruppen?',
    `«${group.title}» fjernes fra ${countProductsUsingGroup(group.id)} produkter.`,
    () => deleteGroup(group.id)
  );
});

el.groupSearch.addEventListener('input', () => {
  ui.groupSearch = el.groupSearch.value.trim();
  renderGroupLibrary();
});

el.btnNewGroup.addEventListener('click', () => openEditor(null));

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
        item.optionGroupIds = (item.optionGroupIds || []).filter((id) => id !== groupId);
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

const ADMIN_ORDER_STATUSES = ORDER_STATUSES.filter((status) =>
  ['bekreftet', 'klar'].includes(status.id)
);

function syncOrdersWorkspaceLayout() {
  const workspace = document.querySelector('.orders-app');
  if (!workspace) return;
  workspace.classList.toggle('is-list-only', !selectedOrderId);
}

function filteredOrders() {
  ui.orderFilter = 'all';
  return getOrders();
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
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) return '';
  const seconds = Math.ceil(remainingMs / 1000);
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

function orderCenterText(order) {
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

function renderOrderTabs(allOrders) {
  ui.orderFilter = 'all';
  el.orderFilterBtns.forEach((button) => {
    button.classList.add('is-active');
    button.innerHTML = `<span>Alle</span><b>${allOrders.length}</b>`;
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
        ${Array.isArray(line.removedIngredients) && line.removedIngredients.length ? `<small class="pos-order-removed">UTEN: ${line.removedIngredients.map((name) => escapeHtml(String(name).toLocaleUpperCase('no'))).join(', ')}</small>` : ''}
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
  const countdown = orderCountdown(order);
  const hasCountdown = Number(order.estimatedReadyAt) > 0;
  const isPending = order.status === 'mottatt';
  const scheduledPickup = isScheduledPickupOrder(order);
  const phone = String(order.phone || '').trim();
  const tel = phone.replace(/[^+\d]/g, '');
  const pickupType = String(order.type || 'henting').toLocaleLowerCase('no').includes('lever') ? 'LEVERING' : 'HENTING';
  const payment = String(store.settings?.paymentInfo || 'Ved henting').toUpperCase();
  const effectiveStatus = order.status === 'tilberedning' ? 'bekreftet' : order.status;
  const actionHtml = isPending
    ? `<button class="pos-reject-btn" data-open-reject="${escapeHtml(order.id)}" type="button" aria-label="Avvis bestilling">×</button>
       <button class="pos-accept-btn" data-open-accept="${escapeHtml(order.id)}" type="button">${scheduledPickup ? `GODTA · ${escapeHtml(order.pickup || '')}` : `GODTA${estimated ? ` (${estimated} MIN)` : ''}`}</button>`
    : order.status === 'avvist' || order.status === 'fullfort'
      ? `<div class="pos-closed-status">${escapeHtml(orderStatusLabel(order.status))}</div>`
      : effectiveStatus === 'bekreftet'
        ? `<div class="pos-progress-actions"><button data-detail-status="klar" type="button">Klar for henting</button></div>`
        : '';

  el.orderDetailEmpty.hidden = true;
  el.orderDetailLive.hidden = false;
  el.orderDetailLive.innerHTML = `
    <article class="pos-order-detail">
      <header class="pos-detail-top">
        <div class="pos-detail-heading">
          <div class="pos-detail-total">${formatPrice(order.total)}</div>
          <div class="pos-detail-pills"><span>${escapeHtml(pickupType)}</span><span>${escapeHtml(payment)}</span></div>
        </div>
        <button class="pos-detail-close" data-close-order-detail type="button" aria-label="Lukk bestillingen og gå tilbake til listen">×</button>
      </header>
      <div class="pos-detail-scroll">
        <section class="pos-meta-block">
          <div><span>Order ID</span><strong>${escapeHtml(shortId)}</strong></div>
          <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || 'Snarest')}</strong></div>
          <div><span>Mottatt</span><strong>${escapeHtml(timeStamp(order.createdAt))}</strong></div>
          ${!isPending && scheduledPickup ? `<div><span>Planlagt henting</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>` : (!isPending && estimated ? `<div><span>Gitt tid</span><strong>${estimated} min</strong></div>` : '')}
          ${!isPending && hasCountdown ? `<div class="pos-meta-countdown"><span>Tid igjen</span><strong data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(countdown || (order.status === 'klar' ? 'Klar nå' : '—'))}</strong></div>` : ''}
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
        ${!isPending && !['avvist', 'fullfort'].includes(order.status) ? (scheduledPickup ? `
          <section class="pos-scheduled-pickup-summary">
            <div><span>Planlagt henting</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>
            <small>Blir automatisk «Klar for henting» når hentetiden kommer.</small>
          </section>` : `
          <section class="pos-estimate-editor">
            <div><strong>Forventet tid</strong><span>Kunden ser denne tiden live.</span></div>
            <label><input data-detail-estimate autocomplete="off" type="number" min="1" max="180" step="1" value="${estimated || ''}" placeholder="15"><b>min</b></label>
            <button data-save-detail-estimate="${escapeHtml(order.id)}" type="button">Oppdater</button>
          </section>`) : ''}
      </div>
      <footer class="pos-detail-actions">${actionHtml}</footer>
    </article>`;
}

function renderOrders() {
  const all = getOrders();
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

function isScheduledPickupOrder(order) {
  if (!order) return false;
  if (order.pickupMode === 'scheduled') return true;
  return /^(\d{1,2}):(\d{2})$/.test(String(order.pickup || '').trim());
}

function openAcceptOrder(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) return;
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
  const closeDetail = event.target.closest('[data-close-order-detail]');
  if (closeDetail) {
    selectedOrderId = null;
    renderOrders();
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

    // Statusknappen er kun en fremoverhandling: Bekreftet -> Klar for henting.
    // Hvis ordren allerede er klar (manuelt eller automatisk), ignoreres gamle/stale klikk.
    if (currentStatus !== 'bekreftet' || nextStatus !== 'klar') {
      renderOrders();
      renderStats();
      return;
    }

    const ok = await updateOrderStatus(orderId, nextStatus);
    if (ok) selectedOrderId = null;
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
  const acceptedOrderId = actionOrderId;
  const order = getOrders().find((entry) => entry.id === acceptedOrderId);
  if (!order) return;
  const scheduled = isScheduledPickupOrder(order);
  let minutes = 0;
  if (!scheduled) {
    minutes = Math.max(1, Math.min(180, Math.round(Number(el.acceptMinutes.value) || 0)));
    if (!minutes) {
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
  selectedOrderId = acceptedOrderId;
  closeModals();
  renderOrders();
  renderStats();
  toast(scheduled ? `Bestillingen er godtatt · henting ${order.pickup}.` : `Bestillingen er godtatt · ${minutes} min.`);
  window.setTimeout(() => {
    if (selectedOrderId !== acceptedOrderId) return;
    selectedOrderId = null;
    renderOrders();
  }, 1000);
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

async function promoteExpiredOrdersToReady() {
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

function refreshOrderClocks() {
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


/* ------------------------------------------------------------------ *
 * Restaurantinnstillinger
 * ------------------------------------------------------------------ */

const SETTING_FIELDS = [
  ['restaurantName', 'text'],
  ['streetAddress', 'text'],
  ['postalCode', 'text'],
  ['city', 'text'],
  ['phone', 'text'],
  ['pickupInfo', 'text'],
  ['paymentInfo', 'text'],
  ['openingDays', 'text'],
  ['closedMessage', 'text'],
  ['orderOpenTime', 'text'],
  ['orderCloseTime', 'text'],
  ['prepMinutes', 'number'],
  ['slotIntervalMinutes', 'number'],
];

function renderSettings() {
  const settings = store.settings || {};
  for (const [key] of SETTING_FIELDS) {
    const field = el.settings[key];
    if (!field || field === document.activeElement) continue;
    field.value = settings[key] == null ? '' : String(settings[key]);
  }
  if (el.settings.manualClosed !== document.activeElement) {
    el.settings.manualClosed.checked = Boolean(settings.manualClosed);
  }

  const state = getOpenState();
  el.settings.openStateLine.textContent = state.open
    ? `Status nå: åpent for bestillinger, stenger ${state.closesAt}.`
    : `Status nå: stengt. ${
        state.reason === 'manuelt'
          ? 'Manuelt stengt av dere.'
          : `Åpner igjen ${state.opensAt}.`
      }`;
  el.settings.openStateLine.dataset.open = String(state.open);

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

function bindSettingField(key, type) {
  const field = el.settings[key];
  if (!field) return;
  const handler = () => {
    const raw = field.value;
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
  const state = getOpenState();
  el.settings.openStateLine.textContent = state.open
    ? `Status nå: åpent for bestillinger, stenger ${state.closesAt}.`
    : `Status nå: stengt. ${
        state.reason === 'manuelt'
          ? 'Manuelt stengt av dere.'
          : `Åpner igjen ${state.opensAt}.`
      }`;
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
  if (event.key === 'Escape' && !el.modalBackdrop.hidden) closeModals();
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
  refreshOrderClocks();
  void promoteExpiredOrdersToReady();
}, 1000);
void promoteExpiredOrdersToReady();
renderAll();
