from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v29', index, count=1)

new_func = r'''function orderStatusHtml(order = {}, options = {}) {
  const status = order.status || "pending";
  const orderId = String(order.id || "").slice(-7).toUpperCase();
  const waitingOpen = status === "pending" && isOrderWaitingForOpening(order);
  const deadline = getOrderAcceptDeadline(order);
  const expired = status === "pending" && !waitingOpen && deadline.getTime() <= Date.now();
  const countdownText = waitingOpen
    ? `Åpner kl. ${formatClock(order.processableAfter)}`
    : expired
      ? "Litt forsinket"
      : formatCountdown(deadline.getTime() - Date.now());
  const readyParts = status === "accepted" ? orderReadyDisplayParts(order) : null;
  const isReady = status === "accepted" && (order.ready === true || readyParts?.label === "Maten er klar");
  const stage = status === "cancelled" ? "cancelled" : isReady ? "ready" : status === "accepted" ? "accepted" : "pending";

  const statusLabel = waitingOpen
    ? "Venter til åpning"
    : stage === "cancelled"
      ? "Kansellert"
      : stage === "ready"
        ? "Klar"
        : stage === "accepted"
          ? "Bekreftet"
          : "Venter";

  const title = waitingOpen
    ? "Bestillingen er mottatt"
    : stage === "cancelled"
      ? "Bestillingen ble kansellert"
      : stage === "ready"
        ? "Maten er klar"
        : stage === "accepted"
          ? "Bestillingen er bekreftet"
          : "Venter på bekreftelse";

  const subtitle = waitingOpen
    ? `Vi åpner kl. ${formatClock(order.processableAfter)}. Bestillingen behandles når restauranten åpner.`
    : stage === "cancelled"
      ? "Bestillingen skal ikke hentes."
      : stage === "ready"
        ? "Bestillingen er ferdig og kan hentes nå."
        : stage === "accepted"
          ? "Kjøkkenet har mottatt bestillingen og har startet tilberedningen."
          : "Restauranten har mottatt bestillingen. Vi venter på bekreftelse.";

  const progressHtml = stage === "cancelled" ? "" : `
    <div class="premium-order-progress stage-${stage}" aria-label="Bestillingsforløp">
      <div class="premium-progress-step received"><i></i><span>Mottatt</span></div>
      <div class="premium-progress-step confirmed"><i></i><span>Bekreftet</span></div>
      <div class="premium-progress-step ready"><i></i><span>Klar</span></div>
    </div>`;

  let infoHtml = "";
  if (stage === "pending") {
    infoHtml = `
      <div class="premium-status-detail waiting ${expired ? "expired" : ""}">
        <span>${waitingOpen ? "Åpner" : "Svar innen"}</span>
        <strong data-order-countdown="${escapeAttribute(order.id || "")}">${countdownText}</strong>
        <small>${waitingOpen ? "Bestillingen behandles automatisk når vi åpner." : "Du trenger ikke gjøre noe. Status oppdateres automatisk."}</small>
      </div>`;
  } else if (stage === "accepted") {
    infoHtml = `
      <div class="order-ready-clean-card is-counting premium-status-detail accepted">
        <div class="order-ready-clean-main">
          <span data-customer-ready-label="${escapeAttribute(order.id || "")}">${escapeAttribute(readyParts.label)}</span>
          ${readyParts.value ? `<strong data-customer-ready="${escapeAttribute(order.id || "")}">${escapeAttribute(readyParts.value)}</strong>` : `<strong data-customer-ready="${escapeAttribute(order.id || "")}" hidden></strong>`}
          ${readyParts.unit ? `<em data-customer-ready-unit="${escapeAttribute(order.id || "")}">${escapeAttribute(readyParts.unit)}</em>` : `<em data-customer-ready-unit="${escapeAttribute(order.id || "")}" hidden></em>`}
        </div>
        <small data-customer-ready-clock="${escapeAttribute(order.id || "")}">${escapeAttribute(readyParts.clock || "Vi oppdaterer når maten er klar.")}</small>
      </div>`;
  } else if (stage === "ready") {
    infoHtml = `
      <div class="order-ready-clean-card is-ready premium-status-detail ready">
        <div class="order-ready-clean-main">
          <span data-customer-ready-label="${escapeAttribute(order.id || "")}">Maten er klar</span>
          <strong data-customer-ready="${escapeAttribute(order.id || "")}" hidden></strong>
          <em data-customer-ready-unit="${escapeAttribute(order.id || "")}" hidden></em>
        </div>
        <small data-customer-ready-clock="${escapeAttribute(order.id || "")}">Kom og hent bestillingen nå.</small>
      </div>`;
  } else {
    infoHtml = `
      <div class="order-mini-info single cancelled-message premium-status-detail cancelled">
        <span>Status</span>
        <strong>Kansellert av restauranten</strong>
        <small>Bestillingen skal ikke hentes.</small>
      </div>`;
  }

  const supportPhone = normalizeSiteSettings(siteSettings).phone || "+47 41 14 53 53";
  const supportPhoneDigits = String(supportPhone).replace(/\D/g, "");
  const supportPhoneHref = supportPhoneDigits ? `tel:${supportPhoneDigits.startsWith("47") ? "+" : "+47"}${supportPhoneDigits}` : `tel:${supportPhone.replace(/\s+/g, "")}`;
  const expiredHelp = expired
    ? `<p class="premium-status-support">Det tar litt ekstra tid. Vent litt til, eller ring oss på <a href="${escapeAttribute(supportPhoneHref)}">${escapeAttribute(supportPhone)}</a>.</p>`
    : "";

  const icon = stage === "cancelled" ? "×" : stage === "pending" ? "•" : "✓";

  return `
    <section class="order-live-status premium-order-status ${status} stage-${stage} ${waitingOpen ? "waiting-open" : ""}">
      <div class="premium-status-meta">
        <span class="premium-status-label">${statusLabel}</span>
        <small>Ordre ${orderId}</small>
      </div>
      ${progressHtml}
      <div class="premium-status-hero">
        <span class="premium-status-symbol" aria-hidden="true">${icon}</span>
        <div>
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
      </div>
      ${infoHtml}
      ${expiredHelp}
    </section>
    ${options.includeReceipt ? orderLinesHtml(order) : ""}
    ${options.showCloseButton ? `<button class="order-live-close-inline" type="button" data-close-order-live>Lukk</button>` : ""}
  `;
}'''

