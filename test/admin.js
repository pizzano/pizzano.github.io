const firebaseDatabaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/";
const firebaseMenuUrl = `${firebaseDatabaseUrl}.json`;
firebase.initializeApp({ databaseURL: firebaseDatabaseUrl });
const menuRef = firebase.database().ref("/");
const ordersRef = firebase.database().ref("/orders");

const fields = {
  productId: document.querySelector("#productId"),
  productNumber: document.querySelector("#productNumber"),
  productName: document.querySelector("#productName"),
  productType: document.querySelector("#productType"),
  productThumb: document.querySelector("#productThumb"),
  productPrice: document.querySelector("#productPrice"),
  productMediumPrice: document.querySelector("#productMediumPrice"),
  productLargePrice: document.querySelector("#productLargePrice"),
  productDisplayPrice: document.querySelector("#productDisplayPrice"),
  productImageUrl: document.querySelector("#productImageUrl"),
  productIngredients: document.querySelector("#productIngredients")
};

const productStatusFields = {
  // Türkçe not: Ürün gizleme / utsolgt kontrolleri. Boş bırakılırsa ürün normal görünür.
  hidden: document.querySelector("#productHidden"),
  soldOut: document.querySelector("#productSoldOut"),
  soldOutUntil: document.querySelector("#productSoldOutUntil")
};

const productPriceRows = document.querySelector("#productPriceRows");
const addProductPriceButton = document.querySelector("#addProductPrice");
const siteSettingFields = document.querySelectorAll("[data-setting-field]");
const settingsTabs = document.querySelectorAll("[data-settings-tab]");
const settingsPages = document.querySelectorAll("[data-settings-page]");
const settingsModal = document.querySelector("#settingsModal");
const openSettingsButtons = document.querySelectorAll("[data-open-settings]");
const closeSettingsButtons = document.querySelectorAll("[data-close-settings]");
const adminPages = document.querySelectorAll("[data-admin-page]");
const topNavButtons = document.querySelectorAll("[data-top-nav]");
const inlineSettingsTitle = document.querySelector("#inlineSettingsTitle");
const inlineSettingsSubtitle = document.querySelector("#inlineSettingsSubtitle");
const ordersAdminList = document.querySelector("#ordersAdminList");
const ordersCount = document.querySelector("#ordersCount");
const refreshOrdersButton = document.querySelector("#refreshOrders");
const downloadBackupButton = document.querySelector("#downloadBackup");
const saveLocalBackupButton = document.querySelector("#saveLocalBackup");
const localBackupList = document.querySelector("#localBackupList");
const restoreBackupFile = document.querySelector("#restoreBackupFile");
const restoreBackupPreview = document.querySelector("#restoreBackupPreview");
const restoreBackupNowButton = document.querySelector("#restoreBackupNow");
const adminRestaurantTitle = document.querySelector("#adminRestaurantTitle");

const adminStatus = document.querySelector("#adminStatus");
const adminToast = document.querySelector("#adminToast");
const categoryButtons = document.querySelector("#categoryButtons");
const productButtons = document.querySelector("#productButtons");
const productForm = document.querySelector("#productForm");
const assignedGroups = document.querySelector("#assignedGroups");
const optionGroupsAdmin = document.querySelector("#optionGroupsAdmin");
const addOptionGroupButton = document.querySelector("#addOptionGroup");
const optionContainers = {
  extraOptions: document.querySelector("#pizzaExtras"),
  customPizzaToppings: document.querySelector("#customPizzaExtras"),
  kebabPitaOptions: document.querySelector("#kebabExtras")
};

let config = null;
let selectedCategoryIndex = null;
let selectedProductIndex = null;
let editingCategoryIndex = null;
let editingGroupIndex = null;
let draggedCategoryIndex = null;
let draggedProductIndex = null;
let draggedGroupId = null;
let draggedGroupIndex = null;
let pendingScrollToProduct = false;
let saveTimer = null;
let firebaseReady = false;
let toastTimer = null;
let adminOrders = [];
let ordersReady = false;
let pendingRestoreData = null;
const LOCAL_BACKUP_KEY = "kol_menu_local_backups_v1";
const DAILY_LOCAL_BACKUP_DATE_KEY = "kol_menu_daily_backup_date_v1";

function setStatus(message) {
  adminStatus.textContent = message;
  if (message.toLowerCase().includes("lagret")) showToast(message);
}

function showToast(message) {
  adminToast.textContent = message;
  adminToast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    adminToast.hidden = true;
  }, 2200);
}

function makeId(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

function getNumber(value) {
  if (value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function cleanObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== "" && value !== undefined));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}


// TÜRKÇE NOT: Yedek sistemi bütün Firebase verisini JSON olarak indirir veya geri yükler.
// Modül gibi çalışacak şekilde yazıldı: butonlar HTML'de yoksa sistem sessizce devam eder.
function backupDateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function downloadTextFile(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function countBackupData(data) {
  const sections = asArray(data?.sections);
  const products = sections.reduce((sum, section) => sum + asArray(section.items).length, 0);
  const groups = asArray(data?.optionGroups).length;
  return { sections: sections.length, products, groups };
}

function createBackupPayload(data, reason = "manual") {
  const safeData = normalizeConfig(data || config || {});
  return {
    backupMeta: {
      app: "KOL_MENU_ADMIN",
      version: 1,
      reason,
      exportedAt: new Date().toISOString(),
      restaurantName: safeData.siteSettings?.restaurantName || "",
      firebaseDatabaseUrl
    },
    data: safeData
  };
}

function extractBackupData(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.data && typeof payload.data === "object") return normalizeConfig(payload.data);
  if (payload.sections || payload.optionGroups || payload.siteSettings) return normalizeConfig(payload);
  return null;
}

function getLocalBackups() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_BACKUP_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function setLocalBackups(backups) {
  localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backups.slice(0, 12)));
}

function addLocalBackup(payload) {
  const backups = getLocalBackups();
  backups.unshift(payload);
  setLocalBackups(backups);
  renderLocalBackups();
}

