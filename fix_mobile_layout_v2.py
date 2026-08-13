from pathlib import Path
import re

css_path=Path('test/kol-core.css')
idx_path=Path('test/index.html')
css=css_path.read_text(encoding='utf-8')
idx=idx_path.read_text(encoding='utf-8')
marker='/* ===== KOL CUSTOMER: ONE MOBILE LAYOUT ON EVERY SCREEN ===== */'
if marker not in css:
    raise SystemExit('mobile marker missing')
base=css.split(marker,1)[0].rstrip()

mobile=r'''/* ===== KOL CUSTOMER: ONE MOBILE LAYOUT ON EVERY SCREEN ===== */
html{min-height:100%;overflow-x:hidden!important;scroll-behavior:auto!important;background:#ece9e3!important}
body.kol-customer{--app-width:480px;width:min(100%,var(--app-width))!important;max-width:var(--app-width)!important;min-width:320px!important;min-height:100dvh!important;margin:0 auto!important;overflow-x:hidden!important;color:#271f1a!important;background:#fffdf9!important;box-shadow:0 0 30px rgba(45,34,24,.12)!important}
body.kol-customer *,body.kol-customer *::before,body.kol-customer *::after{box-sizing:border-box!important;animation:none!important;transition:none!important;scroll-behavior:auto!important}
body.kol-customer button,body.kol-customer button *{animation:none!important;transition:none!important}

/* Top bar: always the same mobile width, including cart/profile/product states. */
body.kol-customer .appbar,
body.kol-customer:not(.cart-open) .appbar,
body.kol-customer.kol-scroll-locked-body:not(.cart-open) .appbar,
body.kol-customer.cart-open .appbar,
body.kol-customer.info-open .appbar,
body.kol-customer.profile-open .appbar,
body.kol-customer.order-live-open .appbar,
body.kol-customer.kol-product-detail-open .appbar,
body.kol-customer.kol-product-detail-open.kol-scroll-locked-body:not(.cart-open) .appbar{position:fixed!important;z-index:2200!important;inset:0 auto auto 50%!important;left:50%!important;right:auto!important;top:0!important;width:min(100vw,var(--app-width))!important;max-width:var(--app-width)!important;height:88px!important;min-height:88px!important;margin:0!important;padding:12px 14px!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;color:#fff!important;border:0!important;background:#f36a2d!important;background-image:none!important;box-shadow:none!important;transform:translateX(-50%)!important}
body.kol-customer .appbar-brand{position:static!important;min-width:96px!important;max-width:126px!important;min-height:48px!important;margin:0!important;padding:0!important;justify-self:start!important;border:0!important;background:transparent!important;transform:none!important}
body.kol-customer .brand-label{display:block!important;color:#fff!important;line-height:1!important;text-align:left!important;transform:none!important}
body.kol-customer .brand-label b{display:block!important;color:#fff!important;font-size:35px!important;line-height:.9!important;font-weight:950!important;letter-spacing:-.05em!important}
body.kol-customer .brand-label small{display:block!important;margin-top:5px!important;color:#fff!important;font-size:8px!important;font-weight:900!important;letter-spacing:.15em!important}
body.kol-customer.kol-top-back-active .brand-label{display:none!important}
body.kol-customer .brand-back-label{display:none!important;color:#fff!important;font-size:15px!important;font-weight:900!important;white-space:nowrap!important}
body.kol-customer.kol-top-back-active .brand-back-label{display:flex!important;align-items:center!important;gap:5px!important}
body.kol-customer .appbar-context-title{position:absolute!important;left:50%!important;top:50%!important;width:auto!important;max-width:52%!important;margin:0!important;overflow:hidden!important;color:#fff!important;font-size:16px!important;font-weight:900!important;line-height:1.1!important;text-align:center!important;text-overflow:ellipsis!important;white-space:nowrap!important;transform:translate(-50%,-50%)!important}
body.kol-customer .appbar-actions,body.kol-customer:not(.cart-open) .appbar-actions,body.kol-customer.kol-top-back-active .appbar-actions{position:static!important;inset:auto!important;margin:0!important;justify-self:end!important;display:flex!important;align-items:center!important;gap:7px!important;transform:none!important}
body.kol-customer .appbar .icon-button,body.kol-customer .appbar .cart-toggle{position:relative!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(255,255,255,.38)!important;border-radius:13px!important;color:#fff!important;background:rgba(255,255,255,.07)!important;box-shadow:none!important;transform:none!important}
body.kol-customer .appbar .icon-button:hover,body.kol-customer .appbar .cart-toggle:hover{border-color:rgba(255,255,255,.38)!important;background:rgba(255,255,255,.07)!important;box-shadow:none!important;transform:none!important}
body.kol-customer .plain-icon{width:22px!important;height:22px!important;stroke:currentColor!important;fill:none!important;transform:none!important}
body.kol-customer #cartCount{position:absolute!important;top:-8px!important;right:-8px!important;min-width:25px!important;height:25px!important;padding:0 6px!important;display:grid!important;place-items:center!important;border:2px solid #fff!important;border-radius:999px!important;color:#fff!important;background:#21463f!important;font-size:11px!important;font-weight:900!important}

/* Menu starts below fixed header + fixed category strip. */
body.kol-customer .menu-shell{position:relative!important;width:100%!important;max-width:100%!important;min-height:100dvh!important;margin:0!important;padding:164px 12px 110px!important;overflow:visible!important;background:#fffdf9!important;box-shadow:none!important}
body.kol-customer .category-tabs-wrap:not([hidden]){position:fixed!important;z-index:2100!important;left:50%!important;right:auto!important;top:88px!important;width:min(100vw,var(--app-width))!important;max-width:var(--app-width)!important;height:58px!important;margin:0!important;padding:8px 10px!important;display:block!important;overflow:hidden!important;border:0!important;border-bottom:1px solid #e8e2d8!important;background:#fffdf9!important;backdrop-filter:none!important;box-shadow:0 2px 8px rgba(45,34,24,.04)!important;transform:translateX(-50%)!important}
body.kol-customer.cart-open .category-tabs-wrap,body.kol-customer.profile-open .category-tabs-wrap,body.kol-customer.info-open .category-tabs-wrap,body.kol-customer.order-live-open .category-tabs-wrap,body.kol-customer.kol-product-detail-open .category-tabs-wrap{display:none!important}
body.kol-customer .category-tabs-scroll{width:100%!important;height:42px!important;display:flex!important;align-items:center!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;white-space:nowrap!important}
body.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important}
body.kol-customer .category-tab,body.kol-customer [data-category-tab]{min-width:max-content!important;min-height:42px!important;height:42px!important;flex:0 0 auto!important;margin:0!important;padding:0 14px!important;border:0!important;border-radius:13px!important;color:#6d665f!important;background:transparent!important;box-shadow:none!important;font-size:12px!important;font-weight:850!important;white-space:nowrap!important;transform:none!important}
body.kol-customer .category-tab:hover,body.kol-customer [data-category-tab]:hover{color:#6d665f!important;background:transparent!important;box-shadow:none!important;transform:none!important}
body.kol-customer .category-tab.active,body.kol-customer [data-category-tab].active,body.kol-customer .category-tab.active:hover,body.kol-customer [data-category-tab].active:hover{color:#fff!important;background:#f36a2d!important;box-shadow:none!important;transform:none!important}

body.kol-customer #menuSections{width:100%!important;max-width:100%!important;overflow:visible!important}
body.kol-customer .menu-app-section{width:100%!important;max-width:100%!important;margin:0 0 24px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
body.kol-customer .menu-app-section-head{min-height:auto!important;margin:0!important;padding:0 4px 10px!important;display:block!important;border:0!important;background:transparent!important}
body.kol-customer .menu-app-section-head h2{margin:0!important;color:#2c241f!important;font-family:Georgia,serif!important;font-size:27px!important;font-weight:800!important;line-height:1.08!important}
body.kol-customer .menu-app-section-head p{display:block!important;margin:5px 0 0!important;color:#82786f!important;font-size:12px!important;line-height:1.35!important}
body.kol-customer .menu-app-section-head>span{display:none!important}
body.kol-customer .menu-list{width:100%!important;max-width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important;overflow:visible!important}

/* Product cards: fixed three-column geometry, no hover movement. */
body.kol-customer .menu-row,body.kol-customer .menu-app-product,body.kol-customer .menu-row:hover,body.kol-customer .menu-app-product:hover{position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:116px!important;height:auto!important;max-height:none!important;margin:0!important;padding:9px!important;display:grid!important;grid-template-columns:88px minmax(0,1fr) 62px!important;gap:11px!important;align-items:center!important;overflow:hidden!important;border:1px solid #e7e0d6!important;border-radius:16px!important;color:#241f1b!important;background:#fff!important;background-image:none!important;box-shadow:0 4px 14px rgba(50,38,26,.045)!important;text-align:left!important;transform:none!important}
body.kol-customer .menu-row *,body.kol-customer .menu-app-product *{animation:none!important;transition:none!important}
body.kol-customer .menu-row:hover *,body.kol-customer .menu-app-product:hover *{transform:none!important}
body.kol-customer .menu-row.selected-product,body.kol-customer .menu-row.selected-product:hover{border-color:rgba(39,122,82,.40)!important;background:#fbfffd!important;box-shadow:0 0 0 2px rgba(39,122,82,.08),0 4px 14px rgba(50,38,26,.045)!important}
body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"]{grid-column:1!important;position:relative!important;width:88px!important;min-width:88px!important;height:98px!important;min-height:98px!important;max-height:98px!important;margin:0!important;align-self:center!important;overflow:hidden!important;border-radius:12px!important;background-position:center!important;background-size:cover!important;transform:none!important}
body.kol-customer .menu-thumb-wrap{grid-column:1!important;position:relative!important;width:88px!important;min-width:88px!important;height:98px!important;margin:0!important;display:block!important;align-self:center!important;overflow:visible!important;transform:none!important}
body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:88px!important;min-width:88px!important;height:98px!important;min-height:98px!important;max-height:98px!important;margin:0!important;transform:none!important}
body.kol-customer .menu-row-main{grid-column:2!important;position:static!important;min-width:0!important;width:100%!important;margin:0!important;padding:0!important;display:grid!important;align-content:center!important;gap:5px!important;overflow:hidden!important;transform:none!important}
body.kol-customer .menu-row-headline{position:static!important;min-width:0!important;margin:0!important;padding:0!important;display:block!important;transform:none!important}
body.kol-customer .menu-row-headline strong{display:block!important;max-width:100%!important;margin:0!important;overflow:hidden!important;color:#221e1b!important;font-size:16px!important;line-height:1.18!important;font-weight:900!important;text-overflow:ellipsis!important;white-space:nowrap!important;transform:none!important}
body.kol-customer .menu-row-description{display:-webkit-box!important;max-width:100%!important;margin:0!important;overflow:hidden!important;color:#766e67!important;font-size:11px!important;line-height:1.42!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;transform:none!important}
body.kol-customer .menu-row-meta{display:none!important}
body.kol-customer .menu-app-product-side,body.kol-customer .rescue-product-side{grid-column:3!important;position:static!important;min-width:0!important;width:62px!important;height:100%!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;justify-content:space-between!important;gap:7px!important;overflow:visible!important;transform:none!important}
body.kol-customer .menu-card-actions{position:static!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:5px!important;transform:none!important}
body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus{position:static!important;width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:12px!important;box-shadow:none!important;transform:none!important}
body.kol-customer .menu-favorite{border:1px solid #f36a2d!important;color:#948d85!important;background:#fff!important;font-size:21px!important}
body.kol-customer .menu-favorite:hover{border-color:#f36a2d!important;color:#948d85!important;background:#fff!important;box-shadow:none!important;transform:none!important}
body.kol-customer .menu-favorite.saved,body.kol-customer .menu-favorite.saved:hover{color:#f36a2d!important;background:#fff7f2!important}
body.kol-customer .menu-app-plus,body.kol-customer .menu-app-plus:hover{border:0!important;color:#fff!important;background:#f36a2d!important;font-size:24px!important;font-weight:700!important;box-shadow:none!important;transform:none!important}
body.kol-customer .menu-row-inline-price{position:static!important;max-width:72px!important;margin:auto 0 0!important;color:#211c18!important;font-size:12px!important;line-height:1.15!important;font-weight:900!important;text-align:right!important;white-space:normal!important;transform:none!important}
body.kol-customer .rescue-menu-row,body.kol-customer .rescue-menu-row:hover{background:#fffdf8!important}
body.kol-customer .rescue-discount-badge{position:absolute!important;z-index:5!important;left:7px!important;top:7px!important;padding:4px 7px!important;border-radius:999px!important;color:#fff!important;background:#ef5232!important;font-size:10px!important;font-weight:900!important}
body.kol-customer .rescue-meta-row{min-width:0!important;display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;margin-top:3px!important}
body.kol-customer .rescue-variant-label,body.kol-customer .rescue-stock-label{min-height:25px!important;padding:0 8px!important;display:inline-flex!important;align-items:center!important;border-radius:999px!important;font-size:10px!important;font-weight:850!important;white-space:nowrap!important}
body.kol-customer .rescue-variant-label{border:1px solid #f0a15f!important;color:#98521b!important;background:#fff7ed!important}
body.kol-customer .rescue-stock-label{color:#7a5b13!important;background:#fff0bc!important}
body.kol-customer .rescue-price-wrap{margin:auto 0 0!important;text-align:right!important}
body.kol-customer .rescue-price-wrap del,body.kol-customer .rescue-old-price{display:block!important;color:#9b938a!important;font-size:10px!important}
body.kol-customer .rescue-price-wrap strong,body.kol-customer .rescue-new-price{display:block!important;color:#b93f27!important;font-size:15px!important;font-weight:950!important;white-space:nowrap!important}

/* Every secondary screen is a centered mobile page below the same top bar. */
body.kol-customer .product-modal,body.kol-customer .info-modal,body.kol-customer .profile-modal,body.kol-customer .order-live-modal,body.kol-customer .cart-modal,body.kol-customer .confirm-modal{position:fixed!important;z-index:2000!important;inset:88px 0 0!important;left:0!important;right:0!important;top:88px!important;width:100vw!important;height:calc(100dvh - 88px)!important;margin:0!important;padding:0!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;overflow:hidden!important;background:rgba(35,31,28,.54)!important;backdrop-filter:none!important;transform:none!important}
body.kol-customer .product-modal[hidden],body.kol-customer .info-modal[hidden],body.kol-customer .profile-modal[hidden],body.kol-customer .order-live-modal[hidden],body.kol-customer .cart-modal[hidden],body.kol-customer .confirm-modal[hidden]{display:none!important}
body.kol-customer .product-panel,body.kol-customer .info-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel,body.kol-customer .confirm-panel{position:relative!important;inset:auto!important;z-index:2!important;width:min(100vw,var(--app-width))!important;max-width:var(--app-width)!important;height:100%!important;max-height:100%!important;min-height:0!important;margin:0!important;overflow:hidden!important;border:0!important;border-radius:0!important;background:#fffdf9!important;box-shadow:none!important;transform:none!important}
body.kol-customer .product-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel{display:flex!important;flex-direction:column!important}
body.kol-customer .info-panel,body.kol-customer .confirm-panel{overflow-y:auto!important}
body.kol-customer .product-titlebar,body.kol-customer .info-header,body.kol-customer .profile-header,body.kol-customer .order-live-header,body.kol-customer .cart-header{display:none!important}
body.kol-customer .product-scroll-content,body.kol-customer .cart-content-scroll,body.kol-customer .profile-body,body.kol-customer .order-live-content{min-height:0!important;flex:1 1 auto!important;width:100%!important;max-width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important}
body.kol-customer .product-scroll-content{padding:0!important}
body.kol-customer .product-photo{width:100%!important;min-height:210px!important;height:210px!important;max-height:210px!important;background-position:center!important;background-size:cover!important}
body.kol-customer .product-body{width:100%!important;padding:15px!important}
body.kol-customer .cart-content-scroll{padding:10px!important;background:#f7f3ed!important}
body.kol-customer .profile-body{max-height:none!important;padding:10px!important;background:#f7f3ed!important}
body.kol-customer .order-live-content{padding:10px!important;background:#f7f3ed!important}
body.kol-customer .cart-order-card,body.kol-customer .cart-sales-card,body.kol-customer .checkout-step-card,body.kol-customer .checkout-form,body.kol-customer .profile-order-card,body.kol-customer .profile-phone-card{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
body.kol-customer .checkout-grid{width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
body.kol-customer .checkout-grid .wide{grid-column:1!important}
body.kol-customer .pickup-options{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
body.kol-customer .product-footer,body.kol-customer .checkout-footer{position:relative!important;z-index:5!important;flex:0 0 auto!important;width:100%!important;max-width:100%!important;margin:0!important;padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important;border-top:1px solid #e7e0d6!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .product-footer{display:grid!important;grid-template-columns:88px minmax(0,1fr)!important;gap:9px!important;align-items:center!important}
body.kol-customer .checkout-footer{display:flex!important;flex-direction:column!important;gap:5px!important}
body.kol-customer .checkout-footer .checkout-button{width:100%!important;min-height:52px!important;margin:0!important}
body.kol-customer .checkout-next-hint{display:block!important;margin:0!important;text-align:center!important;font-size:10px!important}
body.kol-customer .profile-order-section,body.kol-customer .profile-favorite-list{width:100%!important;max-width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important}

/* Never animate/move interactive customer UI. */
body.kol-customer .menu-row,body.kol-customer .menu-row *,body.kol-customer .category-tab,body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus,body.kol-customer .icon-button,body.kol-customer .cart-toggle,body.kol-customer .featured-expand-button{animation:none!important;transition:none!important}
body.kol-customer .menu-row:hover,body.kol-customer .menu-row:hover *,body.kol-customer .menu-app-product:hover,body.kol-customer .menu-app-product:hover *,body.kol-customer .category-tab:hover,body.kol-customer .menu-favorite:hover,body.kol-customer .menu-app-plus:hover,body.kol-customer .icon-button:hover,body.kol-customer .cart-toggle:hover,body.kol-customer .featured-expand-button:hover{transform:none!important}
body.kol-customer .featured-expand-button[aria-expanded="true"] svg{transform:none!important}

@media (max-width:390px){
 body.kol-customer{--app-width:100vw;min-width:0!important}
 body.kol-customer .appbar,body.kol-customer.cart-open .appbar,body.kol-customer.profile-open .appbar,body.kol-customer.info-open .appbar,body.kol-customer.order-live-open .appbar,body.kol-customer.kol-product-detail-open .appbar{width:100vw!important;padding:10px 10px!important}
 body.kol-customer .appbar-brand{min-width:84px!important}
 body.kol-customer .brand-label b{font-size:30px!important}
 body.kol-customer .appbar .icon-button,body.kol-customer .appbar .cart-toggle{width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important}
 body.kol-customer .menu-shell{padding-right:9px!important;padding-left:9px!important}
 body.kol-customer .menu-row,body.kol-customer .menu-row:hover,body.kol-customer .menu-app-product,body.kol-customer .menu-app-product:hover{grid-template-columns:76px minmax(0,1fr) 56px!important;gap:8px!important;min-height:106px!important;padding:8px!important}
 body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"],body.kol-customer .menu-thumb-wrap,body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:76px!important;min-width:76px!important;height:90px!important;min-height:90px!important;max-height:90px!important}
 body.kol-customer .menu-app-product-side,body.kol-customer .rescue-product-side{width:56px!important}
 body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important}
 body.kol-customer .pickup-options{grid-template-columns:1fr!important}
}
'''

css_path.write_text(base+'\n\n'+mobile+'\n',encoding='utf-8')
idx=re.sub(r'href="kol-core\.css(?:\?v=[^"]*)?"','href="kol-core.css?v=mobile-fix-2"',idx,count=1)
idx_path.write_text(idx,encoding='utf-8')
print('css',len(css),'->',css_path.stat().st_size)
