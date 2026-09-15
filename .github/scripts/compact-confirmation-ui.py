from pathlib import Path

JS = Path('demo/js/customer.js')
CSS = Path('demo/css/customer.css')
HTML = Path('demo/index.html')

js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

old_render = r'''function renderConfirmationAccepted(order) {
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
}'''

new_render = r'''function renderConfirmationAccepted(order) {
  const title = el.confirmModal.querySelector('h2');
  const minutes = Math.max(0, Number(order.estimatedMinutes) || 0);
  const scheduled = order.pickupMode === 'scheduled' || (order.pickup && order.pickup !== 'Snarest');
  const readyNow = order.status === 'klar';
  if (title) title.textContent = readyNow ? 'Klar for henting' : 'Bestillingen er bekreftet';
  el.confirmModal.dataset.waiting = 'true';
  el.confirmModal.dataset.state = readyNow ? 'ready' : 'accepted';
  if (el.btnConfirmDone) el.btnConfirmDone.hidden = true;

  el.confirmText.textContent = readyNow
    ? 'Maten din er klar.'
    : scheduled
      ? `Henting ${order.pickup}.`
      : minutes > 0
        ? `Ca. ${minutes} minutter.`
        : 'Bestillingen er tatt imot.';

  const statusLine = readyNow
    ? '<strong>Klar nå</strong>'
    : scheduled
      ? `<strong>${escapeHtml(order.pickup || '')}</strong>`
      : minutes > 0
        ? `<strong data-confirm-ready-countdown>${escapeHtml(confirmationReadyLeftText(order))}</strong>`
        : '<strong>Bekreftet</strong>';

  el.confirmMeta.innerHTML = `${confirmationBaseRows(order)}
    <div class="confirm-accepted-status">
      <span class="confirm-accepted-check" aria-hidden="true">✓</span>
      <div>${statusLine}</div>
    </div>`;
}'''

if old_render not in js:
    raise SystemExit('renderConfirmationAccepted block not found')
js = js.replace(old_render, new_render, 1)

anchor = js.find('function startAcceptedConfirmationHold(order)')
if anchor < 0:
    raise SystemExit('startAcceptedConfirmationHold not found')
end = js.find('function renderConfirmationTimeout', anchor)
block = js[anchor:end]
old_timeout = '  }, 8000);\n}'
new_timeout = '  }, 3000);\n}'
if old_timeout not in block:
    raise SystemExit('accepted redirect timeout not found')
block = block.replace(old_timeout, new_timeout, 1)
block = block.replace('// Long enough to read the accepted time, then move to the live order card.', '// Show the compact confirmation briefly, then return to the main menu.')
js = js[:anchor] + block + js[end:]

old_total_label = '<div><span>Å betale ved henting</span><strong>${formatPrice(order.total)}</strong></div>'
new_total_label = '<div><span>Beløp</span><strong>${formatPrice(order.total)}</strong></div>'
if old_total_label not in js:
    raise SystemExit('confirmation total row not found')
js = js.replace(old_total_label, new_total_label, 1)

old_submit_line = "  el.btnStepNext.disabled = ui.orderSubmitting;\n  updateContactValidation();"
new_submit_line = "  el.btnStepNext.disabled = ui.orderSubmitting;\n  el.views.checkout.classList.toggle('is-submitting', ui.orderSubmitting);\n  updateContactValidation();"
if old_submit_line not in js:
    raise SystemExit('checkout submit state anchor not found')
js = js.replace(old_submit_line, new_submit_line, 1)

css_patch = r'''

/* Compact confirmation + clean sending state 2026-09-15 */
body:has(#confirmModal:not([hidden])) .view-checkout > .checkout-actions,
.view-checkout.is-submitting > .checkout-actions {
  display: none !important;
}

.confirm-modal[data-state="accepted"],
.confirm-modal[data-state="ready"] {
  width: calc(100% - 32px) !important;
  max-width: 360px !important;
  padding: 16px !important;
  border-radius: 18px !important;
}
.confirm-modal[data-state="accepted"] .confirm-icon,
.confirm-modal[data-state="ready"] .confirm-icon {
  width: 40px !important;
  height: 40px !important;
  margin-bottom: 8px !important;
}
.confirm-modal[data-state="accepted"] .confirm-icon svg,
.confirm-modal[data-state="ready"] .confirm-icon svg {
  width: 21px !important;
  height: 21px !important;
}
.confirm-modal[data-state="accepted"] h2,
.confirm-modal[data-state="ready"] h2 {
  margin: 0 0 2px !important;
  font-size: 16px !important;
  line-height: 1.2 !important;
}
.confirm-modal[data-state="accepted"] #confirmText,
.confirm-modal[data-state="ready"] #confirmText {
  margin: 0 0 8px !important;
  font-size: 12.5px !important;
  line-height: 1.35 !important;
}
.confirm-modal[data-state="accepted"] .confirm-meta,
.confirm-modal[data-state="ready"] .confirm-meta {
  margin: 0 !important;
  padding-top: 7px !important;
  font-size: 12px !important;
}
.confirm-modal[data-state="accepted"] .confirm-meta > div:not(.confirm-accepted-status),
.confirm-modal[data-state="ready"] .confirm-meta > div:not(.confirm-accepted-status) {
  padding: 2px 0 !important;
}
.confirm-modal[data-state="accepted"] .confirm-accepted-status,
.confirm-modal[data-state="ready"] .confirm-accepted-status {
  margin-top: 8px !important;
  padding: 10px !important;
  gap: 9px !important;
  border-radius: 12px !important;
}
.confirm-modal[data-state="accepted"] .confirm-accepted-check,
.confirm-modal[data-state="ready"] .confirm-accepted-check {
  width: 24px !important;
  height: 24px !important;
  font-size: 14px !important;
}
.confirm-modal[data-state="accepted"] .confirm-accepted-status strong,
.confirm-modal[data-state="ready"] .confirm-accepted-status strong {
  font-size: 12.5px !important;
  line-height: 1.2 !important;
}
.confirm-modal[data-state="accepted"] .confirm-accepted-status small,
.confirm-modal[data-state="ready"] .confirm-accepted-status small,
.confirm-ready-countdown,
.confirm-auto-return {
  display: none !important;
}
@media (max-width: 520px) {
  .confirm-modal[data-state="accepted"],
  .confirm-modal[data-state="ready"] {
    width: calc(100% - 36px) !important;
    max-width: 340px !important;
    padding: 15px !important;
  }
}
'''

if '/* Compact confirmation + clean sending state 2026-09-15 */' not in css:
    css += css_patch

html = html.replace('/demo/css/customer.css?v=20260915-confirmwait2', '/demo/css/customer.css?v=20260915-compactconfirm1')
html = html.replace('/demo/js/customer.js?v=20260915-confirmwait2', '/demo/js/customer.js?v=20260915-compactconfirm1')

JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
