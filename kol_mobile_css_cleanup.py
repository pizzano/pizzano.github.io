from pathlib import Path
import re

CSS=Path('test/kol-core.css')
INDEX=Path('test/index.html')

src=CSS.read_text(encoding='utf-8')
before=len(src.encode('utf-8'))
src=re.sub(r'/\*.*?\*/','',src,flags=re.S)

# CSS brace matcher that respects quoted strings.
def match_brace(s,open_pos):
    depth=0;i=open_pos;quote=None
    while i<len(s):
        c=s[i]
        if quote:
            if c=='\\': i+=2;continue
            if c==quote: quote=None
            i+=1;continue
        if c in ('"',"'"):
            quote=c;i+=1;continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0:return i
        i+=1
    raise RuntimeError('Unbalanced CSS braces')

def split_selectors(s):
    out=[];buf=[];depth=0;quote=None;i=0
    while i<len(s):
        c=s[i]
        if quote:
            buf.append(c)
            if c=='\\' and i+1<len(s):
                buf.append(s[i+1]);i+=2;continue
            if c==quote:quote=None
        else:
            if c in ('"',"'"):quote=c;buf.append(c)
            elif c in '([':depth+=1;buf.append(c)
            elif c in ')]':depth=max(0,depth-1);buf.append(c)
            elif c==',' and depth==0:
                x=''.join(buf).strip()
                if x:out.append(x)
                buf=[]
            else:buf.append(c)
        i+=1
    x=''.join(buf).strip()
    if x:out.append(x)
    return out

removed_customer_selectors=0
removed_keyframes=0

def clean_scope(s):
    global removed_customer_selectors,removed_keyframes
    out=[];pos=0;seen=set()
    while pos<len(s):
        while pos<len(s) and s[pos].isspace():pos+=1
        if pos>=len(s):break
        brace=s.find('{',pos)
        if brace<0:break
        pre=s[pos:brace].strip()
        end=match_brace(s,brace)
        body=s[brace+1:end]
        low=pre.lower()
        if pre.startswith('@'):
            if low.startswith('@media') or low.startswith('@supports') or low.startswith('@container') or low.startswith('@layer'):
                inner=clean_scope(body)
                if inner.strip():out.append(f'{pre}{{{inner}}}')
            elif 'keyframes' in low:
                removed_keyframes+=1
            else:
                rule=f'{pre}{{{body.strip()}}}'
                if rule not in seen:out.append(rule);seen.add(rule)
        else:
            selectors=split_selectors(pre)
            keep=[]
            for sel in selectors:
                if 'kol-customer' in sel.lower():
                    removed_customer_selectors+=1
                else:
                    keep.append(sel)
            body=body.strip()
            if keep and body:
                rule=f'{",".join(keep)}{{{body}}}'
                if rule not in seen:
                    out.append(rule);seen.add(rule)
        pos=end+1
    return ''.join(out)

base=clean_scope(src)

