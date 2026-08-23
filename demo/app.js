/*
 * KØL GRILL & PIZZA — CUSTOMER APP — STABLE BASELINE 2026-08-23
 *
 * MAINTENANCE CONTRACT FOR FUTURE DEVELOPERS / AI AGENTS
 * -------------------------------------------------------
 * This is the single canonical JavaScript file for the customer app.
 * The previous app-core / checkout patch files were consolidated here
 * without changing their execution order or working behavior.
 *
 * CHECKOUT CONTRACT:
 * - 3 steps: Bestilling -> Kontakt -> Hentetid.
 * - Completed progress steps are clickable for backwards navigation.
 * - No pickup option is selected automatically.
 * - Send bestilling may be clicked without a pickup choice ONLY to show
 *   the validation warning/focus. It must never submit without a choice.
 * - Pickup-time restrictions are temporarily in explicit TEST MODE.
 *   Restore real clock restrictions deliberately before production.
 *
 * INTEGRATION CONTRACT:
 * - Preserve the Firebase/admin menu bridge and `kol:order-ready` event.
 * - Preserve the admin order payload shape unless admin is changed too.
 *
 * CHANGE POLICY:
 * - Prefer small local edits in this file instead of adding patch files.
 * - Do not duplicate an existing function merely to override it later.
 * - index.html = structure, app.js = behavior, kol.css = presentation.
 * - Keep all customer screens scrollable.
 */
/* KØL customer app — refactored 2026-08-20 */
/* Vanilla JS, static-hosting friendly. LocalStorage remains demo persistence only. */

// =====================================================
// CONSTANTS & DEFAULT DATA
// =====================================================

const STORAGE_KEYS = {
  cart: 'kol-demo-cart-v3',
  orders: 'kol-demo-orders-v3',
  allergens: 'kol-demo-allergens-v3',
  accounts: 'kol-demo-accounts-v2',
  session: 'kol-demo-session-v2',
  guestFav: 'kol-demo-guest-fav-v2',
};

const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=640&q=80',
];

let MENU = [
  { id: 'popular', title: 'Mest bestilt', virtual: true },
  {
    id: 'pizza',
    type: 'pizza',
    title: 'Pizza',
    note: 'Alle pizzaer kommer med ost og tomatsaus: Stor for 2–3 personer, medium for 1 person.',
    items: [
      { id: 'p1', name: '1. Clasico', description: 'Skinke eller pepperoni', image: IMAGE_URLS[0], allergens: ['gluten', 'melk'], sizes: [['Medium', 145], ['Stor', 175]] },
      { id: 'p2', name: '2. Capri', description: 'Skinke, bacon og sopp', image: IMAGE_URLS[1], allergens: ['gluten', 'melk'], sizes: [['Medium', 155], ['Stor', 185]] },
      { id: 'p3', name: '3. Al capone', description: 'Pepperoni, biff, paprika og løk', image: IMAGE_URLS[0], allergens: ['gluten', 'melk'], sizes: [['Medium', 165], ['Stor', 195]] },
      { id: 'p4', name: '4. Parma', description: 'Parmaskinke, pesto-olje, rukkola og parmesanost', image: IMAGE_URLS[1], allergens: ['gluten', 'melk', 'nøtter'], sizes: [['Medium', 185], ['Stor', 215]] },
      { id: 'p5', name: '5. Sjefens favoritt', description: 'Biff, skinke, pepperoni og paprika', image: IMAGE_URLS[0], allergens: ['gluten', 'melk'], sizes: [['Medium', 185], ['Stor', 215]] },
      { id: 'p6', name: '6. Torino', description: 'Pepperoni, skinke, løk og paprika', image: IMAGE_URLS[1], allergens: ['gluten', 'melk'], sizes: [['Medium', 175], ['Stor', 205]] },
    ],
  },
  {
    id: 'kebab',
    title: 'Kebab retter',
    items: [
      { id: 'k1', name: 'Kebab i pita', description: 'Kebabkjøtt, salat og dressing', image: IMAGE_URLS[2], allergens: ['gluten', 'melk', 'egg', 'sennep', 'sesam'], strengths: ['Mild', 'Medium', 'Sterk'], sizes: [['Standard', 149]] },
      { id: 'k2', name: 'Kebab tallerken', description: 'Kebabkjøtt, pommes frites, salat og dressing', image: IMAGE_URLS[2], allergens: ['melk', 'egg', 'sennep'], strengths: ['Mild', 'Medium', 'Sterk'], sizes: [['Standard', 189]] },
    ],
  },
  {
    id: 'burger',
    title: 'Hjemmelagde burgere',
    items: [
      { id: 'b1', name: 'Cheeseburger', description: 'Burger, ost, salat og dressing', image: IMAGE_URLS[2], allergens: ['gluten', 'melk', 'egg', 'sennep', 'sesam'], sizes: [['160 g', 159], ['250 g', 199]] },
      { id: 'b2', name: 'Baconburger', description: 'Burger, bacon, ost og salat', image: IMAGE_URLS[2], allergens: ['gluten', 'melk', 'egg', 'sennep', 'sesam'], sizes: [['160 g', 179], ['250 g', 219]] },
    ],
  },
  {
    id: 'drikke',
    title: 'Drikke',
    items: [
      { id: 'd1', name: 'Coca-Cola 0,5L', description: 'Kald drikke', image: '', allergens: [], sizes: [['0,5L', 39]] },
      { id: 'd2', name: 'Fanta 0,5L', description: 'Kald drikke', image: '', allergens: [], sizes: [['0,5L', 39]] },
    ],
  },
];

const ALLERGENS = [
  ['melk', '🥛', 'Melk'],
  ['gluten', '🌾', 'Hvete / gluten'],
  ['egg', '🥚', 'Egg'],
  ['soya', '🫘', 'Soya'],
  ['selleri', '🌿', 'Selleri'],
  ['sennep', '🟡', 'Sennep'],
  ['sesam', '◌', 'Sesam'],
  ['fisk', '🐟', 'Fisk'],
  ['skalldyr', '🦐', 'Skalldyr'],
  ['peanøtter', '🥜', 'Peanøtter'],
  ['nøtter', '🌰', 'Nøtter'],
  ['sulfitter', '◇', 'Sulfitter'],
];

const ADMIN_ALLERGEN_MAP = {
  melk: 'melk',
  hvete: 'gluten',
  gluten: 'gluten',
  egg: 'egg',
  soya: 'soya',
  selleri: 'selleri',
  sennep: 'sennep',
  sesam: 'sesam',
  fisk: 'fisk',
  skalldyr: 'skalldyr',
  peanøtter: 'peanøtter',
  peanotter: 'peanøtter',
  nøtter: 'nøtter',
  notter: 'nøtter',
  sulfitter: 'sulfitter',
};

const KOL_ADMIN_BRIDGE = {
  mode: 'local-demo',
  databaseURL: 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/',
  menuKeys: ['sections', 'extraOptions', 'customPizzaToppings', 'kebabPitaOptions', 'optionGroups', 'siteSettings', 'rescueDeals'],
};

let activeSiteSettings = {
  restaurantName: 'KØL Grill & Pizza',
  phone: '+47 41 14 53 53',
  streetAddress: 'ØGARDSVEGEN 44',
  postalCode: '2100',
  city: 'SKARNES',
  openingDays: 'Mandag - Søndag',
  orderOpenTime: '14:00',
  orderCloseTime: '22:00',
  minPreorderMinutes: '0',
};

// =====================================================
// DOM, STORAGE & STRING HELPERS
// =====================================================

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function norm(value) {
  return String(value || '')
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url || /[\u0000-\u001f"'<>\\]/.test(url)) return '';
  if (/^(https?:|blob:|\/|\.\.?\/)/i.test(url)) return url;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) return url;
  return '';
}

