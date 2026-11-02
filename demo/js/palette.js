/** Customer palette roles: main, background, card, text, border, confirmation, Uten / varsel. */
const theme = (label, light, dark) => ({ label, colors: light, light, dark });
export const CUSTOMER_PALETTES = {
  reference: theme('2. Moderne Blå', ['#0752A2','#F6F8FC','#FFFFFF','#17253B','#CCD9ED','#0752A2','#9F3B24'], ['#75B6FF','#101928','#1A2B42','#F2F7FF','#405A76','#80C6FF','#EDB38E']),
  lively: theme('4. Varm & Matvennlig', ['#B23608','#FCF8F4','#FFFFFF','#321E17','#F1D6C5','#B23608','#8B460F'], ['#FFAB79','#241713','#39241B','#FFF3EA','#80513B','#FFD0A2','#E3B58F']),
  fresh: theme('1. Klassisk Grønn', ['#075629','#F5FAF6','#FFFFFF','#152D20','#C8E1CD','#075629','#A24B29'], ['#85DAAC','#101E16','#1E3325','#F0FFF4','#3D6E4C','#9AEBB6','#E7BD98']),
  gourmet: theme('3. Elegant Lilla', ['#65228B','#FAF7FC','#FFFFFF','#2D1A35','#E0CEE9','#65228B','#954A70'], ['#CF9BED','#201527','#31213B','#FBF1FF','#715083','#DEADEB','#E5B0CB']),
};

export const PALETTE_COLOR_LABELS = [
  'Hovedfarge', 'Bakgrunn', 'Kort', 'Tekst', 'Kantlinje', 'Bekreftelse', 'Uten / varsel'
];
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_CUSTOM = CUSTOMER_PALETTES.fresh;

/**
 * Custom theme is stored as one compact JSON STRING in settings.customCustomerPalette.
 * Settings normalization only accepts primitive fields, so a JSON string keeps the
 * existing Firebase and export/import paths backward compatible.
 * Invalid/older values are harmlessly replaced with safe color defaults.
 */
export function normalizeCustomPalette(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { value = null; }
  }
  const base = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const safeColors = (mode) => Array.from({length:7}, (_,index) => {
    const candidate = base[mode]?.[index];
    return typeof candidate === 'string' && COLOR_PATTERN.test(candidate)
      ? candidate.toUpperCase() : DEFAULT_CUSTOM[mode][index];
  });
  return {
    label: typeof base.label === 'string'
      ? (base.label.trim().slice(0, 48) || 'Mitt tema')
      : 'Mitt tema',
    light: safeColors('light'),
    dark: safeColors('dark')
  };
}

export function getCustomerPalette(key, customValue) {
  if (key === 'custom') {
    const normalized = normalizeCustomPalette(customValue);
    return { ...normalized, colors: normalized.light };
  }
  return CUSTOMER_PALETTES[key] || CUSTOMER_PALETTES.reference;
}

export function applyCustomerPalette(value, customValue) {
  const key = value === 'custom' || Object.hasOwn(CUSTOMER_PALETTES, value)
    ? value : 'reference';
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  const palette = getCustomerPalette(key, customValue);
  const [accent, bg, surface, ink, border, success, warning] = dark ? palette.dark : palette.light;
  root.dataset.customerPalette = key;
  const values = {
    accent, bg, surface, ink, border,
    paper: surface, light: palette.light[2],
    deep: dark ? palette.dark[1] : palette.light[3],
    muted: `color-mix(in srgb, ${ink} 74%, ${surface})`,
    soft: `color-mix(in srgb, ${accent} ${dark ? 16 : 9}%, ${surface})`,
    'on-accent': dark ? palette.dark[1] : '#FFFFFF',
    success, warning,
    'success-soft': `color-mix(in srgb, ${success} ${dark ? 18 : 10}%, ${surface})`,
    'warning-soft': `color-mix(in srgb, ${warning} ${dark ? 18 : 10}%, ${surface})`,
    'removed-soft': `color-mix(in srgb, ${warning} ${dark ? 22 : 12}%, ${surface})`,
    danger: dark ? '#FFACA4' : '#B9342B',
    'danger-soft': `color-mix(in srgb, ${dark ? '#FFACA4' : '#B9342B'} ${dark ? 18 : 10}%, ${surface})`
  };
  for (const [name, color] of Object.entries(values)) {
    root.style.setProperty(`--palette-${name}`, color);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
}
