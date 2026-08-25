/**
 * app.js — Kundelogikk for KØL Grill & Pizza.
 *
 * Hele menyen vises i én rullende liste. Kategoribaren scroller horisontalt og
 * følger sидen: når kunden scroller, markeres riktig kategori og baren flytter
 * seg til den. Åpningstid, hentetider og meny styres fra adminpanelet.
 */

import {
  store,
  subscribe,
  ready,
  backendInfo,
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
} from './data.js';

/* ------------------------------------------------------------------ *
 * Lokal kundetilstand
 * ------------------------------------------------------------------ */

const PROFILE_KEY = 'kol_profile_v1';
const CART_KEY = 'kol_cart_v1';
const PIZZA_GOAL = 11;

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
  { name: '', phone: '', favorites: [], pizzaCount: 0, freePizzas: 0 },
  loadJSON(PROFILE_KEY, {})
);
profile.favorites = Array.isArray(profile.favorites) ? profile.favorites : [];

let cart = Array.isArray(loadJSON(CART_KEY, [])) ? loadJSON(CART_KEY, []) : [];

const ui = {
  view: 'menu',
  activeCategory: '',
  checkoutStep: 1,
  pickup: null,
  editingLineId: null,
  expandedBlocks: new Set(),
  allergensOpen: false,
  selectedAllergens: [],
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
  menuList: $('menuList'),
  btnAllergens: $('btnAllergens'),
  allergenPicker: $('allergenPicker'),
  syncBadge: $('syncBadge'),
  openStatus: $('openStatus'),
  openDot: $('openDot'),
  closedBanner: $('closedBanner'),
  closedTitle: $('closedTitle'),
  closedText: $('closedText'),
  btnBack: $('btnBack'),
  btnInfo: $('btnInfo'),
  btnProfile: $('btnProfile'),
  btnCart: $('btnCart'),
  cartCount: $('cartCount'),
  brandHome: $('brandHome'),
  views: {
    menu: $('viewMenu'),
    cart: $('viewCart'),
    checkout: $('viewCheckout'),
    profile: $('viewProfile'),
    info: $('viewInfo'),
  },
  cartLines: $('cartLines'),
  cartSummary: $('cartSummary'),
  cartSubtotal: $('cartSubtotal'),
  cartDiscountRow: $('cartDiscountRow'),
  cartDiscountLabel: $('cartDiscountLabel'),
  cartDiscount: $('cartDiscount'),
  cartTotal: $('cartTotal'),
  cartClosedHint: $('cartClosedHint'),
  btnToCheckout: $('btnToCheckout'),
  btnKeepShopping: $('btnKeepShopping'),
  bottomBar: $('bottomBar'),
  barCart: $('barCart'),
  barCount: $('barCount'),
  barTotal: $('barTotal'),
  stepper: $('stepper'),
  step1: $('step1'),
  step2: $('step2'),
  step3: $('step3'),
  checkoutLines: $('checkoutLines'),
  step1Total: $('step1Total'),
  custName: $('custName'),
  custPhone: $('custPhone'),
  custComment: $('custComment'),
  errName: $('errName'),
  errPhone: $('errPhone'),
  saveProfile: $('saveProfile'),
  timeGrid: $('timeGrid'),
  pickupHint: $('pickupHint'),
  errTime: $('errTime'),
  reviewCard: $('reviewCard'),
  btnStepBack: $('btnStepBack'),
  btnStepNext: $('btnStepNext'),
  profName: $('profName'),
  profPhone: $('profPhone'),
  btnSaveProfile: $('btnSaveProfile'),
  profileSaved: $('profileSaved'),
  loyaltyText: $('loyaltyText'),
  stamps: $('stamps'),
  rewardBox: $('rewardBox'),
  favList: $('favList'),
  orderList: $('orderList'),
  infoName: $('infoName'),
  infoAddress: $('infoAddress'),
  infoPhone: $('infoPhone'),
  infoPickup: $('infoPickup'),
  infoPayment: $('infoPayment'),
  infoDays: $('infoDays'),
  infoHours: $('infoHours'),
  infoOpenNow: $('infoOpenNow'),
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
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 2200);
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
  return (section.items || []).filter((item) => !item.hidden);
}