function formatPhone(value) {
  return String(value || '').replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

function formatStorePhone(value = '') {
  const digits = String(value).replace(/\D/g, '').replace(/^47(?=\d{8}$)/, '');
  return digits.length === 8 ? `+47 ${formatPhone(digits)}` : String(value || '');
}

function money(value) {
  return `${Number(value || 0).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}

function productMoney(value) {
  return `${Number(value || 0).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KR`;
}

function createLocalOrderId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// =====================================================
// STATE
// =====================================================

const state = {
  cart: loadStorage(STORAGE_KEYS.cart, []),
  orders: loadStorage(STORAGE_KEYS.orders, []),
  accounts: loadStorage(STORAGE_KEYS.accounts, {}),
  session: loadStorage(STORAGE_KEYS.session, null),
  allergens: {
    selected: new Set(loadStorage(STORAGE_KEYS.allergens, [])),
    draft: new Set(),
    search: '',
  },
  menu: {
    searchOpen: false,
    searchQuery: '',
    expanded: { popular: false, favorites: false },
  },
  product: {
    selected: null,
    sizeIndex: 0,
    strength: '',
    qty: 1,
    editingCartIndex: -1,
  },
  checkout: {
    step: 1,
    pickupChoice: '',
    pickupMode: '',
  },
  loyalty: {
    rewardMode: false,
  },
  ui: {
    toastTimer: 0,
    syncFrame: 0,
  },
};

state.allergens.draft = new Set(state.allergens.selected);

// =====================================================
// ADMIN CONFIG NORMALIZATION
// =====================================================

function adminArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function adminAllergens(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;|]/);
  return [...new Set(source.map(item => ADMIN_ALLERGEN_MAP[norm(String(item).trim())]).filter(Boolean))];
}

function adminSizes(product = {}) {
  const sizes = adminArray(product.sizes)
    .map((size, index) => [
      String(size?.label || size?.name || size?.id || `Valg ${index + 1}`),
      Number(size?.price),
    ])
    .filter(size => Number.isFinite(size[1]));

  if (!sizes.length && Number.isFinite(Number(product.mediumPrice))) sizes.push(['Medium', Number(product.mediumPrice)]);
  if (!sizes.length && Number.isFinite(Number(product.price))) sizes.push(['Standard', Number(product.price)]);
  if (Number.isFinite(Number(product.largePrice)) && !sizes.some(size => norm(size[0]) === 'stor')) {
    sizes.push(['Stor', Number(product.largePrice)]);
  }

  return sizes.length ? sizes : [['Standard', 0]];
}

function inferLegacySectionType(sectionId, title) {
  return norm(`${sectionId} ${title}`).includes('pizza') ? 'pizza' : '';
}

function optionGroupType(group = {}) {
  const explicitType = norm(group.type || group.kind || '');
  if (explicitType) return explicitType;

  const options = adminArray(group.options);
  const looksLikeSpice = norm(group.title).includes('styrke') || options.some(option => ['mild', 'medium', 'sterk'].includes(norm(option?.label)));
  return looksLikeSpice ? 'spice' : '';
}

function adminStrengths(product = {}, config = {}) {
  const groupIds = new Set(adminArray(product.optionGroupIds).map(String));
  const group = adminArray(config.optionGroups).find(candidate => {
    if (!groupIds.has(String(candidate?.id))) return false;
    return ['spice', 'spice-level', 'strength', 'styrke'].includes(optionGroupType(candidate));
  });

  return group
    ? adminArray(group.options).map(option => String(option?.label || '').trim()).filter(Boolean)
    : [];
}

function normalizeAdminConfigForCustomer(config = {}) {
  return adminArray(config.sections)
    .map((section, sectionIndex) => {
      const sectionId = String(section?.id || `section-${sectionIndex + 1}`);
      const title = String(section?.title || section?.name || `Kategori ${sectionIndex + 1}`);
      const sectionType = norm(section?.type || inferLegacySectionType(sectionId, title));
      const sectionLoyaltyEligible = typeof section?.loyaltyEligible === 'boolean'
        ? section.loyaltyEligible
        : sectionType === 'pizza';

      const sectionItems = adminArray(section?.items)
        .filter(product => product && product.hidden !== true && product.soldOut !== true)
        .map((product, productIndex) => ({
          id: String(product.id || `${sectionId}-${productIndex + 1}`),
          name: String(product.name || 'Produkt'),
          description: String(product.ingredients || product.description || ''),
          image: String(product.imageUrl || product.image || ''),
          allergens: adminAllergens(product.allergens),
          sizes: adminSizes(product),
          strengths: adminStrengths(product, config),
          optionGroups: adminArray(product.optionGroupIds),
          sectionType,
          loyaltyEligible: typeof product.loyaltyEligible === 'boolean'
            ? product.loyaltyEligible
            : sectionLoyaltyEligible,
        }));

      return {
        id: sectionId,
        type: sectionType,
        title,
        note: String(section?.note || section?.description || ''),
        loyaltyEligible: sectionLoyaltyEligible,
        items: sectionItems,
      };
    })
    .filter(section => section.items.length);
}

function applySiteSettings(settings = {}) {
  activeSiteSettings = { ...activeSiteSettings, ...settings };

  const name = activeSiteSettings.restaurantName || 'KØL Grill & Pizza';
  const address = [
    activeSiteSettings.streetAddress,
    [activeSiteSettings.postalCode, activeSiteSettings.city].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');
  const phone = formatStorePhone(activeSiteSettings.phone);
  const tel = String(activeSiteSettings.phone || '').replace(/[^+\d]/g, '');
  const days = String(activeSiteSettings.openingDays || 'Mandag - Søndag').replace(/ - /g, '–');
  const hours = `${activeSiteSettings.orderOpenTime || '14:00'}–${activeSiteSettings.orderCloseTime || '22:00'}`;

  if ($('#storeName')) $('#storeName').textContent = name;
  if ($('#storeAddress')) $('#storeAddress').textContent = address;
  if ($('#storePhoneText')) $('#storePhoneText').textContent = phone;
  if ($('#storeCallAction')) $('#storeCallAction').href = `tel:${tel}`;
  if ($('#storePhoneRow')) $('#storePhoneRow').href = `tel:${tel}`;
  if ($('#storeOpeningDays')) $('#storeOpeningDays').textContent = days;
  if ($('#storeOpeningTime')) $('#storeOpeningTime').textContent = hours;
}

function applyAdminConfig(config = {}) {
  const sections = normalizeAdminConfigForCustomer(config);
  if (!sections.length) return false;

  MENU = [{ id: 'popular', title: 'Mest bestilt', virtual: true }, ...sections];
  applySiteSettings(config.siteSettings || {});
  renderAll();
  return true;
}

function splitCustomerName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

/* Demo payload only. Price, discount, loyalty and order identity must be verified server-side in production. */
function buildAdminOrderPayload({ id, name, phone, total, pickup, lines, createdAt = new Date().toISOString() }) {
  const person = splitCustomerName(name);
  const scheduled = pickup && pickup !== 'asap';

  return {
    id: String(id),
    status: 'pending',
    source: 'kol-customer',
    customer: {
      fullName: String(name),
      firstName: person.firstName,
      lastName: person.lastName,
      phone: String(phone),
    },
    pickup: {
      mode: scheduled ? 'scheduled' : 'asap',
      time: scheduled ? String(pickup) : '',
    },
    items: (lines || []).map(line => ({
      productId: String(line.productId || ''),
      name: String(line.name || 'Produkt'),
      quantity: Math.max(1, Number(line.qty) || 1),
      size: String(line.size || ''),
      sizeLabel: String(line.size || ''),
      extras: line.strength ? [`Styrke: ${line.strength}`] : [],
      note: String(line.note || ''),
      unitPrice: Number(line.price) || 0,
      total: (Number(line.price) || 0) * Math.max(1, Number(line.qty) || 1),
      freeReward: line.freeReward === true,
    })),
    subtotal: Number(total) || 0,
    total: Number(total) || 0,
    createdAt,
    updatedAt: createdAt,
  };
}

window.KOLIntegration = {
  ...KOL_ADMIN_BRIDGE,
  applyAdminConfig,
  applySiteSettings,
  normalizeAdminConfigForCustomer,
  buildAdminOrderPayload,
};

// =====================================================
// MENU & PRODUCT HELPERS
// =====================================================

function realSections() {
  return MENU.filter(section => !section.virtual);
}

function items() {
  return realSections().flatMap(section => (section.items || []).map(item => ({
    ...item,
    sectionId: section.id,
    sectionType: item.sectionType || section.type || '',
  })));
}

function product(id) {
  return items().find(item => item.id === id);
}

function allergenLabel(id) {
  return ALLERGENS.find(allergen => allergen[0] === id)?.[2] || id;
}

function isPizzaLoyaltyProduct(item) {
  return item?.loyaltyEligible === true || item?.sectionType === 'pizza' || item?.sectionId === 'pizza';
}

// =====================================================
// ACCOUNT, FAVORITES & LOYALTY STATE
// =====================================================

function normalizeLoyalty(accountData) {
  if (!accountData) return accountData;

  let changed = false;
  const legacyRewards = Math.max(0, Number(accountData.rewards) || 0);
  let stamps = Math.max(0, Number(accountData.stamps) || 0);

  if (legacyRewards > 0 && stamps < 10) {
    stamps = 10;
    changed = true;
  }
  if (stamps > 10) {
    stamps = 10;
    changed = true;
  }
  if (accountData.stamps !== stamps) {
    accountData.stamps = stamps;
    changed = true;
  }
  if (accountData.rewards !== 0) {
    accountData.rewards = 0;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(accountData, 'savings')) {
    delete accountData.savings;
    changed = true;
  }

  if (changed) saveStorage(STORAGE_KEYS.accounts, state.accounts);
  return accountData;
}

function account() {
  return state.session && state.accounts[state.session]
    ? normalizeLoyalty(state.accounts[state.session])
    : null;
}

function favoriteSet() {
  return new Set(account()?.favorites || loadStorage(STORAGE_KEYS.guestFav, []));
}

function saveFavorites(favorites) {
  const currentAccount = account();
  if (currentAccount) {
    state.accounts[state.session].favorites = [...favorites];
    saveAccounts();
  } else {
    saveStorage(STORAGE_KEYS.guestFav, [...favorites]);
  }
}

function ensureAccount(phone) {
  if (!state.accounts[phone]) {
    state.accounts[phone] = {
      phone,
      name: '',
      email: '',
      marketing: true,
      stamps: 0,
      rewards: 0,
      favorites: [],
    };
  }

  normalizeLoyalty(state.accounts[phone]);
  saveAccounts();
  return state.accounts[phone];
}

function saveAccounts() {
  saveStorage(STORAGE_KEYS.accounts, state.accounts);
}

function setSession(phone) {
  state.session = phone || null;
  saveStorage(STORAGE_KEYS.session, state.session);
  renderHeader();
  renderTabs();
  renderMenu();
}

function upsertCheckoutAccount(name, phone) {
  const guestFavorites = loadStorage(STORAGE_KEYS.guestFav, []);
  let currentAccount = account();

  if (currentAccount && state.session !== phone) {
    const oldPhone = state.session;
    const existing = state.accounts[phone];

    if (existing) {
      existing.favorites = [...new Set([...(existing.favorites || []), ...(currentAccount.favorites || [])])];
      existing.stamps = Math.max(Number(existing.stamps) || 0, Number(currentAccount.stamps) || 0);
      existing.email = existing.email || currentAccount.email || '';
      existing.marketing = existing.marketing ?? currentAccount.marketing;
      delete state.accounts[oldPhone];
      currentAccount = existing;
    } else {
      delete state.accounts[oldPhone];
      currentAccount = { ...currentAccount, phone };
      state.accounts[phone] = currentAccount;
    }

    state.session = phone;
    saveStorage(STORAGE_KEYS.session, state.session);
  }

  if (!currentAccount) {
    currentAccount = ensureAccount(phone);
    state.session = phone;
    saveStorage(STORAGE_KEYS.session, state.session);
  }

  currentAccount.name = name;
  currentAccount.phone = phone;
  currentAccount.favorites = [...new Set([...(currentAccount.favorites || []), ...guestFavorites])];
  saveStorage(STORAGE_KEYS.guestFav, []);
  saveAccounts();
  return currentAccount;
}

// =====================================================
// VIEW & HEADER
// =====================================================

function showToast(message) {
  const toast = $('#actionToast');
  if (!toast || !message) return;

  clearTimeout(state.ui.toastTimer);
  toast.textContent = message;
  toast.classList.remove('show');
  requestAnimationFrame(() => toast.classList.add('show'));
  state.ui.toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function closeViews() {
  $$('.screen').forEach(screen => { screen.hidden = true; });
  document.body.classList.remove('view-open', 'hide-tabs');
  const cartScreen = $('#cartScreen');
  if (cartScreen) cartScreen.style.top = '';
}

function openView(id, { tabs = true } = {}) {
  closeViews();
  const view = $(`#${id}`);
  if (!view) return;

  view.hidden = false;
  document.body.classList.add('view-open');
  if (!tabs) document.body.classList.add('hide-tabs');
}

function goMenu() {
  state.loyalty.rewardMode = false;
  closeViews();
  requestAnimationFrame(syncActiveCategory);
}

function goToCategory(id) {
  state.loyalty.rewardMode = false;
  closeViews();

  requestAnimationFrame(() => {
    const shell = $('#menuShell');
    const section = [...document.querySelectorAll('[data-section]')].find(node => node.dataset.section === String(id));
    if (!shell || !section) return;

    setActiveTab(id, true);
    const top = shell.scrollTop + section.getBoundingClientRect().top - shell.getBoundingClientRect().top;
    shell.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

function renderHeader() {
  const currentAccount = account();
  const profileButton = $('#profileBtn');
  if (!profileButton) return;

  profileButton.innerHTML = currentAccount
    ? `<span class="profile-letter">${escapeHtml((currentAccount.name || currentAccount.phone || 'K').trim().charAt(0).toUpperCase())}</span>`
    : '<svg class="plain-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 19c.8-3.1 3-4.7 6.2-4.7s5.4 1.6 6.2 4.7"/></svg>';
}

function renderCartCount() {
  const count = state.cart.reduce((total, line) => total + line.qty, 0);
  if ($('#cartCount')) $('#cartCount').textContent = count;
}

// =====================================================
// MENU
// =====================================================

function renderTabs() {
  const host = $('#tabs');
  if (!host) return;

  if (state.menu.searchOpen) {
    host.innerHTML = `<div class="tab-search"><span>⌕</span><input id="menuSearch" placeholder="Søk i menyen" value="${escapeHtml(state.menu.searchQuery)}"><button id="searchCancel">Avbryt</button></div>`;
    const input = $('#menuSearch');
    input?.focus();
    if (input) input.oninput = event => {
      state.menu.searchQuery = event.target.value;
      renderMenu();
    };
    if ($('#searchCancel')) $('#searchCancel').onclick = () => {
      state.menu.searchOpen = false;
      state.menu.searchQuery = '';
      renderTabs();
      renderMenu();
    };
    return;
  }

  const favorites = favoriteSet();
  const tabs = [
    ...(favorites.size ? [{ id: 'favorites', title: 'Mine favoritter' }] : []),
    ...MENU,
  ];

  host.innerHTML = '<button class="search-tab" id="searchOpen">⌕</button>' + tabs
    .map(section => `<button class="category-tab" data-tab="${escapeHtml(section.id)}">${escapeHtml(section.title)}</button>`)
    .join('');

  if ($('#searchOpen')) $('#searchOpen').onclick = () => {
    goMenu();
    state.menu.searchOpen = true;
    renderTabs();
  };

  $$('[data-tab]').forEach(button => {
    button.onclick = () => goToCategory(button.dataset.tab);
  });
}

function setActiveTab(id, center = true) {
  if (state.menu.searchOpen) return;

  $$('.category-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === id);
  });

  const tab = [...document.querySelectorAll('.category-tab')].find(button => button.dataset.tab === id);
  if (tab && center) tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function syncActiveCategory() {
  state.ui.syncFrame = 0;
  if (state.menu.searchOpen || document.body.classList.contains('view-open')) return;

  const shell = $('#menuShell');
  const sections = $$('.menu-section[data-section]');
  if (!shell || !sections.length) return;

  const marker = shell.getBoundingClientRect().top + 70;
  let active = sections[0].dataset.section;

  for (const section of sections) {
    if (section.getBoundingClientRect().top <= marker) active = section.dataset.section;
    else break;
  }

  setActiveTab(active, true);
}

function scheduleSync() {
  if (state.ui.syncFrame) cancelAnimationFrame(state.ui.syncFrame);
  state.ui.syncFrame = requestAnimationFrame(syncActiveCategory);
}

function allergenWarning(productData) {
  const hits = (productData.allergens || []).filter(id => state.allergens.selected.has(id));
  if (!hits.length) return '';
  return `<div class="menu-allergen-warning">Inneholder: ${hits.map(id => escapeHtml(allergenLabel(id))).join(', ')}</div>`;
}

function productRow(productData) {
  const favorites = favoriteSet();
  const price = Math.min(...productData.sizes.map(size => size[1]));
  const image = safeImageUrl(productData.image);
  const imageStyle = image ? ` style="background-image:url(&quot;${escapeHtml(image)}&quot;)"` : '';
  const id = escapeHtml(productData.id);

  return `<article class="menu-row" data-product="${id}">
    <div class="menu-thumb"${imageStyle}></div>
    <div class="menu-main">
      <strong>${escapeHtml(productData.name)}</strong>
      <div class="menu-desc">${escapeHtml(productData.description || '')}</div>
      ${allergenWarning(productData)}
    </div>
    <div class="menu-side">
      <button class="heart ${favorites.has(productData.id) ? 'active' : ''}" data-fav="${id}">${favorites.has(productData.id) ? '♥' : '♡'}</button>
      <button class="plus" data-plus="${id}">+</button>
      <span class="price">Fra ${money(price).replace(',00', '')}</span>
    </div>
  </article>`;
}

function menuSection(id, title, list, note = '', virtual = false) {
  let shown = list;
  let more = '';

  if (virtual && list.length > 3 && !state.menu.expanded[id]) shown = list.slice(0, 3);
  if (virtual && list.length > 3) {
    more = `<button class="vis-more" data-more="${escapeHtml(id)}">${state.menu.expanded[id] ? 'Vis mindre' : 'Vis mer'}</button>`;
  }

  return `<section class="menu-section" data-section="${escapeHtml(id)}">
    <div class="menu-section-head"><div><h2>${escapeHtml(title)}</h2>${note ? `<p>${escapeHtml(note)}</p>` : ''}</div></div>
    ${shown.map(productRow).join('') || '<div class="empty-note">Ingen produkter her ennå.</div>'}
    ${more}
  </section>`;
}

function renderMenu() {
  const allProducts = items();
  const favorites = favoriteSet();
  const query = norm(state.menu.searchQuery);
  const host = $('#menuSections');
  if (!host) return;

  if (state.menu.searchOpen && query) {
    const found = allProducts.filter(item => norm(`${item.name} ${item.description}`).includes(query));
    host.innerHTML = menuSection('search', 'Søkeresultater', found, `${found.length} produkter`);
    bindMenu();
    return;
  }

  let html = '';
  const favoriteItems = allProducts.filter(item => favorites.has(item.id));
  if (favoriteItems.length) html += menuSection('favorites', 'Mine favoritter', favoriteItems, '', true);
  html += menuSection('popular', 'Mest bestilt', allProducts.slice(0, 5), 'Populære valg i testmenyen.', true);
  realSections().forEach(section => {
    html += menuSection(section.id, section.title, section.items || [], section.note || '');
  });

  host.innerHTML = html;
  bindMenu();
  scheduleSync();
}

function refreshFavoriteUi() {
  const activeBefore = document.querySelector('.category-tab.active')?.dataset.tab || '';
  const hasFavorites = favoriteSet().size > 0;

  renderMenu();
  renderTabs();

  requestAnimationFrame(() => {
    const stillExists = [...document.querySelectorAll('.category-tab')].some(button => button.dataset.tab === activeBefore);
    if (activeBefore && stillExists) setActiveTab(activeBefore, false);
    else if (!hasFavorites) setActiveTab('popular', false);
    else scheduleSync();
  });
}

function bindMenu() {
  $$('[data-plus]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      openProduct(button.dataset.plus);
    };
  });

  $$('[data-product]').forEach(row => {
    row.onclick = event => {
      if (!event.target.closest('button')) openProduct(row.dataset.product);
    };
  });

  $$('[data-fav]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const favorites = favoriteSet();
      const id = button.dataset.fav;
      const wasFavorite = favorites.has(id);
      if (wasFavorite) favorites.delete(id);
      else favorites.add(id);

      saveFavorites(favorites);
      refreshFavoriteUi();
      showToast(wasFavorite ? 'Fjernet fra favoritter' : 'Lagt til i favoritter');
    };
  });

  $$('[data-more]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.more;
      state.menu.expanded[id] = !state.menu.expanded[id];
      renderMenu();
    };
  });
}

