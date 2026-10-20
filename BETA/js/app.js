/* KØL BETA customer app: independent implementation, read-only Firebase.
   No legacy DEMO imports, no order writes, no always-on listeners. */
'use strict';

const DATABASE = 'https://kol-grill-pizza-default-rtdb.firebaseio.com';
const KEY = { menu: 'kol_beta_menu_v1', cart: 'kol_beta_cart_v1', contact: 'kol_beta_contact_v1', favorites: 'kol_beta_favorites_v1', theme: 'kol_beta_theme_v1' };
const $ = (id) => document.getElementById(id);
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : value && typeof value === 'object' ? Object.values(value).filter(Boolean) : [];
const money = (value) => (Number(value) || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 }) + ' kr';
const safe = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };
const uniqueId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'beta-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const state = {
  catalog: null, cart: readLocal(KEY.cart, []), contact: readLocal(KEY.contact, {}),
  favorites: readLocal(KEY.favorites, []), menuSource: 'root',
  category: 'all', search: '', allergens: true, view: 'menu', draft: null,
  editingId: null, pickupMode: '', pickupTime: '', lastFetch: 0,
  online: navigator.onLine !== false
};
if (!Array.isArray(state.cart)) state.cart = [];
if (!Array.isArray(state.favorites)) state.favorites = [];
const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const required = (id) => $(id);

