from pathlib import Path

p = Path('test/index.html')
s = p.read_text(encoding='utf-8')

s = s.replace('kol-core.css?v=mobile-v36', 'kol-core.css?v=mobile-v37', 1)

needle = 'const firebaseOrdersUrl = `${firebaseBaseUrl}/orders.json`;\n'
replacement = '''const firebaseOrdersUrl = `${firebaseBaseUrl}/orders.json`;\nconst firebaseOrderUrl = (orderId) => `${firebaseBaseUrl}/orders/${encodeURIComponent(String(orderId || ""))}.json`;\n'''
if needle not in s:
    raise SystemExit('firebaseOrdersUrl constant not found')
s = s.replace(needle, replacement, 1)

old = '''async function fetchOrder(orderId) {\n  const response = await fetch(firebaseOrdersUrl.replace("orders.json", `orders/${orderId}.json?ts=${Date.now()}`), { cache: "no-store" });\n  if (!response.ok) throw new Error("Kunne ikke lese ordre");\n  const data = await response.json();\n  return data ? normalizeCustomerOrder({ id: orderId, ...data }) : null;\n}'''
new = '''async function fetchOrder(orderId) {\n  const safeOrderId = String(orderId || "").trim();\n  if (!safeOrderId) return null;\n  const response = await fetch(`${firebaseOrderUrl(safeOrderId)}?ts=${Date.now()}`, { cache: "no-store" });\n  if (!response.ok) throw new Error("Kunne ikke lese ordre");\n  const data = await response.json();\n  return data ? normalizeCustomerOrder({ id: safeOrderId, ...data }) : null;\n}'''
if old not in s:
    raise SystemExit('fetchOrder block not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('single-order fetch v37 applied')
