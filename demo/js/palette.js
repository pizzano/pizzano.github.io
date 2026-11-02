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
export const PALETTE_DETAIL_ROLES = [
  { id:'button', label:'Alle hovedknapper', note:'Samme farge på Legg til, Neste, Lagre og andre handlingsknapper' },
  { id:'buttonText', label:'Tekst på knapper', note:'Felles tekstfarge på hovedknapper' },
  { id:'selected', label:'Valgte alternativer', note:'Bakgrunn på avkryssede valg og aktiv hentetid' },
  { id:'field', label:'Inputfelt', note:'Bakgrunn i telefon-, e-post- og kommentarfelt' },
  { id:'header', label:'Toppfelt', note:'Menyens toppområde og navigasjon' },
  { id:'muted', label:'Sekundærtekst', note:'Beskrivelser og små hjelpetekster' }
];
const PALETTE_DETAIL_IDS = new Set(PALETTE_DETAIL_ROLES.map(role => role.id));
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Compact HEX helpers used only to calculate optional defaults and contrast. */
function blendHex(first, second, weight) {
  const a=first.match(/[0-9a-f]{2}/gi).map(part=>parseInt(part,16));
  const b=second.match(/[0-9a-f]{2}/gi).map(part=>parseInt(part,16));
  return '#'+a.map((v,i)=>Math.round(v*weight+b[i]*(1-weight)).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function contrastText(background) {
  const hex=background.slice(1);
  const values=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(v=>v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  const l=.2126*values[0]+.7152*values[1]+.0722*values[2];
  return (l+.05)/.05 >= 1.05/(l+.05) ? '#000000' : '#FFFFFF';
}
/** Effective details. Unchecked overrides inherit the base palette. */
export function resolvePaletteDetails(palette, mode) {
  const colors=palette[mode];
  const [accent,,surface,ink]=colors;
  const base={
    button:accent,
    buttonText:contrastText(accent),
    selected:blendHex(accent,surface,mode==='dark'?.24:.13),
    field:surface,
    header:mode==='dark'?palette.dark[1]:palette.light[3],
    muted:blendHex(ink,surface,.74)
  };
  const overrides=palette.advanced?.[mode]||{};
  for(const id of PALETTE_DETAIL_IDS) {
    if(typeof overrides[id]==='string'&&COLOR_PATTERN.test(overrides[id]))base[id]=overrides[id].toUpperCase();
  }
  return base;
}

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
  const advanced={};
  for(const mode of ['light','dark']) {
    advanced[mode]={};
    const colors=base.advanced?.[mode];
    if(colors && typeof colors==='object' && !Array.isArray(colors)) {
      for(const id of PALETTE_DETAIL_IDS) {
        if(typeof colors[id]==='string' && COLOR_PATTERN.test(colors[id])) {
          advanced[mode][id]=colors[id].toUpperCase();
        }
      }
    }
  }
  return {
    label: typeof base.label === 'string'
      ? (base.label.trim().slice(0, 48) || 'Mitt tema')
      : 'Mitt tema',
    light: safeColors('light'),
    dark: safeColors('dark'),
    advanced
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
  const details=resolvePaletteDetails(palette,dark?'dark':'light');
  root.dataset.customerPalette = key;
  const values = {
    accent, bg, surface, ink, border,
    paper: surface, light: palette.light[2],
    deep: dark ? palette.dark[1] : palette.light[3],
    muted: `color-mix(in srgb, ${ink} 74%, ${surface})`,
    soft: `color-mix(in srgb, ${accent} ${dark ? 16 : 9}%, ${surface})`,
    'on-accent': dark ? palette.dark[1] : '#FFFFFF',
    success, warning,
    button:details.button,
    'button-text':details.buttonText,
    'selection-bg':details.selected,
    'input-bg':details.field,
    'header-bg':details.header,
    'secondary-text':details.muted,
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