// =====================================================
// PRODUCT
// =====================================================

function openProduct(id, { reward = false } = {}) {
  const selected = product(id);
  if (!selected) return;

  state.loyalty.rewardMode = Boolean(reward);
  state.product.editingCartIndex = -1;
  state.product.selected = selected;
  state.product.sizeIndex = 0;
  state.product.strength = selected.strengths?.[0] || '';
  state.product.qty = 1;

  if (state.loyalty.rewardMode) {
    const largeIndex = selected.sizes.findIndex(size => norm(size[0]) === 'stor');
    if (largeIndex < 0) {
      state.loyalty.rewardMode = false;
      showToast('Denne pizzaen finnes ikke som Stor');
      return;
    }
    state.product.sizeIndex = largeIndex;
  }

  $('#addToCart').textContent = state.loyalty.rewardMode ? 'Legg til gratis Stor Pizza' : 'Legg til i handlekurven';
  fillProduct();
  openView('productScreen', { tabs: true });
  setActiveTab(selected.sectionId, true);
}

function openCartEdit(index) {
  const line = state.cart[index];
  const selected = line && product(line.productId);
  if (!line || !selected) return;

  state.loyalty.rewardMode = Boolean(line.freeReward);
  state.product.editingCartIndex = index;
  state.product.selected = selected;
  state.product.sizeIndex = Math.max(0, selected.sizes.findIndex(size => size[0] === line.size));
  state.product.strength = line.strength || selected.strengths?.[0] || '';
  state.product.qty = state.loyalty.rewardMode ? 1 : Math.max(1, line.qty || 1);

  $('#addToCart').textContent = state.loyalty.rewardMode ? 'Oppdater gratis pizza' : 'Oppdater handlekurven';
  fillProduct(line.note || '');
  openView('productScreen', { tabs: true });
  setActiveTab(selected.sectionId, true);
}

function fillProduct(note = '') {
  const selected = state.product.selected;
  if (!selected) return;

  $('#productTitle').textContent = selected.name;
  $('#productDesc').textContent = selected.description || '';
  $('#productPhoto').style.backgroundImage = safeImageUrl(selected.image) ? `url("${safeImageUrl(selected.image)}")` : '';

  const allergenNames = (selected.allergens || []).map(allergenLabel);
  $('#productAllergens').innerHTML = `<strong>Allergener:</strong> ${allergenNames.length ? allergenNames.map(escapeHtml).join(', ') : 'Ingen oppgitt'}`;
  $('#qtyValue').textContent = state.product.qty;
  $('#productNote').value = note;

  const banner = $('#rewardProductBanner');
  const quantityRow = document.querySelector('.quantity-row');
  if (state.loyalty.rewardMode) {
    const regularPrice = selected.sizes[state.product.sizeIndex][1];
    banner.hidden = false;
    banner.innerHTML = `🎁 <strong>Gratis Stor Pizza</strong><span>Du sparer ${money(regularPrice)}</span>`;
    quantityRow.hidden = true;
  } else {
    banner.hidden = true;
    banner.innerHTML = '';
    quantityRow.hidden = false;
  }

  renderSizeOptions();
  renderStrengthOptions();
  updateProductTotal();
}

function renderSizeOptions() {
  const selected = state.product.selected;
  const group = $('#sizeGroup');
  if (!selected || !group) return;

  if (state.loyalty.rewardMode || selected.sizes.length <= 1) {
    group.hidden = true;
    $('#sizeOptions').innerHTML = '';
    return;
  }

  group.hidden = false;
  $('#sizeOptions').innerHTML = selected.sizes.map((size, index) => `
    <button class="product-choice ${index === state.product.sizeIndex ? 'active' : ''}" data-size="${index}">
      <span class="choice-mark">${index === state.product.sizeIndex ? '✓' : ''}</span>
      <span>${escapeHtml(size[0])}</span>
      <strong>${money(size[1]).replace(',00', '')}</strong>
    </button>
  `).join('');

  $$('[data-size]').forEach(button => {
    button.onclick = () => {
      state.product.sizeIndex = Number(button.dataset.size);
      renderSizeOptions();
      updateProductTotal();
    };
  });
}

function renderStrengthOptions() {
  const selected = state.product.selected;
  const group = $('#strengthGroup');
  if (!selected || !group) return;

  const values = selected.strengths || [];
  if (!values.length || state.loyalty.rewardMode) {
    group.hidden = true;
    $('#strengthOptions').innerHTML = '';
    return;
  }

  group.hidden = false;
  $('#strengthOptions').innerHTML = values.map(value => `
    <button class="product-choice ${value === state.product.strength ? 'active' : ''}" data-strength="${escapeHtml(value)}">
      <span class="choice-mark">${value === state.product.strength ? '✓' : ''}</span>
      <span>${escapeHtml(value)}</span>
    </button>
  `).join('');

  $$('[data-strength]').forEach(button => {
    button.onclick = () => {
      state.product.strength = button.dataset.strength;
      renderStrengthOptions();
    };
  });
}

function updateProductTotal() {
  const selected = state.product.selected;
  if (!selected) return;

  const total = selected.sizes[state.product.sizeIndex][1] * state.product.qty;
  $('#productTotal').textContent = state.loyalty.rewardMode ? '0,00 KR' : productMoney(total);
}

