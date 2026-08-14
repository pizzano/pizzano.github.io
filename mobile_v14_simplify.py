from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache bust.
html = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v14', html, count=1)

# Step 3 is its own screen.
html = html.replace('id="checkoutPickupSection" data-checkout-step="2" hidden', 'id="checkoutPickupSection" data-checkout-step="3" hidden', 1)

# Remove explanatory clutter from checkout headings and privacy note; labels remain clear.
html = re.sub(r'(<div class="checkout-section-title"><span>1</span><div><strong>Din bestilling</strong>)<small>.*?</small>', r'\1', html, count=1)
html = re.sub(r'(<div class="checkout-section-title"><span>2</span><div><strong>Navn og telefon</strong>)<small>.*?</small>', r'\1', html, count=1)
html = re.sub(r'(<div class="checkout-section-title"><span>3</span><div><strong>Velg hentetid</strong>)<small>.*?</small>', r'\1', html, count=1)
html = re.sub(r'\s*<p class="contact-privacy-note">.*?</p>', '', html, count=1, flags=re.S)

# 3-step visibility and navigation.
html = re.sub(
    r'function syncCheckoutStepVisibility\(\) \{.*?\n\}',
    '''function syncCheckoutStepVisibility() {
  const safeStep = Math.max(1, Math.min(3, Number(checkoutStep || 1)));
  checkoutStep = safeStep;
  const sections = [
    [1, checkoutOrderSection],
    [2, checkoutContactSection],
    [3, checkoutPickupSection]
  ];
  sections.forEach(([step, section]) => {
    if (!section) return;
    const active = step === safeStep;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
    section.setAttribute("aria-hidden", active ? "false" : "true");
  });
  if (checkoutBackButton) checkoutBackButton.hidden = safeStep === 1;
  if (checkoutStepCounter) checkoutStepCounter.textContent = `Steg ${safeStep} av 3`;
  document.body.dataset.checkoutStep = String(safeStep);
}''',
    html, count=1, flags=re.S)

html = re.sub(
    r'function setCheckoutStep\(step, options = \{\}\) \{.*?\n\}',
    '''function setCheckoutStep(step, options = {}) {
  checkoutStep = Math.max(1, Math.min(3, Number(step || 1)));
  updateCheckoutButtonState();
  const scroller = document.querySelector(".cart-content-scroll");
  if (scroller) scroller.scrollTop = 0;
  if (options.focus) window.requestAnimationFrame(() => options.focus?.focus({ preventScroll: true }));
}''',
    html, count=1, flags=re.S)

html = re.sub(
    r'function updateCheckoutButtonState\(\) \{.*?\n\}',
    '''function updateCheckoutButtonState() {
  if (!checkoutButton) return;
  syncCheckoutStepVisibility();
  const steps = {
    1: { label: "Neste" },
    2: { label: "Neste" },
    3: { label: "Send bestilling" }
  };
  const current = steps[checkoutStep] || steps[1];
  checkoutButton.textContent = current.label;
  checkoutButton.disabled = cart.length === 0 || !canAcceptOrdersNow();
  checkoutButton.dataset.step = String(checkoutStep);
  if (checkoutNextHint) checkoutNextHint.textContent = "";
}''',
    html, count=1, flags=re.S)

html = re.sub(
    r'function handleCheckoutButtonClick\(\) \{.*?\n\}',
    '''function handleCheckoutButtonClick() {
  if (!cart.length) return;
  if (checkoutStep === 1) {
    setCheckoutStep(2, { focus: customerFullName });
    return;
  }
  if (checkoutStep === 2) {
    if (!validateContactStep()) return;
    setCheckoutStep(3);
    return;
  }
  if (!validatePickupStep()) return;
  submitOrder();
}''',
    html, count=1, flags=re.S)

# Shorter pickup guidance.
html = re.sub(
    r'if \(openNow\) \{\n    pickupHelp\.textContent = mode === "asap".*?\n  \}',
    '''if (openNow) {
    pickupHelp.textContent = mode === "asap"
      ? `Klar ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  } else {
    pickupHelp.textContent = mode === "asap"
      ? `Første henting ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  }''',
    html, count=1, flags=re.S)

# Replace only the latest override block instead of stacking more patches.
for marker in ['/* ===== MOBILE V13:', '/* ===== MOBILE V12:']:
    if marker in css:
        css = css.split(marker, 1)[0].rstrip() + '\n\n'
        break

