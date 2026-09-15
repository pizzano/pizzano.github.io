from pathlib import Path
import re

VERSION = '20260915-confirmwait1'

# ---------- customer.js ----------
p = Path('demo/js/customer.js')
s = p.read_text(encoding='utf-8')

helper_marker = '/* Order confirmation wait flow 2026-09-15 */'
if helper_marker not in s:
    helper = r'''

/* Order confirmation wait flow 2026-09-15 */
const ORDER_CONFIRM_WAIT_MS = 3 * 60 * 1000;
let orderConfirmTimer = null;
let orderConfirmOrderId = '';
let orderConfirmDeadline = 0;
let orderConfirmTimedOut = false;
let orderConfirmResolved = false;

function stopOrderConfirmationWait() {
  if (orderConfirmTimer) {
    clearInterval(orderConfirmTimer);
    orderConfirmTimer = null;
  }
  orderConfirmOrderId = '';
  orderConfirmDeadline = 0;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
}

function confirmationRestaurantPhone() {
  const settings = store.settings || {};
  const label = String(settings.phone || '').trim();
  const tel = label.replace(/[^+\d]/g, '');
  return { label, tel };
}

function confirmationOrderSnapshot(orderId) {
  if (!orderId) return null;
  const live = mergedCustomerOrders().find((order) => order?.id === orderId);
  if (live) return live;
  return stableCustomerOrderSnapshots.get(orderId) || null;
}

function confirmationTimeLeftText() {
  const remaining = Math.max(0, orderConfirmDeadline - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function confirmationBaseRows(order) {
  return `
    <div><span>Ordrenummer</span><strong>${escapeHtml(String(order.id || '').slice(-6).toUpperCase())}</strong></div>
    <div><span>Hentetid</span><strong>${escapeHtml(order.pickup || 'Snarest')}</strong></div>
    <div><span>Å betale ved henting</span><strong>${formatPrice(order.total)}</strong></div>`;
}

function renderConfirmationWaiting(order, name) {
  const title = el.confirmModal.querySelector('h2');
  if (title) title.textContent = 'Venter på bekreftelse';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = 'waiting';
  if (el.btnConfirmDone) el.btnConfirmDone.hidden = true;
  el.confirmText.textContent = `Takk, ${name}! Bestillingen er sendt. Vi venter nå på svar fra restauranten.`;
  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-wait-status">
      <span class="confirm-live-dot" aria-hidden="true"></span>
      <div>
        <strong>Venter på restauranten</strong>
        <small>Vi holder deg her i opptil 3 minutter · <b data-confirm-countdown>${confirmationTimeLeftText()}</b> igjen</small>
      </div>
    </div>`;
}

function renderConfirmationAccepted(order) {
  const title = el.confirmModal.querySelector('h2');
  const minutes = Math.max(0, Number(order.estimatedMinutes) || 0);
  const scheduled = order.pickupMode === 'scheduled' || (order.pickup && order.pickup !== 'Snarest');
  const readyNow = order.status === 'klar';
  if (title) title.textContent = readyNow ? 'Maten er klar!' : 'Bestillingen er bekreftet';
  el.confirmModal.dataset.waiting = 'false';
  el.confirmModal.dataset.state = readyNow ? 'ready' : 'accepted';
  el.confirmText.textContent = readyNow
    ? 'Bestillingen din er klar for henting.'
    : scheduled
      ? `Restauranten har bekreftet hentetiden ${order.pickup}.`
      : minutes > 0
        ? `Restauranten har bekreftet bestillingen. Du har fått ca. ${minutes} minutter.`
        : 'Restauranten har bekreftet bestillingen din.';

  const acceptMessage = readyNow
    ? '<strong>Klar for henting</strong><small>Kom og hent maten din nå.</small>'
    : scheduled
      ? `<strong>Hentetid ${escapeHtml(order.pickup || '')}</strong><small>Bestillingen er bekreftet.</small>`
      : minutes > 0
        ? `<strong>Ca. ${minutes} minutter</strong><small>Restauranten har satt forventet tid.</small>`
        : '<strong>Bekreftet</strong><small>Følg bestillingen videre på forsiden.</small>';

  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-accepted-status">
      <span class="confirm-accepted-check" aria-hidden="true">✓</span>
      <div>${acceptMessage}</div>
    </div>
    <p class="confirm-auto-return">Du sendes automatisk til forsiden for å følge bestillingen.</p>`;
}

function renderConfirmationTimeout(order) {
  const title = el.confirmModal.querySelector('h2');
  const phone = confirmationRestaurantPhone();
  if (title) title.textContent = 'Vi venter fortsatt på svar';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = 'timeout';
  el.confirmText.textContent = 'Det har gått 3 minutter uten bekreftelse. Vi kan være opptatt i restauranten akkurat nå.';
  const phoneAction = phone.tel
    ? `<a class="confirm-call-button" href="tel:${escapeHtml(phone.tel)}">Ring ${escapeHtml(phone.label || phone.tel)}</a>`
    : '<span class="confirm-phone-missing">Telefonnummer er ikke tilgjengelig akkurat nå.</span>';
  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-timeout-status">
      <strong>Ikke bekreftet ennå</strong>
      <small>Ring oss for å sjekke bestillingen eller bestille på telefon. Hvis vi bekrefter her etterpå, oppdateres denne siden automatisk.</small>
      ${phoneAction}
    </div>`;
}

function checkOrderConfirmationWait() {
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
    window.setTimeout(() => {
      el.confirmModal.dataset.waiting = 'false';
      orderConfirmOrderId = '';
      orderConfirmDeadline = 0;
      closeConfirm();
      renderActiveOrders();
    }, order.status === 'klar' ? 3500 : 2800);
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

function startOrderConfirmationWait(order, name) {
  if (!order?.id) return;
  if (orderConfirmTimer) clearInterval(orderConfirmTimer);
  orderConfirmOrderId = order.id;
  orderConfirmDeadline = Date.now() + ORDER_CONFIRM_WAIT_MS;
  orderConfirmTimedOut = false;
  orderConfirmResolved = false;
  ui.focusedOrderId = order.id;
  rememberCustomerOrder(order);
  persistCustomerOrderSnapshot(order);
  watchActiveOrder(order.id);
  renderConfirmationWaiting(order, name);
  el.confirmBackdrop.hidden = false;
  el.confirmModal.hidden = false;
  checkOrderConfirmationWait();
  orderConfirmTimer = window.setInterval(checkOrderConfirmationWait, 1000);
}
'''
    s = s.replace('\nasync function placeOrder() {', helper + '\n\nasync function placeOrder() {', 1)

