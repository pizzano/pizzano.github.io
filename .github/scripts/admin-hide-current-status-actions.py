from pathlib import Path
import re

JS = Path('demo/js/admin.js')
CSS = Path('demo/css/admin.css')
HTML = Path('demo/admin.html')

js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

new_actions = r'''  const effectiveStatus = order.status === 'tilberedning' ? 'bekreftet' : order.status;
  const actionHtml = isPending
    ? `<button class="pos-reject-btn" data-open-reject="${escapeHtml(order.id)}" type="button" aria-label="Avvis bestilling">×</button>
       <button class="pos-accept-btn" data-open-accept="${escapeHtml(order.id)}" type="button">${scheduledPickup ? `GODTA · ${escapeHtml(order.pickup || '')}` : `GODTA${estimated ? ` (${estimated} MIN)` : ''}`}</button>`
    : order.status === 'avvist' || order.status === 'fullfort'
      ? `<div class="pos-closed-status">${escapeHtml(orderStatusLabel(order.status))}</div>`
      : effectiveStatus === 'bekreftet'
        ? `<div class="pos-progress-actions"><button data-detail-status="klar" type="button">Klar for henting</button></div>`
        : '';

  el.orderDetailEmpty.hidden = true;'''

action_pattern = re.compile(
    r"  const actionHtml = isPending\n.*?;\n\n  el\.orderDetailEmpty\.hidden = true;",
    re.S,
)
js, count = action_pattern.subn(new_actions, js, count=1)
if count != 1:
    raise SystemExit('order action block not found')

new_handler = r'''  const status = event.target.closest('[data-detail-status]');
  if (status && selectedOrderId) {
    const orderId = selectedOrderId;
    const nextStatus = status.dataset.detailStatus;
    const currentOrder = getOrders().find((entry) => entry.id === orderId);
    const currentStatus = currentOrder?.status === 'tilberedning' ? 'bekreftet' : currentOrder?.status;

    // Statusknappen er kun en fremoverhandling: Bekreftet -> Klar for henting.
    // Hvis ordren allerede er klar (manuelt eller automatisk), ignoreres gamle/stale klikk.
    if (currentStatus !== 'bekreftet' || nextStatus !== 'klar') {
      renderOrders();
      renderStats();
      return;
    }

    const ok = await updateOrderStatus(orderId, nextStatus);
    if (ok) selectedOrderId = null;
    renderOrders();
    renderStats();
    toast(ok ? 'Status er oppdatert.' : 'Kunne ikke oppdatere status.');
    return;
  }
  const saveEstimate = event.target.closest('[data-save-detail-estimate]');'''

handler_pattern = re.compile(
    r"  const status = event\.target\.closest\('\[data-detail-status\]'\);\n.*?\n  const saveEstimate = event\.target\.closest\('\[data-save-detail-estimate\]'\);",
    re.S,
)
js, count = handler_pattern.subn(new_handler, js, count=1)
if count != 1:
    raise SystemExit('detail status handler not found')

css_marker = '/* Single forward status action 2026-09-15 */'
if css_marker not in css:
    css += f'''\n\n{css_marker}\n.pos-progress-actions {{\n  grid-template-columns: 1fr !important;\n}}\n'''

html = html.replace('/demo/js/admin.js?v=20260915-scheduled-pickup1', '/demo/js/admin.js?v=20260915-adminstatus1')

JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
