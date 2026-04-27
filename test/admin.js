const firebaseDatabaseUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/";
const firebaseMenuUrl = `${firebaseDatabaseUrl}.json`;
firebase.initializeApp({ databaseURL: firebaseDatabaseUrl });
const menuRef = firebase.database().ref("/");

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
let selectedCategoryIndex = 0;
let selectedProductIndex = 0;
let editingCategoryIndex = null;
let draggedCategoryIndex = null;
let draggedProductIndex = null;
let draggedGroupId = null;
let saveTimer = null;
let firebaseReady = false;
let toastTimer = null;

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

function defaultOptionGroups() {
  return [
    {
      id: "pizza-fries",
      title: "Pommes frites på pizzaen?",
      type: "multiple",
      options: [{ id: "fries", label: "Ja, takk!", priceBySize: { medium: 29, large: 39 } }]
    },
    {
      id: "pizza-extra-base",
      title: "Extra bunn - 300g deig?",
      type: "multiple",
      options: [{ id: "extra-base", label: "Ja, takk!", price: 49, sizes: ["large"] }]
    },
    {
      id: "pizza-sauce",
      title: "Velg saus",
      type: "multiple",
      options: [
        { id: "garlic", label: "Hvitløksaus", price: 25 },
        { id: "bearnaise", label: "Béarnaisesaus", price: 25 }
      ]
    },
    {
      id: "custom-pizza-toppings",
      title: "Tillegg",
      type: "multiple",
      options: [
        { id: "topping-beef", label: "Biffkjøtt", price: 30 },
        { id: "topping-chicken", label: "Kyllingkjøtt", price: 30 },
        { id: "topping-kebab", label: "Kebabkjøtt", price: 30 },
        { id: "topping-bacon", label: "Bacon", price: 30 },
        { id: "topping-ham", label: "Skinke", price: 25 },
        { id: "topping-pepperoni", label: "Pepperoni", price: 30 },
        { id: "topping-parma", label: "Parmaskinke", price: 40 },
        { id: "topping-jalapeno", label: "Jalapeno", price: 20 },
        { id: "topping-paprika", label: "Paprika", price: 20 },
        { id: "topping-mushroom", label: "Sopp", price: 20 },
        { id: "topping-onion", label: "Løk", price: 20 },
        { id: "topping-corn", label: "Mais", price: 20 },
        { id: "topping-extra-cheese", label: "Extra ost", price: 25 },
        { id: "topping-chips", label: "Chips på toppen", price: 35 }
      ]
    },
    {
      id: "kebab-strength",
      title: "Velg styrke",
      type: "single",
      required: true,
      options: [
        { id: "strength-mild", label: "Mild 🌿", price: 0, default: true },
        { id: "strength-medium", label: "Medium 🌶️", price: 0 },
        { id: "strength-hot", label: "Sterk 🔥", price: 0 }
      ]
    },
    {
      id: "extra-kebab-meat",
      title: "Ekstra kjøtt",
      type: "multiple",
      options: [{ id: "extra-meat", label: "Ekstra Kebabkjøtt", price: 30 }]
    },
    {
      id: "kebab-fries",
      title: "Litt pommes frites i kebaben?",
      type: "multiple",
      options: [{ id: "fries-kebab", label: "Ja, takk!", price: 15 }]
    }
  ];
}

function defaultGroupIdsForProduct(product, section) {
  if (!product || product.type === "sauce") return [];
  if (product.type === "kebab-pita" || product.type === "kebab-wrap") {
    return ["kebab-strength", "extra-kebab-meat", "kebab-fries"];
  }
  if (product.type === "kebab-plate") return ["kebab-strength", "extra-kebab-meat"];
  if (section?.id === "pizza") {
    if (product.id === "lag-din-egen") return ["custom-pizza-toppings", "pizza-extra-base", "pizza-sauce"];
    return ["pizza-fries", "pizza-extra-base", "pizza-sauce"];
  }
  return [];
}

