from pathlib import Path
import re

INDEX = Path("test/index.html")
CSS = Path("test/kol-core.css")
ADMIN = Path("test/admin-panel.html")

index = INDEX.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
admin = ADMIN.read_text(encoding="utf-8")

before = {
    "index_bytes": len(index.encode("utf-8")),
    "css_bytes": len(css.encode("utf-8")),
    "index_lines": index.count("\n") + 1,
    "css_lines": css.count("\n") + 1,
}


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing target: {label}")
    return text.replace(old, new, 1)


def replace_regex_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"expected one replacement for {label}, got {count}")
    return updated


# ---------------------------------------------------------------------------
# 1) CSS: make kol-core.css a single customer stylesheet.
#    The admin page is intentionally decoupled below so the customer CSS no
#    longer needs a legacy import + cascade layer + !important blanket.
# ---------------------------------------------------------------------------
legacy_header = (
    '@layer mobile,legacy;\n'
    '@import url("https://cdn.jsdelivr.net/gh/pizzano/pizzano.github.io@002212ee5ec86ae0ade29426cdadc846750d2d13/test/kol-core.css") layer(legacy);\n\n'
    '@layer mobile {\n'
)
if not css.startswith(legacy_header):
    raise SystemExit("kol-core.css no longer has the expected legacy wrapper")

css = css[len(legacy_header):].rstrip()
if not css.endswith("}"):
    raise SystemExit("kol-core.css layer wrapper has no closing brace")
css = css[:-1].rstrip() + "\n"
css = css.replace("!important", "")
css = re.sub(r"[ \t]+\n", "\n", css)
css = re.sub(r"\n{3,}", "\n\n", css).strip() + "\n"
css = (
    "/* KØL customer UI — single source of truth.\n"
    "   Admin styling is isolated in admin-panel.html. */\n"
    + css
)

# Admin currently received its styles only through the legacy import above.
# Point it directly at that exact pinned stylesheet so customer cleanup cannot
# change admin layout or behavior.
admin = replace_regex_once(
    admin,
    r'<link href="kol-core\.css\?v=[^"]+" rel="stylesheet"/>',
    '<link href="https://cdn.jsdelivr.net/gh/pizzano/pizzano.github.io@002212ee5ec86ae0ade29426cdadc846750d2d13/test/kol-core.css" rel="stylesheet"/>',
    "admin stylesheet isolation",
)

# ---------------------------------------------------------------------------
# 2) index.html: keep behavior, remove accumulated patch code and fix known
#    state-management bugs.
# ---------------------------------------------------------------------------
index = re.sub(
    r'kol-core\.css\?v=[^"\']+',
    'kol-core.css?v=clean-20260817',
    index,
    count=1,
)

# A single helper defines when background order status is not allowed to steal
# the screen currently used by the customer.
helper = '''function hasBlockingCustomerOverlay() {
  return Boolean(
    (cartModal && !cartModal.hidden) ||
    (productModal && !productModal.hidden) ||
    (profileModal && !profileModal.hidden) ||
    (infoModal && !infoModal.hidden) ||
    (quickCheckoutModal && !quickCheckoutModal.hidden)
  );
}

'''
index = replace_once(
    index,
    "function updateTopMenuReturnButton() {",
    helper + "function updateTopMenuReturnButton() {",
    "overlay guard helper",
)

# Background status changes may make a sound, but must not close cart/product/
# profile/info screens. The status remains available through Mine bestillinger.
old_status_change = '''  if ((statusChanged && ["accepted", "cancelled"].includes(nextStatus)) || becameReady) {
    playCustomerStatusSound(becameReady ? "ready" : nextStatus);
    renderOrderLiveModal(order, true);
  }'''
new_status_change = '''  if ((statusChanged && ["accepted", "cancelled"].includes(nextStatus)) || becameReady) {
    playCustomerStatusSound(becameReady ? "ready" : nextStatus);
    if (!hasBlockingCustomerOverlay()) renderOrderLiveModal(order, true);
  }'''
index = replace_once(index, old_status_change, new_status_change, "background order overlay guard")

