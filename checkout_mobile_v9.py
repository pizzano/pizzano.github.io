from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache bump.
html = html.replace('kol-core.css?v=mobile-v8', 'kol-core.css?v=mobile-v9')

# Short, clear menu return label.
html = html.replace('<span aria-hidden="true" class="brand-back-label">‹ Tilbake</span>', '<span aria-hidden="true" class="brand-back-label">‹ Meny</span>', 1)
html = html.replace('class="product-titlebar-back-text" id="closeProductText" type="button">Tilbake til meny</button>', 'class="product-titlebar-back-text" id="closeProductText" type="button">Meny</button>', 1)
html = html.replace('brandBackLabel.textContent = "Tilbake";', 'brandBackLabel.textContent = "Meny";')

# Checkout becomes two screens: products, then pickup + contact together.
html = html.replace('data-checkout-step="3" hidden>', 'data-checkout-step="2" hidden>', 1)
html = html.replace('<div class="checkout-section-title"><span>3</span><div><strong>Navn og telefon</strong><small>Så vi vet hvem bestillingen tilhører</small></div></div>', '<div class="checkout-section-title"><div><strong>Navn og telefon</strong><small>Kontroller at opplysningene stemmer</small></div></div>', 1)
html = html.replace('Steg 1 av 3', 'Steg 1 av 2', 1)

old_sync = '''function syncCheckoutStepVisibility() {
  const safeStep = Math.max(1, Math.min(3, Number(checkoutStep || 1)));
  checkoutStep = safeStep;
  const sections = [
    [1, checkoutOrderSection],
    [2, checkoutPickupSection],
    [3, checkoutContactSection]
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
}

function setCheckoutStep(step, options = {}) {
  checkoutStep = Math.max(1, Math.min(3, Number(step || 1)));
  updateCheckoutButtonState();
  const scroller = document.querySelector(".cart-content-scroll");
  if (scroller) scroller.scrollTop = 0;
  if (options.focus) {
    window.requestAnimationFrame(() => options.focus?.focus({ preventScroll: true }));
  }
}

function updateCheckoutButtonState() {
  if (!checkoutButton) return;
  syncCheckoutStepVisibility();
  const steps = {
    1: { label: "Neste · velg hentetid", hint: "Kontroller varene og sluttsummen" },
    2: { label: "Neste · navn og telefon", hint: "Velg når maten skal være klar" },
    3: { label: "Send bestilling", hint: "Kontroller navn og telefon før du sender" }
  };
  const current = steps[checkoutStep] || steps[1];
  checkoutButton.textContent = current.label;
  checkoutButton.disabled = cart.length === 0 || !canAcceptOrdersNow();
  checkoutButton.dataset.step = String(checkoutStep);
  if (checkoutNextHint) checkoutNextHint.textContent = current.hint;
}'''

new_sync = '''function syncCheckoutStepVisibility() {
  const safeStep = Math.max(1, Math.min(2, Number(checkoutStep || 1)));
  checkoutStep = safeStep;
  const sections = [
    [1, checkoutOrderSection],
    [2, checkoutPickupSection],
    [2, checkoutContactSection]
  ];
  sections.forEach(([step, section]) => {
    if (!section) return;
    const active = step === safeStep;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
    section.setAttribute("aria-hidden", active ? "false" : "true");
  });
  if (checkoutBackButton) checkoutBackButton.hidden = safeStep === 1;
  if (checkoutStepCounter) checkoutStepCounter.textContent = `Steg ${safeStep} av 2`;
  document.body.dataset.checkoutStep = String(safeStep);
}

function setCheckoutStep(step, options = {}) {
  checkoutStep = Math.max(1, Math.min(2, Number(step || 1)));
  updateCheckoutButtonState();
  const scroller = document.querySelector(".cart-content-scroll");
  if (scroller) scroller.scrollTop = 0;
  if (options.focus) {
    window.requestAnimationFrame(() => options.focus?.focus({ preventScroll: true }));
  }
}

function updateCheckoutButtonState() {
  if (!checkoutButton) return;
  syncCheckoutStepVisibility();
  const steps = {
    1: { label: "Neste", hint: "Kontroller varene og sluttsummen" },
    2: { label: "Send bestilling", hint: "Velg hentetid og kontroller kontaktinformasjonen" }
  };
  const current = steps[checkoutStep] || steps[1];
  checkoutButton.textContent = current.label;
  checkoutButton.disabled = cart.length === 0 || !canAcceptOrdersNow();
  checkoutButton.dataset.step = String(checkoutStep);
  if (checkoutNextHint) checkoutNextHint.textContent = current.hint;
}'''

if old_sync not in html:
    raise SystemExit('checkout sync block not found')