function normalizeOptionGroups(value) {
  const groups = asArray(value?.optionGroups);
  const source = groups.length ? groups : defaultOptionGroups();
  return source.map((group) => ({
    ...group,
    type: group.type === "single" ? "single" : "multiple",
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
    optionGroups: normalizeOptionGroups(value)
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

async function loadDefaultConfig() {
  if (window.DEFAULT_MENU_CONFIG) return clone(window.DEFAULT_MENU_CONFIG);
  const response = await fetch(`app.js?ts=${Date.now()}`, { cache: "no-store" });
  const source = await response.text();
  return {
    sections: Function(`return ${extractArrayFromScript(source, "menuSections")}`)(),
    extraOptions: Function(`return ${extractArrayFromScript(source, "extraOptions")}`)(),
    customPizzaToppings: Function(`return ${extractArrayFromScript(source, "customPizzaToppings")}`)(),
    kebabPitaOptions: Function(`return ${extractArrayFromScript(source, "kebabPitaOptions")}`)(),
    optionGroups: defaultOptionGroups()
  };
}

async function loadData() {
  setStatus("Synkroniserer med Firebase...");
  const snapshot = await menuRef.once("value");
  const value = snapshot.val();
  if (hasValidConfig(value)) {
    config = normalizeConfig(value);
    selectedCategoryIndex = Math.min(selectedCategoryIndex, Math.max(0, config.sections.length - 1));
    selectedProductIndex = Math.min(selectedProductIndex, Math.max(0, (selectedCategory()?.items || []).length - 1));
    renderAll();
    setStatus("Synkronisert med Firebase.");
  }
}

async function saveData() {
  await writeLiveConfig("Lagret til Firebase.");
}

async function writeLiveConfig(message = "Lagret automatisk til Firebase.") {
  if (!config) return;
  try {
    setStatus("Lagrer til Firebase...");
    await menuRef.set(normalizeConfig(config));
    setStatus(message);
  } catch (error) {
    setStatus("Kunne ikke lagre. Sjekk Firebase-regler.");
    console.error(error);
  }
}

function scheduleSave() {
  if (!firebaseReady || !config) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => writeLiveConfig(), 550);
}

function selectedCategory() {
  return config.sections[selectedCategoryIndex];
}

function selectedProduct() {
  return selectedCategory()?.items[selectedProductIndex];
}

function renderCategories() {
  categoryButtons.innerHTML = config.sections
    .map((section, index) => {
      const isActive = index === selectedCategoryIndex;
      const isEditing = index === editingCategoryIndex;
      const products = (section.items || [])
        .map((product, productIndex) => `
          <button class="nested-product-choice ${isActive && productIndex === selectedProductIndex ? "active" : ""}" type="button" draggable="true" data-category-product="${index}:${productIndex}" data-product-drag="${productIndex}">
            ${product.number ? `${product.number}- ` : ""}${product.name || product.id}
          </button>
        `)
        .join("");
      return `
        <article class="category-card ${isActive ? "active" : ""}" draggable="true" data-category-drag="${index}">
          <div class="category-choice-row">
            <button class="category-choice" type="button" data-category="${index}">
              <span>${section.title || section.id}</span>
              <span>${isActive ? "⌃" : "⌄"}</span>
            </button>
            <button class="category-menu-button" type="button" data-category-menu="${index}" aria-label="Kategori valg">⋮</button>
            ${
              isActive
                ? `<div class="category-menu" data-category-menu-panel="${index}" hidden>
                    <button type="button" data-category-action="edit" data-category-index="${index}">Rediger kategori</button>
                    <button type="button" data-category-action="delete" data-category-index="${index}">Slett kategori</button>
                  </div>`
                : ""
            }
          </div>
          ${
            isEditing
              ? `<div class="inline-category-editor" data-inline-category="${index}">
                  <label>Navn <input data-category-field="title" value="${escapeHtml(section.title || "")}"></label>
                  <label>Beskrivelse <textarea data-category-field="note" rows="2">${escapeHtml(section.note || "")}</textarea></label>
                  <label>Bilde URL <input data-category-field="imageUrl" value="${escapeHtml(section.imageUrl || "")}" placeholder="https://..."></label>
                  <div class="inline-actions">
                    <button type="button" data-category-action="close-edit" data-category-index="${index}">Ferdig</button>
                  </div>
                </div>`
              : ""
          }
          ${isActive ? `<div class="nested-products" data-products-for="${index}">${products || "<p>Ingen produkter ennå.</p>"}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderCategoryEditor() {
}

function renderProducts() {
  renderCategories();
}

function renderProductEditor() {
  const product = selectedProduct();
  const disabled = !product;
  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.disabled = disabled;
  });
  if (!product) {
    productForm.reset();
    renderAssignedGroups();
    return;
  }
  fields.productId.value = product.id || "";
  fields.productNumber.value = product.number || "";
  fields.productName.value = product.name || "";
  fields.productType.value = product.type || "";
  fields.productThumb.value = product.thumb || "plate";
  fields.productPrice.value = product.price ?? "";
  fields.productMediumPrice.value = product.mediumPrice ?? "";
  fields.productLargePrice.value = product.largePrice ?? "";
  fields.productDisplayPrice.value = product.displayPrice ?? "";
  fields.productImageUrl.value = product.imageUrl || "";
  fields.productIngredients.value = product.ingredients || "";
  renderAssignedGroups();
}

function getOptionGroup(groupId) {
  return (config.optionGroups || []).find((group) => group.id === groupId);
}

function renderAssignedGroups() {
  if (!assignedGroups) return;
  const product = selectedProduct();
  if (!product) {
    assignedGroups.innerHTML = "<p>Velg et produkt først.</p>";
    return;
  }
  const groupIds = asArray(product.optionGroupIds);
  assignedGroups.innerHTML = groupIds.length
    ? groupIds
        .map((groupId) => {
          const group = getOptionGroup(groupId);
          return `
            <div class="assigned-group-chip">
              <span>${escapeHtml(group?.title || groupId)}</span>
              <button class="remove-assigned-group" type="button" data-unassign-group="${escapeHtml(groupId)}">Fjern</button>
            </div>
          `;
        })
        .join("")
    : "<p>Ingen valggrupper på dette produktet.</p>";
}

function renderGroupManager() {
  if (!optionGroupsAdmin) return;
  optionGroupsAdmin.innerHTML = (config.optionGroups || [])
    .map((group, groupIndex) => `
      <article class="option-group-card" draggable="true" data-group-card="${escapeHtml(group.id)}">
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
          <button type="button" data-add-group-option="${groupIndex}">Nytt valg</button>
        </div>
        <div class="group-options">
          ${asArray(group.options)
            .map((option, optionIndex) => `
              <div class="group-option-row" data-group-option="${groupIndex}:${optionIndex}">
                <label>Navn <input data-group-option-field="label" value="${escapeHtml(option.label || "")}"></label>
                <label>Pris <input data-group-option-field="price" type="number" value="${option.price ?? ""}"></label>
                <label>Forhåndsvalgt
                  <select data-group-option-field="default">
                    <option value="false" ${!option.default ? "selected" : ""}>Nei</option>
                    <option value="true" ${option.default ? "selected" : ""}>Ja</option>
                  </select>
                </label>
                <button type="button" data-remove-group-option="${groupIndex}:${optionIndex}">&times;</button>
              </div>
            `)
            .join("")}
        </div>
        <div class="group-card-actions">
          <button type="button" data-assign-group="${escapeHtml(group.id)}">Legg til på valgt produkt</button>
          <button class="danger-light" type="button" data-delete-group="${groupIndex}">Slett gruppe</button>
        </div>
      </article>
    `)
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

function renderAll() {
  renderCategories();
  renderCategoryEditor();
  renderProducts();
  renderProductEditor();
  renderOptions();
  renderGroupManager();
}

function updateCategoryFromFields() {
}

function updateProductFromFields() {
  const category = selectedCategory();
  const currentProduct = selectedProduct();
  if (!category || !currentProduct) return;
  category.items[selectedProductIndex] = cleanObject({
    id: fields.productId.value.trim() || makeId(fields.productName.value),
    number: getNumber(fields.productNumber.value),
    name: fields.productName.value.trim(),
    type: fields.productType.value,
    thumb: fields.productThumb.value,
    price: getNumber(fields.productPrice.value),
    mediumPrice: getNumber(fields.productMediumPrice.value),
    largePrice: getNumber(fields.productLargePrice.value),
    displayPrice: getNumber(fields.productDisplayPrice.value),
    imageUrl: fields.productImageUrl.value.trim(),
    ingredients: fields.productIngredients.value.trim(),
    optionGroupIds: asArray(currentProduct.optionGroupIds)
  });
  renderProducts();
  renderAssignedGroups();
  scheduleSave();
}

function addCategory() {
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
  category.items.push({
    id: `produkt-${Date.now()}`,
    name: "",
    ingredients: "",
    thumb: "plate"
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

function assignGroupToSelectedProduct(groupId) {
  const product = selectedProduct();
  if (!product || !groupId) return;
  product.optionGroupIds = asArray(product.optionGroupIds);
  if (!product.optionGroupIds.includes(groupId)) product.optionGroupIds.push(groupId);
  renderAssignedGroups();
  scheduleSave();
}

function unassignGroupFromSelectedProduct(groupId) {
  const product = selectedProduct();
  if (!product || !groupId) return;
  product.optionGroupIds = asArray(product.optionGroupIds).filter((id) => id !== groupId);
  renderAssignedGroups();
  scheduleSave();
}

function addOptionGroup() {
  config.optionGroups.push({
    id: `gruppe-${Date.now()}`,
    title: "",
    type: "multiple",
    required: false,
    options: []
  });
  renderGroupManager();
  writeLiveConfig("Valggruppe lagt til i Firebase.");
}

categoryButtons.addEventListener("click", (event) => {
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
    selectedProductIndex = 0;
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
    selectedCategoryIndex = categoryIndex;
    selectedProductIndex = productIndex;
    renderAll();
    return;
  }
  const index = event.target.dataset.category;
  if (index === undefined) return;
  closeCategoryMenus();
  selectedCategoryIndex = Number(index);
  selectedProductIndex = 0;
  renderAll();
});

categoryButtons.addEventListener("input", (event) => {
  const field = event.target.dataset.categoryField;
  const editor = event.target.closest("[data-inline-category]");
  if (!field || !editor) return;
  const category = config.sections[Number(editor.dataset.inlineCategory)];
  if (!category) return;
  category[field] = event.target.value.trim();
  if (field === "title" && !category.id) category.id = makeId(event.target.value);
  scheduleSave();
});

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
});

if (assignedGroups) {
  assignedGroups.addEventListener("click", (event) => {
    const groupId = event.target.dataset.unassignGroup;
    if (!groupId) return;
    unassignGroupFromSelectedProduct(groupId);
    writeLiveConfig("Valggruppe fjernet fra produktet.");
  });

  assignedGroups.addEventListener("dragover", (event) => {
    if (!draggedGroupId) return;
    event.preventDefault();
    assignedGroups.classList.add("drag-over");
  });

  assignedGroups.addEventListener("dragleave", () => {
    assignedGroups.classList.remove("drag-over");
  });

  assignedGroups.addEventListener("drop", (event) => {
    event.preventDefault();
    assignedGroups.classList.remove("drag-over");
    if (!draggedGroupId) return;
    assignGroupToSelectedProduct(draggedGroupId);
    draggedGroupId = null;
    renderGroupManager();
    writeLiveConfig("Valggruppe lagt til på produktet.");
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
      group.options.push({ id: `valg-${Date.now()}`, label: "", price: 0 });
      renderGroupManager();
      writeLiveConfig("Valg lagt til i gruppen.");
      return;
    }

    const removeOption = event.target.dataset.removeGroupOption;
    if (removeOption) {
      const [groupIndex, optionIndex] = removeOption.split(":").map(Number);
      config.optionGroups[groupIndex].options.splice(optionIndex, 1);
      renderGroupManager();
      writeLiveConfig("Valg slettet fra gruppen.");
      return;
    }

    const deleteGroupIndex = event.target.dataset.deleteGroup;
    if (deleteGroupIndex !== undefined) {
      const group = config.optionGroups[Number(deleteGroupIndex)];
      if (!group || !confirm("Slette valggruppen?")) return;
      config.optionGroups.splice(Number(deleteGroupIndex), 1);
      config.sections.forEach((section) => {
        section.items.forEach((product) => {
          product.optionGroupIds = asArray(product.optionGroupIds).filter((id) => id !== group.id);
        });
      });
      renderAll();
      writeLiveConfig("Valggruppe slettet fra Firebase.");
    }
  });

  optionGroupsAdmin.addEventListener("dragstart", (event) => {
    const groupCard = event.target.closest("[data-group-card]");
    if (!groupCard) return;
    draggedGroupId = groupCard.dataset.groupCard;
    event.dataTransfer.effectAllowed = "copy";
    groupCard.classList.add("dragging");
  });

  optionGroupsAdmin.addEventListener("dragend", () => {
    draggedGroupId = null;
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
].forEach((field) => {
  field.addEventListener("input", updateProductFromFields);
  field.addEventListener("change", updateProductFromFields);
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProductFromFields();
  writeLiveConfig("Produkt lagret i Firebase.");
});

document.querySelector("#addCategory").addEventListener("click", addCategory);
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
        config = await loadDefaultConfig();
        selectedCategoryIndex = 0;
        selectedProductIndex = 0;
        firebaseReady = true;
        renderAll();
        await writeLiveConfig("Firebase var tom. Lokal testmeny er lagt inn.");
        return;
      }

      config = normalizeConfig(value);
      selectedCategoryIndex = Math.min(selectedCategoryIndex, Math.max(0, config.sections.length - 1));
      selectedProductIndex = Math.min(selectedProductIndex, Math.max(0, (selectedCategory()?.items || []).length - 1));
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