const ALLERGEN_ICONS = { 'Hvete / gluten': '🌾', Melk: '🥛', Egg: '🥚', Soya: '🌱', Selleri: '🌿', Sennep: '🟡', Sesam: '⚪', Fisk: '🐟', Skalldyr: '🦐', Peanøtter: '🥜', Nøtter: '🌰', Sulfitter: '🍷' };

function renderAllergenPicker() {
  const labels = [...new Set((store.allergenCatalog || []).map((item) => item.label))];
  el.allergenPicker.hidden = !ui.allergensOpen;
  el.btnAllergens.classList.toggle('is-on', ui.allergensOpen || ui.selectedAllergens.length > 0);
  el.allergenPicker.innerHTML = labels.map((label) => `<button class="allergen-choice${ui.selectedAllergens.includes(label) ? ' is-on' : ''}" data-allergen="${escapeHtml(label)}" type="button">${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}</button>`).join('');
}

/** Alle blokker som vises i menylisten, i rekkefølge. */
function menuBlocks() {
  const blocks = [];

  const favItems = profile.favorites
    .map((id) => findItem(id))
    .filter(({ item }) => item && !item.hidden);
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
    .filter(({ item }) => item && !item.hidden);
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
  el.btnInfo.classList.toggle('is-on', view === 'info');
  el.btnCart.classList.toggle('is-on', view === 'cart' || view === 'checkout');
  window.scrollTo({ top: 0 });
  renderBottomBar();
  if (view === 'cart') renderCart();
  if (view === 'checkout') renderCheckout();
  if (view === 'profile') renderProfile();
  if (view === 'info') renderInfo();
}

/* ------------------------------------------------------------------ *
 * Kategoribar: horisontal scroll + scroll-spy
 * ------------------------------------------------------------------ */

function renderCategories() {
  const blocks = menuBlocks();
  if (!blocks.some((block) => block.key === ui.activeCategory)) {
    ui.activeCategory = blocks.length ? blocks[0].key : '';
  }
  el.catScroll.innerHTML = blocks
    .map(
      (block) =>
        `<button class="cat-tab${block.key === ui.activeCategory ? ' is-active' : ''}" role="tab" aria-selected="${
          block.key === ui.activeCategory
        }" data-cat="${escapeHtml(block.key)}" type="button">${escapeHtml(block.title)}</button>`
    )
    .join('');
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
  const markedAllergens = allergenLabels(item).filter((label) => ui.selectedAllergens.includes(label));
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
        ${markedAllergens.length ? `<p class="prod-allergens">${markedAllergens.map((label) => `${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}`).join(' ')}</p>` : ''}
        <p class="prod-price">${multi ? '<small>fra </small>' : ''}${formatPrice(price)}</p>
      </div>
      <div class="prod-side">
        <button class="fav-btn${isFavorite(item.id) ? ' is-on' : ''}" data-fav="${escapeHtml(
    item.id
  )}" type="button" aria-label="${isFavorite(item.id) ? 'Fjern favoritt' : 'Legg til favoritt'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.8C19 15.6 12 20 12 20z"/></svg>
        </button>
        <button class="add-btn" data-open="${escapeHtml(item.id)}" type="button" ${
    soldOut ? 'disabled aria-label="Utsolgt"' : 'aria-label="Velg og legg til"'
  }>+</button>
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
      (block) => `
      <section class="cat-block" id="blk_${escapeHtml(block.key)}" data-block="${escapeHtml(block.key)}">
        <div class="cat-head">
          <h2>${escapeHtml(block.title)}</h2>
          <span>${block.items.length} ${block.items.length === 1 ? 'produkt' : 'produkter'}${
        block.note ? ` · ${escapeHtml(block.note)}` : ''
      }</span>
        </div>
        <div class="prod-grid">
          ${block.items.slice(0, ui.expandedBlocks.has(block.key) ? block.items.length : 3).map(({ item, section }) => productCardHtml(item, section)).join('')}
        </div>
        ${block.items.length > 3 ? `<button class="show-more" data-toggle-block="${escapeHtml(block.key)}" type="button">${ui.expandedBlocks.has(block.key) ? 'Gizle' : 'Vis mer'}</button>` : ''}
      </section>`
    )
    .join('');
}

