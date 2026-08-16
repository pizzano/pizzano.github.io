from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = index.replace('kol-core.css?v=mobile-v30', 'kol-core.css?v=mobile-v31', 1)

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
  const readyParts = status === "accepted" ? orderReadyDisplayParts(order) : null;
  const isReady = status === "accepted" && (order.ready === true || readyParts?.label === "Maten er klar");
  const stage = status === "cancelled" ? "cancelled" : isReady ? "ready" : status === "accepted" ? "accepted" : "pending";

  const pendingCountdown = waitingOpen
    ? `Åpner kl. ${formatClock(order.processableAfter)}`
    : expired
      ? "Litt forsinket"
      : formatCountdown(deadline.getTime() - Date.now());

  const badge = waitingOpen ? "Venter" : stage === "cancelled" ? "Kansellert" : stage === "ready" ? "Klar" : stage === "accepted" ? "Bekreftet" : "Venter";

  const flow = stage === "cancelled" ? "" : `
    <div class="status-v31-flow stage-${stage}" aria-label="Bestillingsstatus">
      <span class="done">Mottatt</span><i></i>
      <span class="${stage === "accepted" || stage === "ready" ? "done" : ""}">Bekreftet</span><i></i>
      <span class="${stage === "ready" ? "done" : ""}">Klar</span>
    </div>`;

  let main = "";
  if (stage === "pending") {
    main = `
      <div class="status-v31-main pending">
        <span class="status-v31-kicker">BESTILLING MOTTATT</span>
        <h3>${waitingOpen ? "Venter til vi åpner" : "Venter på bekreftelse"}</h3>
        <div class="status-v31-time pending">
          <small>${waitingOpen ? "ÅPNER" : "SVAR INNEN"}</small>
          <strong data-order-countdown="${escapeAttribute(order.id || "")}">${pendingCountdown}</strong>
        </div>
        <p>${waitingOpen ? "Bestillingen behandles automatisk når vi åpner." : "Du trenger ikke gjøre noe. Status oppdateres automatisk."}</p>
      </div>`;
  } else if (stage === "accepted") {
    const value = readyParts?.value || "";
    const unit = readyParts?.unit || "";
    const clock = readyParts?.clock || "";
    main = `
      <div class="status-v31-main accepted">
        <span class="status-v31-kicker">BESTILLINGEN TILBEREDES</span>
        <h3>Bekreftet</h3>
        <div class="status-v31-time accepted">
          <small>CA. TID IGJEN</small>
          <div><strong data-customer-ready="${escapeAttribute(order.id || "")}">${escapeAttribute(value)}</strong><em data-customer-ready-unit="${escapeAttribute(order.id || "")}" ${unit ? "" : "hidden"}>${escapeAttribute(unit)}</em></div>
          <span>til maten forventes klar</span>
        </div>
        <div class="status-v31-pickup">
          <small>HENT CA.</small>
          <strong data-customer-ready-clock="${escapeAttribute(order.id || "")}">${escapeAttribute(clock)}</strong>
        </div>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>${escapeAttribute(readyParts?.label || "")}</span>
      </div>`;
  } else if (stage === "ready") {
    main = `
      <div class="status-v31-main ready">
        <span class="status-v31-kicker">KLAR FOR HENTING</span>
        <h3>Maten din er klar</h3>
        <div class="status-v31-ready">
          <strong>Kom og hent nå</strong>
          <small>Si navnet ditt og hva du bestilte.</small>
        </div>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>Maten er klar</span>
        <strong data-customer-ready="${escapeAttribute(order.id || "")}" hidden></strong>
        <em data-customer-ready-unit="${escapeAttribute(order.id || "")}" hidden></em>
        <small data-customer-ready-clock="${escapeAttribute(order.id || "")}" hidden></small>
      </div>`;
  } else {
    main = `
      <div class="status-v31-main cancelled">
        <span class="status-v31-kicker">BESTILLINGEN ER AVSLUTTET</span>
        <h3>Kansellert</h3>
        <div class="status-v31-cancel">
          <strong>Ikke hent bestillingen</strong>
          <small>Bestillingen ble kansellert av restauranten.</small>
        </div>
      </div>`;
  }

  const supportPhone = normalizeSiteSettings(siteSettings).phone || "+47 41 14 53 53";
  const supportPhoneDigits = String(supportPhone).replace(/\D/g, "");
  const supportPhoneHref = supportPhoneDigits ? `tel:${supportPhoneDigits.startsWith("47") ? "+" : "+47"}${supportPhoneDigits}` : `tel:${supportPhone.replace(/\s+/g, "")}`;
  const expiredHelp = expired ? `<p class="status-v31-help">Det tar litt ekstra tid. Ring oss på <a href="${escapeAttribute(supportPhoneHref)}">${escapeAttribute(supportPhone)}</a> hvis du trenger hjelp.</p>` : "";

  return `
    <section class="order-live-status status-v31 stage-${stage}">
      <div class="status-v31-top">
        <span class="status-v31-badge">${badge}</span>
        <small>Ordre <b>${orderId}</b></small>
      </div>
      ${flow}
      ${main}
      ${expiredHelp}
    </section>
    ${options.includeReceipt ? orderLinesHtml(order) : ""}
    ${options.showCloseButton ? `<button class="order-live-close-inline status-v31-close" type="button" data-close-order-live>Lukk</button>` : ""}
  `;
}
'''

index = index[:start] + new_func + index[end:]
index_path.write_text(index, encoding='utf-8')

for marker_start, marker_end in [
    ('/* ===== PREMIUM ORDER STATUS V30 ===== */','/* ===== END PREMIUM ORDER STATUS V30 ===== */'),
    ('/* ===== PREMIUM ORDER STATUS V29 ===== */','/* ===== END PREMIUM ORDER STATUS V29 ===== */')
]:
    if marker_start in css and marker_end in css:
        a = css.index(marker_start)
        b = css.index(marker_end, a) + len(marker_end)
        css = css[:a] + css[b:]

v31 = r'''
/* ===== PREMIUM ORDER STATUS V31 ===== */
@layer mobile {
body.kol-customer .order-live-content{padding:0!important;background:#f3f0eb!important;}
body.kol-customer .status-v31{--accent:#c98922;--soft:#fff8e9;width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;color:#25211e!important;}
body.kol-customer .status-v31.stage-accepted{--accent:#176746;--soft:#eef7f2;}
body.kol-customer .status-v31.stage-ready{--accent:#0f5c3d;--soft:#eaf5ee;}
body.kol-customer .status-v31.stage-cancelled{--accent:#a43a3d;--soft:#fff0f0;}
body.kol-customer .status-v31-top{height:52px!important;padding:0 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;border-top:3px solid var(--accent)!important;border-bottom:1px solid #e2dcd6!important;background:#fff!important;}
body.kol-customer .status-v31-badge{display:inline-flex!important;align-items:center!important;min-height:27px!important;padding:0 9px!important;border:1px solid color-mix(in srgb,var(--accent) 45%,white)!important;border-radius:0!important;background:var(--soft)!important;color:var(--accent)!important;font-size:11.5px!important;font-weight:750!important;letter-spacing:.04em!important;text-transform:uppercase!important;}
body.kol-customer .status-v31-top small{color:#6a615a!important;font-size:12.5px!important;font-weight:500!important;}
body.kol-customer .status-v31-top b{color:#292420!important;font-weight:700!important;}
body.kol-customer .status-v31-flow{height:48px!important;padding:0 16px!important;display:grid!important;grid-template-columns:auto 1fr auto 1fr auto!important;align-items:center!important;border-bottom:1px solid #e2dcd6!important;background:#faf8f5!important;}
body.kol-customer .status-v31-flow span{color:#a19a94!important;font-size:11px!important;font-weight:650!important;white-space:nowrap!important;}
body.kol-customer .status-v31-flow span.done{color:var(--accent)!important;font-weight:750!important;}
body.kol-customer .status-v31-flow i{height:1px!important;margin:0 8px!important;background:#d7d0ca!important;}
body.kol-customer .status-v31-flow.stage-accepted i:first-of-type,body.kol-customer .status-v31-flow.stage-ready i{background:var(--accent)!important;}
body.kol-customer .status-v31-main{padding:22px 16px 20px!important;border-bottom:1px solid #e2dcd6!important;background:#fff!important;}
body.kol-customer .status-v31-kicker{display:block!important;margin:0 0 6px!important;color:var(--accent)!important;font-size:10.5px!important;font-weight:800!important;letter-spacing:.12em!important;line-height:1.2!important;}
body.kol-customer .status-v31-main h3{margin:0!important;color:#211d1a!important;font-size:23px!important;font-weight:680!important;line-height:1.15!important;letter-spacing:-.025em!important;}
body.kol-customer .status-v31-main>p{margin:12px 0 0!important;color:#70675f!important;font-size:13px!important;font-weight:400!important;line-height:1.45!important;}
body.kol-customer .status-v31-time{margin-top:18px!important;padding:15px 16px!important;border:1px solid #dfd7d0!important;border-left:4px solid var(--accent)!important;border-radius:0!important;background:var(--soft)!important;}
body.kol-customer .status-v31-time>small{display:block!important;margin-bottom:5px!important;color:var(--accent)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.12em!important;}
body.kol-customer .status-v31-time.pending>strong{display:block!important;color:#744a13!important;font-size:35px!important;font-weight:560!important;line-height:1!important;letter-spacing:-.04em!important;font-variant-numeric:tabular-nums!important;}
body.kol-customer .status-v31-time.accepted>div{display:flex!important;align-items:flex-end!important;gap:7px!important;}
body.kol-customer .status-v31-time.accepted strong{color:#104d36!important;font-size:50px!important;font-weight:540!important;line-height:.95!important;letter-spacing:-.055em!important;font-variant-numeric:tabular-nums!important;}
body.kol-customer .status-v31-time.accepted em{padding-bottom:5px!important;color:#176746!important;font-size:14px!important;font-weight:650!important;font-style:normal!important;}
body.kol-customer .status-v31-time.accepted>span{display:block!important;margin-top:7px!important;color:#65736b!important;font-size:12.5px!important;line-height:1.35!important;}
body.kol-customer .status-v31-pickup{padding:13px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;border:1px solid #d9d2cb!important;border-top:0!important;background:#fff!important;}
body.kol-customer .status-v31-pickup small{color:#746b64!important;font-size:10px!important;font-weight:800!important;letter-spacing:.1em!important;}
body.kol-customer .status-v31-pickup strong{color:#1c342a!important;font-size:19px!important;font-weight:700!important;text-align:right!important;}
body.kol-customer .status-v31-ready{margin-top:18px!important;padding:18px 16px!important;border-left:5px solid #0a442e!important;background:#0f5c3d!important;color:#fff!important;}
body.kol-customer .status-v31-ready strong{display:block!important;color:#fff!important;font-size:24px!important;font-weight:700!important;line-height:1.12!important;}
body.kol-customer .status-v31-ready small{display:block!important;margin-top:7px!important;color:#e1f0e8!important;font-size:13px!important;font-weight:400!important;line-height:1.35!important;}
body.kol-customer .status-v31-cancel{margin-top:18px!important;padding:17px 16px!important;border:1px solid #e3bcbc!important;border-left:5px solid #a43a3d!important;background:#fff3f3!important;}
body.kol-customer .status-v31-cancel strong{display:block!important;color:#902b2f!important;font-size:20px!important;font-weight:700!important;line-height:1.15!important;}
body.kol-customer .status-v31-cancel small{display:block!important;margin-top:6px!important;color:#755f60!important;font-size:12.5px!important;line-height:1.35!important;}
body.kol-customer .status-v31-help{margin:0!important;padding:11px 16px!important;border-bottom:1px solid #e2dcd6!important;background:#fff9ec!important;color:#6c5d46!important;font-size:12px!important;line-height:1.4!important;}
body.kol-customer .status-v31-help a{color:#965810!important;font-weight:700!important;text-decoration:none!important;}
body.kol-customer .customer-receipt-lines{margin:0!important;padding:0 16px!important;background:#fff!important;}
body.kol-customer .customer-receipt-line{padding:13px 0!important;border-bottom:1px solid #e6dfd9!important;border-radius:0!important;background:#fff!important;}
body.kol-customer .customer-receipt-total{padding:14px 0!important;border-top:1px solid #d0c8c1!important;}
body.kol-customer .status-v31-close{width:100%!important;min-height:54px!important;margin:0!important;border:0!important;border-top:1px solid #d8d0ca!important;border-radius:0!important;background:#25211f!important;color:#fff!important;font-size:15px!important;font-weight:600!important;box-shadow:none!important;}
body.kol-customer .status-v31-close:hover,body.kol-customer .status-v31-close:active{background:#25211f!important;transform:none!important;box-shadow:none!important;}
@media(max-width:380px){body.kol-customer .status-v31-main{padding:19px 14px!important;}body.kol-customer .status-v31-time.accepted strong{font-size:45px!important;}body.kol-customer .status-v31-top,body.kol-customer .status-v31-flow{padding-left:14px!important;padding-right:14px!important;}}
}
/* ===== END PREMIUM ORDER STATUS V31 ===== */
'''

css = css.rstrip() + '\n\n' + v31.strip() + '\n'
css_path.write_text(css, encoding='utf-8')
print('patched v31')
