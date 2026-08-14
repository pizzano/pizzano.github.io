from pathlib import Path
p=Path('test/index.html')
s=p.read_text(encoding='utf-8')

# cache + clearer back control
s=s.replace('kol-core.css?v=mobile-v15','kol-core.css?v=mobile-v16')
s=s.replace('<span aria-hidden="true" class="brand-back-label">‹ Meny</span>','<span aria-hidden="true" class="brand-back-label">← Til meny</span>')

# checkout: 1 order -> 2 pickup -> 3 contact
s=s.replace('id="checkoutContactSection" data-checkout-step="2"','id="checkoutContactSection" data-checkout-step="3"')
s=s.replace('<div class="checkout-section-title"><span>2</span><div><strong>Navn og telefon</strong></div></div>','<div class="checkout-section-title"><span>3</span><div><strong>Navn og telefon</strong></div></div>')
s=s.replace('id="checkoutPickupSection" data-checkout-step="3"','id="checkoutPickupSection" data-checkout-step="2"')
s=s.replace('<div class="checkout-section-title"><span>3</span><div><strong>Velg hentetid</strong></div></div>','<div class="checkout-section-title"><span>2</span><div><strong>Velg hentetid</strong></div></div>')

old='''  const sections = [
    [1, checkoutOrderSection],
    [2, checkoutContactSection],
    [3, checkoutPickupSection]
  ];'''
new='''  const sections = [
    [1, checkoutOrderSection],
    [2, checkoutPickupSection],
    [3, checkoutContactSection]
  ];'''
if old not in s: raise SystemExit('step map not found')
s=s.replace(old,new,1)

old='''function handleCheckoutButtonClick() {
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
}'''
new='''function handleCheckoutButtonClick() {
  if (!cart.length) return;
  if (checkoutStep === 1) {
    setCheckoutStep(2);
    return;
  }
  if (checkoutStep === 2) {
    if (!validatePickupStep()) return;
    setCheckoutStep(3, { focus: customerFullName });
    return;
  }
  if (!validateContactStep()) return;
  submitOrder();
}'''
if old not in s: raise SystemExit('checkout handler not found')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('mobile v16 index patch applied')