from pathlib import Path
import re

VERSION = '20260915-three-stage2'

# data.js: preserve legacy tilberedning in storage, present it as Bekreftet.
p = Path('demo/js/data.js')
s = p.read_text(encoding='utf-8')
old = "export function orderStatusLabel(status) {\n  const found = ORDER_STATUSES.find((entry) => entry.id === status);\n  return found ? found.label : 'Ny';\n}"
new = "export function orderStatusLabel(status) {\n  if (status === 'tilberedning') return 'Bekreftet';\n  const found = ORDER_STATUSES.find((entry) => entry.id === status);\n  return found ? found.label : 'Ny';\n}"
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# customer.js: visible flow is Mottatt -> Bekreftet -> Klar only.
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"from './data\.js(?:\?v=[^']+)?';", f"from './data.js?v={VERSION}';", s)
flow_pattern = re.compile(r"const CUSTOMER_STATUS_FLOW = \[.*?\];", re.S)
flow_repl = """const CUSTOMER_STATUS_FLOW = [
  { id: 'mottatt', label: 'Mottatt', short: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet', short: 'Bekreftet' },
  { id: 'klar', label: 'Klar for henting', short: 'Klar' },
];"""
s, n = flow_pattern.subn(flow_repl, s, count=1)
if n != 1:
    raise SystemExit('CUSTOMER_STATUS_FLOW not found')
old_index = "  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === order.status);\n  const index = foundIndex < 0 ? 0 : foundIndex;"
new_index = "  const progressStatus = order.status === 'tilberedning' ? 'bekreftet' : order.status;\n  const foundIndex = CUSTOMER_STATUS_FLOW.findIndex((step) => step.id === progressStatus);\n  const index = foundIndex < 0 ? 0 : foundIndex;"
if old_index in s:
    s = s.replace(old_index, new_index, 1)
elif "const progressStatus = order.status === 'tilberedning' ? 'bekreftet' : order.status;" not in s:
    raise SystemExit('customer progress index block not found')
p.write_text(s, encoding='utf-8')

# admin.js: only Bekreftet and Klar after acceptance; fix missing acceptedOrderId.
p = Path('demo/js/admin.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"from './data\.js(?:\?v=[^']+)?';", f"from './data.js?v={VERSION}';", s)
old_statuses = "const ADMIN_ORDER_STATUSES = ORDER_STATUSES.filter((status) =>\n  ['bekreftet', 'tilberedning', 'klar'].includes(status.id)\n);"
new_statuses = "const ADMIN_ORDER_STATUSES = ORDER_STATUSES.filter((status) =>\n  ['bekreftet', 'klar'].includes(status.id)\n);"
if old_statuses in s:
    s = s.replace(old_statuses, new_statuses, 1)
elif new_statuses not in s:
    raise SystemExit('ADMIN_ORDER_STATUSES block not found')
old_accept = "  el.btnAcceptConfirm.disabled = true;\n  const ok = await acceptOrderWithEstimate(actionOrderId, minutes);"
new_accept = "  const acceptedOrderId = actionOrderId;\n  el.btnAcceptConfirm.disabled = true;\n  const ok = await acceptOrderWithEstimate(acceptedOrderId, minutes);"
if old_accept in s:
    s = s.replace(old_accept, new_accept, 1)
elif "const acceptedOrderId = actionOrderId;" not in s:
    raise SystemExit('accept handler call block not found')
s = s.replace("status.id === order.status ? 'is-active' : ''", "status.id === (order.status === 'tilberedning' ? 'bekreftet' : order.status) ? 'is-active' : ''")
p.write_text(s, encoding='utf-8')

# CSS overrides.
p = Path('demo/css/customer.css')
s = p.read_text(encoding='utf-8')
if '/* Three-stage customer progress 2026-09-15 */' not in s:
    s += "\n\n/* Three-stage customer progress 2026-09-15 */\n.order-progress{grid-template-columns:repeat(3,minmax(0,1fr))!important}\n"
p.write_text(s, encoding='utf-8')

p = Path('demo/css/admin.css')
s = p.read_text(encoding='utf-8')
if '/* Two post-accept status controls 2026-09-15 */' not in s:
    s += "\n\n/* Two post-accept status controls 2026-09-15 */\n.pos-progress-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}\n"
p.write_text(s, encoding='utf-8')

# Cache bust entry points.
p = Path('demo/index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', f'/demo/js/customer.js?v={VERSION}', s)
s = re.sub(r'/demo/css/customer\.css\?v=[^\"\']+', f'/demo/css/customer.css?v={VERSION}', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/admin.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/admin\.js\?v=[^\"\']+', f'/demo/js/admin.js?v={VERSION}', s)
s = re.sub(r'/demo/css/admin\.css\?v=[^\"\']+', f'/demo/css/admin.css?v={VERSION}', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v49';", s)
p.write_text(s, encoding='utf-8')
