/* KØL Firebase menu loader — read-only customer integration */
(() => {
  'use strict';

  const DATABASE_URL = 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';

  function asArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
    return [];
  }

  function normalizeText(value) {
    return String(value || '')
      .toLocaleLowerCase('nb-NO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function looksLikeSpiceGroup(group = {}) {
    const title = normalizeText(group.title);
    const labels = asArray(group.options).map(option => normalizeText(option?.label));
    return title.includes('styrke') || title.includes('sterk') || ['mild', 'medium', 'sterk'].every(label => labels.includes(label));
  }

  function adaptForCustomer(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') return rawConfig;
    const config = typeof structuredClone === 'function'
      ? structuredClone(rawConfig)
      : JSON.parse(JSON.stringify(rawConfig));

    /* app.js legacy strength adapter interprets `type` semantically.
       Customer-only clone changes spice groups without touching Firebase data. */
    config.optionGroups = asArray(config.optionGroups).map(group => (
      looksLikeSpiceGroup(group) ? { ...group, type: 'spice' } : group
    ));

    return config;
  }

  async function loadFirebaseMenu() {
    try {
      const response = await fetch(`${DATABASE_URL}/.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
      const config = await response.json();
      if (!config || !asArray(config.sections).length) {
        console.info('Firebase-meny er tom. Lokal fallback-meny brukes.');
        return false;
      }

      const integration = window.KOLIntegration;
      if (!integration?.applyAdminConfig) throw new Error('KOLIntegration er ikke klar');
      return integration.applyAdminConfig(adaptForCustomer(config));
    } catch (error) {
      console.warn('Firebase-meny kunne ikke lastes. Lokal fallback-meny brukes.', error);
      return false;
    }
  }

  window.KOLFirebaseMenu = { load: loadFirebaseMenu, databaseURL: DATABASE_URL };
  loadFirebaseMenu();
})();
