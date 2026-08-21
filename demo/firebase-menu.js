/* KØL Firebase menu loader — Firebase is the only menu source */
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
    const semanticType = normalizeText(group.semanticType);
    if (['spice', 'styrke', 'strength'].includes(semanticType)) return true;
    const title = normalizeText(group.title);
    const labels = asArray(group.options).map(option => normalizeText(option?.label));
    return title.includes('styrke') || title.includes('sterk') || ['mild', 'medium', 'sterk'].every(label => labels.includes(label));
  }

  function adaptForCustomer(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') return rawConfig;
    const config = typeof structuredClone === 'function'
      ? structuredClone(rawConfig)
      : JSON.parse(JSON.stringify(rawConfig));

    config.optionGroups = asArray(config.optionGroups).map(group => (
      looksLikeSpiceGroup(group) ? { ...group, type: 'spice' } : group
    ));

    return config;
  }

  function menuElements() {
    return {
      tabs: document.querySelector('#tabs'),
      menu: document.querySelector('#menuSections'),
      topLine: document.querySelector('#menuShell .menu-topline'),
    };
  }

  function clearMenuUi() {
    const { tabs, menu, topLine } = menuElements();
    if (tabs) tabs.innerHTML = '';
    if (menu) menu.innerHTML = '';
    if (topLine) topLine.hidden = true;
  }

  function renderDatabaseState({ titleNo, titleEn, detailNo = '', detailEn = '' }) {
    const { tabs, menu, topLine } = menuElements();
    if (tabs) tabs.innerHTML = '';
    if (topLine) topLine.hidden = true;
    if (!menu) return;

    menu.innerHTML = `
      <div class="empty-note" style="padding:56px 22px;text-align:center;line-height:1.55">
        <strong style="display:block;color:#302b28;font-size:17px;margin-bottom:6px">${titleNo}</strong>
        <span style="display:block;color:#746b65;font-size:14px">${titleEn}</span>
        ${detailNo ? `<small style="display:block;margin-top:14px;color:#938982">${detailNo}<br>${detailEn}</small>` : ''}
      </div>`;
  }

  function showMenuUi() {
    const { topLine } = menuElements();
    if (topLine) topLine.hidden = false;
  }

  async function loadFirebaseMenu() {
    clearMenuUi();

    try {
      const response = await fetch(`${DATABASE_URL}/.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
      const config = await response.json();

      if (!config || !asArray(config.sections).length) {
        renderDatabaseState({
          titleNo: 'Det finnes ingen data i databasen ennå.',
          titleEn: 'There is no data in the database yet.',
        });
        return false;
      }

      const integration = window.KOLIntegration;
      if (!integration?.applyAdminConfig) throw new Error('KOLIntegration er ikke klar');

      const applied = integration.applyAdminConfig(adaptForCustomer(config));
      if (!applied) {
        renderDatabaseState({
          titleNo: 'Det finnes ingen menydata i databasen ennå.',
          titleEn: 'There is no menu data in the database yet.',
        });
        return false;
      }

      showMenuUi();
      return true;
    } catch (error) {
      console.error('Firebase-meny kunne ikke lastes.', error);
      renderDatabaseState({
        titleNo: 'Kunne ikke koble til databasen.',
        titleEn: 'Could not connect to the database.',
        detailNo: 'Prøv igjen om litt.',
        detailEn: 'Please try again shortly.',
      });
      return false;
    }
  }

  window.KOLFirebaseMenu = { load: loadFirebaseMenu, databaseURL: DATABASE_URL };
  loadFirebaseMenu();
})();