function renderLocalBackups() {
  if (!localBackupList) return;
  const backups = getLocalBackups();
  if (!backups.length) {
    localBackupList.innerHTML = "<p>Ingen lokal yedek ennå.</p>";
    return;
  }
  localBackupList.innerHTML = backups
    .map((backup, index) => {
      const data = extractBackupData(backup);
      const counts = countBackupData(data || {});
      const exportedAt = backup.backupMeta?.exportedAt ? new Date(backup.backupMeta.exportedAt).toLocaleString("no-NO") : "Ukjent dato";
      const reason = backup.backupMeta?.reason || "backup";
      return `
        <div class="local-backup-row">
          <div>
            <strong>${escapeHtml(exportedAt)}</strong>
            <span>${escapeHtml(reason)} · ${counts.sections} kategorier · ${counts.products} produkter · ${counts.groups} valggrupper</span>
          </div>
          <div class="local-backup-actions">
            <button type="button" data-download-local-backup="${index}">Last ned</button>
            <button type="button" data-restore-local-backup="${index}">Gjenopprett</button>
            <button class="danger-light" type="button" data-delete-local-backup="${index}">Slett</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function downloadFullBackup() {
  try {
    setStatus("Lager yedekfil...");
    const snapshot = await menuRef.once("value");
    const payload = createBackupPayload(snapshot.val() || config, "manual-download");
    const restaurant = makeId(payload.backupMeta.restaurantName || "kol-menu");
    downloadTextFile(`${restaurant}-firebase-yedek-${backupDateStamp()}.json`, JSON.stringify(payload, null, 2));
    addLocalBackup(createBackupPayload(payload.data, "manual-download-copy"));
    setStatus("Yedek lastet ned og lokal kopi lagret.");
  } catch (error) {
    console.error(error);
    setStatus("Kunne ikke lage yedek. Sjekk konsollen.");
  }
}

function saveCurrentLocalBackup(reason = "manual-local") {
  if (!config) return;
  addLocalBackup(createBackupPayload(config, reason));
  setStatus("Lokal yedek lagret i denne nettleseren.");
}

function localDayStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function maybeDailyLocalBackupOnAdminOpen() {
  if (!config) return false;

  // TÜRKÇE NOT: Artık her 10 dakikada bir yedek almıyoruz.
  // Admin paneli açıldığında aynı tarayıcıda günde sadece 1 defa lokal yedek alınır.
  const today = localDayStamp();
  if (localStorage.getItem(DAILY_LOCAL_BACKUP_DATE_KEY) === today) return false;

  addLocalBackup(createBackupPayload(config, "daily-admin-open"));
  localStorage.setItem(DAILY_LOCAL_BACKUP_DATE_KEY, today);
  return true;
}

function previewRestoreData(data, label = "Valgt fil") {
  if (!restoreBackupPreview) return;
  const counts = countBackupData(data || {});
  restoreBackupPreview.innerHTML = `
    <strong>${escapeHtml(label)}</strong><br>
    ${counts.sections} kategorier · ${counts.products} produkter · ${counts.groups} valggrupper<br>
    Klikk "Gjenopprett til Firebase" hvis dette ser riktig ut.
  `;
}

async function restoreDataToFirebase(data, reason = "restore") {
  if (!data) return;
  if (!confirm("Dette overskriver Firebase-dataen. Har du tatt yedek først?")) return;
  try {
    saveCurrentLocalBackup("before-restore");
    setStatus("Gjenoppretter Firebase...");
    const cleanData = normalizeConfig(data);
    await menuRef.set(cleanData);
    config = cleanData;
    pendingRestoreData = null;
    if (restoreBackupNowButton) restoreBackupNowButton.disabled = true;
    renderAll();
    setAdminView("menu");
    setStatus("Firebase er gjenopprettet fra yedek.");
  } catch (error) {
    console.error(error);
    setStatus("Kunne ikke gjenopprette yedek.");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasValidConfig(value) {
  return value && asArray(value.sections).length > 0;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}


function defaultSiteSettings() {
  return {
    restaurantName: "KØL Grill & Pizza",
    logoUrl: "",
    defaultImageUrl: "",
    phone: "+47 41 14 53 53",
    email: "",
    country: "Norway",
    timezone: "Europe/Oslo",
    city: "SKARNES",
    postalCode: "2100",
    streetAddress: "ØGARDSVEGEN 44",
    openingDays: "Mandag, Onsdag - Søndag",
    openingTime: "14:00 - 22:00",
    orderOpenTime: "14:00",
    orderCloseTime: "22:00",
    minPreorderMinutes: "30",
    pickupInfo: "Samme som åpningstider",
    paymentInfo: "Kort ved henting (henting)"
  };
}

function normalizeSiteSettings(value) {
  return { ...defaultSiteSettings(), ...(value && typeof value === "object" ? value : {}) };
}

function defaultOptionGroups() {
  return [
    {
      id: "eksempel-tillegg",
      title: "Eksempel tillegg",
      type: "multiple",
      required: false,
      options: [{ id: "eksempel-valg", label: "Eksempel valg", price: 0 }]
    }
  ];
}


function defaultGroupIdsForProduct(product, section) {
  return [];
}


function normalizeOptionGroups(value) {
  const hasSavedOptionGroups = value && Object.prototype.hasOwnProperty.call(value, "optionGroups");
  const source = hasSavedOptionGroups ? asArray(value.optionGroups) : defaultOptionGroups();

  return source.map((group) => ({
    ...group,
    type: group.type === "single" ? "single" : "multiple",
    required: Boolean(group.required),
    options: asArray(group.options)
  }));
}


function normalizeConfig(value) {
  const sections = asArray(value?.sections).map((section) => ({
    ...section,
    items: asArray(section.items).map((product) => {
      const hasGroupIds = Object.prototype.hasOwnProperty.call(product, "optionGroupIds");
      return {
        ...product,
        optionGroupIds: hasGroupIds ? asArray(product.optionGroupIds) : defaultGroupIdsForProduct(product, section)
      };
    })
  }));
  return {
    sections,
    extraOptions: asArray(value?.extraOptions),
    customPizzaToppings: asArray(value?.customPizzaToppings),
    kebabPitaOptions: asArray(value?.kebabPitaOptions),
    optionGroups: normalizeOptionGroups(value),
    siteSettings: normalizeSiteSettings(value?.siteSettings)
  };
}

function isEditingField() {
  const active = document.activeElement;
  return active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

function extractArrayFromScript(source, variableName) {
  const marker = `let ${variableName} = `;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${variableName} finnes ikke i app.js`);
  const arrayStart = source.indexOf("[", start);
  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return source.slice(arrayStart, index + 1);
  }
  throw new Error(`${variableName} kunne ikke leses`);
}

function createEmptyConfig() {
  // TÜRKÇE: menu-data.js artık zorunlu değil. Firebase boşsa buradan tertemiz boş admin başlatılır.
  // Böylece önce kategori ekleyip sonra ürünleri sıfırdan oluşturabilirsin.
  return normalizeConfig({
    sections: [],
    extraOptions: [],
    customPizzaToppings: [],
    kebabPitaOptions: [],
    optionGroups: [],
    siteSettings: defaultSiteSettings()
  });
}

async function loadDefaultConfig() {
  // TÜRKÇE: Eski sistem menu-data.js / DEFAULT_MENU_CONFIG arıyordu.
  // Şimdi aramıyoruz; dosya silinse bile admin paneli çalışır.
  return createEmptyConfig();
}

async function loadData() {
  setStatus("Synkroniserer med Firebase...");
  const snapshot = await menuRef.once("value");
  const value = snapshot.val();

  // TÜRKÇE: Firebase tamamen silinmişse bile config boş kalmasın.
  // Boş config ile admin panelinde kategori/ürün ekleme devam eder.
  config = hasValidConfig(value) ? normalizeConfig(value) : createEmptyConfig();
  if (selectedCategoryIndex !== null && selectedCategoryIndex >= config.sections.length) selectedCategoryIndex = null;
  if (!selectedCategory()) selectedProductIndex = null;
  else if (selectedProductIndex !== null && selectedProductIndex >= asArray(selectedCategory()?.items).length) selectedProductIndex = null;
  renderAll();
  const dailyBackupCreated = hasValidConfig(value) ? maybeDailyLocalBackupOnAdminOpen() : false;
  setStatus(
    hasValidConfig(value)
      ? (dailyBackupCreated ? "Synkronisert. Daglig lokal yedek lagret i denne nettleseren." : "Synkronisert med Firebase.")
      : "Firebase er tom. Du kan starte fra null og legge til kategori."
  );
}

async function saveData() {
  await writeLiveConfig("Lagret til Firebase.");
}

async function writeLiveConfig(message = "Lagret automatisk til Firebase.") {
  if (!config) return;
  try {
    setStatus("Lagrer til Firebase...");
    // TÜRKÇE: Root'a set() yaparsak /orders silinir. update() siparişleri korur.
    await menuRef.update(normalizeConfig(config));
    setStatus(message);
  } catch (error) {
    setStatus("Kunne ikke lagre. Sjekk Firebase-regler.");
    console.error(error);
  }
}

// Otomatik kaydetme gereken yerlerde kullanılır. Ürün formunda artık manuel kayıt tercih edilir.
function scheduleSave() {
  if (!firebaseReady || !config) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => writeLiveConfig(), 550);
}

function selectedCategory() {
  if (!config || selectedCategoryIndex === null || selectedCategoryIndex === undefined) return null;
  return config.sections[selectedCategoryIndex] || null;
}

function selectedProduct() {
  const category = selectedCategory();
  if (!category || selectedProductIndex === null || selectedProductIndex === undefined) return null;
  return category.items?.[selectedProductIndex] || null;
}