html = html.replace(old_sync, new_sync, 1)

old_handle = '''function handleCheckoutButtonClick() {
  if (!cart.length) return;
  if (checkoutStep === 1) {
    setCheckoutStep(2);
    return;
  }
  if (checkoutStep === 2) {
    if (!validatePickupStep()) return;
    const customer = getCustomerInfo();
    const focusField = !customer.fullName || customer.fullName.length < 2
      ? customerFullName
      : (!/^\\d{8}$/.test(customer.phone) ? customerPhone : null);
    setCheckoutStep(3, { focus: focusField });
    return;
  }
  if (!validateContactStep()) return;
  submitOrder();
}'''

new_handle = '''function handleCheckoutButtonClick() {
  if (!cart.length) return;
  if (checkoutStep === 1) {
    setCheckoutStep(2);
    return;
  }
  if (!validatePickupStep()) return;
  if (!validateContactStep()) return;
  submitOrder();
}'''

if old_handle not in html:
    raise SystemExit('checkout handler block not found')
html = html.replace(old_handle, new_handle, 1)

# Back button between checkout screens.
listener = 'checkoutButton.addEventListener("click", handleCheckoutButtonClick);'
if 'checkoutBackButton?.addEventListener' not in html:
    html = html.replace(listener, listener + '\ncheckoutBackButton?.addEventListener("click", () => setCheckoutStep(1));', 1)

# Product screen: when removable ingredient chips are present, do not repeat the same ingredient sentence above them.
needle = '  renderIngredientRemoval();\n  productQuantity.textContent = quantity;'
replacement = '  renderIngredientRemoval();\n  productModal.classList.toggle("has-ingredient-removal", Boolean(ingredientRemoval && !ingredientRemoval.hidden));\n  productQuantity.textContent = quantity;'
if needle in html:
    html = html.replace(needle, replacement, 1)

# CSS: replace previous v9 block if script is re-run, then append a focused compact layout.
marker = '/* KOL MOBILE V9: compact checkout + simplified product */'
if marker in css:
    css = css.split(marker)[0].rstrip() + '\n'

