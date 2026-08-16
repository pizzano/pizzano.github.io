from pathlib import Path

p = Path('test/index.html')
s = p.read_text(encoding='utf-8')

old_const = 'const firebaseOrdersUrl = `${firebaseBaseUrl}/orders.json`;'
new_const = '''const firebaseOrdersBaseUrl = `${firebaseBaseUrl}/orders`;
const firebaseOrdersUrl = `${firebaseOrdersBaseUrl}.json`;
const firebaseOrderUrl = (orderId) => `${firebaseOrdersBaseUrl}/${encodeURIComponent(String(orderId || ""))}.json`;'''
if old_const not in s:
    raise SystemExit('firebaseOrdersUrl declaration not found')
s = s.replace(old_const, new_const, 1)

old_fetch = '''async function fetchOrder(orderId) {
  const response = await fetch(firebaseOrdersUrl.replace("orders.json", `orders/${orderId}.json?ts=${Date.now()}`), { cache: "no-store" });
  if (!response.ok) throw new Error("Kunne ikke lese ordre");
  const data = await response.json();
  return data ? normalizeCustomerOrder({ id: orderId, ...data }) : null;
}'''
new_fetch = '''async function fetchOrder(orderId) {
  const cleanOrderId = String(orderId || "").trim();
  if (!cleanOrderId) return null;
  const response = await fetch(`${firebaseOrderUrl(cleanOrderId)}?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Kunne ikke lese ordre");
  const data = await response.json();
  return data ? normalizeCustomerOrder({ id: cleanOrderId, ...data }) : null;
}'''
if old_fetch not in s:
    raise SystemExit('fetchOrder block not found')
s = s.replace(old_fetch, new_fetch, 1)

p.write_text(s, encoding='utf-8')
print('order read cleanup applied')