# renderOrderLiveModal used to close the cart before even deciding whether the
# live status modal should open. Only close another view if status is actually
# being opened.
render_live = '''function renderOrderLiveModal(order, forceOpen = false) {
  if (!orderLiveModal || !orderLiveContent || !order) return;

  const shouldOpen = forceOpen || !orderLiveModal.hidden;
  orderLiveContent.innerHTML = orderStatusHtml(order, { includeReceipt: true, showCloseButton: true });
  orderLiveContent.scrollTop = 0;
  if (!shouldOpen) return;

  if (cartModal && !cartModal.hidden) closeCartModal();
  if (orderStatusBox) orderStatusBox.hidden = true;
  orderLiveModal.hidden = false;
  document.body.classList.add("order-live-open");
  startOrderCountdownUi(order);
  syncBodyScrollLocks();
}

function closeOrderLiveModal'''
index = replace_regex_once(
    index,
    r'function renderOrderLiveModal\(order, forceOpen = false\) \{.*?\n\}\n\nfunction closeOrderLiveModal',
    render_live,
    "renderOrderLiveModal",
    re.S,
)

# Remove the second 1-second timer. One shared visible-UI ticker is sufficient.
index = index.replace("let currentOrderCountdownTimer = null;\n", "", 1)
index = replace_regex_once(
    index,
    r'function startOrderCountdownUi\(order = null\) \{.*?\n\}',
    '''function startOrderCountdownUi(order = null) {
  refreshOrderCountdowns(order);
}''',
    "countdown timer simplification",
    re.S,
)
index = replace_regex_once(
    index,
    r'// TÜRKÇE: Profil açıkken onaylanan siparişin kalan dakikasını canlı günceller\.\nwindow\.setInterval\(\(\) => \{\n  refreshOrderCountdowns\(\);\n\}, 1000\);',
    '''window.setInterval(() => {
  const countdownVisible =
    (profileModal && !profileModal.hidden) ||
    (orderLiveModal && !orderLiveModal.hidden) ||
    (cartModal && !cartModal.hidden && orderStatusBox && !orderStatusBox.hidden);
  if (countdownVisible) refreshOrderCountdowns();
}, 1000);''',
    "shared countdown ticker",
)

# Customer history only displays five orders; fetch those five in parallel.
index = replace_regex_once(
    index,
    r'async function syncOrdersByCustomerPhone\(phone = getSavedProfilePhone\(\)\) \{.*?\n\}\n\nfunction formatProfileOrderDetailRows',
    '''async function syncOrdersByCustomerPhone(phone = getSavedProfilePhone()) {
  const cleanPhone = normalizePhoneDigits(phone);
  if (!cleanPhone) return [];
  saveProfilePhone(cleanPhone);
  try {
    const response = await fetch(`${customerOrderIndexUrl(cleanPhone)}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const indexData = await response.json();
    if (!indexData || typeof indexData !== "object") return [];
    const rows = Object.entries(indexData)
      .map(([id, value]) => ({ id, updatedAt: value?.updatedAt || value?.createdAt || "" }))
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 5);
    const freshOrders = (await Promise.all(rows.map(async ({ id }) => {
      try { return await fetchOrder(id); }
      catch (error) { console.warn("Kunne ikke lese ordre", id, error); return null; }
    }))).filter(Boolean);
    freshOrders.forEach(rememberRecentOrder);
    return freshOrders;
  } catch (error) {
    console.warn("Kunne ikke hente ordre etter telefonnummer", error);
    return [];
  }
}

function formatProfileOrderDetailRows''',
    "phone history fetch",
    re.S,
)

# Calm background syncing; explicit profile/focus refresh remains immediate.
index = index.replace("  }, 8000);\n", "  }, 10000);\n", 1)

# Dead bestseller aggregation from the era when the customer downloaded all
# orders. Compact /publicStats/mostOrdered is now the only source.
index = re.sub(
    r'function normalizePopularProductName\(value = ""\) \{.*?\n\}\n\n',
    "",
    index,
    count=1,
    flags=re.S,
)
index = re.sub(
    r'function buildMostOrderedFromOrders\(ordersData = \{\}\) \{.*?\n\}\n\n',
    "",
    index,
    count=1,
    flags=re.S,
)
index = index.replace("saveCachedMostOrderedItems(limited);", "saveMostOrderedCache(limited);", 1)

# orderStatusHtml no longer renders a flow element, so do not keep an empty
# variable and interpolation around.
index = index.replace('  const flow = "";\n\n', "", 1)
index = index.replace('      ${flow}\n', "", 1)

