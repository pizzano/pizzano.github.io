from pathlib import Path
import re

css_path = Path('test/kol-core.css')
index_path = Path('test/index.html')
admin_path = Path('test/admin-panel.html')

css = css_path.read_text(encoding='utf-8')
marker = '/* CUSTOMER FIXED SIZE LOCK V1 — no viewport-dependent sizing */'
block = r'''

/* CUSTOMER FIXED SIZE LOCK V1 — no viewport-dependent sizing
   Keep typography and primary UI controls physically identical above/below
   responsive breakpoints. Breakpoints may still change layout/flow only. */
html,
body.kol-customer {
  -webkit-text-size-adjust: none !important;
  text-size-adjust: none !important;
}

body.kol-customer {
  font-size: 13px !important;
  line-height: 1.35 !important;
}

body.kol-customer .appbar {
  min-height: 80px !important;
  height: 80px !important;
  padding: 8px 12px !important;
}
body.kol-customer .appbar-main {
  min-height: 80px !important;
  height: 80px !important;
}
body.kol-customer .appbar-brand {
  min-height: 54px !important;
  height: 54px !important;
}
body.kol-customer .brand-label b {
  font-size: 35px !important;
  line-height: .9 !important;
}
body.kol-customer .brand-label small {
  font-size: 8px !important;
  line-height: 1 !important;
}
body.kol-customer .brand-back-label,
body.kol-customer.kol-top-back-active .appbar-brand .brand-back-label,
body.kol-customer.kol-top-back-active.kol-product-detail-open .appbar-brand .brand-back-label,
body.kol-customer.cart-open .appbar-brand .brand-back-label {
  font-size: 15px !important;
}
body.kol-customer .icon-button,
body.kol-customer .cart-toggle,
body.kol-customer .profile-toggle {
  width: 44px !important;
  min-width: 44px !important;
  height: 44px !important;
  min-height: 44px !important;
}
body.kol-customer .plain-icon { font-size: 19px !important; }
body.kol-customer #cartCount { font-size: 11px !important; }

body.kol-customer .menu-shell {
  padding: 14px 12px 108px !important;
}
body.kol-customer .menu-page-heading h1,
body.kol-customer .menu-page-title {
  font-size: 31px !important;
  line-height: 1.2 !important;
}
body.kol-customer .menu-app-section-head h2 {
  font-size: 22px !important;
  line-height: 1.18 !important;
}
body.kol-customer .menu-app-section-head p {
  font-size: 12px !important;
  line-height: 1.4 !important;
}
body.kol-customer .category-tab,
body.kol-customer [data-category-tab] {
  min-height: 38px !important;
  height: 38px !important;
  padding-inline: 14px !important;
  font-size: 13px !important;
}

body.kol-customer .menu-row,
body.kol-customer .menu-app-product,
body.kol-customer .rescue-menu-row {
  min-height: 118px !important;
  grid-template-columns: 84px minmax(0, 1fr) 75px !important;
  gap: 10px !important;
  padding: 10px !important;
}
body.kol-customer .menu-row > .food-thumb,
body.kol-customer .menu-row > [class*="thumb"],
body.kol-customer .menu-thumb-wrap,
body.kol-customer .menu-thumb-wrap > .food-thumb,
body.kol-customer .menu-thumb-wrap > [class*="thumb"],
body.kol-customer .rescue-menu-row .menu-thumb,
body.kol-customer .rescue-menu-row [class*="thumb"] {
  width: 84px !important;
  min-width: 84px !important;
  height: 94px !important;
  min-height: 94px !important;
  max-height: 94px !important;
}
body.kol-customer .menu-row-headline strong {
  font-size: 15px !important;
  line-height: 1.3 !important;
}
body.kol-customer .menu-row-description {
  font-size: 12px !important;
  line-height: 1.35 !important;
}
body.kol-customer .menu-row-meta { font-size: 11px !important; }
body.kol-customer .menu-row-inline-price,
body.kol-customer .row-price {
  font-size: 11px !important;
  line-height: 1.25 !important;
}
body.kol-customer .menu-app-product-side,
body.kol-customer .rescue-product-side,
body.kol-customer .rescue-menu-row .rescue-product-side {
  width: 75px !important;
  min-width: 75px !important;
}
body.kol-customer .menu-favorite,
body.kol-customer .menu-app-plus {
  width: 34px !important;
  min-width: 34px !important;
  height: 34px !important;
  min-height: 34px !important;
}
body.kol-customer .menu-app-plus,
body.kol-customer .menu-app-plus::after { font-size: 25px !important; }
body.kol-customer .selected-chip {
  min-height: 21px !important;
  padding-inline: 7px !important;
  font-size: 9px !important;
}
body.kol-customer .rescue-variant-label,
body.kol-customer .rescue-stock-label {
  min-height: 24px !important;
  padding: 4px 10px !important;
  font-size: 11px !important;
}
body.kol-customer .rescue-price-stack strong { font-size: 14px !important; }

body.kol-customer .product-titlebar,
body.kol-customer .cart-header {
  min-height: 64px !important;
  height: 64px !important;
}
body.kol-customer .product-titlebar h2 { font-size: 18px !important; }
body.kol-customer .cart-header h2 { font-size: 20px !important; }
body.kol-customer .product-body,
body.kol-customer .product-summary { font-size: 13px !important; }
body.kol-customer .product-body label,
body.kol-customer .checkout-form label,
body.kol-customer .quick-checkout-panel label { font-size: 13px !important; }
body.kol-customer .product-footer > strong { font-size: 15px !important; }
body.kol-customer .product-footer #addConfiguredProduct,
body.kol-customer #addConfiguredProduct {
  min-height: 48px !important;
  height: 48px !important;
  font-size: 13px !important;
}
body.kol-customer .quantity-stepper button {
  width: 38px !important;
  min-width: 38px !important;
  height: 38px !important;
  min-height: 38px !important;
}

body.kol-customer .cart-sales-card { padding: 14px !important; }
body.kol-customer .cart-item {
  gap: 8px !important;
  padding: 13px 9px 11px 13px !important;
}
body.kol-customer .cart-item-head h3 { font-size: 14px !important; }
body.kol-customer .cart-detail-text,
body.kol-customer .cart-detail-row > strong { font-size: 12px !important; }
body.kol-customer .cart-detail-row.total-line-row > strong { font-size: 14px !important; }
body.kol-customer .cart-item-actions,
body.kol-customer .cart-item-actions button {
  width: 36px !important;
  min-width: 36px !important;
}
body.kol-customer .cart-item-actions button {
  height: 36px !important;
  min-height: 36px !important;
}
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
body.kol-customer .profile-expand-icon {
  width: 28px !important;
  min-width: 28px !important;
  height: 28px !important;
  min-height: 28px !important;
  font-size: 15px !important;
}

body.kol-customer .show-entire-menu {
  min-height: 40px !important;
  padding-inline: 13px !important;
  font-size: 12px !important;
}
body.kol-customer .ingredient-removal-heading h3 { font-size: 15px !important; }
body.kol-customer .ingredient-removal-heading span { font-size: 12px !important; }
body.kol-customer .ingredient-chip {
  min-height: 38px !important;
  padding: 7px 13px !important;
  font-size: 13px !important;
}
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

prefix = css if marker not in css else css[:css.index(marker)]
css = prefix.rstrip() + block.rstrip() + '\n'
css_path.write_text(css, encoding='utf-8')

for path in (index_path, admin_path):
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'kol-core\.css\?v=[^"\']+', 'kol-core.css?v=fixed-size-v1', html, count=1)
    path.write_text(html, encoding='utf-8')

print('customer fixed sizing layer applied')
