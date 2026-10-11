/** Restaurant themes: seven roles: accent, page, surface, text, border, confirmation and removal/warning. */
const theme = (label, light, dark) => ({ label, colors: light, light, dark });
export const CUSTOMER_PALETTES = {
  reference: theme('Modern café · varm oransje', ['#BE570C','#F7F8FA','#FFFFFF','#24272C','#D8DDE3','#276B65','#765181'], ['#FFAD66','#15181D','#20252D','#F3F5F7','#444C58','#82D3C4','#D6B5E5']),
  lively: theme('Bistro · terrakotta og sand', ['#AE402D','#FAF4ED','#FFFCF8','#352821','#CDBBAE','#31675D','#80521B'], ['#F5A08A','#201917','#302420','#FAF0E7','#675148','#91CEBE','#E9C283']),
  fresh: theme('Hage · salvie og oliven', ['#416747','#F4F6EF','#FEFFF9','#28352A','#BDCCB6','#246B70','#81543B'], ['#ABD19B','#181E17','#263025','#F0F5E9','#52664C','#8ED0D5','#E8B899']),
  gourmet: theme('Gourmet · burgunder og krem', ['#833B50','#FAF5EE','#FFFCF7','#382831','#CCBCAF','#496940','#7B5C21'], ['#EAA1B5','#21191D','#30242A','#FAF0EB','#67535C','#AFD29E','#E4C680']),
};
export function applyCustomerPalette(value) {
  const key = Object.hasOwn(CUSTOMER_PALETTES, value) ? value : 'reference';
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  const palette = CUSTOMER_PALETTES[key];
  const [accent, bg, surface, ink, border, success, warning] = dark ? palette.dark : palette.light;
  root.dataset.customerPalette = key;
  const values = {accent, bg, surface, ink, border, paper: surface, light: palette.light[2], deep: palette.dark[0] === accent ? palette.dark[1] : palette.light[3],
    muted: `color-mix(in srgb, ${ink} 74%, ${surface})`,
    soft: `color-mix(in srgb, ${accent} ${dark ? 16 : 9}%, ${surface})`,
    'on-accent': dark ? palette.dark[1] : '#FFFFFF',
    success, warning,
    'success-soft': `color-mix(in srgb, ${success} ${dark ? 18 : 10}%, ${surface})`,
    'warning-soft': `color-mix(in srgb, ${warning} ${dark ? 18 : 10}%, ${surface})`,
    'removed-soft': `color-mix(in srgb, ${warning} ${dark ? 22 : 12}%, ${surface})`,
    danger: dark ? '#FFACA4' : '#B9342B',
    'danger-soft': `color-mix(in srgb, ${dark ? '#FFACA4' : '#B9342B'} ${dark ? 18 : 10}%, ${surface})`};
  for (const [name, color] of Object.entries(values)) root.style.setProperty(`--palette-${name}`, color);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
}
