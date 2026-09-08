const ALLERGEN_KEY = 'kol_allergens_v1';

function loadSelected() {
  try {
    const value = JSON.parse(localStorage.getItem(ALLERGEN_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function persistSelected(selected) {
  try {
    localStorage.setItem(ALLERGEN_KEY, JSON.stringify(selected));
    return true;
  } catch (_) {
    return false;
  }
}

let ownToastTimer = null;
let ownFadeTimer = null;

function showSuccessToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  if (ownToastTimer) clearTimeout(ownToastTimer);
  if (ownFadeTimer) clearTimeout(ownFadeTimer);

  toast.classList.remove('is-fading');
  toast.textContent = message;
  toast.hidden = false;

  ownFadeTimer = setTimeout(() => {
    toast.classList.add('is-fading');
  }, 1400);

  ownToastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.classList.remove('is-fading');
  }, 2000);
}

function forceAppMenuRefresh() {
  const saveButton = document.getElementById('allergenSave');
  const openButton = document.getElementById('btnAllergens');
  const modal = document.getElementById('allergenModal');

  // app.js'nin kendi Lagre handler'i ui.selectedAllergens'i kalici kaydeder
  // ve renderMenu() calistirir. Ardindan ayni event-loop icinde popup'i
  // yeniden acariz; tarayici arada frame cizmedigi icin kapanma gorunmez.
  if (saveButton && openButton && modal && !modal.hidden) {
    saveButton.click();
    openButton.click();
  }
}

// Bu listener document seviyesinde bubble asamasinda calisir. Boylece once
// app.js'nin allergenPicker/allergenReset handler'lari ui state'ini gunceller.
document.addEventListener('click', (event) => {
  const choice = event.target.closest('#allergenPicker [data-allergen]');
  const reset = event.target.closest('#allergenReset');

  if (choice) {
    const label = choice.dataset.allergen;
    if (!label) return;

    const current = loadSelected();
    const selected = current.includes(label)
      ? current.filter((value) => value !== label)
      : [...current, label];

    persistSelected(selected);
    forceAppMenuRefresh();
    showSuccessToast('Allergener oppdatert');
    return;
  }

  if (reset) {
    persistSelected([]);
    forceAppMenuRefresh();
    showSuccessToast('Allergener nullstilt');
    return;
  }

  // Profil kaydi da ayni yesil onay bildirimi kullansin.
  if (event.target.closest('#btnSaveProfile')) {
    setTimeout(() => showSuccessToast('Opplysninger lagret'), 0);
  }
});

// app.js'nin mevcut toast bildirimlerini de ayni 2 saniyelik, yumusak
// kaybolan yesil onay stiline uyarlar.
const toast = document.getElementById('toast');
if (toast) {
  const observer = new MutationObserver(() => {
    if (toast.hidden) {
      toast.classList.remove('is-fading');
      return;
    }

    toast.classList.remove('is-fading');
    clearTimeout(toast._kolFadeTimer);
    toast._kolFadeTimer = setTimeout(() => {
      if (!toast.hidden) toast.classList.add('is-fading');
    }, 1500);
  });
  observer.observe(toast, { attributes: true, attributeFilter: ['hidden'] });
}