# Replace old static confirmation block with the waiting flow.
pattern = re.compile(
    r"\n  el\.confirmText\.textContent = `Takk, \$\{name\}! Bestillingen er mottatt av restauranten\.`;\n"
    r"  el\.confirmMeta\.innerHTML = `.*?`;\n"
    r"  el\.confirmBackdrop\.hidden = false;\n"
    r"  el\.confirmModal\.hidden = false;",
    re.S,
)
s, count = pattern.subn("\n  startOrderConfirmationWait(order, name);", s, count=1)
if count != 1 and 'startOrderConfirmationWait(order, name);' not in s:
    raise SystemExit('Static order confirmation block not found')

# Lock confirmation modal while the restaurant has not answered yet.
if "if (el.confirmModal.dataset.waiting === 'true') return;" not in s:
    s = s.replace(
        'function closeConfirm() {\n',
        "function closeConfirm() {\n  if (el.confirmModal.dataset.waiting === 'true') return;\n",
        1,
    )

p.write_text(s, encoding='utf-8')

# ---------- customer.css ----------
p = Path('demo/css/customer.css')
s = p.read_text(encoding='utf-8')
marker = '/* Order confirmation wait UI 2026-09-15 */'
if marker in s:
    s = s.split(marker)[0].rstrip() + '\n'