# Remove a true no-op left by an old cart patch.
index = index.replace("  if (cartModal) cartModal.hidden = cartModal.hidden;\n", "", 1)

# One category handler is enough. If a product is open, close it first and then
# navigate to the requested category.
old_tab_handler = '''document.addEventListener("click", (event) => {
  const tab = event.target.closest?.("[data-category-tab]");
  if (!tab) return;

  event.preventDefault();
  event.stopPropagation();

  scrollToMenuSection(tab.dataset.categoryTab);
}, true);'''
new_tab_handler = '''document.addEventListener("click", (event) => {
  const tab = event.target.closest?.("[data-category-tab]");
  if (!tab) return;
  event.preventDefault();
  event.stopPropagation();
  if (productModal && !productModal.hidden) closeProductModal();
  scrollToMenuSection(tab.dataset.categoryTab);
}, true);'''
index = replace_once(index, old_tab_handler, new_tab_handler, "category handler consolidation")
index = re.sub(
    r'\n\s*// When a category is chosen while a product is open, close the product and continue to that category\.\ndocument\.getElementById\("categoryTabs"\)\?\.addEventListener\("click", \(event\) => \{.*?\n\}, true\);',
    "",
    index,
    count=1,
    flags=re.S,
)

# Obsolete end-of-file patches. Their state is already handled by renderCart,
# normal CSS (100dvh) and the single 480px app shell.
for function_name in (
    "forceKolHeaderAndCartState",
    "setKolMobileViewportHeight",
    "syncKolCustomerFrameFullViewport",
):
    index, count = re.subn(
        rf'\n\(function {function_name}\(\) \{{.*?\n\}}\)\(\);',
        "",
        index,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise SystemExit(f"expected obsolete IIFE {function_name}")

# Remove historical patch-comment lines. Keep inline comments where they explain
# a business rule next to code, but remove the stacked version/changelog prose.
clean_lines = []
for line in index.splitlines():
    stripped = line.strip()
    if stripped == "/* ===== app.js INLINED ===== */":
        continue
    if stripped.startswith("//"):
        continue
    clean_lines.append(line.rstrip())
index = "\n".join(clean_lines)
index = re.sub(r"\n{3,}", "\n\n", index).strip() + "\n"

# ---------------------------------------------------------------------------
# 3) Invariants before writing.
# ---------------------------------------------------------------------------
required_index = [
    'kol-core.css?v=clean-20260817',
    'function hasBlockingCustomerOverlay()',
    'const shouldOpen = forceOpen || !orderLiveModal.hidden;',
    'if (!hasBlockingCustomerOverlay()) renderOrderLiveModal(order, true);',
    'saveMostOrderedCache(limited);',
    '.slice(0, 5);',
]
for needle in required_index:
    if needle not in index:
        raise SystemExit(f"missing invariant in index: {needle}")

for forbidden in (
    "currentOrderCountdownTimer",
    "syncKolCustomerFrameFullViewport",
    "setKolMobileViewportHeight",
    "forceKolHeaderAndCartState",
    "buildMostOrderedFromOrders",
    "saveCachedMostOrderedItems",
    "cartModal.hidden = cartModal.hidden",
):
    if forbidden in index:
        raise SystemExit(f"obsolete code still present: {forbidden}")

for forbidden in ("@import", "@layer", "!important"):
    if forbidden in css:
        raise SystemExit(f"legacy CSS construct still present: {forbidden}")

for selector in (
    ".appbar",
    ".menu-shell",
    ".menu-row",
    ".product-modal",
    ".cart-modal",
    ".checkout-section-title",
    ".profile-order-card",
    ".order-live-status",
    ".info-panel",
):
    if selector not in css:
        raise SystemExit(f"missing customer CSS selector: {selector}")

if "kol-core.css" in admin:
    raise SystemExit("admin is still coupled to customer kol-core.css")
if "002212ee5ec86ae0ade29426cdadc846750d2d13/test/kol-core.css" not in admin:
    raise SystemExit("admin pinned stylesheet missing")

INDEX.write_text(index, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
ADMIN.write_text(admin, encoding="utf-8")

after = {
    "index_bytes": len(index.encode("utf-8")),
    "css_bytes": len(css.encode("utf-8")),
    "index_lines": index.count("\n") + 1,
    "css_lines": css.count("\n") + 1,
}
print("customer refactor applied")
for key in before:
    print(f"{key}: {before[key]} -> {after[key]}")
