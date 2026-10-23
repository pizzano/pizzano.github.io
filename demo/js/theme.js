(() => {
  'use strict';

  const PROFILE_KEY = 'bestill_profile_v2';
  const LEGACY_THEME_KEY = 'kol_theme_v1';
  const root = document.documentElement;

  function normalizeTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function readProfile() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed : {};
    } catch { return {}; }
  }

  function readTheme() {
    const profile = readProfile();
    try {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      const migrated = profile.theme || legacy;
      if (legacy !== null) {
        // Retire the old fifth key only after the merged profile is saved.
        if (legacy === 'dark' || legacy === 'light') {
          localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, theme: normalizeTheme(migrated) }));
        }
        localStorage.removeItem(LEGACY_THEME_KEY);
      }
      return normalizeTheme(migrated);
    } catch { return normalizeTheme(profile.theme); }
  }

  function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'dark' ? '#17110e' : '#33251f');
  }

  function updateButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const dark = theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Bytt til lys modus' : 'Bytt til mørk modus');
      button.setAttribute('title', dark ? 'Lys modus' : 'Mørk modus');
    });
  }

  function applyTheme(value, { persist = true } = {}) {
    const theme = normalizeTheme(value);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    updateThemeColor(theme);
    updateButtons(theme);

    if (persist) {
      try {
        // Read the current profile first: never overwrite the customer's
        // name, contact details, order-notice flags or favorites.
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readProfile(), theme }));
      } catch {
        // Theme still works for the current page when storage is unavailable.
      }
    }

    document.dispatchEvent(new CustomEvent('kolthemechange', { detail: { theme } }));
    return theme;
  }

  function toggleTheme() {
    return applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  applyTheme(readTheme(), { persist: false });

  document.addEventListener('DOMContentLoaded', () => {
    updateButtons(root.dataset.theme || 'light');
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    event.preventDefault();
    toggleTheme();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== PROFILE_KEY || !event.newValue) return;
    try {
      const profile = JSON.parse(event.newValue);
      if (profile?.theme && profile.theme !== root.dataset.theme)
        applyTheme(profile.theme, { persist: false });
    } catch { /* ignore incomplete or invalid cross-tab storage changes */ }
  });

  window.KolTheme = {
    get: () => root.dataset.theme || 'light',
    set: (theme) => applyTheme(theme),
    toggle: toggleTheme,
  };
})();
