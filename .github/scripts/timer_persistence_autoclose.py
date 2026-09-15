from pathlib import Path
import re

VERSION = '20260915-timerfix2'

# data.js: normalizeOrders must preserve live timer fields from Firebase.
p = Path('demo/js/data.js')
s = p.read_text(encoding='utf-8')
start = s.index('function normalizeOrders(raw) {')
end = s.index('\nfunction normalizeState', start)
segment = s[start:end]
if 'estimatedMinutes:' not in segment:
    needle = "        statusUpdatedAt: Number(order.statusUpdatedAt) || 0,\n"
    insert = needle + (
        "        estimatedMinutes: Number(order.estimatedMinutes) > 0 ? Number(order.estimatedMinutes) : null,\n"
        "        estimatedAt: Number(order.estimatedAt) || null,\n"
        "        estimatedReadyAt: Number(order.estimatedReadyAt) || null,\n"
    )
    if needle not in segment:
        raise SystemExit('normalizeOrders statusUpdatedAt line not found')
    segment = segment.replace(needle, insert, 1)
    s = s[:start] + segment + s[end:]
p.write_text(s, encoding='utf-8')

# Keep every module on the same data.js URL to avoid duplicate module/store instances.
for file in ['demo/js/customer.js', 'demo/js/admin.js', 'demo/js/allergen-ui.js']:
    p = Path(file)
    s = p.read_text(encoding='utf-8')
    s = re.sub(r"from './data\.js(?:\?v=[^']+)?';", f"from './data.js?v={VERSION}';", s)
    p.write_text(s, encoding='utf-8')

# Customer: show only an authoritative countdown, never a static 0-minute fallback.
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')
s = s.replace(
    "${escapeHtml(customerOrderCountdown(order) || `Ca. ${estimated} min`)}",
    "${escapeHtml(customerOrderCountdown(order))}",
)
p.write_text(s, encoding='utf-8')

# Admin: after accepting, keep the detail open for one second and then close it.
p = Path('demo/js/admin.js')
s = p.read_text(encoding='utf-8')
old = '''  selectedOrderId = null;
  closeModals();
  renderOrders();
  renderStats();
  toast(`Bestillingen er godtatt · ${minutes} min.`);
});'''
new = '''  selectedOrderId = acceptedOrderId;
  closeModals();
  renderOrders();
  renderStats();
  toast(`Bestillingen er godtatt · ${minutes} min.`);
  window.setTimeout(() => {
    if (selectedOrderId !== acceptedOrderId) return;
    selectedOrderId = null;
    renderOrders();
  }, 1000);
});'''
if old not in s:
    raise SystemExit('accept handler close block not found')
s = s.replace(old, new, 1)

# Detail: countdown depends on the authoritative ready timestamp, not only the minute field.
s = s.replace(
    "  const countdown = orderCountdown(order);\n  const isPending = order.status === 'mottatt';",
    "  const countdown = orderCountdown(order);\n  const hasCountdown = Number(order.estimatedReadyAt) > 0;\n  const isPending = order.status === 'mottatt';",
    1,
)
old_meta = '''          ${estimated && !isPending ? `<div><span>Gitt tid</span><strong>${estimated} min</strong></div>
          <div class="pos-meta-countdown"><span>Tid igjen</span><strong data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(countdown || (order.status === 'klar' ? 'Klar nå' : '—'))}</strong></div>` : ''}'''
new_meta = '''          ${!isPending && estimated ? `<div><span>Gitt tid</span><strong>${estimated} min</strong></div>` : ''}
          ${!isPending && hasCountdown ? `<div class="pos-meta-countdown"><span>Tid igjen</span><strong data-detail-countdown="${escapeHtml(order.id)}">${escapeHtml(countdown || (order.status === 'klar' ? 'Klar nå' : '—'))}</strong></div>` : ''}'''
if old_meta in s:
    s = s.replace(old_meta, new_meta, 1)
p.write_text(s, encoding='utf-8')

# Cache bust entry modules.
for file, pattern, repl in [
    ('demo/index.html', r'/demo/js/customer\.js\?v=[^\"\']+', f'/demo/js/customer.js?v={VERSION}'),
    ('demo/admin.html', r'/demo/js/admin\.js\?v=[^\"\']+', f'/demo/js/admin.js?v={VERSION}'),
]:
    p = Path(file)
    s = p.read_text(encoding='utf-8')
    s = re.sub(pattern, repl, s)
    p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v47';", s)
p.write_text(s, encoding='utf-8')