pattern = r'function orderStatusHtml\(order = \{\}, options = \{\}\) \{.*?\n\}\n\nfunction renderOrderStatus\(order\) \{'
index, count = re.subn(pattern, new_func + '\n\nfunction renderOrderStatus(order) {', index, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'Could not replace orderStatusHtml; replacements={count}')
index_path.write_text(index, encoding='utf-8')

start_marker = '/* ===== PREMIUM ORDER STATUS V29 ===== */'
end_marker = '/* ===== END PREMIUM ORDER STATUS V29 ===== */'
if start_marker in css:
    css = re.sub(re.escape(start_marker) + r'.*?' + re.escape(end_marker), '', css, flags=re.S)

premium_css = r'''
/* ===== PREMIUM ORDER STATUS V29 ===== */
body.kol-customer .order-live-content{background:#f4f0ea!important;}
body.kol-customer .premium-order-status,
body.kol-customer .premium-order-status.pending,
body.kol-customer .premium-order-status.accepted,
body.kol-customer .premium-order-status.cancelled,
body.kol-customer .premium-order-status.stage-ready{
  --status-accent:#c98a22;
  --status-soft:#fff8e9;
  --status-ink:#2e2925;
  width:100%!important;
  margin:0!important;
  padding:18px 16px 20px!important;
  border:0!important;
  border-top:4px solid var(--status-accent)!important;
  border-bottom:1px solid #ddd5cc!important;
  border-radius:0!important;
  background:#fffdfa!important;
  box-shadow:none!important;
  color:var(--status-ink)!important;
}
body.kol-customer .premium-order-status.stage-pending{--status-accent:#c98a22;--status-soft:#fff8e9;}
body.kol-customer .premium-order-status.stage-accepted{--status-accent:#247454;--status-soft:#eef7f2;}
body.kol-customer .premium-order-status.stage-ready{--status-accent:#14583f;--status-soft:#eaf4ef;}
body.kol-customer .premium-order-status.stage-cancelled{--status-accent:#a83e42;--status-soft:#fff0f0;}

body.kol-customer .premium-status-meta{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:0!important;padding:0 0 14px!important;border-bottom:1px solid #e4ddd5!important;}
body.kol-customer .premium-status-label{display:inline-flex!important;align-items:center!important;min-height:28px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--status-accent)!important;font-size:12px!important;font-weight:750!important;letter-spacing:.12em!important;text-transform:uppercase!important;}
body.kol-customer .premium-status-meta small{color:#746a62!important;font-size:12px!important;font-weight:650!important;letter-spacing:.04em!important;}

body.kol-customer .premium-order-progress{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;margin:14px 0 0!important;padding:0!important;}
body.kol-customer .premium-progress-step{position:relative!important;display:grid!important;gap:7px!important;color:#9a918a!important;font-size:11px!important;font-weight:650!important;letter-spacing:.02em!important;}
body.kol-customer .premium-progress-step i{display:block!important;width:100%!important;height:3px!important;background:#ded7d0!important;}
body.kol-customer .premium-order-progress.stage-pending .premium-progress-step.received,
body.kol-customer .premium-order-progress.stage-accepted .premium-progress-step.received,
body.kol-customer .premium-order-progress.stage-accepted .premium-progress-step.confirmed,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.received,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.confirmed,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.ready{color:var(--status-accent)!important;}
body.kol-customer .premium-order-progress.stage-pending .premium-progress-step.received i,
body.kol-customer .premium-order-progress.stage-accepted .premium-progress-step.received i,
body.kol-customer .premium-order-progress.stage-accepted .premium-progress-step.confirmed i,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.received i,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.confirmed i,
body.kol-customer .premium-order-progress.stage-ready .premium-progress-step.ready i{background:var(--status-accent)!important;}

body.kol-customer .premium-status-hero{display:grid!important;grid-template-columns:42px minmax(0,1fr)!important;gap:14px!important;align-items:start!important;margin:18px 0 0!important;padding:0!important;}
body.kol-customer .premium-status-symbol{width:42px!important;height:42px!important;display:grid!important;place-items:center!important;border:1px solid #d7cec4!important;border-radius:0!important;background:var(--status-soft)!important;color:var(--status-accent)!important;font-size:24px!important;font-weight:800!important;line-height:1!important;}
body.kol-customer .premium-status-hero h3,
body.kol-customer .premium-order-status h3{margin:0!important;color:#26211e!important;font-size:22px!important;font-weight:700!important;line-height:1.16!important;letter-spacing:-.025em!important;}
body.kol-customer .premium-status-hero p,
body.kol-customer .premium-order-status>p{margin:6px 0 0!important;color:#6d645e!important;font-size:13.5px!important;font-weight:400!important;line-height:1.48!important;}

body.kol-customer .premium-status-detail,
body.kol-customer .premium-order-status .order-countdown-box,
body.kol-customer .premium-order-status .order-ready-clean-card,
body.kol-customer .premium-order-status .order-mini-info.cancelled-message{margin:18px 0 0!important;padding:14px 15px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"label value" "note note"!important;gap:7px 12px!important;border:1px solid #dcd4cc!important;border-left:4px solid var(--status-accent)!important;border-radius:0!important;background:var(--status-soft)!important;background-image:none!important;box-shadow:none!important;color:#342e29!important;}
body.kol-customer .premium-status-detail>span,
body.kol-customer .premium-status-detail .order-ready-clean-main>span{grid-area:label!important;align-self:center!important;color:#6c625a!important;font-size:12px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;}
body.kol-customer .premium-status-detail>strong,
body.kol-customer .premium-status-detail .order-ready-clean-main>strong{grid-area:value!important;justify-self:end!important;align-self:center!important;color:var(--status-accent)!important;font-size:23px!important;font-weight:750!important;line-height:1!important;text-align:right!important;}
body.kol-customer .premium-status-detail>small,
body.kol-customer .premium-status-detail .order-ready-clean-main+small{grid-area:note!important;margin:0!important;color:#6b625b!important;font-size:12.5px!important;font-weight:400!important;line-height:1.42!important;}
body.kol-customer .premium-status-detail .order-ready-clean-main{display:contents!important;}
body.kol-customer .premium-status-detail .order-ready-clean-main>em{display:none!important;}
body.kol-customer .premium-status-detail.ready{background:#14583f!important;border-color:#14583f!important;color:#fff!important;}
body.kol-customer .premium-status-detail.ready>span,
body.kol-customer .premium-status-detail.ready>strong,
body.kol-customer .premium-status-detail.ready>small,
body.kol-customer .premium-status-detail.ready .order-ready-clean-main>span,
body.kol-customer .premium-status-detail.ready .order-ready-clean-main>strong,
body.kol-customer .premium-status-detail.ready .order-ready-clean-main+small{color:#fff!important;}
body.kol-customer .premium-status-detail.cancelled>strong{font-size:17px!important;color:#98363a!important;}
body.kol-customer .premium-status-support{margin:12px 0 0!important;color:#766d66!important;font-size:12.5px!important;line-height:1.45!important;}
body.kol-customer .premium-status-support a{color:#b36c12!important;font-weight:700!important;text-decoration:none!important;}

body.kol-customer .customer-receipt-lines{margin:0!important;padding:0 16px!important;border:0!important;border-radius:0!important;background:#fffdfa!important;box-shadow:none!important;}
body.kol-customer .customer-receipt-line{min-height:64px!important;padding:12px 0!important;border-bottom:1px solid #e3dcd4!important;}
body.kol-customer .customer-receipt-line>div>strong{font-size:13.5px!important;font-weight:650!important;}
body.kol-customer .customer-receipt-detail-rows p,
body.kol-customer .customer-receipt-line p{margin:3px 0 0!important;color:#786f68!important;font-size:11.5px!important;line-height:1.35!important;}
body.kol-customer .customer-receipt-total{padding:14px 0!important;border-bottom:1px solid #ddd5cc!important;}
body.kol-customer .customer-receipt-total span{font-size:13px!important;font-weight:650!important;}
body.kol-customer .customer-receipt-total strong{font-size:18px!important;font-weight:750!important;}
body.kol-customer .order-live-close-inline{width:calc(100% - 32px)!important;min-height:50px!important;margin:16px!important;padding:0 16px!important;border:1px solid #28231f!important;border-radius:0!important;background:#28231f!important;color:#fff!important;font-size:14px!important;font-weight:700!important;letter-spacing:.03em!important;box-shadow:none!important;transform:none!important;}
body.kol-customer .order-live-close-inline:hover,
body.kol-customer .order-live-close-inline:active{background:#1d1916!important;box-shadow:none!important;transform:none!important;}

@media(max-width:390px){
  body.kol-customer .premium-order-status{padding:16px 14px 18px!important;}
  body.kol-customer .premium-status-hero{grid-template-columns:38px minmax(0,1fr)!important;gap:11px!important;}
  body.kol-customer .premium-status-symbol{width:38px!important;height:38px!important;font-size:21px!important;}
  body.kol-customer .premium-status-hero h3,body.kol-customer .premium-order-status h3{font-size:20px!important;}
  body.kol-customer .premium-status-detail{grid-template-columns:1fr!important;grid-template-areas:"label" "value" "note"!important;}
  body.kol-customer .premium-status-detail>strong,body.kol-customer .premium-status-detail .order-ready-clean-main>strong{justify-self:start!important;text-align:left!important;font-size:21px!important;}
  body.kol-customer .customer-receipt-lines{padding:0 14px!important;}
  body.kol-customer .order-live-close-inline{width:calc(100% - 28px)!important;margin:14px!important;}
}
/* ===== END PREMIUM ORDER STATUS V29 ===== */
'''
css = css.rstrip() + '\n\n' + premium_css.strip() + '\n'
css_path.write_text(css, encoding='utf-8')
