from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache bust only.
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v23', html, count=1)

# Put the category rail physically inside the fixed header.
pattern = re.compile(r'<header class="appbar">\n(?P<top>.*?)\n</header>\n\n(?P<nav><nav class="category-tabs-wrap".*?</nav>)', re.S)
match = pattern.search(html)
if not match:
    raise SystemExit('Header/category structure not found')
top = match.group('top')
nav = match.group('nav')
new_header = '<header class="appbar">\n  <div class="appbar-main">\n' + '\n'.join('  ' + line for line in top.splitlines()) + '\n  </div>\n  ' + nav.replace('\n', '\n  ') + '\n</header>'
html = html[:match.start()] + new_header + html[match.end():]

# Core CSS only: replace existing rules, do not append a version patch block.
def replace_rule(selector, declarations):
    global css
    pattern = re.escape(selector) + r'\{[^{}]*\}'
    replacement = selector + '{' + declarations + '}'
    css, count = re.subn(pattern, replacement, css, count=1)
    if count != 1:
        raise SystemExit(f'Expected one rule for {selector}, found {count}')

replace_rule(
    'body.kol-customer .appbar',
    'position:fixed!important;z-index:5000!important;top:0!important;left:50%!important;right:auto!important;width:min(100vw,var(--app))!important;max-width:var(--app)!important;height:calc(var(--head) + var(--tabs))!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:0!important;overflow:visible!important;border:0!important;background:var(--o)!important;box-shadow:none!important;transform:translateX(-50%)!important'
)

# Add/replace the real top row inside the fixed header.
appbar_main_rule = 'body.kol-customer .appbar-main{position:relative!important;flex:0 0 var(--head)!important;width:100%!important;height:var(--head)!important;min-height:var(--head)!important;margin:0!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;background:var(--o)!important}'
if 'body.kol-customer .appbar-main{' in css:
    css = re.sub(r'body\.kol-customer \.appbar-main\{[^{}]*\}', appbar_main_rule, css, count=1)
else:
    anchor = 'body.kol-customer .appbar-brand{'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('appbar-brand rule not found')
    css = css[:pos] + appbar_main_rule + '\n' + css[pos:]

replace_rule(
    'body.kol-customer .category-tabs-wrap',
    'position:relative!important;z-index:1!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;flex:0 0 var(--tabs)!important;width:100%!important;max-width:none!important;height:var(--tabs)!important;margin:0!important;padding:0!important;overflow:hidden!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important;transform:none!important'
)
replace_rule(
    'body.kol-customer .menu-shell',
    'position:fixed!important;z-index:1!important;top:calc(var(--head) + var(--tabs))!important;bottom:0!important;left:50%!important;right:auto!important;width:min(100vw,var(--app))!important;max-width:var(--app)!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 0 28px!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;transform:translateX(-50%)!important'
)

# When categories are intentionally hidden (cart/profile/info/live), shrink header to top row only.
state_rule = 'body.kol-customer.cart-open .appbar,body.kol-customer.profile-open .appbar,body.kol-customer.info-open .appbar,body.kol-customer.order-live-open .appbar{height:var(--head)!important}'
if state_rule not in css:
    anchor = 'body.kol-customer.cart-open .category-tabs-wrap,body.kol-customer.profile-open .category-tabs-wrap,body.kol-customer.info-open .category-tabs-wrap,body.kol-customer.order-live-open .category-tabs-wrap{display:none!important}'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('category hidden state rule not found')
    pos += len(anchor)
    css = css[:pos] + '\n' + state_rule + css[pos:]

# Product is always below the combined fixed header.
replace_rule(
    'body.kol-customer .product-modal.mobile-screen',
    'top:calc(var(--head) + var(--tabs))!important;height:calc(100dvh - var(--head) - var(--tabs))!important'
)

# Remove obsolete experimental category positioning helpers/comments if any survived.
css = re.sub(r'\n?/\* MOBILE V(?:18|19|20|21|22):.*?(?=/\*|\Z)', '\n', css, flags=re.S)

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

print('v23 header-contained categories applied')
print('nav inside header:', '<div class="appbar-main">' in html and html.find('category-tabs-wrap') < html.find('</header>'))
print('category core rules:', css.count('body.kol-customer .category-tabs-wrap{'))
