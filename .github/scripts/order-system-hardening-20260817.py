from pathlib import Path
import json
import re
import subprocess
import textwrap

INDEX_PATH = Path("test/index.html")
ADMIN_PATH = Path("test/admin-panel.html")
CSS_PATH = Path("test/kol-core.css")

GOOD_INDEX_REF = "b76241dcc4dfee093596f81217e4aee5dcfb15be"
GOOD_ADMIN_REF = "6ce817f6a20967af9c528c8bab4dc1b37d43483e"


def git_show(ref, path):
    return subprocess.check_output(["git", "show", f"{ref}:{path}"], text=True, encoding="utf-8")


def must_replace(text, old, new, label, count=1):
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f"{label}: expected at least {count} match(es), found {actual}")
    return text.replace(old, new, count)


def find_function_span(text, name):
    match = re.search(rf"(?:async\s+)?function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", text)
    if not match:
        raise SystemExit(f"Function not found: {name}")
    brace = text.find("{", match.start())
    depth = 0
    i = brace
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return match.start(), i + 1
        i += 1
    raise SystemExit(f"Could not find end of function: {name}")


def replace_function(text, name, new_source):
    start, end = find_function_span(text, name)
    return text[:start] + new_source.strip() + text[end:]


def remove_function(text, name):
    start, end = find_function_span(text, name)
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return text[:start] + text[end:]


def insert_before(text, marker, block, label):
    pos = text.find(marker)
    if pos < 0:
        raise SystemExit(f"{label}: marker not found")
    return text[:pos] + block.rstrip() + "\n\n" + text[pos:]


# -----------------------------------------------------------------------------
# CUSTOMER APP
# Restore the last known-good customer performance changes that were overwritten
# by the later full-file update, then keep the current legacy menu source to
# avoid depending on a possibly stale /publicMenu snapshot.
# -----------------------------------------------------------------------------
current_index = INDEX_PATH.read_text(encoding="utf-8")
index = git_show(GOOD_INDEX_REF, "test/index.html")

constants_start = index.index('const firebaseBaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app";')
constants_end = index.index("let menuSections = [];")
customer_constants = '''const firebaseBaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app";
const firebaseOrdersBaseUrl = `${firebaseBaseUrl}/orders`;
const firebaseOrdersUrl = `${firebaseOrdersBaseUrl}.json`;
const firebaseOrderUrl = (orderId) => `${firebaseOrdersBaseUrl}/${encodeURIComponent(String(orderId || ""))}.json`;
const firebaseCustomerOrdersBaseUrl = `${firebaseBaseUrl}/customerOrders`;
const firebaseMostOrderedUrl = `${firebaseBaseUrl}/publicStats/mostOrdered.json`;
const firebaseMenuFields = ["sections", "extraOptions", "customPizzaToppings", "kebabPitaOptions", "optionGroups", "siteSettings", "rescueDeals"];

async function fetchFirebaseMenuConfig() {
  const entries = await Promise.all(firebaseMenuFields.map(async (key) => {
    const response = await fetch(`${firebaseBaseUrl}/${key}.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Kunne ikke hente ${key}`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

'''
index = index[:constants_start] + customer_constants + index[constants_end:]

# Keep current menu-loading behavior (legacy field reads + rescue data) while
# retaining the restored public best-seller and polling optimizations.
current_load_menu = current_index[slice(*find_function_span(current_index, "loadMenuConfig"))]
index = replace_function(index, "loadMenuConfig", current_load_menu)

