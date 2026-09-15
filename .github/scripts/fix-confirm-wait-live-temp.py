from pathlib import Path
import re

VERSION = '20260915-confirmwait2'

p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')

# Keep explicit timers for the accepted screen so the customer can actually read it.
s = s.replace(
    "let orderConfirmResolved = false;",
    "let orderConfirmResolved = false;\nlet orderConfirmAcceptedTimer = null;\nlet orderConfirmRedirectTimer = null;",
    1,
)

stop_pattern = re.compile(r"function stopOrderConfirmationWait\(\) \{.*?\n\}", re.S)
stop_repl = r'''function stopOrderConfirmationWait() {
  if (orderConfirmTimer) {
    clearInterval(orderConfirmTimer);
    orderConfirmTimer = null;
  }
  if (orderConfirmAcceptedTimer) {
    clearInterval(orderConfirmAcceptedTimer);
    orderConfirmAcceptedTimer = null;
  }
  if (orderConfirmRedirectTimer) {
    clearTimeout(orderConfirmRedirectTimer);
    orderConfirmRedirectTimer = null;
  }
  orderConfirmOrderId = '';
  orderConfirmDeadline = 0;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
}'''
s, n = stop_pattern.subn(stop_repl, s, count=1)
if n != 1:
    raise SystemExit('stopOrderConfirmationWait not found')

# Add a live remaining-time formatter for accepted ASAP orders.
needle = "function confirmationBaseRows(order) {"
helper = r'''function confirmationReadyLeftText(order) {
  const readyAt = Number(order?.estimatedReadyAt) || 0;
  if (!readyAt) {
    const minutes = Math.max(0, Number(order?.estimatedMinutes) || 0);
    return minutes > 0 ? `ca. ${minutes} min igjen` : 'Bekreftet';
  }
  const remaining = Math.max(0, readyAt - Date.now());
  if (!remaining) return 'Klar nå';
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')} igjen`;
}

'''
if 'function confirmationReadyLeftText(order)' not in s:
    if needle not in s:
        raise SystemExit('confirmationBaseRows anchor not found')
    s = s.replace(needle, helper + needle, 1)