function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 2800);
}
function safeImage(raw) {
  if (!raw || !String(raw).trim()) return '';
  try {
    const url = new URL(String(raw).trim(), location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function logoEmoji(section) {
  const label = String(section?.title || '').toLowerCase();
  if (label.includes('pizza')) return '🍕';
  if (label.includes('burger')) return '🍔';
  if (label.includes('kebab') || label.includes('grill')) return '🥙';
  if (label.includes('drikk')) return '🥤';
  if (label.includes('salat')) return '🥗';
  return '🍽️';
}
function normalizeCatalog(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const settings = source.settings || source.siteSettings || {};
  const groups = list(source.optionGroups).map((group) => ({
    id: String(group.id || ''), title: String(group.title || 'Tilvalg'),
    mode: group.selectionMode === 'multiple' ? 'multiple' : 'single',
    required: Boolean(group.required),
    min: Math.max(0, Number(group.minSelections) || (group.required ? 1 : 0)),
    max: group.selectionMode === 'multiple' ? Math.max(1, Number(group.maxSelections) || 99) : 1,
    allowQuantity: group.allowQuantity === true,
    defaults: list(group.defaultOptionIds).map(String),
    options: list(group.options).map((o) => ({
      id: String(o.id || ''), label: String(o.label || ''),
      price: Number(o.price) || 0, soldOut: o.soldOut === true
    }))
  }));
  const sections = list(source.sections).map((section) => ({
    id: String(section.id || ''), title: String(section.title || ''), note: String(section.note || ''),
    items: list(section.items).map((item) => ({
      id: String(item.id || ''), name: String(item.name || ''),
      description: String(item.description || ''), ingredients: String(item.ingredients || ''),
      image: safeImage(item.imageUrl), hidden: item.hidden === true, soldOut: item.soldOut === true,
      defaultSizeIndex: Math.max(0, Number(item.defaultSizeIndex) || 0),
      allergens: list(item.allergens).map(String),
      optionGroupIds: list(item.optionGroupIds).map(String),
      optionGroupOrder: list(item.optionGroupOrder).map(String),
      ingredientRules: list(item.ingredientRules).map((x) => typeof x === 'string' ? {name:x,removable:true} : {name:String(x.name || ''),removable:x.removable !== false}),
      sizes: list(item.sizes).map((size) => ({
        id: String(size.id || ''), label: String(size.label || ''), price: Number(size.price) || 0,
        optionGroupIds: list(size.optionGroupIds).map(String)
      }))
    }))
  }));
  const allergens = new Map(list(source.allergenCatalog).map((x) => [String(x.id || ''), String(x.label || x.id || '')]));
  return { settings, groups, sections, allergens, revision: Number(source.updatedAt) || 0,
    popularIds: list(source.popularItemIds).map(String) };
}
function itemById(id) {
  for (const section of state.catalog?.sections || []) {
    const item = section.items.find((value) => value.id === id);
    if (item) return { item, section };
  }
  return null;
}
function itemGroups(item, sizeId) {
  const size = item.sizes.find((s) => s.id === sizeId);
  const allowed = new Set([...item.optionGroupIds, ...(size?.optionGroupIds || [])]);
  const ids = [...new Set([...item.optionGroupOrder.filter((id) => allowed.has(id)), ...allowed])];
  return ids.map((id) => state.catalog.groups.find((g) => g.id === id)).filter(Boolean);
}
function getPrice(item, sizeId, selections) {
  const size = item.sizes.find((s) => s.id === sizeId) || item.sizes[0];
  let total = Number(size?.price) || 0;
  for (const group of itemGroups(item, sizeId)) {
    for (const optionId of selections[group.id] || []) {
      const opt = group.options.find((o) => o.id === optionId);
      if (opt) total += opt.price;
    }
  }
  return total;
}
function cartDetails(entry) {
  const ref = itemById(entry.itemId);
  if (!ref) return null;
  const size = ref.item.sizes.find((s) => s.id === entry.sizeId) || ref.item.sizes[0];
  const extras = [];
  for (const group of itemGroups(ref.item, entry.sizeId)) {
    const counts = {};
    for (const id of entry.selections?.[group.id] || []) counts[id] = (counts[id] || 0) + 1;
    for (const [id, qty] of Object.entries(counts)) {
      const option = group.options.find((o) => o.id === id);
      if (option) extras.push((qty > 1 ? qty + '× ' : '') + option.label + (option.price ? ' (+' + money(option.price * qty) + ')' : ''));
    }
  }
  return { ...ref, size, extras, unit: getPrice(ref.item, entry.sizeId, entry.selections || {}), total: getPrice(ref.item, entry.sizeId, entry.selections || {}) * entry.qty };
}
function validCart() {
  const old = state.cart.length;
  state.cart = state.cart.filter((line) => {
    const ref = itemById(line.itemId);
    return ref && !ref.item.hidden && !ref.item.soldOut &&
      ref.item.sizes.some((s) => s.id === line.sizeId);
  });
  if (state.cart.length !== old) { writeLocal(KEY.cart, state.cart); toast('Handlekurven ble oppdatert etter menyendring.'); }
}
function total() { return state.cart.reduce((sum, line) => sum + (cartDetails(line)?.total || 0), 0); }
function count() { return state.cart.reduce((sum, line) => sum + (Number(line.qty) || 0), 0); }
function updateCounters() {
  const number = count();
  $('headerCartCount').textContent = String(number);
  $('headerCartCount').hidden = number === 0;
  $('mobileCart').hidden = number === 0 || state.view !== 'menu';
  $('mobileCount').textContent = String(number);
  $('mobileTotal').textContent = money(total());
}
function visibleItems(section) {
  const search = state.search.toLocaleLowerCase('nb');
  return section.items.filter((item) => !item.hidden && (!search ||
    [item.name, item.description, item.ingredients, section.title].join(' ').toLocaleLowerCase('nb').includes(search)));
}
function allergensHTML(item) {
  if (!state.allergens || !item.allergens.length) return '';
  return '<div class="allergen-list">' + item.allergens.map((id) =>
    '<span class="allergen-tag">' + safe(state.catalog.allergens.get(id) || id) + '</span>').join('') + '</div>';
}

function isFavorite(id) { return state.favorites.includes(id); }
function setFavorite(id) {
  state.favorites = isFavorite(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites,id];
  writeLocal(KEY.favorites,state.favorites);
  if (state.draft?.itemId === id) updateDialogFavorite(id);
  renderMenu();
}
function updateDialogFavorite(id) {
  $('dialogFavorite').setAttribute('aria-pressed',String(isFavorite(id)));
  $('dialogFavorite').textContent = isFavorite(id) ? '♥' : '♡';
  $('dialogFavorite').setAttribute('aria-label',isFavorite(id) ? 'Fjern fra favoritter' : 'Legg til favoritter');
}
function cardIcon(section) {
  return logoEmoji(section);
}
function cartQuantityFor(itemId) {
  return state.cart.reduce((sum,line) => sum + (line.itemId === itemId ? line.qty : 0),0);
}
function menuCard(item, section) {
  const sizes = item.sizes;
  const base = sizes.length ? Math.min(...sizes.map((size) => size.price)) : 0;
  const desc = item.description || item.ingredients || section.note || '';
  const badge = cartQuantityFor(item.id);
  const image = item.image
    ? '<img class="product-image" loading="lazy" decoding="async" alt="" src="' + safe(item.image) + '">'
    : '<span class="product-image product-placeholder" aria-hidden="true">🍴</span>';
  const photo = '<div class="product-media">' + image +
    (badge ? '<span class="in-cart-badge">✓ ' + badge + ' i kurven</span>' : '') + '</div>';
  return '<article class="product-card' + (item.soldOut ? ' soldout' : '') + '">' +
    '<button class="product-open" type="button" data-open="' + safe(item.id) + '" aria-label="Se ' + safe(item.name) + '">' +
    photo +
    '<span class="product-information"><strong class="product-name">' + safe(item.name) + '</strong>' +
    '<span class="product-description">' + safe(desc) + '</span>' +
    (state.allergens && item.allergens.length ? '<small class="product-allergens">Inneholder ' +
      safe(item.allergens.map((id) => state.catalog.allergens.get(id) || id).join(', ')) + '</small>' : '') +
    '</span></button><div class="product-actions">' +
    (item.soldOut ? '<span class="product-soldout">Utsolgt</span>' :
      '<button class="product-add" type="button" data-open="' + safe(item.id) +
      '" aria-label="Legg til ' + safe(item.name) + '">+</button>') +
    '<strong class="product-price">' + (sizes.length > 1 ? '<small>fra </small>' : '') + money(base) + '</strong>' +
    '</div></article>';
}

function displayBlocks() {
  if (!state.catalog) return [];
  const sections = state.catalog.sections;
  const visible = sections.map((section) => ({section, products:visibleItems(section)}))
    .filter((entry) => entry.products.length);
  if (state.search) return visible.map(({section,products}) => ({
    key:section.id,title:section.title,note:section.note,entries:products.map((item) => ({item,section}))
  }));
  const blocks = [];
  const favorites = state.favorites.map(itemById).filter((ref) => ref && !ref.item.hidden);
  if (favorites.length) blocks.push({key:'favorites',title:'Mine favoritter',
    note:'Produkter du har lagret',entries:favorites});
  const popular = state.catalog.popularIds.map(itemById).filter((ref) => ref && !ref.item.hidden);
  if (popular.length) blocks.push({key:'popular',title:'Mest bestilt',
    note:'Gjestenes favoritter',entries:popular});
  return [...blocks,...visible.map(({section,products}) => ({
    key:section.id,title:section.title,note:section.note,entries:products.map((item) => ({item,section}))
  }))];
}
function categoryEmoji(block) {
  if (block.key === 'favorites') return '♡';
  if (block.key === 'popular') return '☆';
  return logoEmoji({title:block.title});
}
function renderCategories(blocks = displayBlocks()) {
  $('categories').innerHTML = '<button class="search-tab" type="button" data-toggle-search aria-pressed="' +
    (!$('menuControls').hidden) + '" aria-label="Søk i menyen">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></button>' +
    blocks.map((block) =>
      '<button class="category-chip" type="button" data-category="' + safe(block.key) +
      '" aria-pressed="' + (state.category === block.key) + '">' +
      '<span class="category-icon" aria-hidden="true">' + categoryEmoji(block) + '</span>' +
      '<span class="category-name">' + safe(block.title) + '</span></button>').join('');
}
function setActiveCategory(id, center = false) {
  if (!id || state.category === id) return;
  state.category = id;
  let selected = null;
  $('categories').querySelectorAll('[data-category]').forEach((button) => {
    const active = button.dataset.category === id;
    button.setAttribute('aria-pressed',String(active));
    if (active) selected = button;
  });
  if (center && selected) selected.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}
function scrollToCategory(id) {
  const node = document.getElementById('blk_' + id);
  if (!node) return;
  setActiveCategory(id,true);
  node.scrollIntoView({behavior:'smooth',block:'start'});
}
let spyScheduled = false;
function spyMenu() {
  if (spyScheduled || state.view !== 'menu') return;
  spyScheduled = true;
  requestAnimationFrame(() => {
    spyScheduled = false;
    if (state.view !== 'menu') return;
    const blocks = $('menuSections').querySelectorAll('.menu-section');
    let selected = blocks[0]?.dataset.block;
    const edge = $('categoriesBar').getBoundingClientRect().bottom + 22;
    for (const element of blocks) {
      if (element.getBoundingClientRect().top <= edge) selected = element.dataset.block;
    }
    if (selected) setActiveCategory(selected,false);
  });
}
function renderMenu() {
  if (!state.catalog) return;
  const blocks = displayBlocks();
  $('menuSections').innerHTML = blocks.length ? blocks.map((block) =>
    '<section class="menu-section" data-block="' + safe(block.key) + '" id="blk_' + safe(block.key) +
    '" aria-label="' + safe(block.title) + '">' +
    '<div class="menu-section-heading"><div><h3>' + safe(block.title) + '</h3>' +
    (block.note ? '<p class="menu-section-note">' + safe(block.note) + '</p>' : '') + '</div>' +
    '<small>' + block.entries.length + ' valg</small></div><div class="product-grid">' +
    block.entries.map(({item,section}) => menuCard(item,section)).join('') +
    '</div></section>').join('') : '<div class="empty-state">Ingen produkter funnet.</div>';
  if (!blocks.some((block) => block.key === state.category)) state.category = blocks[0]?.key || '';
  renderCategories(blocks);
  updateCounters();
}

function showView(name) {
  if (!['menu', 'cart', 'contact', 'pickup', 'profile', 'success'].includes(name)) name = 'menu';
  if (['cart', 'contact', 'pickup'].includes(name) && !state.cart.length) name = 'menu';
  state.view = name;
  document.body.dataset.view = name;
  for (const view of ['menu','cart','contact','pickup','profile','success']) $(view + 'View').hidden = view !== name;
  $('headerBack').hidden = name === 'menu';
  $('categoriesBar').hidden = name !== 'menu';
  if (name === 'cart') renderCart();
  if (name === 'contact') populateContact();
  if (name === 'pickup') { renderPickup(); renderSummary('pickupSummary'); }
  if (name === 'profile') renderProfile();
  updateCounters();
  window.scrollTo({top:0,behavior:'instant'});
}
function closeModal() {
  $('productOverlay').hidden = true;
  state.draft = null;
  state.editingId = null;
  document.body.style.overflow = '';
}
function openProduct(itemId, editId) {
  const ref = itemById(itemId);
  if (!ref || ref.item.soldOut || ref.item.hidden) return;
  const item = ref.item;
  const original = editId ? state.cart.find((x) => x.id === editId) : null;
  const size = original?.sizeId || item.sizes[Math.min(item.defaultSizeIndex, item.sizes.length - 1)]?.id;
  if (!size) { toast('Ingen størrelser tilgjengelig for dette produktet.'); return; }
  const selections = original ? structuredClone(original.selections || {}) : {};
  state.draft = {
    itemId: item.id, sizeId: size, qty: original?.qty || 1, selections,
    removedIngredients: [...(original?.removedIngredients || [])], comment: original?.comment || ''
  };
  state.editingId = original?.id || null;
  $('dialogTitle').textContent = item.name;
  $('dialogDescription').textContent = item.description || item.ingredients || '';
  $('dialogImage').innerHTML = item.image ? '<img alt="" src="' + safe(item.image) + '">' : '<span aria-hidden="true">🍴</span>';
  $('dialogAllergens').innerHTML = allergensHTML(item);
  $('dialogComment').value = state.draft.comment;
  $('dialogError').hidden = true;
  updateDialogFavorite(item.id);
  initializeDefaults(item);
  renderDraft();
  $('productOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
  $('dialogTitle').focus?.();
}
function initializeDefaults(item) {
  for (const group of itemGroups(item,state.draft.sizeId)) {
    if (state.draft.selections[group.id]) continue;
    state.draft.selections[group.id] = group.defaults.filter((id) =>
      group.options.some((o) => o.id === id && !o.soldOut)).slice(0,group.max);
  }
}
function optionsTotal(group) {
  return (state.draft.selections[group.id] || []).length;
}
function optionHTML(group,option) {
  const current = state.draft.selections[group.id] || [];
  const n = current.filter((id) => id === option.id).length;
  const base = '<span>' + safe(option.label) + '</span>' + (option.price ? '<small>+' + money(option.price) + '</small>' : '');
  if (group.allowQuantity && group.mode === 'multiple') {
    return '<div class="option-pick ' + (option.soldOut ? 'is-disabled' : '') + '"><div class="option-caption">' + base + '</div>' +
      '<div class="mini-qty"><button type="button" data-option-minus="' + safe(option.id) + '" data-option-group="' + safe(group.id) + '" aria-label="Fjern ett valg">−</button>' +
      '<strong>' + n + '</strong><button type="button" data-option-plus="' + safe(option.id) + '" data-option-group="' + safe(group.id) + '" aria-label="Legg til ett valg" ' + (option.soldOut ? 'disabled' : '') + '>+</button></div></div>';
  }
  return '<label class="option-pick ' + (option.soldOut ? 'is-disabled' : '') + '"><input type="' + (group.mode === 'single' ? 'radio' : 'checkbox') +
    '" name="choice-' + safe(group.id) + '" data-option="' + safe(option.id) + '" data-group="' + safe(group.id) +
    '" ' + (n ? 'checked ' : '') + (option.soldOut ? 'disabled ' : '') + '>' + base + '</label>';
}
function renderDraft() {
  const draft = state.draft;
  if (!draft) return;
  const ref = itemById(draft.itemId), item = ref.item;
  $('dialogSizes').innerHTML = item.sizes.length > 1 ?
    '<div class="dialog-group"><h3>Størrelse</h3><div class="option-picks">' + item.sizes.map((s) =>
      '<label class="option-pick"><input type="radio" name="size" data-size="' + safe(s.id) + '" ' +
      (s.id === draft.sizeId ? 'checked' : '') + '><span>' + safe(s.label || 'Standard') + '</span><small>' + money(s.price) +
      '</small></label>').join('') + '</div></div>' : '';
  $('dialogOptions').innerHTML = itemGroups(item,draft.sizeId).map((group) =>
    '<div class="dialog-group"><h3>' + safe(group.title) + '</h3><span class="group-hint">' +
    (group.required ? 'Obligatorisk valg' : 'Valgfritt') + (group.mode === 'multiple' ? ' · opptil ' + group.max + ' valg' : '') +
    '</span><div class="option-picks">' +
    (!group.required && group.mode === 'single' ? '<label class="option-pick"><input type="radio" name="choice-' + safe(group.id) + '" data-clear-group="' + safe(group.id) + '" ' + (optionsTotal(group) ? '' : 'checked') + '><span>Ingen tilvalg</span></label>' : '') +
    group.options.map((option) => optionHTML(group,option)).join('') +
    '</div></div>').join('');
  const rules = item.ingredientRules.length ? item.ingredientRules : item.ingredients.split(',').map((name) => ({name:name.trim(),removable:true})).filter((i)=>i.name);
  $('dialogIngredients').innerHTML = state.catalog.settings.ingredientCustomizationEnabled === false || !rules.some((r) => r.removable) ? '' :
    '<div class="dialog-group"><h3>Tilpass ingredienser</h3><span class="group-hint">Velg det du ønsker å fjerne</span><div class="option-picks">' +
    rules.filter((r) => r.removable && r.name).map((r) =>
      '<label class="option-pick"><input type="checkbox" data-remove-ingredient="' + safe(r.name) + '" ' +
      (draft.removedIngredients.includes(r.name) ? 'checked' : '') + '><span>Uten ' + safe(r.name) + '</span></label>').join('') +
    '</div></div>';
  $('dialogQty').textContent = String(draft.qty);
  $('dialogMinus').disabled = draft.qty <= 1;
  $('dialogPlus').disabled = draft.qty >= 20;
  $('dialogTotal').textContent = money(getPrice(item,draft.sizeId,draft.selections) * draft.qty);
}
function optionChange(input) {
  const draft = state.draft;
  if (!draft) return;
  if (input.dataset.size) {
    draft.sizeId = input.dataset.size;
    draft.selections = {};
    initializeDefaults(itemById(draft.itemId).item);
  } else if (input.dataset.clearGroup) {
    draft.selections[input.dataset.clearGroup] = [];
  } else if (input.dataset.group) {
    const group = state.catalog.groups.find((g) => g.id === input.dataset.group);
    if (!group) return;
    const active = draft.selections[group.id] || [];
    if (group.mode === 'single') draft.selections[group.id] = input.checked ? [input.dataset.option] : [];
    else if (input.checked) {
      if (active.length >= group.max) { input.checked = false; toast('Du kan velge maks ' + group.max + ' alternativ.'); return; }
      draft.selections[group.id] = [...active, input.dataset.option];
    } else draft.selections[group.id] = active.filter((id) => id !== input.dataset.option);
  } else if (input.dataset.removeIngredient) {
    draft.removedIngredients = input.checked ?
      [...new Set([...draft.removedIngredients,input.dataset.removeIngredient])] :
      draft.removedIngredients.filter((x) => x !== input.dataset.removeIngredient);
  }
  renderDraft();
}
function optionQuantity(button) {
  const draft = state.draft;
  if (!draft) return;
  const group = state.catalog.groups.find((g) => g.id === button.dataset.optionGroup);
  if (!group) return;
  const id = button.dataset.optionPlus || button.dataset.optionMinus;
  const current = draft.selections[group.id] || [];
  if (button.dataset.optionPlus) {
    if (current.length >= group.max) { toast('Maks ' + group.max + ' valg.'); return; }
    draft.selections[group.id] = [...current,id];
  } else {
    const at = current.indexOf(id);
    if (at > -1) draft.selections[group.id] = current.filter((_,i) => i !== at);
  }
  renderDraft();
}
function addToCart() {
  const draft = state.draft;
  if (!draft) return;
  const ref = itemById(draft.itemId);
  if (!ref) return;
  for (const group of itemGroups(ref.item,draft.sizeId)) {
    const size = (draft.selections[group.id] || []).length;
    if ((group.required && size < Math.max(1,group.min)) || size > group.max) {
      $('dialogError').textContent = 'Kontroller valgene under «' + group.title + '».';
      $('dialogError').hidden = false;
      return;
    }
  }
  draft.comment = $('dialogComment').value.trim().slice(0,250);
  const line = {id:state.editingId || uniqueId(), ...draft};
  const existing = state.cart.findIndex((x) => x.id === state.editingId);
  if (existing >= 0) state.cart[existing] = line;
  else {
    const match = state.cart.find((x) => x.itemId === line.itemId && x.sizeId === line.sizeId &&
      JSON.stringify(x.selections) === JSON.stringify(line.selections) &&
      JSON.stringify(x.removedIngredients) === JSON.stringify(line.removedIngredients) && x.comment === line.comment);
    if (match) match.qty = Math.min(99,match.qty + line.qty);
    else state.cart.push(line);
  }
  saveCart();
  closeModal();
  toast('Lagt i handlekurven');
  if (state.view === 'cart') renderCart();
}
function saveCart() { writeLocal(KEY.cart,state.cart); updateCounters(); }
function renderCartLine(entry) {
  const info = cartDetails(entry);
  if (!info) return '';
  const notes = [
    '<b>Størrelse:</b> ' + safe(info.size?.label || 'Standard'),
    ...info.extras.map((item) => safe(item)),
    ...(entry.removedIngredients?.length ? ['<b>Uten:</b> ' + safe(entry.removedIngredients.join(', '))] : []),
    ...(entry.comment ? ['<b>Kommentar:</b> ' + safe(entry.comment)] : [])
  ];
  return '<article class="cart-line">' +
    '<div class="cart-line-top"><button class="cart-title" data-edit="' + safe(entry.id) +
    '" type="button">' + safe(info.item.name) + '</button>' +
    '<div class="qty-control"><button data-cart-minus="' + safe(entry.id) +
    '" aria-label="Færre" type="button">−</button><span>' + entry.qty +
    '</span><button data-cart-plus="' + safe(entry.id) +
    '" aria-label="Flere" type="button">+</button></div></div>' +
    '<button class="cart-detail" type="button" data-edit="' + safe(entry.id) + '">' +
      '<span class="cart-size-row">' + notes[0] + '<strong>' + money(info.unit) + ' / stk</strong></span>' +
      notes.slice(1).map((text) => '<span class="cart-detail-row">' + text + '</span>').join('') +
    '</button><div class="cart-line-bottom"><button type="button" data-cart-remove="' +
    safe(entry.id) + '" class="text-action">Fjern</button><span>Sum <strong>' +
    money(info.total) + '</strong></span></div></article>';
}
function renderCart() {
  $('cartLines').innerHTML = state.cart.length ? state.cart.map(renderCartLine).join('') :
    '<div class="empty-state">Handlekurven er tom. Finn noe godt fra menyen.</div>';
  $('cartSubtotal').textContent = money(total());
  $('cartTotal').textContent = money(total());
  $('goContact').disabled = !state.cart.length;
  $('cartBottom').hidden = !state.cart.length;
  $('clearCart').hidden = !state.cart.length;
}
function modifyCart(id, change) {
  const line = state.cart.find((x) => x.id === id);
  if (!line) return;
  if (change === 0 || line.qty + change < 1) state.cart = state.cart.filter((x) => x.id !== id);
  else line.qty = Math.min(99,line.qty + change);
  saveCart();
  if (!state.cart.length && state.view !== 'cart') showView('cart');
  renderCart();
}
function summaryHTML() {
  return '<h3>Bestillingen din</h3>' +
    state.cart.map((line) => {
      const info = cartDetails(line);
      if (!info) return '';
      return '<div class="review-line"><span><strong>' + line.qty + '× ' +
        safe(info.item.name) + '</strong><small>Størrelse: ' +
        safe(info.size?.label || 'Standard') + '</small></span><b>' + money(info.total) + '</b></div>';
    }).join('') +
    '<div class="review-total"><span>Totalt</span><strong>' + money(total()) + '</strong></div>';
}
function renderSummary(id) { $(id).innerHTML = summaryHTML(); }
function populateContact() {
  $('customerName').value = state.contact.name || '';
  $('customerPhone').value = state.contact.phone || '';
  $('customerEmail').value = state.contact.email || '';
  $('contactError').hidden = true;
}
function validateContact() {
  const name = $('customerName').value.trim().replace(/\s+/g,' ');
  const phone = $('customerPhone').value.replace(/\D/g, '');
  const email = $('customerEmail').value.trim();
  let error = '';
  if (name.split(' ').length < 2 || name.length < 3) error = 'Oppgi både fornavn og etternavn.';
  else if (!/^[49]\d{7}$/.test(phone)) error = 'Norsk mobilnummer må ha 8 siffer og starte på 4 eller 9.';
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Kontroller e-postadressen.';
  $('contactError').textContent = error;
  $('contactError').hidden = !error;
  if (error) return false;
  state.contact = {name,phone,email};
  writeLocal(KEY.contact,state.contact);
  return true;
}
function osloClock(date = new Date()) {
  const values = {};
  for (const part of new Intl.DateTimeFormat('en-GB',
    {timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit',weekday:'short',hour12:false}).formatToParts(date))
    values[part.type] = part.value;
  const short = values.weekday?.slice(0,3) || 'Mon';
  return {day:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(short),
    minutes:(Number(values.hour) % 24) * 60 + Number(values.minute)};
}
function toMinutes(value) {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  return parts ? Number(parts[1])*60+Number(parts[2]) : null;
}
function hhmm(n) { return String(Math.floor((n % 1440) / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0'); }
function opening() {
  if (!state.catalog) return {open:false,label:'Laster…',remaining:0};
  const settings = state.catalog.settings || {};
  const clock = osloClock();
  const weekly = Array.isArray(settings.weeklyHours) && settings.weeklyHours.length === 7 ?
    settings.weeklyHours : dayNames.map(() => ({enabled:true,open:settings.orderOpenTime || '14:00',close:settings.orderCloseTime || '22:00'}));
  const today = weekly[clock.day] || {};
  const yesterday = weekly[(clock.day + 6) % 7] || {};
  const todayStart = toMinutes(today.open), todayEnd = toMinutes(today.close);
  const yesterdayStart = toMinutes(yesterday.open), yesterdayEnd = toMinutes(yesterday.close);
  let remaining = 0;
  if (today.enabled !== false && todayStart !== null && todayEnd !== null && clock.minutes >= todayStart &&
      (todayEnd > todayStart ? clock.minutes < todayEnd : true))
    remaining = (todayEnd > todayStart ? todayEnd : todayEnd + 1440) - clock.minutes;
  else if (yesterday.enabled !== false && yesterdayStart !== null && yesterdayEnd !== null &&
    yesterdayEnd <= yesterdayStart && clock.minutes < yesterdayEnd)
    remaining = yesterdayEnd - clock.minutes;
  const until = Number(settings.manualClosedUntil) || 0;
  const forced = settings.manualClosed === true && (!until || until > Date.now());
  return {open:!forced && remaining > 0,remaining,
    label: !forced && remaining > 0 ? 'Åpent nå' : 'Stengt nå',
    today,nowMinute:clock.minutes,settings};
}
function updateOpening() {
  const current = opening();
  $('headerStatus').textContent = current.label;
  $('openDot').classList.toggle('is-closed', !current.open);
  $('closedBanner').hidden = current.open;
  $('closedMessage').textContent = state.catalog?.settings?.closedMessage ||
    'Du kan se menyen, men restauranten tar ikke imot bestillinger akkurat nå.';
  const settings = state.catalog?.settings || {};
  $('heroOpening').textContent = settings.orderOpenTime && settings.orderCloseTime ?
    'Kun henting · Åpent ' + settings.orderOpenTime + '–' + settings.orderCloseTime :
    'Kun henting · Betaling ved henting';
}

function pickupTimes() {
  const details = opening();
  if (!details.open) return [];
  const start = details.nowMinute + Math.max(30,Number(details.settings.prepMinutes) || 30);
  const interval = Math.max(5,Math.min(60,Number(details.settings.slotIntervalMinutes) || 15));
  const latest = details.nowMinute + details.remaining - 10;
  const slots = [];
  for (let n = Math.ceil(start / interval) * interval; n <= latest && slots.length < 25; n+=interval) slots.push(hhmm(n));
  return slots;
}
function renderPickup() {
  $('pickupAsap').setAttribute('aria-pressed',String(state.pickupMode === 'asap'));
  $('pickupScheduled').setAttribute('aria-pressed',String(state.pickupMode === 'scheduled'));
  $('pickupAsap').classList.toggle('selected', state.pickupMode === 'asap');
  $('pickupScheduled').classList.toggle('selected', state.pickupMode === 'scheduled');
  const slots = pickupTimes();
  $('pickupSlots').hidden = state.pickupMode !== 'scheduled';
  $('pickupSlots').innerHTML = slots.map((time) =>
    '<button type="button" class="time-chip ' + (time === state.pickupTime ? 'selected' : '') +
    '" data-slot="' + safe(time) + '">' + safe(time) + '</button>').join('') ||
    '<div class="notice notice-warn">Ingen tilgjengelige hentetider nå.</div>';
  $('pickupNotice').hidden = opening().open;
  $('pickupNotice').textContent = 'Restauranten er stengt nå. Du kan teste skjermene, men ingen ordre kan sendes fra BETA.';
  $('pickupError').hidden = true;
}
function orderPreview() {
  if (!state.pickupMode || (state.pickupMode === 'scheduled' && !state.pickupTime)) {
    $('pickupError').textContent = 'Velg Snarest eller en hentetid.';
    $('pickupError').hidden = false;
    return;
  }
  const pickup = state.pickupMode === 'asap' ? 'Snarest' : state.pickupTime;
  $('successDetails').innerHTML = '<div><strong>Navn:</strong> ' + safe(state.contact.name) + '</div>' +
    '<div><strong>Telefon:</strong> ' + safe(state.contact.phone) + '</div>' +
    '<div><strong>Hentetid:</strong> ' + safe(pickup) + '</div>' +
    '<div><strong>Varer:</strong> ' + count() + '</div>' +
    '<div><strong>Totalt:</strong> ' + money(total()) + '</div>';
  showView('success');
}
function renderProfile() {
  const p = state.contact || {};
  $('profileAvatar').textContent = (p.name || 'K').trim().slice(0,1).toUpperCase();
  $('profileName').textContent = p.name || 'Min profil';
  $('profilePhone').textContent = p.phone ? '+47 ' + p.phone : 'Kundeprofil';
  renderProfilePage('home');
}
function renderProfilePage(page) {
  const target = ['home','edit','orders','info'].includes(page) ? page : 'home';
  $('profileHome').hidden = target !== 'home';
  for (const key of ['Edit','Orders','Info']) $('profile'+key).hidden = key.toLowerCase() !== target;
  if (target === 'edit') {
    $('profileEditName').value = state.contact.name || '';
    $('profileEditPhone').value = state.contact.phone || '';
    $('profileEditEmail').value = state.contact.email || '';
    $('profileError').hidden = true;
  }
  if (target === 'info') {
    const settings = state.catalog?.settings || {};
    const hours = settings.orderOpenTime && settings.orderCloseTime ?
      safe(settings.orderOpenTime) + '–' + safe(settings.orderCloseTime) : 'Se åpningstider i menyen';
    const addr = [settings.streetAddress,settings.postalCode,settings.city].filter(Boolean).join(', ');
    $('restaurantInfo').innerHTML =
      '<div><b>Henting</b><span>Henting i restauranten</span></div>' +
      '<div><b>Åpningstider</b><span>' + hours + '</span></div>' +
      '<div><b>Adresse</b><span>' + safe(addr || 'Skarnes') + '</span></div>' +
      '<div><b>Betaling</b><span>Ved henting</span></div>';
  }
}
function saveProfile(event) {
  event.preventDefault();
  const name = $('profileEditName').value.trim().replace(/\s+/g,' ');
  const phone = $('profileEditPhone').value.replace(/\D/g,'');
  const email = $('profileEditEmail').value.trim();
  const valid = name.length >= 3 && name.includes(' ') &&
    /^[49]\d{7}$/.test(phone) && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!valid) {
    $('profileError').textContent = 'Sjekk fullt navn, norsk mobilnummer og e-postadresse.';
    $('profileError').hidden = false;
    return;
  }
  state.contact = {name,phone,email};
  writeLocal(KEY.contact,state.contact);
  $('profileName').textContent = name;
  $('profilePhone').textContent = '+47 '+phone;
  $('profileAvatar').textContent = name[0].toUpperCase();
  renderProfilePage('home');
  toast('Profilen er lagret på denne enheten.');
}
async function fetchValue(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(DATABASE + '/' + path + '.json', {
      signal:controller.signal,cache:'no-store',credentials:'omit'
    });
    if (!response.ok) throw new Error('Firebase HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function retrieveMenu(source, revision) {
  // Use one version check and fetch only the public menu branches.
  if (source === 'nested') {
    const nested = await fetchValue('menu');
    if (nested && list(nested.sections).length) return nested;
    throw new Error('Menydata mangler på /menu.');
  }
  const fields = ['sections','optionGroups','allergenCatalog','settings','popularItemIds'];
  const results = await Promise.all(fields.map((name) => fetchValue(name)));
  const data = Object.fromEntries(fields.map((name,index) => [name,results[index]]));
  if (!data.settings) data.siteSettings = await fetchValue('siteSettings');
  data.updatedAt = revision;
  if (!list(data.sections).length) {
    // Old root timestamps can coexist with the newer nested menu schema.
    const nested = await fetchValue('menu');
    if (nested && list(nested.sections).length) {
      return { ...nested, updatedAt: Number(nested.updatedAt) || revision };
    }
    throw new Error('Menydata mangler.');
  }
  return data;
}

function showCatalog(raw) {
  const previous = state.catalog?.revision;
  state.catalog = normalizeCatalog(raw);
  validCart();
  $('menuLoading').hidden = true;
  $('menuError').hidden = true;
  renderMenu();
  updateOpening();
}
let activeRefresh = null;
async function refreshCatalog(force = false) {
  if (activeRefresh) return activeRefresh;
  activeRefresh = (async () => {
    if (!state.catalog) {
      const cache = readLocal(KEY.menu,null);
      if (cache?.data && cache.data.sections) {
        try { state.menuSource = cache.source || 'root'; showCatalog(cache.data); } catch {}
      }
    }
    if (!force && state.lastFetch && Date.now() - state.lastFetch < 60000) return;
    try {
      // Cached visitors fetch only a tiny version integer. No open SSE/socket.
      const rootVersion = Number(await fetchValue('updatedAt')) || 0;
      const nestedVersion = rootVersion ? 0 : Number(await fetchValue('menu/updatedAt')) || 0;
      const source = rootVersion ? 'root' : (nestedVersion ? 'nested' : 'root');
      const revision = rootVersion || nestedVersion;
      if (!state.catalog || !revision || revision !== state.catalog.revision ||
          state.menuSource !== source) {
        const raw = await retrieveMenu(source, revision);
        const actualSource = source;
        showCatalog(raw);
        state.menuSource = actualSource;
        writeLocal(KEY.menu,{savedAt:Date.now(),source:actualSource,data:raw});
      }
      $('menuError').hidden = true;
      state.lastFetch = Date.now();
    } catch (error) {
      $('menuLoading').hidden = true;
      if (!state.catalog) {
        $('menuError').textContent = 'Kunne ikke hente menyen. Kontroller nettverket og prøv igjen.';
        $('menuError').hidden = false;
        $('menuSections').innerHTML =
          '<div class="empty-state"><button class="btn btn-secondary" type="button" id="retryMenu">Prøv igjen</button></div>';
      } else toast('Viser sist lagrede meny. Ingen nettverkstilgang.');
      // Retrying on focus is safe, never a tight request loop.
      state.lastFetch = Date.now();
    }
  })();
  try { await activeRefresh; } finally { activeRefresh = null; }
}

function closeSearch() {
  $('menuControls').hidden = true;
  $('menuSearch').value = '';
  state.search = '';
  $('clearSearch').hidden = true;
  renderMenu();
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  writeLocal(KEY.theme,dark ? 'light' : 'dark');
  $('themeButton').setAttribute('aria-pressed',String(!dark));
  $('themeButton').setAttribute('aria-label',dark ? 'Bytt til mørk modus' : 'Bytt til lys modus');
}
function bindEvents() {
  document.addEventListener('click', (event) => {
    const profileLink = event.target.closest('[data-profile-page]');
    if (profileLink) { renderProfilePage(profileLink.dataset.profilePage); return; }
    const go = event.target.closest('[data-go]');
    if (go) { showView(go.dataset.go); return; }
    const item = event.target.closest('[data-open]');
    if (item) { openProduct(item.dataset.open); return; }
    const category = event.target.closest('[data-category]');
    if (category) {scrollToCategory(category.dataset.category);return;}
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {setFavorite(favorite.dataset.favorite);return;}
    const searchToggle = event.target.closest('[data-toggle-search]');
    if (searchToggle) {
      $('menuControls').hidden = !$('menuControls').hidden;
      searchToggle.setAttribute('aria-pressed',String(!$('menuControls').hidden));
      if (!$('menuControls').hidden) $('menuSearch').focus();
      else closeSearch();
      return;
    }
    const edit = event.target.closest('[data-edit]');
    if (edit) { const line = state.cart.find((x) => x.id === edit.dataset.edit); if (line) openProduct(line.itemId,line.id); return; }
    const plus = event.target.closest('[data-cart-plus]');
    if (plus) {modifyCart(plus.dataset.cartPlus,1);return;}
    const minus = event.target.closest('[data-cart-minus]');
    if (minus) {modifyCart(minus.dataset.cartMinus,-1);return;}
    const remove = event.target.closest('[data-cart-remove]');
    if (remove) {modifyCart(remove.dataset.cartRemove,0);return;}
    const slot = event.target.closest('[data-slot]');
    if (slot) {state.pickupTime = slot.dataset.slot;renderPickup();return;}
    const optionQty = event.target.closest('[data-option-plus],[data-option-minus]');
    if (optionQty) {optionQuantity(optionQty);return;}
    if (event.target.id === 'retryMenu') refreshCatalog();
  });
  $('closeSearch').addEventListener('click',closeSearch);
  $('menuSearch').addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    $('clearSearch').hidden = !state.search;
    renderMenu();
  });
  $('clearSearch').addEventListener('click', () => {
    $('menuSearch').value = '';
    state.search = '';
    $('clearSearch').hidden = true;
    renderMenu();
    $('menuSearch').focus();
  });
  $('dialogFavorite').addEventListener('click', () => {
    if (state.draft) setFavorite(state.draft.itemId);
  });
  $('themeButton').addEventListener('click',toggleTheme);
  window.addEventListener('scroll',spyMenu,{passive:true});
  $('allergenToggle').addEventListener('change', (event) => {
    state.allergens = event.target.checked;
    renderMenu();
  });
  $('clearCart').addEventListener('click', () => {
    state.cart = []; saveCart(); renderCart(); toast('Handlekurven er tømt.');
  });
  $('goContact').addEventListener('click', () => showView('contact'));
  $('contactForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateContact()) showView('pickup');
  });
  document.querySelectorAll('[data-pickup]').forEach((button) =>
    button.addEventListener('click', () => {
      state.pickupMode = button.dataset.pickup;
      state.pickupTime = '';
      renderPickup();
    }));
  $('previewOrder').addEventListener('click',orderPreview);
  $('backToMenu').addEventListener('click', () => showView('menu'));
  $('profileButton').addEventListener('click',() => showView('profile'));
  $('profileForm').addEventListener('submit',saveProfile);
  $('headerBack').addEventListener('click', () => {
    showView(({cart:'menu',contact:'cart',pickup:'contact',profile:'menu',success:'menu'})[state.view] || 'menu');
  });
  document.querySelectorAll('[data-close-modal]').forEach((button) =>
    button.addEventListener('click',closeModal));
  $('dialogSizes').addEventListener('change',(event) => optionChange(event.target));
  $('dialogOptions').addEventListener('change',(event) => optionChange(event.target));
  $('dialogIngredients').addEventListener('change',(event) => optionChange(event.target));
  $('dialogMinus').addEventListener('click',() => {
    if (state.draft) {state.draft.qty = Math.max(1,state.draft.qty-1);renderDraft();}
  });
  $('dialogPlus').addEventListener('click',() => {
    if (state.draft) {state.draft.qty = Math.min(20,state.draft.qty+1);renderDraft();}
  });
  $('dialogAdd').addEventListener('click',addToCart);
  document.addEventListener('keydown',(event) => {
    if (event.key === 'Escape' && !$('productOverlay').hidden) closeModal();
  });
  window.addEventListener('online',() => {
    if (Date.now() - state.lastFetch > 180000) refreshCatalog();
  });
  document.addEventListener('visibilitychange',() => {
    if (!document.hidden && Date.now() - state.lastFetch > 300000) refreshCatalog();
  });
}
$('year').textContent = String(new Date().getFullYear());
document.documentElement.dataset.theme = readLocal(KEY.theme,'light') === 'dark' ? 'dark' : 'light';
$('themeButton').setAttribute('aria-pressed',String(document.documentElement.dataset.theme === 'dark'));
document.body.dataset.view = 'menu';
bindEvents();
refreshCatalog();
setInterval(updateOpening, 60000);