# Public most-ordered node only. Never GET /orders from a customer browser.
index = replace_function(index, "refreshMostOrderedFromDatabase", '''
async function refreshMostOrderedFromDatabase(options = {}) {
  const { render = true } = options;
  if (mostOrderedLoading || !menuSections.length) return;
  mostOrderedLoading = true;
  try {
    const response = await fetch(`${firebaseMostOrderedUrl}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kunne ikke hente bestselgeroversikt");
    const raw = await response.json();
    const rows = Array.isArray(raw) ? raw : Object.values(raw || {});
    const products = getAllVisibleMenuProducts();
    const byId = new Map(products.map(({ item }) => [String(item?.id || ""), item]));
    const byName = new Map(products.map(({ item }) => [String(item?.name || "").trim().toLocaleLowerCase("nb-NO"), item]));
    const nextItems = [];
    const seen = new Set();
    rows.sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0)).forEach((row) => {
      const item = byId.get(String(row?.id || "")) || byName.get(String(row?.name || "").trim().toLocaleLowerCase("nb-NO"));
      if (!item) return;
      const key = String(item.id || item.name || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      nextItems.push(item);
    });
    const limited = nextItems.slice(0, 5);
    if (limited.length) {
      const oldSignature = mostOrderedMenuItems.map((item) => item.id).join("|");
      const nextSignature = limited.map((item) => item.id).join("|");
      mostOrderedMenuItems = limited;
      saveMostOrderedCache(limited);
      if (render && oldSignature !== nextSignature) renderMenu();
    } else if (!mostOrderedMenuItems.length) {
      mostOrderedMenuItems = readCachedMostOrderedItems();
    }
  } catch (error) {
    console.warn("Bestselgeroversikt kunne ikke oppdateres.", error);
    if (!mostOrderedMenuItems.length) mostOrderedMenuItems = readCachedMostOrderedItems();
  } finally {
    mostOrderedLoading = false;
  }
}''')

# Remove the obsolete whole-order aggregation helper now that best sellers use
# /publicStats/mostOrdered.
if re.search(r"function\s+buildMostOrderedFromOrders\s*\(", index):
    index = remove_function(index, "buildMostOrderedFromOrders")
if re.search(r"function\s+normalizePopularProductName\s*\(", index):
    index = remove_function(index, "normalizePopularProductName")

# Poll only active orders, max four, in parallel and at a calmer cadence.
index = replace_function(index, "syncRecentOrdersFromFirebase", '''
async function syncRecentOrdersFromFirebase(options = {}) {
  const includeCompleted = options.includeCompleted === true;
  const orders = getRecentOrders();
  if (!orders.length) return;
  const candidates = (includeCompleted
    ? orders
    : orders.filter((order) => {
        const status = order.status || "pending";
        return status === "pending" || (status === "accepted" && order.ready !== true);
      }))
    .slice(0, includeCompleted ? 5 : 4);
  if (!candidates.length) return;
  const updated = await Promise.all(candidates.map(async (order) => {
    if (!order.id) return order;
    try {
      return (await fetchOrder(order.id)) || order;
    } catch {
      return order;
    }
  }));
  updated.forEach((order) => rememberRecentOrder(order));
}''')

index = replace_function(index, "startRecentOrdersSync", '''
function startRecentOrdersSync() {
  window.clearInterval(recentOrdersPollTimer);
  const hasActive = getRecentOrders().some((order) => {
    const status = order.status || "pending";
    return status === "pending" || (status === "accepted" && order.ready !== true);
  });
  if (!hasActive) return;
  syncRecentOrdersFromFirebase();
  recentOrdersPollTimer = window.setInterval(() => {
    if (document.visibilityState !== "hidden") syncRecentOrdersFromFirebase();
  }, 10000);
}''')

# Profile lookup: only the five newest indexed orders, fetched in parallel.
index = index.replace(".slice(0, 20);\n    const freshOrders = [];\n    for (const row of rows) {\n      try {\n        const fresh = await fetchOrder(row.id);\n        if (fresh) freshOrders.push(fresh);\n      } catch (error) {\n        console.warn(\"Kunne ikke lese ordre\", row.id, error);\n      }\n    }", ".slice(0, 5);\n    const freshOrders = (await Promise.all(rows.map(async (row) => {\n      try {\n        return await fetchOrder(row.id);\n      } catch (error) {\n        console.warn(\"Kunne ikke lese ordre\", row.id, error);\n        return null;\n      }\n    }))).filter(Boolean);", 1)