s += r'''

/* Order confirmation wait UI 2026-09-15 */
#btnConfirmDone{display:none!important}
.confirm-modal[data-state="waiting"] .confirm-icon{background:#fff4e8!important;color:#f56608!important;box-shadow:0 0 0 0 rgba(245,102,8,.24);animation:confirmWaitPulse 1.7s ease-out infinite}
.confirm-modal[data-state="waiting"] .confirm-icon svg{opacity:.78}
.confirm-modal[data-state="accepted"] .confirm-icon,.confirm-modal[data-state="ready"] .confirm-icon{background:#eaf8ef!important;color:#29944f!important;animation:none!important}
.confirm-modal[data-state="timeout"] .confirm-icon{background:#fff5e7!important;color:#d67912!important;animation:none!important}
@keyframes confirmWaitPulse{0%{box-shadow:0 0 0 0 rgba(245,102,8,.28)}70%{box-shadow:0 0 0 16px rgba(245,102,8,0)}100%{box-shadow:0 0 0 0 rgba(245,102,8,0)}}
.confirm-wait-status,.confirm-accepted-status,.confirm-timeout-status{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;justify-content:stretch!important;gap:11px!important;margin-top:12px!important;padding:13px!important;border:1px solid #eee7df!important;border-radius:14px!important;background:#fbfaf8!important;text-align:left!important}
.confirm-wait-status>div,.confirm-accepted-status>div{display:grid!important;gap:3px!important;min-width:0!important;padding:0!important}
.confirm-wait-status strong,.confirm-accepted-status strong,.confirm-timeout-status strong{color:var(--ink)!important;font-size:13px!important;font-weight:800!important}
.confirm-wait-status small,.confirm-accepted-status small,.confirm-timeout-status small{color:var(--ink-2)!important;font-size:11.5px!important;line-height:1.4!important;font-weight:500!important}
.confirm-live-dot{width:12px!important;height:12px!important;border-radius:50%!important;background:#35aa5f!important;box-shadow:0 0 0 0 rgba(53,170,95,.35);animation:confirmLiveDot 1.35s ease-out infinite}
@keyframes confirmLiveDot{0%{box-shadow:0 0 0 0 rgba(53,170,95,.36)}70%{box-shadow:0 0 0 8px rgba(53,170,95,0)}100%{box-shadow:0 0 0 0 rgba(53,170,95,0)}}
.confirm-accepted-status{border-color:#bfe4ca!important;background:#f2fbf5!important}
.confirm-accepted-check{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border-radius:50%!important;background:#32a85b!important;color:#fff!important;font-size:16px!important;font-weight:900!important}
.confirm-timeout-status{grid-template-columns:1fr!important;border-color:#f0d5ac!important;background:#fff9ef!important;gap:7px!important}
.confirm-call-button{display:flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;margin-top:6px!important;padding:0 16px!important;border-radius:12px!important;background:#f56608!important;color:#fff!important;font-size:13px!important;font-weight:800!important;text-decoration:none!important;box-shadow:0 6px 14px rgba(245,102,8,.17)!important}
.confirm-phone-missing{display:block!important;color:#8b6550!important;font-size:12px!important}
.confirm-auto-return{margin:9px 0 0!important;color:var(--ink-2)!important;font-size:11.5px!important;text-align:center!important}
.confirm-meta [data-confirm-countdown]{color:#f56608!important;font-variant-numeric:tabular-nums!important}
@media(max-width:520px){.confirm-wait-status,.confirm-accepted-status,.confirm-timeout-status{padding:12px!important;border-radius:13px!important}.confirm-call-button{min-height:46px!important}.confirm-modal[data-state="waiting"] .confirm-icon{animation-duration:1.5s}}
'''
p.write_text(s, encoding='utf-8')

# ---------- cache bust ----------
p = Path('demo/index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'/demo/js/customer\.js\?v=[^"\']+', f'/demo/js/customer.js?v={VERSION}', s)
s = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', f'/demo/css/customer.css?v={VERSION}', s)
p.write_text(s, encoding='utf-8')

p = Path('demo/service-worker.js')
s = p.read_text(encoding='utf-8')
m = re.search(r"const CACHE_NAME = 'kol-demo-v(\d+)';", s)
if not m:
    raise SystemExit('service worker cache version not found')
next_version = int(m.group(1)) + 1
s = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", f"const CACHE_NAME = 'kol-demo-v{next_version}';", s, count=1)
p.write_text(s, encoding='utf-8')
