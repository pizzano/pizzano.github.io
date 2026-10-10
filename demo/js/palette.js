/** Restaurant themes: accent, page, surface, text and border, with semantic feedback. */
const theme = (label, light, dark) => ({ label, colors: light, light, dark });
export const CUSTOMER_PALETTES = {
  reference: theme('Modern café · varm oransje', ['#BE570C','#F7F8FA','#FFFFFF','#24272C','#D8DDE3'], ['#FFAD66','#15181D','#20252D','#F3F5F7','#444C58']),
  lively: theme('Bistro · tomatrød', ['#C93D24','#FAF7F3','#FFFFFF','#302522','#DED5CE'], ['#FF927C','#1C1715','#2A211E','#FAF1ED','#574840']),
  fresh: theme('Hage · naturlig grønn', ['#326A4B','#F3F7F3','#FFFFFF','#22352A','#CFDED2'], ['#8BD5A6','#131D17','#1F2C23','#EDF6EF','#415B49']),
  gourmet: theme('Gourmet · karamell og krem', ['#A95B0A','#FAF6EF','#FFFDF8','#35291F','#DDD0BC'], ['#F2BC72','#1D1812','#2B241C','#FAF2E6','#5A4A35']),
};
const feedbackColors = {
  reference: ['#276B65', '#82D3C4'],
  lively: ['#75501C', '#EAC481'],
  fresh: ['#326A4B', '#8BD5A6'],
  gourmet: ['#66528C', '#CDB4EA'],
};
export function applyCustomerPalette(value) {
  const key = Object.hasOwn(CUSTOMER_PALETTES, value) ? value : 'reference';
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  const palette = CUSTOMER_PALETTES[key];
  const [accent, bg, surface, ink, border] = dark ? palette.dark : palette.light;
  root.dataset.customerPalette = key;
  const values = {accent, bg, surface, ink, border, paper: surface, light: palette.light[2], deep: palette.dark[0] === accent ? palette.dark[1] : palette.light[3],
    muted: `color-mix(in srgb, ${ink} 74%, ${surface})`,
    soft: `color-mix(in srgb, ${accent} ${dark ? 16 : 9}%, ${surface})`,
    'on-accent': dark ? palette.dark[1] : '#FFFFFF',
    success: feedbackColors[key][dark ? 1 : 0],
    'success-soft': `color-mix(in srgb, ${feedbackColors[key][dark ? 1 : 0]} ${dark ? 18 : 10}%, ${surface})`,
    'removed-soft': `color-mix(in srgb, ${accent} ${dark ? 22 : 12}%, ${surface})`,
    danger: dark ? '#FFACA4' : '#B9342B'};
  for (const [name, color] of Object.entries(values)) root.style.setProperty(`--palette-${name}`, color);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
}