# When opening the profile, one explicit refresh of completed orders is enough.
index = index.replace("await syncRecentOrdersFromFirebase();\n  renderProfileOrders({ phone });", "await syncRecentOrdersFromFirebase({ includeCompleted: true });\n  renderProfileOrders({ phone });", 1)

# Fix quarter-hour rounding when seconds/milliseconds are present.
index = replace_function(index, "roundUpToNextQuarter", '''
function roundUpToNextQuarter(date) {
  const result = new Date(date);
  const hadPartialMinute = result.getSeconds() > 0 || result.getMilliseconds() > 0;
  result.setSeconds(0, 0);
  const minutes = result.getMinutes();
  const remainder = minutes % 15;
  const add = remainder === 0 ? (hadPartialMinute ? 15 : 0) : 15 - remainder;
  if (add) result.setMinutes(minutes + add);
  return result;
}''')

# New orders use one canonical camelCase model. Old records remain readable.
old_metadata = '''    // GloriaFood-lignende metadata vi vil ha i systemet fra start.
    source: "website",
    client_order_count: clientOrderCount,
    confirmed_at: null,
    fulfill_time: null,
    printed: false,
    ready: false,
    payment,
    order_type: orderType,

    // camelCase kopier for enklere intern bruk i eget system.
    sourceName: "website",
    clientOrderCount,
    confirmedAt: null,
    fulfillTime: null,
    orderType,
'''
new_metadata = '''    // Canonical order metadata. Legacy snake_case fields are only read for old orders.
    source: "website",
    clientOrderCount,
    confirmedAt: null,
    fulfillTime: null,
    printed: false,
    ready: false,
    payment,
    orderType,
'''
index = must_replace(index, old_metadata, new_metadata, "customer canonical order metadata")

# Cache bust after CSS consolidation.
index = re.sub(r'kol-core\.css\?v=[^"\']+', 'kol-core.css?v=hardening-20260817', index, count=1)
INDEX_PATH.write_text(index, encoding="utf-8")


# -----------------------------------------------------------------------------
# ADMIN APP
# Restore efficient child listeners/public most-ordered publisher from the
# previous known-good revision, then remove the root value listener entirely.
# -----------------------------------------------------------------------------
admin = git_show(GOOD_ADMIN_REF, "test/admin-panel.html")

# Menu config stays in existing legacy top-level paths, but each field has its
# own listener. This avoids a / root value listener without a risky live-data
# migration.
const_start = admin.index('const firebaseDatabaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/";')
const_end = admin.index("const fields = {")
admin_constants = '''const firebaseDatabaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/";
firebase.initializeApp({ databaseURL: firebaseDatabaseUrl });
const rootMenuRef = firebase.database().ref("/");
const MENU_CONFIG_KEYS = ["sections", "extraOptions", "customPizzaToppings", "kebabPitaOptions", "optionGroups", "siteSettings"];
const menuFieldRefs = Object.fromEntries(MENU_CONFIG_KEYS.map((key) => [key, firebase.database().ref(`/${key}`)]));
const ordersRef = firebase.database().ref("/orders");
const rescueDealsRef = firebase.database().ref("/rescueDeals");
const publicMostOrderedRef = firebase.database().ref("/publicStats/mostOrdered");
const iceSmsQueueRef = firebase.database().ref("/iceSmsQueue");
const iceSmsCurrentRef = iceSmsQueueRef.child("current");
const iceSmsPendingRef = iceSmsQueueRef.child("pending");
const iceSmsDeviceStatusRef = iceSmsQueueRef.child("deviceStatus");
const firebaseConnectionRef = firebase.database().ref(".info/connected");

async function readMenuConfigOnce() {
  const entries = await Promise.all(MENU_CONFIG_KEYS.map(async (key) => {
    const snapshot = await menuFieldRefs[key].once("value");
    return [key, snapshot.val()];
  }));
  return Object.fromEntries(entries);
}

async function writeMenuConfigFields(value = {}) {
  const patch = {};
  MENU_CONFIG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) patch[key] = value[key];
  });
  await rootMenuRef.update(patch);
}

'''
admin = admin[:const_start] + admin_constants + admin[const_end:]

