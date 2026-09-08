(() => {
  'use strict';

  /*
   * Customer-side Firebase traffic guard.
   *
   * data.js still asks the database root for updates, but the customer page
   * never needs to download the whole database on every poll. We intercept
   * those root GETs and use a lightweight strategy instead:
   *   1) show the menu from localStorage immediately;
   *   2) check only /updatedAt.json at a modest interval;
   *   3) fetch menu nodes only when updatedAt actually changed;
   *   4) never download the global /orders tree for customers;
   *   5) refresh only the customer's own active order IDs, and only while
   *      there actually are active recent orders.
   *
   * Admin is unaffected because admin.html does not load install.js.
   */
  const FIREBASE_DB = 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
  const MENU_LOCAL_KEY = 'kol_menu_state_v2';
  const ORDERS_LOCAL_KEY = 'kol_orders_v1';
  const MENU_CHECK_MS = 45 * 1000;
  const ORDER_CHECK_MS = 60 * 1000;
  const ACTIVE_ORDER_MAX_AGE = 24 * 60 * 60 * 1000;
  const ACTIVE_ORDER_LIMIT = 4;
  const nativeFetch = window.fetch.bind(window);

  let cachedMenu = readStoredJSON(MENU_LOCAL_KEY, null);
  let lastMenuCheckAt = 0;
  let lastOwnOrdersCheckAt = 0;
  let menuSyncRequest = null;
  let ownOrdersSyncRequest = null;

  function readStoredJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStoredJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function firebaseUrl(path) {
    const clean = String(path || '').replace(/^\/+|\/+$/g, '');
    return `${FIREBASE_DB}/${clean ? `${clean}.json` : '.json'}?_=${Date.now()}`;
  }

  async function getFirebaseJSON(path) {
    const response = await nativeFetch(firebaseUrl(path), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Firebase GET failed (${response.status})`);
    return response.json();
  }

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

  function normalizeCachedMenu(menu) {
    if (!menu || typeof menu !== 'object') return null;
    return {
      schemaVersion: menu.schemaVersion,
      settings: menu.settings || menu.siteSettings || null,
      siteSettings: menu.siteSettings || menu.settings || null,
      allergenCatalog: Array.isArray(menu.allergenCatalog) ? menu.allergenCatalog : [],
      sections: Array.isArray(menu.sections) ? menu.sections : [],
      optionGroups: Array.isArray(menu.optionGroups) ? menu.optionGroups : [],
      popularItemIds: Array.isArray(menu.popularItemIds) ? menu.popularItemIds : [],
      updatedAt: Number(menu.updatedAt) || 0,
    };
  }

  async function fetchMenuNodes(remoteUpdatedAt) {
    const [sections, optionGroups, allergenCatalog, settings, siteSettings, popularItemIds, schemaVersion] =
      await Promise.all([
        getFirebaseJSON('sections'),
        getFirebaseJSON('optionGroups'),
        getFirebaseJSON('allergenCatalog'),
        getFirebaseJSON('settings'),
        getFirebaseJSON('siteSettings'),
        getFirebaseJSON('popularItemIds'),
        getFirebaseJSON('schemaVersion'),
      ]);

    const next = normalizeCachedMenu({
      schemaVersion,
      settings: settings || siteSettings,
      siteSettings: siteSettings || settings,
      allergenCatalog,
      sections,
      optionGroups,
      popularItemIds,
      updatedAt: Number(remoteUpdatedAt) || Date.now(),
    });

    if (!next || !next.sections.length) throw new Error('Firebase menu is empty');
    cachedMenu = next;
    writeStoredJSON(MENU_LOCAL_KEY, next);
    return next;
  }

  async function syncMenuIfNeeded(force = false) {
    const now = Date.now();
    if (!force && cachedMenu && now - lastMenuCheckAt < MENU_CHECK_MS) return cachedMenu;
    if (document.hidden && cachedMenu) return cachedMenu;
    if (menuSyncRequest) return menuSyncRequest;

    menuSyncRequest = (async () => {
      try {
        const remoteUpdatedAt = Number(await getFirebaseJSON('updatedAt')) || 0;
        lastMenuCheckAt = Date.now();

        const localUpdatedAt = Number(cachedMenu?.updatedAt) || 0;
        if (cachedMenu && remoteUpdatedAt && remoteUpdatedAt === localUpdatedAt) return cachedMenu;

        // Only the rare "menu really changed" path downloads the menu itself.
        return await fetchMenuNodes(remoteUpdatedAt);
      } finally {
        menuSyncRequest = null;
      }
    })();

    return menuSyncRequest;
  }

  function getOwnOrders() {
    const orders = readStoredJSON(ORDERS_LOCAL_KEY, []);
    return Array.isArray(orders) ? orders : [];
  }

  function getActiveOwnOrders(orders) {
    const now = Date.now();
    return orders
      .filter((order) => {
        if (!order?.id) return false;
        if (order.status === 'fullfort' || order.status === 'avvist') return false;
        const createdAt = Number(order.createdAt) || 0;
        return !createdAt || now - createdAt <= ACTIVE_ORDER_MAX_AGE;
      })
      .slice(0, ACTIVE_ORDER_LIMIT);
  }

  async function syncOwnActiveOrdersIfNeeded(force = false) {
    const orders = getOwnOrders();
    const active = getActiveOwnOrders(orders);
    if (!active.length) return orders;

    const now = Date.now();
    if (!force && now - lastOwnOrdersCheckAt < ORDER_CHECK_MS) return orders;
    if (document.hidden) return orders;
    if (ownOrdersSyncRequest) return ownOrdersSyncRequest;

    ownOrdersSyncRequest = (async () => {
      try {
        const remoteRecords = await Promise.all(
          active.map(async (order) => {
            try {
              return await getFirebaseJSON(`orders/${encodeURIComponent(order.id)}`);
            } catch (_) {
              return null;
            }
          })
        );
        lastOwnOrdersCheckAt = Date.now();

        const byId = new Map(
          remoteRecords.filter((record) => record?.id).map((record) => [record.id, record])
        );
        let changed = false;
        const merged = orders.map((order) => {
          const remote = byId.get(order.id);
          if (!remote) return order;
          if (remote.status === order.status && remote.statusUpdatedAt === order.statusUpdatedAt) return order;
          changed = true;
          return {
            ...order,
            status: remote.status || order.status,
            statusUpdatedAt: Number(remote.statusUpdatedAt) || order.statusUpdatedAt,
          };
        });

        if (changed) writeStoredJSON(ORDERS_LOCAL_KEY, merged);
        return changed ? merged : orders;
      } finally {
        ownOrdersSyncRequest = null;
      }
    })();

    return ownOrdersSyncRequest;
  }

  function toFirebaseOrdersObject(orders) {
    const result = {};
    for (const order of orders || []) {
      if (order?.id) result[order.id] = order;
    }
    return result;
  }

  function makeSyntheticRoot(menu, orders) {
    const safeMenu = normalizeCachedMenu(menu) || normalizeCachedMenu(cachedMenu) || {};
    return {
      ...safeMenu,
      orders: toFirebaseOrdersObject(orders),
    };
  }

  function jsonResponse(value) {
    return new Response(JSON.stringify(value ?? null), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  window.fetch = async function efficientCustomerFetch(input, init) {
    if (!isFirebaseRootGet(input, init)) return nativeFetch(input, init);

    try {
      // The frequent root poll becomes, at most, one tiny updatedAt request every
      // 45 seconds. The menu itself is downloaded only when that value changed.
      const [menu, orders] = await Promise.all([
        syncMenuIfNeeded(false),
        syncOwnActiveOrdersIfNeeded(false),
      ]);

      if (menu?.sections?.length) return jsonResponse(makeSyntheticRoot(menu, orders));
    } catch (err) {
      // If the lightweight path fails, keep the locally cached menu visible.
      const localMenu = normalizeCachedMenu(cachedMenu || readStoredJSON(MENU_LOCAL_KEY, null));
      if (localMenu?.sections?.length) {
        return jsonResponse(makeSyntheticRoot(localMenu, getOwnOrders()));
      }
    }

    // First ever visit with no local menu: preserve the old full-root request as
    // a one-time safety fallback instead of leaving the customer with no menu.
    return nativeFetch(input, init);
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
