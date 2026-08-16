from pathlib import Path

INDEX = Path('test/index.html')
ADMIN = Path('test/admin-panel.html')


def function_span(src: str, name: str):
    candidates = [f'async function {name}(', f'function {name}(']
    starts = [(src.find(c), c) for c in candidates if src.find(c) >= 0]
    if not starts:
        raise RuntimeError(f'Function not found: {name}')
    start, _ = min(starts, key=lambda x: x[0])
    brace = src.find('{', start)
    if brace < 0:
        raise RuntimeError(f'Opening brace not found: {name}')
    depth = 0
    i = brace
    quote = None
    line_comment = False
    block_comment = False
    escaped = False
    while i < len(src):
        ch = src[i]
        nxt = src[i + 1] if i + 1 < len(src) else ''
        if line_comment:
            if ch == '\n':
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == '*' and nxt == '/':
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == '/' and nxt == '/':
            line_comment = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            block_comment = True
            i += 2
            continue
        if ch in ('"', "'", '`'):
            quote = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise RuntimeError(f'Closing brace not found: {name}')


def replace_function(src: str, name: str, replacement: str):
    a, b = function_span(src, name)
    return src[:a] + replacement.strip() + src[b:]


# ---------------- CUSTOMER INDEX ----------------
idx = INDEX.read_text(encoding='utf-8')

old_fields = 'const firebaseMenuFields = ["sections", "extraOptions", "customPizzaToppings", "kebabPitaOptions", "optionGroups", "siteSettings", "rescueDeals"];'
new_fields = '''const firebaseMenuFields = ["sections", "extraOptions", "customPizzaToppings", "kebabPitaOptions", "optionGroups", "siteSettings"];
const firebasePublicMenuUrl = `${firebaseBaseUrl}/publicMenu.json`;
const firebaseMenuVersionUrl = `${firebaseBaseUrl}/menuVersion.json`;
const firebaseMostOrderedUrl = `${firebaseBaseUrl}/publicStats/mostOrdered.json`;
const menuCacheFallbackMaxAgeMs = 30 * 60 * 1000;'''
if old_fields not in idx:
    raise RuntimeError('Customer firebaseMenuFields block not found')
idx = idx.replace(old_fields, new_fields, 1)

idx = replace_function(idx, 'fetchFirebaseMenuConfig', r'''
async function fetchMenuVersion() {
  const response = await fetch(`${firebaseMenuVersionUrl}?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Kunne ikke kontrollere menyversjon");
  const value = await response.json();
  return value == null ? null : String(value);
}

async function fetchLegacyMenuConfig() {
  const entries = await Promise.all(firebaseMenuFields.map(async (key) => {
    const response = await fetch(`${firebaseBaseUrl}/${key}.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Kunne ikke hente ${key}`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

async function fetchFirebaseMenuConfig() {
  const response = await fetch(`${firebasePublicMenuUrl}?ts=${Date.now()}`, { cache: "no-store" });
  if (response.ok) {
    const packed = await response.json();
    if (packed && typeof packed === "object" && Array.isArray(packed.sections)) return packed;
  }
  return fetchLegacyMenuConfig();
}
''')

idx = replace_function(idx, 'readCachedMenuConfig', r'''
function readCachedMenuRecord() {
  try {
    const cached = localStorage.getItem(menuCacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed && parsed.config ? parsed : null;
  } catch (error) {
    console.warn("Lokal meny-cache kunne ikke leses.", error);
    return null;
  }
}

function readCachedMenuConfig() {
  return readCachedMenuRecord()?.config || null;
}
''')

idx = replace_function(idx, 'saveCachedMenuConfig', r'''
function saveCachedMenuConfig(config, version = null) {
  try {
    localStorage.setItem(menuCacheKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      version: version == null ? null : String(version),
      config
    }));
  } catch (error) {
    console.warn("Lokal meny-cache kunne ikke lagres.", error);
  }
}
''')