# The embedded fallback catalog is production duplication and can overwrite live
# menu data on version changes. Remove it; Firebase is the source of truth.
admin, removed_catalogs = re.subn(r'<script id="kol-embedded-menu-catalog">.*?</script>\s*', '', admin, count=1, flags=re.S)
if removed_catalogs != 1:
    raise SystemExit(f"embedded menu catalog removal: expected 1, got {removed_catalogs}")

# Remove now-obsolete legacy/publicMenu helper region if present.
for fn in ("readLegacyMenuConfigOnce", "seedPublicMenuFromLegacy"):
    if re.search(rf"(?:async\s+)?function\s+{fn}\s*\(", admin):
        admin = remove_function(admin, fn)

admin = replace_function(admin, "loadData", '''
async function loadData() {
  setStatus("Synkroniserer med Firebase...");
  const [value, rescueSnapshot] = await Promise.all([
    readMenuConfigOnce(),
    rescueDealsRef.once("value")
  ]);
  rescueDeals = rescueSnapshot.val() && typeof rescueSnapshot.val() === "object" ? rescueSnapshot.val() : {};
  config = hasValidConfig(value) ? normalizeConfig(value) : createEmptyConfig();
  if (hasValidConfig(value)) saveAdminMenuCache(value);
  if (selectedCategoryIndex !== null && selectedCategoryIndex >= config.sections.length) selectedCategoryIndex = null;
  if (!selectedCategory()) {
    selectedProductIndex = null;
    productEditorOpen = false;
  } else if (selectedProductIndex !== null && selectedProductIndex >= asArray(selectedCategory()?.items).length) {
    selectedProductIndex = null;
    productEditorOpen = false;
  }
  firebaseReady = true;
  if (!isEditingField()) renderAll();
  setStatus(hasValidConfig(value) ? "Synkronisert med Firebase." : "Firebase er tom. Du kan starte fra null og legge til kategori.");
}''')

admin = replace_function(admin, "writeLiveConfig", '''
async function writeLiveConfig(message = "Lagret automatisk til Firebase.") {
  if (!config) return false;
  try {
    setStatus("Lagrer til Firebase...");
    const normalized = normalizeConfig(config);
    config = normalized;
    await writeMenuConfigFields(normalized);
    saveAdminMenuCache(normalized);
    setStatus(message);
    return true;
  } catch (error) {
    setStatus("Kunne ikke lagre. Sjekk Firebase-regler.");
    console.error(error);
    return false;
  }
}''')

admin = replace_function(admin, "startRealtimeSync", '''
function startRealtimeSync() {
  setStatus("Kobler til Firebase...");
  renderCachedMenuIfAvailable();

  const state = {};
  const seen = new Set();
  let applyTimer = null;
  const scheduleApply = () => {
    window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(() => {
      if (seen.size < MENU_CONFIG_KEYS.length) return;
      const value = { ...state };
      if (!hasValidConfig(value)) {
        config = createEmptyConfig();
        selectedCategoryIndex = null;
        selectedProductIndex = null;
        productEditorOpen = false;
        firebaseReady = true;
        if (!isEditingField()) renderAll();
        setStatus("Firebase er tom. Klar til å lage ny meny.");
        return;
      }
      saveAdminMenuCache(value);
      config = normalizeConfig(value);
      if (selectedCategoryIndex !== null && selectedCategoryIndex >= config.sections.length) selectedCategoryIndex = null;
      if (!selectedCategory()) {
        selectedProductIndex = null;
        productEditorOpen = false;
      } else if (selectedProductIndex !== null && selectedProductIndex >= asArray(selectedCategory()?.items).length) {
        selectedProductIndex = null;
        productEditorOpen = false;
      }
      firebaseReady = true;
      if (!isEditingField()) renderAll();
      setStatus("Koblet til Firebase. Endringer lagres automatisk.");
    }, 40);
  };

  MENU_CONFIG_KEYS.forEach((key) => {
    menuFieldRefs[key].on("value", (snapshot) => {
      state[key] = snapshot.val();
      seen.add(key);
      scheduleApply();
    }, (error) => {
      console.error(error);
      const hadCache = renderCachedMenuIfAvailable("Kunne ikke lese menyfelt fra Firebase. Viser siste lokale meny.");
      if (!hadCache) setStatus("Kunne ikke koble til Firebase. Sjekk nett/Firebase-regler.");
    });
  });

  rescueDealsRef.on("value", (snapshot) => {
    rescueDeals = snapshot.val() && typeof snapshot.val() === "object" ? snapshot.val() : {};
    if (firebaseReady && !isEditingField()) {
      renderCategories();
      renderProductEditor();
    }
  }, (error) => console.warn("Redde maten kunne ikke synkroniseres.", error));
}''')

