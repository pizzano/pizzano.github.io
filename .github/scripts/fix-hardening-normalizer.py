from pathlib import Path

p = Path('.github/scripts/order-system-hardening-20260817.py')
s = p.read_text(encoding='utf-8')
start_marker = '# Add compatibility aliases to normalized old orders if not already present.'
end_marker = '# Cache bust after CSS consolidation.'
start = s.index(start_marker)
end = s.index(end_marker, start)
replacement = r'''# Add compatibility aliases to normalized old orders if not already present.
compat_pattern = r'(\n\s*status,\n)(\s*customer:\s*\{)'
compat_insert = (
    r'\1'
    '    orderType: safeAdminText(order.orderType || order.order_type, "pickup"),\n'
    '    clientOrderCount: Math.max(1, safeAdminNumber(order.clientOrderCount ?? order.client_order_count, 1)),\n'
    '    confirmedAt: safeAdminText(order.confirmedAt || order.confirmed_at || order.acceptedAt),\n'
    '    fulfillTime: safeAdminText(order.fulfillTime || order.fulfill_time),\n'
    r'\2'
)
admin, compat_count = re.subn(compat_pattern, compat_insert, admin, count=1)
if compat_count != 1:
    raise SystemExit(f"admin normalizer compatibility insertion failed: {compat_count}")

'''
s = s[:start] + replacement + s[end:]
p.write_text(s, encoding='utf-8')
print('normalizer migration patched')
