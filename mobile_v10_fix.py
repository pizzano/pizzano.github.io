from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache-bust only; no logic change.
html = html.replace('kol-core.css?v=mobile-v9', 'kol-core.css?v=mobile-v10', 1)

# Contact remains on same screen as pickup, but is clearly task/step 3.
html = html.replace(
    '<div class="checkout-section-title"><div><strong>Navn og telefon</strong><small>Kontroller at opplysningene stemmer</small></div></div>',
    '<div class="checkout-section-title"><span>3</span><div><strong>Navn og telefon</strong><small>Kontroller at opplysningene stemmer</small></div></div>',
    1
)

# Footer wording: two screens, three clear tasks.
html = html.replace('id="checkoutStepCounter">Steg 1 av 2</strong>', 'id="checkoutStepCounter">Steg 1</strong>', 1)
html = html.replace(
    'checkoutStepCounter.textContent = `Steg ${safeStep} av 2`;',
    'checkoutStepCounter.textContent = safeStep === 1 ? "Steg 1" : "Steg 2–3";',
    1
)

# Ensure the top back label remains the concise Norwegian "Meny".
html = html.replace('brandBackLabel.textContent = "Tilbake";', 'brandBackLabel.textContent = "Meny";')

# Append one scoped stabilization block. This overrides v9 without touching menu/admin logic.
css += r'''

/* ===== MOBILE V10: stable product + checkout alignment ===== */
@layer mobile{
/* Product: restore horizontal category navigation while product is open. */
body.kol-customer.kol-product-detail-open .category-tabs-wrap{
  display:block!important;
  visibility:visible!important;
}
body.kol-customer.kol-product-detail-open .product-modal.mobile-screen{
  top:calc(var(--head) + var(--tabs))!important;
  height:calc(100dvh - var(--head) - var(--tabs))!important;
}
body.kol-customer.kol-product-detail-open .category-tabs-scroll{
  display:flex!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  white-space:nowrap!important;
  scrollbar-width:none!important;
}
body.kol-customer.kol-product-detail-open .category-tabs-scroll::-webkit-scrollbar{display:none!important}

/* Restore the product ingredient/description line and make it easier to read. */
body.kol-customer.kol-product-detail-open .product-summary{
  display:block!important;
  margin:0!important;
  padding:0 18px 16px!important;
  color:var(--muted)!important;
  font-size:15.5px!important;
  line-height:1.5!important;
  font-weight:500!important;
}
body.kol-customer.kol-product-detail-open .product-photo-title-wrap{
  padding:16px 18px 8px!important;
}
body.kol-customer.kol-product-detail-open .product-photo-title-chip h2{
  font-size:27px!important;
}
body.kol-customer.kol-product-detail-open .ingredient-removal-heading h3,
body.kol-customer.kol-product-detail-open .option-group>h3{
  font-size:16px!important;
}
body.kol-customer.kol-product-detail-open .ingredient-chip{
  font-size:15px!important;
}

/* Checkout: never let the bottom CTA escape the mobile viewport. */
body.kol-customer .checkout-footer{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:10px 12px max(10px,env(safe-area-inset-bottom))!important;
  overflow:hidden!important;
  box-sizing:border-box!important;
}
body.kol-customer .checkout-progress{
  width:100%!important;
  min-width:0!important;
  margin:0 0 8px!important;
  padding:0 2px!important;
  box-sizing:border-box!important;
}
body.kol-customer .checkout-footer-actions{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  display:grid!important;
  grid-template-columns:104px minmax(0,1fr)!important;
  gap:8px!important;
  align-items:stretch!important;
  box-sizing:border-box!important;
}
body.kol-customer .checkout-back-button{
  width:104px!important;
  max-width:104px!important;
  min-width:0!important;
  margin:0!important;
  box-sizing:border-box!important;
}
body.kol-customer .checkout-back-button[hidden]{display:none!important}
body.kol-customer .checkout-back-button[hidden] + .checkout-button{
  grid-column:1 / -1!important;
}
body.kol-customer .checkout-button{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding-left:12px!important;
  padding-right:12px!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}

/* Pickup + contact are one compact screen, but visibly numbered 2 and 3. */
body.kol-customer #checkoutPickupSection,
body.kol-customer #checkoutContactSection{
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  box-sizing:border-box!important;
}
body.kol-customer #checkoutContactSection .checkout-section-title{
  border-top:1px solid var(--line)!important;
}
}
'''

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')

assert 'kol-core.css?v=mobile-v10' in html
assert 'Steg 2–3' in html
assert '<span>3</span><div><strong>Navn og telefon</strong>' in html
assert 'MOBILE V10: stable product + checkout alignment' in css
print('mobile v10 patch ready')
