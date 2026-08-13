from pathlib import Path
import subprocess,re
BASE='002212ee5ec86ae0ade29426cdadc846750d2d13'

def old(path):
    return subprocess.check_output(['git','show',f'{BASE}:{path}'],text=True)

idx=old('test/index.html')
css=old('test/kol-core.css')

# Keep the last known-good customer logic and all Redde maten/live-stock behavior.
# Only change the stylesheet cache key; no embedded CSS.
idx=re.sub(r'href="kol-core\.css(?:\?v=[^"]*)?"','href="kol-core.css?v=mobile-reset-1"',idx,count=1)
idx=re.sub(r'<!--.*?-->','',idx,flags=re.S)
idx=re.sub(r'\n{3,}','\n\n',idx)
Path('test/index.html').write_text(idx,encoding='utf-8')

# Remove comments only. Do NOT destructively strip working selectors again.
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
css=css.rstrip()+"\n\n"

mobile=r'''
/* ===== KOL CUSTOMER: ONE MOBILE LAYOUT ON EVERY SCREEN ===== */
html{background:#ece9e3!important;overflow-x:hidden!important}
body.kol-customer{--app-width:480px;width:min(100%,var(--app-width))!important;max-width:var(--app-width)!important;min-width:320px!important;min-height:100dvh!important;margin:0 auto!important;overflow-x:hidden!important;background:#fffdf9!important;box-shadow:0 0 32px rgba(45,34,24,.12)!important}
body.kol-customer *,body.kol-customer *::before,body.kol-customer *::after{box-sizing:border-box!important;animation:none!important;transition:none!important;scroll-behavior:auto!important;transform:none}
body.kol-customer button{touch-action:manipulation}
body.kol-customer .appbar{position:sticky!important;inset:auto!important;top:0!important;z-index:200!important;width:100%!important;max-width:none!important;min-height:88px!important;height:88px!important;margin:0!important;padding:12px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;background:#f36a2d!important;box-shadow:none!important}
body.kol-customer .appbar-brand{position:static!important;width:auto!important;min-width:92px!important;max-width:130px!important;height:auto!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;border:0!important;background:transparent!important}
body.kol-customer .brand-label{display:block!important;width:auto!important;color:#fff!important;text-align:left!important;line-height:1!important}
body.kol-customer .brand-label b{display:block!important;font-size:35px!important;line-height:.9!important;font-weight:950!important;letter-spacing:-.05em!important}
body.kol-customer .brand-label small{display:block!important;margin-top:5px!important;color:#fff!important;font-size:8px!important;font-weight:900!important;letter-spacing:.15em!important}
body.kol-customer .appbar-actions{position:static!important;width:auto!important;margin:0!important;display:flex!important;align-items:center!important;gap:7px!important}
body.kol-customer .icon-button,body.kol-customer .cart-toggle{position:relative!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(255,255,255,.38)!important;border-radius:13px!important;color:#fff!important;background:rgba(255,255,255,.08)!important;box-shadow:none!important}
body.kol-customer .plain-icon{width:22px!important;height:22px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.8!important}
body.kol-customer #cartCount{position:absolute!important;top:-8px!important;right:-8px!important;min-width:25px!important;height:25px!important;padding:0 6px!important;display:grid!important;place-items:center!important;border:2px solid #fff!important;border-radius:999px!important;color:#fff!important;background:#21463f!important;font-size:11px!important;font-weight:900!important}
body.kol-customer .profile-order-dot{position:absolute!important;top:7px!important;right:7px!important}
body.kol-customer .menu-shell{position:relative!important;width:100%!important;max-width:none!important;min-height:calc(100dvh - 88px)!important;margin:0!important;padding:0 12px 110px!important;overflow:visible!important;background:#fffdf9!important;box-shadow:none!important}
body.kol-customer .category-tabs-wrap{position:sticky!important;inset:auto!important;top:88px!important;z-index:150!important;width:calc(100% + 24px)!important;max-width:none!important;margin:0 -12px 14px!important;padding:9px 12px!important;overflow:hidden!important;border:0!important;border-bottom:1px solid #e8e2d8!important;background:#fffdf9!important;backdrop-filter:none!important}
body.kol-customer .category-tabs-scroll{width:100%!important;max-width:100%!important;display:flex!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;white-space:nowrap!important}
body.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important}
body.kol-customer .category-tab,body.kol-customer [data-category-tab]{min-width:max-content!important;min-height:42px!important;height:42px!important;flex:0 0 auto!important;padding:0 15px!important;border:0!important;border-radius:13px!important;color:#6d665f!important;background:transparent!important;font-size:13px!important;font-weight:800!important;white-space:nowrap!important;box-shadow:none!important}
body.kol-customer .category-tab.active,body.kol-customer [data-category-tab].active{color:#fff!important;background:#f36a2d!important}
body.kol-customer #menuSections{width:100%!important;max-width:100%!important;overflow:visible!important}
body.kol-customer .menu-app-section{width:100%!important;max-width:100%!important;margin:0 0 24px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
body.kol-customer .menu-app-section-head{min-height:auto!important;margin:0!important;padding:18px 4px 10px!important;display:block!important;border:0!important;background:transparent!important}
body.kol-customer .menu-app-section-head h2{margin:0!important;color:#2c241f!important;font-size:27px!important;line-height:1.05!important;font-family:Georgia,serif!important;font-weight:800!important}
body.kol-customer .menu-app-section-head p{display:block!important;margin:5px 0 0!important;color:#82786f!important;font-size:12px!important;line-height:1.35!important}
body.kol-customer .menu-app-section-head>span{display:none!important}
body.kol-customer .menu-list{width:100%!important;max-width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important;overflow:visible!important}
body.kol-customer .menu-row{position:relative!important;width:100%!important;max-width:100%!important;min-height:112px!important;height:auto!important;margin:0!important;padding:9px!important;display:grid!important;grid-template-columns:84px minmax(0,1fr) 58px!important;gap:10px!important;align-items:center!important;overflow:hidden!important;border:1px solid #e7e0d6!important;border-radius:16px!important;color:#241f1b!important;background:#fff!important;box-shadow:0 4px 14px rgba(50,38,26,.045)!important;text-align:left!important}
body.kol-customer .menu-row:hover,body.kol-customer .menu-row:active{background:#fff!important;box-shadow:0 4px 14px rgba(50,38,26,.045)!important}
body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"],body.kol-customer .menu-thumb{position:relative!important;width:84px!important;min-width:84px!important;height:92px!important;margin:0!important;display:block!important;align-self:center!important;overflow:hidden!important;border-radius:12px!important;background-position:center!important;background-size:cover!important}
body.kol-customer .menu-thumb-wrap{position:relative!important;width:84px!important;height:92px!important;display:block!important;overflow:visible!important}
body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:84px!important;height:92px!important}
body.kol-customer .menu-row-main{min-width:0!important;width:100%!important;display:grid!important;align-content:center!important;gap:4px!important;overflow:hidden!important}
body.kol-customer .menu-row-headline{min-width:0!important;display:block!important}
body.kol-customer .menu-row-headline strong{display:block!important;overflow:hidden!important;color:#221e1b!important;font-size:16px!important;line-height:1.15!important;font-weight:900!important;text-overflow:ellipsis!important;white-space:nowrap!important}
body.kol-customer .menu-row-description{display:-webkit-box!important;overflow:hidden!important;color:#766e67!important;font-size:11px!important;line-height:1.35!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
body.kol-customer .menu-row-meta{display:none!important}
body.kol-customer .menu-app-product-side,body.kol-customer .rescue-product-side{min-width:0!important;width:58px!important;height:100%!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;justify-content:space-between!important;gap:7px!important;overflow:visible!important}
body.kol-customer .menu-card-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:5px!important}
body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus{position:static!important;width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;margin:0!important;display:grid!important;place-items:center!important;border-radius:12px!important;box-shadow:none!important}
body.kol-customer .menu-favorite{border:1px solid #f36a2d!important;color:#948d85!important;background:#fff!important;font-size:21px!important}
body.kol-customer .menu-app-plus{border:0!important;color:#fff!important;background:#f36a2d!important;font-size:24px!important;font-weight:700!important}
body.kol-customer .menu-row-inline-price{position:static!important;max-width:76px!important;margin:auto 0 0!important;color:#211c18!important;font-size:12px!important;line-height:1.1!important;font-weight:900!important;text-align:right!important;white-space:normal!important}
body.kol-customer .selected-chip{min-height:38px!important;padding:0 8px!important;display:grid!important;place-items:center!important;border-radius:11px!important;font-size:10px!important}
body.kol-customer .rescue-discount-badge{position:absolute!important;z-index:5!important;top:7px!important;left:7px!important;padding:4px 7px!important;border-radius:999px!important;color:#fff!important;background:#ef5232!important;font-size:10px!important;font-weight:900!important}
body.kol-customer .rescue-meta-row{min-width:0!important;display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;margin-top:3px!important}
body.kol-customer .rescue-variant-label,body.kol-customer .rescue-stock-label{min-height:25px!important;padding:0 8px!important;display:inline-flex!important;align-items:center!important;border-radius:999px!important;font-size:10px!important;font-weight:850!important;white-space:nowrap!important}
body.kol-customer .rescue-variant-label{border:1px solid #f0a15f!important;color:#98521b!important;background:#fff7ed!important}
body.kol-customer .rescue-stock-label{color:#7a5b13!important;background:#fff0bc!important}
body.kol-customer .rescue-price-wrap{margin:auto 0 0!important;text-align:right!important}
body.kol-customer .rescue-price-wrap del,body.kol-customer .rescue-old-price{display:block!important;color:#9b938a!important;font-size:10px!important}
body.kol-customer .rescue-price-wrap strong,body.kol-customer .rescue-new-price{display:block!important;color:#b93f27!important;font-size:15px!important;font-weight:950!important;white-space:nowrap!important}
body.kol-customer .product-modal,body.kol-customer .info-modal,body.kol-customer .profile-modal,body.kol-customer .order-live-modal,body.kol-customer .cart-modal,body.kol-customer .confirm-modal{position:fixed!important;inset:0!important;z-index:2000!important;width:100vw!important;height:100dvh!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:rgba(28,24,21,.52)!important;backdrop-filter:none!important}
body.kol-customer .product-modal[hidden],body.kol-customer .info-modal[hidden],body.kol-customer .profile-modal[hidden],body.kol-customer .order-live-modal[hidden],body.kol-customer .cart-modal[hidden],body.kol-customer .confirm-modal[hidden]{display:none!important}
body.kol-customer .product-panel,body.kol-customer .info-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel,body.kol-customer .confirm-panel{position:relative!important;z-index:2!important;width:min(100vw,var(--app-width))!important;max-width:var(--app-width)!important;height:100dvh!important;max-height:100dvh!important;min-height:0!important;margin:0 auto!important;overflow:hidden!important;border:0!important;border-radius:0!important;background:#fffdf9!important;box-shadow:none!important;transform:none!important}
body.kol-customer .product-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel{display:flex!important;flex-direction:column!important}
body.kol-customer .info-panel,body.kol-customer .confirm-panel{overflow-y:auto!important}
body.kol-customer .product-scroll-content,body.kol-customer .cart-content-scroll,body.kol-customer .profile-body,body.kol-customer .order-live-content{min-height:0!important;flex:1 1 auto!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}
body.kol-customer .product-titlebar,body.kol-customer .info-header,body.kol-customer .profile-header,body.kol-customer .order-live-header,body.kol-customer .cart-header{position:relative!important;flex:0 0 72px!important;min-height:72px!important;height:72px!important;padding:10px 14px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;border-bottom:1px solid rgba(0,0,0,.08)!important;color:#fff!important;background:#f36a2d!important}
body.kol-customer .product-titlebar h2,body.kol-customer .info-header h2,body.kol-customer .profile-header h2,body.kol-customer .order-live-header h2,body.kol-customer .cart-header h2{margin:0!important;color:#fff!important;font-size:17px!important;font-weight:900!important;text-align:center!important}
body.kol-customer .profile-header p,body.kol-customer .profile-header-copy>span,body.kol-customer .info-header-copy>span{display:none!important}
body.kol-customer .back-button,body.kol-customer .close-button,body.kol-customer .cart-close-button{position:absolute!important;left:12px!important;top:14px!important;width:42px!important;min-width:42px!important;height:42px!important;padding:0!important;display:grid!important;place-items:center!important;border:0!important;border-radius:11px!important;color:#fff!important;background:transparent!important;font-size:27px!important;box-shadow:none!important}
body.kol-customer .close-button,body.kol-customer .cart-close-button{left:auto!important;right:12px!important}
body.kol-customer .product-photo{flex:0 0 auto!important;min-height:190px!important;height:190px!important;max-height:190px!important;background-position:center!important;background-size:cover!important}
body.kol-customer .product-body{padding:16px!important}
body.kol-customer .product-footer,body.kol-customer .checkout-footer{position:relative!important;z-index:5!important;flex:0 0 auto!important;width:100%!important;margin:0!important;padding:9px 12px calc(9px + env(safe-area-inset-bottom))!important;border-top:1px solid #e7e0d6!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .product-footer{display:grid!important;grid-template-columns:88px minmax(0,1fr)!important;gap:9px!important;align-items:center!important}
body.kol-customer #addConfiguredProduct,body.kol-customer .checkout-button,body.kol-customer .quick-checkout-submit{width:100%!important;min-height:50px!important;margin:0!important;border:0!important;border-radius:12px!important;color:#fff!important;background:#f36a2d!important;font-size:14px!important;font-weight:900!important;box-shadow:none!important}
body.kol-customer .checkout-footer{display:flex!important;flex-direction:column!important;gap:4px!important}
body.kol-customer .checkout-next-hint{display:block!important;min-height:15px!important;margin:0!important;color:#776e66!important;font-size:10px!important;text-align:center!important}
body.kol-customer .cart-content-scroll{padding:0!important;background:#f6f2eb!important}
body.kol-customer .cart-order-card{width:100%!important;margin:0!important;padding:12px!important;display:grid!important;gap:10px!important;background:transparent!important}
body.kol-customer .cart-sales-card,body.kol-customer .checkout-step-card{width:100%!important;margin:0!important;padding:14px!important;border:1px solid #e5ddd2!important;border-radius:14px!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .cart-items{display:grid!important;gap:8px!important}
body.kol-customer .cart-item{width:100%!important;max-width:100%!important;overflow:hidden!important}
body.kol-customer .pickup-options,body.kol-customer .checkout-grid{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
body.kol-customer .checkout-grid .wide{grid-column:1!important}
body.kol-customer .profile-body{padding:10px!important;background:#f6f2eb!important}
body.kol-customer .profile-order-section,body.kol-customer .profile-favorite-list{width:100%!important;display:grid!important;gap:8px!important}
body.kol-customer .profile-order-card,body.kol-customer .profile-favorite-item{width:100%!important;max-width:100%!important;margin:0!important}
body.kol-customer .order-live-content{padding:12px!important;background:#f6f2eb!important}
body.kol-customer .info-grid{width:100%!important;padding:12px!important;display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
body.kol-customer .info-block{width:100%!important;margin:0!important}
body.kol-customer .confirm-panel{height:auto!important;max-height:calc(100dvh - 24px)!important;margin:auto!important;padding:18px!important;border-radius:16px!important}
body.kol-customer .quick-checkout-grid,body.kol-customer .quick-checkout-actions{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
body.kol-customer.modal-open,body.kol-customer.cart-open,body.kol-customer.product-open,body.kol-customer.profile-open{overflow:hidden!important}
@media(max-width:379px){body.kol-customer{min-width:280px!important}body.kol-customer .appbar{padding-inline:10px!important}body.kol-customer .brand-label b{font-size:30px!important}body.kol-customer .appbar-actions{gap:5px!important}body.kol-customer .icon-button,body.kol-customer .cart-toggle{width:40px!important;min-width:40px!important;height:40px!important}body.kol-customer .menu-shell{padding-inline:9px!important}body.kol-customer .category-tabs-wrap{width:calc(100% + 18px)!important;margin-inline:-9px!important;padding-inline:9px!important}body.kol-customer .menu-row{grid-template-columns:72px minmax(0,1fr) 52px!important;gap:8px!important;padding:8px!important}body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"],body.kol-customer .menu-thumb,body.kol-customer .menu-thumb-wrap,body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:72px!important;min-width:72px!important;height:82px!important}body.kol-customer .menu-row-headline strong{font-size:14px!important}body.kol-customer .menu-row-description{font-size:10px!important}body.kol-customer .menu-app-product-side,body.kol-customer .rescue-product-side{width:52px!important}body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus{width:35px!important;min-width:35px!important;height:35px!important}}
'''
css+=mobile
Path('test/kol-core.css').write_text(css,encoding='utf-8')

# Static safety checks
assert '<style' not in idx.lower()
for must in ['rescueDeals','rescueVariantLabel','rescue-stock-label','firebaseCustomerOrdersBaseUrl']:
    assert must in idx,must
for must in ['body.kol-customer .cart-panel','body.kol-customer .profile-panel','width:min(100vw,var(--app-width))','grid-template-columns:1fr!important']:
    assert must in css,must
assert css.count('{')==css.count('}')
print('rebuilt',len(idx),len(css))
