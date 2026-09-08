import { findItem, allergenLabels } from './data.js';

const ALLERGEN_KEY = 'kol_allergens_v1';
const ALLERGEN_ICONS = {
  'Hvete / gluten': '🌾',
  Melk: '🥛',
  Egg: '🥚',
  Soya: '🌱',
  Selleri: '🌿',
  Sennep: '🟡',
  Sesam: '⚪',
  Fisk: '🐟',
  Skalldyr: '🦐',
  Peanøtter: '🥜',
  Nøtter: '🌰',
  Sulfitter: '🍷',
};

function readSelected() {
  try {
    const value = JSON.parse(localStorage.getItem(ALLERGEN_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [];
  } catch (_) {
    return [];
  }
}

function writeSelected(selected) {
  const clean = [...new Set(selected.filter(Boolean))];
  try {
    localStorage.setItem(ALLERGEN_KEY, JSON.stringify(clean));
    return true;
  } catch (_) {
    return false;
  }
}

function applyPickerState(selected = readSelected()) {
  const selectedSet = new Set(selected);
  document.querySelectorAll('#allergenPicker [data-allergen]').forEach((button) => {
    const active = selectedSet.has(button.dataset.allergen);
    button.classList.toggle('is-on', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const mainButton = document.getElementById('btnAllergens');
  const modal = document.getElementById('allergenModal');
  if (mainButton) {
    mainButton.classList.toggle('is-on', selected.length > 0 || Boolean(modal && !modal.hidden));
  }
}

function updateMenu(selected = readSelected()) {
  const selectedSet = new Set(selected);

  document.querySelectorAll('.prod-card[data-item]').forEach((card) => {
    const result = findItem(card.dataset.item);
    const item = result && result.item;
    const info = card.querySelector('.prod-info');
    if (!item || !info) return;

    const matches = allergenLabels(item).filter((label) => selectedSet.has(label));
    let warning = info.querySelector('.prod-allergens');

    if (!matches.length) {
      warning?.remove();
      card.classList.remove('has-selected-allergen');
      return;
    }

    card.classList.add('has-selected-allergen');
    const text = matches.map((label) => `${ALLERGEN_ICONS[label] || '•'} ${label}`).join('  ');

    if (!warning) {
      warning = document.createElement('p');
      warning.className = 'prod-allergens';
      const price = info.querySelector('.prod-price');
      if (price) info.insertBefore(warning, price);
      else info.appendChild(warning);
    }
    if (warning.textContent !== text) warning.textContent = text;
  });

  applyPickerState(selected);
}

let toastFadeTimer = null;
let toastHideTimer = null;
let toastDeadline = 0;
let internalToastChange = false;

function startToastLife() {
  const toast = document.getElementById('toast');
  if (!toast || toast.hidden) return;

  clearTimeout(toastFadeTimer);
  clearTimeout(toastHideTimer);
  toastDeadline = Date.now() + 2000;
  toast.classList.remove('kol-toast-fade', 'kol-toast-visible');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('kol-toast-visible'));
  });

  toastFadeTimer = setTimeout(() => {
    toast.classList.remove('kol-toast-visible');
    toast.classList.add('kol-toast-fade');
  }, 1500);

  toastHideTimer = setTimeout(() => {
    internalToastChange = true;
    toast.hidden = true;
    toast.classList.remove('kol-toast-visible', 'kol-toast-fade');
    internalToastChange = false;
    toastDeadline = 0;
  }, 2000);
}

function showSuccess(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  internalToastChange = true;
  toast.textContent = message;
  toast.hidden = false;
  internalToastChange = false;
  startToastLife();
}

function enhanceExistingToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const observer = new MutationObserver((mutations) => {
    if (internalToastChange) return;

    const hiddenMutation = mutations.some((m) => m.type === 'attributes' && m.attributeName === 'hidden');
    const contentMutation = mutations.some((m) => m.type === 'childList' || m.type === 'characterData');

    if (toast.hidden) {
      if (hiddenMutation && toastDeadline && Date.now() < toastDeadline) {
        internalToastChange = true;
        toast.hidden = false;
        internalToastChange = false;
      }
      return;
    }

    if (hiddenMutation || contentMutation) startToastLife();
  });

  observer.observe(toast, {
    attributes: true,
    attributeFilter: ['hidden'],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function initCheckoutBar() {
  const count = document.getElementById('barCount');
  const total = document.getElementById('barTotal');
  if (!count || !total) return;

  const left = count.parentElement;
  const right = total.parentElement;
  if (!left || !right) return;

  Array.from(left.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
  Array.from(right.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });

  let label = left.querySelector('.kol-bar-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'kol-bar-label';
    left.appendChild(label);
  }

  let cta = right.querySelector('.kol-bar-cta');
  if (!cta) {
    cta = document.createElement('span');
    cta.className = 'kol-bar-cta';
    cta.textContent = '· Til kassen →';
    right.appendChild(cta);
  }

  const syncLabel = () => {
    const value = Number.parseInt(count.textContent, 10) || 0;
    label.textContent = value === 1 ? 'vare' : 'varer';
  };

  syncLabel();
  new MutationObserver(syncLabel).observe(count, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function initAllergens() {
  enhanceExistingToast();
  initCheckoutBar();

  // Capture phase writes to localStorage before app.js handles the same click.
  document.addEventListener('click', (event) => {
    const choice = event.target.closest('#allergenPicker [data-allergen]');
    if (choice) {
      const label = choice.dataset.allergen;
      const current = readSelected();
      const exists = current.includes(label);
      const next = exists
        ? current.filter((value) => value !== label)
        : [...current, label];

      if (writeSelected(next)) {
        applyPickerState(next);
        updateMenu(next);
        showSuccess(exists ? `${label} fjernet.` : `${label} lagret.`);
      }

      setTimeout(() => {
        applyPickerState(next);
        updateMenu(next);
      }, 0);
      return;
    }

    const reset = event.target.closest('#allergenReset');
    if (reset) {
      writeSelected([]);
      applyPickerState([]);
      updateMenu([]);
      showSuccess('Matallergier nullstilt.');
      setTimeout(() => {
        applyPickerState([]);
        updateMenu([]);
      }, 0);
      return;
    }

    if (event.target.closest('#btnSaveProfile')) {
      setTimeout(() => showSuccess('Opplysninger lagret.'), 0);
    }
  }, true);

  const picker = document.getElementById('allergenPicker');
  if (picker) {
    new MutationObserver(() => applyPickerState(readSelected()))
      .observe(picker, { childList: true, subtree: true });
  }

  const menu = document.getElementById('menuList');
  if (menu) {
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        updateMenu(readSelected());
      });
    }).observe(menu, { childList: true, subtree: true });
  }

  updateMenu(readSelected());
  setTimeout(() => updateMenu(readSelected()), 250);
  setTimeout(() => updateMenu(readSelected()), 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllergens, { once: true });
} else {
  initAllergens();
}