# One single customer stylesheet. No desktop/tablet alternate layout.
mobile=r'''
html:has(body.kol-customer){background:#ece9e3}
body.kol-customer{--m-orange:#f36a2b;--m-paper:#fffdfa;--m-bg:#f5f2ec;--m-text:#2b211d;--m-muted:#766d67;--m-line:#e5ddd4;--m-green:#15945e;--m-red:#c83c37;--m-soft-green:#ebf8f1;width:100%;max-width:480px;min-width:320px;min-height:100dvh;margin:0 auto!important;overflow-x:hidden;color:var(--m-text);background:var(--m-paper);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body.kol-customer *,body.kol-customer *::before,body.kol-customer *::after{box-sizing:border-box;animation:none!important;transition:none!important;scroll-behavior:auto!important}
body.kol-customer button,body.kol-customer input,body.kol-customer select,body.kol-customer textarea{font:inherit}
body.kol-customer button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
body.kol-customer .appbar{position:sticky!important;top:0!important;z-index:100!important;width:100%!important;min-height:86px!important;margin:0!important;padding:10px 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;color:#fff!important;background:var(--m-orange)!important;border:0!important;box-shadow:none!important}
body.kol-customer .appbar-brand{min-width:102px!important;min-height:58px!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;border:0!important;background:transparent!important;color:#fff!important;text-align:left!important}
body.kol-customer .brand-label{display:block!important;width:auto!important;color:#fff!important;font-family:Inter,ui-sans-serif,sans-serif!important;letter-spacing:0!important;line-height:1!important}
body.kol-customer .brand-label b{display:block!important;color:#fff!important;font-size:38px!important;font-weight:950!important;line-height:.82!important;letter-spacing:-.055em!important}
body.kol-customer .brand-label small{display:block!important;margin-top:7px!important;color:#fff!important;font-size:8px!important;font-weight:900!important;letter-spacing:.18em!important}
body.kol-customer .brand-back-label{display:none}
body.kol-customer.kol-top-back-active .brand-label{display:none!important}
body.kol-customer.kol-top-back-active .brand-back-label{display:block!important;color:#fff;font-size:17px;font-weight:850}
body.kol-customer .appbar-actions{position:static!important;width:auto!important;margin-left:auto!important;display:flex!important;align-items:center!important;gap:7px!important}
body.kol-customer .icon-button,body.kol-customer .cart-toggle{position:relative!important;width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(255,255,255,.42)!important;border-radius:12px!important;color:#fff!important;background:transparent!important;box-shadow:none!important}
body.kol-customer .plain-icon{width:21px!important;height:21px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important}
body.kol-customer #cartCount{position:absolute!important;top:-9px!important;right:-8px!important;min-width:24px!important;height:24px!important;padding:0 5px!important;display:grid!important;place-items:center!important;border:2px solid var(--m-orange)!important;border-radius:999px!important;color:#fff!important;background:#164e43!important;font-size:11px!important;font-weight:900!important}
body.kol-customer .profile-order-dot{position:absolute!important;top:5px!important;right:5px!important;width:8px!important;height:8px!important;border:0!important;border-radius:50%!important;background:#173f36!important}
body.kol-customer .menu-shell{width:100%!important;max-width:none!important;min-height:calc(100dvh - 86px)!important;margin:0!important;padding:0 10px 110px!important;background:var(--m-bg)!important;box-shadow:none!important}
body.kol-customer .status-notice{margin:10px 0!important;padding:11px 12px!important;border:1px solid #ecd7a4!important;border-radius:11px!important;background:#fff8e7!important;font-size:12px!important}
body.kol-customer .category-tabs-wrap{position:sticky!important;top:86px!important;z-index:70!important;width:auto!important;margin:0 -10px 12px!important;padding:9px 10px!important;border:0!important;border-bottom:1px solid var(--m-line)!important;background:rgba(255,253,250,.98)!important;backdrop-filter:none!important}
body.kol-customer .category-tabs-scroll{width:100%!important;display:flex!important;gap:7px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
body.kol-customer .category-tabs-scroll::-webkit-scrollbar{display:none!important}
body.kol-customer .category-tab,body.kol-customer .category-tabs-scroll button{min-width:max-content!important;min-height:40px!important;padding:0 14px!important;flex:0 0 auto!important;border:0!important;border-radius:12px!important;color:#716863!important;background:transparent!important;box-shadow:none!important;font-size:12px!important;font-weight:850!important;white-space:nowrap!important}
body.kol-customer .category-tab.active,body.kol-customer .category-tabs-scroll button.active{color:#fff!important;background:var(--m-orange)!important}
body.kol-customer .menu-app-hero,body.kol-customer .brand-hero{display:none!important}
body.kol-customer .menu-app-section{width:100%!important;margin:0 0 16px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
body.kol-customer .menu-app-section-head{min-height:auto!important;margin:0!important;padding:13px 8px 9px!important;display:block!important;border:0!important;background:transparent!important}
body.kol-customer .menu-app-section-head h2{margin:0!important;color:var(--m-text)!important;font-family:Georgia,serif!important;font-size:25px!important;line-height:1.05!important;letter-spacing:-.025em!important}
body.kol-customer .menu-app-section-head p{margin:5px 0 0!important;color:var(--m-muted)!important;font-size:11px!important;line-height:1.35!important}
body.kol-customer .menu-app-section-head>span{display:none!important}
body.kol-customer .menu-list{width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important;overflow:visible!important}
body.kol-customer .menu-row{position:relative!important;width:100%!important;min-height:106px!important;margin:0!important;padding:8px!important;display:grid!important;grid-template-columns:82px minmax(0,1fr) 56px!important;gap:10px!important;align-items:center!important;overflow:hidden!important;border:1px solid var(--m-line)!important;border-radius:15px!important;color:var(--m-text)!important;background:#fff!important;background-image:none!important;box-shadow:none!important;text-align:left!important}
body.kol-customer .menu-row:hover,body.kol-customer .menu-row:active{background:#fff!important;box-shadow:none!important}
body.kol-customer .menu-thumb-wrap{position:relative!important;width:82px!important;height:88px!important;display:block!important;align-self:center!important}
body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"],body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:82px!important;min-width:82px!important;height:88px!important;display:block!important;overflow:hidden!important;border-radius:12px!important;background-color:#eee9e2!important;background-position:center!important;background-size:cover!important;object-fit:cover!important}
body.kol-customer .menu-row-main{min-width:0!important;height:auto!important;display:grid!important;align-content:center!important;gap:5px!important}
body.kol-customer .menu-row-headline{min-width:0!important}
body.kol-customer .menu-row-headline strong{display:block!important;overflow:hidden!important;color:var(--m-text)!important;font-size:15px!important;font-weight:900!important;line-height:1.16!important;text-overflow:ellipsis!important;white-space:nowrap!important}
body.kol-customer .menu-row-description{display:-webkit-box!important;overflow:hidden!important;color:var(--m-muted)!important;font-size:11px!important;line-height:1.35!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
body.kol-customer .menu-row-meta{display:none!important}
body.kol-customer .menu-app-product-side{min-width:0!important;height:88px!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;justify-content:space-between!important;gap:6px!important}
body.kol-customer .menu-card-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:5px!important}
body.kol-customer .menu-favorite,body.kol-customer .menu-app-plus{position:static!important;width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid #eadfd5!important;border-radius:10px!important;box-shadow:none!important}
body.kol-customer .menu-favorite{color:#847970!important;background:#fff!important;font-size:19px!important}
body.kol-customer .menu-favorite.saved,body.kol-customer .menu-favorite.active{color:var(--m-orange)!important;background:#fff6f0!important}
body.kol-customer .menu-app-plus{color:#fff!important;background:var(--m-orange)!important;border-color:var(--m-orange)!important;font-size:22px!important;font-weight:800!important}
body.kol-customer .menu-row-inline-price{position:static!important;max-width:72px!important;margin:auto 0 0!important;color:var(--m-text)!important;font-size:12px!important;font-weight:900!important;line-height:1.15!important;text-align:right!important;white-space:normal!important}
body.kol-customer .selected-chip{min-height:30px!important;padding:0 8px!important;display:inline-flex!important;align-items:center!important;border-radius:9px!important;color:#176c49!important;background:var(--m-soft-green)!important;font-size:10px!important;font-weight:900!important}
body.kol-customer .sold-out{opacity:.55!important}
body.kol-customer .soldout-small{color:var(--m-red)!important;font-size:10px!important}
body.kol-customer .rescue-menu-row{border-color:#eadfcf!important;background:#fffdf9!important}
body.kol-customer .rescue-thumb-wrap{position:relative!important}
body.kol-customer .rescue-discount-badge{position:absolute!important;z-index:3!important;top:6px!important;left:6px!important;min-height:25px!important;padding:0 7px!important;display:inline-flex!important;align-items:center!important;border-radius:999px!important;color:#fff!important;background:var(--m-orange)!important;font-size:11px!important;font-weight:950!important}
body.kol-customer .rescue-meta-row{min-width:0!important;display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:wrap!important}
body.kol-customer .rescue-variant-label,body.kol-customer .rescue-stock-label{min-height:25px!important;padding:0 8px!important;display:inline-flex!important;align-items:center!important;border-radius:999px!important;font-size:10px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important}
body.kol-customer .rescue-variant-label{color:#8b4b17!important;background:#fff3e6!important;border:1px solid #f2b275!important}
body.kol-customer .rescue-stock-label{color:#7b5b12!important;background:#fff1c8!important;border:1px solid #f1dfae!important}
body.kol-customer .rescue-stock-label.last-one{color:#983f29!important;background:#ffebe4!important;border-color:#f1c4b7!important}
body.kol-customer .rescue-product-side{height:88px!important}
body.kol-customer .rescue-original-price{color:#958b84!important;font-size:10px!important;text-decoration:line-through!important;text-align:right!important}
body.kol-customer .rescue-sale-price{color:#d54c20!important;font-size:14px!important;font-weight:950!important;text-align:right!important}
body.kol-customer .product-modal,body.kol-customer .info-modal,body.kol-customer .profile-modal,body.kol-customer .order-live-modal,body.kol-customer .cart-modal,body.kol-customer .confirm-modal{position:fixed!important;z-index:300!important;inset:0!important;width:100%!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(24,19,16,.46)!important;backdrop-filter:none!important}
body.kol-customer .product-panel,body.kol-customer .info-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel,body.kol-customer .confirm-panel{position:relative!important;width:100%!important;max-width:480px!important;max-height:96dvh!important;margin:0!important;overflow:hidden!important;border:0!important;border-radius:18px 18px 0 0!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .product-panel,body.kol-customer .cart-panel{height:96dvh!important;display:flex!important;flex-direction:column!important}
body.kol-customer .product-scroll-content,body.kol-customer .cart-content-scroll,body.kol-customer .profile-body,body.kol-customer .order-live-content{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}
body.kol-customer .product-scroll-content,body.kol-customer .cart-content-scroll{flex:1 1 auto!important}
body.kol-customer .product-titlebar,body.kol-customer .info-header,body.kol-customer .profile-header,body.kol-customer .order-live-header,body.kol-customer .cart-header{min-height:66px!important;padding:11px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;border-bottom:1px solid var(--m-line)!important;color:var(--m-text)!important;background:#fff!important}
body.kol-customer .product-titlebar h2,body.kol-customer .info-header h2,body.kol-customer .profile-header h2,body.kol-customer .order-live-header h2,body.kol-customer .cart-header h2{margin:0!important;color:var(--m-text)!important;font-size:19px!important;line-height:1.15!important}
body.kol-customer .back-button,body.kol-customer .close-button,body.kol-customer .cart-close-button{width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid var(--m-line)!important;border-radius:10px!important;color:var(--m-text)!important;background:#fff!important;box-shadow:none!important;font-size:25px!important}
body.kol-customer .product-titlebar-back-text{display:none!important}
body.kol-customer .product-photo{width:100%!important;min-height:205px!important;max-height:205px!important;background-position:center!important;background-size:cover!important}
body.kol-customer .product-photo-title-wrap{display:none!important}
body.kol-customer .product-body{padding:15px!important}
body.kol-customer .product-summary{margin:0 0 14px!important;color:var(--m-muted)!important;font-size:13px!important;line-height:1.45!important}
body.kol-customer .ingredient-removal{margin:14px -15px!important;border-block:1px solid var(--m-line)!important;background:#fff!important}
body.kol-customer .ingredient-removal-heading{min-height:52px!important;padding:0 15px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;background:#f7eee1!important}
body.kol-customer .ingredient-removal-heading h3{margin:0!important;font-size:15px!important}
body.kol-customer .ingredient-removal-heading span{color:var(--m-muted)!important;font-size:11px!important;font-weight:700!important}
body.kol-customer .ingredient-chips{padding:12px 10px!important;display:flex!important;gap:7px!important;flex-wrap:wrap!important}
body.kol-customer .ingredient-chips button,body.kol-customer .ingredient-chip{min-height:38px!important;padding:0 12px!important;border:1px solid #6fd99d!important;border-radius:999px!important;color:#17834f!important;background:#effbf4!important}
body.kol-customer .option-group{margin:12px 0!important;overflow:hidden!important;border:1px solid var(--m-line)!important;border-radius:12px!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .option-group>h3,body.kol-customer .option-group>strong{margin:0!important;padding:12px 13px!important;display:block!important;border-bottom:1px solid var(--m-line)!important;background:#f7eee1!important;font-size:14px!important}
body.kol-customer .option-line{min-height:50px!important;padding:9px 12px!important;display:grid!important;grid-template-columns:22px minmax(0,1fr) auto!important;gap:9px!important;align-items:center!important;border-bottom:1px solid #eee7df!important;font-size:13px!important}
body.kol-customer .option-line input[type="radio"],body.kol-customer .option-line input[type="checkbox"]{width:20px!important;min-height:20px!important;height:20px!important;margin:0!important;padding:0!important;accent-color:var(--m-orange)!important}
body.kol-customer .note-label{display:block!important;margin-top:15px!important;font-size:12px!important;font-weight:850!important}
body.kol-customer #specialInstructions{width:100%!important;min-height:74px!important;margin-top:7px!important;padding:11px!important;border:1px solid var(--m-line)!important;border-radius:10px!important;background:#fff!important}
body.kol-customer .quantity-row{margin:15px 0!important;display:flex!important;align-items:center!important;justify-content:space-between!important}
body.kol-customer .quantity-stepper{display:flex!important;align-items:center!important;gap:7px!important}
body.kol-customer .quantity-stepper button{width:36px!important;height:36px!important;border:1px solid var(--m-line)!important;border-radius:9px!important;background:#fff!important}
body.kol-customer .allergen-note{margin:12px 0 0!important;padding:10px 11px!important;border-radius:9px!important;color:#716861!important;background:#f4f0ea!important;font-size:11px!important;line-height:1.4!important}
body.kol-customer .product-footer{flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr!important;gap:7px!important;padding:10px 12px max(10px,env(safe-area-inset-bottom))!important;border-top:1px solid var(--m-line)!important;background:#fff!important}
body.kol-customer .product-footer>strong{text-align:center!important;font-size:16px!important}
body.kol-customer #addConfiguredProduct,body.kol-customer .checkout-button,body.kol-customer .quick-checkout-submit{width:100%!important;min-height:50px!important;margin:0!important;border:0!important;border-radius:11px!important;color:#fff!important;background:var(--m-orange)!important;box-shadow:none!important;font-weight:900!important}
body.kol-customer .cart-header{flex:0 0 auto!important}
body.kol-customer .cart-content-scroll{padding:0!important;background:var(--m-bg)!important}
body.kol-customer .cart-order-card{width:100%!important;margin:0!important;padding:10px!important;display:grid!important;gap:10px!important;background:transparent!important}
body.kol-customer .cart-sales-card,body.kol-customer .checkout-form{margin:0!important;padding:13px!important;border:1px solid var(--m-line)!important;border-radius:13px!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .checkout-section-title{margin:0 0 12px!important;display:flex!important;align-items:center!important;gap:9px!important}
body.kol-customer .checkout-section-title>span{width:28px!important;height:28px!important;flex:0 0 28px!important;display:grid!important;place-items:center!important;border-radius:8px!important;color:#fff!important;background:#211b17!important;font-size:12px!important;font-weight:900!important}
body.kol-customer .checkout-section-title>div{min-width:0!important;display:grid!important;gap:2px!important}
body.kol-customer .checkout-section-title strong{font-size:15px!important}
body.kol-customer .checkout-section-title small{color:var(--m-muted)!important;font-size:10px!important}
body.kol-customer .cart-items{display:grid!important;gap:8px!important}
body.kol-customer .cart-item{padding:11px!important;border:1px solid var(--m-line)!important;border-radius:11px!important;background:#fff!important}
body.kol-customer .cart-summary{margin:11px 0 0!important;padding:12px 0 0!important;border-top:1px solid var(--m-line)!important;border-bottom:0!important}
body.kol-customer .total-row{display:flex!important;justify-content:space-between!important;font-size:17px!important}
body.kol-customer .tax-note-row{margin-top:4px!important;color:var(--m-muted)!important;font-size:11px!important}
body.kol-customer .pickup-options{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}
body.kol-customer .pickup-option{margin:0!important}
body.kol-customer .pickup-option input{position:absolute!important;opacity:0!important;pointer-events:none!important}
body.kol-customer .pickup-option span{min-height:48px!important;padding:0 8px!important;display:grid!important;place-items:center!important;border:1px solid var(--m-line)!important;border-radius:10px!important;background:#fff!important;font-size:11px!important;font-weight:850!important;text-align:center!important}
body.kol-customer .pickup-option:has(input:checked) span{border-color:#f09b65!important;color:#d9521f!important;background:#fff3ec!important}
body.kol-customer .checkout-help{margin:8px 0!important;color:var(--m-muted)!important;font-size:10px!important;line-height:1.4!important}
body.kol-customer .checkout-grid{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
body.kol-customer .checkout-grid label{font-size:11px!important;font-weight:850!important}
body.kol-customer .checkout-grid input,body.kol-customer #pickupTime{width:100%!important;min-height:48px!important;margin-top:6px!important;padding:0 11px!important;border:1px solid var(--m-line)!important;border-radius:10px!important;color:var(--m-text)!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .contact-privacy-note{margin:10px 0 0!important;color:var(--m-muted)!important;font-size:10px!important;line-height:1.4!important}
body.kol-customer .checkout-footer{flex:0 0 auto!important;padding:8px 10px max(9px,env(safe-area-inset-bottom))!important;border-top:1px solid var(--m-line)!important;background:#fff!important}
body.kol-customer .checkout-next-hint{display:block!important;margin-bottom:5px!important;color:var(--m-muted)!important;font-size:10px!important;text-align:center!important}
body.kol-customer .profile-body,body.kol-customer .order-live-content{padding:12px!important;background:var(--m-bg)!important}
body.kol-customer .profile-order-card,body.kol-customer .profile-favorite-item{border:1px solid var(--m-line)!important;border-radius:11px!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .info-grid{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;padding:12px!important;background:var(--m-bg)!important}
body.kol-customer .info-block{padding:12px!important;border:1px solid var(--m-line)!important;border-radius:11px!important;background:#fff!important}
body.kol-customer .privacy-note{margin:0!important;padding:0 12px 14px!important;color:var(--m-muted)!important;background:var(--m-bg)!important;font-size:10px!important}
body.kol-customer .quick-checkout-panel{padding:15px!important}
body.kol-customer .quick-checkout-grid{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
body.kol-customer .quick-checkout-grid input{width:100%!important;min-height:48px!important;margin-top:6px!important;padding:0 11px!important;border:1px solid var(--m-line)!important;border-radius:10px!important}
body.kol-customer .quick-checkout-actions{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:12px!important}
@media(max-width:360px){body.kol-customer{min-width:280px}body.kol-customer .appbar{padding-inline:9px!important}body.kol-customer .brand-label b{font-size:34px!important}body.kol-customer .appbar-actions{gap:5px!important}body.kol-customer .icon-button,body.kol-customer .cart-toggle{width:39px!important;min-width:39px!important;height:39px!important;min-height:39px!important}body.kol-customer .menu-row{grid-template-columns:72px minmax(0,1fr) 50px!important;gap:8px!important}body.kol-customer .menu-thumb-wrap,body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"],body.kol-customer .menu-thumb-wrap>.food-thumb,body.kol-customer .menu-thumb-wrap>[class*="thumb"]{width:72px!important;min-width:72px!important;height:80px!important}body.kol-customer .menu-app-product-side,body.kol-customer .rescue-product-side{height:80px!important}body.kol-customer .menu-row-headline strong{font-size:14px!important}}
'''

# Compact but readable. Preserve rule order; remove duplicate exact rules after customer stripping.
out=base+mobile
out=re.sub(r'\s+',' ',out).strip()
CSS.write_text(out,encoding='utf-8')
after=len(out.encode('utf-8'))

# Bust browser cache and explicitly mark the customer document as compact-only.
idx=INDEX.read_text(encoding='utf-8')
idx=re.sub(r'href=["\']kol-core\.css(?:\?[^"\']*)?["\']','href="kol-core.css?v=mobile-only-3"',idx,count=1)
INDEX.write_text(idx,encoding='utf-8')

# Required checks.
assert out.count('{')==out.count('}')
assert 'body.kol-customer{--m-orange' in out
assert 'max-width:480px' in out
assert 'grid-template-columns:1fr!important' in out
assert 'repeat(2, minmax(0, 1fr))' not in mobile
assert '<style' not in idx.lower()
print(f'CSS {before} -> {after} bytes; removed customer selectors: {removed_customer_selectors}; removed keyframes: {removed_keyframes}')