function addOrUpdateCart() {
  const selected = state.product.selected;
  if (!selected) return;

  const size = selected.sizes[state.product.sizeIndex];
  const note = $('#productNote').value.trim();
  const strength = selected.strengths?.length ? state.product.strength : '';
  const editingIndex = state.product.editingCartIndex;

  if (state.loyalty.rewardMode) {
    const currentAccount = account();
    if (!currentAccount || currentAccount.stamps < 10) {
      state.loyalty.rewardMode = false;
      showToast('Gratis pizza er ikke tilgjengelig');
      return;
    }

    if (state.cart.some((line, index) => line.freeReward && index !== editingIndex)) {
      showToast('Gratis pizza ligger allerede i handlekurven');
      return;
    }

    const entry = {
      key: `reward|${selected.id}|Stor|${note}`,
      productId: selected.id,
      name: selected.name,
      size: 'Stor',
      strength: '',
      price: 0,
      regularPrice: size[1],
      qty: 1,
      note,
      freeReward: true,
    };

    if (editingIndex >= 0 && state.cart[editingIndex]) state.cart[editingIndex] = entry;
    else state.cart.push(entry);

    state.product.editingCartIndex = -1;
    state.loyalty.rewardMode = false;
    saveStorage(STORAGE_KEYS.cart, state.cart);
    renderCartCount();
    renderCart();
    openView('cartScreen', { tabs: true });
    showToast(`Gratis pizza lagt i handlekurven – du sparer ${money(size[1])}`);
    return;
  }

  const entry = {
    key: `${selected.id}|${size[0]}|${strength}|${note}`,
    productId: selected.id,
    name: selected.name,
    size: size[0],
    strength,
    price: size[1],
    qty: state.product.qty,
    note,
    loyaltyEligible: isPizzaLoyaltyProduct(selected),
  };

  if (editingIndex >= 0 && state.cart[editingIndex]) {
    state.cart[editingIndex] = entry;
    state.product.editingCartIndex = -1;
    saveStorage(STORAGE_KEYS.cart, state.cart);
    renderCartCount();
    renderCart();
    openView('cartScreen', { tabs: true });
    showToast('Handlekurv oppdatert');
    return;
  }

  const existing = state.cart.find(line => line.key === entry.key);
  if (existing) existing.qty += state.product.qty;
  else state.cart.push(entry);

  saveStorage(STORAGE_KEYS.cart, state.cart);
  renderCartCount();
  goMenu();
  showToast(`${selected.name} lagt i handlekurven`);
}

// =====================================================
// CART & CHECKOUT
// =====================================================

function checkoutContactState() {
  const name = $('#checkoutName')?.value.trim() || '';
  const phone = $('#checkoutPhone')?.value.replace(/\D/g, '') || '';
  return { name, phone, nameOk: name.length >= 2, phoneOk: phone.length === 8 };
}

function renderCart() {
  const total = state.cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  const savings = state.cart.reduce((sum, line) => sum + (line.freeReward ? (Number(line.regularPrice) || 0) * line.qty : 0), 0);

  $('#cartLines').innerHTML = state.cart.map((line, index) => `
    <div class="cart-line ${line.freeReward ? 'reward-line' : ''}">
      <div class="cart-line-main">
        <span class="cart-qty-badge">${line.qty}x</span>
        <div class="cart-line-copy">
          <strong>${escapeHtml(line.name)}</strong>
          <small>Størrelse: <b>${escapeHtml(line.size)}</b>${line.strength ? `<br>Styrke: <b>${escapeHtml(line.strength)}</b>` : ''}${line.freeReward ? `<br><span class="reward-cart-note">Gratis medlemsfordel · Du sparer ${money(line.regularPrice || 0)}</span>` : ''}${line.note ? `<br>${escapeHtml(line.note)}` : ''}</small>
        </div>
      </div>
      <div class="cart-line-side">
        <b class="cart-line-price">${line.freeReward ? `<span class="reward-old-price">${money(line.regularPrice || 0)}</span><span class="reward-free-price">0,00 kr</span>` : money(line.price * line.qty)}</b>
        <div class="cart-line-actions">
          <button class="cart-edit-btn" data-editcart="${index}" aria-label="Rediger" title="Rediger">✎</button>
          <button class="cart-remove-btn" data-remove="${index}" aria-label="Fjern" title="Fjern">×</button>
        </div>
      </div>
    </div>
  `).join('');

  $('#cartEmpty').hidden = state.cart.length > 0;
  $('#cartTotal').textContent = money(total);
  $('#cartSavings').hidden = !savings;
  $('#cartSavings').textContent = savings ? `Du sparer ${money(savings)} med medlemsfordelen` : '';
  $('#taxNote').textContent = `(inkl. mva ${money(total * 15 / 115)})`;

  $$('[data-editcart]').forEach(button => {
    button.onclick = () => openCartEdit(Number(button.dataset.editcart));
  });

  $$('[data-remove]').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.remove);
      const removed = state.cart[index];
      state.cart.splice(index, 1);
      saveStorage(STORAGE_KEYS.cart, state.cart);
      renderCart();
      renderCartCount();
      showToast(`${removed?.name || 'Produkt'} fjernet fra handlekurven`);
    };
  });

  const currentAccount = account();
  const nameInput = $('#checkoutName');
  const phoneInput = $('#checkoutPhone');
  if (nameInput && document.activeElement !== nameInput && !nameInput.value) nameInput.value = currentAccount?.name || '';
  if (phoneInput && document.activeElement !== phoneInput && !phoneInput.value) phoneInput.value = currentAccount?.phone || '';
  if (phoneInput) phoneInput.disabled = false;

  bindCheckoutValidation();
  renderCheckoutStep();
}

function pickupSlots() {
  const now = new Date();
  const open = new Date(now);
  const close = new Date(now);
  const start = new Date(now);

  const clock = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    return match
      ? [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))]
      : fallback.split(':').map(Number);
  };

  const [openHour, openMinute] = clock(activeSiteSettings.orderOpenTime, '14:00');
  const [closeHour, closeMinute] = clock(activeSiteSettings.orderCloseTime, '22:00');
  open.setHours(openHour, openMinute, 0, 0);
  close.setHours(closeHour, closeMinute, 0, 0);
  start.setSeconds(0, 0);

  const lead = Math.max(0, Number(activeSiteSettings.minPreorderMinutes) || 0);
  start.setMinutes(start.getMinutes() + lead);

  const remainder = start.getMinutes() % 15;
  if (remainder) start.setMinutes(start.getMinutes() + (15 - remainder));
  else if (now.getSeconds() > 0 || now.getMilliseconds() > 0) start.setMinutes(start.getMinutes() + 15);

  if (start < open) start.setTime(open.getTime());

  const slots = [];
  for (let cursor = new Date(start); cursor < close; cursor.setMinutes(cursor.getMinutes() + 15)) {
    slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
  }
  return slots;
}

function pickupReady() {
  return state.checkout.pickupChoice === 'asap' || /^\d{2}:\d{2}$/.test(String(state.checkout.pickupChoice || ''));
}

function syncPickupUi() {
  const section = $('#finalPickupSection');
  if (!section) return;

  const ready = pickupReady();
  section.classList.toggle('is-complete', ready);
  section.classList.toggle('needs-choice', !ready);
}

function renderPickupTimes() {
  const host = $('#pickupOptions');
  if (!host) return;

  const slots = pickupSlots();
  const selectedTime = String(state.checkout.pickupChoice || '');

  if (/^\d{2}:\d{2}$/.test(selectedTime) && !slots.includes(selectedTime)) {
    state.checkout.pickupChoice = '';
    state.checkout.pickupMode = '';
  }

  if (state.checkout.pickupChoice === 'asap') state.checkout.pickupMode = 'asap';
  else if (/^\d{2}:\d{2}$/.test(String(state.checkout.pickupChoice || ''))) state.checkout.pickupMode = 'scheduled';

  host.innerHTML = `
    <div class="pickup-mode-row">
      <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'asap' ? 'active' : ''}" data-pickup-mode="asap">
        <span class="pickup-mode-check">${state.checkout.pickupMode === 'asap' ? '✓' : ''}</span>
        <span><strong>Snarest mulig</strong><small>Hent så snart maten er klar</small></span>
      </button>
      <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'scheduled' ? 'active' : ''}" data-pickup-mode="scheduled">
        <span class="pickup-mode-check">${state.checkout.pickupMode === 'scheduled' ? '✓' : ''}</span>
        <span><strong>Velg hentetid</strong><small>Velg et tidspunkt</small></span>
      </button>
    </div>
    <div class="pickup-time-grid" ${state.checkout.pickupMode === 'scheduled' ? '' : 'hidden'}>
      ${slots.map(time => `<button type="button" class="pickup-time-btn ${state.checkout.pickupChoice === time ? 'active' : ''}" data-pickup-time="${time}">${time}</button>`).join('')}
    </div>`;

  host.querySelectorAll('[data-pickup-mode]').forEach(button => {
    button.onclick = () => {
      state.checkout.pickupMode = button.dataset.pickupMode;
      state.checkout.pickupChoice = state.checkout.pickupMode === 'asap' ? 'asap' : '';
      renderPickupTimes();
      syncCheckoutValidation();
    };
  });

  host.querySelectorAll('[data-pickup-time]').forEach(button => {
    button.onclick = () => {
      state.checkout.pickupMode = 'scheduled';
      state.checkout.pickupChoice = button.dataset.pickupTime;
      renderPickupTimes();
      syncCheckoutValidation();
    };
  });

  syncPickupUi();
}

function syncCheckoutValidation() {
  const contact = checkoutContactState();
  const contactReady = contact.nameOk && contact.phoneOk;
  const timeReady = pickupReady();
  const nameField = $('#checkoutNameField');
  const phoneField = $('#checkoutPhoneField');
  const confirmationCard = $('#checkoutConfirmCard');
  const contactSection = $('#finalContactSection');

  nameField?.classList.toggle('valid', contact.nameOk);
  phoneField?.classList.toggle('valid', contact.phoneOk);
  contactSection?.classList.toggle('is-complete', contactReady);

  if (confirmationCard) confirmationCard.hidden = !contactReady;
  syncPickupUi();

  const stepBadge = $('#checkoutStep2 .checkout-title > span');
  const complete = contactReady && timeReady;
  if (stepBadge) {
    stepBadge.textContent = complete ? '✓' : '2';
    stepBadge.classList.toggle('step-ok', complete);
  }

  if (state.checkout.step === 2) {
    const next = $('#checkoutNext');
    if (next) {
      const canPromptTime = contactReady && !timeReady;
      next.disabled = !contactReady;
      next.classList.toggle('ready', complete);
      next.classList.toggle('needs-time', canPromptTime);
      next.classList.remove('store-closed');
      next.style.background = '';
      next.style.opacity = '1';
      next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
    }
  }
}

function bindCheckoutValidation() {
  const nameInput = $('#checkoutName');
  const phoneInput = $('#checkoutPhone');
  const pickupSection = $('#finalPickupSection');
  const bringIntoView = input => setTimeout(() => input?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);

  if (nameInput && !nameInput.dataset.validationBound) {
    nameInput.dataset.validationBound = '1';
    ['input', 'change', 'blur'].forEach(eventName => nameInput.addEventListener(eventName, syncCheckoutValidation));
    nameInput.addEventListener('focus', () => bringIntoView(nameInput));
    nameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        phoneInput?.focus();
      }
    });
  }

  if (phoneInput && !phoneInput.dataset.validationBound) {
    phoneInput.dataset.validationBound = '1';
    ['input', 'change', 'blur'].forEach(eventName => {
      phoneInput.addEventListener(eventName, () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 8);
        renderPickupTimes();
        syncCheckoutValidation();
      });
    });
    phoneInput.addEventListener('focus', () => bringIntoView(phoneInput));
    phoneInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      phoneInput.blur();
      const contact = checkoutContactState();
      if (contact.nameOk && contact.phoneOk && !pickupReady()) {
        setTimeout(() => pickupSection?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    });
  }

  syncCheckoutValidation();
  requestAnimationFrame(syncCheckoutValidation);
  setTimeout(syncCheckoutValidation, 120);
}