css += r'''
/* KOL MOBILE V9: compact checkout + simplified product */
@layer mobile{
  /* Product detail is a focused screen. Categories stay on the menu, not over the product. */
  body.kol-customer.kol-product-detail-open .category-tabs-wrap{display:none!important}
  body.kol-customer .product-modal.mobile-screen{top:var(--head)!important;height:calc(100dvh - var(--head))!important;background:#fffaf4!important}
  body.kol-customer .product-scroll-content{padding:0!important;background:#fffaf4!important}
  body.kol-customer .product-photo{height:190px!important;min-height:190px!important;max-height:190px!important;border-radius:0!important}
  body.kol-customer .product-photo-title-wrap{margin:0!important;padding:14px 14px 10px!important;border-bottom:1px solid var(--line)!important;background:#fffaf4!important}
  body.kol-customer .product-photo-title-chip,body.kol-customer .product-photo-title-chip h2{margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}
  body.kol-customer .product-photo-title-chip h2{font-size:25px!important;line-height:1.08!important}
  body.kol-customer .product-body{margin:0!important;padding:0!important;background:#fffaf4!important}
  body.kol-customer .product-summary{margin:0!important;padding:10px 14px 13px!important;border-bottom:1px solid var(--line)!important;font-size:13.5px!important;line-height:1.42!important}
  body.kol-customer .product-modal.has-ingredient-removal .product-summary{display:none!important}
  body.kol-customer .ingredient-removal,body.kol-customer .option-group{width:100%!important;margin:0!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
  body.kol-customer .ingredient-removal-heading,body.kol-customer .option-group>h3{min-height:50px!important;margin:0!important;padding:0 14px!important;border:0!important;font-size:14.5px!important}
  body.kol-customer .ingredient-removal-heading>span{display:none!important}
  body.kol-customer .ingredient-chips{margin:0!important;padding:10px 14px 13px!important;gap:7px!important;border-top:1px solid #eee6de!important;background:#fff!important}
  body.kol-customer .ingredient-chip{min-height:38px!important;padding:0 12px!important}
  body.kol-customer #optionGroups{width:100%!important;margin:0!important;padding:0!important}
  body.kol-customer .option-line{min-height:50px!important;margin:0!important;padding:0 14px!important;border-top:1px solid #f0e9e2!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
  body.kol-customer .note-label{margin:0!important;padding:13px 14px 6px!important;border-top:0!important;font-size:14px!important;background:#fffaf4!important}
  body.kol-customer #specialInstructions{width:calc(100% - 28px)!important;min-height:72px!important;margin:0 14px 12px!important;border-radius:10px!important}
  body.kol-customer .quantity-row{min-height:66px!important;margin:0!important;padding:10px 14px!important;border-top:1px solid var(--line)!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
  body.kol-customer .allergen-note{margin:0!important;padding:10px 14px!important;color:var(--muted)!important;font-size:11.5px!important;line-height:1.35!important}
  body.kol-customer .product-footer{width:100%!important;min-height:72px!important;margin:0!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important;border-top:1px solid var(--line)!important;background:#fff!important}
  body.kol-customer .product-footer>strong{min-width:94px!important;font-size:17px!important}
  body.kol-customer .product-footer button{min-height:54px!important;margin:0!important;border-radius:13px!important}

  /* Checkout is now only two screens. Step two contains pickup + contact. */
  body.kol-customer .cart-order-card{width:100%!important;margin:0!important;padding:0!important;display:block!important;background:#fffaf4!important}
  body.kol-customer .checkout-step-panel{width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
  body.kol-customer .checkout-step-panel.is-active{display:block!important}
  body.kol-customer #checkoutPickupSection{border-bottom:1px solid var(--line)!important}
  body.kol-customer #checkoutContactSection{border-bottom:0!important}
  body.kol-customer .checkout-section-title{min-height:58px!important;margin:0!important;padding:10px 14px!important;border-bottom:1px solid var(--line)!important;background:#fff!important}
  body.kol-customer #checkoutContactSection .checkout-section-title{border-top:0!important}
  body.kol-customer #checkoutContactSection .checkout-section-title>span{display:none!important}
  body.kol-customer .checkout-section-title strong{font-size:16px!important;line-height:1.2!important}
  body.kol-customer .checkout-section-title small{margin-top:3px!important;font-size:12px!important;line-height:1.3!important}
  body.kol-customer .pickup-choice{margin:0!important;padding:12px 14px 14px!important;background:#fff!important}
  body.kol-customer .pickup-options{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important}
  body.kol-customer .pickup-option{position:relative!important;min-width:0!important;min-height:58px!important;margin:0!important;padding:0!important;display:flex!important;align-items:stretch!important;border:1px solid #ded5cc!important;border-radius:12px!important;background:#fffaf6!important;overflow:hidden!important;box-shadow:none!important}
  body.kol-customer .pickup-option input{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
  body.kol-customer .pickup-option span{width:100%!important;min-height:58px!important;margin:0!important;padding:0 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--ink)!important;font-size:13.5px!important;font-weight:850!important;text-align:center!important;box-shadow:none!important}
  body.kol-customer .pickup-option:has(input:checked){border-color:var(--o)!important;background:#fff3ec!important}
  body.kol-customer .pickup-option:has(input:checked) span{color:#d95019!important}
  body.kol-customer .pickup-option:has(input:checked)::after{content:'✓';position:absolute!important;right:8px!important;top:50%!important;width:23px!important;height:23px!important;display:grid!important;place-items:center!important;border-radius:50%!important;color:#fff!important;background:var(--o)!important;font-size:13px!important;font-weight:900!important;transform:translateY(-50%)!important}
  body.kol-customer .checkout-help{margin:9px 1px 0!important;font-size:11.5px!important;line-height:1.4!important}
  body.kol-customer #pickupTime{width:100%!important;min-height:48px!important;margin:10px 0 0!important;border-radius:10px!important}
  body.kol-customer .checkout-grid{margin:0!important;padding:12px 14px 8px!important;display:grid!important;gap:11px!important;background:#fff!important}
  body.kol-customer .checkout-grid label{font-size:13px!important;font-weight:800!important}
  body.kol-customer .checkout-grid input{min-height:50px!important;margin-top:6px!important;border-radius:10px!important;font-size:15px!important}
  body.kol-customer .contact-privacy-note{margin:0!important;padding:0 14px 14px!important;font-size:11.5px!important;line-height:1.38!important;background:#fff!important}
  body.kol-customer .checkout-footer{width:100%!important;margin:0!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important;border-top:1px solid var(--line)!important;background:#fff!important}
  body.kol-customer .checkout-progress{min-width:0!important}
  body.kol-customer .checkout-step-counter{font-size:12px!important}
  body.kol-customer .checkout-next-hint{font-size:10.5px!important}
  body.kol-customer .checkout-footer-actions{display:flex!important;gap:8px!important;align-items:stretch!important}
  body.kol-customer .checkout-back-button{min-width:84px!important;min-height:52px!important;margin:0!important;border:1px solid var(--line)!important;border-radius:12px!important;background:#fff!important;color:var(--ink)!important;font-weight:850!important}
  body.kol-customer .checkout-button{min-height:52px!important;margin:0!important;border-radius:12px!important;font-size:15px!important}
}
'''

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('patched mobile v9')
