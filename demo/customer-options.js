/* ===== ADMIN PRODUCT OPTIONS BRIDGE ===== */
(() => {
  'use strict';
  if (window.__KOL_ADMIN_OPTIONS_BRIDGE_V2__) return;
  window.__KOL_ADMIN_OPTIONS_BRIDGE_V2__ = true;

  const asArray = value => Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.values(value) : []);
  const baseOpenProduct = openProduct;
  const baseFillProduct = fillProduct;
  const baseOpenCartEdit = openCartEdit;
  const baseRenderCart = renderCart;
  const baseBuildPayload = buildAdminOrderPayload;
  const integration = window.KOLIntegration || {};
  const baseApplyAdminConfig = integration.applyAdminConfig;

  function normalizeChoiceGroup(group = {}) {
    const options = asArray(group.options).map((option, index) => ({
      id: String(option?.id || `option-${index + 1}`),
      label: String(option?.label || '').trim(),
      price: Number(option?.price) || 0,
    })).filter(option => option.label);

    const selectionMode = group.selectionMode === 'multiple' ? 'multiple' : 'single';
    const required = Boolean(group.required ?? (Number(group.min) > 0));
    const maxSelections = selectionMode === 'single'
      ? 1
      : Math.max(1, Math.min(options.length || 1, Number(group.maxSelections ?? group.max) || options.length || 1));

    let defaultOptionIds = asArray(group.defaultOptionIds).map(String).filter(id => options.some(option => option.id === id));
    if (selectionMode === 'single') defaultOptionIds = defaultOptionIds.slice(0, 1);
    else defaultOptionIds = defaultOptionIds.slice(0, maxSelections);

    return {
      id: String(group.id || ''),
      title: String(group.title || 'Velg').trim() || 'Velg',
      selectionMode,
      required,
      maxSelections,
      defaultOptionIds,
      options,
    };
  }

  function enrichRuntimeMenu(rawConfig = {}) {
    const rawSections = asArray(rawConfig.sections);
    const groups = asArray(rawConfig.optionGroups).map(normalizeChoiceGroup);
    const runtimeSections = (typeof MENU !== 'undefined' ? MENU : []).filter(section => !section.virtual);

    runtimeSections.forEach(section => {
      const rawSection = rawSections.find(candidate => String(candidate?.id || '') === String(section.id)) || {};
      const rawProducts = asArray(rawSection.items);

      (section.items || []).forEach(productData => {
        const rawProduct = rawProducts.find(candidate => String(candidate?.id || '') === String(productData.id)) || {};
        productData.defaultSizeIndex = Math.min(
          Math.max(0, Number(rawProduct.defaultSizeIndex) || 0),
          Math.max(0, (productData.sizes?.length || 1) - 1)
        );

        const ids = new Set(asArray(rawProduct.optionGroupIds).map(String));
        productData.choiceGroups = groups.filter(group => ids.has(group.id) && group.options.length);
      });
    });
  }

  if (typeof baseApplyAdminConfig === 'function') {
    integration.applyAdminConfig = function applyAdminConfigWithChoices(config = {}) {
      const applied = baseApplyAdminConfig(config);
      if (!applied) return false;
      enrichRuntimeMenu(config);
      renderAll();
      return true;
    };
  }

  function initSelections(productData, existingExtras = null) {
    const selections = {};
    const extras = asArray(existingExtras);

    (productData.choiceGroups || []).forEach(group => {
      const fromCart = extras.filter(extra => String(extra.groupId) === group.id).map(extra => String(extra.id));
      selections[group.id] = fromCart.length ? fromCart : [...group.defaultOptionIds];

      if (group.selectionMode === 'single') selections[group.id] = selections[group.id].slice(0, 1);
      else selections[group.id] = selections[group.id].slice(0, group.maxSelections);

      if (group.required && !selections[group.id].length && group.options.length === 1) {
        selections[group.id] = [group.options[0].id];
      }
    });

    state.product.optionSelections = selections;
  }

  function selectedOptions(productData = state.product.selected) {
    if (!productData) return [];
    const selections = state.product.optionSelections || {};
    const result = [];

    (productData.choiceGroups || []).forEach(group => {
      const selectedIds = new Set(asArray(selections[group.id]).map(String));
      group.options.forEach(option => {
        if (selectedIds.has(option.id)) result.push({ groupId: group.id, groupTitle: group.title, ...option });
      });
    });
    return result;
  }

  function optionsPrice() {
    return selectedOptions().reduce((sum, option) => sum + (Number(option.price) || 0), 0);
  }

  function validateOptions() {
    const productData = state.product.selected;
    if (!productData) return true;
    const selections = state.product.optionSelections || {};

    for (const group of productData.choiceGroups || []) {
      const count = asArray(selections[group.id]).length;
      if (group.required && count < 1) {
        showToast(`${group.title}: velg minst ett alternativ`);
        document.querySelector(`[data-option-group="${CSS.escape(group.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      if (group.selectionMode === 'multiple' && count > group.maxSelections) {
        showToast(`${group.title}: maks ${group.maxSelections} valg`);
        return false;
      }
    }
    return true;
  }

  function ensureOptionsHost() {
    let host = document.getElementById('adminOptionGroups');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'adminOptionGroups';
    const strength = document.getElementById('strengthGroup');
    const size = document.getElementById('sizeGroup');
    if (strength) strength.insertAdjacentElement('afterend', host);
    else if (size) size.insertAdjacentElement('afterend', host);
    else document.querySelector('#productScreen .product-body')?.prepend(host);
    return host;
  }

  function renderChoiceGroups() {
    const productData = state.product.selected;
    const host = ensureOptionsHost();
    if (!host || !productData) return;

    const groups = productData.choiceGroups || [];
    if (!groups.length || state.loyalty.rewardMode) {
      host.innerHTML = '';
      host.hidden = true;
      return;
    }

    host.hidden = false;
    const selections = state.product.optionSelections || (state.product.optionSelections = {});

    host.innerHTML = groups.map(group => {
      const selectedIds = new Set(asArray(selections[group.id]).map(String));
      const rule = group.selectionMode === 'multiple'
        ? `${group.required ? 'Obligatorisk' : 'Valgfritt'} · maks ${group.maxSelections}`
        : (group.required ? 'Obligatorisk · velg 1' : 'Valgfritt · velg 1');

      return `<div class="product-choice-group admin-option-group" data-option-group="${escapeHtml(group.id)}">
        <div class="product-choice-head"><strong>${escapeHtml(group.title)}</strong><span>${escapeHtml(rule)}</span></div>
        <div>${group.options.map(option => {
          const active = selectedIds.has(option.id);
          return `<button type="button" class="product-choice ${active ? 'active' : ''}" data-option-group-id="${escapeHtml(group.id)}" data-option-id="${escapeHtml(option.id)}">
            <span class="choice-mark">${active ? '✓' : ''}</span>
            <span>${escapeHtml(option.label)}</span>
            <strong>${option.price ? `+${money(option.price).replace(',00', '')}` : ''}</strong>
          </button>`;
        }).join('')}</div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-option-id]').forEach(button => {
      button.onclick = () => {
        const group = groups.find(candidate => candidate.id === button.dataset.optionGroupId);
        if (!group) return;
        const id = button.dataset.optionId;
        let chosen = new Set(asArray(selections[group.id]).map(String));

        if (group.selectionMode === 'single') {
          if (chosen.has(id) && !group.required) chosen.clear();
          else chosen = new Set([id]);
        } else if (chosen.has(id)) {
          chosen.delete(id);
        } else {
          if (chosen.size >= group.maxSelections) {
            showToast(`Du kan velge maks ${group.maxSelections}`);
            return;
          }
          chosen.add(id);
        }

        selections[group.id] = [...chosen];
        renderChoiceGroups();
        updateProductTotal();
      };
    });
  }

  openProduct = function openProductWithAdminOptions(id, opts = {}) {
    baseOpenProduct(id, opts);
    const selected = state.product.selected;
    if (!selected) return;

    if (!state.loyalty.rewardMode) {
      state.product.sizeIndex = Math.min(
        Math.max(0, Number(selected.defaultSizeIndex) || 0),
        Math.max(0, selected.sizes.length - 1)
      );
    }

    initSelections(selected);
    fillProduct();
  };

  openCartEdit = function openCartEditWithAdminOptions(index) {
    const line = state.cart[index];
    baseOpenCartEdit(index);
    const selected = state.product.selected;
    if (!selected || !line) return;
    initSelections(selected, line.extras || []);
    fillProduct(line.note || '');
  };

  fillProduct = function fillProductWithAdminOptions(note = '') {
    baseFillProduct(note);
    renderChoiceGroups();
    updateProductTotal();
  };

  updateProductTotal = function updateProductTotalWithOptions() {
    const selected = state.product.selected;
    if (!selected) return;
    const base = Number(selected.sizes[state.product.sizeIndex]?.[1]) || 0;
    const total = (base + (state.loyalty.rewardMode ? 0 : optionsPrice())) * state.product.qty;
    $('#productTotal').textContent = state.loyalty.rewardMode ? '0,00 KR' : productMoney(total);
  };

  addOrUpdateCart = function addOrUpdateCartWithOptions() {
    const selected = state.product.selected;
    if (!selected) return;
    if (!state.loyalty.rewardMode && !validateOptions()) return;

    const size = selected.sizes[state.product.sizeIndex];
    const note = $('#productNote').value.trim();
    const strength = selected.strengths?.length ? state.product.strength : '';
    const editingIndex = state.product.editingCartIndex;

    if (state.loyalty.rewardMode) {
      if (!account() || account().stamps < 10) { state.loyalty.rewardMode = false; showToast('Gratis pizza er ikke tilgjengelig'); return; }
      if (state.cart.some((line, index) => line.freeReward && index !== editingIndex)) { showToast('Gratis pizza ligger allerede i handlekurven'); return; }
      const entry = { key:`reward|${selected.id}|Stor|${note}`, productId:selected.id, name:selected.name, size:'Stor', strength:'', price:0, regularPrice:size[1], qty:1, note, freeReward:true, extras:[] };
      if (editingIndex >= 0 && state.cart[editingIndex]) state.cart[editingIndex] = entry; else state.cart.push(entry);
      state.product.editingCartIndex=-1; state.loyalty.rewardMode=false; saveStorage(STORAGE_KEYS.cart,state.cart); renderCartCount(); renderCart(); openView('cartScreen',{tabs:true}); showToast(`Gratis pizza lagt i handlekurven – du sparer ${money(size[1])}`); return;
    }

    const extras = selectedOptions();
    const extrasTotal = extras.reduce((sum, option) => sum + (Number(option.price) || 0), 0);
    const extrasKey = extras.map(option => `${option.groupId}:${option.id}`).sort().join(',');
    const entry = {
      key: `${selected.id}|${size[0]}|${strength}|${extrasKey}|${note}`,
      productId: selected.id,
      name: selected.name,
      size: size[0],
      strength,
      extras,
      price: (Number(size[1]) || 0) + extrasTotal,
      basePrice: Number(size[1]) || 0,
      extrasTotal,
      qty: state.product.qty,
      note,
      loyaltyEligible: isPizzaLoyaltyProduct(selected),
    };

    if (editingIndex >= 0 && state.cart[editingIndex]) {
      state.cart[editingIndex] = entry;
      state.product.editingCartIndex=-1;
      saveStorage(STORAGE_KEYS.cart,state.cart);
      renderCartCount(); renderCart(); openView('cartScreen',{tabs:true}); showToast('Handlekurv oppdatert');
      return;
    }

    const existing = state.cart.find(line => line.key === entry.key);
    if (existing) existing.qty += state.product.qty; else state.cart.push(entry);
    saveStorage(STORAGE_KEYS.cart,state.cart);
    renderCartCount(); goMenu(); showToast(`${selected.name} lagt i handlekurven`);
  };

  renderCart = function renderCartWithAdminOptions() {
    baseRenderCart();
    document.querySelectorAll('#cartLines .cart-line').forEach((row, index) => {
      const line = state.cart[index];
      if (!line?.extras?.length) return;
      const small = row.querySelector('.cart-line-copy small');
      if (!small) return;
      const text = line.extras.map(option => `${escapeHtml(option.groupTitle)}: <b>${escapeHtml(option.label)}</b>${option.price ? ` (+${money(option.price).replace(',00','')})` : ''}`).join('<br>');
      small.insertAdjacentHTML('beforeend', `<br>${text}`);
    });
  };

  buildAdminOrderPayload = function buildAdminOrderPayloadWithOptions(input) {
    const payload = baseBuildPayload(input);
    payload.items = payload.items.map((item, index) => {
      const line = input.lines?.[index] || {};
      const extras = [];
      if (line.strength) extras.push(`Styrke: ${line.strength}`);
      asArray(line.extras).forEach(option => extras.push(`${option.groupTitle}: ${option.label}${option.price ? ` (+${option.price} kr)` : ''}`));
      return { ...item, extras };
    });
    return payload;
  };

  if (window.KOLIntegration) window.KOLIntegration.buildAdminOrderPayload = buildAdminOrderPayload;

  const style = document.createElement('style');
  style.textContent = `
    #adminOptionGroups{display:block}
    #adminOptionGroups[hidden]{display:none!important}
    #adminOptionGroups .product-choice-head span{display:block!important;font-size:9.5px;color:#8a817b;font-weight:600}
    #adminOptionGroups .admin-option-group{margin-top:0}
    #adminOptionGroups .product-choice strong:last-child{font-size:11px;color:#5f5853}
  `;
  document.head.appendChild(style);

  const addButton = document.getElementById('addToCart');
  if (addButton) addButton.onclick = addOrUpdateCart;
})();