function scrollSelectedProductToTop() {
  if (!pendingScrollToProduct || selectedCategoryIndex === null || selectedProductIndex === null) return;
  pendingScrollToProduct = false;
  window.requestAnimationFrame(() => {
    const block = document.querySelector(`[data-product-block="${selectedCategoryIndex}:${selectedProductIndex}"]`);
    if (!block) return;
    block.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function mountProductFormInline() {
  if (!productForm) return;
  const mount = document.querySelector("#inlineProductEditorMount");
  if (mount) {
    mount.appendChild(productForm);
    productForm.classList.add("inline-product-edit-form");
    productForm.removeAttribute("aria-hidden");
    return;
  }

  const stash = document.querySelector(".product-form-stash .product-admin-grid") || document.querySelector(".product-form-stash");
  if (stash && productForm.parentElement !== stash) stash.appendChild(productForm);
  productForm.classList.remove("inline-product-edit-form");
}

function adminDefaultImageUrl() {
  return (config?.siteSettings?.defaultImageUrl || "").trim();
}

function categoryImageMarkup(section = {}) {
  const imageUrl = section.imageUrl || adminDefaultImageUrl();
  if (imageUrl) {
    return `<span class="category-thumb custom-category-thumb"><img src="${escapeHtml(imageUrl)}" alt="" onerror="this.closest('.category-thumb')?.classList.remove('custom-category-thumb'); this.remove();"></span>`;
  }
  return `<span class="category-thumb default-thumb ${escapeHtml(section.imageClass || "pizza-strip")}"></span>`;
}

function productImageMarkup(product = {}) {
  const imageUrl = product.imageUrl || adminDefaultImageUrl();
  if (imageUrl) {
    return `<span class="product-mini-thumb custom-product-thumb"><img src="${escapeHtml(imageUrl)}" alt="" onerror="this.closest('.product-mini-thumb')?.classList.remove('custom-product-thumb'); this.remove();"></span>`;
  }
  return `<span class="product-mini-thumb default-thumb ${escapeHtml(product.thumb || "plate")}"></span>`;
}

function productPriceSummary(product = {}) {
  const prices = getProductPriceList(product).filter((size) => size.price !== undefined);
  if (!prices.length) return "Ingen pris";
  if (prices.length === 1) return `${prices[0].price},-`;
  return prices.map((size) => `${escapeHtml(size.label)} ${size.price},-`).join(" · ");
}


// Türkçe not: Admin ve müşteri tarafında ortak status mantığı.
// hidden=true olursa müşteri tarafında görünmez. soldOut=true veya ileri tarihli soldOutUntil varsa müşteri UTSOLGT görür.
function toDateTimeLocalValue(value = "") {
  if (!value) return "";
  return String(value).slice(0, 16);
}

function isDateInFuture(value = "") {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function isHiddenItem(item = {}) {
  return item.hidden === true;
}

function isSoldOutItem(item = {}) {
  return item.soldOut === true || isDateInFuture(item.soldOutUntil || "");
}

function statusBadges(item = {}) {
  const badges = [];
  if (isHiddenItem(item)) badges.push(`<span class="status-badge hidden-badge">Skjult</span>`);
  if (isSoldOutItem(item)) badges.push(`<span class="status-badge soldout-badge">Utsolgt</span>`);
  if (item.soldOutUntil) badges.push(`<span class="status-badge until-badge">til ${escapeHtml(toDateTimeLocalValue(item.soldOutUntil).replace("T", " "))}</span>`);
  return badges.length ? `<span class="status-badge-row">${badges.join("")}</span>` : "";
}

// Kategori kartlarını ve kategori içindeki ürün listesini çizer.
function renderCategories() {
  categoryButtons.innerHTML = config.sections
    .map((section, index) => {
      const isActive = index === selectedCategoryIndex;
      const isEditing = index === editingCategoryIndex;
      const products = asArray(section.items)
        .map((product, productIndex) => {
          const isSelectedProduct = isActive && productIndex === selectedProductIndex;
          return `
            <div class="product-inline-block ${isSelectedProduct ? "active" : ""}" data-product-block="${index}:${productIndex}">
              <button class="nested-product-choice product-card-row ${isSelectedProduct ? "active" : ""}" type="button" draggable="true" data-category-product="${index}:${productIndex}" data-product-drag="${productIndex}">
                ${productImageMarkup(product)}
                <span class="product-card-copy">
                  <strong>${escapeHtml(product.number ? `${product.number}- ${product.name || product.id}` : product.name || product.id || "Nytt produkt")}</strong>
                  ${statusBadges(product)}
                  <span>${escapeHtml(product.ingredients || "Klikk for å redigere")}</span>
                </span>
                <span class="product-card-price">${productPriceSummary(product)}</span>
              </button>
              ${isSelectedProduct ? `<div id="inlineProductEditorMount" class="inline-product-editor-mount"></div>` : ""}
            </div>
          `;
        })
        .join("");
      return `
        <article class="category-card menu-category-card ${isActive ? "active" : ""}" draggable="true" data-category-drag="${index}">
          <div class="category-choice-row menu-category-row">
            <button class="category-choice menu-category-choice" type="button" data-category="${index}">
              ${categoryImageMarkup(section)}
              <span class="category-card-copy">
                <strong>${escapeHtml(section.title || section.id || "Ny kategori")}</strong>
                ${statusBadges(section)}
                <span>${escapeHtml(section.note || (asArray(section.items).length ? `${asArray(section.items).length} produkter` : "Ingen produkter ennå"))}</span>
              </span>
              <span class="category-chevron">${isActive ? "⌃" : "⌄"}</span>
            </button>
            <button class="category-menu-button" type="button" data-category-menu="${index}" aria-label="Kategori valg">⋮</button>
            <div class="category-menu" data-category-menu-panel="${index}" hidden>
              <button type="button" data-category-action="edit" data-category-index="${index}">${isEditing ? "Lukk redigering" : "Rediger kategori"}</button>
              <button type="button" data-category-action="delete" data-category-index="${index}">Slett kategori</button>
            </div>
          </div>
          ${
            isEditing
              ? `<div class="inline-category-editor" data-inline-category="${index}">
                  <label>Navn <input data-category-field="title" value="${escapeHtml(section.title || "")}"></label>
                  <label>Beskrivelse <textarea data-category-field="note" rows="2">${escapeHtml(section.note || "")}</textarea></label>
                  <label>Bilde URL <input data-category-field="imageUrl" value="${escapeHtml(section.imageUrl || "")}" placeholder="https://..."></label>
                  <section class="availability-controls">
                    <strong>Status</strong>
                    <label><input type="checkbox" data-category-field="hidden" ${section.hidden ? "checked" : ""}> Skjul kategori fra kundesiden</label>
                    <label><input type="checkbox" data-category-field="soldOut" ${section.soldOut ? "checked" : ""}> Vis hele kategorien som utsolgt</label>
                    <label>Utsolgt til <input type="datetime-local" data-category-field="soldOutUntil" value="${escapeHtml(toDateTimeLocalValue(section.soldOutUntil || ""))}"></label>
                  </section>
                  <div class="inline-actions">
                    <button type="button" data-category-action="close-edit" data-category-index="${index}">Ferdig</button>
                  </div>
                </div>`
              : ""
          }
          ${
            isActive
              ? `<div class="nested-products product-card-list" data-products-for="${index}">
                  ${products || "<p>Ingen produkter ennå.</p>"}
                  <button class="inline-add-product" type="button" data-add-product-to-category="${index}">Legg til produkt</button>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
  mountProductFormInline();
}


function renderCategoryEditor() {
}

function renderProducts() {
  renderCategories();
}


function normalizeSizeId(label = "", fallback = "") {
  const value = String(label || fallback || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (value.includes("medium") || value === "m") return "medium";
  if (value.includes("stor") || value.includes("large") || value === "st") return "large";
  if (value.includes("xxl")) return "xxl";
  if (value.includes("xl")) return "xl";
  if (value.includes("standard") || value.includes("pris")) return "standard";
  return makeId(label || fallback || `size-${Date.now()}`);
}

function defaultLabelForSize(id = "standard") {
  if (id === "medium") return "Medium";
  if (id === "large") return "Stor";
  if (id === "xxl") return "XXL";
  if (id === "xl") return "XL";
  if (id === "standard") return "Pris";
  return id.toUpperCase();
}

function ensureDefaultPrice(prices) {
  if (!prices.length) return prices;
  const defaultIndex = prices.findIndex((size) => size.default === true);
  return prices.map((size, index) => ({
    ...size,
    default: defaultIndex >= 0 ? index === defaultIndex : index === 0
  }));
}

function getProductPriceList(product) {
  const savedSizes = asArray(product?.sizes)
    .map((size) => ({
      id: size.id ? makeId(size.id) : normalizeSizeId(size.label || size.name, size.id),
      label: size.label || size.name || defaultLabelForSize(size.id),
      price: getNumber(size.price ?? ""),
      default: size.default === true || size.isDefault === true
    }))
    .filter((size) => size.label && size.price !== undefined);
  if (savedSizes.length) return ensureDefaultPrice(savedSizes);

  const prices = [];
  if (product?.mediumPrice !== undefined) prices.push({ id: "medium", label: "Medium", price: product.mediumPrice, default: false });
  if (product?.largePrice !== undefined) prices.push({ id: "large", label: "Stor", price: product.largePrice, default: false });
  if (!prices.length && product?.price !== undefined) prices.push({ id: "standard", label: "Pris", price: product.price, default: true });
  if (!prices.length) prices.push({ id: "standard", label: "Pris", price: undefined, default: true });
  return ensureDefaultPrice(prices);
}


function readProductPriceListFromEditor() {
  const rows = productPriceRows ? [...productPriceRows.querySelectorAll("[data-product-price-row]")] : [];
  const prices = rows
    .map((row, index) => {
      const label = row.querySelector("[data-price-label]")?.value.trim() || "Pris";
      const id = row.dataset.priceId || normalizeSizeId(label, "");
      const price = getNumber(row.querySelector("[data-price-value]")?.value ?? "");
      const isDefault = Boolean(row.querySelector("[data-price-default]")?.checked);
      return { id, label, price, default: isDefault };
    })
    .filter((size) => size.label && size.price !== undefined);

  return ensureDefaultPrice(prices.length ? prices : [{ id: "standard", label: "Pris", price: undefined, default: true }]);
}


function renderProductPrices(product = selectedProduct()) {
  if (!productPriceRows) return;
  const prices = getProductPriceList(product);
  productPriceRows.innerHTML = prices
    .map((size, index) => `
      <div class="product-price-row" data-product-price-row="${index}" data-price-id="${escapeHtml(size.id)}">
        <label>Navn <input data-price-label type="text" value="${escapeHtml(size.label)}" placeholder="Medium / Stor / XXL"></label>
        <label>Pris <input data-price-value type="number" min="0" value="${size.price ?? ""}" placeholder="0"></label>
        <label class="price-default-label">
          <input data-price-default type="radio" name="defaultProductPrice" value="${index}" ${size.default ? "checked" : ""}>
          <span>Forhåndsvalgt</span>
        </label>
        <button type="button" data-remove-product-price="${index}" ${prices.length <= 1 ? "disabled" : ""}>&times;</button>
      </div>
    `)
    .join("");
  productPriceRows.insertAdjacentHTML("beforeend", `<p class="price-help">Velg Forhåndsvalgt for den størrelsen som skal være valgt når kunden åpner produktet.</p>`);
}


function applyPriceCompatibility(productData, prices) {
  const cleanPrices = ensureDefaultPrice(prices.filter((size) => size.price !== undefined));
  const firstPrice = cleanPrices[0]?.price;
  const defaultSize = cleanPrices.find((size) => size.default) || cleanPrices[0];
  const findPrice = (...ids) => cleanPrices.find((size) => ids.includes(size.id))?.price;
  const mediumPrice = findPrice("medium");
  const largePrice = findPrice("large");

  productData.sizes = cleanPrices.length ? cleanPrices : undefined;
  productData.defaultSizeId = defaultSize?.id;
  productData.price = cleanPrices.length === 1 ? firstPrice : undefined;
  productData.mediumPrice = mediumPrice;
  productData.largePrice = largePrice;
  productData.displayPrice = firstPrice;
  return productData;
}


function renderProductEditor() {
  mountProductFormInline();
  const product = selectedProduct();
  const disabled = !product;
  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.disabled = disabled;
  });
  Object.values(productStatusFields).forEach((field) => {
    if (!field) return;
    field.disabled = disabled;
  });
  if (!product) {
    productForm.reset();
    if (productStatusFields.hidden) productStatusFields.hidden.checked = false;
    if (productStatusFields.soldOut) productStatusFields.soldOut.checked = false;
    if (productStatusFields.soldOutUntil) productStatusFields.soldOutUntil.value = "";
    if (productPriceRows) productPriceRows.innerHTML = "";
    renderAssignedGroups();
    return;
  }
  fields.productId.value = product.id || "";
  fields.productName.value = product.name || "";
  if (fields.productNumber) fields.productNumber.value = product.number || "";
  if (fields.productType) fields.productType.value = product.type || "";
  if (fields.productThumb) fields.productThumb.value = product.thumb || "plate";
  fields.productPrice.value = product.price ?? "";
  fields.productMediumPrice.value = product.mediumPrice ?? "";
  fields.productLargePrice.value = product.largePrice ?? "";
  fields.productDisplayPrice.value = product.displayPrice ?? "";
  fields.productImageUrl.value = product.imageUrl || "";
  fields.productIngredients.value = product.ingredients || "";
  if (productStatusFields.hidden) productStatusFields.hidden.checked = product.hidden === true;
  if (productStatusFields.soldOut) productStatusFields.soldOut.checked = product.soldOut === true;
  if (productStatusFields.soldOutUntil) productStatusFields.soldOutUntil.value = toDateTimeLocalValue(product.soldOutUntil || "");
  renderProductPrices(product);
  renderAssignedGroups();
}

function getOptionGroup(groupId) {
  return (config.optionGroups || []).find((group) => group.id === groupId);
}

function uniqueIds(ids) {
  return [...new Set(asArray(ids).filter(Boolean))];
}

function getProductSizeAreas(product = selectedProduct()) {
  const sizes = getProductPriceList(product).filter((size) => size.id && size.price !== undefined);
  return sizes.length > 1 ? sizes : [];
}

function areaLabel(area, sizes = getProductSizeAreas()) {
  if (area === "common") return "Alle størrelser";
  const found = sizes.find((size) => size.id === area);
  return found?.label || defaultLabelForSize(area);
}

function getAssignedGroupIds(product, area = "common") {
  if (!product) return [];
  if (area === "common") return uniqueIds(product.optionGroupIds);
  return uniqueIds(product.optionGroupIdsBySize?.[area]);
}

function removeGroupFromAllAssignedAreas(product, groupId) {
  if (!product || !groupId) return;
  product.optionGroupIds = uniqueIds(product.optionGroupIds).filter((id) => id !== groupId);
  if (product.optionGroupIdsBySize && typeof product.optionGroupIdsBySize === "object") {
    Object.keys(product.optionGroupIdsBySize).forEach((area) => {
      product.optionGroupIdsBySize[area] = uniqueIds(product.optionGroupIdsBySize[area]).filter((id) => id !== groupId);
      if (!product.optionGroupIdsBySize[area].length) delete product.optionGroupIdsBySize[area];
    });
  }
}

function getAssignedGroupEntries(product = selectedProduct()) {
  if (!product) return [];
  const entries = [];
  uniqueIds(product.optionGroupIds).forEach((groupId) => entries.push({ groupId, area: "common" }));
  Object.entries(product.optionGroupIdsBySize || {}).forEach(([area, ids]) => {
    uniqueIds(ids).forEach((groupId) => entries.push({ groupId, area }));
  });
  return entries;
}

function assignedAreaOptions(selectedArea, sizes = getProductSizeAreas()) {
  const options = [{ id: "common", label: "Alle" }, ...sizes.map((size) => ({ id: size.id, label: size.label }))];
  return options
    .map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === selectedArea ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
}

function renderAssignedGroups() {
  if (!assignedGroups) return;
  const product = selectedProduct();
  if (!product) {
    assignedGroups.innerHTML = "<p>Velg et produkt først.</p>";
    return;
  }

  const sizes = getProductSizeAreas(product);
  const entries = getAssignedGroupEntries(product);
  const dropButtons = [{ id: "common", label: "Alle" }, ...sizes.map((size) => ({ id: size.id, label: size.label }))]
    .map((area) => `<button class="assigned-filter-drop" type="button" data-assigned-zone="${escapeHtml(area.id)}">+ ${escapeHtml(area.label)}</button>`)
    .join("");

  const rows = entries.length
    ? entries
        .map(({ groupId, area }) => {
          const group = getOptionGroup(groupId);
          return `
            <div class="assigned-group-row" data-assigned-row="${escapeHtml(groupId)}:${escapeHtml(area)}">
              <strong>${escapeHtml(group?.title || groupId)}</strong>
              <label>
                <span>Vises</span>
                <select data-assigned-visibility data-assigned-group="${escapeHtml(groupId)}" data-assigned-area="${escapeHtml(area)}">
                  ${assignedAreaOptions(area, sizes)}
                </select>
              </label>
              <button class="remove-assigned-group" type="button" data-unassign-group="${escapeHtml(groupId)}" data-unassign-area="${escapeHtml(area)}">Fjern</button>
            </div>
          `;
        })
        .join("")
    : `<p class="assigned-zone-empty">Ingen grupper. Dra en gruppe fra høyre, eller bruk + knappene.</p>`;

  assignedGroups.innerHTML = `
    <div class="assigned-filter-toolbar">
      <span>Dra gruppe hit:</span>
      ${dropButtons}
    </div>
    <div class="assigned-compact-list" data-assigned-zone="common">${rows}</div>
  `;
}

function closeGroupMenus() {
  optionGroupsAdmin?.querySelectorAll("[data-group-menu-panel]").forEach((panel) => {
    panel.hidden = true;
  });
}

function groupMenuButton(groupIndex, isEditing) {
  return `
    <button class="group-menu-button" type="button" data-group-menu="${groupIndex}" aria-label="Gruppevalg">⋮</button>
    <div class="group-menu" data-group-menu-panel="${groupIndex}" hidden>
      <button type="button" data-group-action="${isEditing ? "close-edit" : "edit"}" data-group-index="${groupIndex}">${isEditing ? "Lukk redigering" : "Rediger"}</button>
      <button type="button" data-group-action="assign" data-group-index="${groupIndex}">Legg til på valgt produkt</button>
      <button type="button" data-group-action="copy" data-group-index="${groupIndex}">Kopier gruppe</button>
      <button type="button" data-group-action="delete" data-group-index="${groupIndex}">Slett gruppe</button>
    </div>
  `;
}

function renderGroupEditor(group, groupIndex) {
  return `
    <div class="option-group-editor">
      <div class="option-group-top">
        <label>Gruppenavn <input data-group-field="title" data-group-index="${groupIndex}" value="${escapeHtml(group.title || "")}"></label>
        <label>Type
          <select data-group-field="type" data-group-index="${groupIndex}">
            <option value="multiple" ${group.type !== "single" ? "selected" : ""}>Flere valg</option>
            <option value="single" ${group.type === "single" ? "selected" : ""}>Ett valg</option>
          </select>
        </label>
        <label>Obligatorisk
          <select data-group-field="required" data-group-index="${groupIndex}">
            <option value="false" ${!group.required ? "selected" : ""}>Nei</option>
            <option value="true" ${group.required ? "selected" : ""}>Ja</option>
          </select>
        </label>
      </div>
      <div class="group-options">
        ${asArray(group.options)
          .map((option, optionIndex) => `
            <div class="group-option-row" data-group-option="${groupIndex}:${optionIndex}">
              <label>Navn <input data-group-option-field="label" value="${escapeHtml(option.label || "")}"></label>
              <label>Pris <input data-group-option-field="price" type="number" value="${option.price ?? ""}"></label>
              <label>Valgt
                <select data-group-option-field="default">
                  <option value="false" ${!option.default ? "selected" : ""}>Nei</option>
                  <option value="true" ${option.default ? "selected" : ""}>Ja</option>
                </select>
              </label>
              <button type="button" data-remove-group-option="${groupIndex}:${optionIndex}">&times;</button>
            </div>
          `)
          .join("") || "<p class=\"group-help\">Ingen valg ennå.</p>"}
      </div>
      <div class="group-card-actions">
        <button type="button" data-add-group-option="${groupIndex}">Nytt valg</button>
        <button type="button" data-assign-group="${escapeHtml(group.id)}">Legg til på valgt produkt</button>
      </div>
    </div>
  `;
}

// Sağdaki Valggrupper / tilleggler listesini çizer.
function renderGroupManager() {
  if (!optionGroupsAdmin) return;
  optionGroupsAdmin.innerHTML = (config.optionGroups || [])
    .map((group, groupIndex) => {
      const isEditing = groupIndex === editingGroupIndex;
      const optionCount = asArray(group.options).length;
      return `
        <article class="option-group-card ${isEditing ? "editing" : ""}" draggable="true" data-group-card="${escapeHtml(group.id)}" data-group-index="${groupIndex}">
          <div class="option-group-row">
            <button class="option-group-title" type="button" data-group-action="${isEditing ? "close-edit" : "edit"}" data-group-index="${groupIndex}">
              <strong>${escapeHtml(group.title || "Ny valggruppe")}</strong>
              <span>${optionCount} valg · ${group.type === "single" ? "ett valg" : "flere valg"}${group.required ? " · obligatorisk" : ""}</span>
            </button>
            ${groupMenuButton(groupIndex, isEditing)}
          </div>
          ${isEditing ? renderGroupEditor(group, groupIndex) : ""}
        </article>
      `;
    })
    .join("");
}

function renderOptions() {
  Object.entries(optionContainers).forEach(([key, container]) => {
    if (!container) return;
    container.innerHTML = (config[key] || [])
      .map((option, index) => `
        <div class="option-row" data-option-key="${key}" data-option-index="${index}">
          <input data-option-field="group" value="${option.group || ""}" aria-label="Gruppe">
          <input data-option-field="label" value="${option.label || ""}" aria-label="Navn">
          <input data-option-field="price" type="number" value="${option.price ?? ""}" aria-label="Pris">
          <button type="button" data-remove-option="${key}:${index}">&times;</button>
        </div>
      `)
      .join("");
  });
}


function renderSiteSettings() {
  if (!config) return;
  config.siteSettings = normalizeSiteSettings(config.siteSettings);
  siteSettingFields.forEach((field) => {
    const key = field.dataset.settingField;
    if (!key) return;
    field.value = config.siteSettings[key] ?? "";
  });
  if (adminRestaurantTitle) {
    adminRestaurantTitle.textContent = config.siteSettings.restaurantName || "Meny admin";
  }
}

function updateSiteSettingFromField(field) {
  if (!config || !field?.dataset?.settingField) return;
  config.siteSettings = normalizeSiteSettings(config.siteSettings);
  config.siteSettings[field.dataset.settingField] = field.value.trim();
  scheduleSave();
}

function settingsTitleFor(tabKey = "basic") {
  const labels = {
    basic: ["Grunninfo", "Restaurantens navn, telefon, adresse og enkel informasjon."],
    backup: ["Yedek / gjenoppretting", "Ta full kopi av Firebase-dataen eller gjenopprett fra en tidligere JSON-yedek."]
  };
  return labels[tabKey] || labels.basic;
}

function setSettingsTab(tabKey = "basic") {
  const [title, subtitle] = settingsTitleFor(tabKey);
  if (inlineSettingsTitle) inlineSettingsTitle.textContent = title;
  if (inlineSettingsSubtitle) inlineSettingsSubtitle.textContent = subtitle;
  settingsTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === tabKey);
  });
  settingsPages.forEach((page) => {
    page.classList.toggle("active", page.dataset.settingsPage === tabKey);
  });
  openSettingsButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.openSettings === tabKey);
  });
  topNavButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.topNav === tabKey);
  });
}

