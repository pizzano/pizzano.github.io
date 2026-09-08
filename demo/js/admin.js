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
  countProductsUsingGroup,
  findItem,
  findOptionGroup,
  getAllergenCatalog,
  getOpenState,
  getPickupSlots,
  getStats,
  getOrders,
  updateOrderStatus,
  refreshFromDatabase,
  ORDER_STATUSES,
  orderStatusLabel,
} from './data.js';

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
  orderFilter: 'active',
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
  orderFilterBtns: document.querySelectorAll('.filter-btn[data-order-filter]'),
  btnRefreshOrders: $('btnRefreshOrders'),
  settingsEmpty: $('settingsEmpty'),
  settingsWrap: $('settingsWrap'),
  settingsName: $('settingsName'),
  settingsPath: $('settingsPath'),
  btnCloseSettings: $('btnCloseSettings'),
  chipNav: $('chipNav'),
  settingsScroll: $('settingsScroll'),
  fName: $('fName'),
  fDesc: $('fDesc'),
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
  renderAll();
}

el.sideLinks.forEach((link) => {
  link.addEventListener('click', () => setPage(link.dataset.nav));
});

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
    (item.description || '').toLowerCase().includes(needle)
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
  el.fDesc.value = item.description || item.ingredients || '';
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
    item.ingredients = el.fDesc.value;
  });
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

function filteredOrders() {
  const orders = getOrders();
  if (ui.orderFilter === 'all') return orders;
  if (ui.orderFilter === 'active') {
    return orders.filter(
      (order) => order.status === 'mottatt' || order.status === 'tilberedning'
    );
  }
  return orders.filter((order) => order.status === ui.orderFilter);
}

