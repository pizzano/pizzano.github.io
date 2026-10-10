/** Three-color customer palettes, shared with the admin selector. */
export const CUSTOMER_PALETTES = {
  reference: { label: 'Modern · bildet', colors: ['#FF9340', '#F7F9FC', '#212226'] },
  lively: { label: 'Livlig og appetittvekkende', colors: ['#FF4A22', '#FAFAF5', '#2B2523'] },
  fresh: { label: 'Friskt og økologisk', colors: ['#3B7A57', '#F4F7F5', '#1E2922'] },
  gourmet: { label: 'Gourmet og varmt', colors: ['#D97706', '#FFFDF9', '#37251B'] },
};
export function applyCustomerPalette(value) {
  const key = Object.hasOwn(CUSTOMER_PALETTES, value) ? value : 'reference';
  const [accent, paper, ink] = CUSTOMER_PALETTES[key].colors;
  const root = document.documentElement;
  root.dataset.customerPalette = key;
  root.style.setProperty('--palette-accent', accent);
  root.style.setProperty('--palette-light', paper);
  root.style.setProperty('--palette-dark', ink);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = root.dataset.theme === 'dark' ? ink : paper;
}
