from pathlib import Path

p = Path('test/index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('kol-core.css?v=mobile-v35', 'kol-core.css?v=mobile-v36', 1)

needle = '''function orderStatusText(status = "pending", order = {}) {
  if (status === "accepted" && order.ready === true) return "Klar";
  if (status === "accepted") return "Godkjent";
  if (status === "cancelled") return "Kansellert";
  return "Venter";
}'''
replacement = '''function isOrderReadyForPickup(order = {}) {
  if ((order.status || "pending") !== "accepted") return false;
  if (order.ready === true) return true;
  return getCustomerReadyAt(order).getTime() <= Date.now();
}

function orderStatusText(status = "pending", order = {}) {
  if (status === "accepted" && isOrderReadyForPickup(order)) return "Klar";
  if (status === "accepted") return "Godkjent";
  if (status === "cancelled") return "Kansellert";
  return "Venter";
}'''
if needle not in s:
    raise SystemExit('orderStatusText block not found')
s = s.replace(needle, replacement, 1)

s = s.replace(
'''function orderStatusTitle(status = "pending", order = {}) {
  if (status === "accepted" && order.ready === true) return "Klar";''',
'''function orderStatusTitle(status = "pending", order = {}) {
  if (status === "accepted" && isOrderReadyForPickup(order)) return "Klar";''',
1)

old_secondary = '''function profileSecondaryText(order = {}) {
  const status = order.status || "pending";
  if (status === "accepted") {
    return isTodayOrder(order) ? orderReadySummaryText(order) : "Fullført bestilling";
  }'''
new_secondary = '''function profileSecondaryText(order = {}) {
  const status = order.status || "pending";
  if (status === "accepted") {
    if (isOrderReadyForPickup(order)) return "Maten er klar";
    return isTodayOrder(order) ? orderReadySummaryText(order) : "Fullført bestilling";
  }'''
if old_secondary not in s:
    raise SystemExit('profileSecondaryText block not found')
s = s.replace(old_secondary, new_secondary, 1)

s = s.replace(
'''  const statusVisual = status === "cancelled"
    ? "status-cancelled"
    : (status === "accepted" && order.ready === true)
      ? "status-ready"
      : "status-progress";''',
'''  const profileReady = status === "accepted" && isOrderReadyForPickup(order);
  const statusVisual = status === "cancelled"
    ? "status-cancelled"
    : profileReady
      ? "status-ready"
      : "status-progress";''',
1)

s = s.replace(
'''<span class="order-status-pill ${status} ${order.ready === true ? "ready" : ""}">${orderStatusText(status, order)}</span>''',
'''<span class="order-status-pill ${status} ${profileReady ? "ready" : ""}">${orderStatusText(status, order)}</span>''',
1)

# Make the live status use the same readiness helper.
s = s.replace(
'''const isReady = status === "accepted" && (order.ready === true || getCustomerReadyAt(order).getTime() <= Date.now());''',
'''const isReady = status === "accepted" && isOrderReadyForPickup(order);''',
1)

# Update visible profile cards without re-rendering the whole list (preserves scroll and expanded card).
marker = '''function promoteOrderToAutomaticReady(order = null) {'''
helper = '''function refreshProfileReadyStates() {
  if (!profileOrdersEl || !profileModal || profileModal.hidden) return;
  const recent = getRecentOrders();
  profileOrdersEl.querySelectorAll("[data-profile-order-card]").forEach((card) => {
    const id = card.dataset.profileOrderCard || "";
    const order = recent.find((item) => String(item.id || "") === id);
    if (!order || (order.status || "pending") !== "accepted") return;
    const ready = isOrderReadyForPickup(order);
    card.classList.toggle("status-ready", ready);
    card.classList.toggle("status-progress", !ready);
    const title = card.querySelector(".profile-order-title-row > strong");
    if (title) title.textContent = ready ? "Klar" : "Bekreftet";
    const pill = card.querySelector(".order-status-pill");
    if (pill) {
      pill.textContent = ready ? "Klar" : "Godkjent";
      pill.classList.toggle("ready", ready);
    }
    const secondary = card.querySelector("[data-profile-ready]");
    if (secondary) secondary.textContent = ready ? "Maten er klar" : profileSecondaryText(order);
  });
}

'''
if 'function refreshProfileReadyStates()' not in s:
    if marker not in s:
        raise SystemExit('automatic ready marker not found')
    s = s.replace(marker, helper + marker, 1)

s = s.replace(
'''  promoteOrderToAutomaticReady(order);
}''',
'''  promoteOrderToAutomaticReady(order);
  refreshProfileReadyStates();
}''',
1)

# Also refresh as soon as the profile is opened.
s = s.replace(
'''async function openProfileModal() {
  if (!profileModal) return;''',
'''async function openProfileModal() {
  if (!profileModal) return;''',
1)
# renderProfileOrders is already called by openProfileModal; no extra full render loop needed.

p.write_text(s, encoding='utf-8')
print('profile automatic ready v36 applied')