idx = replace_function(idx, 'loadMenuConfig', r'''
async function loadMenuConfig() {
  const cachedRecord = readCachedMenuRecord();
  const cachedConfig = cachedRecord?.config || null;
  let cachedSignature = "";
  let renderedFromCache = false;

  if (cachedConfig && applyMenuConfig(cachedConfig)) {
    mostOrderedMenuItems = readCachedMostOrderedItems();
    cachedSignature = menuConfigSignature(cachedConfig);
    renderMenu();
    finishMenuLoading();
    renderedFromCache = true;
  }

  let remoteVersion = null;
  try {
    remoteVersion = await fetchMenuVersion();
  } catch (error) {
    console.warn("Menyversjon kunne ikke kontrolleres.", error);
  }

  const savedAtMs = cachedRecord?.savedAt ? Date.parse(cachedRecord.savedAt) : 0;
  const cacheAge = savedAtMs ? Date.now() - savedAtMs : Number.POSITIVE_INFINITY;
  const versionMatches = Boolean(
    renderedFromCache && remoteVersion != null && cachedRecord?.version != null && String(cachedRecord.version) === String(remoteVersion)
  );
  const safeFallbackCache = Boolean(renderedFromCache && remoteVersion == null && cacheAge < menuCacheFallbackMaxAgeMs);

  if (!versionMatches && !safeFallbackCache) {
    try {
      const config = await fetchFirebaseMenuConfig();
      const freshSignature = menuConfigSignature(config);
      if (applyMenuConfig(config)) {
        saveCachedMenuConfig(config, remoteVersion);
        if (!mostOrderedMenuItems.length) mostOrderedMenuItems = readCachedMostOrderedItems();
        if (!renderedFromCache || freshSignature !== cachedSignature) renderMenu();
        renderedFromCache = true;
      }
    } catch (error) {
      console.warn("Meny kunne ikke oppdateres fra Firebase.", error);
      if (!renderedFromCache) {
        menuSections = [];
        renderMenu();
      }
    }
  }

  await Promise.allSettled([
    refreshRescueDealsFromDatabase({ render: true }),
    refreshMostOrderedFromDatabase({ render: true })
  ]);
  finishMenuLoading();
}
''')

idx = replace_function(idx, 'refreshMostOrderedFromDatabase', r'''
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
      if (!item || seen.has(String(item.id || item.name || ""))) return;
      seen.add(String(item.id || item.name || ""));
      nextItems.push(item);
    });
    const limited = nextItems.slice(0, 5);
    if (limited.length) {
      const oldSignature = mostOrderedMenuItems.map((item) => item.id).join("|");
      const nextSignature = limited.map((item) => item.id).join("|");
      mostOrderedMenuItems = limited;
      saveCachedMostOrderedItems(limited);
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
}
''')

idx = replace_function(idx, 'syncRecentOrdersFromFirebase', r'''
async function syncRecentOrdersFromFirebase() {
  const orders = getRecentOrders();
  if (!orders.length) return;
  const active = orders
    .filter((order) => {
      const status = order.status || "pending";
      return status === "pending" || (status === "accepted" && !isOrderReadyForPickup(order));
    })
    .slice(0, 4);

  if (!active.length) {
    refreshProfileReadyStates();
    return;
  }

  const updated = await Promise.all(active.map(async (order) => {
    if (!order.id) return order;
    try {
      return (await fetchOrder(order.id)) || order;
    } catch {
      return order;
    }
  }));
  updated.forEach((order) => rememberRecentOrder(order));
  refreshProfileReadyStates();
}
''')

idx = replace_function(idx, 'startRecentOrdersSync', r'''
function startRecentOrdersSync() {
  window.clearInterval(recentOrdersPollTimer);
  const hasActive = getRecentOrders().some((order) => {
    const status = order.status || "pending";
    return status === "pending" || (status === "accepted" && !isOrderReadyForPickup(order));
  });
  if (!hasActive) {
    refreshProfileReadyStates();
    return;
  }
  syncRecentOrdersFromFirebase();
  recentOrdersPollTimer = window.setInterval(() => {
    if (document.visibilityState !== "hidden") syncRecentOrdersFromFirebase();
  }, 8000);
}
''')

# No customer code should download the whole /orders tree anymore.
if 'fetch(`${firebaseOrdersUrl}?ts=' in idx or 'fetch(`${firebaseOrdersUrl}&' in idx:
    raise RuntimeError('Customer still contains a whole /orders fetch')

INDEX.write_text(idx, encoding='utf-8')


# ---------------- ADMIN PANEL ----------------
adm = ADMIN.read_text(encoding='utf-8')
old_refs = '''const menuRef = firebase.database().ref("/");
const ordersRef = firebase.database().ref("/orders");
const rescueDealsRef = firebase.database().ref("/rescueDeals");'''
new_refs = '''const rootMenuRef = firebase.database().ref("/");
const menuRef = firebase.database().ref("/publicMenu");
const menuVersionRef = firebase.database().ref("/menuVersion");
const ordersRef = firebase.database().ref("/orders");
const rescueDealsRef = firebase.database().ref("/rescueDeals");
const publicMostOrderedRef = firebase.database().ref("/publicStats/mostOrdered");
const legacyMenuKeys = ["sections", "extraOptions", "customPizzaToppings", "kebabPitaOptions", "optionGroups", "siteSettings"];'''
if old_refs not in adm:
    raise RuntimeError('Admin root refs block not found')