function setAdminView(tabKey = "menu") {
  const targetPage = tabKey === "menu" ? "menu" : tabKey === "orders" ? "orders" : "settings";
  adminPages.forEach((page) => {
    page.classList.toggle("active", page.dataset.adminPage === targetPage);
  });
  topNavButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.topNav === tabKey);
  });
  if (targetPage === "settings") setSettingsTab(tabKey);
  if (targetPage === "orders") renderOrdersAdmin();
}

function openSettingsModal(tabKey = "basic") {
  setAdminView(tabKey);
}

function closeSettingsModal() {
  setAdminView("menu");
}


// ============================================================
// SİPARİŞ MODÜLÜ (ADMIN)
// ------------------------------------------------------------
// Müşterinin gönderdiği siparişler Firebase /orders altında tutulur.
// Buradan onaylayınca müşteri ekranı otomatik olarak güncellenir.
// ============================================================
function orderStatusLabel(status = "pending") {
  if (status === "accepted") return "Godkjent";
  if (status === "cancelled") return "Kansellert";
  return "Venter";
}

function formatOrderDate(value) {
  if (!value) return "Ukjent tid";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" });
}

function sanitizeReadyMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 30;
  return Math.min(99, Math.max(1, Math.round(number)));
}

function orderLineHtml(line = {}) {
  const options = [line.sizeLabel, ...(asArray(line.extras))].filter(Boolean).join(" · ");
  return `
    <div class="order-line-row">
      <div>
        <strong>${Number(line.quantity || 1)}x ${escapeHtml(line.name || "Produkt")}</strong>
        ${options ? `<p>${escapeHtml(options)}</p>` : ""}
        ${line.note ? `<p>${escapeHtml(line.note)}</p>` : ""}
      </div>
      <strong>${Number(line.total || 0).toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}</strong>
    </div>
  `;
}

