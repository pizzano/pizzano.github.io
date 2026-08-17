from pathlib import Path
import re

html_path = Path('test/test.html')
core_path = Path('test/kol-core.css')
out_path = Path('test/test.css')

html = html_path.read_text(encoding='utf-8')
core = core_path.read_text(encoding='utf-8')

m = re.search(r'<style>\s*(.*?)\s*</style>', html, flags=re.S)
if not m:
    raise SystemExit('inline style block not found')
inline = m.group(1).strip()

# test.css becomes the single stylesheet used by test.html.
# Keep the existing core stylesheet content intact, then place test-specific
# rules afterwards so they win in the cascade.
combined = core.rstrip() + '\n\n/* ===== test.html specific styles ===== */\n' + inline + '\n\n'

# Explicitly disable the legacy pseudo-chevron. This rule is intentionally
# placed last so it overrides both local and imported legacy rules.
combined += '''/* Remove legacy extra chevron before “Til meny”. */
.kol-customer.kol-top-back-active.kol-product-detail-open .appbar-brand .brand-back-label::before,
.kol-customer.cart-open .appbar-brand .brand-back-label::before{
  content:none!important;
  display:none!important;
}
'''

out_path.write_text(combined, encoding='utf-8')

# Remove old core link and inline style, then point test.html only to test.css.
html = html[:m.start()] + html[m.end():]
html = re.sub(r'<link\s+rel="stylesheet"\s+href="kol-core\.css[^\"]*">', '<link rel="stylesheet" href="test.css?v=20260817-2305">', html, count=1)
if 'href="test.css?v=20260817-2305"' not in html:
    raise SystemExit('test.css link not installed')
if '<style>' in html or '</style>' in html:
    raise SystemExit('inline style remained in test.html')
html_path.write_text(html, encoding='utf-8')
