from pathlib import Path

JS = Path('demo/js/customer.js')
CSS = Path('demo/css/customer.css')
HTML = Path('demo/index.html')

js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

old_countdown = "return `${minutes}:${String(secs).padStart(2, '0')} igjen`;"
new_countdown = "return `${minutes}:${String(secs).padStart(2, '0')}`;"
if old_countdown not in js:
    raise SystemExit('countdown return not found')
js = js.replace(old_countdown, new_countdown, 1)

old_head = '''      <div><span class=\"active-order-kicker\">${rejectedNow ? 'BESTILLING' : 'Aktiv bestilling'}</span><strong class=\"active-order-live-status\">${escapeHtml(rejectedNow ? 'Avvist' : (readyNow ? 'Klar for henting' : orderStatusLabel(order.status)))}</strong></div>'''
new_head = '''      <div><span class=\"active-order-kicker\">${rejectedNow ? 'BESTILLING' : 'Aktiv bestilling'}</span>${rejectedNow ? '<strong class=\"active-order-live-status\">Avvist</strong>' : ''}</div>'''
if old_head not in js:
    raise SystemExit('active order head not found')
js = js.replace(old_head, new_head, 1)

old_estimate = '''    ${hasLiveEstimate && !readyNow && !rejectedNow ? `<div class=\"active-order-estimate\"><span>⏱</span><strong data-customer-countdown=\"${escapeHtml(order.id)}\">${escapeHtml(customerOrderCountdown(order))}</strong><small>oppgitt av restauranten</small></div>` : ''}'''
new_estimate = '''    ${hasLiveEstimate && !readyNow && !rejectedNow ? `<div class=\"active-order-estimate active-order-estimate-compact\"><span class=\"active-order-estimate-label\">Maten er klar om</span><span class=\"active-order-estimate-clock\" aria-hidden=\"true\">⏱</span><strong data-customer-countdown=\"${escapeHtml(order.id)}\">${escapeHtml(customerOrderCountdown(order))}</strong></div>` : ''}'''
if old_estimate not in js:
    raise SystemExit('active order estimate not found')
js = js.replace(old_estimate, new_estimate, 1)

old_meta = '''    <div class=\"active-order-meta\"><span>Henting <b>${escapeHtml(order.pickup || '—')}</b></span><span><b>${formatPrice(order.total)}</b></span></div>\n'''
if old_meta not in js:
    raise SystemExit('active order meta not found')
js = js.replace(old_meta, '', 1)

marker = '/* Compact active order card 2026-09-16 */'
if marker not in css:
    css += '''\n\n/* Compact active order card 2026-09-16 */\n.active-order-card:not(.is-rejected) .active-order-head > div:first-child {\n  display: flex;\n  align-items: center;\n}\n.active-order-estimate.active-order-estimate-compact {\n  display: flex !important;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  min-height: 78px;\n  padding: 14px 12px !important;\n  margin-top: 10px;\n  border: 1px solid #d6e9dc;\n  border-radius: 14px;\n  background: #f5fbf7;\n  color: #2a8753;\n  text-align: center;\n}\n.active-order-estimate-compact .active-order-estimate-label {\n  font-size: 17px;\n  line-height: 1.2;\n  font-weight: 750;\n  color: #4e9a6f;\n}\n.active-order-estimate-compact .active-order-estimate-clock {\n  flex: none;\n  font-size: 15px;\n  line-height: 1;\n  filter: grayscale(1);\n  opacity: .72;\n}\n.active-order-estimate-compact strong[data-customer-countdown] {\n  font-size: 18px !important;\n  line-height: 1.2;\n  font-weight: 850;\n  color: #237b49 !important;\n  letter-spacing: .01em !important;\n  white-space: nowrap;\n}\n.active-order-card:not(.is-rejected) .active-order-open {\n  margin-top: 10px;\n}\n@media (max-width: 420px) {\n  .active-order-estimate.active-order-estimate-compact { gap: 5px; min-height: 72px; padding: 12px 9px !important; }\n  .active-order-estimate-compact .active-order-estimate-label { font-size: 15.5px; }\n  .active-order-estimate-compact strong[data-customer-countdown] { font-size: 17px !important; }\n}\n'''

html = html.replace('/demo/css/customer.css?v=20260915-compactconfirm1', '/demo/css/customer.css?v=20260916-activeorder1')
html = html.replace('/demo/js/customer.js?v=20260915-compactconfirm1', '/demo/js/customer.js?v=20260916-activeorder1')

JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