function renderCheckoutStep() {
  const step1 = $('#checkoutStep1');
  const step2 = $('#checkoutStep2');
  if (!step1 || !step2) return;

  step1.hidden = state.checkout.step !== 1;
  step2.hidden = state.checkout.step !== 2;

  const back = $('#checkoutBack');
  if (back) back.hidden = state.checkout.step === 1;

  const step1Badge = step1.querySelector('.checkout-title > span');
  const step2Badge = step2.querySelector('.checkout-title > span');
  const contact = checkoutContactState();
  const complete = contact.nameOk && contact.phoneOk && pickupReady();

  if (step1Badge) {
    step1Badge.textContent = state.cart.length ? '✓' : '1';
    step1Badge.classList.toggle('step-ok', Boolean(state.cart.length));
  }

  if (step2Badge) {
    step2Badge.textContent = complete ? '✓' : '2';
    step2Badge.classList.toggle('step-ok', complete);
  }

  const next = $('#checkoutNext');
  if (next) {
    next.textContent = state.checkout.step === 2 ? 'Send bestilling' : 'Neste';

    if (state.checkout.step === 1) {
      const canContinue = Boolean(state.cart.length);
      next.disabled = !canContinue;
      next.classList.toggle('ready', canContinue);
      next.classList.remove('needs-time', 'store-closed');
    } else {
      const contactReady = contact.nameOk && contact.phoneOk;
      next.disabled = !contactReady;
      next.classList.toggle('ready', complete);
      next.classList.toggle('needs-time', contactReady && !pickupReady());
      next.classList.remove('store-closed');
    }

    next.style.background = '';
    next.style.opacity = '1';
    next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
  }

  if (state.checkout.step === 2) {
    renderPickupTimes();
    syncCheckoutValidation();
  }

  const cartOpen = !$('#cartScreen').hidden;
  const focused = cartOpen && state.checkout.step === 2;
  document.body.classList.toggle('hide-tabs', focused);
  $('#cartScreen').style.top = focused ? 'var(--head)' : 'calc(var(--head) + var(--tabs))';
}

function handleCheckoutNext() {
  if (state.checkout.step === 1 && !state.cart.length) return;

  if (state.checkout.step === 1) {
    state.checkout.step = 2;
    renderCheckoutStep();

    const contact = checkoutContactState();
    if (!contact.nameOk) $('#checkoutName')?.focus();
    else if (!contact.phoneOk) $('#checkoutPhone')?.focus();
    return;
  }

  const contact = checkoutContactState();
  if (!contact.nameOk || !contact.phoneOk) {
    syncCheckoutValidation();
    return;
  }

  if (!pickupReady()) {
    document.activeElement?.blur?.();
    const pickupSection = $('#finalPickupSection');
    pickupSection?.classList.add('attention');
    pickupSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Velg hentetid før du sender bestillingen');
    setTimeout(() => pickupSection?.classList.remove('attention'), 1400);
    return;
  }

  document.activeElement?.blur?.();
  placeOrder();
}

function placeOrder() {
  if (!state.cart.length) return;

  const contact = checkoutContactState();
  if (!contact.nameOk || !contact.phoneOk) {
    syncCheckoutValidation();
    showToast('Kontroller navn og telefonnummer');
    return;
  }
  if (!pickupReady()) {
    showToast('Velg hentetid før du sender bestillingen');
    return;
  }

  const { name, phone } = contact;
  const total = state.cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  const id = createLocalOrderId();
  const pickupTime = state.checkout.pickupChoice === 'asap' ? 'Snarest mulig' : state.checkout.pickupChoice;
  const orderSavings = state.cart.reduce((sum, line) => sum + (line.freeReward ? (Number(line.regularPrice) || 0) * line.qty : 0), 0);
  const orderLines = state.cart.map(line => ({ ...line }));

  const adminPayload = buildAdminOrderPayload({
    id,
    name,
    phone,
    total,
    pickup: state.checkout.pickupChoice,
    lines: orderLines,
  });

  /* Integration bridge: one event per submitted local order. */
  window.dispatchEvent(new CustomEvent('kol:order-ready', { detail: adminPayload }));

  state.orders.unshift({
    id,
    createdAt: Date.now(),
    name,
    phone,
    total,
    pickupTime,
    savings: orderSavings,
    items: orderLines,
    status: 'Sendt',
  });
  saveStorage(STORAGE_KEYS.orders, state.orders);

  const currentAccount = upsertCheckoutAccount(name, phone);
  normalizeLoyalty(currentAccount);

  const locked = (currentAccount.stamps || 0) >= 10;
  const freeUsed = state.cart.some(line => line.freeReward);
  const paidLarge = state.cart
    .filter(line => !line.freeReward && line.loyaltyEligible === true && norm(line.size) === 'stor')
    .reduce((count, line) => count + line.qty, 0);

  if (locked) {
    if (freeUsed) currentAccount.stamps = Math.min(10, paidLarge);
  } else if (paidLarge) {
    currentAccount.stamps = Math.min(10, (currentAccount.stamps || 0) + paidLarge);
  }

  currentAccount.rewards = 0;
  saveAccounts();

  state.cart = [];
  saveStorage(STORAGE_KEYS.cart, state.cart);
  state.checkout.step = 1;
  state.checkout.pickupChoice = '';
  state.checkout.pickupMode = '';

  goMenu();
  renderCartCount();
  renderHeader();
  renderMenu();
  renderTabs();
  showToast(`Bestilling ${id} sendt${orderSavings ? ` · du sparte ${money(orderSavings)}` : ''}`);
}

// =====================================================
// LOYALTY & QR
// =====================================================

function stampsHtml(accountData) {
  const count = Math.min(10, Math.max(0, Number(accountData.stamps) || 0));
  return Array.from({ length: 10 }, (_, index) => `
    <span class="stamp ${index < count ? 'on' : ''}"><b>${index + 1}</b><i>🍕</i></span>
  `).join('');
}

function pizzaProgress(accountData) {
  normalizeLoyalty(accountData);
  const count = Math.min(10, Math.max(0, Number(accountData.stamps) || 0));
  const ready = count >= 10;
  const rewardInCart = state.cart.some(line => line.freeReward);
  let message = '';

  if (ready) message = '<strong>Neste Stor Pizza er gratis.</strong>';
  else if (count === 9) message = 'Kjøp 1 Stor Pizza til – <strong>så er neste Stor Pizza gratis.</strong>';
  else {
    const left = 10 - count;
    message = `Kjøp ${left} Stor Pizza${left === 1 ? '' : 'er'} til – så får du <strong>neste Stor Pizza gratis.</strong>`;
  }

  return `<section class="pizza-loyalty-card">
    <div class="pizza-loyalty-top"><div><small>STOR PIZZA-KUPONGER</small><h3>${count} av 10</h3></div></div>
    <div class="stamps">${stampsHtml(accountData)}</div>
    <p>${message}</p>
    ${ready ? `<div class="reward-ready">🎁 Gratis Stor Pizza klar</div><button class="reward-claim-button" id="claimRewardBtn" ${rewardInCart ? 'disabled' : ''}>${rewardInCart ? 'Gratis pizza ligger i handlekurven' : 'Velg gratis Stor Pizza'}</button>` : ''}
    <button class="coupon-qr-button" id="couponQrBtn">▦ Vis QR-kode</button>
  </section>`;
}

function renderRewardPicker() {
  const currentAccount = account();
  if (!currentAccount || currentAccount.stamps < 10) {
    showToast('Du har ikke en gratis pizza klar');
    return;
  }
  if (state.cart.some(line => line.freeReward)) {
    showToast('Gratis pizza ligger allerede i handlekurven');
    return;
  }

  const pizzas = items().filter(isPizzaLoyaltyProduct);
  $('#rewardPizzaList').innerHTML = pizzas.map(item => {
    const large = item.sizes.find(size => norm(size[0]) === 'stor');
    if (!large) return '';
    const image = safeImageUrl(item.image);
    const style = image ? ` style="background-image:url(&quot;${escapeHtml(image)}&quot;)"` : '';
    return `<button class="reward-pizza-card" data-reward-pizza="${escapeHtml(item.id)}">
      <span class="reward-pizza-image"${style}></span>
      <span class="reward-pizza-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || '')}</small><em>Stor · ${money(large[1])} → Gratis</em></span>
      <b>Velg</b>
    </button>`;
  }).join('');

  $$('[data-reward-pizza]').forEach(button => {
    button.onclick = () => openProduct(button.dataset.rewardPizza, { reward: true });
  });

  openView('rewardScreen', { tabs: true });
  setActiveTab('pizza', true);
}

function renderCouponQr() {
  const currentAccount = account();
  if (!currentAccount) return;

  $('#couponQrName').textContent = currentAccount.name || 'KØL-medlem';
  $('#couponQrPhone').textContent = `+47 ${formatPhone(currentAccount.phone)}`;

  const box = $('#couponQrCode');
  box.innerHTML = '';
  const url = `${location.origin}${location.pathname}?kasse=${encodeURIComponent(currentAccount.phone)}`;

  if (window.QRCode) new QRCode(box, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  else box.textContent = url;

  openView('couponQrScreen', { tabs: true });
  $('#couponQrBack').onclick = () => {
    openView('accountScreen', { tabs: true });
    renderProfileHome();
  };
}

function renderKasseMode(phone) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-8);
  const customer = state.accounts[normalizedPhone];
  openView('kasseScreen', { tabs: false });

  if (!customer) {
    $('#kasseContent').innerHTML = '<div class="kasse-empty"><strong>Kunden ble ikke funnet</strong><p>Denne demoen bruker LocalStorage. På en annen enhet finnes ikke kundedataene ennå.</p></div>';
    return;
  }

  normalizeLoyalty(customer);
  const count = Math.min(10, Math.max(0, Number(customer.stamps) || 0));
  $('#kasseContent').innerHTML = `<div class="kasse-customer-card">
    <div class="kasse-customer-head">
      <div class="kasse-avatar">${escapeHtml((customer.name || 'K').charAt(0).toUpperCase())}</div>
      <div><strong>${escapeHtml(customer.name || 'KØL-medlem')}</strong><small>+47 ${formatPhone(customer.phone)}</small></div>
    </div>
    <div class="kasse-counter">
      <small>STOR PIZZA-KUPONGER</small><strong>${count} / 10</strong>
      <div class="kasse-adjust"><button id="kasseMinus" ${count <= 0 ? 'disabled' : ''}>−</button><span>Juster manuelt</span><button id="kassePlus" ${count >= 10 ? 'disabled' : ''}>+</button></div>
      <button class="kasse-reset" id="kasseReset">${count >= 10 ? 'Gratispizza brukt – nullstill' : 'Nullstill kuponger'}</button>
    </div>
    <div class="kasse-demo-note">Bruk + for telefonbestillinger av Stor Pizza. Verdien stopper på 10 til gratispizzaen er brukt.</div>
  </div>`;

  $('#kasseMinus').onclick = () => adjustKasseStamp(normalizedPhone, -1);
  $('#kassePlus').onclick = () => adjustKasseStamp(normalizedPhone, 1);
  $('#kasseReset').onclick = () => resetKasseStamps(normalizedPhone);
}

function adjustKasseStamp(phone, delta) {
  const customer = state.accounts[phone];
  if (!customer) return;

  normalizeLoyalty(customer);
  const before = Math.min(10, Math.max(0, Number(customer.stamps) || 0));
  customer.stamps = Math.max(0, Math.min(10, before + delta));
  saveAccounts();
  renderKasseMode(phone);
  showToast(delta > 0 ? '1 kupong lagt til' : '1 kupong fjernet');
}

function resetKasseStamps(phone) {
  const customer = state.accounts[phone];
  if (!customer) return;

  customer.stamps = 0;
  customer.rewards = 0;
  saveAccounts();
  renderKasseMode(phone);
  showToast('Kupongkort nullstilt');
}

// =====================================================
// ACCOUNT
// =====================================================