/** Åpen/stengt-status øverst i menyen. */
function renderOpenState() {
  const state = getOpenState();
  const settings = store.settings || {};
  el.openStatus.textContent = state.open
    ? `${state.label} · kun henting · stenger ${state.closesAt}`
    : `${state.label} · åpner ${state.opensAt}`;
  el.openDot.classList.toggle('is-closed', !state.open);
  el.closedBanner.hidden = state.open;
  if (!state.open) {
    el.closedTitle.textContent = 'Restauranten er stengt';
    el.closedText.textContent =
      settings.closedMessage || `Vi tar imot bestillinger fra ${state.opensAt}.`;
  }
  el.btnToCheckout.disabled = !state.open;
  el.cartClosedHint.hidden = state.open;
  return state;
}

function renderInfo() {
  const settings = store.settings || {};
  const state = getOpenState();
  el.infoName.textContent = settings.restaurantName || 'KØL Grill & Pizza';
  el.infoAddress.textContent = `${settings.streetAddress || ''}, ${settings.postalCode || ''} ${
    settings.city || ''
  }`.trim();
  el.infoPhone.textContent = `Telefon: ${settings.phone || '—'}`;
  el.infoPickup.textContent = settings.pickupInfo || 'Henting i restauranten';
  el.infoPayment.textContent = settings.paymentInfo || 'Betaling ved henting';
  el.infoDays.textContent = settings.openingDays || 'Mandag – søndag';
  el.infoHours.textContent = `${settings.orderOpenTime || '14:00'} – ${
    settings.orderCloseTime || '22:00'
  }`;
  el.infoOpenNow.textContent = state.open
    ? `Vi har åpent nå og stenger ${state.closesAt}.`
    : `Vi har stengt nå. Neste åpning ${state.opensAt}.`;
}

