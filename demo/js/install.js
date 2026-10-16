(() => {
  'use strict';

  // Firebase traffic and order tracking now live exclusively in data.js.
  // This helper only preserves checkout contact details between page visits.
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

  // Keep checkout contact details across refreshes and promote them to the
  // customer's profile after the first successful order. This is small enough
  // to live in the existing customer bootstrap instead of a separate file.
  const PROFILE_KEY = 'bestill_profile_v2';
  const CONTACT_KEY = 'bestill_checkout_contact_v2';
  const byId = (id) => document.getElementById(id);
  const cleanPhone = (value) => String(value || '').replace(/[^\d]/g, '').slice(0, 8);
  const validPhone = (value) => /^[49]\d{7}$/.test(cleanPhone(value));

  function getCheckoutContact() {
    return {
      name: (byId('custName')?.value || '').trim(),
      phone: cleanPhone(byId('custPhone')?.value || ''),
    };
  }

  function saveCheckoutDraft() {
    const contact = getCheckoutContact();
    if (!contact.name && !contact.phone) return;
    writeStoredJSON(CONTACT_KEY, contact);
  }

  function restoreCheckoutContact() {
    const draft = readStoredJSON(CONTACT_KEY, {});
    const profile = readStoredJSON(PROFILE_KEY, {});
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
    writeStoredJSON(CONTACT_KEY, { name, phone });
  }

  function promoteSuccessfulOrderToProfile() {
    const contact = getCheckoutContact();
    if (!contact.name || !validPhone(contact.phone)) return;

    writeStoredJSON(CONTACT_KEY, contact);

    const profName = byId('profName');
    const profPhone = byId('profPhone');
    if (profName) profName.value = contact.name;
    if (profPhone) profPhone.value = contact.phone;

    const saveButton = byId('btnSaveProfile');
    if (saveButton) {
      saveButton.click();
      return;
    }

    const previous = readStoredJSON(PROFILE_KEY, {});
    writeStoredJSON(PROFILE_KEY, {
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

})();
