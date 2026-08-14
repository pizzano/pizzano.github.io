from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

html = index_path.read_text(encoding='utf-8')
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v21', html, count=1)
index_path.write_text(html, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')

# Remove the temporary V20 override block completely. We now edit the real
# mobile rules instead of stacking another layout patch on top.
marker = '/* MOBILE V20: stable header + category rail + one menu scroller */'
start = css.find(marker)
if start != -1:
    end = css.rfind('\n}')
    if end == -1 or end <= start:
        raise SystemExit('Could not locate @layer closing brace')
    css = css[:start] + css[end:]

# Replace one-line core rules in the main mobile layer.
def replace_rule(selector, declarations):
    global css
    pattern = re.escape(selector) + r'\{[^{}]*\}'
    repl = selector + '{' + declarations + '}'
    css, count = re.subn(pattern, repl, css, count=1)
    if count != 1:
        raise SystemExit(f'Could not replace rule: {selector} ({count})')

replace_rule(
    'body.kol-customer',
    'width:min(100%,var(--app))!important;max-width:var(--app)!important;min-width:0!important;height:100dvh!important;min-height:100dvh!important;margin:0 auto!important;overflow:hidden!important;background:var(--surface)!important;color:var(--text)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important;font-size:14.5px!important;font-weight:400!important;line-height:1.42!important;-webkit-font-smoothing:antialiased!important;text-rendering:optimizeLegibility!important;box-shadow:0 0 20px rgba(25,20,17,.06)!important'
)
replace_rule(
    'body.kol-customer .customer-app',
    'display:flex!important;flex-direction:column!important;width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important'
)
replace_rule(
    'body.kol-customer .appbar',
    'position:relative!important;z-index:5000!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;flex:0 0 var(--head)!important;width:100%!important;max-width:none!important;height:var(--head)!important;margin:0!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;border:0!important;background:var(--o)!important;box-shadow:none!important;transform:none!important'
)
replace_rule(
    'body.kol-customer .category-tabs-wrap',
    'position:relative!important;z-index:4500!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;flex:0 0 var(--tabs)!important;width:100%!important;max-width:none!important;height:var(--tabs)!important;margin:0!important;padding:0!important;overflow:hidden!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important;transform:none!important'
)
replace_rule(
    'body.kol-customer .category-tabs-scroll',
    'width:100%!important;height:100%!important;display:flex!important;align-items:stretch!important;gap:0!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0!important;white-space:nowrap!important;scrollbar-width:none!important;-ms-overflow-style:none!important'
)
replace_rule(
    'body.kol-customer .menu-shell',
    'position:relative!important;inset:auto!important;top:auto!important;flex:1 1 auto!important;width:100%!important;max-width:100%!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 0 28px!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;background:#fff!important'
)

# Hide only the horizontal category scrollbar; the vertical menu scrollbar stays.
scrollbar_rule = '''\nbody.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}\n'''
if 'body.kol-customer .category-tabs-scroll::-webkit-scrollbar' not in css:
    anchor = 'body.kol-customer .category-tab,body.kol-customer [data-category-tab]'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('Could not place category scrollbar rule')
    css = css[:pos] + scrollbar_rule + css[pos:]
else:
    css = re.sub(r'body\.kol-customer \.category-tabs-scroll::\-webkit-scrollbar\{[^{}]*\}', 'body.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}', css, count=1)

# Product detail must never hide the category rail. :has() reflects the actual
# modal state and avoids relying on old body-state classes.
product_visibility = '''\nbody.kol-customer:has(#productModal:not([hidden])) .category-tabs-wrap{display:block!important;flex:0 0 var(--tabs)!important}\n'''
if ':has(#productModal:not([hidden])) .category-tabs-wrap' not in css:
    anchor = 'body.kol-customer.kol-product-detail-open .category-tabs-wrap{display:block!important}'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('Could not place product category visibility rule')
    pos += len(anchor)
    css = css[:pos] + product_visibility + css[pos:]

# Remove duplicate experimental menu-shell scroll-listener registration if it
# survived older patches. One menu-shell listener is enough.
html = index_path.read_text(encoding='utf-8')
html = re.sub(
    r'const kolMenuScroll = document\.querySelector\("\.menu-shell"\);\s*kolMenuScroll\?\.addEventListener\("scroll", requestCategoryScrollSync, \{ passive: true \}\);\s*window\.addEventListener\("scroll", requestCategoryScrollSync, \{ passive: true \}\);',
    'const kolMenuScroll = document.querySelector(".menu-shell");\nkolMenuScroll?.addEventListener("scroll", requestCategoryScrollSync, { passive: true });',
    html,
    count=1
)
index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

print('mobile-v21 cleanup applied')
print('V20 marker remaining:', marker in css)
print('CSS bytes:', len(css.encode('utf-8')))