# Real FIFO-ish pending queue while preserving /current as the consumer slot so
# the existing Tampermonkey listener remains compatible.
queue_helpers = '''
function isIceSmsTerminalStatus(status = "") {
  return ["sent", "done", "completed", "failed", "cancelled"].includes(String(status || "").toLowerCase());
}

let iceSmsPromotePromise = null;
async function promoteNextIceSmsJob() {
  if (iceSmsPromotePromise) return iceSmsPromotePromise;
  iceSmsPromotePromise = (async () => {
    const currentSnapshot = await iceSmsCurrentRef.once("value");
    const current = currentSnapshot.val();
    if (current && !isIceSmsTerminalStatus(current.status)) return current;
    if (current) await iceSmsCurrentRef.remove();

    const pendingSnapshot = await iceSmsPendingRef.orderByChild("createdAt").limitToFirst(1).once("value");
    let nextKey = "";
    let nextJob = null;
    pendingSnapshot.forEach((child) => {
      if (!nextJob) {
        nextKey = child.key;
        nextJob = child.val();
      }
    });
    if (!nextJob || !nextKey) return null;

    const dispatchedAt = new Date().toISOString();
    const dispatchedJob = { ...nextJob, status: "pending", dispatchedAt };
    const result = await iceSmsCurrentRef.transaction((existing) => {
      if (existing && !isIceSmsTerminalStatus(existing.status)) return;
      return dispatchedJob;
    });
    if (result.committed) {
      await iceSmsPendingRef.child(nextKey).remove();
      return dispatchedJob;
    }
    return result.snapshot?.val() || null;
  })().catch((error) => {
    console.error("SMS-kø kunne ikke promoteres:", error);
    return null;
  }).finally(() => {
    iceSmsPromotePromise = null;
  });
  return iceSmsPromotePromise;
}
'''
admin = insert_before(admin, "async function enqueueIceSmsJob", queue_helpers, "insert SMS queue helpers")

admin = replace_function(admin, "enqueueIceSmsJob", '''
async function enqueueIceSmsJob(order = {}, readyMinutes = DEFAULT_READY_MINUTES, fulfillAt = null, options = {}) {
  const phone = normalizeIceSmsQueuePhone(order.customer?.phone || "");
  if (!phone || phone.length < 8) {
    showToast("SMS ikke sendt: telefonnummer mangler.");
    setStatus("SMS ikke sendt: telefonnummer mangler.");
    return null;
  }

  const createdAt = new Date().toISOString();
  const smsType = safeAdminText(options.type, "accepted");
  const message = limitIceSmsText(options.message || buildAcceptedOrderSmsMessage(order, readyMinutes, fulfillAt));
  const trackingUrl = buildOrderTrackingUrl(order);
  const job = {
    id: `${Date.now()}-${smsType}-${String(order.id || "order")}`,
    type: smsType,
    source: "kol-order-admin",
    sourceOrderId: String(order.id || ""),
    phone,
    customerName: safeAdminText(order.customer?.fullName || [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ")),
    message,
    trackingUrl,
    autoSend: options.autoSend !== false,
    status: "pending",
    createdAt
  };

  try {
    await iceSmsPendingRef.child(job.id).set(job);
    await promoteNextIceSmsJob();
    const smsLog = {
      queued: true,
      queuePath: `iceSmsQueue/pending/${job.id}`,
      jobId: job.id,
      type: smsType,
      phone: job.phone,
      message: job.message,
      trackingUrl: job.trackingUrl,
      status: "pending",
      createdAt
    };
    await ordersRef.child(order.id).child("iceSms").child(smsType).set(smsLog);
    await ordersRef.child(order.id).child("iceSmsLast").set(smsLog);
    setStatus("SMS-jobb lagt i kø.");
    return job;
  } catch (error) {
    console.error("Kunne ikke skrive ICE SMS-jobb:", error);
    showToast("SMS-jobb kunne ikke legges i kø.");
    setStatus("SMS-jobb kunne ikke legges i kø.");
    return null;
  }
}''')

