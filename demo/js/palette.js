/** Restaurant themes: seven roles: accent, page, surface, text, border, confirmation and removal/warning. */
const theme = (label, light, dark) => ({ label, colors: light, light, dark });
export const CUSTOMER_PALETTES = {
  reference: theme('2. Moderne Blå', ['#0752A2','#F6F8FC','#FFFFFF','#17253B','#CCD9ED','#0752A2','#9F3B24'], ['#75B6FF','#101928','#1A2B42','#F2F7FF','#405A76','#80C6FF','#EDB38E']),
  lively: theme('4. Varm & Matvennlig', ['#B23608','#FCF8F4','#FFFFFF','#321E17','#F1D6C5','#B23608','#8B460F'], ['#FFAB79','#241713','#39241B','#FFF3EA','#80513B','#FFD0A2','#E3B58F']),
  fresh: theme('1. Klassisk Grønn', ['#075629','#F5FAF6','#FFFFFF','#152D20','#C8E1CD','#075629','#A24B29'], ['#85DAAC','#101E16','#1E3325','#F0FFF4','#3D6E4C','#9AEBB6','#E7BD98']),
  gourmet: theme('3. Elegant Lilla', ['#65228B','#FAF7FC','#FFFFFF','#2D1A35','#E0CEE9','#65228B','#954A70'], ['#CF9BED','#201527','#31213B','#FBF1FF','#715083','#DEADEB','#E5B0CB']),
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