function renderOrdersAdmin() {
  if (!ordersAdminList) return;
  const visibleOrders = adminOrders.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  if (ordersCount) ordersCount.textContent = `${visibleOrders.length} bestillinger`;
  if (!visibleOrders.length) {
    ordersAdminList.innerHTML = `<p class="empty-orders">Ingen bestillinger ennå.</p>`;
    return;
  }

  ordersAdminList.innerHTML = visibleOrders.map((order) => {
    const status = order.status || "pending";
    const customerName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") || "Ukjent kunde";
    const readyMinutes = sanitizeReadyMinutes(order.readyMinutes || 30);
    const lines = asArray(order.items);
    return `
      <article class="order-card ${escapeHtml(status)}" data-order-id="${escapeHtml(order.id)}">
        <div class="order-card-top">
          <div>
            <h2>${escapeHtml(customerName)}</h2>
            <small>${escapeHtml(order.customer?.phone || "Telefon mangler")} · ${formatOrderDate(order.createdAt)}</small>
          </div>
          <span class="order-badge ${escapeHtml(status)}">${orderStatusLabel(status)}</span>
        </div>

        <div class="order-meta-grid">
          <div class="order-meta-box"><strong>Henting</strong><span>${order.pickup?.mode === "later" ? formatOrderDate(order.pickup?.time) : "Snarest mulig"}</span></div>
          <div class="order-meta-box"><strong>Total</strong><span>${Number(order.total || 0).toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}</span></div>
          <div class="order-meta-box"><strong>Ordrenr.</strong><span>${escapeHtml(order.id.slice(-7).toUpperCase())}</span></div>
        </div>

        <div class="order-receipt">
          ${lines.map(orderLineHtml).join("")}
          <div class="order-total-row"><span>Sluttsum</span><strong>${Number(order.total || 0).toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}</strong></div>
        </div>

        ${status === "pending" ? `
          <div class="order-card-actions">
            <label class="order-minutes-control">Klar om
              <input type="number" min="1" max="99" value="${readyMinutes}" data-ready-minutes="${escapeHtml(order.id)}" inputmode="numeric">
              min
            </label>
            <button class="accept-order-button" type="button" data-accept-order="${escapeHtml(order.id)}">Godkjenn</button>
            <button class="cancel-order-button" type="button" data-cancel-order="${escapeHtml(order.id)}">Avvis / kanseller</button>
          </div>
        ` : `
          <p class="order-muted">${status === "accepted" ? `Godkjent ${formatOrderDate(order.acceptedAt)} · Klar om ${readyMinutes} min` : `Kansellert ${formatOrderDate(order.cancelledAt)}`}</p>
        `}
      </article>
    `;
  }).join("");
}

function listenForOrders() {
  if (!ordersRef) return;
  ordersRef.on("value", (snapshot) => {
    const value = snapshot.val() || {};
    adminOrders = Object.entries(value).map(([id, order]) => ({ id, ...(order || {}) }));
    ordersReady = true;
    renderOrdersAdmin();
  }, (error) => {
    console.error(error);
    if (ordersAdminList) ordersAdminList.innerHTML = `<p class="empty-orders">Kunne ikke lese bestillinger.</p>`;
  });
}

async function acceptOrder(orderId, minutes) {
  const readyMinutes = sanitizeReadyMinutes(minutes);
  await ordersRef.child(orderId).update({
    status: "accepted",
    readyMinutes,
    acceptedAt: new Date().toISOString()
  });
  setStatus(`Bestilling godkjent. Klar om ${readyMinutes} min.`);
}

async function cancelOrder(orderId) {
  if (!confirm("Kansellere denne bestillingen?")) return;
  await ordersRef.child(orderId).update({
    status: "cancelled",
    cancelledAt: new Date().toISOString()
  });
  setStatus("Bestilling kansellert.");
}

function renderAll() {
  renderSiteSettings();
  renderCategories();
  renderCategoryEditor();
  renderProducts();
  renderProductEditor();
  renderOptions();
  renderGroupManager();
  renderLocalBackups();
  scrollSelectedProductToTop();
}

function updateCategoryFromFields() {
}