# Promote the next queued job whenever the old consumer clears/completes current.
old_monitor = '''  if (iceSmsCurrentRef) {
    iceSmsCurrentRef.on("value", (snapshot) => {
      deviceSmsCurrentJobSnapshot = snapshot.val() || null;
      renderDeviceStatusPanel();
    });
  }
'''
new_monitor = '''  if (iceSmsCurrentRef) {
    iceSmsCurrentRef.on("value", (snapshot) => {
      deviceSmsCurrentJobSnapshot = snapshot.val() || null;
      renderDeviceStatusPanel();
      if (!deviceSmsCurrentJobSnapshot || isIceSmsTerminalStatus(deviceSmsCurrentJobSnapshot.status)) {
        window.setTimeout(() => promoteNextIceSmsJob(), 120);
      }
    });
  }
'''
admin = must_replace(admin, old_monitor, new_monitor, "SMS device monitor")

# Canonical order write model: remove duplicate snake_case writes, preserve old
# records by normalizing aliases on read.
admin = admin.replace("    confirmed_at: acceptedAt,\n", "", 2)
admin = admin.replace("    fulfill_time: fulfillAt,\n", "", 2)
admin = admin.replace('    order_type: "pickup",\n', '    orderType: "pickup",\n', 1)

# Add compatibility aliases to normalized old orders if not already present.
normalizer_start, normalizer_end = find_function_span(admin, "normalizeAdminOrderRecord")
normalizer = admin[normalizer_start:normalizer_end]
needle = '''    status,
    customer: {'''
compat = '''    status,
    orderType: safeAdminText(order.orderType || order.order_type, "pickup"),
    clientOrderCount: Math.max(1, safeAdminNumber(order.clientOrderCount ?? order.client_order_count, 1)),
    confirmedAt: safeAdminText(order.confirmedAt || order.confirmed_at || order.acceptedAt),
    fulfillTime: safeAdminText(order.fulfillTime || order.fulfill_time),
    customer: {'''
if needle not in normalizer:
    raise SystemExit("admin normalizer insertion point not found")
normalizer = normalizer.replace(needle, compat, 1)
admin = admin[:normalizer_start] + normalizer + admin[normalizer_end:]

# Cache bust after CSS consolidation.
admin = re.sub(r'kol-core\.css\?v=[^"\']+', 'kol-core.css?v=hardening-20260817', admin, count=1)
ADMIN_PATH.write_text(admin, encoding="utf-8")


# -----------------------------------------------------------------------------
# CSS
# Inline the pinned legacy stylesheet from git history, remove the cascade-layer
# dependency and strip the blanket !important usage from the newer customer
# overrides. Legacy rules stay first; customer overrides stay last.
# -----------------------------------------------------------------------------
css = CSS_PATH.read_text(encoding="utf-8")
match = re.match(
    r'\s*@layer\s+mobile,legacy;\s*@import\s+url\("https://cdn\.jsdelivr\.net/gh/pizzano/pizzano\.github\.io@([0-9a-f]+)/test/kol-core\.css"\)\s+layer\(legacy\);\s*@layer\s+mobile\s*\{(.*)\}\s*$',
    css,
    flags=re.S,
)
if not match:
    raise SystemExit("kol-core.css no longer matches the expected legacy-import + mobile-layer structure")