accepted_pattern = re.compile(r"function renderConfirmationAccepted\(order\) \{.*?\n\}\n\nfunction renderConfirmationTimeout", re.S)
accepted_repl = r'''function renderConfirmationAccepted(order) {
  const title = el.confirmModal.querySelector('h2');
  const minutes = Math.max(0, Number(order.estimatedMinutes) || 0);
  const scheduled = order.pickupMode === 'scheduled' || (order.pickup && order.pickup !== 'Snarest');
  const readyNow = order.status === 'klar';
  if (title) title.textContent = readyNow ? 'Maten er klar!' : 'Bestillingen er bekreftet';
  // Hold modal locked while the confirmation is shown. No accidental backdrop/Escape close.
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = readyNow ? 'ready' : 'accepted';
  if (el.btnConfirmDone) el.btnConfirmDone.hidden = true;
  el.confirmText.textContent = readyNow
    ? 'Bestillingen din er klar for henting.'
    : scheduled
      ? `Restauranten har bekreftet hentetiden ${order.pickup}.`
      : minutes > 0
        ? `Restauranten har bekreftet bestillingen og satt ca. ${minutes} minutter.`
        : 'Restauranten har bekreftet bestillingen din.';

  const acceptMessage = readyNow
    ? '<strong>Klar for henting</strong><small>Kom og hent maten din nå.</small>'
    : scheduled
      ? `<strong>Hentetid ${escapeHtml(order.pickup || '')}</strong><small>Bestillingen er bekreftet.</small>`
      : minutes > 0
        ? `<strong>Ca. ${minutes} minutter</strong><small>Oppgitt av restauranten.</small>`
        : '<strong>Bekreftet</strong><small>Bestillingen er tatt imot.</small>';

  const countdown = !scheduled && !readyNow && minutes > 0
    ? `<div class="confirm-ready-countdown"><span>Forventet klar om</span><strong data-confirm-ready-countdown>${escapeHtml(confirmationReadyLeftText(order))}</strong><small>Nedtellingen fortsetter på forsiden.</small></div>`
    : '';

  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-accepted-status">
      <span class="confirm-accepted-check" aria-hidden="true">✓</span>
      <div>${acceptMessage}</div>
    </div>
    ${countdown}
    <p class="confirm-auto-return">Du sendes til forsiden om noen sekunder, og kan følge bestillingen live der.</p>`;
}

function startAcceptedConfirmationHold(order) {
  if (orderConfirmAcceptedTimer) clearInterval(orderConfirmAcceptedTimer);
  if (orderConfirmRedirectTimer) clearTimeout(orderConfirmRedirectTimer);

  orderConfirmAcceptedTimer = window.setInterval(() => {
    const current = confirmationOrderSnapshot(order.id) || order;
    const node = el.confirmMeta.querySelector('[data-confirm-ready-countdown]');
    if (node) node.textContent = confirmationReadyLeftText(current);
  }, 500);

  // Long enough to read the accepted time, then move to the live order card.
  orderConfirmRedirectTimer = window.setTimeout(() => {
    if (orderConfirmAcceptedTimer) {
      clearInterval(orderConfirmAcceptedTimer);
      orderConfirmAcceptedTimer = null;
    }
    orderConfirmRedirectTimer = null;
    el.confirmModal.dataset.waiting = 'false';
    orderConfirmOrderId = '';
    orderConfirmDeadline = 0;
    closeConfirm();
    renderActiveOrders();
  }, 8000);
}

function renderConfirmationTimeout'''
s, n = accepted_pattern.subn(accepted_repl, s, count=1)
if n != 1:
    raise SystemExit('renderConfirmationAccepted block not found')

check_pattern = re.compile(r"function checkOrderConfirmationWait\(\) \{.*?\n\}\n\nfunction startOrderConfirmationWait", re.S)
check_repl = r'''function checkOrderConfirmationWait() {
  if (!orderConfirmOrderId || el.confirmModal.hidden || orderConfirmResolved) return;
  const order = confirmationOrderSnapshot(orderConfirmOrderId);
  if (!order) return;
  persistCustomerOrderSnapshot(order);

  if (order.status === 'avvist') {
    orderConfirmResolved = true;
    if (orderConfirmTimer) {
      clearInterval(orderConfirmTimer);
      orderConfirmTimer = null;
    }
    const title = el.confirmModal.querySelector('h2');
    const phone = confirmationRestaurantPhone();
    if (title) title.textContent = 'Bestillingen ble ikke godkjent';
    el.confirmModal.dataset.waiting = 'false';
    el.confirmModal.dataset.state = 'rejected';
    el.confirmText.textContent = order.rejectionMessage || order.rejectionReason || 'Restauranten kunne dessverre ikke ta imot bestillingen.';
    const phoneAction = phone.tel ? `<a class="confirm-call-button" href="tel:${escapeHtml(phone.tel)}">Ring ${escapeHtml(phone.label || phone.tel)}</a>` : '';
    el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}<div class="confirm-timeout-status">${phoneAction}</div>`;
    return;
  }

  if (['bekreftet', 'tilberedning', 'klar'].includes(order.status)) {
    orderConfirmResolved = true;
    if (orderConfirmTimer) {
      clearInterval(orderConfirmTimer);
      orderConfirmTimer = null;
    }
    ui.focusedOrderId = order.id;
    renderConfirmationAccepted(order);
    renderActiveOrders();
    startAcceptedConfirmationHold(order);
    return;
  }

  if (!orderConfirmTimedOut && Date.now() >= orderConfirmDeadline) {
    orderConfirmTimedOut = true;
    renderConfirmationTimeout(order);
    return;
  }

  if (!orderConfirmTimedOut) {
    const countdown = el.confirmMeta.querySelector('[data-confirm-countdown]');
    if (countdown) countdown.textContent = confirmationTimeLeftText();
  }
}

function startOrderConfirmationWait'''
s, n = check_pattern.subn(check_repl, s, count=1)
if n != 1:
    raise SystemExit('checkOrderConfirmationWait block not found')

