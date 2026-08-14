from pathlib import Path
import re

css_path = Path('test/kol-core.css')
index_path = Path('test/index.html')
css = css_path.read_text(encoding='utf-8')
html = index_path.read_text(encoding='utf-8')

def replace_rule(selector, declarations):
    global css
    pattern = re.escape(selector) + r'\{[^{}]*\}'
    replacement = selector + '{' + declarations + '}'
    css, n = re.subn(pattern, replacement, css, count=1)
    if n != 1:
        raise SystemExit(f'Could not replace {selector}: {n}')

# CSS-only fixed layout: header and category are independent fixed layers.
replace_rule('body.kol-customer .appbar',
    'position:fixed!important;z-index:5000!important;top:0!important;left:50%!important;right:auto!important;width:min(100vw,480px)!important;max-width:480px!important;height:76px!important;min-height:76px!important;margin:0!important;padding:0!important;display:block!important;overflow:visible!important;border:0!important;background:var(--o)!important;box-shadow:none!important;transform:translateX(-50%)!important')

replace_rule('body.kol-customer .appbar-main',
    'position:relative!important;width:100%!important;height:76px!important;min-height:76px!important;margin:0!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;background:var(--o)!important')

replace_rule('body.kol-customer .category-tabs-wrap',
    'position:fixed!important;z-index:5100!important;top:76px!important;left:50%!important;right:auto!important;width:min(100vw,480px)!important;max-width:480px!important;height:48px!important;min-height:48px!important;margin:0!important;padding:0!important;display:block!important;visibility:visible!important;opacity:1!important;overflow:hidden!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important;transform:translateX(-50%)!important')

replace_rule('body.kol-customer .menu-shell',
    'position:fixed!important;z-index:1!important;top:124px!important;bottom:0!important;left:50%!important;right:auto!important;width:min(100vw,480px)!important;max-width:480px!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 0 28px!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;transform:translateX(-50%)!important')

replace_rule('body.kol-customer .product-modal.mobile-screen',
    'top:124px!important;height:calc(100dvh - 124px)!important')

# Remove the now-unnecessary appbar height overrides for overlay states.
css = re.sub(
    r'body\.kol-customer\.cart-open \.appbar,body\.kol-customer\.profile-open \.appbar,body\.kol-customer\.info-open \.appbar,body\.kol-customer\.order-live-open \.appbar\{[^{}]*\}\n?',
    '', css, count=1
)

# A leftover hidden attribute must never hide categories on menu/product screens.
hidden_override = 'body.kol-customer:not(.cart-open):not(.profile-open):not(.info-open):not(.order-live-open):not(.settings-open) .category-tabs-wrap[hidden]{display:block!important;visibility:visible!important;opacity:1!important}\n'
if hidden_override not in css:
    anchor = 'body.kol-customer.cart-open .category-tabs-wrap,body.kol-customer.profile-open .category-tabs-wrap,body.kol-customer.info-open .category-tabs-wrap,body.kol-customer.order-live-open .category-tabs-wrap'
    pos = css.find(anchor)
    if pos == -1:
        raise SystemExit('overlay category rule anchor missing')
    css = css[:pos] + hidden_override + css[pos:]

# Overlay screens keep the category hidden, using CSS only.
overlay_pattern = r'body\.kol-customer\.cart-open \.category-tabs-wrap,body\.kol-customer\.profile-open \.category-tabs-wrap,body\.kol-customer\.info-open \.category-tabs-wrap,body\.kol-customer\.order-live-open \.category-tabs-wrap\{[^{}]*\}'
overlay_repl = 'body.kol-customer.cart-open .category-tabs-wrap,body.kol-customer.profile-open .category-tabs-wrap,body.kol-customer.info-open .category-tabs-wrap,body.kol-customer.order-live-open .category-tabs-wrap{display:none!important;visibility:hidden!important}'
css, n = re.subn(overlay_pattern, overlay_repl, css, count=1)
if n != 1:
    raise SystemExit('overlay category rule replacement failed')

# Keep category rail scrollable horizontally but without a visible scrollbar.
replace_rule('body.kol-customer .category-tabs-scroll',
    'width:100%!important;height:48px!important;display:flex!important;align-items:stretch!important;gap:0!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0!important;white-space:nowrap!important;scrollbar-width:none!important;-ms-overflow-style:none!important;-webkit-overflow-scrolling:touch!important')

# Cache-bust only. No JS behavior change.
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v25', html, count=1)

css_path.write_text(css, encoding='utf-8')
index_path.write_text(html, encoding='utf-8')
print('CSS-only fixed category layout applied')