legacy_ref = match.group(1)
legacy_css = git_show(legacy_ref, "test/kol-core.css").strip()
mobile_css = match.group(2).strip()
mobile_css = re.sub(r'\s*!important\b', '', mobile_css)
combined_css = (
    "/* KØL shared styles — consolidated 2026-08-17.\n"
    "   The previous pinned CDN stylesheet is inlined below; customer overrides\n"
    "   follow it in normal cascade order, so a blanket !important layer is no\n"
    "   longer required. */\n\n"
    + legacy_css
    + "\n\n/* Customer/mobile overrides (formerly @layer mobile). */\n"
    + mobile_css
    + "\n"
)
CSS_PATH.write_text(combined_css, encoding="utf-8")


# -----------------------------------------------------------------------------
# SECURITY REVIEW ARTIFACTS
# We cannot safely turn on strict rules from front-end code alone because the
# current production admin/customer clients do not authenticate to Firebase.
# Commit a hardened target ruleset + migration notes without pretending it is
# already deployed.
# -----------------------------------------------------------------------------
security_md = '''# Firebase security hardening plan

## What is fixed in this branch

- Customer browsers no longer download `/orders` to calculate **Mest bestilt**. They read only `/publicStats/mostOrdered`.
- Admin menu sync no longer listens to Firebase `/` as one giant value snapshot. Menu fields, orders, rescue deals, SMS queue and connection status use separate paths/listeners.
- SMS writes use `/iceSmsQueue/pending/{jobId}` and `/iceSmsQueue/current` only as the Tampermonkey consumer slot, so a second SMS cannot overwrite a waiting SMS.
- New orders use one canonical camelCase metadata model. Old snake_case records are still normalized on read.

## Important: Auth is still the missing security boundary

The current browser clients initialize Realtime Database with only `databaseURL`; there is no Firebase Authentication session that distinguishes an admin from a customer. Because customers must be able to create orders and the admin must be able to edit menu/orders, strict production rules cannot safely distinguish those roles yet.

Do **not** deploy the example rules file as-is until Auth is implemented. The target architecture is:

1. Customer: Firebase Anonymous Auth; each order stores `ownerUid`.
2. Admin: Firebase Auth plus an `admin: true` custom claim (set by a trusted Admin SDK environment / Cloud Function, never by browser JavaScript).
3. Rules: customers may create/read only their own orders; only admins may update order status, menu, rescue deals, public stats and SMS queue.
4. Move `customerOrders` from phone-number keys to UID keys. Phone numbers should be order data, not authorization keys.
5. Consider moving SMS enqueue and rescue-stock reservation to a trusted backend/Cloud Function for stronger tamper resistance.

`database.rules.hardened.example.json` is a target ruleset for that Auth-based architecture, not a drop-in rule for the current unauthenticated production client.
'''
Path("test/FIREBASE_SECURITY.md").write_text(security_md, encoding="utf-8")

rules = {
  "rules": {
    ".read": False,
    ".write": False,
    "sections": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "extraOptions": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "customPizzaToppings": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "kebabPitaOptions": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "optionGroups": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "siteSettings": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "rescueDeals": {".read": True, ".write": "auth != null && auth.token.admin === true"},
    "publicStats": {
      "mostOrdered": {".read": True, ".write": "auth != null && auth.token.admin === true"}
    },
    "orders": {
      "$orderId": {
        ".read": "auth != null && (auth.token.admin === true || data.child('ownerUid').val() === auth.uid)",
        ".write": "auth != null && (auth.token.admin === true || (!data.exists() && newData.child('ownerUid').val() === auth.uid && newData.child('status').val() === 'pending'))"
      }
    },
    "customerOrders": {
      "$uid": {
        ".read": "auth != null && (auth.token.admin === true || auth.uid === $uid)",
        ".write": "auth != null && (auth.token.admin === true || auth.uid === $uid)"
      }
    },
    "iceSmsQueue": {".read": "auth != null && auth.token.admin === true", ".write": "auth != null && auth.token.admin === true"}
  }
}
Path("test/database.rules.hardened.example.json").write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("order-system hardening applied")