start_pattern = re.compile(r"function startOrderConfirmationWait\(order, name\) \{.*?\n\}\n\n\nasync function placeOrder", re.S)
start_repl = r'''function startOrderConfirmationWait(order, name) {
  if (!order?.id) return;
  if (orderConfirmTimer) clearInterval(orderConfirmTimer);
  if (orderConfirmAcceptedTimer) clearInterval(orderConfirmAcceptedTimer);
  if (orderConfirmRedirectTimer) clearTimeout(orderConfirmRedirectTimer);
  orderConfirmAcceptedTimer = null;
  orderConfirmRedirectTimer = null;
  orderConfirmOrderId = order.id;
  orderConfirmDeadline = Date.now() + ORDER_CONFIRM_WAIT_MS;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
  ui.focusedOrderId = order.id;
  rememberCustomerOrder(order);
  persistCustomerOrderSnapshot(order);

  // Show the waiting screen FIRST. A watcher failure must never leave the customer on "Sender…".
  renderConfirmationWaiting(order, name);
  el.confirmBackdrop.hidden = false;
  el.confirmModal.hidden = false;

  // Current live-order implementation uses the multi-order watcher API.
  syncActiveOrderWatchers([order.id]);
  void fetchActiveOrderNow(order.id);
  checkOrderConfirmationWait();
  orderConfirmTimer = window.setInterval(checkOrderConfirmationWait, 1000);
}


async function placeOrder'''
s, n = start_pattern.subn(start_repl, s, count=1)
if n != 1:
    raise SystemExit('startOrderConfirmationWait block not found')

# Safety: no stale single-order watcher call may remain.
s = s.replace('watchActiveOrder(order.id);', 'syncActiveOrderWatchers([order.id]);')

p.write_text(s, encoding='utf-8')

# Add modern accepted countdown styling as an override.
p = Path('demo/css/customer.css')
css = p.read_text(encoding='utf-8')
marker = '/* Confirmation wait live fix 2026-09-15 */'
if marker not in css:
    css += r'''

/* Confirmation wait live fix 2026-09-15 */
.confirm-modal[data-state="waiting"],
.confirm-modal[data-state="accepted"],
.confirm-modal[data-state="timeout"]{max-width:500px}
.confirm-ready-countdown{display:grid;gap:5px;margin-top:12px;padding:16px;border:1px solid #cce8d5;border-radius:16px;background:#f1fbf4;text-align:center}
.confirm-ready-countdown>span{color:#557060;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.confirm-ready-countdown>strong{color:#168343;font-size:28px;line-height:1.1;font-weight:850;font-variant-numeric:tabular-nums}
.confirm-ready-countdown>small{color:#6f7f75;font-size:12px;line-height:1.35}
.confirm-auto-return{margin:12px 0 0;color:#77706a;font-size:12.5px;line-height:1.45;text-align:center}
.confirm-modal[data-state="waiting"] .confirm-icon{animation:confirmPulse 1.5s ease-in-out infinite}
@keyframes confirmPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(43,163,94,.22)}50%{transform:scale(1.05);box-shadow:0 0 0 12px rgba(43,163,94,0)}}
'''
p.write_text(css, encoding='utf-8')

# Cache bust customer entry points.
p = Path('demo/index.html')
html = p.read_text(encoding='utf-8')
html = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', f'/demo/js/customer.js?v={VERSION}', html)
html = re.sub(r'/demo/css/customer\.css\?v=[^\"\']+', f'/demo/css/customer.css?v={VERSION}', html)
p.write_text(html, encoding='utf-8')

p = Path('demo/service-worker.js')
sw = p.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v51';", sw)
p.write_text(sw, encoding='utf-8')
