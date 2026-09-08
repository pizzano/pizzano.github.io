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

function readSelectedFromPicker() {
  return Array.from(document.querySelectorAll('#allergenPicker .allergen-choice.is-on'))
    .map((button) => button.dataset.allergen)
    .filter(Boolean);
}

function persistSelected(selected) {
  try {
    localStorage.setItem(ALLERGEN_KEY, JSON.stringify(selected));
  } catch (_) {
    // LocalStorage kan være blokkert i enkelte private nettlesermoduser.
  }
}

function updateVisibleMenu(selected) {
  const selectedSet = new Set(selected);

  document.querySelectorAll('.prod-card[data-item]').forEach((card) => {
    const result = findItem(card.dataset.item);
    const item = result && result.item;
    if (!item) return;

    const marked = allergenLabels(item).filter((label) => selectedSet.has(label));
    const info = card.querySelector('.prod-info');
    if (!info) return;

    let warning = info.querySelector('.prod-allergens');

    if (!marked.length) {
      if (warning) warning.remove();
      return;
    }

    if (!warning) {
      warning = document.createElement('p');
      warning.className = 'prod-allergens';
      const price = info.querySelector('.prod-price');
      if (price) info.insertBefore(warning, price);
      else info.appendChild(warning);
    }

    warning.textContent = marked
      .map((label) => `${ALLERGEN_ICONS[label] || '•'} ${label}`)
      .join(' ');
  });

  const allergenButton = document.getElementById('btnAllergens');
  const modal = document.getElementById('allergenModal');
  if (allergenButton) {
    allergenButton.classList.toggle(
      'is-on',
      selected.length > 0 || Boolean(modal && !modal.hidden)
    );
  }
}

function commitCurrentSelection() {
  const selected = readSelectedFromPicker();
  persistSelected(selected);
  updateVisibleMenu(selected);
}

// Appens egen handler oppdaterer først .is-on-statusen. Deretter leser vi
// resultatet, lagrer det og oppdaterer menyen uten å lukke allergenvelgeren.
document.addEventListener('click', (event) => {
  const choice = event.target.closest('#allergenPicker [data-allergen]');
  const reset = event.target.closest('#allergenReset');
  if (!choice && !reset) return;

  setTimeout(commitCurrentSelection, 0);
});

// Sikrer korrekt visning hvis scriptet lastes etter at menyen allerede er tegnet.
window.addEventListener('load', () => {
  try {
    const selected = JSON.parse(localStorage.getItem(ALLERGEN_KEY) || '[]');
    if (Array.isArray(selected)) updateVisibleMenu(selected);
  } catch (_) {
    // Ignorer ugyldig lokal lagring.
  }
});
