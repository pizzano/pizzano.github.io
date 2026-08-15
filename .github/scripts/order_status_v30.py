from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = index.replace('kol-core.css?v=mobile-v29', 'kol-core.css?v=mobile-v30', 1)

start = index.find('function orderStatusHtml(order = {}, options = {}) {')
end = index.find('\nfunction renderOrderStatus(order) {', start)
if start < 0 or end < 0:
    raise SystemExit('orderStatusHtml boundaries not found')

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

  const progress = stage === "cancelled" ? "" : `
    <div class="status-v30-progress" aria-label="Bestillingsforløp">
      <div class="status-v30-progress-step is-done"><i>1</i><span>Mottatt</span></div>
      <div class="status-v30-progress-line ${stage === "accepted" || stage === "ready" ? "is-done" : ""}"></div>
      <div class="status-v30-progress-step ${stage === "accepted" || stage === "ready" ? "is-done" : ""}"><i>2</i><span>Bekreftet</span></div>
      <div class="status-v30-progress-line ${stage === "ready" ? "is-done" : ""}"></div>
      <div class="status-v30-progress-step ${stage === "ready" ? "is-done" : ""}"><i>3</i><span>Klar</span></div>
    </div>`;

  let body = "";
  if (stage === "pending") {
    body = `
      <div class="status-v30-main pending">
        <span class="status-v30-eyebrow">BESTILLINGEN ER MOTTATT</span>
        <h3>${waitingOpen ? "Vi behandler bestillingen når vi åpner" : "Venter på bekreftelse"}</h3>
        <p>${waitingOpen ? "Du trenger ikke gjøre noe. Bestillingen sendes videre automatisk når restauranten åpner." : "Restauranten har mottatt bestillingen. Du trenger ikke gjøre noe mens vi bekrefter den."}</p>
        <div class="status-v30-timer pending">
          <span>${waitingOpen ? "ÅPNER" : "SVAR INNEN"}</span>
          <strong data-order-countdown="${escapeAttribute(order.id || "")}">${countdownText}</strong>
          <small>${waitingOpen ? "Bestillingen behandles ved åpning." : "Status oppdateres automatisk på denne siden."}</small>
        </div>
      </div>`;
  } else if (stage === "accepted") {
    const value = readyParts?.value || "";
    const unit = readyParts?.unit || "";
    const clock = readyParts?.clock || "";
    body = `
      <div class="status-v30-main accepted">
        <span class="status-v30-eyebrow">BESTILLINGEN TILBEREDES</span>
        <h3>Kjøkkenet har startet på maten din</h3>
        <p>Restauranten har satt en forventet hentetid. Gjenstående tid teller ned automatisk.</p>
        <div class="status-v30-countdown-hero">
          <span class="status-v30-countdown-label" data-customer-ready-label="${escapeAttribute(order.id || "")}">GJENSTÅR</span>
          <div class="status-v30-countdown-value">
            <strong data-customer-ready="${escapeAttribute(order.id || "")}">${escapeAttribute(value)}</strong>
            <em data-customer-ready-unit="${escapeAttribute(order.id || "")}" ${unit ? "" : "hidden"}>${escapeAttribute(unit)}</em>
          </div>
          <small>til forventet hentetid</small>
        </div>
        <div class="status-v30-pickup-time">
          <span>FORVENTET HENTETID</span>
          <strong data-customer-ready-clock="${escapeAttribute(order.id || "")}">${escapeAttribute(clock)}</strong>
          <small>Tiden er satt av restauranten og kan justeres dersom det blir ekstra travelt.</small>
        </div>
      </div>`;
  } else if (stage === "ready") {
    body = `
      <div class="status-v30-main ready">
        <span class="status-v30-eyebrow">KLAR FOR HENTING</span>
        <h3>Maten din er klar</h3>
        <p>Bestillingen er ferdig. Du kan komme og hente den nå.</p>
        <div class="status-v30-ready-banner">
          <strong>Kom og hent nå</strong>
          <small>Vis gjerne ordrenummeret ved henting.</small>
        </div>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>Maten er klar</span>
        <strong data-customer-ready="${escapeAttribute(order.id || "")}" hidden></strong>
        <em data-customer-ready-unit="${escapeAttribute(order.id || "")}" hidden></em>
        <small data-customer-ready-clock="${escapeAttribute(order.id || "")}" hidden></small>
      </div>`;
  } else {
    body = `
      <div class="status-v30-main cancelled">
        <span class="status-v30-eyebrow">BESTILLINGEN ER AVSLUTTET</span>
        <h3>Bestillingen ble kansellert</h3>
        <p>Restauranten har kansellert bestillingen.</p>
        <div class="status-v30-cancel-banner">
          <strong>Ikke hent bestillingen</strong>
          <small>Ta kontakt med restauranten dersom du har spørsmål.</small>
        </div>
      </div>`;
  }

  const supportPhone = normalizeSiteSettings(siteSettings).phone || "+47 41 14 53 53";
  const supportPhoneDigits = String(supportPhone).replace(/\D/g, "");
  const supportPhoneHref = supportPhoneDigits ? `tel:${supportPhoneDigits.startsWith("47") ? "+" : "+47"}${supportPhoneDigits}` : `tel:${supportPhone.replace(/\s+/g, "")}`;
  const expiredHelp = expired ? `<p class="status-v30-support">Det tar litt ekstra tid. Vent litt til, eller ring oss på <a href="${escapeAttribute(supportPhoneHref)}">${escapeAttribute(supportPhone)}</a>.</p>` : "";

  return `
    <section class="order-live-status status-v30 stage-${stage} ${waitingOpen ? "waiting-open" : ""}">
      <div class="status-v30-meta">
        <span class="status-v30-badge">${statusLabel}</span>
        <small>Ordre <b>${orderId}</b></small>
      </div>
      ${progress}
      ${body}
      ${expiredHelp}
    </section>
    ${options.includeReceipt ? orderLinesHtml(order) : ""}
    ${options.showCloseButton ? `<button class="order-live-close-inline status-v30-close" type="button" data-close-order-live>Lukk</button>` : ""}
  `;
}
'''

index = index[:start] + new_func + index[end:]
index_path.write_text(index, encoding='utf-8')

old_start = '/* ===== PREMIUM ORDER STATUS V29 ===== */'
old_end = '/* ===== END PREMIUM ORDER STATUS V29 ===== */'
if old_start in css and old_end in css:
    a = css.index(old_start)
    b = css.index(old_end, a) + len(old_end)
    css = css[:a] + css[b:]

v30 = r'''
/* ===== PREMIUM ORDER STATUS V30 ===== */
@layer mobile {
body.kol-customer .order-live-content{background:#f2eee8!important;padding:0!important;}
body.kol-customer .status-v30{--sv30:#c98a22;--sv30-soft:#fff7e7;width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;color:#27221f!important;overflow:hidden!important;}
body.kol-customer .status-v30.stage-accepted{--sv30:#176a4a;--sv30-soft:#edf7f1;}
body.kol-customer .status-v30.stage-ready{--sv30:#0f5b3d;--sv30-soft:#e8f4ed;}
body.kol-customer .status-v30.stage-cancelled{--sv30:#a63b3e;--sv30-soft:#fff0f0;}
body.kol-customer .status-v30-meta{min-height:52px!important;padding:12px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;border-top:4px solid var(--sv30)!important;border-bottom:1px solid #e2dbd4!important;background:#fff!important;}
body.kol-customer .status-v30-meta small{margin:0!important;color:#615851!important;font-size:13px!important;font-weight:500!important;letter-spacing:.02em!important;}
body.kol-customer .status-v30-meta small b{color:#27221f!important;font-weight:700!important;}
body.kol-customer .status-v30-badge{display:inline-flex!important;align-items:center!important;min-height:28px!important;padding:0 10px!important;border:1px solid color-mix(in srgb,var(--sv30) 45%,#fff)!important;border-radius:0!important;background:var(--sv30-soft)!important;color:var(--sv30)!important;font-size:12px!important;font-weight:750!important;letter-spacing:.04em!important;text-transform:uppercase!important;}
body.kol-customer .status-v30-progress{height:68px!important;padding:12px 16px 10px!important;display:grid!important;grid-template-columns:auto 1fr auto 1fr auto!important;align-items:start!important;border-bottom:1px solid #e2dbd4!important;background:#faf8f5!important;}
body.kol-customer .status-v30-progress-step{display:grid!important;justify-items:center!important;gap:5px!important;color:#9a9189!important;font-size:11px!important;font-weight:650!important;line-height:1!important;}
body.kol-customer .status-v30-progress-step i{width:25px!important;height:25px!important;display:grid!important;place-items:center!important;border:1px solid #cfc6bd!important;border-radius:0!important;background:#fff!important;color:#8f867e!important;font-style:normal!important;font-size:11px!important;font-weight:750!important;}
body.kol-customer .status-v30-progress-step.is-done{color:var(--sv30)!important;}
body.kol-customer .status-v30-progress-step.is-done i{border-color:var(--sv30)!important;background:var(--sv30)!important;color:#fff!important;}
body.kol-customer .status-v30-progress-line{height:2px!important;margin:12px 7px 0!important;background:#d8d0c8!important;}
body.kol-customer .status-v30-progress-line.is-done{background:var(--sv30)!important;}
body.kol-customer .status-v30-main{padding:22px 16px 20px!important;border-bottom:1px solid #e2dbd4!important;background:#fff!important;}
body.kol-customer .status-v30-eyebrow{display:block!important;margin:0 0 7px!important;color:var(--sv30)!important;font-size:11px!important;font-weight:800!important;letter-spacing:.12em!important;line-height:1.2!important;}
body.kol-customer .status-v30-main h3{margin:0!important;color:#211d1a!important;font-size:24px!important;font-weight:720!important;line-height:1.14!important;letter-spacing:-.025em!important;}
body.kol-customer .status-v30-main>p{max-width:390px!important;margin:8px 0 0!important;color:#6b625b!important;font-size:14px!important;font-weight:400!important;line-height:1.48!important;}
body.kol-customer .status-v30-timer{margin-top:20px!important;padding:16px!important;display:grid!important;grid-template-columns:1fr auto!important;grid-template-areas:"label value" "note note"!important;gap:7px 14px!important;border:1px solid #e4c88f!important;border-left:4px solid var(--sv30)!important;border-radius:0!important;background:var(--sv30-soft)!important;}
body.kol-customer .status-v30-timer>span{grid-area:label!important;align-self:center!important;color:#72521f!important;font-size:11px!important;font-weight:800!important;letter-spacing:.1em!important;}
body.kol-customer .status-v30-timer>strong{grid-area:value!important;color:#714712!important;font-size:34px!important;font-weight:620!important;line-height:1!important;font-variant-numeric:tabular-nums!important;letter-spacing:-.04em!important;}
body.kol-customer .status-v30-timer>small{grid-area:note!important;color:#766a5f!important;font-size:12.5px!important;line-height:1.4!important;}
body.kol-customer .status-v30-countdown-hero{margin-top:20px!important;padding:20px 16px 18px!important;border:1px solid #b9d8c8!important;border-left:5px solid #176a4a!important;border-radius:0!important;background:#f1f8f4!important;}
body.kol-customer .status-v30-countdown-label{display:block!important;margin-bottom:5px!important;color:#176a4a!important;font-size:11px!important;font-weight:800!important;letter-spacing:.12em!important;}
body.kol-customer .status-v30-countdown-value{display:flex!important;align-items:flex-end!important;gap:7px!important;min-height:58px!important;}
body.kol-customer .status-v30-countdown-value strong{color:#104d38!important;font-size:52px!important;font-weight:560!important;line-height:.95!important;font-variant-numeric:tabular-nums!important;letter-spacing:-.055em!important;}
body.kol-customer .status-v30-countdown-value em{padding-bottom:6px!important;color:#176a4a!important;font-size:16px!important;font-weight:650!important;font-style:normal!important;}
body.kol-customer .status-v30-countdown-hero>small{display:block!important;margin-top:7px!important;color:#596c62!important;font-size:13px!important;line-height:1.35!important;}
body.kol-customer .status-v30-pickup-time{padding:15px 16px!important;display:grid!important;gap:4px!important;border:1px solid #d6ded8!important;border-top:0!important;border-radius:0!important;background:#fff!important;}
body.kol-customer .status-v30-pickup-time>span{color:#746c65!important;font-size:10.5px!important;font-weight:800!important;letter-spacing:.11em!important;}
body.kol-customer .status-v30-pickup-time>strong{color:#1d352b!important;font-size:20px!important;font-weight:700!important;line-height:1.2!important;}
body.kol-customer .status-v30-pickup-time>small{color:#776e67!important;font-size:12.5px!important;line-height:1.42!important;}
body.kol-customer .status-v30-ready-banner{margin-top:20px!important;padding:18px 16px!important;border:0!important;border-left:6px solid #0b432f!important;border-radius:0!important;background:#0f5b3d!important;color:#fff!important;}
body.kol-customer .status-v30-ready-banner strong{display:block!important;color:#fff!important;font-size:25px!important;font-weight:720!important;line-height:1.1!important;}
body.kol-customer .status-v30-ready-banner small{display:block!important;margin-top:6px!important;color:#def0e7!important;font-size:13px!important;line-height:1.4!important;}
body.kol-customer .status-v30-cancel-banner{margin-top:20px!important;padding:17px 16px!important;border:1px solid #e5b9ba!important;border-left:6px solid #a63b3e!important;border-radius:0!important;background:#fff2f2!important;}
body.kol-customer .status-v30-cancel-banner strong{display:block!important;color:#8f282c!important;font-size:21px!important;font-weight:720!important;line-height:1.15!important;}
body.kol-customer .status-v30-cancel-banner small{display:block!important;margin-top:6px!important;color:#795f60!important;font-size:13px!important;line-height:1.4!important;}
body.kol-customer .status-v30-support{margin:0!important;padding:12px 16px!important;border-bottom:1px solid #e2dbd4!important;background:#fff9ed!important;color:#6c5a3f!important;font-size:12.5px!important;line-height:1.45!important;}
body.kol-customer .status-v30-support a{color:#a45d11!important;font-weight:700!important;text-decoration:none!important;}
body.kol-customer .customer-receipt-lines{margin:0!important;padding:0 16px!important;background:#fff!important;}
body.kol-customer .customer-receipt-line{padding:14px 0!important;border-bottom:1px solid #e5ded7!important;border-radius:0!important;background:#fff!important;}
body.kol-customer .customer-receipt-line:last-child{border-bottom:0!important;}
body.kol-customer .customer-receipt-total{padding:15px 0!important;border-top:1px solid #cfc6bd!important;}
body.kol-customer .status-v30-close{width:100%!important;min-height:54px!important;margin:0!important;border:0!important;border-top:1px solid #d8d0c8!important;border-radius:0!important;background:#25211f!important;color:#fff!important;font-size:15px!important;font-weight:650!important;box-shadow:none!important;}
body.kol-customer .status-v30-close:hover,body.kol-customer .status-v30-close:active{transform:none!important;background:#25211f!important;box-shadow:none!important;}
@media(max-width:380px){body.kol-customer .status-v30-main{padding:18px 14px!important;}body.kol-customer .status-v30-countdown-value strong{font-size:46px!important;}body.kol-customer .status-v30-main h3{font-size:22px!important;}body.kol-customer .status-v30-meta{padding-left:14px!important;padding-right:14px!important;}body.kol-customer .status-v30-progress{padding-left:12px!important;padding-right:12px!important;}}
}
/* ===== END PREMIUM ORDER STATUS V30 ===== */
'''
css = css.rstrip() + '\n\n' + v30.strip() + '\n'
css_path.write_text(css, encoding='utf-8')
print('patched v30')
