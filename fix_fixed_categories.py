from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache version only; no extra CSS patch block is appended.
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v22', html, count=1)


def replace_rule(selector, declarations):
    global css
    pattern = re.escape(selector) + r'\{[^{}]*\}'
    replacement = selector + '{' + declarations + '}'
    css, count = re.subn(pattern, replacement, css, count=1)
    if count != 1:
        raise SystemExit(f'Expected one core rule for {selector}, found {count}')

# One viewport, three stable layers:
# 1) fixed header, 2) fixed horizontal categories, 3) scrollable content below.
replace_rule(
    'body.kol-customer',
    'width:min(100%,var(--app))!important;max-width:var(--app)!important;min-width:0!important;height:100dvh!important;min-height:100dvh!important;margin:0 auto!important;overflow:hidden!important;background:var(--surface)!important;color:var(--text)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important;font-size:14.5px!important;font-weight:400!important;line-height:1.42!important;-webkit-font-smoothing:antialiased!important;text-rendering:optimizeLegibility!important;box-shadow:0 0 20px rgba(25,20,17,.06)!important'
)
replace_rule(
    'body.kol-customer .customer-app',
    'width:100%!important;height:100dvh!important;min-height:100dvh!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important'
)
replace_rule(
    'body.kol-customer .appbar',
    'position:fixed!important;z-index:5000!important;top:0!important;left:50%!important;right:auto!important;width:min(100vw,var(--app))!important;max-width:var(--app)!important;height:var(--head)!important;margin:0!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;border:0!important;background:var(--o)!important;box-shadow:none!important;transform:translateX(-50%)!important'
)
replace_rule(
    'body.kol-customer .category-tabs-wrap',
    'position:fixed!important;z-index:4900!important;top:var(--head)!important;left:50%!important;right:auto!important;width:min(100vw,var(--app))!important;max-width:var(--app)!important;height:var(--tabs)!important;margin:0!important;padding:0!important;overflow:hidden!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important;transform:translateX(-50%)!important'
)
replace_rule(
    'body.kol-customer .category-tabs-scroll',
    'width:100%!important;height:100%!important;display:flex!important;align-items:stretch!important;gap:0!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0!important;white-space:nowrap!important;scrollbar-width:none!important;-ms-overflow-style:none!important'
)
replace_rule(
    'body.kol-customer .menu-shell',
    'position:fixed!important;z-index:1!important;top:calc(var(--head) + var(--tabs))!important;bottom:0!important;left:50%!important;right:auto!important;width:min(100vw,var(--app))!important;max-width:var(--app)!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 0 28px!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;transform:translateX(-50%)!important'
)

# Horizontal category scrollbar stays usable but invisible.
webkit_rule = 'body.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}'
css, n = re.subn(r'body\.kol-customer \.category-tabs-scroll::\-webkit-scrollbar\{[^{}]*\}', webkit_rule, css, count=1)
if n == 0:
    anchor = 'body.kol-customer .category-tab,body.kol-customer [data-category-tab]'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('Could not place hidden category scrollbar rule')
    css = css[:pos] + webkit_rule + '\n' + css[pos:]

# The product already starts below header+categories. Category visibility is
# controlled by syncCategoryTabsVisibility; remove the experimental :has override.
css = re.sub(
    r'\s*body\.kol-customer:has\(#productModal:not\(\[hidden\]\)\) \.category-tabs-wrap\{[^{}]*\}',
    '',
    css
)

# Product opening does not need to freeze BODY anymore because both the menu and
# the product have their own scroll containers. Avoid inline body top/position
# changes that can disturb fixed header/category geometry.
old_lock = 'setPageScrollLocked(productOpen || infoOpen || cartOpen || profileOpen || liveOpen);'
new_lock = 'setPageScrollLocked(infoOpen || cartOpen || profileOpen || liveOpen);'
if old_lock in html:
    html = html.replace(old_lock, new_lock, 1)
elif new_lock not in html:
    raise SystemExit('Could not locate body lock expression')

# Remove obsolete sticky-offset helper; fixed categories no longer use it.
html = re.sub(
    r'\nfunction updateCategoryTabsOffset\(\) \{.*?\n\}\n',
    '\n',
    html,
    count=1,
    flags=re.S
)
html = html.replace('''\n  window.requestAnimationFrame(() => {\n    updateCategoryTabsOffset?.();\n  });\n''', '\n')

# Category sync must listen only to the actual menu scroller.
html = re.sub(
    r'const kolMenuScroll = document\.querySelector\("\.menu-shell"\);\s*kolMenuScroll\?\.addEventListener\("scroll", requestCategoryScrollSync, \{ passive: true \}\);(?:\s*window\.addEventListener\("scroll", requestCategoryScrollSync, \{ passive: true \}\);)?',
    'const kolMenuScroll = document.querySelector(".menu-shell");\nkolMenuScroll?.addEventListener("scroll", requestCategoryScrollSync, { passive: true });',
    html,
    count=1
)

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

print('mobile-v22 fixed-category cleanup applied')
print('CSS category core rules:', css.count('body.kol-customer .category-tabs-wrap{'))
print('CSS menu core rules:', css.count('body.kol-customer .menu-shell{'))
print('Experimental :has remains:', ':has(#productModal:not([hidden])) .category-tabs-wrap' in css)