function renderLogin() {
  $('#accountContent').innerHTML = `<div class="screen-title"><h2>Logg inn</h2><p>Telefonnummer og navn er nok.</p></div>
    <div class="login-wrap">
      <label>Telefonnummer</label>
      <div class="phone-field"><span>🇳🇴 +47</span><input id="loginPhone" inputmode="numeric" maxlength="8" placeholder="95 55 74 74"></div>
      <label>Hele navn</label>
      <input id="loginName" class="text-input" placeholder="Fatih Alemdar">
      <button class="primary full" id="loginContinue">Fortsett</button>
    </div>`;

  $('#loginContinue').onclick = () => {
    const phone = $('#loginPhone').value.replace(/\D/g, '');
    const name = $('#loginName').value.trim();
    if (phone.length !== 8 || !name) {
      alert('Skriv inn hele navnet og et 8-sifret telefonnummer.');
      return;
    }

    const currentAccount = ensureAccount(phone);
    currentAccount.name = name;
    saveAccounts();
    setSession(phone);
    renderProfileHome();
    showToast('Innlogget');
  };
}

function renderProfileHome() {
  const currentAccount = account();
  if (!currentAccount) {
    renderLogin();
    return;
  }

  const orderCount = state.orders.filter(order => order.phone === currentAccount.phone).length;
  $('#accountContent').innerHTML = `<div class="profile-home">
    <div class="profile-greeting">
      <div class="member-avatar">${escapeHtml((currentAccount.name || 'K').charAt(0).toUpperCase())}</div>
      <div><small>KØL MEDLEM</small><h2>${escapeHtml(currentAccount.name || 'KØL-medlem')}</h2><p>+47 ${formatPhone(currentAccount.phone)}</p></div>
    </div>
    ${pizzaProgress(currentAccount)}
    <div class="profile-actions">
      <button data-account="orders"><strong>Bestillinger</strong><small>${orderCount} lagret</small><b>›</b></button>
      <button data-account="contact"><strong>Kontaktinfo</strong><small>Navn, telefon og e-post</small><b>›</b></button>
    </div>
    <button class="logout-link" id="logoutBtn">Logg ut</button>
  </div>`;

  $$('[data-account]').forEach(button => {
    button.onclick = () => button.dataset.account === 'orders' ? renderOrders() : renderContact();
  });

  const claim = $('#claimRewardBtn');
  if (claim && !claim.disabled) claim.onclick = renderRewardPicker;
  if ($('#couponQrBtn')) $('#couponQrBtn').onclick = renderCouponQr;
  $('#logoutBtn').onclick = () => {
    setSession(null);
    renderLogin();
    showToast('Logget ut');
  };
}

function renderOrders() {
  const currentAccount = account();
  const list = state.orders.filter(order => order.phone === currentAccount.phone);

  $('#accountContent').innerHTML = `<div class="subhead"><button id="accountBack">‹ Profil</button><h2>Bestillinger</h2></div>
    <div class="profile-body">
      ${list.length ? list.map(order => `<div class="order-card">
        <div><strong>Ordre ${escapeHtml(order.id)}</strong><b>${money(order.total)}</b></div>
        <small>${new Date(order.createdAt).toLocaleString('nb-NO')} · ${escapeHtml(order.pickupTime || 'Snarest mulig')}</small>
        <p>${order.items.map(line => `${line.qty}x ${escapeHtml(line.name)} (${escapeHtml(line.size)})${line.freeReward ? ' – GRATIS' : ''}`).join('<br>')}</p>
        ${order.savings ? `<small class="order-saving">Du sparte ${money(order.savings)}</small>` : ''}
      </div>`).join('') : '<div class="empty-note">Ingen bestillinger ennå.</div>'}
    </div>`;

  $('#accountBack').onclick = renderProfileHome;
}

function renderContact() {
  const currentAccount = account();
  $('#accountContent').innerHTML = `<div class="subhead"><button id="accountBack">‹ Profil</button><h2>Kontaktinfo</h2></div>
    <div class="profile-form modern-profile-form">
      <label class="profile-field" id="pfNameField">Hele navn<span class="field-control"><input id="pfName" class="text-input" value="${escapeHtml(currentAccount.name || '')}"><i class="field-check">✓</i></span></label>
      <label class="profile-field" id="pfPhoneField">Telefonnummer<span class="field-control"><input id="pfPhone" class="text-input" inputmode="numeric" maxlength="8" value="${escapeHtml(currentAccount.phone || '')}"><i class="field-check">✓</i></span></label>
      <label class="profile-field optional-field">E-post <small>(valgfritt)</small><span class="field-control"><input id="pfEmail" class="text-input" value="${escapeHtml(currentAccount.email || '')}"></span></label>
      <label class="check-row"><input id="pfMarketing" type="checkbox" ${currentAccount.marketing ? 'checked' : ''}> Jeg ønsker tilbud fra KØL</label>
      <button class="primary full" id="saveProfile">Lagre endringer</button>
    </div>`;

  const validate = () => {
    const name = $('#pfName').value.trim();
    const phone = $('#pfPhone').value.replace(/\D/g, '');
    $('#pfNameField').classList.toggle('valid', name.length >= 2);
    $('#pfPhoneField').classList.toggle('valid', phone.length === 8);
    return { name, phone, ok: name.length >= 2 && phone.length === 8 };
  };

  $('#pfName').oninput = validate;
  $('#pfPhone').oninput = event => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 8);
    validate();
  };

  validate();
  $('#accountBack').onclick = renderProfileHome;
  $('#saveProfile').onclick = () => {
    const result = validate();
    if (!result.ok) {
      showToast('Kontroller navn og telefonnummer');
      return;
    }

    const updated = upsertCheckoutAccount(result.name, result.phone);
    updated.email = $('#pfEmail').value.trim();
    updated.marketing = $('#pfMarketing').checked;
    saveAccounts();
    renderHeader();
    renderProfileHome();
    showToast('Kontaktinfo oppdatert');
  };
}

// =====================================================
// INFO & ALLERGENS
// =====================================================

function setInfoTab(tab) {
  $$('[data-info-tab]').forEach(button => button.classList.toggle('active', button.dataset.infoTab === tab));
  $$('[data-info-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.infoPanel === tab));
}

function renderAllergens() {
  const query = norm(state.allergens.search);
  const visible = ALLERGENS.filter(allergen => !query || norm(`${allergen[0]} ${allergen[2]}`).includes(query));

  $('#allergenGrid').innerHTML = visible.length
    ? visible.map(allergen => `<button class="allergen-choice ${state.allergens.draft.has(allergen[0]) ? 'active' : ''}" data-allergen="${escapeHtml(allergen[0])}"><span>${allergen[1]}</span>${escapeHtml(allergen[2])}</button>`).join('')
    : '<div class="allergen-empty">Ingen allergener funnet.</div>';

  $$('[data-allergen]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.allergen;
      const label = allergenLabel(id);
      const wasSelected = state.allergens.draft.has(id);
      if (wasSelected) state.allergens.draft.delete(id);
      else state.allergens.draft.add(id);
      renderAllergens();
      showToast(wasSelected ? `${label} fjernet` : `${label} valgt`);
    };
  });
}

function openAllergens() {
  state.loyalty.rewardMode = false;
  state.allergens.draft = new Set(state.allergens.selected);
  state.allergens.search = '';
  $('#allergenSearch').value = '';
  renderAllergens();
  openView('allergenScreen', { tabs: true });
}

function renderAll() {
  renderHeader();
  renderTabs();
  renderMenu();
  renderCartCount();
  if ($('#allergenCount')) $('#allergenCount').textContent = state.allergens.selected.size || '';
}

// =====================================================
// STATIC EVENT BINDING & INITIALIZATION
// =====================================================

function bindStaticEvents() {
  $('#brandBtn').onclick = goMenu;

  $('#infoBtn').onclick = () => {
    state.loyalty.rewardMode = false;
    openView('infoScreen', { tabs: true });
    setInfoTab('about');
  };

  $('#profileBtn').onclick = () => {
    state.loyalty.rewardMode = false;
    openView('accountScreen', { tabs: true });
    account() ? renderProfileHome() : renderLogin();
  };

  $('#cartBtn').onclick = () => {
    state.loyalty.rewardMode = false;
    state.checkout.step = 1;
    renderCart();
    openView('cartScreen', { tabs: true });
    renderCheckoutStep();
  };

  $('#allergenBtn').onclick = openAllergens;
  $('#infoAllergenBtn').onclick = openAllergens;

  $('#storeMapBtn').onclick = () => {
    const query = [activeSiteSettings.streetAddress, activeSiteSettings.postalCode, activeSiteSettings.city].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
  };

  $$('[data-info-tab]').forEach(button => {
    button.onclick = () => setInfoTab(button.dataset.infoTab);
  });

  $('#qtyMinus').onclick = () => {
    state.product.qty = Math.max(1, state.product.qty - 1);
    $('#qtyValue').textContent = state.product.qty;
    updateProductTotal();
  };

  $('#qtyPlus').onclick = () => {
    state.product.qty += 1;
    $('#qtyValue').textContent = state.product.qty;
    updateProductTotal();
  };

  $('#addToCart').onclick = addOrUpdateCart;

  $('#checkoutBack').onclick = () => {
    document.activeElement?.blur?.();
    state.checkout.step = 1;
    renderCheckoutStep();
  };

  $('#checkoutNext').onclick = handleCheckoutNext;

  $('#allergenSearch').oninput = event => {
    state.allergens.search = event.target.value;
    renderAllergens();
  };

  $('#allergenReset').onclick = () => {
    state.allergens.draft.clear();
    state.allergens.selected.clear();
    saveStorage(STORAGE_KEYS.allergens, []);
    state.allergens.search = '';
    $('#allergenSearch').value = '';
    renderAllergens();
    renderAll();
    showToast('Allergener nullstilt');
  };

  $('#allergenSave').onclick = () => {
    state.allergens.selected = new Set(state.allergens.draft);
    saveStorage(STORAGE_KEYS.allergens, [...state.allergens.selected]);
    renderAll();
    goMenu();
    showToast('Allergener lagret');
  };

  $('#menuShell').addEventListener('scroll', scheduleSync, { passive: true });

  document.addEventListener('pointerdown', event => {
    const active = document.activeElement;
    if (!active || !['checkoutName', 'checkoutPhone'].includes(active.id)) return;
    if (event.target === active || event.target.closest('input, textarea')) return;
    active.blur();
  }, { capture: true });
}

function initialize() {
  bindStaticEvents();
  bindCheckoutValidation();
  applySiteSettings(activeSiteSettings);
  renderAll();
  renderCheckoutStep();
  scheduleSync();

  const kassePhone = new URLSearchParams(location.search).get('kasse');
  if (kassePhone) requestAnimationFrame(() => renderKasseMode(kassePhone));
}

initialize();


/* ===== PICKUP STABILITY / EXPLICIT TEST MODE ===== */
/*
 * CHECKOUT PICKUP STABILITY
 * TEST MODE: time restrictions are temporarily disabled while the checkout is being tested.
 * Restore normal clock-based availability before production launch.
 */
