from pathlib import Path
import re

css_path = Path('test/kol-core.css')
index_path = Path('test/index.html')
admin_path = Path('test/admin-panel.html')

css = css_path.read_text(encoding='utf-8')
old_marker = '/* CUSTOMER FIXED SIZE LOCK V1 — no viewport-dependent sizing */'
new_marker = '/* CUSTOMER TEXT SIZE LOCK V2 — fixed typography across 760px */'

# Remove the previous lock, which also fixed card/image/button dimensions.
if old_marker in css:
    css = css[:css.index(old_marker)].rstrip()
elif new_marker in css:
    css = css[:css.index(new_marker)].rstrip()

block = r'''

/* CUSTOMER TEXT SIZE LOCK V2 — fixed typography across 760px
   Responsive rules may change layout, spacing, columns and images, but text
   sizes below and above 760px stay identical. */
html,
body.kol-customer {
  -webkit-text-size-adjust: none !important;
  text-size-adjust: none !important;
}
body.kol-customer {
  font-size: 13px !important;
  line-height: 1.35 !important;
}
body.kol-customer button,
body.kol-customer input,
body.kol-customer select,
body.kol-customer textarea {
  font-size: 13px !important;
}
body.kol-customer .brand-label b { font-size: 35px !important; }
body.kol-customer .brand-label small { font-size: 8px !important; }
body.kol-customer .brand-back-label,
body.kol-customer.kol-top-back-active .appbar-brand .brand-back-label,
body.kol-customer.kol-top-back-active.kol-product-detail-open .appbar-brand .brand-back-label,
body.kol-customer.cart-open .appbar-brand .brand-back-label { font-size: 15px !important; }
body.kol-customer .appbar-context-title { font-size: 16px !important; }
body.kol-customer .plain-icon { font-size: 19px !important; }
body.kol-customer #cartCount { font-size: 11px !important; }
body.kol-customer .pickup-badge { font-size: 12px !important; }
body.kol-customer .menu-page-heading h1,
body.kol-customer .menu-page-title { font-size: 31px !important; }
body.kol-customer .menu-app-section-head h2 { font-size: 22px !important; }
body.kol-customer .menu-app-section-head p { font-size: 12px !important; }
body.kol-customer .menu-app-section-head > span { font-size: 12px !important; }
body.kol-customer .category-tab,
body.kol-customer [data-category-tab] { font-size: 13px !important; }
body.kol-customer .menu-row-headline strong { font-size: 15px !important; }
body.kol-customer .menu-row-description { font-size: 12px !important; }
body.kol-customer .menu-row-meta { font-size: 11px !important; }
body.kol-customer .menu-row-inline-price,
body.kol-customer .row-price { font-size: 11px !important; }
body.kol-customer .menu-app-plus,
body.kol-customer .menu-app-plus::after { font-size: 25px !important; }
body.kol-customer .selected-chip { font-size: 9px !important; }
body.kol-customer .rescue-variant-label,
body.kol-customer .rescue-stock-label { font-size: 11px !important; }
body.kol-customer .rescue-price-stack strong { font-size: 14px !important; }
body.kol-customer .show-entire-menu { font-size: 12px !important; }
body.kol-customer .product-titlebar h2 { font-size: 18px !important; }
body.kol-customer .cart-header h2 { font-size: 20px !important; }
body.kol-customer .product-body,
body.kol-customer .product-summary { font-size: 13px !important; }
body.kol-customer .product-body label,
body.kol-customer .checkout-form label,
body.kol-customer .quick-checkout-panel label { font-size: 13px !important; }
body.kol-customer .product-footer > strong { font-size: 15px !important; }
body.kol-customer #addConfiguredProduct { font-size: 13px !important; }
body.kol-customer .cart-item-head h3 { font-size: 14px !important; }
body.kol-customer .cart-detail-text,
body.kol-customer .cart-detail-row > strong { font-size: 12px !important; }
body.kol-customer .cart-detail-row.total-line-row > strong { font-size: 14px !important; }
body.kol-customer .checkout-back-button { font-size: 14.5px !important; }
body.kol-customer .checkout-button { font-size: 16px !important; }
body.kol-customer .checkout-help { font-size: 12.5px !important; }
body.kol-customer .pickup-option,
body.kol-customer .pickup-option span { font-size: 13px !important; }
body.kol-customer .profile-header h2 { font-size: 21px !important; }
body.kol-customer .profile-header p { font-size: 12px !important; }
body.kol-customer .profile-order-title-row > strong { font-size: 14px !important; }
body.kol-customer .profile-ready-text { font-size: 11.5px !important; }
body.kol-customer .profile-order-meta { font-size: 10.5px !important; }
body.kol-customer .profile-order-price { font-size: 12px !important; }
body.kol-customer .profile-expand-icon { font-size: 15px !important; }
body.kol-customer .ingredient-removal-heading h3 { font-size: 15px !important; }
body.kol-customer .ingredient-removal-heading span { font-size: 12px !important; }
body.kol-customer .ingredient-chip { font-size: 13px !important; }
body.kol-customer .ingredient-chip > span { font-size: 16px !important; }
body.kol-customer .ingredient-removal-help { font-size: 11.5px !important; }
body.kol-customer .live-status-main h3 { font-size: 23px !important; }
body.kol-customer .live-status-main > p { font-size: 13px !important; }
body.kol-customer .live-status-time.pending > strong { font-size: 35px !important; }
body.kol-customer .live-status-time.accepted strong { font-size: 50px !important; }
body.kol-customer .live-status-time.accepted em { font-size: 14px !important; }
body.kol-customer .live-status-pickup strong { font-size: 18px !important; }
body.kol-customer .live-status-ready strong { font-size: 24px !important; }
body.kol-customer .live-status-cancel strong { font-size: 20px !important; }
'''

css = css + block.rstrip() + '\n'
css_path.write_text(css, encoding='utf-8')

for path in (index_path, admin_path):
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'kol-core\.css\?v=[^"\']+', 'kol-core.css?v=text-lock-v2', html, count=1)
    path.write_text(html, encoding='utf-8')

print('customer typography locked; responsive dimensions restored')
