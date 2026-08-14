from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache/version
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v12', html, count=1)

# On the combined second checkout screen, show contact as visible step 2 first,
# then pickup time as visible step 3. No extra click/page is introduced.
pattern = re.compile(
    r'(        <section class="checkout-form checkout-step-card checkout-step-panel" id="checkoutPickupSection" data-checkout-step="2" hidden>.*?</section>\n)'
    r'(        <section aria-label="Kontaktinformasjon" class="checkout-form checkout-contact-card checkout-step-card checkout-step-panel" id="checkoutContactSection" data-checkout-step="2" hidden>.*?</section>\n)',
    re.S,
)
m = pattern.search(html)
if not m:
    raise SystemExit('checkout pickup/contact blocks not found')
pickup, contact = m.group(1), m.group(2)
pickup = pickup.replace('<div class="checkout-section-title"><span>2</span>', '<div class="checkout-section-title"><span>3</span>', 1)
contact = contact.replace('<div class="checkout-section-title"><span>3</span>', '<div class="checkout-section-title"><span>2</span>', 1)
html = html[:m.start()] + contact + pickup + html[m.end():]
html = html.replace('2: { label: "Send bestilling", hint: "Velg hentetid og kontroller kontaktinformasjonen" }',
                    '2: { label: "Send bestilling", hint: "Kontroller navn og telefon, velg deretter hentetid" }', 1)

# Remove obsolete stacked mobile override patches; replace with one consolidated block.
marker = '/* ===== THREE-STEP CHECKOUT V8 ===== */'
if marker in css:
    css = css.split(marker, 1)[0].rstrip() + '\n\n'
else:
    # Fallback if prior cleanup already happened.
    for old_marker in ['/* KOL MOBILE V9:', '/* ===== MOBILE V10:', '/* ===== MOBILE V11:']:
        if old_marker in css:
            css = css.split(old_marker, 1)[0].rstrip() + '\n\n'
            break

