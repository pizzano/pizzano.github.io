(() => {
  'use strict';

  const STORAGE_KEY = 'kol_theme_v1';
  const root = document.documentElement;

  function normalizeTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function readTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'light';
    }
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
        localStorage.setItem(STORAGE_KEY, theme);
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
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    applyTheme(event.newValue, { persist: false });
  });

  window.KolTheme = {
    get: () => root.dataset.theme || 'light',
    set: (theme) => applyTheme(theme),
    toggle: toggleTheme,
  };
})();
