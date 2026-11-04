/** Customer palette roles: main, background, card, text, border, confirmation, Uten / varsel. */
const theme = (label, light, dark, advanced = {}) => ({ label, colors:light, light, dark, advanced });
/* Five restaurant palettes, including an opt-in emerald and champagne-gold theme.
   restrained card borders, separate selection, and accessible CTA contrast.
   The existing stable palette IDs preserve Firebase selections. */
export const CUSTOMER_PALETTES = {
  reference: theme('1. Midnatt Blå',
    ['#2768BF','#F5F7FC','#FFFFFF','#17243B','#D1DBEB','#168668','#A75B39'],
    ['#6CB5FF','#0D1423','#1B2941','#F5F7FD','#405473','#5DD6B1','#F1AB78'],
    { light:{button:'#2367CC',buttonText:'#FFFFFF',selected:'#DFEAFB',field:'#F8FAFF',header:'#17263F',muted:'#64748B'},
      dark:{button:'#2478E8',buttonText:'#FFFFFF',selected:'#193C67',field:'#263753',header:'#111B30',muted:'#BFCBDD'} }),
  lively: theme('2. Obsidian Kobber',
    ['#9B5831','#FAF7F3','#FFFFFF','#2C2420','#E2D3C6','#23856B','#A35C37'],
    ['#EFA46D','#12110F','#282521','#F8F0E6','#655247','#5DD2A3','#F1B080'],
    { light:{button:'#A75D31',buttonText:'#FFFFFF',selected:'#F4DFCC',field:'#FFFCF7',header:'#29201C',muted:'#74675D'},
      dark:{button:'#AA5A2A',buttonText:'#FFFFFF',selected:'#503522',field:'#35312E',header:'#181613',muted:'#C6B6A9'} }),
  gourmet: theme('3. Skifer Orkidé',
    ['#8058BB','#F8F6FC','#FFFFFF','#292139','#DED3EE','#26856C','#A2606A'],
    ['#C59BFA','#141321','#2A243A','#F7F2FC','#615475','#71D7B8','#E9A6BA'],
    { light:{button:'#7950B3',buttonText:'#FFFFFF',selected:'#EEE1FA',field:'#FCFAFF',header:'#27213A',muted:'#776C86'},
      dark:{button:'#8653C9',buttonText:'#FFFFFF',selected:'#44305F',field:'#352D46',header:'#191525',muted:'#C8BED5'} }),
  fresh: theme('4. Grafitt Smaragd',
    ['#14795D','#F4F9F7','#FFFFFF','#142D29','#C6DFD5','#14795D','#A76442'],
    ['#65E5B7','#0B1B19','#16302A','#F1F9F5','#365D52','#69D9B0','#E9B68C'],
    { light:{button:'#087A5C',buttonText:'#FFFFFF',selected:'#D9F2E8',field:'#FAFDFB',header:'#15352C',muted:'#5B776E'},
      dark:{button:'#058861',buttonText:'#FFFFFF',selected:'#074E39',field:'#203F37',header:'#10251F',muted:'#B8D3C8'} }),
  emeraldGold: theme('5. Premium Emerald & Gold',
    ['#AC822C','#F5F7F1','#FFFFFF','#172B24','#CFDACF','#147A5A','#9A563D'],
    ['#F3D477','#062D25','#123B32','#F7F8F3','#45695A','#71D9B4','#F1B18F'],
    { light:{button:'#D9B661',buttonText:'#1B2922',selected:'#F1E8CB',field:'#FFFFFF',header:'#123B32',muted:'#61756B'},
      dark:{button:'#F3D477',buttonText:'#172820',selected:'#405339',field:'#103A30',header:'#05251F',muted:'#CED8D2'} })
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
  // If the shared button color is customized, adapt its text contrast automatically
  // unless the user explicitly selected a separate button-text color.
  if (!overrides.buttonText && overrides.button) {
    base.buttonText=contrastText(base.button);
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
    muted: details.muted,
    soft: `color-mix(in srgb, ${accent} ${dark ? 16 : 9}%, ${surface})`,
    'on-accent': contrastText(accent),
    'header-text': contrastText(details.header),
    'action-soft': blendHex(details.button, surface, dark ? .19 : .09),
    success, warning,
    'success-text': contrastText(success),
    'danger-text': contrastText(dark ? '#FFACA4' : '#B9342B'),
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
