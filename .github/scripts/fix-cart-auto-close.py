from pathlib import Path

p = Path('test/index.html')
s = p.read_text(encoding='utf-8')
old = '''  if ((statusChanged && ["accepted", "cancelled"].includes(nextStatus)) || becameReady) {
    playCustomerStatusSound(becameReady ? "ready" : nextStatus);
    renderOrderLiveModal(order, true);
  }'''
new = '''  if ((statusChanged && ["accepted", "cancelled"].includes(nextStatus)) || becameReady) {
    playCustomerStatusSound(becameReady ? "ready" : nextStatus);
    const blockingCustomerOverlayOpen = Boolean(
      (cartModal && !cartModal.hidden) ||
      (productModal && !productModal.hidden) ||
      (profileModal && !profileModal.hidden) ||
      (infoModal && !infoModal.hidden) ||
      (quickCheckoutModal && !quickCheckoutModal.hidden)
    );
    if (!blockingCustomerOverlayOpen) renderOrderLiveModal(order, true);
  }'''
if old not in s:
    raise SystemExit('target status-change block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('cart auto-close guard applied')
