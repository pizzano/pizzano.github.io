(() => {
  'use strict';

  /*
   * Customer-side Firebase traffic guard.
   * data.js currently asks the Realtime Database root for updates frequently.
   * On the customer page we keep the latest successful root response in memory
   * and reuse it for two minutes. While the tab is hidden we never refresh an
   * existing cached response. This keeps the menu stable, prevents unnecessary
   * full re-renders/image flicker and dramatically reduces Firebase bandwidth.
   * Admin is unaffected because admin.html does not load install.js.
   */
  const FIREBASE_DB = 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
  const FIREBASE_ROOT_TTL = 2 * 60 * 1000;
  const nativeFetch = window.fetch.bind(window);
  let firebaseRootResponse = null;
  let firebaseRootFetchedAt = 0;
  let firebaseRootRequest = null;

  function isFirebaseRootGet(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') return false;
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      return url.origin === new URL(FIREBASE_DB).origin && (url.pathname === '/.json' || url.pathname === '/');
    } catch (_) {
      return false;
    }
  }

  window.fetch = async function efficientCustomerFetch(input, init) {
    if (!isFirebaseRootGet(input, init)) return nativeFetch(input, init);

    const now = Date.now();
    const cacheIsFresh = firebaseRootResponse && now - firebaseRootFetchedAt < FIREBASE_ROOT_TTL;

    // No Firebase traffic while the customer is not looking at the page.
    if (firebaseRootResponse && (document.hidden || cacheIsFresh)) {
      return firebaseRootResponse.clone();
    }

    // Several refresh triggers can fire together (poll/focus/visibility).
    // Share one network request instead of downloading the database repeatedly.
    if (firebaseRootRequest) {
      const response = await firebaseRootRequest;
      return response.clone();
    }

    firebaseRootRequest = nativeFetch(input, init)
      .then((response) => {
        if (response.ok) {
          firebaseRootResponse = response.clone();
          firebaseRootFetchedAt = Date.now();
        }
        return response;
      })
      .finally(() => {
        firebaseRootRequest = null;
      });

    const response = await firebaseRootRequest;
    return response.clone();
  };

  function loadModule(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.type = 'module';
    script.src = src;
    document.head.appendChild(script);
  }

  // Customer-side enhancement module.
  loadModule('allergenUiModule', '/demo/js/allergen-ui.js?v=20260908-4');

  // Keep checkout contact details across refreshes and promote them to the
  // customer's profile after the first successful order. This is small enough
  // to live in the existing customer bootstrap instead of a separate file.
  const PROFILE_KEY = 'kol_profile_v1';
  const CONTACT_KEY = 'kol_checkout_contact_v1';
  const byId = (id) => document.getElementById(id);
  const cleanPhone = (value) => String(value || '').replace(/[^\d]/g, '').slice(0, 8);
  const validPhone = (value) => /^[49]\d{7}$/.test(cleanPhone(value));

  function readJSON(key, fallback = {}) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getCheckoutContact() {
    return {
      name: (byId('custName')?.value || '').trim(),
      phone: cleanPhone(byId('custPhone')?.value || ''),
    };
  }

  function saveCheckoutDraft() {
    const contact = getCheckoutContact();
    if (!contact.name && !contact.phone) return;
    writeJSON(CONTACT_KEY, contact);
  }

  function restoreCheckoutContact() {
    const draft = readJSON(CONTACT_KEY, {});
    const profile = readJSON(PROFILE_KEY, {});
    const name = draft.name || profile.name || '';
    const phone = cleanPhone(draft.phone || profile.phone || '');

    const custName = byId('custName');
    const custPhone = byId('custPhone');
    if (custName && !custName.value) custName.value = name;
    if (custPhone && !custPhone.value) custPhone.value = phone;
  }

  function syncDraftFromProfile() {
    const name = (byId('profName')?.value || '').trim();
    const phone = cleanPhone(byId('profPhone')?.value || '');
    if (!name && !phone) return;
    writeJSON(CONTACT_KEY, { name, phone });
  }

  function promoteSuccessfulOrderToProfile() {
    const contact = getCheckoutContact();
    if (!contact.name || !validPhone(contact.phone)) return;

    writeJSON(CONTACT_KEY, contact);

    const profName = byId('profName');
    const profPhone = byId('profPhone');
    if (profName) profName.value = contact.name;
    if (profPhone) profPhone.value = contact.phone;

    const saveButton = byId('btnSaveProfile');
    if (saveButton) {
      saveButton.click();
      return;
    }

    const previous = readJSON(PROFILE_KEY, {});
    writeJSON(PROFILE_KEY, {
      ...previous,
      name: contact.name,
      phone: contact.phone,
      favorites: Array.isArray(previous.favorites) ? previous.favorites : [],
    });
  }

  function initContactPersistence() {
    restoreCheckoutContact();

    const custName = byId('custName');
    const custPhone = byId('custPhone');
    custName?.addEventListener('input', saveCheckoutDraft);
    custPhone?.addEventListener('input', () => setTimeout(saveCheckoutDraft, 0));

    byId('btnSaveProfile')?.addEventListener('click', () => {
      setTimeout(syncDraftFromProfile, 0);
    });

    const confirmModal = byId('confirmModal');
    if (confirmModal) {
      new MutationObserver(() => {
        if (!confirmModal.hidden) promoteSuccessfulOrderToProfile();
      }).observe(confirmModal, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactPersistence, { once: true });
  } else {
    initContactPersistence();
  }

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;

  function removeCard() {
    installCard?.remove();
    installCard = null;
  }

  function showInstallCard() {
    if (!deferredPrompt || installCard || isStandalone()) return;

    const infoView = document.getElementById('viewInfo');
    if (!infoView) return;

    installCard = document.createElement('div');
    installCard.className = 'card pwa-info-install-card';
    installCard.innerHTML = `
      <div class="pwa-info-install-icon" aria-hidden="true">
        <img src="/demo/icons/kol-icon-192.png" alt="">
      </div>
      <div class="pwa-info-install-copy">
        <strong>Installer KØL-appen</strong>
        <span>Installer bestillingssiden på enheten og åpne den som en app uten vanlig adressefelt.</span>
      </div>
      <button class="pwa-info-install-button" type="button">Installer app</button>
    `;

    const cards = infoView.querySelectorAll('.card');
    const lastInfoCard = cards[cards.length - 1];
    const staffAccess = infoView.querySelector('.staff-access');

    if (lastInfoCard) lastInfoCard.insertAdjacentElement('afterend', installCard);
    else if (staffAccess) staffAccess.insertAdjacentElement('beforebegin', installCard);
    else infoView.appendChild(installCard);

    installCard.querySelector('.pwa-info-install-button').addEventListener('click', async () => {
      if (!deferredPrompt) {
        removeCard();
        return;
      }

      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (_) {
        // Native install UI is controlled by the browser.
      }
      removeCard();
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallCard();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeCard();
  });
})();