adm = adm.replace(old_refs, new_refs, 1)

adm = replace_function(adm, 'loadData', r'''
async function readLegacyMenuConfigOnce() {
  const entries = await Promise.all(legacyMenuKeys.map(async (key) => {
    const snapshot = await firebase.database().ref(`/${key}`).once("value");
    return [key, snapshot.val()];
  }));
  return Object.fromEntries(entries);
}

async function seedPublicMenuFromLegacy() {
  const legacy = await readLegacyMenuConfigOnce();
  if (!hasValidConfig(legacy)) return null;
  const normalized = normalizeConfig(legacy);
  const version = Date.now();
  await rootMenuRef.update({ publicMenu: normalized, menuVersion: version });
  return normalized;
}

async function loadData() {
  setStatus("Synkroniserer med Firebase...");
  const [menuSnapshot, rescueSnapshot] = await Promise.all([menuRef.once("value"), rescueDealsRef.once("value")]);
  let value = menuSnapshot.val();
  rescueDeals = rescueSnapshot.val() && typeof rescueSnapshot.val() === "object" ? rescueSnapshot.val() : {};
  if (!hasValidConfig(value)) value = await seedPublicMenuFromLegacy();
  const catalogUpgrade = hasValidConfig(value) ? window.KOLMenuCatalog?.upgrade(value || {}) : null;
  const effectiveValue = catalogUpgrade?.config || value;
  config = hasValidConfig(effectiveValue) ? normalizeConfig(effectiveValue) : createEmptyConfig();
  if (hasValidConfig(effectiveValue)) saveAdminMenuCache(effectiveValue);
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
  setStatus(hasValidConfig(effectiveValue) ? "Synkronisert med Firebase." : "Firebase er tom. Du kan starte fra null og legge til kategori.");
}
''')

adm = replace_function(adm, 'writeLiveConfig', r'''
async function writeLiveConfig(message = "Lagret automatisk til Firebase.") {
  if (!config) return false;
  try {
    setStatus("Lagrer til Firebase...");
    const normalized = normalizeConfig(config);
    const version = Date.now();
    config = normalized;
    // Én sjelden meny-skriving holder både gammel struktur og kompakt publicMenu oppdatert.
    await rootMenuRef.update({ ...normalized, publicMenu: normalized, menuVersion: version });
    saveAdminMenuCache(normalized);
    setStatus(message);
    return true;
  } catch (error) {
    setStatus("Kunne ikke lagre. Sjekk Firebase-regler.");
    console.error(error);
    return false;
  }
}
''')

adm = replace_function(adm, 'startRealtimeSync', r'''
function startRealtimeSync() {
  setStatus("Kobler til Firebase...");
  renderCachedMenuIfAvailable();

  let seedingPublicMenu = false;
  menuRef.on("value", async (snapshot) => {
    let value = snapshot.val();
    if (!hasValidConfig(value)) {
      if (seedingPublicMenu) return;
      seedingPublicMenu = true;
      try {
        value = await seedPublicMenuFromLegacy();
        if (!value) {
          config = createEmptyConfig();
          selectedCategoryIndex = null;
          selectedProductIndex = null;
          productEditorOpen = false;
          firebaseReady = true;
          if (!isEditingField()) renderAll();
          setStatus("Firebase er tom. Klar til å lage ny meny.");
        }
      } catch (error) {
        console.error(error);
        setStatus("Kunne ikke hente meny fra Firebase.");
      } finally {
        seedingPublicMenu = false;
      }
      return;
    }

    const catalogUpgrade = window.KOLMenuCatalog?.upgrade(value || {});
    const effectiveValue = catalogUpgrade?.config || value;
    config = normalizeConfig(effectiveValue);
    saveAdminMenuCache(effectiveValue);
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
    if (catalogUpgrade?.changed) writeLiveConfig("Menyformat oppdatert.").catch(console.warn);
  }, (error) => {
    console.error(error);
    setStatus("Firebase-tilkobling feilet. Viser lokal meny hvis tilgjengelig.");
  });

  rescueDealsRef.on("value", (snapshot) => {
    rescueDeals = snapshot.val() && typeof snapshot.val() === "object" ? snapshot.val() : {};
    if (firebaseReady && !isEditingField()) renderAll();
  }, (error) => console.warn("Redde maten kunne ikke synkroniseres.", error));
}
''')