// Oppdater produkt veya Enter basılınca ürünü Firebase’e kaydeder.
function updateProductFromFields() {
  const category = selectedCategory();
  const currentProduct = selectedProduct();
  if (!category || !currentProduct) return;
  const prices = readProductPriceListFromEditor();
  const sizeIds = prices.map((size) => size.id);
  const cleanedBySize = {};
  Object.entries(currentProduct.optionGroupIdsBySize || {}).forEach(([sizeId, ids]) => {
    if (sizeIds.includes(sizeId)) cleanedBySize[sizeId] = uniqueIds(ids);
  });

  const productData = applyPriceCompatibility({
    id: fields.productId.value.trim() || makeId(fields.productName.value),
    number: currentProduct.number,
    name: fields.productName.value.trim(),
    type: currentProduct.type,
    thumb: currentProduct.thumb,
    imageUrl: fields.productImageUrl.value.trim(),
    ingredients: fields.productIngredients.value.trim(),
    hidden: productStatusFields.hidden?.checked === true,
    soldOut: productStatusFields.soldOut?.checked === true,
    soldOutUntil: productStatusFields.soldOutUntil?.value || undefined,
    optionGroupIds: uniqueIds(currentProduct.optionGroupIds),
    optionGroupIdsBySize: Object.keys(cleanedBySize).length ? cleanedBySize : undefined
  }, prices);
  category.items[selectedProductIndex] = cleanObject(productData);
  renderProducts();
  renderAssignedGroups();
}

function addCategory() {
  if (!config) config = createEmptyConfig();
  config.sections = asArray(config.sections);
  config.sections.push({
    id: `kategori-${Date.now()}`,
    title: "NY KATEGORI",
    note: "",
    imageClass: "pizza-strip",
    items: []
  });
  selectedCategoryIndex = config.sections.length - 1;
  selectedProductIndex = 0;
  renderAll();
  writeLiveConfig("Kategori lagt til i Firebase.");
}

function deleteCategory() {
  if (config.sections.length <= 1) {
    setStatus("Du må ha minst én kategori.");
    return;
  }
  if (!confirm("Slette hele kategorien?")) return;
  config.sections.splice(selectedCategoryIndex, 1);
  selectedCategoryIndex = Math.max(0, selectedCategoryIndex - 1);
  selectedProductIndex = 0;
  renderAll();
  writeLiveConfig("Kategori slettet fra Firebase.");
}

function addProduct() {
  const category = selectedCategory();
  if (!category) {
    setStatus("Velg en kategori først.");
    return;
  }
  category.items = asArray(category.items);
  category.items.push({
    id: `produkt-${Date.now()}`,
    name: "",
    ingredients: "",
    thumb: "plate",
    sizes: [{ id: "standard", label: "Pris", price: 0 }],
    price: 0,
    displayPrice: 0
  });
  selectedProductIndex = category.items.length - 1;
  renderAll();
  writeLiveConfig("Produkt lagt til i Firebase.");
}

function deleteProduct() {
  const category = selectedCategory();
  if (!selectedProduct()) return;
  if (!confirm("Slette produktet?")) return;
  category.items.splice(selectedProductIndex, 1);
  selectedProductIndex = Math.max(0, selectedProductIndex - 1);
  renderAll();
  writeLiveConfig("Produkt slettet fra Firebase.");
}

function closeCategoryMenus() {
  categoryButtons.querySelectorAll("[data-category-menu-panel]").forEach((panel) => {
    panel.hidden = true;
  });
}

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

function assignGroupToSelectedProduct(groupId, area = "common") {
  const product = selectedProduct();
  if (!product || !groupId) return;

  // Türkçe not: Bir grup aynı üründe sadece tek yere bağlanır.
  // area = "common" ise bütün boylarda, area = size.id ise sadece o boyda görünür.
  removeGroupFromAllAssignedAreas(product, groupId);

  if (area === "common") {
    product.optionGroupIds = uniqueIds(product.optionGroupIds);
    product.optionGroupIds.push(groupId);
  } else {
    product.optionGroupIdsBySize = product.optionGroupIdsBySize && typeof product.optionGroupIdsBySize === "object" ? product.optionGroupIdsBySize : {};
    product.optionGroupIdsBySize[area] = uniqueIds(product.optionGroupIdsBySize[area]);
    product.optionGroupIdsBySize[area].push(groupId);
  }

  renderAssignedGroups();
  setStatus(`Valggruppe lagt til (${areaLabel(area)}). Klikk Oppdater produkt for å lagre.`);
}

function moveAssignedGroupToArea(groupId, fromArea, toArea) {
  const product = selectedProduct();
  if (!product || !groupId || !toArea) return;
  assignGroupToSelectedProduct(groupId, toArea);
}

function unassignGroupFromSelectedProduct(groupId, area = "common") {
  const product = selectedProduct();
  if (!product || !groupId) return;

  if (area === "common") {
    product.optionGroupIds = uniqueIds(product.optionGroupIds).filter((id) => id !== groupId);
  } else if (product.optionGroupIdsBySize && typeof product.optionGroupIdsBySize === "object") {
    product.optionGroupIdsBySize[area] = uniqueIds(product.optionGroupIdsBySize[area]).filter((id) => id !== groupId);
    if (!product.optionGroupIdsBySize[area].length) delete product.optionGroupIdsBySize[area];
  }

  renderAssignedGroups();
  setStatus("Valggruppe fjernet. Klikk Oppdater produkt for å lagre.");
}

function removeGroupIdFromAllProducts(groupId) {
  config.sections.forEach((section) => {
    section.items.forEach((product) => {
      product.optionGroupIds = asArray(product.optionGroupIds).filter((id) => id !== groupId);
      if (product.optionGroupIdsBySize && typeof product.optionGroupIdsBySize === "object") {
        Object.keys(product.optionGroupIdsBySize).forEach((sizeKey) => {
          product.optionGroupIdsBySize[sizeKey] = asArray(product.optionGroupIdsBySize[sizeKey]).filter((id) => id !== groupId);
        });
      }
    });
  });
}