/* ------------------------------------------------------------------ *
 * Produkt-sheet med størrelser og valggrupper
 * ------------------------------------------------------------------ */

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
  const badges = [
    `<span class="badge">${
      isMulti ? `Flere valg · maks ${group.maxSelections}` : 'Ett valg'
    }</span>`,
    group.required
      ? '<span class="badge badge-req">Obligatorisk</span>'
      : '<span class="badge">Valgfritt</span>',
  ].join('');

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
          <span class="badge">Ett valg</span>
          <span class="badge badge-req">Obligatorisk</span>
        </div>
        <div class="opt-rows">
          ${item.sizes
            .map(
              (size, index) => `
            <label class="opt-row${size.id === draft.sizeId ? ' is-checked' : ''}">
              <input type="radio" name="size" data-size="${escapeHtml(size.id)}" ${
                size.id === draft.sizeId ? 'checked' : ''
              }>
              <span class="opt-label">${escapeHtml(size.label)}${
                index === item.defaultSizeIndex
                  ? ' <span class="badge badge-def">Standard</span>'
                  : ''
              }</span>
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
    <h3 class="sheet-name">${escapeHtml(item.name)}${
    item.soldOut ? ' <span class="tag tag-soldout">Utsolgt</span>' : ''
  }</h3>
    <p class="sheet-desc">${escapeHtml(item.description || item.ingredients || '')}</p>
    ${sizeHtml}
    ${groups.map((group) => optionGroupHtml(group, problems)).join('')}
    <div class="opt-group">
      <div class="opt-head"><h3 class="opt-title">Allergener</h3></div>
      ${
        allergens.length
          ? `<div class="allergen-row">${allergens
              .map((label) => `<span class="allergen-chip">${escapeHtml(label)}</span>`)
              .join('')}</div>`
          : '<p class="hint">Ingen registrerte allergener.</p>'
      }
    </div>
    <div class="opt-group">
      <div class="opt-head"><h3 class="opt-title">Kommentar til kjøkkenet</h3></div>
      <textarea class="comment-area" id="draftComment" placeholder="F.eks. uten løk, godt stekt">${escapeHtml(
        draft.comment
      )}</textarea>
    </div>`;

  el.qtyValue.textContent = String(draft.quantity);
  el.sheetTotal.textContent = formatPrice(draftTotal());
  el.btnAddToCart.querySelector('span').textContent = draft.editingLineId
    ? 'Oppdater handlekurven'
    : 'Legg til i handlekurven';
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

  persistCart();
  toast(
    draft.editingLineId ? 'Handlekurven er oppdatert.' : `${item.name} lagt i handlekurven.`
  );
  closeSheet();
  renderCartCount();
  renderBottomBar();
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

/** Sant når produktet gir stempel (pizza). */
function isLoyaltyItem(item, section) {
  if (!item || !section) return false;
  if (section.loyaltyEligible) return true;
  return /pizza/i.test(section.title || '') || /pizza/i.test(item.name || '');
}

function pizzaCountInCart() {
  let count = 0;
  for (const line of cart) {
    const { item, section } = findItem(line.itemId);
    if (isLoyaltyItem(item, section)) count += line.quantity;
  }
  return count;
}

/** Rabatt fra lojalitet + kupong. */
function computeDiscount(subtotal) {
  const parts = [];
  let total = 0;

  if (profile.freePizzas > 0) {
    let cheapest = null;
    for (const line of cart) {
      const { item, section } = findItem(line.itemId);
      if (!isLoyaltyItem(item, section)) continue;
      const optionIds = Object.values(line.selections || {}).flat();
      const unit = computeLinePrice(item, line.sizeId, optionIds, 1);
      if (!cheapest || unit < cheapest) cheapest = unit;
    }
    if (cheapest) {
      total += cheapest;
      parts.push('Gratis pizza (stempelkort)');
    }
  }

  total = Math.min(total, subtotal);
  return { amount: Math.round(total * 100) / 100, label: parts.join(' + ') || 'Rabatt' };
}

function cartLineHtml(line, compact) {
  const { item } = findItem(line.itemId);
  if (!item) return '';
  const size = (item.sizes || []).find((s) => s.id === line.sizeId);
  const optionIds = Object.values(line.selections || {}).flat();
  const price = computeLinePrice(item, line.sizeId, optionIds, line.quantity);
  const addons = describeSelection(optionIds);

  return `
    <div class="cart-line" data-line="${escapeHtml(line.lineId)}">
      <span class="line-qty">${line.quantity}×</span>
      <div class="line-body">
        <p class="line-name">${escapeHtml(item.name)}</p>
        ${
          size
            ? `<p class="line-meta">Størrelse: ${escapeHtml(size.label)} · ${formatPrice(
                getSizePrice(item, line.sizeId)
              )}</p>`
            : ''
        }
        ${
          addons.length
            ? `<p class="line-meta">${addons
                .map(
                  (addon) =>
                    `${escapeHtml(addon.label)}${
                      addon.price > 0 ? ` (+${formatPrice(addon.price)})` : ''
                    }`
                )
                .join(' · ')}</p>`
            : ''
        }
        ${line.comment ? `<p class="line-comment">«${escapeHtml(line.comment)}»</p>` : ''}
        ${
          compact
            ? ''
            : `<div class="line-actions">
                 <button class="link-btn" data-edit="${escapeHtml(line.lineId)}" type="button">Endre</button>
                 <button class="link-btn is-danger" data-remove="${escapeHtml(line.lineId)}" type="button">Fjern</button>
               </div>`
        }
      </div>
      <div class="line-right">
        <span class="line-price">${formatPrice(price)}</span>
        ${
          compact
            ? ''
            : `<span class="line-step">
                 <button data-dec="${escapeHtml(line.lineId)}" type="button" aria-label="Færre">−</button>
                 <span>${line.quantity}</span>
                 <button data-inc="${escapeHtml(line.lineId)}" type="button" aria-label="Flere">+</button>
               </span>`
        }
      </div>
    </div>`;
}

function renderCart() {
  if (!cart.length) {
    el.cartLines.innerHTML =
      '<div class="empty-note"><strong>Handlekurven er tom</strong>Legg til noe godt fra menyen.</div>';
    el.cartSummary.hidden = true;
    return;
  }
  el.cartLines.innerHTML = cart.map((line) => cartLineHtml(line, false)).join('');
  const subtotal = cartSubtotal();
  const discount = computeDiscount(subtotal);
  el.cartSubtotal.textContent = formatPrice(subtotal);
  el.cartDiscountRow.hidden = discount.amount <= 0;
  el.cartDiscountLabel.textContent = discount.label;
  el.cartDiscount.textContent = `−${formatPrice(discount.amount)}`;
  el.cartTotal.textContent = formatPrice(subtotal - discount.amount);
  el.cartSummary.hidden = false;
}

function renderCartCount() {
  const count = cartCount();
  el.cartCount.textContent = String(count);
  el.cartCount.hidden = count === 0;
}

function renderBottomBar() {
  const count = cartCount();
  const show =
    count > 0 && (ui.view === 'menu' || ui.view === 'info' || ui.view === 'profile');
  el.bottomBar.hidden = !show;
  if (show) {
    const subtotal = cartSubtotal();
    const discount = computeDiscount(subtotal);
    el.barCount.textContent = String(count);
    el.barTotal.textContent = formatPrice(subtotal - discount.amount);
  }
}

/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */

function setStep(step) {
  ui.checkoutStep = step;
  const panels = [el.step1, el.step2, el.step3];
  panels.forEach((panel, index) => {
    panel.hidden = index + 1 !== step;
  });
  el.stepper.querySelectorAll('.step').forEach((node) => {
    const value = Number(node.dataset.step);
    node.classList.toggle('is-active', value === step);
    node.classList.toggle('is-done', value < step);
  });
  el.btnStepBack.textContent = step === 1 ? 'Til handlekurven' : 'Tilbake';
  el.btnStepNext.textContent = step === 3 ? 'Send bestilling' : 'Neste';
  renderCheckout();
}

function renderCheckout() {
  if (!cart.length) {
    setView('cart');
    return;
  }
  el.checkoutLines.innerHTML = cart.map((line) => cartLineHtml(line, true)).join('');
  const subtotal = cartSubtotal();
  const discount = computeDiscount(subtotal);
  const total = subtotal - discount.amount;
  el.step1Total.textContent = formatPrice(total);

  el.custName.value = el.custName.value || profile.name || '';
  el.custPhone.value = el.custPhone.value || profile.phone || '';

  // Hentetider styres av adminpanelet (tilberedningstid + intervall).
  const slots = getPickupSlots();
  if (!slots.some((slot) => slot.value === ui.pickup)) ui.pickup = null;
  if (slots.length) {
    el.pickupHint.textContent = 'Velg et tidspunkt for å fullføre bestillingen.';
    el.timeGrid.innerHTML = slots
      .map(
        (slot) =>
          `<button class="time-btn${slot.value === 'asap' ? ' is-soon' : ''}${
            ui.pickup === slot.value ? ' is-active' : ''
          }" data-time="${escapeHtml(slot.value)}" type="button">${escapeHtml(slot.label)}</button>`
      )
      .join('');
  } else {
    const state = getOpenState();
    el.pickupHint.textContent = `Restauranten er stengt nå. Vi åpner ${state.opensAt}.`;
    el.timeGrid.innerHTML =
      '<p class="hint">Ingen hentetider tilgjengelig akkurat nå.</p>';
  }

  el.reviewCard.innerHTML = `
    <div><span>Navn</span><strong>${escapeHtml(el.custName.value || '—')}</strong></div>
    <div><span>Telefon</span><strong>${
      el.custPhone.value ? `+47 ${escapeHtml(el.custPhone.value)}` : '—'
    }</strong></div>
    <div><span>Hentetid</span><strong>${
      ui.pickup
        ? ui.pickup === 'asap'
          ? 'Snarest'
          : escapeHtml(ui.pickup)
        : 'Ikke valgt'
    }</strong></div>
    ${
      discount.amount > 0
        ? `<div><span>${escapeHtml(discount.label)}</span><strong>−${formatPrice(
            discount.amount
          )}</strong></div>`
        : ''
    }
    <div><span>Å betale ved henting</span><strong>${formatPrice(total)}</strong></div>`;
}

function validPhone(value) {
  return /^[49]\d{7}$/.test(String(value).replace(/\s/g, ''));
}

async function placeOrder() {
  const state = getOpenState();
  if (!state.open) {
    toast(`Restauranten er stengt. Vi åpner ${state.opensAt}.`);
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
  if (!ui.pickup) {
    el.errTime.hidden = false;
    return;
  }
  el.errTime.hidden = true;

  const subtotal = cartSubtotal();
  const discount = computeDiscount(subtotal);
  const total = subtotal - discount.amount;

  const lines = cart.map((line) => {
    const { item } = findItem(line.itemId);
    const size = (item.sizes || []).find((s) => s.id === line.sizeId);
    const optionIds = Object.values(line.selections || {}).flat();
    return {
      itemId: line.itemId,
      name: item ? item.name : 'Ukjent',
      size: size ? size.label : '',
      quantity: line.quantity,
      options: describeSelection(optionIds).map((addon) => addon.label),
      comment: line.comment || '',
      price: computeLinePrice(item, line.sizeId, optionIds, line.quantity),
    };
  });

  el.btnStepNext.disabled = true;
  const pizzas = pizzaCountInCart();
  const usedFreePizza = profile.freePizzas > 0 && pizzas > 0;

  const order = await submitOrder({
    customerName: name,
    phone: `+47${phone}`,
    pickup: ui.pickup === 'asap' ? 'Snarest' : ui.pickup,
    comment: el.custComment ? el.custComment.value.trim() : '',
    type: 'henting',
    lines,
    subtotal,
    discount: discount.amount,
    discountLabel: discount.amount > 0 ? discount.label : '',
    total,
  });
  el.btnStepNext.disabled = false;

  if (usedFreePizza) profile.freePizzas -= 1;
  profile.pizzaCount += pizzas;
  while (profile.pizzaCount >= PIZZA_GOAL) {
    profile.pizzaCount -= PIZZA_GOAL;
    profile.freePizzas += 1;
  }
  if (el.saveProfile.checked) {
    profile.name = name;
    profile.phone = phone;
  }
  persistProfile();

  cart = [];
  persistCart();
  ui.pickup = null;
  if (el.custComment) el.custComment.value = '';

  el.confirmText.textContent = `Takk, ${name}! Vi lager bestillingen din klar til henting.`;
  el.confirmMeta.innerHTML = `
    <div><span>Ordrenummer</span><strong>${escapeHtml(
      order.id.slice(-6).toUpperCase()
    )}</strong></div>
    <div><span>Hentetid</span><strong>${escapeHtml(order.pickup)}</strong></div>
    <div><span>Å betale ved henting</span><strong>${formatPrice(order.total)}</strong></div>
    ${
      profile.freePizzas > 0
        ? '<div><span>Bonus</span><strong>Gratis pizza klar til neste gang</strong></div>'
        : ''
    }`;
  el.confirmBackdrop.hidden = false;
  el.confirmModal.hidden = false;
  renderCartCount();
}

/* ------------------------------------------------------------------ *
 * Profil
 * ------------------------------------------------------------------ */

function renderProfile() {
  el.profName.value = profile.name || '';
  el.profPhone.value = profile.phone || '';

  const filled = profile.pizzaCount % PIZZA_GOAL;
  el.loyaltyText.textContent = `Hver 11. pizza er gratis. Du har ${filled} av ${PIZZA_GOAL} stempler${
    profile.freePizzas > 0 ? ` og ${profile.freePizzas} gratis pizza klar` : ''
  }.`;
  el.stamps.innerHTML = Array.from({ length: PIZZA_GOAL }, (_, index) => {
    if (index === PIZZA_GOAL - 1) {
      return `<span class="stamp ${
        filled >= PIZZA_GOAL - 1 ? 'is-reward' : ''
      }" title="Gratis pizza">★</span>`;
    }
    return `<span class="stamp ${index < filled ? 'is-filled' : ''}">${index + 1}</span>`;
  }).join('');
  el.rewardBox.hidden = profile.freePizzas <= 0;

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
  const orders = getLocalOrders();
  el.orderList.innerHTML = orders.length
    ? orders
        .slice(0, 6)
        .map((order) => {
          const date = new Date(order.createdAt);
          const stamp = `${String(date.getDate()).padStart(2, '0')}.${String(
            date.getMonth() + 1
          ).padStart(2, '0')} kl. ${String(date.getHours()).padStart(2, '0')}:${String(
            date.getMinutes()
          ).padStart(2, '0')}`;
          const summary = (order.lines || [])
            .map((line) => `${line.quantity}× ${line.name}`)
            .join(', ');
          const current = live.find((entry) => entry.id === order.id);
          const status = orderStatusLabel(current ? current.status : order.status);
          return `
            <div class="mini-row">
              <div class="mini-body">
                <p class="mini-title">${formatPrice(order.total)} · ${escapeHtml(stamp)}</p>
                <p class="mini-sub">${escapeHtml(summary)}</p>
                <p class="mini-status">Status: ${escapeHtml(status)}</p>
              </div>
              <button class="link-btn" data-reorder="${escapeHtml(
                order.id
              )}" type="button">Bestill igjen</button>
            </div>`;
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
      (item.sizes || []).find((s) => s.label === line.size) || getDefaultSize(item);
    const selections = defaultSelectionFor(item);
    const signature = lineSignature(
      item.id,
      size ? size.id : null,
      selections,
      line.comment
    );
    const existing = cart.find((entry) => entry.signature === signature);
    if (existing) existing.quantity += line.quantity;
    else
      cart.push({
        lineId: uid('ln'),
        signature,
        itemId: item.id,
        sizeId: size ? size.id : null,
        selections,
        comment: line.comment || '',
        quantity: line.quantity,
      });
    added += line.quantity;
  }
  persistCart();
  renderCartCount();
  renderBottomBar();
  if (added) {
    toast(`${added} ${added === 1 ? 'vare' : 'varer'} lagt i handlekurven.`);
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
  if (card && !event.target.closest('[data-fav]')) {
    openProduct(card.dataset.item);
    return;
  }
  const favBtn = event.target.closest('[data-fav]');
  if (favBtn) {
    toggleFavorite(favBtn.dataset.fav);
    renderCategories();
    renderMenu();
    if (ui.view === 'profile') renderProfile();
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

  persistCart();
  renderCart();
  renderCartCount();
  renderBottomBar();
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

el.sheetFav.addEventListener('click', () => {
  if (!draft) return;
  toggleFavorite(draft.itemId);
  el.sheetFav.classList.toggle('is-on', isFavorite(draft.itemId));
  renderCategories();
  renderMenu();
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

el.btnInfo.addEventListener('click', () => setView(ui.view === 'info' ? 'menu' : 'info'));
el.btnProfile.addEventListener('click', () =>
  setView(ui.view === 'profile' ? 'menu' : 'profile')
);
el.btnCart.addEventListener('click', () => setView('cart'));
el.barCart.addEventListener('click', () => setView('cart'));
el.btnKeepShopping.addEventListener('click', () => setView('menu'));

el.btnToCheckout.addEventListener('click', () => {
  if (!cart.length) return;
  const state = getOpenState();
  if (!state.open) {
    toast(`Restauranten er stengt. Vi åpner ${state.opensAt}.`);
    return;
  }
  setView('checkout');
  setStep(1);
});

el.btnStepBack.addEventListener('click', () => {
  if (ui.checkoutStep === 1) setView('cart');
  else setStep(ui.checkoutStep - 1);
});

el.btnStepNext.addEventListener('click', () => {
  if (ui.checkoutStep === 1) {
    setStep(2);
    return;
  }
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

el.timeGrid.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-time]');
  if (!btn) return;
  ui.pickup = btn.dataset.time;
  el.errTime.hidden = true;
  renderCheckout();
});

el.btnAllergens.addEventListener('click', () => {
  ui.allergensOpen = !ui.allergensOpen;
  renderAllergenPicker();
});
el.allergenPicker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-allergen]');
  if (!button) return;
  const label = button.dataset.allergen;
  ui.selectedAllergens = ui.selectedAllergens.includes(label)
    ? ui.selectedAllergens.filter((value) => value !== label)
    : [...ui.selectedAllergens, label];
  renderAllergenPicker();
  renderMenu();
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
  renderBottomBar();
  if (ui.view === 'cart') renderCart();
  if (ui.view === 'checkout') renderCheckout();
  if (ui.view === 'profile') renderProfile();
  if (ui.view === 'info') renderInfo();
  if (draft) renderSheet();
  return changed;
}

function updateSyncBadge() {
  el.syncBadge.textContent =
    backendInfo.mode === 'firebase' ? 'Live · Firebase' : 'Frakoblet · lokal kopi';
}

updateSyncBadge();

subscribe((_state, origin) => {
  const changed = renderAll();
  updateSyncBadge();
  if (origin === 'remote' && changed) toast('Menyen er oppdatert av restauranten.');
});

ready().then(() => {
  updateSyncBadge();
  renderAll();
  setView('menu');
});

// Status og åpningstid holdes oppdatert mens siden er åpen.
setInterval(() => {
  updateSyncBadge();
  renderOpenState();
}, 5000);

renderAll();