(() => {
  if (window.__KOL_CHECKOUT_STABILITY__) return;
  window.__KOL_CHECKOUT_STABILITY__ = true;

  const PICKUP_TEST_MODE = true;
  let pickupDayOffset = 0;

  const parseClock = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback.split(':').map(Number);
    return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))];
  };

  const roundUpQuarter = date => {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);
    const remainder = rounded.getMinutes() % 15;
    if (remainder) rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
    return rounded;
  };

  function pickupWindow() {
    const now = new Date();
    const [openHour, openMinute] = parseClock(activeSiteSettings.orderOpenTime, '14:00');
    const [closeHour, closeMinute] = parseClock(activeSiteSettings.orderCloseTime, '22:00');

    let open = new Date(now);
    let close = new Date(now);
    open.setHours(openHour, openMinute, 0, 0);
    close.setHours(closeHour, closeMinute, 0, 0);

    if (PICKUP_TEST_MODE) {
      pickupDayOffset = 0;
      const slots = [];
      for (let cursor = new Date(open); cursor < close; cursor.setMinutes(cursor.getMinutes() + 15)) {
        slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
      }
      return { slots, asapAvailable: true, dayOffset: 0 };
    }

    const lead = Math.max(0, Number(activeSiteSettings.minPreorderMinutes) || 0);
    let asapAvailable = now >= open && now < close;
    let start = roundUpQuarter(new Date(now.getTime() + lead * 60000));
    pickupDayOffset = 0;

    if (now < open) {
      start = new Date(open);
      asapAvailable = false;
    } else if (now >= close || start >= close) {
      pickupDayOffset = 1;
      open = new Date(open);
      close = new Date(close);
      open.setDate(open.getDate() + 1);
      close.setDate(close.getDate() + 1);
      start = new Date(open);
      asapAvailable = false;
    } else if (start < open) {
      start = new Date(open);
    }

    const slots = [];
    for (let cursor = new Date(start); cursor < close; cursor.setMinutes(cursor.getMinutes() + 15)) {
      slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
    }

    return { slots, asapAvailable, dayOffset: pickupDayOffset };
  }

  pickupSlots = () => pickupWindow().slots;

  renderPickupTimes = function renderPickupTimesStable() {
    const host = $('#pickupOptions');
    if (!host) return;

    const windowInfo = pickupWindow();
    const slots = windowInfo.slots;
    const selectedTime = String(state.checkout.pickupChoice || '');

    if (/^\d{2}:\d{2}$/.test(selectedTime) && !slots.includes(selectedTime)) {
      state.checkout.pickupChoice = '';
      state.checkout.pickupMode = '';
    }

    if (state.checkout.pickupChoice === 'asap' && !windowInfo.asapAvailable) {
      state.checkout.pickupChoice = '';
      state.checkout.pickupMode = '';
    }

    if (state.checkout.pickupChoice === 'asap') state.checkout.pickupMode = 'asap';
    else if (/^\d{2}:\d{2}$/.test(String(state.checkout.pickupChoice || ''))) state.checkout.pickupMode = 'scheduled';

    const nextDayNote = windowInfo.dayOffset === 1
      ? '<div class="pickup-next-day-note">Neste åpningsdag · I morgen</div>'
      : '';

    host.innerHTML = `
      <div class="pickup-mode-row">
        <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'asap' ? 'active' : ''}" data-pickup-mode="asap" ${windowInfo.asapAvailable ? '' : 'disabled'}>
          <span class="pickup-mode-check">${state.checkout.pickupMode === 'asap' ? '✓' : ''}</span>
          <span><strong>Snarest mulig</strong><small>Hent så snart maten er klar</small></span>
        </button>
        <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'scheduled' ? 'active' : ''}" data-pickup-mode="scheduled">
          <span class="pickup-mode-check">${state.checkout.pickupMode === 'scheduled' ? '✓' : ''}</span>
          <span><strong>Velg hentetid</strong><small>Velg et tidspunkt</small></span>
        </button>
      </div>
      ${nextDayNote}
      <div class="pickup-time-grid" ${state.checkout.pickupMode === 'scheduled' ? '' : 'hidden'}>
        ${slots.map(time => `<button type="button" class="pickup-time-btn ${state.checkout.pickupChoice === time ? 'active' : ''}" data-pickup-time="${time}">${time}</button>`).join('')}
      </div>`;

    host.querySelectorAll('[data-pickup-mode]').forEach(button => {
      button.onclick = () => {
        if (button.disabled) return;
        state.checkout.pickupMode = button.dataset.pickupMode;
        state.checkout.pickupChoice = state.checkout.pickupMode === 'asap' ? 'asap' : '';
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    host.querySelectorAll('[data-pickup-time]').forEach(button => {
      button.onclick = () => {
        state.checkout.pickupMode = 'scheduled';
        state.checkout.pickupChoice = button.dataset.pickupTime;
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    syncPickupUi();
  };

  const originalBuildAdminOrderPayload = buildAdminOrderPayload;
  buildAdminOrderPayload = function buildAdminOrderPayloadStable(input) {
    const payload = originalBuildAdminOrderPayload(input);
    if (payload?.pickup?.mode === 'scheduled') {
      const date = new Date();
      date.setDate(date.getDate() + pickupDayOffset);
      payload.pickup.date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      payload.pickup.dayOffset = pickupDayOffset;
    }
    return payload;
  };

  if (window.KOLIntegration) {
    window.KOLIntegration.buildAdminOrderPayload = buildAdminOrderPayload;
  }
})();


/* ===== THREE-STEP CHECKOUT UX ===== */
/* KØL checkout UX — 3 clear customer steps: cart, contact, pickup */
(() => {
  'use strict';
  if (window.__KOL_CHECKOUT_3STEP__) return;
  window.__KOL_CHECKOUT_3STEP__ = true;

  const originalHandleCheckoutNext = handleCheckoutNext;
  const originalSyncCheckoutValidation = syncCheckoutValidation;

  function installStyles() {
    const style = document.createElement('style');
    style.id = 'kol-checkout-3step-styles';
    style.textContent = `
      #menuShell,
      #cartScreen .screen-scroll,
      #productScreen .screen-scroll,
      #accountScreen .screen-scroll,
      #infoScreen .screen-scroll,
      #rewardScreen .screen-scroll,
      #couponQrScreen .screen-scroll,
      #kasseScreen .screen-scroll,
      #allergenScreen .screen-scroll {
        overflow-y:scroll !important;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:thin;
        scrollbar-gutter:stable;
      }
      #menuShell::-webkit-scrollbar,
      .screen-scroll::-webkit-scrollbar { width:7px; }
      #menuShell::-webkit-scrollbar-thumb,
      .screen-scroll::-webkit-scrollbar-thumb { background:#cfc7c1; border-radius:999px; }
      #menuShell::-webkit-scrollbar-track,
      .screen-scroll::-webkit-scrollbar-track { background:#f5f2ef; }

      #checkoutStep1,#checkoutStep2,#checkoutStep3 {
        padding:10px 10px 20px !important;
        box-sizing:border-box;
      }

      #cartScreen .checkout-progress {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
        margin:0 0 12px;
        padding:8px;
        border:1px solid #e9e4e0;
        border-radius:16px;
        background:#fff;
        box-shadow:0 3px 12px rgba(43,35,31,.025);
      }
      #cartScreen .checkout-progress-step {
        min-width:0;
        min-height:38px;
        display:flex;
        align-items:center;
        justify-content:flex-start;
        gap:7px;
        padding:5px 6px;
        border:0;
        border-radius:10px;
        background:transparent;
        color:#918781;
        font-size:11px;
        font-weight:750;
        line-height:1.15;
        text-align:left;
        cursor:pointer !important;
        user-select:none;
        -webkit-user-select:none;
        touch-action:manipulation;
      }
      #cartScreen .checkout-progress-step:hover { background:#f8f6f4; }
      #cartScreen .checkout-progress-step.future { cursor:default !important; }
      #cartScreen .checkout-progress-step.future:hover { background:transparent; }
      #cartScreen .checkout-progress-step:focus-visible { outline:2px solid #f36a2d; outline-offset:2px; }
      #cartScreen .checkout-progress-step i {
        width:26px;
        height:26px;
        flex:0 0 26px;
        display:grid;
        place-items:center;
        border:1px solid #e5ded9;
        border-radius:50%;
        background:#faf9f8;
        color:#8a817c;
        font-style:normal;
        font-size:11px;
      }
      #cartScreen .checkout-progress-step.active { color:#d95622; }
      #cartScreen .checkout-progress-step.active i { border-color:#f36a2d; background:#fff2eb; color:#e85c24; }
      #cartScreen .checkout-progress-step.done { color:#27765c; }
      #cartScreen .checkout-progress-step.done i { border-color:#b9dfd1; background:#eef9f5; color:#157253; }
      #cartScreen .checkout-progress-step span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      #cartScreen .checkout-step-intro {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin:0 0 12px;
        padding:15px 14px;
        border:1px solid #e9e4e0;
        border-radius:16px;
        background:#fff;
        box-shadow:0 3px 12px rgba(43,35,31,.025);
      }
      #cartScreen .checkout-step-intro-main { display:flex; align-items:center; gap:11px; min-width:0; }
      #cartScreen .checkout-step-number {
        width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;
        border:1px solid #f0c6b5;border-radius:12px;background:#fff4ee;
        color:#db5621;font-size:13px;font-weight:800;
      }
      #cartScreen .checkout-step-intro strong { display:block; font-size:16px; color:#211d1b; }
      #cartScreen .checkout-step-intro small { display:block; margin-top:3px; color:#827873; font-size:11.5px; line-height:1.35; }
      #cartScreen .checkout-step-count {
        flex:0 0 auto;padding:6px 9px;border-radius:999px;background:#fff1ea;
        color:#d45422;font-size:10px;font-weight:800;text-transform:uppercase;
      }

      /* Contact and pickup are intentionally styled as the same white form card. */
      #checkoutStep2 .final-checkout-section,
      #checkoutStep3 .final-checkout-section {
        width:100%;
        margin:0;
        padding:0;
        border:1px solid #d8e9e0 !important;
        border-radius:15px !important;
        background:#fff !important;
        overflow:hidden;
        box-shadow:0 3px 12px rgba(43,35,31,.025) !important;
      }
      #checkoutStep2 #finalContactSection .final-section-head,
      #checkoutStep3 #finalPickupSection .final-section-head { display:none !important; }
      #checkoutStep2 .checkout-grid,
      #checkoutStep3 .pickup-options {
        width:100%;
        margin:0 !important;
        padding:12px !important;
        border:0 !important;
        border-radius:0 !important;
        background:#fff !important;
        box-shadow:none !important;
      }
      #checkoutStep3 .checkout-pickup-help {
        margin:0 0 10px;
        padding:10px 12px;
        border:1px solid #e9e2dd;
        border-radius:11px;
        background:#fff;
        color:#776e69;
        font-size:11.5px;
        line-height:1.4;
      }
      #checkoutStep3 .pickup-mode-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      #checkoutStep3 .pickup-mode-btn {
        min-height:76px;
        padding:10px;
        border:1px solid #e5ddd8;
        border-radius:12px;
        background:#fff;
        color:#332d29;
        display:grid;
        grid-template-columns:26px minmax(0,1fr);
        align-items:center;
        gap:8px;
        text-align:left;
      }
      #checkoutStep3 .pickup-mode-btn strong { display:block; font-size:13px; line-height:1.2; font-weight:700; }
      #checkoutStep3 .pickup-mode-btn small { display:block; margin-top:4px; color:#817872; font-size:9.8px; line-height:1.25; font-weight:400; }
      #checkoutStep3 .pickup-mode-btn.active { border-color:#f09a76; background:#fff5f0; color:#bc4d25; }
      #checkoutStep3 .pickup-mode-btn.active .pickup-mode-check { border-color:#f36a2d; background:#f36a2d; color:#fff; }
      #checkoutStep3 .pickup-mode-btn.active small { color:#a76850; }
      #checkoutStep3 .pickup-time-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid #eee7e2;
      }
      #checkoutStep3 .pickup-time-btn {
        height:45px;
        border:1px solid #e4ddd8;
        border-radius:10px;
        background:#fff;
        color:#3b3531;
        font-size:13px;
        font-weight:600;
      }
      #checkoutStep3 .pickup-time-btn.active { border-color:#f36a2d; background:#fff2ec; color:#c34f25; }
      #checkoutStep3 .pickup-next-day-note { display:none !important; }

          `;
    document.head.appendChild(style);
  }

  function progressMarkup(current) {
    const items = [[1,'Bestilling'],[2,'Kontakt'],[3,'Hentetid']];
    return `<nav class="checkout-progress" aria-label="Bestillingssteg">${items.map(([step,label]) => {
      const done = step < current;
      const active = step === current;
      const future = step > current;
      const cls = done ? 'done' : active ? 'active' : 'future';
      return `<button type="button" class="checkout-progress-step ${cls}" data-checkout-step="${step}" aria-label="Gå til ${label}"><i>${done ? '✓' : step}</i><span>${label}</span></button>`;
    }).join('')}</nav>`;
  }

  function introMarkup(step,title,text) {
    return `<div class="checkout-step-intro"><div class="checkout-step-intro-main"><span class="checkout-step-number">${step}</span><div><strong>${title}</strong><small>${text}</small></div></div><span class="checkout-step-count">Steg ${step} / 3</span></div>`;
  }

  function prepareDom() {
    const step1 = $('#checkoutStep1');
    const step2 = $('#checkoutStep2');
    const pickupSection = $('#finalPickupSection');
    if (!step1 || !step2 || !pickupSection) return false;

    step1.querySelector('.checkout-title')?.remove();
    if (!step1.querySelector('.checkout-progress')) {
      step1.insertAdjacentHTML('afterbegin', `${progressMarkup(1)}${introMarkup(1,'Sjekk bestillingen','Kontroller varene før du går videre.')}`);
    }

    step2.querySelector('.checkout-title')?.remove();
    if (!step2.querySelector('.checkout-progress')) {
      step2.insertAdjacentHTML('afterbegin', `${progressMarkup(2)}${introMarkup(2,'Kontaktinformasjon','Skriv inn navn og telefonnummer så vi kan kjenne igjen bestillingen din.')}`);
    }

    let step3 = $('#checkoutStep3');
    if (!step3) {
      step3 = document.createElement('div');
      step3.id = 'checkoutStep3';
      step3.hidden = true;
      step3.innerHTML = `${progressMarkup(3)}${introMarkup(3,'Når vil du hente?','Velg snarest mulig eller et tidspunkt som passer deg.')}`;
      step2.insertAdjacentElement('afterend', step3);
    }

    if (pickupSection.parentElement !== step3) step3.appendChild(pickupSection);
    $('#finalContactSection .final-section-head')?.setAttribute('hidden','');
    $('#finalPickupSection .final-section-head')?.setAttribute('hidden','');

    if (!pickupSection.querySelector('.checkout-pickup-help')) {
      pickupSection.insertAdjacentHTML('afterbegin','<p class="checkout-pickup-help">Bestillingen sendes først når du trykker <strong>Send bestilling</strong>.</p>');
    }
    return true;
  }

  function contactReady() {
    const contact = checkoutContactState();
    return Boolean(contact.nameOk && contact.phoneOk);
  }

  function setNextButton() {
    const next = $('#checkoutNext');
    if (!next) return;
    if (state.checkout.step === 1) {
      next.textContent = 'Neste: Kontakt';
      next.disabled = !state.cart.length;
    } else if (state.checkout.step === 2) {
      next.textContent = 'Neste: Hentetid';
      next.disabled = !contactReady();
    } else {
      next.textContent = 'Send bestilling';
      next.disabled = !pickupReady();
    }
    next.classList.toggle('ready',!next.disabled);
    next.style.opacity = next.disabled ? '.55' : '1';
    next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
  }

  syncCheckoutValidation = function syncCheckoutValidationThreeStep() {
    originalSyncCheckoutValidation();
    setNextButton();
  };

  renderCheckoutStep = function renderCheckoutStepThreeStep() {
    prepareDom();
    const step1 = $('#checkoutStep1');
    const step2 = $('#checkoutStep2');
    const step3 = $('#checkoutStep3');
    if (!step1 || !step2 || !step3) return;

    const current = Math.min(3,Math.max(1,Number(state.checkout.step)||1));
    state.checkout.step = current;
    step1.hidden = current !== 1;
    step2.hidden = current !== 2;
    step3.hidden = current !== 3;

    const back = $('#checkoutBack');
    if (back) back.hidden = current === 1;

    if (current === 2) {
      const contact = checkoutContactState();
      if (contact.nameOk && contact.phoneOk) $('#checkoutConfirmCard')?.removeAttribute('hidden');
    }
    if (current === 3) renderPickupTimes();

    setNextButton();
    const cartOpen = !$('#cartScreen').hidden;
    const focused = cartOpen && current > 1;
    document.body.classList.toggle('hide-tabs',focused);
    $('#cartScreen').style.top = focused ? 'var(--head)' : 'calc(var(--head) + var(--tabs))';
    const scroll = $('#cartScreen .screen-scroll');
    if (scroll) scroll.scrollTop = 0;
  };

  handleCheckoutNext = function handleCheckoutNextThreeStep() {
    if (state.checkout.step === 1) {
      if (!state.cart.length) return;
      state.checkout.step = 2;
      renderCheckoutStep();
      const contact = checkoutContactState();
      if (!contact.nameOk) $('#checkoutName')?.focus();
      else if (!contact.phoneOk) $('#checkoutPhone')?.focus();
      return;
    }

    if (state.checkout.step === 2) {
      if (!contactReady()) {
        syncCheckoutValidation();
        const contact = checkoutContactState();
        if (!contact.nameOk) $('#checkoutName')?.focus();
        else if (!contact.phoneOk) $('#checkoutPhone')?.focus();
        return;
      }
      document.activeElement?.blur?.();
      state.checkout.step = 3;
      renderCheckoutStep();
      return;
    }

    if (!pickupReady()) {
      syncCheckoutValidation();
      return;
    }

    state.checkout.step = 2;
    originalHandleCheckoutNext();
    if (state.cart.length && state.checkout.step === 2) {
      state.checkout.step = 3;
      renderCheckoutStep();
    }
  };

  function bindControls() {
    const next = $('#checkoutNext');
    const back = $('#checkoutBack');
    const cartScreen = $('#cartScreen');

    if (next) next.onclick = handleCheckoutNext;
    if (back) {
      back.onclick = () => {
        document.activeElement?.blur?.();
        state.checkout.step = Math.max(1,(Number(state.checkout.step)||1)-1);
        renderCheckoutStep();
      };
    }

    /* Capture-phase delegation makes the completed progress steps reliably clickable. */
    cartScreen?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-checkout-step]');
      if (!button || !cartScreen.contains(button)) return;
      const target = Number(button.dataset.checkoutStep);
      const current = Number(state.checkout.step)||1;
      if (!target || target >= current) return;
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur?.();
      state.checkout.step = target;
      renderCheckoutStep();
    }, true);

    ['checkoutName','checkoutPhone'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input',()=>requestAnimationFrame(setNextButton));
      input.addEventListener('blur',()=>requestAnimationFrame(setNextButton));
    });
  }

  installStyles();
  if (prepareDom()) {
    bindControls();
    renderCheckoutStep();
  }
})();


