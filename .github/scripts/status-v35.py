from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = index.replace('kol-core.css?v=mobile-v34', 'kol-core.css?v=mobile-v35', 1)

# A customer order becomes ready automatically when the kitchen countdown reaches zero.
index = index.replace(
    'const isReady = status === "accepted" && (order.ready === true || readyParts?.label === "Maten er klar");',
    'const isReady = status === "accepted" && (order.ready === true || getCustomerReadyAt(order).getTime() <= Date.now());',
    1,
)

# Remove the extra three-stage progress strip. The badge and main message are enough.
index = re.sub(
    r'\n\s*const flow = stage === "cancelled" \? "" : `.*?</div>`;',
    '\n  const flow = "";',
    index,
    count=1,
    flags=re.S,
)

# Replace the accepted state with a compact, clear kitchen countdown.
accepted_pattern = re.compile(
    r'\} else if \(stage === "accepted"\) \{.*?\n\s*\} else if \(stage === "ready"\) \{',
    re.S,
)
accepted_replacement = r'''} else if (stage === "accepted") {
    const kitchenMinutes = Math.max(1, Number(order.readyMinutes || 10) || 10);
    const value = readyParts?.value || formatReadyDuration(Math.max(0, getCustomerReadyAt(order).getTime() - Date.now()));
    const unit = readyParts?.unit || "";
    const clock = formatClock(getCustomerReadyAt(order));
    main = `
      <div class="live-status-main accepted">
        <span class="live-status-kicker">BESTILLINGEN TILBEREDES</span>
        <h3>Kjøkkenet lager maten din</h3>
        <div class="live-status-prep-note">
          <span>Kjøkkenet har satt</span>
          <strong>${kitchenMinutes} min</strong>
        </div>
        <div class="live-status-time accepted">
          <small>TID IGJEN</small>
          <div><strong data-customer-ready="${escapeAttribute(order.id || "")}">${escapeAttribute(value)}</strong><em data-customer-ready-unit="${escapeAttribute(order.id || "")}" ${unit ? "" : "hidden"}>${escapeAttribute(unit)}</em></div>
        </div>
        <div class="live-status-pickup">
          <small>FORVENTET KLAR</small>
          <strong data-customer-ready-clock="${escapeAttribute(order.id || "")}">ca. kl. ${escapeAttribute(clock)}</strong>
        </div>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>${escapeAttribute(readyParts?.label || "")}</span>
      </div>`;
  } else if (stage === "ready") {'''
index, count = accepted_pattern.subn(accepted_replacement, index, count=1)
if count != 1:
    raise SystemExit('accepted block not replaced')

# Make the ready message direct and food-quality focused.
index = index.replace(
    '<strong>Kom og hent nå</strong>\n          <small>Maten er ferdig og bør hentes så snart som mulig mens den er varm.</small>',
    '<strong>Kom og hent nå</strong>\n          <small>Maten er ferdig. Hent den så snart som mulig mens den er varm.</small>',
    1,
)

# When the timer reaches zero, redraw the open status view as ready automatically.
marker = 'function startOrderCountdownUi(order = null) {'
insert = '''\nfunction promoteOrderToAutomaticReady(order = null) {
  if (!order || (order.status || "pending") !== "accepted") return false;
  if (getCustomerReadyAt(order).getTime() > Date.now() && order.ready !== true) return false;
  const readyOrder = { ...order, ready: true };
  const alreadyReady = orderLiveContent?.querySelector?.(".live-status.stage-ready");
  if (orderLiveContent && orderLiveModal && !orderLiveModal.hidden && !alreadyReady) {
    orderLiveContent.innerHTML = orderStatusHtml(readyOrder, { includeReceipt: true, showCloseButton: true });
  }
  if (orderStatusBox && !orderStatusBox.hidden) renderOrderStatus(readyOrder);
  return true;
}

'''
if 'function promoteOrderToAutomaticReady' not in index:
    index = index.replace(marker, insert + marker, 1)

# Call automatic-ready promotion after each countdown refresh.
refresh_end = '''  document.querySelectorAll("[data-customer-ready-clock]").forEach((target) => {
    const orderId = target.dataset.customerReadyClock;
    const current = order && (!orderId || order.id === orderId) ? order : getRecentOrders().find((item) => item.id === orderId);
    if (!current || (current.status || "pending") !== "accepted") return;
    target.textContent = orderReadyDisplayParts(current).clock;
  });
}'''
refresh_new = '''  document.querySelectorAll("[data-customer-ready-clock]").forEach((target) => {
    const orderId = target.dataset.customerReadyClock;
    const current = order && (!orderId || order.id === orderId) ? order : getRecentOrders().find((item) => item.id === orderId);
    if (!current || (current.status || "pending") !== "accepted") return;
    const readyAt = getCustomerReadyAt(current);
    target.textContent = `ca. kl. ${formatClock(readyAt)}`;
  });

  promoteOrderToAutomaticReady(order);
}'''
if refresh_end not in index:
    raise SystemExit('refresh countdown end not found')
index = index.replace(refresh_end, refresh_new, 1)

# Remove obsolete customer wording that asks for a manual Klar status.
index = index.replace('Vent på status <b>«Klar»</b> før du henter bestillingen.', '', 1)
index = index.replace('Kom og hent når det passer.', 'Kom og hent nå', 1)

# CSS: remove the now-unused progress strip and simplify accepted status blocks.
css = re.sub(r'body\.kol-customer \.live-status-flow\{.*?\}\n', '', css, flags=re.S)
css = re.sub(r'body\.kol-customer \.live-status-flow span\{.*?\}\n', '', css, flags=re.S)
css = re.sub(r'body\.kol-customer \.live-status-flow span\.done\{.*?\}\n', '', css, flags=re.S)
css = re.sub(r'body\.kol-customer \.live-status-flow i\{.*?\}\n', '', css, flags=re.S)
css = re.sub(r'body\.kol-customer \.live-status-flow\.stage-accepted i:first-of-type\{.*?\}\n', '', css, flags=re.S)
css = re.sub(r'body\.kol-customer \.live-status-flow\.stage-ready i\{.*?\}\n', '', css, flags=re.S)

css = css.replace(
    'body.kol-customer .live-status-main{padding:22px 16px 20px!important;border-bottom:1px solid #e2dcd6!important;background:#fff!important;}',
    'body.kol-customer .live-status-main{padding:20px 16px 18px!important;border-bottom:1px solid #e2dcd6!important;background:#fff!important;}',
)
css = css.replace(
    'body.kol-customer .live-status-prep-note{margin-top:18px!important;padding:13px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;border-top:1px solid #cfe0d6!important;border-bottom:1px solid #cfe0d6!important;background:#f7fbf8!important;}',
    'body.kol-customer .live-status-prep-note{margin-top:16px!important;padding:12px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;border-top:1px solid #cfe0d6!important;border-bottom:1px solid #cfe0d6!important;background:#f7fbf8!important;}',
)
css = css.replace(
    'body.kol-customer .live-status-time{margin-top:18px!important;',
    'body.kol-customer .live-status-time{margin-top:14px!important;',
    1,
)
css = css.replace(
    'body.kol-customer .live-status-pickup strong{color:#1c342a!important;font-size:19px!important;font-weight:700!important;text-align:right!important;}',
    'body.kol-customer .live-status-pickup strong{color:#1c342a!important;font-size:18px!important;font-weight:700!important;text-align:right!important;white-space:nowrap!important;}',
)

index_path.write_text(index, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('status v35 applied')