adm = replace_function(adm, 'listenForOrders', r'''
let adminOrdersById = new Map();
let adminOrdersRenderTimer = null;
let adminInitialOrdersTimer = null;
let publicMostOrderedTimer = null;
let lastPublicMostOrderedSignature = "";

function buildPublicMostOrderedRows() {
  const counts = new Map();
  adminOrders.forEach((order) => {
    if (!order || (order.status || "pending") === "cancelled") return;
    asArray(order.items).forEach((item) => {
      const id = safeAdminText(item?.id || item?.productId);
      const name = safeAdminText(item?.name);
      if (!id && !name) return;
      const key = id || `name:${name.toLocaleLowerCase("nb-NO")}`;
      const current = counts.get(key) || { id, name, count: 0 };
      current.count += Math.max(1, safeAdminNumber(item?.quantity || 1));
      counts.set(key, current);
    });
  });
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 5);
}

function schedulePublicMostOrderedSync() {
  window.clearTimeout(publicMostOrderedTimer);
  publicMostOrderedTimer = window.setTimeout(async () => {
    const rows = buildPublicMostOrderedRows();
    const signature = JSON.stringify(rows);
    if (signature === lastPublicMostOrderedSignature) return;
    lastPublicMostOrderedSignature = signature;
    try {
      await publicMostOrderedRef.set(rows);
    } catch (error) {
      console.warn("Bestselgeroversikt kunne ikke lagres.", error);
    }
  }, 900);
}

function flushAdminOrdersFromMap() {
  adminOrders = Array.from(adminOrdersById.values());
  try {
    renderOrdersAdmin();
  } catch (error) {
    console.error("Bestillinger kunne ikke vises:", error);
    if (ordersAdminList) ordersAdminList.innerHTML = `<p class="empty-orders">Bestillingene kunne ikke vises akkurat nå.</p>`;
  }
  updateAdminOrderAlarmLoop();
  schedulePublicMostOrderedSync();
}

function scheduleAdminOrdersRender() {
  window.clearTimeout(adminOrdersRenderTimer);
  adminOrdersRenderTimer = window.setTimeout(flushAdminOrdersFromMap, 80);
}

function listenForOrders() {
  if (!ordersRef) return;
  ordersRef.off("value");
  ordersRef.off("child_added");
  ordersRef.off("child_changed");
  ordersRef.off("child_removed");
  adminOrdersById = new Map();
  knownOrderIdsForSound = new Set();
  ordersReady = false;

  const markInitialLoadSoon = () => {
    window.clearTimeout(adminInitialOrdersTimer);
    adminInitialOrdersTimer = window.setTimeout(() => {
      ordersReady = true;
      knownOrderIdsForSound = new Set(adminOrdersById.keys());
      flushAdminOrdersFromMap();
    }, 700);
  };

  const onError = (error) => {
    console.error(error);
    setStatus("Kunne ikke synkronisere bestillinger.");
  };

  ordersRef.on("child_added", (snapshot) => {
    const id = String(snapshot.key || "");
    const order = normalizeAdminOrderRecord(snapshot.val(), id);
    if (!order) return;
    const isNewPending = ordersReady && !knownOrderIdsForSound.has(id) && isAdminOrderFromToday(order) && (order.status || "pending") === "pending";
    adminOrdersById.set(id, order);
    knownOrderIdsForSound.add(id);
    scheduleAdminOrdersRender();
    markInitialLoadSoon();
    if (isNewPending) {
      setStatus("Ny bestilling mottatt.");
      showToast("Ny bestilling mottatt.");
    }
  }, onError);

  ordersRef.on("child_changed", (snapshot) => {
    const id = String(snapshot.key || "");
    const order = normalizeAdminOrderRecord(snapshot.val(), id);
    if (!order) return;
    adminOrdersById.set(id, order);
    scheduleAdminOrdersRender();
  }, onError);

  ordersRef.on("child_removed", (snapshot) => {
    const id = String(snapshot.key || "");
    adminOrdersById.delete(id);
    knownOrderIdsForSound.delete(id);
    scheduleAdminOrdersRender();
  }, onError);
}
''')

if 'const menuRef = firebase.database().ref("/")' in adm:
    raise RuntimeError('Admin still listens to root as menuRef')
if 'ordersRef.on("value"' in adm:
    raise RuntimeError('Admin still uses value listener for /orders')

ADMIN.write_text(adm, encoding='utf-8')
print('Firebase efficiency v37 patched')