/* ===== PICKUP VALIDATION / FOCUS GUIDANCE ===== */
/* KØL checkout guidance — keep final send clickable, but require pickup choice */
(() => {
  'use strict';
  if (window.__KOL_CHECKOUT_GUIDANCE__) return;
  window.__KOL_CHECKOUT_GUIDANCE__ = true;

  const previousRenderCheckoutStep = renderCheckoutStep;
  const previousSyncCheckoutValidation = syncCheckoutValidation;
  const previousHandleCheckoutNext = handleCheckoutNext;

  function installStyles() {
    const style = document.createElement('style');
    style.id = 'kol-checkout-guidance-styles';
    style.textContent = `
      #checkoutStep3 .pickup-choice-warning {
        display:none;
        margin:0 0 10px;
        padding:10px 12px;
        border:1px solid #f0b59d;
        border-radius:11px;
        background:#fff5f0;
        color:#b94b24;
        font-size:12px;
        font-weight:650;
        line-height:1.4;
      }
      #checkoutStep3 .pickup-choice-warning.show { display:block; }
      #checkoutStep3 #finalPickupSection.pickup-attention {
        border-color:#f36a2d !important;
        box-shadow:0 0 0 3px rgba(243,106,45,.12), 0 3px 12px rgba(43,35,31,.025) !important;
      }
      #checkoutStep3 #finalPickupSection.pickup-attention .pickup-mode-btn {
        animation:kolPickupNudge .28s ease 2;
      }
      @keyframes kolPickupNudge {
        0%,100% { transform:translateX(0); }
        50% { transform:translateX(3px); }
      }
      #checkoutNext.needs-pickup-choice {
        background:#f5b091 !important;
        color:#fff !important;
        opacity:1 !important;
        cursor:pointer !important;
        pointer-events:auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWarning() {
    const section = document.getElementById('finalPickupSection');
    if (!section) return null;
    let warning = section.querySelector('.pickup-choice-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'pickup-choice-warning';
      warning.setAttribute('role', 'alert');
      warning.setAttribute('aria-live', 'assertive');
      warning.textContent = 'Velg hentetid før du sender bestillingen.';
      const options = document.getElementById('pickupOptions');
      if (options) section.insertBefore(warning, options);
      else section.prepend(warning);
    }
    return warning;
  }

  function hideWarning() {
    ensureWarning()?.classList.remove('show');
    document.getElementById('finalPickupSection')?.classList.remove('pickup-attention');
  }

  function focusPickupChoice() {
    const section = document.getElementById('finalPickupSection');
    const warning = ensureWarning();
    if (!section || !warning) return;

    warning.classList.add('show');
    section.classList.remove('pickup-attention');
    void section.offsetWidth;
    section.classList.add('pickup-attention');
    section.scrollIntoView({ behavior:'smooth', block:'center' });

    window.setTimeout(() => {
      section.querySelector('.pickup-mode-btn')?.focus({ preventScroll:true });
    }, 260);
  }

  function syncFinalButton() {
    const next = document.getElementById('checkoutNext');
    if (!next || Number(state.checkout.step) !== 3) return;

    const ready = pickupReady();
    if (!ready) {
      next.disabled = false;
      next.classList.remove('ready');
      next.classList.add('needs-pickup-choice');
      next.style.opacity = '1';
      next.style.cursor = 'pointer';
      next.setAttribute('aria-disabled', 'true');
    } else {
      next.disabled = false;
      next.classList.remove('needs-pickup-choice');
      next.classList.add('ready');
      next.removeAttribute('aria-disabled');
      hideWarning();
    }
  }

  syncCheckoutValidation = function syncCheckoutValidationWithGuidance() {
    previousSyncCheckoutValidation();
    syncFinalButton();
  };

  renderCheckoutStep = function renderCheckoutStepWithGuidance() {
    previousRenderCheckoutStep();
    ensureWarning();
    syncFinalButton();
  };

  handleCheckoutNext = function handleCheckoutNextWithGuidance() {
    if (Number(state.checkout.step) === 3 && !pickupReady()) {
      focusPickupChoice();
      syncFinalButton();
      return;
    }
    previousHandleCheckoutNext();
  };

  function bind() {
    const next = document.getElementById('checkoutNext');
    if (next) next.onclick = handleCheckoutNext;

    const pickup = document.getElementById('pickupOptions');
    if (pickup) {
      pickup.addEventListener('click', () => {
        requestAnimationFrame(() => {
          if (pickupReady()) hideWarning();
          syncFinalButton();
        });
      });
    }
  }

  installStyles();
  ensureWarning();
  bind();
  syncFinalButton();
})();