css += r'''
/* ===== MOBILE V12: compact square product / cart / orders ===== */
@layer mobile{
/* Keep product categories available while viewing a product. */
body.kol-customer.kol-product-detail-open .category-tabs-wrap{display:block!important;visibility:visible!important}
body.kol-customer.kol-product-detail-open .product-modal.mobile-screen{top:calc(var(--head) + var(--tabs))!important;height:calc(100dvh - var(--head) - var(--tabs))!important}
body.kol-customer.kol-product-detail-open .category-tabs-scroll{display:flex!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;scrollbar-width:none!important}
body.kol-customer.kol-product-detail-open .category-tabs-scroll::-webkit-scrollbar{display:none!important}

/* Clean Meny back control. */
body.kol-customer .brand-back-label{display:none!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;height:46px!important;padding:0 2px!important;color:#fff!important;font-size:0!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important}
body.kol-customer.kol-top-back-active .brand-back-label{display:flex!important}
body.kol-customer .brand-back-label::before{content:"‹";display:block!important;flex:0 0 auto!important;margin-top:-2px!important;color:#fff!important;font-family:Arial,sans-serif!important;font-size:32px!important;font-weight:500!important;line-height:.8!important}
body.kol-customer .brand-back-label::after{content:"Meny";display:block!important;color:#fff!important;font-size:18px!important;font-weight:900!important;line-height:1!important;letter-spacing:-.15px!important}
body.kol-customer.kol-top-back-active .appbar-brand{min-width:104px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important}

/* No rounded cards/controls inside product, cart or Mine bestillinger. */
body.kol-customer .product-modal *,
body.kol-customer .cart-modal *,
body.kol-customer .profile-modal *{border-radius:0!important;box-shadow:none!important}

/* PRODUCT: compact, edge-to-edge, no card gaps. */
body.kol-customer .product-modal.mobile-screen{background:#fff!important}
body.kol-customer .product-scroll-content{padding:0!important;background:#fff!important}
body.kol-customer .product-photo{height:180px!important;min-height:180px!important;max-height:180px!important;margin:0!important;border:0!important}
body.kol-customer .product-photo-title-wrap{margin:0!important;padding:11px 14px 6px!important;border-bottom:0!important;background:#fff!important}
body.kol-customer .product-photo-title-chip,body.kol-customer .product-photo-title-chip h2{margin:0!important;padding:0!important;background:transparent!important}
body.kol-customer .product-photo-title-chip h2{font-size:26px!important;line-height:1.08!important}
body.kol-customer .product-body{width:100%!important;margin:0!important;padding:0!important;background:#fff!important}
body.kol-customer.kol-product-detail-open .product-summary{display:block!important;margin:0!important;padding:0 14px 10px!important;border-bottom:1px solid var(--line)!important;color:var(--muted)!important;font-size:15.5px!important;line-height:1.42!important;font-weight:500!important}
body.kol-customer .ingredient-removal,body.kol-customer .option-group{width:100%!important;margin:0!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .ingredient-removal-heading,body.kol-customer .option-group>h3{min-height:44px!important;margin:0!important;padding:0 14px!important;border:0!important;font-size:16px!important;font-weight:900!important}
body.kol-customer .ingredient-removal-heading>span{font-size:12px!important}
body.kol-customer .ingredient-chips{margin:0!important;padding:9px 14px 10px!important;gap:6px!important;border-top:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .ingredient-chip{min-height:38px!important;padding:0 11px!important;font-size:15px!important;border:1px solid #6ee09a!important;color:#168242!important;background:#f2fff6!important}
body.kol-customer .ingredient-chip.removed{border-color:#f3a29c!important;color:#c9443c!important;background:#fff2f1!important;text-decoration:line-through!important}
body.kol-customer .ingredient-chip.locked,body.kol-customer .ingredient-chip:disabled{opacity:1!important;border-color:#d5d1cc!important;color:#8b8580!important;background:#ece9e5!important;cursor:default!important;text-decoration:none!important}
body.kol-customer .ingredient-chip.locked span,body.kol-customer .ingredient-chip:disabled span{color:#a7a19b!important}
body.kol-customer #optionGroups{width:100%!important;margin:0!important;padding:0!important}
body.kol-customer .option-line{min-height:48px!important;margin:0!important;padding:0 14px!important;border-top:1px solid #eee7e0!important;background:#fff!important}
body.kol-customer .note-label{display:block!important;margin:0!important;padding:10px 14px 5px!important;font-size:14px!important;background:#fff!important}
body.kol-customer #specialInstructions{width:calc(100% - 28px)!important;min-height:68px!important;margin:0 14px 8px!important;padding:10px 12px!important;border:1px solid #dcd3ca!important;background:#fff!important}
body.kol-customer .quantity-row{min-height:54px!important;margin:0!important;padding:7px 14px!important;border-top:1px solid var(--line)!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .quantity-stepper{gap:0!important}
body.kol-customer .quantity-stepper button{width:40px!important;height:40px!important;border:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .allergen-note{margin:0!important;padding:7px 14px!important;color:var(--muted)!important;font-size:12px!important;line-height:1.35!important;background:#fff!important}
body.kol-customer .product-footer{width:100%!important;min-height:64px!important;margin:0!important;padding:7px 10px max(7px,env(safe-area-inset-bottom))!important;display:grid!important;grid-template-columns:100px minmax(0,1fr)!important;gap:8px!important;border-top:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .product-footer>strong{min-width:0!important;font-size:17px!important}
body.kol-customer .product-footer #addConfiguredProduct{width:100%!important;min-width:0!important;min-height:50px!important;margin:0!important;border:0!important;color:#fff!important;background:#f56627!important;font-size:15px!important;font-weight:900!important}

/* CART: flush sections, no floating cards and no beige gutters. */
body.kol-customer .cart-panel,body.kol-customer .cart-content-scroll,body.kol-customer .cart-order-card{background:#fff!important}
body.kol-customer .cart-content-scroll{padding:0!important}
body.kol-customer .cart-order-card{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}
body.kol-customer .checkout-step-panel,body.kol-customer .cart-sales-card,body.kol-customer .checkout-step-card{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .checkout-step-panel[hidden]{display:none!important}
body.kol-customer .checkout-step-panel.is-active{display:block!important}
body.kol-customer .checkout-section-title{min-height:56px!important;margin:0!important;padding:8px 12px!important;display:flex!important;align-items:center!important;gap:10px!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .checkout-section-title>span{width:36px!important;height:36px!important;display:grid!important;place-items:center!important;flex:0 0 36px!important;border:0!important;color:#fff!important;background:#211d19!important;font-size:14px!important;font-weight:900!important}
body.kol-customer .checkout-section-title strong{display:block!important;font-size:16px!important;line-height:1.18!important}
body.kol-customer .checkout-section-title small{display:block!important;margin-top:2px!important;color:var(--muted)!important;font-size:12px!important;line-height:1.25!important}
body.kol-customer .cart-items{display:grid!important;gap:0!important;margin:0!important;padding:0!important}
body.kol-customer .cart-item{width:100%!important;min-width:0!important;margin:0!important;padding:9px 10px!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .cart-item-actions{display:flex!important;gap:4px!important}.cart-item-actions button{width:34px!important;height:34px!important;border:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .cart-summary{margin:0!important;padding:10px 12px!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .total-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}.total-row strong{font-size:19px!important}.tax-note-row{margin-top:2px!important;color:var(--muted)!important}
body.kol-customer .checkout-grid{margin:0!important;padding:10px 12px 7px!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important;background:#fff!important}
body.kol-customer .checkout-grid label{display:grid!important;gap:4px!important;font-size:13px!important;font-weight:850!important}
body.kol-customer .checkout-grid input{min-height:48px!important;margin:0!important;padding:9px 11px!important;border:1px solid #ddd2c7!important;background:#fff!important;font-size:15px!important}
body.kol-customer .contact-privacy-note{margin:0!important;padding:0 12px 9px!important;color:var(--muted)!important;font-size:11.5px!important;line-height:1.35!important;background:#fff!important}
body.kol-customer .pickup-choice{width:100%!important;margin:0!important;padding:9px 12px 10px!important;background:#fff!important}
body.kol-customer .pickup-options{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin:0!important;padding:0!important}
body.kol-customer .pickup-option{position:relative!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important}
body.kol-customer .pickup-option input{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
body.kol-customer .pickup-option span{position:relative!important;width:100%!important;min-height:54px!important;margin:0!important;padding:0 40px 0 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #ddd2c7!important;color:#2c241f!important;background:#fff!important;font-size:13px!important;font-weight:900!important;text-align:center!important}
body.kol-customer .pickup-option span::after{content:""!important;position:absolute!important;right:9px!important;top:50%!important;width:22px!important;height:22px!important;border:1px solid #d8cec4!important;background:#fff!important;transform:translateY(-50%)!important}
body.kol-customer .pickup-option input:checked+span{border-color:#f56627!important;color:#d94d16!important;background:#fff4ee!important}
body.kol-customer .pickup-option input:checked+span::after{content:"✓"!important;display:grid!important;place-items:center!important;border-color:#f56627!important;color:#fff!important;background:#f56627!important;font-size:13px!important;font-weight:900!important}
body.kol-customer #pickupHelp{margin:7px 0 0!important;color:var(--muted)!important;font-size:11.5px!important;line-height:1.35!important}
body.kol-customer #pickupTime{width:100%!important;min-height:46px!important;margin:7px 0 0!important;border:1px solid #ddd2c7!important;background:#fff!important;font-size:14px!important;font-weight:800!important}
body.kol-customer .checkout-footer{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:7px 9px max(7px,env(safe-area-inset-bottom))!important;overflow:hidden!important;border-top:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .checkout-progress{width:100%!important;min-width:0!important;margin:0 0 6px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}
body.kol-customer .checkout-step-counter{font-size:11.5px!important;font-weight:900!important;white-space:nowrap!important}.checkout-next-hint{min-width:0!important;margin:0!important;color:var(--muted)!important;font-size:10.5px!important;text-align:right!important;white-space:normal!important}
body.kol-customer .checkout-footer-actions{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;display:grid!important;grid-template-columns:88px minmax(0,1fr)!important;gap:6px!important}
body.kol-customer[data-checkout-step="1"] .checkout-footer-actions{grid-template-columns:1fr!important}
body.kol-customer .checkout-back-button{width:100%!important;min-width:0!important;min-height:48px!important;margin:0!important;border:1px solid var(--line)!important;color:var(--ink)!important;background:#fff!important;font-size:13px!important;font-weight:900!important}
body.kol-customer .checkout-back-button[hidden]{display:none!important}
body.kol-customer .checkout-button{width:100%!important;max-width:100%!important;min-width:0!important;min-height:48px!important;margin:0!important;padding:0 10px!important;border:0!important;color:#fff!important;background:#f56627!important;font-size:14.5px!important;font-weight:900!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
body.kol-customer .checkout-button:disabled{opacity:.55!important}

/* MINE BESTILLINGER: one flat list, no card gaps. */
body.kol-customer .profile-panel,body.kol-customer .profile-body{background:#fff!important}
body.kol-customer .profile-body{padding:0!important}
body.kol-customer .profile-order-section{display:grid!important;gap:0!important;margin:0!important;padding:0!important}
body.kol-customer .profile-order-card{width:100%!important;margin:0!important;overflow:hidden!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .profile-order-card.is-cancelled,body.kol-customer .profile-order-card.cancelled{background:#fff0ef!important;border-color:#ffc7c2!important}
body.kol-customer .profile-order-card.is-ready,body.kol-customer .profile-order-card.ready{background:#eaf9ef!important;border-color:#afe4c3!important}
body.kol-customer .profile-order-card.is-pending,body.kol-customer .profile-order-card.pending,body.kol-customer .profile-order-card.is-confirmed,body.kol-customer .profile-order-card.confirmed{background:#fff6da!important;border-color:#ecd384!important}
body.kol-customer .profile-order-summary{width:100%!important;min-height:88px!important;margin:0!important;padding:10px 12px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;border:0!important;background:transparent!important;text-align:left!important}
body.kol-customer .profile-order-main{min-width:0!important}.profile-order-title-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important}.profile-order-meta{display:flex!important;flex-wrap:wrap!important;gap:5px!important;margin-top:5px!important;color:var(--muted)!important;font-size:10.5px!important}.profile-order-total{align-self:end!important;font-size:15px!important;font-weight:900!important}

/* No movement. */
body.kol-customer .product-modal *:hover,body.kol-customer .cart-modal *:hover,body.kol-customer .profile-modal *:hover{transform:none!important;box-shadow:none!important}

@media(max-width:390px){
 body.kol-customer .product-photo{height:166px!important;min-height:166px!important;max-height:166px!important}
 body.kol-customer .pickup-options{grid-template-columns:1fr 1fr!important}
 body.kol-customer .checkout-footer-actions{grid-template-columns:82px minmax(0,1fr)!important}
}
}
'''

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

assert 'mobile-v12' in html
assert html.index('id="checkoutContactSection"') < html.index('id="checkoutPickupSection"')
assert '<span>2</span><div><strong>Navn og telefon</strong>' in html
assert '<span>3</span><div><strong>Velg hentetid</strong>' in html
assert 'MOBILE V12: compact square product / cart / orders' in css
assert 'THREE-STEP CHECKOUT V8' not in css
assert 'MOBILE V11' not in css
print('mobile v12 ready')