css += r'''
/* ===== MOBILE V14: simple readable customer UI ===== */
@layer mobile{
:root{--ui-font:16px;--ui-small:14px;--ui-title:19px}
body.kol-customer{font-size:var(--ui-font)!important}

/* One clear type scale across the app. */
body.kol-customer .category-tab,body.kol-customer [data-category-tab]{font-size:14px!important}
body.kol-customer .menu-app-section-head h2{font-size:26px!important}
body.kol-customer .menu-app-section-head p,body.kol-customer .menu-row-description{font-size:14px!important;line-height:1.4!important}
body.kol-customer .menu-row-headline strong{font-size:17px!important;line-height:1.2!important}
body.kol-customer .menu-row-inline-price{font-size:15px!important}
body.kol-customer .brand-back-label::after{font-size:19px!important}
body.kol-customer .appbar-context-title{font-size:18px!important}

/* Product: only useful information, readable controls. */
body.kol-customer .product-modal *,body.kol-customer .cart-modal *,body.kol-customer .profile-modal *{box-shadow:none!important}
body.kol-customer .product-photo-title-chip h2{font-size:26px!important}
body.kol-customer.kol-product-detail-open .product-summary{display:none!important}
body.kol-customer .ingredient-removal-heading>span,body.kol-customer .ingredient-removal-help{display:none!important}
body.kol-customer .ingredient-removal-heading,body.kol-customer .option-group>h3{min-height:46px!important;font-size:17px!important;padding:0 14px!important}
body.kol-customer .ingredient-chip{min-height:42px!important;padding:0 13px!important;font-size:16px!important}
body.kol-customer .option-line,body.kol-customer .option-line label,body.kol-customer .option-line span{font-size:16px!important}
body.kol-customer .note-label{font-size:16px!important;font-weight:850!important}
body.kol-customer #specialInstructions{font-size:16px!important}
body.kol-customer .quantity-row{min-height:66px!important;font-size:17px!important;font-weight:850!important}
body.kol-customer .quantity-stepper{width:172px!important;height:52px!important;display:grid!important;grid-template-columns:54px 64px 54px!important;gap:0!important;border:1px solid var(--line)!important}
body.kol-customer .quantity-stepper button{width:54px!important;height:50px!important;border:0!important;background:#fff!important;font-size:22px!important}
body.kol-customer .quantity-stepper strong{display:grid!important;place-items:center!important;width:64px!important;height:50px!important;font-size:19px!important;border-left:1px solid var(--line)!important;border-right:1px solid var(--line)!important}
body.kol-customer .allergen-note{font-size:14px!important;line-height:1.4!important}
body.kol-customer .product-footer>strong{font-size:19px!important}
body.kol-customer .product-footer #addConfiguredProduct{font-size:17px!important}

/* Checkout: one screen = one task. */
body.kol-customer .cart-panel,body.kol-customer .cart-content-scroll,body.kol-customer .cart-order-card{background:#fff!important}
body.kol-customer .cart-content-scroll{padding:0!important}
body.kol-customer .checkout-step-panel{width:100%!important;margin:0!important;padding:0!important;border:0!important;background:#fff!important}
body.kol-customer .checkout-step-panel[hidden]{display:none!important}
body.kol-customer .checkout-step-panel.is-active{display:block!important}
body.kol-customer .checkout-section-title{min-height:58px!important;margin:0!important;padding:10px 14px!important;display:flex!important;align-items:center!important;gap:11px!important;border-bottom:1px solid var(--line)!important}
body.kol-customer .checkout-section-title>span{width:38px!important;height:38px!important;flex:0 0 38px!important;display:grid!important;place-items:center!important;background:#211d19!important;color:#fff!important;font-size:16px!important;font-weight:900!important}
body.kol-customer .checkout-section-title strong{font-size:19px!important;line-height:1.15!important}
body.kol-customer .checkout-section-title small{display:none!important}
body.kol-customer .cart-items{display:block!important;margin:0!important;padding:0!important}
body.kol-customer .cart-item{margin:0!important;padding:12px 14px!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important;font-size:15px!important}
body.kol-customer .cart-item strong,body.kol-customer .cart-item-title,body.kol-customer .cart-item-name{font-size:17px!important;line-height:1.25!important}
body.kol-customer .cart-item small,body.kol-customer .cart-item-meta,body.kol-customer .cart-item-details{font-size:14px!important;line-height:1.4!important}
body.kol-customer .cart-item-qty,body.kol-customer .cart-quantity,body.kol-customer .quantity-badge{font-size:16px!important;font-weight:900!important}
body.kol-customer .cart-item-actions button{width:42px!important;height:42px!important;font-size:17px!important}
body.kol-customer .cart-summary{margin:0!important;padding:14px!important;border:0!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .total-row{font-size:17px!important}.total-row strong{font-size:24px!important}.tax-note-row{font-size:14px!important}

/* Contact step. */
body.kol-customer .checkout-grid{margin:0!important;padding:14px!important;display:grid!important;gap:14px!important}
body.kol-customer .checkout-grid label{display:grid!important;gap:6px!important;font-size:16px!important;font-weight:850!important}
body.kol-customer .checkout-grid input{min-height:56px!important;padding:11px 13px!important;border:1px solid #d9d0c7!important;font-size:18px!important;background:#fff!important}
body.kol-customer .contact-privacy-note{display:none!important}

/* Pickup step. */
body.kol-customer .pickup-choice{margin:0!important;padding:14px!important}
body.kol-customer .pickup-options{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
body.kol-customer .pickup-option{position:relative!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important}
body.kol-customer .pickup-option input{position:absolute!important;opacity:0!important;pointer-events:none!important}
body.kol-customer .pickup-option span{position:relative!important;min-height:58px!important;padding:0 40px 0 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #d9d0c7!important;background:#fff!important;font-size:16px!important;font-weight:900!important;text-align:center!important}
body.kol-customer .pickup-option span::after{content:""!important;position:absolute!important;right:10px!important;top:50%!important;width:24px!important;height:24px!important;border:1px solid #d6cdc4!important;background:#fff!important;transform:translateY(-50%)!important}
body.kol-customer .pickup-option input:checked+span{border-color:var(--o)!important;color:#d94d16!important;background:#fff5ef!important}
body.kol-customer .pickup-option input:checked+span::after{content:"✓"!important;display:grid!important;place-items:center!important;border-color:var(--o)!important;color:#fff!important;background:var(--o)!important;font-size:15px!important}
body.kol-customer #pickupHelp{margin:10px 0 0!important;color:var(--muted)!important;font-size:15px!important;line-height:1.35!important}
body.kol-customer #pickupTime{min-height:54px!important;margin-top:10px!important;font-size:16px!important}

/* Footer: only navigation buttons, no explanatory clutter. */
body.kol-customer .checkout-footer{margin:0!important;padding:10px!important;border-top:1px solid var(--line)!important;background:#fff!important}
body.kol-customer .checkout-progress{display:none!important}
body.kol-customer .checkout-footer-actions{width:100%!important;display:grid!important;grid-template-columns:104px minmax(0,1fr)!important;gap:8px!important}
body.kol-customer[data-checkout-step="1"] .checkout-footer-actions{grid-template-columns:1fr!important}
body.kol-customer .checkout-back-button,body.kol-customer .checkout-button{min-height:54px!important;margin:0!important;font-size:17px!important;font-weight:900!important}
body.kol-customer .checkout-back-button{border:1px solid var(--line)!important;background:#fff!important;color:var(--ink)!important}
body.kol-customer .checkout-button{border:0!important;background:var(--o)!important;color:#fff!important}

/* Mine bestillinger: compact and consistent. */
body.kol-customer .profile-body{padding:0!important;background:#fff!important}
body.kol-customer .profile-order-card{margin:0!important;border:0!important;border-bottom:1px solid var(--line)!important;box-shadow:none!important}
body.kol-customer .profile-order-summary{min-height:82px!important;padding:12px 14px!important}
body.kol-customer .profile-order-title-row,body.kol-customer .profile-order-title-row strong{font-size:17px!important}
body.kol-customer .profile-order-meta{font-size:14px!important;line-height:1.4!important}
body.kol-customer .profile-order-total{font-size:17px!important}

/* No movement anywhere. */
body.kol-customer *{animation:none!important;transition:none!important}
body.kol-customer *:hover{transform:none!important}
}
'''

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('mobile-v14 written', len(html), len(css))