function duplicateOptionGroup(groupIndex) {
  const source = config.optionGroups[groupIndex];
  if (!source) return;
  const copied = clone(source);
  copied.id = `${source.id || "gruppe"}-copy-${Date.now()}`;
  copied.title = `${source.title || "Valggruppe"} kopi`;
  copied.options = asArray(copied.options).map((option) => ({
    ...option,
    id: `${option.id || "valg"}-copy-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  }));
  config.optionGroups.splice(groupIndex + 1, 0, copied);
  editingGroupIndex = groupIndex + 1;
  renderGroupManager();
  writeLiveConfig("Valggruppe kopiert.");
}

function deleteOptionGroup(groupIndex) {
  const group = config.optionGroups[groupIndex];
  if (!group || !confirm("Slette valggruppen?")) return;
  config.optionGroups.splice(groupIndex, 1);
  removeGroupIdFromAllProducts(group.id);
  if (editingGroupIndex === groupIndex) editingGroupIndex = null;
  else if (editingGroupIndex > groupIndex) editingGroupIndex -= 1;
  renderAll();
  writeLiveConfig("Valggruppe slettet fra Firebase.");
}

function addOptionGroup() {
  if (!config) config = createEmptyConfig();
  config.optionGroups = asArray(config.optionGroups);
  config.optionGroups.push({
    id: `gruppe-${Date.now()}`,
    title: "Ny valggruppe",
    type: "multiple",
    required: false,
    options: []
  });
  editingGroupIndex = config.optionGroups.length - 1;
  renderGroupManager();
  writeLiveConfig("Valggruppe lagt til i Firebase.");
}

categoryButtons.addEventListener("click", (event) => {
  const addProductInline = event.target.closest("[data-add-product-to-category]");
  if (addProductInline) {
    selectedCategoryIndex = Number(addProductInline.dataset.addProductToCategory);
    selectedProductIndex = Math.max(0, (selectedCategory()?.items || []).length - 1);
    addProduct();
    return;
  }

  const menuToggle = event.target.closest("[data-category-menu]");
  if (menuToggle) {
    const panel = categoryButtons.querySelector(`[data-category-menu-panel="${menuToggle.dataset.categoryMenu}"]`);
    if (panel) {
      const shouldOpen = panel.hidden;
      closeCategoryMenus();
      panel.hidden = !shouldOpen;
    }
    return;
  }
  const menuAction = event.target.closest("[data-category-action]");
  if (menuAction) {
    selectedCategoryIndex = Number(menuAction.dataset.categoryIndex);
    selectedProductIndex = null;
    if (menuAction.dataset.categoryAction === "delete") deleteCategory();
    else if (menuAction.dataset.categoryAction === "edit") {
      editingCategoryIndex = selectedCategoryIndex;
      renderAll();
    } else if (menuAction.dataset.categoryAction === "close-edit") {
      editingCategoryIndex = null;
      renderAll();
    }
    else renderAll();
    return;
  }
  const productPick = event.target.closest("[data-category-product]");
  if (productPick) {
    const [categoryIndex, productIndex] = productPick.dataset.categoryProduct.split(":").map(Number);
    const wasOpen = selectedCategoryIndex === categoryIndex && selectedProductIndex === productIndex;
    selectedCategoryIndex = categoryIndex;
    selectedProductIndex = wasOpen ? null : productIndex;
    pendingScrollToProduct = !wasOpen;
    renderAll();
    return;
  }
  const categoryPick = event.target.closest("[data-category]");
  if (!categoryPick) return;
  closeCategoryMenus();
  const categoryIndex = Number(categoryPick.dataset.category);
  const wasOpen = selectedCategoryIndex === categoryIndex;
  selectedCategoryIndex = wasOpen ? null : categoryIndex;
  selectedProductIndex = null;
  renderAll();
});

function updateInlineCategoryField(event) {
  const field = event.target.dataset.categoryField;
  const editor = event.target.closest("[data-inline-category]");
  if (!field || !editor) return;
  const category = config.sections[Number(editor.dataset.inlineCategory)];
  if (!category) return;
  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value.trim();
  category[field] = value;
  if (field === "title" && !category.id) category.id = makeId(event.target.value);
  scheduleSave();
}

categoryButtons.addEventListener("input", updateInlineCategoryField);
categoryButtons.addEventListener("change", updateInlineCategoryField);

categoryButtons.addEventListener("dragstart", (event) => {
  const product = event.target.closest("[data-product-drag]");
  if (product) {
    draggedProductIndex = Number(product.dataset.productDrag);
    event.dataTransfer.effectAllowed = "move";
    product.classList.add("dragging");
    return;
  }

  const category = event.target.closest("[data-category-drag]");
  if (category) {
    draggedCategoryIndex = Number(category.dataset.categoryDrag);
    event.dataTransfer.effectAllowed = "move";
    category.classList.add("dragging");
  }
});

categoryButtons.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-category-drag], [data-product-drag]")) event.preventDefault();
});

categoryButtons.addEventListener("drop", (event) => {
  event.preventDefault();
  const productTarget = event.target.closest("[data-product-drag]");
  if (draggedProductIndex !== null && productTarget) {
    const toIndex = Number(productTarget.dataset.productDrag);
    const items = selectedCategory()?.items || [];
    moveItem(items, draggedProductIndex, toIndex);
    selectedProductIndex = toIndex;
    draggedProductIndex = null;
    renderAll();
    writeLiveConfig("Produktrekkefølge lagret.");
    return;
  }

  const categoryTarget = event.target.closest("[data-category-drag]");
  if (draggedCategoryIndex !== null && categoryTarget) {
    const toIndex = Number(categoryTarget.dataset.categoryDrag);
    moveItem(config.sections, draggedCategoryIndex, toIndex);
    selectedCategoryIndex = toIndex;
    selectedProductIndex = 0;
    draggedCategoryIndex = null;
    renderAll();
    writeLiveConfig("Kategorirekkefølge lagret.");
  }
});

categoryButtons.addEventListener("dragend", () => {
  draggedCategoryIndex = null;
  draggedProductIndex = null;
  categoryButtons.querySelectorAll(".dragging").forEach((element) => element.classList.remove("dragging"));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-category-menu], [data-category-menu-panel]")) closeCategoryMenus();
  if (!event.target.closest("[data-group-menu], [data-group-menu-panel]")) closeGroupMenus();
});

if (assignedGroups) {
  assignedGroups.addEventListener("click", (event) => {
    const groupId = event.target.dataset.unassignGroup;
    if (!groupId) return;
    unassignGroupFromSelectedProduct(groupId, event.target.dataset.unassignArea || "common");
  });

  assignedGroups.addEventListener("change", (event) => {
    const select = event.target.closest("[data-assigned-visibility]");
    if (!select) return;
    moveAssignedGroupToArea(select.dataset.assignedGroup, select.dataset.assignedArea || "common", select.value || "common");
  });

  assignedGroups.addEventListener("dragover", (event) => {
    if (!draggedGroupId) return;
    const zone = event.target.closest("[data-assigned-zone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("drag-over");
  });

  assignedGroups.addEventListener("dragleave", (event) => {
    const zone = event.target.closest("[data-assigned-zone]");
    if (zone) zone.classList.remove("drag-over");
  });

  assignedGroups.addEventListener("drop", (event) => {
    const zone = event.target.closest("[data-assigned-zone]");
    if (!zone || !draggedGroupId) return;
    event.preventDefault();
    zone.classList.remove("drag-over");
    assignGroupToSelectedProduct(draggedGroupId, zone.dataset.assignedZone || "common");
    draggedGroupId = null;
    renderGroupManager();
  });
}

if (optionGroupsAdmin) {
  optionGroupsAdmin.addEventListener("input", (event) => {
    const groupField = event.target.dataset.groupField;
    if (groupField) {
      const group = config.optionGroups[Number(event.target.dataset.groupIndex)];
      if (!group) return;
      if (groupField === "title") {
        group.title = event.target.value;
      } else if (groupField === "type") {
        group.type = event.target.value;
      } else if (groupField === "required") {
        group.required = event.target.value === "true";
      }
      scheduleSave();
      return;
    }

    const optionRow = event.target.closest("[data-group-option]");
    const optionField = event.target.dataset.groupOptionField;
    if (!optionRow || !optionField) return;
    const [groupIndex, optionIndex] = optionRow.dataset.groupOption.split(":").map(Number);
    const option = config.optionGroups[groupIndex]?.options?.[optionIndex];
    if (!option) return;
    if (optionField === "price") option.price = getNumber(event.target.value) || 0;
    else if (optionField === "default") option.default = event.target.value === "true";
    else {
      option[optionField] = event.target.value;
      if (!option.id || option.id.startsWith("valg-")) option.id = `${config.optionGroups[groupIndex].id}-${makeId(event.target.value)}`;
    }
    scheduleSave();
  });

  optionGroupsAdmin.addEventListener("change", (event) => {
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  optionGroupsAdmin.addEventListener("click", (event) => {
    const menuToggle = event.target.closest("[data-group-menu]");
    if (menuToggle) {
      const panel = optionGroupsAdmin.querySelector(`[data-group-menu-panel="${menuToggle.dataset.groupMenu}"]`);
      if (panel) {
        const shouldOpen = panel.hidden;
        closeGroupMenus();
        panel.hidden = !shouldOpen;
      }
      return;
    }

    const groupAction = event.target.closest("[data-group-action]");
    if (groupAction) {
      const groupIndex = Number(groupAction.dataset.groupIndex);
      const group = config.optionGroups[groupIndex];
      if (!group) return;
      closeGroupMenus();
      if (groupAction.dataset.groupAction === "edit") {
        editingGroupIndex = groupIndex;
        renderGroupManager();
      } else if (groupAction.dataset.groupAction === "close-edit") {
        editingGroupIndex = null;
        renderGroupManager();
      } else if (groupAction.dataset.groupAction === "assign") {
        assignGroupToSelectedProduct(group.id);
        writeLiveConfig("Valggruppe lagt til på produktet.");
      } else if (groupAction.dataset.groupAction === "copy") {
        duplicateOptionGroup(groupIndex);
      } else if (groupAction.dataset.groupAction === "delete") {
        deleteOptionGroup(groupIndex);
      }
      return;
    }

    const assignGroupId = event.target.dataset.assignGroup;
    if (assignGroupId) {
      assignGroupToSelectedProduct(assignGroupId);
      writeLiveConfig("Valggruppe lagt til på produktet.");
      return;
    }

    const addOptionIndex = event.target.dataset.addGroupOption;
    if (addOptionIndex !== undefined) {
      const group = config.optionGroups[Number(addOptionIndex)];
      if (!group) return;
      group.options = asArray(group.options);
      group.options.push({ id: `valg-${Date.now()}`, label: "Nytt valg", price: 0 });
      editingGroupIndex = Number(addOptionIndex);
      renderGroupManager();
      writeLiveConfig("Valg lagt til i gruppen.");
      return;
    }

    const removeOption = event.target.dataset.removeGroupOption;
    if (removeOption) {
      const [groupIndex, optionIndex] = removeOption.split(":").map(Number);
      config.optionGroups[groupIndex].options.splice(optionIndex, 1);
      editingGroupIndex = groupIndex;
      renderGroupManager();
      writeLiveConfig("Valg slettet fra gruppen.");
    }
  });

  optionGroupsAdmin.addEventListener("dragstart", (event) => {
    if (event.target.closest("input, select, textarea, [data-group-menu], [data-group-menu-panel]")) return;
    const groupCard = event.target.closest("[data-group-card]");
    if (!groupCard) return;
    draggedGroupId = groupCard.dataset.groupCard;
    draggedGroupIndex = Number(groupCard.dataset.groupIndex);
    event.dataTransfer.effectAllowed = "copyMove";
    groupCard.classList.add("dragging");
  });

  optionGroupsAdmin.addEventListener("dragover", (event) => {
    if (!draggedGroupId) return;
    const target = event.target.closest("[data-group-card]");
    if (target) event.preventDefault();
  });

  optionGroupsAdmin.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-group-card]");
    if (!target || draggedGroupIndex === null) return;
    event.preventDefault();
    const toIndex = Number(target.dataset.groupIndex);
    if (Number.isFinite(toIndex) && toIndex !== draggedGroupIndex) {
      moveItem(config.optionGroups, draggedGroupIndex, toIndex);
      editingGroupIndex = toIndex;
      renderGroupManager();
      writeLiveConfig("Valggrupperekkefølge lagret.");
    }
    draggedGroupId = null;
    draggedGroupIndex = null;
  });

  optionGroupsAdmin.addEventListener("dragend", () => {
    draggedGroupId = null;
    draggedGroupIndex = null;
    optionGroupsAdmin.querySelectorAll(".dragging").forEach((element) => element.classList.remove("dragging"));
    assignedGroups?.classList.remove("drag-over");
  });
}

if (productButtons) {
  productButtons.addEventListener("click", (event) => {
    const index = event.target.dataset.product;
    if (index === undefined) return;
    selectedProductIndex = Number(index);
    renderProducts();
    renderProductEditor();
  });
}

siteSettingFields.forEach((field) => {
  field.addEventListener("input", () => updateSiteSettingFromField(field));
  field.addEventListener("change", () => updateSiteSettingFromField(field));
});

settingsTabs.forEach((button) => {
  button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab || "basic"));
});

topNavButtons.forEach((button) => {
  button.addEventListener("click", () => setAdminView(button.dataset.topNav || "menu"));
});

openSettingsButtons.forEach((button) => {
  button.addEventListener("click", () => setAdminView(button.dataset.openSettings || "basic"));
});

closeSettingsButtons.forEach((button) => {
  button.addEventListener("click", closeSettingsModal);
});

if (refreshOrdersButton) refreshOrdersButton.addEventListener("click", renderOrdersAdmin);
if (ordersAdminList) {
  ordersAdminList.addEventListener("click", async (event) => {
    const acceptId = event.target.dataset.acceptOrder;
    if (acceptId) {
      const input = ordersAdminList.querySelector(`[data-ready-minutes="${CSS.escape(acceptId)}"]`);
      await acceptOrder(acceptId, input?.value || 30);
      return;
    }
    const cancelId = event.target.dataset.cancelOrder;
    if (cancelId) await cancelOrder(cancelId);
  });

  ordersAdminList.addEventListener("input", (event) => {
    if (!event.target.dataset.readyMinutes) return;
    event.target.value = String(sanitizeReadyMinutes(event.target.value || 1)).padStart(1, "0");
  });
}


if (downloadBackupButton) {
  downloadBackupButton.addEventListener("click", downloadFullBackup);
}

if (saveLocalBackupButton) {
  saveLocalBackupButton.addEventListener("click", () => saveCurrentLocalBackup("manual-local"));
}

if (restoreBackupFile) {
  restoreBackupFile.addEventListener("change", async () => {
    const file = restoreBackupFile.files?.[0];
    pendingRestoreData = null;
    if (restoreBackupNowButton) restoreBackupNowButton.disabled = true;
    if (!file) {
      if (restoreBackupPreview) restoreBackupPreview.textContent = "Ingen fil valgt.";
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = extractBackupData(parsed);
      if (!data) throw new Error("Ugyldig yedekfil");
      pendingRestoreData = data;
      previewRestoreData(data, file.name);
      if (restoreBackupNowButton) restoreBackupNowButton.disabled = false;
    } catch (error) {
      console.error(error);
      if (restoreBackupPreview) restoreBackupPreview.textContent = "Kunne ikke lese filen. Velg en gyldig JSON-yedek.";
    }
  });
}

if (restoreBackupNowButton) {
  restoreBackupNowButton.addEventListener("click", () => restoreDataToFirebase(pendingRestoreData, "file-restore"));
}

if (localBackupList) {
  localBackupList.addEventListener("click", (event) => {
    const backups = getLocalBackups();
    const downloadIndex = event.target.dataset.downloadLocalBackup;
    const restoreIndex = event.target.dataset.restoreLocalBackup;
    const deleteIndex = event.target.dataset.deleteLocalBackup;

    if (downloadIndex !== undefined) {
      const backup = backups[Number(downloadIndex)];
      if (!backup) return;
      downloadTextFile(`kol-menu-lokal-yedek-${backupDateStamp()}.json`, JSON.stringify(backup, null, 2));
      return;
    }

    if (restoreIndex !== undefined) {
      const backup = backups[Number(restoreIndex)];
      const data = extractBackupData(backup);
      restoreDataToFirebase(data, "local-restore");
      return;
    }

    if (deleteIndex !== undefined) {
      if (!confirm("Slette denne lokale yedeken?")) return;
      backups.splice(Number(deleteIndex), 1);
      setLocalBackups(backups);
      renderLocalBackups();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal && !settingsModal.hidden) closeSettingsModal();
});

[
  fields.productId,
  fields.productNumber,
  fields.productName,
  fields.productType,
  fields.productThumb,
  fields.productPrice,
  fields.productMediumPrice,
  fields.productLargePrice,
  fields.productDisplayPrice,
  fields.productImageUrl,
  fields.productIngredients
].filter(Boolean).forEach((field) => {
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.tagName === "TEXTAREA") return;
    event.preventDefault();
    productForm.requestSubmit();
  });
});

if (productPriceRows) {
  productPriceRows.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    productForm.requestSubmit();
  });
  productPriceRows.addEventListener("click", (event) => {
    const removeIndex = event.target.dataset.removeProductPrice;
    if (removeIndex === undefined) return;
    const prices = readProductPriceListFromEditor();
    if (prices.length <= 1) return;
    prices.splice(Number(removeIndex), 1);
    renderProductPrices({ sizes: prices });
    renderAssignedGroups();
    setStatus("Pris fjernet. Klikk Oppdater produkt for å lagre.");
  });
}

if (addProductPriceButton) {
  addProductPriceButton.addEventListener("click", () => {
    const prices = readProductPriceListFromEditor();
    const nextLabel = prices.some((size) => size.id === "large") ? "XXL" : "Stor";
    prices.push({ id: normalizeSizeId(nextLabel), label: nextLabel, price: 0 });
    renderProductPrices({ sizes: prices });
    renderAssignedGroups();
    setStatus("Ny pris lagt til. Klikk Oppdater produkt for å lagre.");
  });
}


// Türkçe not: Input'a tıklayınca içindeki yazı seçilir. Böylece silmeden direkt yeni değer yazabilirsin.
document.addEventListener("focusin", (event) => {
  const field = event.target;
  if (!field.matches("input[type='text'], input[type='number'], input[type='url'], input[type='email'], input:not([type]), textarea")) return;
  window.setTimeout(() => {
    try { field.select(); } catch (error) {}
  }, 0);
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProductFromFields();
  writeLiveConfig("Produkt lagret i Firebase.");
});

document.querySelector("#addCategory").addEventListener("click", addCategory);
const addCategoryBottomButton = document.querySelector("#addCategoryBottom");
if (addCategoryBottomButton) addCategoryBottomButton.addEventListener("click", addCategory);
const deleteCategoryButton = document.querySelector("#deleteCategory");
if (deleteCategoryButton) deleteCategoryButton.addEventListener("click", deleteCategory);
document.querySelector("#addProduct").addEventListener("click", addProduct);
if (addOptionGroupButton) addOptionGroupButton.addEventListener("click", addOptionGroup);
document.querySelector("#deleteProduct").addEventListener("click", deleteProduct);
document.querySelector("#reloadData").addEventListener("click", loadData);
document.querySelector("#saveData").addEventListener("click", saveData);

const extrasPanel = document.querySelector(".extras-panel");
if (extrasPanel) {
  extrasPanel.addEventListener("input", (event) => {
    const row = event.target.closest(".option-row");
    if (!row) return;
    const option = config[row.dataset.optionKey][Number(row.dataset.optionIndex)];
    const field = event.target.dataset.optionField;
    option[field] = field === "price" ? getNumber(event.target.value) || 0 : event.target.value;
    scheduleSave();
  });

  extrasPanel.addEventListener("click", (event) => {
    const addKey = event.target.dataset.addOption;
    if (addKey) {
      config[addKey].push({ id: `${addKey}-${Date.now()}`, group: "Tillegg", label: "Nytt valg", price: 0 });
      renderOptions();
      writeLiveConfig("Valg lagt til i Firebase.");
      return;
    }
    const remove = event.target.dataset.removeOption;
    if (!remove) return;
    const [key, index] = remove.split(":");
    config[key].splice(Number(index), 1);
    renderOptions();
    writeLiveConfig("Valg slettet fra Firebase.");
  });
}

function startRealtimeSync() {
  setStatus("Kobler til Firebase...");
  menuRef.on(
    "value",
    async (snapshot) => {
      const value = snapshot.val();

      if (!hasValidConfig(value)) {
        // TÜRKÇE: Firebase boşsa otomatik test menüsü basmıyoruz.
        // Sadece boş panel açıyoruz; sen kategori ekleyince ilk kayıt Firebase'e yazılır.
        config = createEmptyConfig();
        selectedCategoryIndex = null;
        selectedProductIndex = null;
        firebaseReady = true;
        if (!isEditingField()) renderAll();
        setStatus("Firebase er tom. Klar til å lage ny meny uten menu-data.js.");
        return;
      }

      config = normalizeConfig(value);
      if (selectedCategoryIndex !== null && selectedCategoryIndex >= config.sections.length) selectedCategoryIndex = null;
      if (!selectedCategory()) selectedProductIndex = null;
      else if (selectedProductIndex !== null && selectedProductIndex >= asArray(selectedCategory()?.items).length) selectedProductIndex = null;
      firebaseReady = true;
      if (!isEditingField()) renderAll();
      setStatus("Koblet til Firebase. Endringer lagres automatisk.");
    },
    (error) => {
      setStatus("Kunne ikke koble til Firebase.");
      console.error(error);
    }
  );
}

startRealtimeSync();
listenForOrders();
