const firebaseMenuUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/.json";

let menuSections = [];
const localMenuSections = [
  {
    id: "pizza",
    title: "PIZZA",
    note: "Alle pizzaer kommer med ost og tomatsaus: Stor for 2-3 pers, Medium for 1.",
    imageClass: "pizza-strip",
    items: [
      { id: "classico", number: 1, name: "Clasicco", ingredients: "Skinke eller pepperoni", mediumPrice: 175, largePrice: 275, displayPrice: 179, thumb: "pepperoni" },
      { id: "capri", number: 2, name: "Capri", ingredients: "Skinke, bacon, sopp", mediumPrice: 185, largePrice: 285, displayPrice: 189, thumb: "mushroom" },
      { id: "al-capone", number: 3, name: "Al Capone", ingredients: "Pepperoni, biff, paprika, l\u00f8k", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "spicy" },
      { id: "parma", number: 4, name: "Parma", ingredients: "Ost, parmaskinke, pesto olje, rukkola, parmesanost", mediumPrice: 215, largePrice: 315, displayPrice: 219, thumb: "green" },
      { id: "sjefens", number: 5, name: "Sjefens Favoritt", ingredients: "Biff, skinke, pepperoni, paprika", mediumPrice: 215, largePrice: 315, displayPrice: 219, thumb: "mixed" },
      { id: "torino", number: 6, name: "Torino", ingredients: "Pepperoni, skinke, bacon, l\u00f8k", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "red" },
      { id: "mexican-style", number: 7, name: "Mexican Style", ingredients: "Biff, paprika, tacosaus, l\u00f8k, jalapeno, nachos", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "spicy" },
      { id: "kebabpizza", number: 8, name: "Kebabpizza", ingredients: "Ekte kebabkj\u00f8tt, sopp, l\u00f8k, salat, hvitl\u00f8ksaus", mediumPrice: 230, largePrice: 330, displayPrice: 239, thumb: "mixed" },
      { id: "kyllingpizza", number: 9, name: "Kyllingpizza", ingredients: "Kyllingkj\u00f8tt, bacon, mais, paprika", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "mixed" },
      { id: "alfredo", number: 10, name: "Alfredo", ingredients: "Kyllingkj\u00f8tt, jalapeno, nachos, paprika, l\u00f8k", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "green" },
      { id: "calzone", number: 11, name: "Calzone (innbakt)", ingredients: "Calzone er en innbakt italiensk pizza med ost og skinke.", mediumPrice: 175, largePrice: 275, displayPrice: 179, thumb: "red" },
      { id: "ciao-ciao", number: 12, name: "Ciao Ciao", ingredients: "Biff, sopp, l\u00f8k, b\u00e9arnaisesaus", mediumPrice: 195, largePrice: 295, displayPrice: 199, thumb: "mushroom" },
      { id: "pollo-marina", number: 13, name: "Pollo Marina", ingredients: "Hvit pizzasaus, marinert kylling, bl\u00e5muggost, l\u00f8k og rukkola", mediumPrice: 210, largePrice: 310, displayPrice: 199, thumb: "green" },
      { id: "bianca", number: 14, name: "Bianca", ingredients: "Hvit pizzasaus, parmaskinke, pesto olje, rukkola og parmesanost", mediumPrice: 210, largePrice: 310, displayPrice: 199, thumb: "green" },
      { id: "fantasia", number: 15, name: "Fantasia", ingredients: "Skinke, mais, l\u00f8k", mediumPrice: 189, largePrice: 289, thumb: "mixed" },
      { id: "diavola", number: 16, name: "Diavola", ingredients: "Pepperoni, solt\u00f8rket tomater, sopp og gorgonzola ost.", mediumPrice: 199, largePrice: 299, thumb: "spicy" },
      { id: "lag-din-egen", number: 17, name: "Lag din egen", ingredients: "Legg til de ingrediensene du \u00f8nsker! Ost og pizzasaus er inkludert.", mediumPrice: 159, largePrice: 249, thumb: "pepperoni" },
      { id: "hvitloksdressing", name: "Hvitl\u00f8ksdressing", ingredients: "", price: 25, thumb: "sauce", type: "sauce" },
      { id: "bearnaisesaus-product", name: "B\u00e9arnaisesaus", ingredients: "", price: 25, thumb: "sauce", type: "sauce" }
    ]
  },
  {
    id: "kebab",
    title: "KEBAB RETTER",
    note: "",
    imageClass: "kebab-strip",
    items: [
      { id: "kebab-pita", name: "Kebab i pita", ingredients: "Med hjemmebakt pitabr\u00f8d, ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 179, thumb: "kebab", type: "kebab-pita" },
      { id: "kylling-pita", name: "Kylling kebab i pita", ingredients: "Med hjemmebakt pitabr\u00f8d, kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 179, thumb: "kebab", type: "kebab-pita" },
      { id: "kebab-rull", name: "Kebab Rull", ingredients: "Hjemmebakt lefsebr\u00f8d med ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 195, thumb: "wrap", type: "kebab-wrap" },
      { id: "kylling-rull", name: "Kylling Kebab Rull", ingredients: "Hjemmebakt lefsebr\u00f8d med kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 195, thumb: "wrap", type: "kebab-wrap" },
      { id: "kebabtallerken", name: "Kebabtallerken", ingredients: "Med ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus, pommes", price: 229, thumb: "plate", type: "kebab-plate" },
      { id: "kylling-kebabtallerken", name: "Kylling Kebabtallerken", ingredients: "Med kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hjemmelaget hvitl\u00f8ksaus, pommes", price: 229, thumb: "plate", type: "kebab-plate" }
    ]
  },
  {
    id: "burger",
    title: "HJEMMELAGDE BURGER",
    note: "Hjemmelagde burgere p\u00e5 180g, tilberedt med ferske ingredienser for maksimal smak.",
    imageClass: "burger-strip",
    items: [
      { id: "dobbel-burger", name: "Lag dobbel burger", ingredients: "Dobbel glede, dobbel smak!", price: 79, thumb: "burger" },
      { id: "hamburger-tallerken", name: "Hamburger Tallerken", ingredients: "Crispy salat med dressing, l\u00f8k, tomater og pommes frites.", price: 199, thumb: "burger" },
      { id: "cheese-burger-tallerken", name: "Cheese Burger Tallerken", ingredients: "Crispy salat med ost, dressing, l\u00f8k, tomater og pommes frites. Allergener: Halal", price: 219, thumb: "burger" },
      { id: "bbq-bacon-cheese", name: "BBQ Bacon Cheese Tallerken", ingredients: "Crispy salat med dressing, BBQ-saus, bacon, ost, l\u00f8k, tomater og pommes frites.", price: 239, thumb: "burger" },
      { id: "blue-cheese-burger", name: "Blue cheese Burger Tallerken", ingredients: "Crispy salat med dressing, BBQ-saus, bl\u00e5muggost, bacon, l\u00f8k, tomater og pommes frites.", price: 249, thumb: "burger" },
      { id: "nachos-burger", name: "Nachos Burger Tallerken", ingredients: "Crispy salat med dressing, ost, nachos, jalapeno, tacosaus, l\u00f8k, tomater og pommes frites.", price: 249, thumb: "burger" },
      { id: "parma-burger", name: "Parma Burger Tallerken", ingredients: "Parmaskinke, crispy salat med hvitl\u00f8ksaus, ost, l\u00f8k, tomater og pommes frites.", price: 249, thumb: "burger" },
      { id: "burger-pommes", name: "Pommes frites", ingredients: "", price: 59, thumb: "plate" },
      { id: "sotpotet-fries", name: "S\u00f8tpotet fries", ingredients: "", price: 75, thumb: "plate" },
      { id: "mozzarellasticks", name: "Mozzarellasticks 5 stk", ingredients: "", price: 75, thumb: "plate" },
      { id: "lokringer", name: "L\u00f8kringer 6stk", ingredients: "", price: 59, thumb: "plate" }
    ]
  },
  {
    id: "andre",
    title: "ANDRE RETTER",
    note: "Alle v\u00e5re retter tilberedes p\u00e5 flatgrill for optimal smak.",
    imageClass: "burger-strip",
    items: [
      { id: "biffsnadder", name: "Biffsnadder", ingredients: "Marinert biffkj\u00f8tt, paprika, l\u00f8k, sopp, frisk salat, pommes frites, bearnaisesaus og br\u00f8d", price: 249, thumb: "plate" },
      { id: "kyllingsnadder", name: "Kyllingsnadder", ingredients: "Marinert kyllingkj\u00f8tt, paprika, l\u00f8k, frisk salat, pommes, hvitl\u00f8ksaus og br\u00f8d", price: 249, thumb: "plate" },
      { id: "hvitloksnadder", name: "Hvitl\u00f8ksnadder", ingredients: "Marinert biffkj\u00f8tt, paprika, l\u00f8k, sopp, fersk hvitl\u00f8k, frisk salat, pommes, hvitl\u00f8ksaus og br\u00f8d", price: 249, thumb: "plate" },
      { id: "fish-chips", name: "Fish & Chips", ingredients: "Serveres med remulade, frisk salat og pommes", price: 229, thumb: "plate" },
      { id: "lovstek", name: "L\u00f8vstek", ingredients: "Grovkvernet storfekj\u00f8tt 150g, frisk salat, pommes, hjemmelaget bearnaisesaus", price: 199, thumb: "plate" },
      { id: "kyllingsalat", name: "Kyllingsalat", ingredients: "Marinert kyllingkj\u00f8tt, ost og frisk salatmix. Serveres med hjemmebakt br\u00f8d og sm\u00f8r.", price: 219, thumb: "green" },
      { id: "skinke-salat", name: "Skinke-salat", ingredients: "Skinke med frisk salatmix og ost. Serveres med hjemmebakt br\u00f8d og sm\u00f8r.", price: 199, thumb: "green" }
    ]
  },
  {
    id: "vegetar",
    title: "VEGETAR MENY",
    note: "",
    imageClass: "kebab-strip",
    items: [
      { id: "vegetarburger", name: "Vegetarburger", ingredients: "Med dressing, BBQ saus, cheddarost, crispy salat, l\u00f8k, solt\u00f8rkede tomater og pommes frites. Allergener: Vegetar", price: 220, thumb: "green" },
      { id: "vegetar-pizza", name: "Vegetar Pizza", ingredients: "Paprika, l\u00f8k, sopp, mais, ananas, solt\u00f8rkede tomater og rukkola. Allergener: Vegetar", price: 175, thumb: "green" }
    ]
  },
  {
    id: "diverse",
    title: "DIVERSE RETTER",
    note: "",
    imageClass: "burger-strip",
    items: [
      { id: "diverse-pommes", name: "Pommes frites", ingredients: "", price: 59, thumb: "plate" },
      { id: "diverse-sotpotet", name: "S\u00f8tpotet fries", ingredients: "", price: 75, thumb: "plate" },
      { id: "diverse-mozzarella", name: "Mozzarellasticks 5 stk", ingredients: "", price: 75, thumb: "plate" },
      { id: "diverse-lokringer", name: "L\u00f8kringer 6stk", ingredients: "", price: 59, thumb: "plate" }
    ]
  },
  {
    id: "barne",
    title: "BARNE MENY",
    note: "",
    imageClass: "pizza-strip",
    items: [
      { id: "barneburger", name: "Barneburger", ingredients: "Plain burger. Serveres med pommes frites.", price: 135, thumb: "burger" },
      { id: "barnepizza", name: "Barnepizza", ingredients: "Barnepizza med skinke eller peperoni.", price: 135, thumb: "pepperoni" },
      { id: "barne-pommes", name: "Pommes frites", ingredients: "", price: 59, thumb: "plate" },
      { id: "kyllingnuggets", name: "Kyllingnuggets", ingredients: "5 stk kyllingnuggets med chips", price: 115, thumb: "plate" }
    ]
  },
  {
    id: "drikker",
    title: "DRIKKER",
    note: "",
    imageClass: "kebab-strip",
    items: [
      { id: "mineralvann-05", name: "Mineralvann 0.5L", ingredients: "Du velger drikke n\u00e5r du henter maten p\u00e5 restauranten.", price: 39, thumb: "sauce" },
      { id: "mineralvann-15", name: "Mineralvann 1.5L", ingredients: "Du velger drikke n\u00e5r du henter maten p\u00e5 restauranten.", price: 59, thumb: "sauce" }
    ]
  }
];

let extraOptions = [
  { id: "fries", group: "Pommes frites p\u00e5 pizzaen?", label: "Ja, takk!", priceBySize: { medium: 29, large: 39 }, pizzaOnly: true },
  { id: "extra-base", group: "Extra bunn - 300g deig?", label: "Ja, Takk!", price: 49, pizzaOnly: true, sizes: ["large"] },
  { id: "garlic", group: "Velg saus", label: "Hvitl\u00f8ksaus", price: 25 },
  { id: "bearnaise", group: "Velg saus", label: "B\u00e9arnaisesaus", price: 25 }
];

let customPizzaToppings = [
  { id: "topping-beef", group: "Tillegg", label: "Biffkj\u00f8tt", price: 30 },
  { id: "topping-chicken", group: "Tillegg", label: "Kyllingkj\u00f8tt", price: 30 },
  { id: "topping-kebab", group: "Tillegg", label: "Kebabkj\u00f8tt", price: 30 },
  { id: "topping-bacon", group: "Tillegg", label: "Bacon", price: 30 },
  { id: "topping-ham", group: "Tillegg", label: "Skinke", price: 25 },
  { id: "topping-pepperoni", group: "Tillegg", label: "Pepperoni", price: 30 },
  { id: "topping-parma", group: "Tillegg", label: "Parmaskinke", price: 40 },
  { id: "topping-jalapeno", group: "Tillegg", label: "Jalapeno", price: 20 },
  { id: "topping-paprika", group: "Tillegg", label: "paprika", price: 20 },
  { id: "topping-mushroom", group: "Tillegg", label: "sopp", price: 20 },
  { id: "topping-onion", group: "Tillegg", label: "l\u00f8k", price: 20 },
  { id: "topping-corn", group: "Tillegg", label: "mais", price: 20 },
  { id: "topping-extra-cheese", group: "Tillegg", label: "Extra Ost", price: 25 },
  { id: "topping-chips", group: "Tillegg", label: "Chips p\u00e5 toppen", price: 35 }
];

let kebabPitaOptions = [
  { id: "strength-mild", group: "Velg styrke", label: "Mild \u{1F33F}", price: 0, choiceGroup: "strength", default: true },
  { id: "strength-medium", group: "Velg styrke", label: "Medium \u{1F336}\u{FE0F}", price: 0, choiceGroup: "strength" },
  { id: "strength-hot", group: "Velg styrke", label: "Sterk \u{1F525}", price: 0, choiceGroup: "strength" },
  { id: "extra-meat", group: "Ekstra kj\u00f8tt", label: "Ekstra Kebabkj\u00f8tt", price: 30 },
  { id: "fries-kebab", group: "Litt pommes frites i kebaben?", label: "Ja, takk!", price: 15 }
];

let menuOptionGroups = [];
let menuUsesExplicitOptionGroups = false;

const storageKey = "kol-grill-cart";
const openHour = 14;
const closeHour = 22;
const menuSectionsEl = document.querySelector("#menuSections");
const statusNotice = document.querySelector(".status-notice");
const cartCount = document.querySelector("#cartCount");
const cartModal = document.querySelector("#cartModal");
const cartToggle = document.querySelector(".cart-toggle");
const infoToggle = document.querySelector("#infoToggle");
const infoModal = document.querySelector("#infoModal");
const closeInfo = document.querySelector("#closeInfo");
const closeCart = document.querySelector("#closeCart");
const backToMenu = document.querySelector("#backToMenu");
const clearCart = document.querySelector("#clearCart");
const cartItems = document.querySelector("#cartItems");
const cartEmpty = document.querySelector("#cartEmpty");
const cartSummary = document.querySelector("#cartSummary");
const subtotal = document.querySelector("#subtotal");
const tax = document.querySelector("#tax");
const total = document.querySelector("#total");
const checkoutButton = document.querySelector(".checkout-button");
const clearCartConfirm = document.querySelector("#clearCartConfirm");
const cancelClearCart = document.querySelector("#cancelClearCart");
const confirmClearCart = document.querySelector("#confirmClearCart");
const productModal = document.querySelector("#productModal");
const productTitle = document.querySelector("#productTitle");
const productSummary = document.querySelector("#productSummary");
const optionGroups = document.querySelector("#optionGroups");
const specialInstructions = document.querySelector("#specialInstructions");
const productQuantity = document.querySelector("#productQuantity");
const productTotal = document.querySelector("#productTotal");
const productAllergens = document.querySelector("#productAllergens");
const closeProduct = document.querySelector("#closeProduct");
const decreaseProduct = document.querySelector("#decreaseProduct");
const increaseProduct = document.querySelector("#increaseProduct");
const addConfiguredProduct = document.querySelector("#addConfiguredProduct");

let cart = loadCart();
let selectedProduct = null;
let selectedSection = null;
let selectedSize = "large";
let selectedExtras = new Set();
let quantity = 1;
let editingCartIndex = null;

function formatPrice(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(value);
}

function loadCart() {
  const savedCart = localStorage.getItem(storageKey);
  if (!savedCart) return [];
  const parsed = JSON.parse(savedCart);
  return Array.isArray(parsed) ? parsed : [];
}

function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
}

function findProduct(id) {
  for (const section of menuSections) {
    const item = asArray(section.items).find((product) => product.id === id);
    if (item) return { item, section };
  }
  return {};
}

function escapeAttribute(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderThumb(item) {
  if (item.imageUrl) {
    return `<span class="food-thumb custom-thumb" aria-hidden="true"><img src="${escapeAttribute(item.imageUrl)}" alt=""></span>`;
  }
  return `<span class="food-thumb ${item.thumb}" aria-hidden="true"></span>`;
}

function renderCategoryPhoto(section) {
  const style = section.imageUrl ? ` style="background-image: url('${escapeAttribute(section.imageUrl)}')"` : "";
  return `<div class="category-photo ${section.imageClass}" aria-hidden="true"${style}></div>`;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
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


function normalizeMenuConfig(config) {
  const hasExplicitOptionGroups = config && Object.prototype.hasOwnProperty.call(config, "optionGroups");
  const sections = asArray(config?.sections).map((section) => ({
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
    extraOptions: asArray(config?.extraOptions),
    customPizzaToppings: asArray(config?.customPizzaToppings),
    kebabPitaOptions: asArray(config?.kebabPitaOptions),
    optionGroups: normalizeOptionGroups(config),
    hasExplicitOptionGroups
  };
}


function applyMenuConfig(config) {
  const normalized = normalizeMenuConfig(config);
  if (!normalized.sections.length) return false;
  menuSections = normalized.sections;
  extraOptions = normalized.extraOptions;
  customPizzaToppings = normalized.customPizzaToppings;
  kebabPitaOptions = normalized.kebabPitaOptions;
  menuOptionGroups = normalized.optionGroups;
  menuUsesExplicitOptionGroups = normalized.hasExplicitOptionGroups;
  return true;
}


async function loadMenuConfig() {
  try {
    const response = await fetch(`${firebaseMenuUrl}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kunne ikke hente meny");
    const config = await response.json();
    if (!applyMenuConfig(config)) menuSections = [];
  } catch (error) {
    menuSections = [];
    console.warn("Menyen kunne ikke lastes fra Firebase.", error);
  }
}

function normalizeSizeId(label = "", fallback = "") {
  const value = String(label || fallback || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (value.includes("medium") || value === "m") return "medium";
  if (value.includes("stor") || value.includes("large") || value === "st") return "large";
  if (value.includes("xxl")) return "xxl";
  if (value.includes("xl")) return "xl";
  if (value.includes("standard") || value.includes("pris")) return "standard";
  return makeSlug(label || fallback || "size");
}

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "size";
}

function defaultLabelForSize(id = "standard") {
  if (id === "medium") return "Medium Pizza";
  if (id === "large") return "STOR PIZZA";
  if (id === "xxl") return "XXL";
  if (id === "xl") return "XL";
  if (id === "standard") return "Standard";
  return id.toUpperCase();
}

function getProductSizes(item) {
  const savedSizes = asArray(item?.sizes)
    .map((size) => ({
      id: normalizeSizeId(size.label || size.name || size.id, size.id),
      label: size.label || size.name || defaultLabelForSize(size.id),
      price: Number(size.price),
      default: size.default === true || size.isDefault === true || item?.defaultSizeId === normalizeSizeId(size.label || size.name || size.id, size.id)
    }))
    .filter((size) => size.label && Number.isFinite(size.price));

  if (savedSizes.length) {
    const defaultIndex = savedSizes.findIndex((size) => size.default);
    return savedSizes.map((size, index) => ({
      ...size,
      default: defaultIndex >= 0 ? index === defaultIndex : index === 0
    }));
  }

  const prices = [];
  if (item?.mediumPrice !== undefined) prices.push({ id: "medium", label: "Medium Pizza", price: Number(item.mediumPrice), default: item?.defaultSizeId === "medium" });
  if (item?.largePrice !== undefined) prices.push({ id: "large", label: "STOR PIZZA", price: Number(item.largePrice), default: item?.defaultSizeId === "large" });
  if (!prices.length && item?.price !== undefined) prices.push({ id: "standard", label: "Standard", price: Number(item.price), default: true });

  const validPrices = prices.filter((size) => Number.isFinite(size.price));
  const defaultIndex = validPrices.findIndex((size) => size.default);
  return validPrices.map((size, index) => ({
    ...size,
    default: defaultIndex >= 0 ? index === defaultIndex : index === 0
  }));
}


function hasSizes(item) {
  return getProductSizes(item).length > 1;
}

function getDefaultProductSizeId(item) {
  const sizes = getProductSizes(item);
  return sizes.find((size) => size.default)?.id || sizes[0]?.id || "regular";
}


function getSelectedSizeLabel(item, size) {
  return getProductSizes(item).find((entry) => entry.id === size)?.label || "Standard";
}

function isLargeLikeSize(size) {
  return ["large", "xl", "xxl"].includes(size);
}

function renderSizeOptions() {
  const sizes = getProductSizes(selectedProduct);
  if (sizes.length <= 1) return "";
  const basePrice = sizes[0]?.price || 0;
  return `
    <section class="option-group">
      <h3>Størrelse <span>Obligatorisk</span></h3>
      ${sizes
        .map((size) => {
          const diff = size.price - basePrice;
          return `
            <label class="option-line ${selectedSize === size.id ? "selected" : ""}">
              <input type="radio" name="size" value="${size.id}" ${selectedSize === size.id ? "checked" : ""}>
              <span>${size.label}</span>
              ${diff > 0 ? `<strong>+${diff},00</strong>` : ""}
            </label>
          `;
        })
        .join("")}
    </section>
  `;
}

function isPizzaItem(item) {
  return selectedSection?.id === "pizza" && item.type !== "sauce";
}

function isKebabPitaItem(item) {
  return item?.type === "kebab-pita";
}

function isKebabCustomItem(item) {
  return item?.type === "kebab-pita" || item?.type === "kebab-wrap" || item?.type === "kebab-plate";
}

function getBasePrice(item, size) {
  const sizes = getProductSizes(item);
  if (!sizes.length) return 0;
  return (sizes.find((entry) => entry.id === size) || sizes[0]).price;
}

function isOptionVisible(option) {
  if (!isPizzaItem(selectedProduct)) return false;
  if (selectedProduct.type === "sauce") return false;
  if (option.pizzaOnly && selectedSection.id !== "pizza") return false;
  if (!option.pizzaOnly && selectedSection.id === "pizza") return true;
  if (option.sizes && !option.sizes.includes(selectedSize) && !(isLargeLikeSize(selectedSize) && option.sizes.includes("large"))) return false;
  return true;
}

function getOptionPrice(option) {
  if (option.priceBySize) {
    if (option.priceBySize[selectedSize] !== undefined) return option.priceBySize[selectedSize];
    if (isLargeLikeSize(selectedSize) && option.priceBySize.large !== undefined) return option.priceBySize.large;
    if (!hasSizes(selectedProduct)) return option.priceBySize.regular ?? option.priceBySize.large ?? option.priceBySize.medium ?? 0;
    return option.priceBySize.medium ?? option.priceBySize.large ?? 0;
  }
  return option.price || 0;
}

function isOptionAllowedForSize(option) {
  if (!hasSizes(selectedProduct)) return true;
  if (!option.sizes) return true;
  return option.sizes.includes(selectedSize) || (isLargeLikeSize(selectedSize) && option.sizes.includes("large"));
}

function getProductOptionGroups() {
  const sizeSpecificIds = asArray(selectedProduct?.optionGroupIdsBySize?.[selectedSize]);
  const ids = sizeSpecificIds.length ? sizeSpecificIds : asArray(selectedProduct?.optionGroupIds);
  if (!ids.length) return [];
  return ids
    .map((id) => menuOptionGroups.find((group) => group.id === id))
    .filter(Boolean)
    .map((group) => ({ ...group, options: asArray(group.options).filter(isOptionAllowedForSize) }))
    .filter((group) => group.options.length);
}

function getVisibleExtras() {
  const productGroups = getProductOptionGroups();
  if (productGroups.length) {
    return productGroups.flatMap((group) =>
      group.options.map((option) => ({
        ...option,
        group: group.title,
        choiceGroup: group.type === "single" ? group.id : option.choiceGroup,
        required: group.required
      }))
    );
  }

  // Når Firebase har en optionGroups-liste, skal ingen gamle hardkodede
  // standard-tillegg dukke opp igjen etter sletting. Da vises kun grupper
  // som faktisk er koblet til produktet.
  if (menuUsesExplicitOptionGroups) return [];

  // Legacy fallback for gamle data uten optionGroups i det hele tatt.
  if (isKebabCustomItem(selectedProduct)) {
    return kebabPitaOptions;
  }
  if (selectedProduct?.id === "lag-din-egen") {
    return [...customPizzaToppings, ...extraOptions.filter((option) => option.id !== "fries").filter(isOptionVisible)];
  }
  return extraOptions.filter(isOptionVisible);
}


function getCurrentUnitPrice() {
  const extrasTotal = getVisibleExtras()
    .filter((option) => selectedExtras.has(option.id))
    .reduce((sum, option) => sum + getOptionPrice(option), 0);
  return getBasePrice(selectedProduct, selectedSize) + extrasTotal;
}

function applyDefaultOptionSelections() {
  getProductOptionGroups()
    .filter((group) => group.type === "single")
    .forEach((group) => {
      if (group.options.some((option) => selectedExtras.has(option.id))) return;
      const defaultOption = group.options.find((option) => option.default) || group.options[0];
      if (defaultOption) selectedExtras.add(defaultOption.id);
    });
}

function getCurrentTotal() {
  return getCurrentUnitPrice() * quantity;
}

function buildCartLine() {
  const selectedExtraLines = getVisibleExtras().filter((option) => selectedExtras.has(option.id));
  const titlePrefix = selectedProduct.number ? `${selectedProduct.number}- ` : "";
  return {
    id: editingCartIndex === null ? `${selectedProduct.id}-${Date.now()}` : cart[editingCartIndex].id,
    productId: selectedProduct.id,
    name: `${titlePrefix}${selectedProduct.name.toUpperCase()}`,
    size: selectedSize,
    sizeLabel: getProductSizes(selectedProduct).length
      ? `Størrelse: ${getSelectedSizeLabel(selectedProduct, selectedSize)}`
      : "Størrelse: Standard",
    extras: selectedExtraLines.map((option) =>
      option.choiceGroup || option.group === "Velg saus" || option.group === "Tillegg" || selectedProduct.type === "kebab-pita"
        ? option.label
        : option.group
    ),
    extraIds: selectedExtraLines.map((option) => option.id),
    quantity,
    unitPrice: getCurrentUnitPrice(),
    total: getCurrentTotal(),
    note: specialInstructions.value.trim()
  };
}

function updateOpeningNotice() {
  const now = new Date();
  const osloHour = Number(
    new Intl.DateTimeFormat("nb-NO", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Oslo"
    }).format(now)
  );
  const isOpen = osloHour >= openHour && osloHour < closeHour;
  statusNotice.hidden = isOpen;
}

function renderMenu() {
  if (!menuSections.length) {
    menuSectionsEl.innerHTML = `
      <section class="category-panel">
        <p class="category-note">Menyen er ikke lagt inn i databasen enn&aring;.</p>
      </section>
    `;
    return;
  }
  menuSectionsEl.innerHTML = menuSections
    .map(
      (section) => `
        <section class="category-panel" data-section="${section.id}">
          <button class="category-title" type="button" data-toggle-section="${section.id}">
            <span>${section.title}</span>
            <span>&#9662;</span>
          </button>
          ${section.note ? `<p class="category-note">${section.note}</p>` : ""}
          ${renderCategoryPhoto(section)}
          <div class="menu-list">
            ${asArray(section.items)
              .map((item) => {
                const price = item.displayPrice ?? getBasePrice(item, getDefaultProductSizeId(item));
                const prefix = item.number ? `${item.number}- ` : "";
                const details = item.ingredients || "";
                return `
                  <button class="menu-row" type="button" data-product="${item.id}">
                    ${renderThumb(item)}
                    <span class="menu-row-main">
                      <strong>${prefix}${item.name.toUpperCase()}</strong>
                      <span>${details}</span>
                    </span>
                    <strong class="row-price">${formatPrice(price)}</strong>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderProductOptions() {
  const sizeOptions = renderSizeOptions();
  const assignedGroups = getProductOptionGroups();
  if (assignedGroups.length) {

    const groupHtml = assignedGroups
      .map((group) => `
        <section class="option-group">
          <h3>${group.title}${group.required ? " <span>Obligatorisk</span>" : ""}</h3>
          ${group.options
            .map((option) => `
              <label class="option-line ${selectedExtras.has(option.id) ? "selected" : ""}">
                <input
                  type="${group.type === "single" ? "radio" : "checkbox"}"
                  name="${group.type === "single" ? group.id : option.id}"
                  value="${option.id}"
                  data-choice-group="${group.type === "single" ? group.id : ""}"
                  ${selectedExtras.has(option.id) ? "checked" : ""}
                >
                <span>${option.label}</span>
                ${getOptionPrice(option) ? `<strong>+${getOptionPrice(option)},00</strong>` : ""}
              </label>
            `)
            .join("")}
        </section>
      `)
      .join("");

    const loyaltyHtml = isPizzaItem(selectedProduct) && isLargeLikeSize(selectedSize)
      ? `
        <section class="option-group">
          <h3>Lojalitetsprogram!</h3>
          <label class="option-line muted-option">
            <input type="checkbox" disabled>
            <span>Hver 11. pizza gratis! Legges til automatisk.</span>
          </label>
        </section>
      `
      : "";

    optionGroups.innerHTML = `${sizeOptions}${loyaltyHtml}${groupHtml}`;
    return;
  }

  if (menuUsesExplicitOptionGroups) {
    optionGroups.innerHTML = sizeOptions;
    return;
  }

  if (isKebabCustomItem(selectedProduct)) {
    const selectedStrength = [...selectedExtras].find((id) => id.startsWith("strength-")) || "strength-mild";
    const renderKebabLine = (option) => `
      <label class="option-line ${selectedExtras.has(option.id) ? "selected" : ""}">
        <input type="${option.choiceGroup ? "radio" : "checkbox"}" name="${option.choiceGroup || option.id}" value="${option.id}" ${selectedExtras.has(option.id) ? "checked" : ""}>
        <span>${option.label}</span>
        ${option.price ? `<strong>+${option.price},00</strong>` : ""}
      </label>
    `;
    optionGroups.innerHTML = `
      <section class="option-group">
        <h3>Velg styrke <span>Obligatorisk</span></h3>
        ${kebabPitaOptions
          .filter((option) => option.choiceGroup === "strength")
          .map((option) => renderKebabLine({ ...option, checked: option.id === selectedStrength }))
          .join("")}
      </section>
      <section class="option-group">
        <h3>Ekstra kj\u00f8tt</h3>
        ${renderKebabLine(kebabPitaOptions.find((option) => option.id === "extra-meat"))}
      </section>
      ${
        selectedProduct.type === "kebab-plate"
          ? ""
          : `
            <section class="option-group">
              <h3>Litt pommes frites i kebaben?</h3>
              ${renderKebabLine(kebabPitaOptions.find((option) => option.id === "fries-kebab"))}
            </section>
          `
      }
    `;
    return;
  }

  if (!isPizzaItem(selectedProduct)) {
    optionGroups.innerHTML = sizeOptions;
    return;
  }

  const visibleExtras = getVisibleExtras();
  const customToppings = visibleExtras.filter((option) => option.group === "Tillegg");
  const pizzaFries = visibleExtras.find((option) => option.id === "fries");
  const extraBase = visibleExtras.find((option) => option.id === "extra-base");
  const sauces = visibleExtras.filter((option) => option.group === "Velg saus");

  const renderOptionLine = (option) => `
    <label class="option-line ${selectedExtras.has(option.id) ? "selected" : ""}">
      <input type="checkbox" value="${option.id}" ${selectedExtras.has(option.id) ? "checked" : ""}>
      <span>${option.label}</span>
      <strong>+${getOptionPrice(option)},00</strong>
    </label>
  `;

  const pizzaOptions = selectedProduct.id === "lag-din-egen"
    ? `
      <section class="option-group"><h3>Tillegg (${isLargeLikeSize(selectedSize) ? "ST" : "M"})</h3>${customToppings.map(renderOptionLine).join("")}</section>
      ${
        isLargeLikeSize(selectedSize)
          ? `
            <section class="option-group">
              <h3>Lojalitetsprogram!</h3>
              <label class="option-line muted-option">
                <input type="checkbox" disabled>
                <span>Hver 11. pizza gratis! Legges til automatisk.</span>
              </label>
            </section>
          `
          : ""
      }
      ${extraBase ? `<section class="option-group"><h3>${extraBase.group}</h3>${renderOptionLine(extraBase)}</section>` : ""}
      <section class="option-group"><h3>Velg saus</h3>${sauces.map(renderOptionLine).join("")}</section>
    `
    : isPizzaItem(selectedProduct)
    ? `
      ${
        isLargeLikeSize(selectedSize)
          ? `
            <section class="option-group">
              <h3>Lojalitetsprogram!</h3>
              <label class="option-line muted-option">
                <input type="checkbox" disabled>
                <span>Hver 11. pizza gratis! Legges til automatisk.</span>
              </label>
            </section>
          `
          : ""
      }
      ${pizzaFries ? `<section class="option-group"><h3>${pizzaFries.group} (${isLargeLikeSize(selectedSize) ? "S" : "M"})</h3>${renderOptionLine(pizzaFries)}</section>` : ""}
      ${extraBase ? `<section class="option-group"><h3>${extraBase.group}</h3>${renderOptionLine(extraBase)}</section>` : ""}
      <section class="option-group"><h3>Velg saus</h3>${sauces.map(renderOptionLine).join("")}</section>
    `
    : "";

  optionGroups.innerHTML = `${sizeOptions}${pizzaOptions}`;
}

function renderProductModal() {
  const titlePrefix = selectedProduct.number ? `${selectedProduct.number}- ` : "";
  productModal.classList.toggle("simple-product", selectedProduct.type === "sauce");
  productModal.classList.toggle("kebab-product", isKebabCustomItem(selectedProduct));
  document.querySelector(".product-photo").style.backgroundImage = selectedProduct.imageUrl ? `url("${selectedProduct.imageUrl}")` : "";
  productTitle.textContent = `${titlePrefix}${selectedProduct.name.toUpperCase()}`;
  productSummary.textContent = selectedProduct.ingredients || "";
  productQuantity.textContent = quantity;
  productTotal.textContent = formatPrice(getCurrentTotal()).toUpperCase();
  addConfiguredProduct.textContent = editingCartIndex === null ? "Legg til i handlevogn" : "Oppdater handlekurv";
  productAllergens.textContent = selectedProduct.type === "sauce"
    ? "Allergener: Melk, Egg, sennep"
    : isKebabCustomItem(selectedProduct) ? "Allergener: Melk, Egg, Hvete, sennep, Selleri, Soya"
    : isPizzaItem(selectedProduct) ? "Allergener: Melk, Hvete" : "";
  renderProductOptions();
}

function openProduct(id) {
  const result = findProduct(id);
  selectedProduct = result.item;
  selectedSection = result.section;
  editingCartIndex = null;
  selectedSize = getDefaultProductSizeId(selectedProduct);
  selectedExtras = new Set();
  applyDefaultOptionSelections();
  if (!getProductOptionGroups().length && isKebabCustomItem(selectedProduct)) selectedExtras.add("strength-mild");
  quantity = 1;
  specialInstructions.value = "";
  renderProductModal();
  productModal.hidden = false;
  document.body.classList.add("modal-open");
}

function openCartLineEditor(index) {
  const line = cart[index];
  const result = findProduct(line.productId);
  if (!result.item) return;
  selectedProduct = result.item;
  selectedSection = result.section;
  editingCartIndex = index;
  selectedSize = line.size || getDefaultProductSizeId(selectedProduct);
  selectedExtras = new Set(line.extraIds || []);
  applyDefaultOptionSelections();
  if (!getProductOptionGroups().length && isKebabCustomItem(selectedProduct) && ![...selectedExtras].some((id) => id.startsWith("strength-"))) {
    selectedExtras.add("strength-mild");
  }
  quantity = line.quantity || 1;
  specialInstructions.value = line.note || "";
  closeCartModal();
  renderProductModal();
  productModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  productModal.hidden = true;
  productModal.classList.remove("simple-product");
  productModal.classList.remove("kebab-product");
  editingCartIndex = null;
  document.body.classList.remove("modal-open");
}

function renderCart() {
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.total, 0);
  const taxValue = Math.round((cartSubtotal * 15 / 115) * 100) / 100;

  cartCount.textContent = itemCount;
  subtotal.textContent = formatPrice(cartSubtotal);
  tax.textContent = formatPrice(taxValue);
  total.textContent = formatPrice(cartSubtotal);
  cartEmpty.hidden = cart.length > 0;
  cartItems.hidden = cart.length === 0;
  cartSummary.hidden = cart.length === 0;
  clearCart.hidden = cart.length === 0;
  checkoutButton.disabled = cart.length === 0;

  cartItems.innerHTML = cart
    .map(
      (line, index) => `
        <article class="cart-item">
          <div class="cart-item-main">
            <div>
              <h3>${line.quantity}x ${line.name}</h3>
              <p>${line.sizeLabel}${line.extras.length ? " &middot; " + line.extras.join(", ") : ""}</p>
              ${line.note ? `<p>${line.note}</p>` : ""}
            </div>
            <strong>${formatPrice(line.total)}</strong>
          </div>
          <div class="cart-item-actions">
            <button class="edit-line-button" type="button" data-edit="${index}">Rediger</button>
            <button class="remove-button" type="button" data-remove="${index}">&times;</button>
          </div>
        </article>
      `
    )
    .join("");
}

function addConfiguredToCart() {
  const line = buildCartLine();
  if (editingCartIndex === null) cart.push(line);
  else cart[editingCartIndex] = line;
  saveCart();
  renderCart();
  closeProductModal();
  openCart();
}

function openCart() {
  cartModal.hidden = false;
  cartToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("cart-open");
}

function closeCartModal() {
  cartModal.hidden = true;
  cartToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("cart-open");
}

function openClearCartConfirm() {
  clearCartConfirm.hidden = false;
}

function closeClearCartConfirm() {
  clearCartConfirm.hidden = true;
}

function emptyCart() {
  cart = [];
  saveCart();
  renderCart();
  closeClearCartConfirm();
}

function openInfo() {
  infoModal.hidden = false;
  infoToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("modal-open");
}

function closeInfoModal() {
  infoModal.hidden = true;
  infoToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("modal-open");
}

menuSectionsEl.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-section]");
  if (toggle) {
    const panel = toggle.closest(".category-panel");
    panel.classList.toggle("collapsed");
    return;
  }
  const row = event.target.closest("[data-product]");
  if (row) openProduct(row.dataset.product);
});

optionGroups.addEventListener("change", (event) => {
  if (event.target.name === "size") {
    selectedSize = event.target.value;
    selectedExtras = new Set([...selectedExtras].filter((id) => getVisibleExtras().some((option) => option.id === id)));
    applyDefaultOptionSelections();
  }
  const choiceGroup = event.target.dataset.choiceGroup;
  if (choiceGroup) {
    const groupOptionIds = getProductOptionGroups()
      .find((group) => group.id === choiceGroup)?.options
      .map((option) => option.id) || [];
    selectedExtras = new Set([...selectedExtras].filter((id) => !groupOptionIds.includes(id)));
    selectedExtras.add(event.target.value);
  }
  if (event.target.name === "strength") {
    selectedExtras = new Set([...selectedExtras].filter((id) => !id.startsWith("strength-")));
    selectedExtras.add(event.target.value);
  }
  if (event.target.type === "checkbox" && event.target.value) {
    if (event.target.checked) selectedExtras.add(event.target.value);
    else selectedExtras.delete(event.target.value);
  }
  selectedExtras = new Set([...selectedExtras].filter((id) => getVisibleExtras().some((option) => option.id === id)));
  renderProductModal();
});

decreaseProduct.addEventListener("click", () => {
  quantity = Math.max(1, quantity - 1);
  renderProductModal();
});

increaseProduct.addEventListener("click", () => {
  quantity += 1;
  renderProductModal();
});

closeProduct.addEventListener("click", closeProductModal);
addConfiguredProduct.addEventListener("click", addConfiguredToCart);
cartToggle.addEventListener("click", openCart);
infoToggle.addEventListener("click", openInfo);
closeInfo.addEventListener("click", closeInfoModal);
if (closeCart) closeCart.addEventListener("click", closeCartModal);
backToMenu.addEventListener("click", closeCartModal);

cartModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeCart !== undefined) closeCartModal();
});

infoModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeInfo !== undefined) closeInfoModal();
});

cartItems.addEventListener("click", (event) => {
  const editIndex = event.target.dataset.edit;
  if (editIndex !== undefined) {
    openCartLineEditor(Number(editIndex));
    return;
  }
  const index = event.target.dataset.remove;
  if (index === undefined) return;
  cart.splice(Number(index), 1);
  saveCart();
  renderCart();
});

clearCart.addEventListener("click", () => {
  if (cart.length === 0) return;
  openClearCartConfirm();
});

cancelClearCart.addEventListener("click", closeClearCartConfirm);
confirmClearCart.addEventListener("click", emptyCart);

clearCartConfirm.addEventListener("click", (event) => {
  if (event.target.dataset.closeConfirm !== undefined) closeClearCartConfirm();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!clearCartConfirm.hidden) {
    closeClearCartConfirm();
    return;
  }
  if (!productModal.hidden) closeProductModal();
  if (!infoModal.hidden) closeInfoModal();
  if (!cartModal.hidden) closeCartModal();
});

async function init() {
  await loadMenuConfig();
  renderMenu();
  renderCart();
  updateOpeningNotice();
}

init();