function renderOrders() {
  const orders = filteredOrders();
  const all = getOrders();
  el.ordersSummary.textContent = `${all.length} bestillinger totalt · ${
    all.filter((order) => order.status === 'mottatt').length
  } nye venter`;

  el.orderList.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
      <article class="order-card" data-order="${escapeHtml(order.id)}">
        <header class="order-head">
          <div class="order-id">
            <strong>#${escapeHtml(order.id.slice(-6).toUpperCase())}</strong>
            <span>${escapeHtml(timeStamp(order.createdAt))}</span>
          </div>
          <span class="status-pill" data-status="${escapeHtml(
            order.status
          )}">${escapeHtml(orderStatusLabel(order.status))}</span>
        </header>
        <div class="order-meta">
          <span><strong>${escapeHtml(order.customerName || '—')}</strong></span>
          <span>${escapeHtml(order.phone || '—')}</span>
          <span>Hentetid: <strong>${escapeHtml(order.pickup || '—')}</strong></span>
          <span>Total: <strong>${formatPrice(order.total)}</strong></span>
        </div>
        <ul class="order-lines">
          ${(order.lines || [])
            .slice(0, 4)
            .map(
              (line) =>
                `<li>${line.quantity}× ${escapeHtml(line.name)}${
                  line.size ? ` · ${escapeHtml(line.size)}` : ''
                }</li>`
            )
            .join('')}
          ${
            (order.lines || []).length > 4
              ? `<li class="more">+${(order.lines || []).length - 4} flere linjer</li>`
              : ''
          }
        </ul>
        <footer class="order-foot">
          <select class="input input-status" data-status-select="${escapeHtml(order.id)}">
            ${ORDER_STATUSES.map(
              (status) =>
                `<option value="${escapeHtml(status.id)}"${
                  status.id === order.status ? ' selected' : ''
                }>${escapeHtml(status.label)}</option>`
            ).join('')}
          </select>
          <button class="btn btn-outline btn-xs" data-order-detail="${escapeHtml(
            order.id
          )}" type="button">Se detaljer</button>
        </footer>
      </article>`
        )
        .join('')
    : '<div class="empty-card"><strong>Ingen bestillinger</strong><p>Nye bestillinger fra kundesiden vises her automatisk.</p></div>';

  if (openOrderId && !el.modalOrder.hidden) renderOrderDetail(openOrderId);
}

el.orderFilterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    ui.orderFilter = btn.dataset.orderFilter;
    el.orderFilterBtns.forEach((entry) => {
      entry.classList.toggle('is-active', entry === btn);
    });
    renderOrders();
  });
});

el.orderList.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-status-select]');
  if (!select) return;
  const orderId = select.dataset.statusSelect;
  const ok = await updateOrderStatus(orderId, select.value);
  renderOrders();
  renderStats();
  toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');
});

el.orderList.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-order-detail]');
  if (!detail) return;
  openOrderId = detail.dataset.orderDetail;
  renderOrderDetail(openOrderId);
  openModal(el.modalOrder);
});

function renderOrderDetail(orderId) {
  const order = getOrders().find((entry) => entry.id === orderId);
  if (!order) {
    closeModals();
    return;
  }
  el.orderTitle.textContent = `Bestilling #${order.id.slice(-6).toUpperCase()}`;
  el.orderBody.innerHTML = `
    <div class="detail-grid">
      <div><span>Kunde</span><strong>${escapeHtml(order.customerName || '—')}</strong></div>
      <div><span>Telefon</span><strong>${escapeHtml(order.phone || '—')}</strong></div>
      <div><span>Mottatt</span><strong>${escapeHtml(timeStamp(order.createdAt))}</strong></div>
      <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || '—')}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(
        orderStatusLabel(order.status)
      )}</strong></div>
      <div><span>Type</span><strong>${escapeHtml(order.type || 'henting')}</strong></div>
    </div>
    ${
      order.comment
        ? `<p class="detail-comment">Melding fra kunden: «${escapeHtml(order.comment)}»</p>`
        : ''
    }
    <h3 class="detail-title">Varer</h3>
    <div class="detail-lines">
      ${(order.lines || [])
        .map(
          (line) => `
        <div class="detail-line">
          <span class="dl-qty">${line.quantity}×</span>
          <span class="dl-body">
            <strong>${escapeHtml(line.name)}</strong>
            ${line.size ? `<small>Størrelse: ${escapeHtml(line.size)}</small>` : ''}
            ${
              (line.options || []).length
                ? `<small>${line.options.map((opt) => escapeHtml(opt)).join(' · ')}</small>`
                : ''
            }
            ${line.comment ? `<small>«${escapeHtml(line.comment)}»</small>` : ''}
          </span>
          <span class="dl-price">${formatPrice(line.price)}</span>
        </div>`
        )
        .join('')}
    </div>
    <div class="detail-sum">
      <div><span>Delsum</span><strong>${formatPrice(order.subtotal)}</strong></div>
      <div class="is-total"><span>Totalt</span><strong>${formatPrice(
        order.total
      )}</strong></div>
    </div>
    <div class="detail-actions">
      ${ORDER_STATUSES.map(
        (status) =>
          `<button class="btn ${
            status.id === order.status ? 'btn-primary' : 'btn-outline'
          } btn-xs" data-set-status="${escapeHtml(status.id)}" type="button">${escapeHtml(
            status.label
          )}</button>`
      ).join('')}
    </div>`;
}

el.orderBody.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-set-status]');
  if (!btn || !openOrderId) return;
  const ok = await updateOrderStatus(openOrderId, btn.dataset.setStatus);
  renderOrderDetail(openOrderId);
  renderOrders();
  renderStats();
  toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');
});

el.btnRefreshOrders.addEventListener('click', async () => {
  const online = await refreshFromDatabase();
  renderAll();
  toast(online ? 'Bestillingene er oppdatert.' : 'Kunne ikke nå databasen.');
});

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
    el.modalConfirm,
  ].forEach((node) => {
    node.hidden = true;
  });
  document.body.style.overflow = '';
  attachTargetItemId = null;
  openOrderId = null;
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

renderAll();
