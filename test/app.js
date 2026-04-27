const firebaseMenuUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/.json";
const firebaseOrdersUrl = "https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/orders.json";

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
let siteSettings = defaultSiteSettings();

const storageKey = "kol-grill-cart";
const recentOrdersKey = "kol-grill-recent-orders-v1";
const customerStorageKey = "kol-grill-customer-v1";
const activeOrderKey = "kol-grill-active-order-v1";

// TÜRKÇE: Menü verisini tarayıcıda saklıyoruz.
// Böylece sayfa yenilenince Firebase beklenirken boş/yanıp sönen ekran olmaz.
// Firebase sonra arka planda yenilenir ve veri değişmişse sayfa sessizce güncellenir.
const menuCacheKey = "kol-menu-cache-v1";
const firstMenuBatchSize = 4;
const nextMenuBatchSize = 3;
let visibleSectionLimit = firstMenuBatchSize;
let lazyMenuObserver = null;
let lazyScrollHandler = null;

const openHour = 14;
const closeHour = 22;
const menuSectionsEl = document.querySelector("#menuSections");
const brandHero = document.querySelector("#brandHero");
const brandLogoImage = document.querySelector("#brandLogoImage");
const brandDefaultInitials = document.querySelector("#brandDefaultInitials");
const brandDefaultTitle = document.querySelector("#brandDefaultTitle");
const siteNameText = document.querySelector("#siteNameText");
const infoTitle = document.querySelector("#infoTitle");
const mapLabel = document.querySelector("#mapLabel");
const openingDaysText = document.querySelector("#openingDaysText");
const openingTimeText = document.querySelector("#openingTimeText");
const pickupInfoText = document.querySelector("#pickupInfoText");
const paymentInfoText = document.querySelector("#paymentInfoText");
const addressText = document.querySelector("#addressText");
const phoneText = document.querySelector("#phoneText");
const statusNotice = document.querySelector(".status-notice");

// LOGO FEILSIKRING: Hvis logo-URL er feil eller bildet ikke kan lastes,
// går toppen tilbake til det samme sade default-bildet som kategoriene bruker.
if (brandLogoImage) {
  brandLogoImage.addEventListener("error", () => {
    brandLogoImage.hidden = true;
    brandLogoImage.removeAttribute("src");
    applyHeroDefaultVisual(siteSettings);
  });
}

const cartCount = document.querySelector("#cartCount");
const cartModal = document.querySelector("#cartModal");
const cartPanel = document.querySelector("#cartPanel");
const cartTitle = document.querySelector("#cartTitle");
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
const customerFirstName = document.querySelector("#customerFirstName");
const customerLastName = document.querySelector("#customerLastName");
const customerPhone = document.querySelector("#customerPhone");
const pickupTimeInput = document.querySelector("#pickupTime");
const pickupHelp = document.querySelector("#pickupHelp");
const orderStatusBox = document.querySelector("#orderStatusBox");
const recentOrdersEl = document.querySelector("#recentOrders");
const profileToggle = document.querySelector("#profileToggle");
const profileModal = document.querySelector("#profileModal");
const closeProfile = document.querySelector("#closeProfile");
const profileOrdersEl = document.querySelector("#profileOrders");
const profileOrderDot = document.querySelector("#profileOrderDot");
const orderLiveModal = document.querySelector("#orderLiveModal");
const orderLiveContent = document.querySelector("#orderLiveContent");
const closeOrderLive = document.querySelector("#closeOrderLive");

let cart = loadCart();
let selectedProduct = null;
let selectedSection = null;
let selectedSize = "large";
let selectedExtras = new Set();
let quantity = 1;
let editingCartIndex = null;
let addingToCart = false;
let cartWiggleTimer = null;
let cartReminderTimer = null;
let currentOrderPollTimer = null;
let recentOrdersPollTimer = null;
let expandedProfileOrderId = "";

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


// ============================================================
// BESTILLINGSMODUL (KUNDE)
// ------------------------------------------------------------
// Sepetteki ürünler Firebase /orders altına gönderilir.
// Kunden kan se bestillingsstatus og de siste 2 bestillingene.
// ============================================================

function loadSavedCustomerInfo() {
  try {
    const parsed = JSON.parse(localStorage.getItem(customerStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveCustomerInfo() {
  const customer = getCustomerInfo();
  localStorage.setItem(customerStorageKey, JSON.stringify(customer));
}

function prefillCustomerInfo() {
  const saved = loadSavedCustomerInfo();
  if (customerFirstName && !customerFirstName.value) customerFirstName.value = saved.firstName || "";
  if (customerLastName && !customerLastName.value) customerLastName.value = saved.lastName || "";
  if (customerPhone && !customerPhone.value) customerPhone.value = saved.phone || "";
}

function setActiveOrderId(orderId) {
  if (orderId) localStorage.setItem(activeOrderKey, orderId);
}

function clearActiveOrderId(orderId) {
  const current = localStorage.getItem(activeOrderKey);
  if (!orderId || current === orderId) localStorage.removeItem(activeOrderKey);
}

function getActiveOrderId() {
  return localStorage.getItem(activeOrderKey) || "";
}

function getRecentOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentOrdersKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentOrders(orders) {
  localStorage.setItem(recentOrdersKey, JSON.stringify(orders.slice(0, 2)));
}

function getOrderReadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(orderReadStateKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOrderReadState(state) {
  localStorage.setItem(orderReadStateKey, JSON.stringify(state || {}));
}

function isOrderUnread(order = {}) {
  if (!order.id) return false;
  const status = order.status || "pending";
  const readState = getOrderReadState()[order.id];
  return !readState || readState.status !== status;
}

function markOrderAsRead(orderId) {
  const order = getRecentOrders().find((item) => item.id === orderId);
  if (!order) return;
  const state = getOrderReadState();
  state[orderId] = {
    status: order.status || "pending",
    readAt: new Date().toISOString()
  };
  saveOrderReadState(state);
  updateProfileDot();
}

function rememberRecentOrder(order) {
  const previousList = getRecentOrders();
  const previousOrder = previousList.find((item) => item.id === order.id);
  const previousStatus = previousOrder?.status || "pending";
  const nextStatus = order.status || "pending";
  const statusChanged = previousOrder && previousStatus !== nextStatus;
  const list = previousList.filter((item) => item.id !== order.id);
  list.unshift(order);
  saveRecentOrders(list);

  if (nextStatus === "pending") setActiveOrderId(order.id);
  if (["accepted", "cancelled"].includes(nextStatus)) clearActiveOrderId(order.id);

  // Status endret etter at kunden allerede har sett bestillingen.
  // Da åpner vi et rent status-vindu og markerer profilen som ulest.
  if (statusChanged && ["accepted", "cancelled"].includes(nextStatus)) {
    renderOrderLiveModal(order, true);
  }

  renderRecentOrders();
  renderProfileOrders();
  updateProfileDot();
}

function orderStatusText(status = "pending") {
  if (status === "accepted") return "Godkjent";
  if (status === "cancelled") return "Kansellert";
  return "Venter";
}

function orderStatusTitle(status = "pending") {
  if (status === "accepted") return "Bestillingen er godkjent";
  if (status === "cancelled") return "Bestillingen er kansellert";
  return "Venter på godkjenning";
}

function orderShortMessage(order = {}) {
  const status = order.status || "pending";
  if (status === "accepted") return `Klar om cirka ${order.readyMinutes || 30} min.`;
  if (status === "cancelled") return "Restauranten har kansellert bestillingen.";
  return "Bestillingen er sendt. Vent på bekreftelse.";
}


function parseTimeParts(value = "") {
  const match = String(value).match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function getOrderingTimes() {
  const settings = normalizeSiteSettings(siteSettings);
  let open = parseTimeParts(settings.orderOpenTime);
  let close = parseTimeParts(settings.orderCloseTime);
  if (!open || !close) {
    const matches = String(settings.openingTime || "14:00 - 22:00").match(/\d{1,2}[:.]\d{2}/g) || [];
    open = open || parseTimeParts(matches[0] || "14:00");
    close = close || parseTimeParts(matches[1] || "22:00");
  }
  return {
    open: open || { hour: 14, minute: 0 },
    close: close || { hour: 22, minute: 0 },
    minPreorderMinutes: Math.max(0, Number(settings.minPreorderMinutes || 30) || 30)
  };
}

function dateWithTime(parts, base = new Date()) {
  const date = new Date(base);
  date.setHours(parts.hour, parts.minute, 0, 0);
  return date;
}

function isOrderingOpenNow() {
  const now = new Date();
  const times = getOrderingTimes();
  const openAt = dateWithTime(times.open, now);
  const closeAt = dateWithTime(times.close, now);
  return now >= openAt && now <= closeAt;
}

function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updatePickupControls() {
  if (!pickupTimeInput || !pickupHelp) return;
  const mode = document.querySelector('input[name="pickupMode"]:checked')?.value || "asap";
  const now = new Date();
  const times = getOrderingTimes();
  const minTime = new Date(now.getTime() + times.minPreorderMinutes * 60000);
  const closeAt = dateWithTime(times.close, now);
  pickupTimeInput.hidden = mode !== "later";
  pickupTimeInput.min = toDatetimeLocalValue(minTime);
  pickupTimeInput.max = toDatetimeLocalValue(closeAt);
  if (mode === "later" && (!pickupTimeInput.value || new Date(pickupTimeInput.value) < minTime)) {
    pickupTimeInput.value = toDatetimeLocalValue(minTime <= closeAt ? minTime : closeAt);
  }
  const openLabel = `${String(times.open.hour).padStart(2, "0")}:${String(times.open.minute).padStart(2, "0")}`;
  const closeLabel = `${String(times.close.hour).padStart(2, "0")}:${String(times.close.minute).padStart(2, "0")}`;
  pickupHelp.textContent = isOrderingOpenNow()
    ? `Bestilling er åpen ${openLabel}–${closeLabel}. Senere henting kan velges minst ${times.minPreorderMinutes} min frem i tid.`
    : `Bestilling er stengt nå. Bestilling kan sendes mellom ${openLabel}–${closeLabel}.`;
}

function getCustomerInfo() {
  return {
    firstName: customerFirstName?.value.trim() || "",
    lastName: customerLastName?.value.trim() || "",
    phone: customerPhone?.value.trim() || ""
  };
}

function validateCheckout() {
  const customer = getCustomerInfo();
  if (!cart.length) return "Handlekurven er tom.";
  if (!customer.firstName || !customer.lastName) return "Skriv inn navn og etternavn.";
  if (!/^\+?[0-9 ]{8,15}$/.test(customer.phone)) return "Skriv inn riktig telefonnummer.";
  if (!isOrderingOpenNow()) return "Bestilling er stengt akkurat nå.";
  const mode = document.querySelector('input[name="pickupMode"]:checked')?.value || "asap";
  if (mode === "later") {
    const chosen = new Date(pickupTimeInput.value);
    const times = getOrderingTimes();
    const now = new Date();
    const minTime = new Date(now.getTime() + times.minPreorderMinutes * 60000);
    const closeAt = dateWithTime(times.close, now);
    if (Number.isNaN(chosen.getTime()) || chosen < minTime || chosen > closeAt) {
      return `Velg hentetid mellom minst ${times.minPreorderMinutes} min fra nå og stengetid.`;
    }
  }
  return "";
}

function currentCartTotal() {
  return cart.reduce((sum, line) => sum + Number(line.total || 0), 0);
}

function buildOrderPayload() {
  const mode = document.querySelector('input[name="pickupMode"]:checked')?.value || "asap";
  return {
    status: "pending",
    createdAt: new Date().toISOString(),
    customer: getCustomerInfo(),
    pickup: {
      mode,
      time: mode === "later" ? new Date(pickupTimeInput.value).toISOString() : ""
    },
    items: cart.map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: line.quantity,
      size: line.size,
      sizeLabel: line.sizeLabel,
      extras: line.extras || [],
      extraIds: line.extraIds || [],
      note: line.note || "",
      total: line.total
    })),
    subtotal: currentCartTotal(),
    total: currentCartTotal(),
    source: "web"
  };
}

function orderLinesHtml(order = {}) {
  const lines = Array.isArray(order.items) ? order.items : [];
  if (!lines.length) return "";
  return `
    <div class="customer-receipt-lines">
      ${lines.map((line) => {
        const details = [line.sizeLabel || line.size, ...(line.extras || [])].filter(Boolean).join(" · ");
        return `
          <div class="customer-receipt-line">
            <div>
              <strong>${Number(line.quantity || 1)}x ${escapeAttribute(line.name || "Produkt")}</strong>
              ${details ? `<p>${escapeAttribute(details)}</p>` : ""}
              ${line.note ? `<p>${escapeAttribute(line.note)}</p>` : ""}
            </div>
            <strong>${formatPrice(line.total || 0)}</strong>
          </div>
        `;
      }).join("")}
      <div class="customer-receipt-total"><span>Sluttsum</span><strong>${formatPrice(order.total || 0)}</strong></div>
    </div>
  `;
}

function orderPickupText(order = {}) {
  if (order.pickup?.mode === "later" && order.pickup?.time) {
    return `Henting: ${new Date(order.pickup.time).toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
  }
  return "Henting: Snarest mulig";
}

function orderStatusHtml(order = {}, options = {}) {
  const status = order.status || "pending";
  const orderId = String(order.id || "").slice(-7).toUpperCase();
  const total = formatPrice(order.total || 0);
  return `
    <div class="order-live-status ${status}">
      <div class="order-status-head">
        <span class="order-status-pill ${status}">${orderStatusText(status)}</span>
        <small>Ordre ${orderId}</small>
      </div>
      <h3>${orderStatusTitle(status)}</h3>
      <p>${orderShortMessage(order)}</p>
      <div class="order-mini-info">
        <span>${orderPickupText(order)}</span>
        <strong>${total}</strong>
      </div>
    </div>
    ${options.includeReceipt ? orderLinesHtml(order) : ""}
  `;
}

function renderOrderStatus(order) {
  if (!orderStatusBox) return;
  if (!order) {
    orderStatusBox.hidden = true;
    return;
  }
  orderStatusBox.hidden = false;
  orderStatusBox.className = `order-status-box ${order.status || "pending"}`;
  orderStatusBox.innerHTML = orderStatusHtml(order, { includeReceipt: true });
}

function renderOrderLiveModal(order, forceOpen = false) {
  if (!orderLiveModal || !orderLiveContent || !order) return;
  orderLiveContent.innerHTML = orderStatusHtml(order, { includeReceipt: true });
  if (forceOpen || !orderLiveModal.hidden) {
    orderLiveModal.hidden = false;
    document.body.classList.add("order-live-open");
  }
}

function closeOrderLiveModal() {
  if (!orderLiveModal) return;
  orderLiveModal.hidden = true;
  document.body.classList.remove("order-live-open");
}

function renderRecentOrders() {
  if (!recentOrdersEl) return;
  recentOrdersEl.innerHTML = "";
}

function profileOrderCardHtml(order = {}) {
  const status = order.status || "pending";
  const isExpanded = expandedProfileOrderId === order.id;
  const unread = isOrderUnread(order);
  const title = orderStatusTitle(status);
  const itemsText = (order.items || []).map((line) => `${line.quantity}x ${line.name}`).join(", ") || "Ingen varer";
  return `
    <article class="profile-order-card ${status} ${unread ? "unread" : "read"}" data-profile-order-card="${escapeAttribute(order.id || "")}">
      <button class="profile-order-summary" type="button" data-profile-order-toggle="${escapeAttribute(order.id || "")}">
        <span>
          <strong>${title}</strong>
          <small>${orderPickupText(order)} · ${formatPrice(order.total || 0)}</small>
        </span>
        <span class="profile-order-side">
          <span class="read-pill ${unread ? "unread" : "read"}">${unread ? "Ulest" : "Lest"}</span>
          <span class="order-status-pill ${status}">${orderStatusText(status)}</span>
        </span>
      </button>
      ${isExpanded ? `<div class="profile-order-details">
        <p class="profile-order-message">${orderShortMessage(order)}</p>
        <p class="profile-order-items">${escapeAttribute(itemsText)}</p>
        ${orderLinesHtml(order)}
      </div>` : ""}
    </article>
  `;
}

function renderProfileOrders() {
  if (!profileOrdersEl) return;
  const orders = getRecentOrders().slice(0, 2);
  if (!orders.length) {
    profileOrdersEl.innerHTML = `<p class="profile-empty">Ingen bestillinger på denne enheten ennå.</p>`;
    return;
  }
  profileOrdersEl.innerHTML = `
    <div class="profile-order-list-note">Trykk på en bestilling for å se detaljer.</div>
    ${orders.map(profileOrderCardHtml).join("")}
  `;
}

function updateProfileDot() {
  if (!profileOrderDot) return;
  profileOrderDot.hidden = !getRecentOrders().some((order) => (order.status || "pending") === "pending" || isOrderUnread(order));
}

function openProfileModal() {
  syncRecentOrdersFromFirebase();
  renderProfileOrders();
  updateProfileDot();
  if (!profileModal) return;
  profileModal.hidden = false;
  profileToggle?.setAttribute("aria-expanded", "true");
  document.body.classList.add("profile-open");
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.hidden = true;
  profileToggle?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("profile-open");
}

async function syncRecentOrdersFromFirebase() {
  const orders = getRecentOrders();
  if (!orders.length) return;
  const updated = [];
  for (const order of orders.slice(0, 2)) {
    if (!order.id) continue;
    try {
      const fresh = await fetchOrder(order.id);
      updated.push(fresh || order);
    } catch {
      updated.push(order);
    }
  }
  updated.forEach((order) => rememberRecentOrder(order));
}

function startRecentOrdersSync() {
  window.clearInterval(recentOrdersPollTimer);
  if (!getRecentOrders().length) return;
  recentOrdersPollTimer = window.setInterval(syncRecentOrdersFromFirebase, 12000);
}


function resumeActiveOrderPolling() {
  const activeId = getActiveOrderId();
  const recentPending = getRecentOrders().find((order) => (order.status || "pending") === "pending");
  const orderId = activeId || recentPending?.id;
  if (orderId) startOrderPolling(orderId);
}

async function fetchOrder(orderId) {
  const response = await fetch(firebaseOrdersUrl.replace("orders.json", `orders/${orderId}.json?ts=${Date.now()}`), { cache: "no-store" });
  if (!response.ok) throw new Error("Kunne ikke lese ordre");
  const data = await response.json();
  return data ? { id: orderId, ...data } : null;
}

function startOrderPolling(orderId) {
  window.clearInterval(currentOrderPollTimer);
  currentOrderPollTimer = window.setInterval(async () => {
    try {
      const order = await fetchOrder(orderId);
      if (!order) return;
      rememberRecentOrder(order);
      renderOrderStatus(order);
      renderOrderLiveModal(order);
      renderCart();
      if (order.status === "accepted" || order.status === "cancelled") {
        window.clearInterval(currentOrderPollTimer);
        startRecentOrdersSync();
      }
    } catch (error) {
      console.warn(error);
    }
  }, 5000);
}

async function submitOrder() {
  const error = validateCheckout();
  if (error) {
    renderOrderStatus({ status: "cancelled", id: "", total: currentCartTotal(), items: [], readyMinutes: 0 });
    if (orderStatusBox) orderStatusBox.innerHTML = `<h3>Kan ikke sende bestilling</h3><p>${error}</p>`;
    if (orderLiveContent && orderLiveModal) {
      orderLiveContent.innerHTML = `<div class="order-live-status cancelled"><h3>Kan ikke sende bestilling</h3><p>${error}</p></div>`;
      orderLiveModal.hidden = false;
      document.body.classList.add("order-live-open");
    }
    return;
  }
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Sender...";
  try {
    saveCustomerInfo();
    const payload = buildOrderPayload();
    const response = await fetch(firebaseOrdersUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Firebase svarte ikke");
    const result = await response.json();
    const order = { id: result.name, ...payload };
    rememberRecentOrder(order);
    startRecentOrdersSync();
    renderOrderStatus(order);
    renderOrderLiveModal(order, true);
    startOrderPolling(result.name);
    cart = [];
    saveCart();
    renderCart();
  } catch (error) {
    console.error(error);
    if (orderStatusBox) {
      orderStatusBox.hidden = false;
      orderStatusBox.className = "order-status-box cancelled";
      orderStatusBox.innerHTML = "<h3>Bestillingen kunne ikke sendes</h3><p>Prøv igjen, eller ring restauranten.</p>";
    }
  } finally {
    checkoutButton.textContent = "Send bestilling";
    checkoutButton.disabled = cart.length === 0 || !isOrderingOpenNow();
  }
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

// DEFAULT GÖRSEL NOTU:
// Ürün/kategori resmi yoksa sistem önce siteSettings.defaultImageUrl kullanır.
// O da yoksa CSS ile çizilmiş sade, hazır bir default görsel gösterir.
function getDefaultImageUrl() {
  return (siteSettings?.defaultImageUrl || "").trim();
}

function thumbClassForItem(item = {}) {
  return escapeAttribute(item.thumb || item.type || "default-food");
}

function renderThumb(item) {
  const imageUrl = item.imageUrl || getDefaultImageUrl();
  if (imageUrl) {
    return `<span class="food-thumb custom-thumb default-ready" aria-hidden="true"><img src="${escapeAttribute(imageUrl)}" alt="" onerror="this.closest('.food-thumb')?.classList.remove('custom-thumb'); this.remove();"></span>`;
  }
  return `<span class="food-thumb default-thumb ${thumbClassForItem(item)}" aria-hidden="true"></span>`;
}

function renderCategoryPhoto(section) {
  const imageUrl = section.imageUrl || getDefaultImageUrl();
  const style = imageUrl ? ` style="background-image: url('${escapeAttribute(imageUrl)}')"` : "";
  const classes = imageUrl ? "category-photo custom-category-photo" : `category-photo default-category-photo ${escapeAttribute(section.imageClass || "")}`;
  return `<div class="${classes}" aria-hidden="true"${style}></div>`;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}


// Türkçe not: Admin panelde ürün/kategori gizleme ve utsolgt burada kontrol edilir.
// hidden=true: müşteri tarafında hiç gösterilmez.
// soldOut=true veya soldOutUntil gelecekteyse: müşteri UTSOLGT görür ama sepete ekleyemez.
function isDateInFuture(value = "") {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function isHiddenItem(item = {}) {
  return item.hidden === true;
}

function isSoldOutItem(item = {}, parentSoldOut = false) {
  return parentSoldOut || item.soldOut === true || isDateInFuture(item.soldOutUntil || "");
}

function visibleMenuItems(section = {}) {
  return asArray(section.items).filter((item) => !isHiddenItem(item));
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
    hasExplicitOptionGroups,
    siteSettings: normalizeSiteSettings(config?.siteSettings)
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
  siteSettings = normalized.siteSettings;
  applySiteSettings();
  return true;
}


function formatAddress(settings = siteSettings) {
  return [settings.streetAddress, [settings.postalCode, settings.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function getRestaurantInitials(name = "Restaurant") {
  const words = String(name).replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "R";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

// TÜRKÇE: Logo URL boşsa KØL yazısı gibi özel bir logo basmıyoruz.
// Bunun yerine kategori kartlarında kullandığımız sade default görsel mantığı kullanılır.
function applyHeroDefaultVisual(settings = siteSettings) {
  if (!brandHero) return;
  const defaultVisualUrl = (settings?.defaultImageUrl || "").trim();
  brandHero.classList.remove("has-logo-url");
  brandHero.classList.add("default-hero-visual");
  if (defaultVisualUrl) {
    brandHero.classList.add("has-default-image-url");
    brandHero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.08), rgba(0,0,0,0.08)), url("${defaultVisualUrl.replace(/"/g, '\"')}")`;
    brandHero.style.backgroundSize = "cover";
    brandHero.style.backgroundPosition = "center";
  } else {
    brandHero.classList.remove("has-default-image-url");
    brandHero.style.removeProperty("background-image");
    brandHero.style.removeProperty("background-size");
    brandHero.style.removeProperty("background-position");
  }
}

function applySiteSettings() {
  const settings = normalizeSiteSettings(siteSettings);
  const name = settings.restaurantName || "Restaurant";
  const logoUrl = (settings.logoUrl || "").trim();

  document.title = name;
  if (siteNameText) siteNameText.textContent = name.toUpperCase();
  if (brandDefaultTitle) brandDefaultTitle.textContent = name;
  if (brandDefaultInitials) brandDefaultInitials.textContent = getRestaurantInitials(name);

  // LOGO: Admin panelinden verilen URL varsa ana sayfadaki büyük logoyu bu resimle değiştirir.
  // URL boşsa yazı/logo basılmaz; kategori default görseli gibi sade bir alan gösterilir.
  if (brandHero && brandLogoImage) {
    if (logoUrl) {
      brandHero.style.removeProperty("background-image");
      brandHero.style.removeProperty("background-size");
      brandHero.style.removeProperty("background-position");
      brandHero.classList.remove("default-hero-visual", "has-default-image-url");
      brandLogoImage.src = logoUrl;
      brandLogoImage.hidden = false;
      brandHero.classList.add("has-logo-url");
    } else {
      brandLogoImage.removeAttribute("src");
      brandLogoImage.hidden = true;
      applyHeroDefaultVisual(settings);
    }
  }

  if (infoTitle) infoTitle.textContent = name;
  if (mapLabel) mapLabel.innerHTML = `${escapeAttribute(name)}${settings.city ? ` | ${escapeAttribute(settings.city)}` : ""}`;
  if (openingDaysText) openingDaysText.textContent = settings.openingDays || "";
  if (openingTimeText) openingTimeText.textContent = settings.openingTime || "";
  if (pickupInfoText) pickupInfoText.textContent = settings.pickupInfo || "";
  if (paymentInfoText) paymentInfoText.textContent = settings.paymentInfo || "";
  if (addressText) addressText.textContent = formatAddress(settings);
  if (phoneText) phoneText.textContent = settings.phone || "";
}

function readCachedMenuConfig() {
  try {
    const cached = localStorage.getItem(menuCacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed?.config || null;
  } catch (error) {
    console.warn("Lokal meny-cache kunne ikke leses.", error);
    return null;
  }
}

function saveCachedMenuConfig(config) {
  try {
    localStorage.setItem(menuCacheKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      config
    }));
  } catch (error) {
    // TÜRKÇE: LocalStorage dolu/kapalı olabilir. Bu kritik değil; site Firebase ile çalışmaya devam eder.
    console.warn("Lokal meny-cache kunne ikke lagres.", error);
  }
}

function menuConfigSignature(config) {
  try {
    return JSON.stringify(config || {});
  } catch {
    return String(Date.now());
  }
}

function finishMenuLoading() {
  document.body.classList.remove("menu-loading");
  menuSectionsEl?.classList.add("menu-ready");
}

async function loadMenuConfig() {
  const cachedConfig = readCachedMenuConfig();
  let cachedSignature = "";
  let renderedFromCache = false;

  // TÜRKÇE: Önce son başarılı menüyü hemen gösteriyoruz.
  // Bu, yenilemede oluşan göz kırpmasını engeller.
  if (cachedConfig && applyMenuConfig(cachedConfig)) {
    cachedSignature = menuConfigSignature(cachedConfig);
    visibleSectionLimit = firstMenuBatchSize;
    renderMenu();
    finishMenuLoading();
    renderedFromCache = true;
  }

  try {
    const response = await fetch(`${firebaseMenuUrl}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kunne ikke hente meny");
    const config = await response.json();
    const freshSignature = menuConfigSignature(config);

    if (applyMenuConfig(config)) {
      saveCachedMenuConfig(config);
      if (!renderedFromCache || freshSignature !== cachedSignature) {
        visibleSectionLimit = firstMenuBatchSize;
        renderMenu();
      }
    } else if (!renderedFromCache) {
      menuSections = [];
      renderMenu();
    }
  } catch (error) {
    if (!renderedFromCache) {
      menuSections = [];
      renderMenu();
    }
    console.warn("Menyen kunne ikke lastes fra Firebase.", error);
  } finally {
    finishMenuLoading();
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
      id: size.id ? makeSlug(size.id) : normalizeSizeId(size.label || size.name, size.id),
      label: size.label || size.name || defaultLabelForSize(size.id),
      price: Number(size.price),
      default: size.default === true || size.isDefault === true || item?.defaultSizeId === (size.id ? makeSlug(size.id) : normalizeSizeId(size.label || size.name, size.id))
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
  // Türkçe not: optionGroupIds = bütün boylarda ortak gruplar.
  // optionGroupIdsBySize[selectedSize] = sadece seçilen boy için özel gruplar.
  const commonIds = asArray(selectedProduct?.optionGroupIds);
  const sizeSpecificIds = asArray(selectedProduct?.optionGroupIdsBySize?.[selectedSize]);
  const ids = [...new Set([...commonIds, ...sizeSpecificIds])];
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
  if (!statusNotice) return;
  const times = getOrderingTimes();
  const openLabel = `${String(times.open.hour).padStart(2, "0")}:${String(times.open.minute).padStart(2, "0")}`;
  const closeLabel = `${String(times.close.hour).padStart(2, "0")}:${String(times.close.minute).padStart(2, "0")}`;
  const isOpen = isOrderingOpenNow();
  statusNotice.hidden = isOpen;
  statusNotice.textContent = isOpen
    ? ""
    : `Vi har for øyeblikket stengt for bestilling. Bestilling kan sendes mellom ${openLabel} - ${closeLabel}.`;
}

function disconnectMenuLazyLoader() {
  if (lazyMenuObserver) {
    lazyMenuObserver.disconnect();
    lazyMenuObserver = null;
  }
  if (lazyScrollHandler) {
    window.removeEventListener("scroll", lazyScrollHandler);
    lazyScrollHandler = null;
  }
}

function showMoreMenuSections(totalSections) {
  if (visibleSectionLimit >= totalSections) return;
  visibleSectionLimit = Math.min(visibleSectionLimit + nextMenuBatchSize, totalSections);
  renderMenu();
}

function setupMenuLazyLoader(totalSections) {
  disconnectMenuLazyLoader();
  const trigger = document.querySelector("[data-menu-lazy-trigger]");
  if (!trigger || visibleSectionLimit >= totalSections) return;

  // TÜRKÇE: Kategoriler hepsi birden basılmasın diye aşağı indikçe yeni bölüm açılır.
  if ("IntersectionObserver" in window) {
    lazyMenuObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        showMoreMenuSections(totalSections);
      }
    }, { rootMargin: "520px 0px" });
    lazyMenuObserver.observe(trigger);
    return;
  }

  lazyScrollHandler = () => {
    const rect = trigger.getBoundingClientRect();
    if (rect.top < window.innerHeight + 520) showMoreMenuSections(totalSections);
  };
  window.addEventListener("scroll", lazyScrollHandler, { passive: true });
}

function renderMenu() {
  const visibleSections = menuSections
    .filter((section) => !isHiddenItem(section))
    .map((section) => ({ ...section, items: visibleMenuItems(section) }))
    .filter((section) => section.items.length);

  if (!visibleSections.length) {
    disconnectMenuLazyLoader();
    menuSectionsEl.innerHTML = `
      <section class="category-panel">
        <p class="category-note">Menyen er ikke tilgjengelig akkurat n&aring;.</p>
      </section>
    `;
    return;
  }

  const sectionsToRender = visibleSections.slice(0, visibleSectionLimit);
  const hasMoreSections = visibleSectionLimit < visibleSections.length;

  menuSectionsEl.innerHTML = sectionsToRender
    .map((section) => {
      const sectionSoldOut = isSoldOutItem(section);
      return `
        <section class="category-panel ${sectionSoldOut ? "category-sold-out" : ""}" data-section="${section.id}">
          <button class="category-title" type="button" data-toggle-section="${section.id}">
            <span>${section.title}${sectionSoldOut ? ' <em class="soldout-small">UTSOLGT</em>' : ""}</span>
            <span>&#9662;</span>
          </button>
          ${section.note ? `<p class="category-note">${section.note}</p>` : ""}
          ${renderCategoryPhoto(section)}
          <div class="menu-list">
            ${section.items
              .map((item) => {
                const rowSoldOut = isSoldOutItem(item, sectionSoldOut);
                const price = item.displayPrice ?? getBasePrice(item, getDefaultProductSizeId(item));
                const prefix = item.number ? `${item.number}- ` : "";
                const details = item.ingredients || "";
                return `
                  <button class="menu-row ${rowSoldOut ? "sold-out" : ""}" type="button" data-product="${item.id}" ${rowSoldOut ? 'disabled aria-disabled="true"' : ""}>
                    ${renderThumb(item)}
                    <span class="menu-row-main">
                      <strong>${prefix}${item.name.toUpperCase()}</strong>
                      <span>${details}</span>
                    </span>
                    <strong class="row-price">${rowSoldOut ? "UTSOLGT" : formatPrice(price)}</strong>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("") +
    (hasMoreSections
      ? `<div class="menu-lazy-trigger" data-menu-lazy-trigger>Flere kategorier lastes når du blar ned...</div>`
      : "");

  setupMenuLazyLoader(visibleSections.length);
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
  const productPhoto = document.querySelector(".product-photo");
  const modalImageUrl = selectedProduct.imageUrl || getDefaultImageUrl();
  if (productPhoto) {
    productPhoto.style.backgroundImage = modalImageUrl ? `url("${modalImageUrl}")` : "";
    productPhoto.classList.toggle("default-product-photo", !modalImageUrl);
  }
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
  if (!result.item || isHiddenItem(result.section) || isHiddenItem(result.item) || isSoldOutItem(result.section) || isSoldOutItem(result.item, isSoldOutItem(result.section))) return;
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



// ============================================================
// SEPET ANİMASYON MODÜLÜ BAĞLANTISI
// ------------------------------------------------------------
// Bu bölüm küçük bir köprü gibi çalışır.
// modules/cart-animation.js dosyası varsa animasyon çalışır.
// Dosyayı silersen sistem bozulmaz; sadece animasyon kapanır.
// ============================================================
function getCartAnimationModule() {
  return window.KOLModules && window.KOLModules.cartAnimation;
}

function wiggleCart(duration = 2000) {
  const module = getCartAnimationModule();
  if (module && typeof module.wiggleCart === "function") {
    module.wiggleCart({ cartToggle, duration });
  }
}

function scheduleCartReminder() {
  const module = getCartAnimationModule();
  if (module && typeof module.scheduleReminder === "function") {
    module.scheduleReminder({
      hasItems: cart.length > 0,
      cartModal,
      cartToggle,
      intervalMs: 20000,
      duration: 2000
    });
  }
}

function animateProductIntoCart() {
  const module = getCartAnimationModule();
  if (module && typeof module.animateProductIntoCart === "function") {
    return module.animateProductIntoCart({ productModal, cartToggle });
  }

  // Modül yoksa: animasyon yapmadan normal devam et.
  wiggleCart(2000);
  return Promise.resolve();
}

function getCartStatusOrder() {
  const orders = getRecentOrders();
  return orders.find((order) => (order.status || "pending") === "pending") || orders[0] || null;
}

// Sepetin ekrandaki adet, toplam ve ürün listesini yeniler.
function renderCart() {
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.total, 0);
  const taxValue = Math.round((cartSubtotal * 15 / 115) * 100) / 100;
  const statusOrder = getCartStatusOrder();
  const showOnlyOrderStatus = cart.length === 0 && Boolean(statusOrder);

  if (cartPanel) cartPanel.classList.toggle("cart-order-only", showOnlyOrderStatus);
  if (cartTitle) cartTitle.textContent = showOnlyOrderStatus ? "Bestillingsstatus" : "Handlekurv";

  cartCount.textContent = itemCount;
  subtotal.textContent = formatPrice(cartSubtotal);
  tax.textContent = formatPrice(taxValue);
  total.textContent = formatPrice(cartSubtotal);
  cartEmpty.hidden = cart.length > 0 || showOnlyOrderStatus;
  cartItems.hidden = cart.length === 0;
  cartSummary.hidden = cart.length === 0 && !showOnlyOrderStatus;
  clearCart.hidden = cart.length === 0;
  checkoutButton.disabled = cart.length === 0 || !isOrderingOpenNow();

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

  if (showOnlyOrderStatus && orderStatusBox) {
    orderStatusBox.hidden = false;
    orderStatusBox.className = `order-status-box ${statusOrder.status || "pending"}`;
    orderStatusBox.innerHTML = orderStatusHtml(statusOrder, { includeReceipt: true });
  } else if (orderStatusBox) {
    orderStatusBox.hidden = true;
  }

  updatePickupControls();
  renderRecentOrders();
  scheduleCartReminder();
}

// Ürün sepete eklendiğinde çalışan ana fonksiyon.
async function addConfiguredToCart() {
  if (addingToCart) return;
  addingToCart = true;
  if (addConfiguredProduct) addConfiguredProduct.disabled = true;

  try {
    const line = buildCartLine();
    if (editingCartIndex === null) cart.push(line);
    else cart[editingCartIndex] = line;
    saveCart();
    renderCart();

    await animateProductIntoCart();
    closeProductModal();
  } finally {
    addingToCart = false;
    if (addConfiguredProduct) addConfiguredProduct.disabled = false;
  }
}

// Sepete müşteri tıklayınca sepet panelini açar.
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
cartToggle.addEventListener("click", () => { updatePickupControls(); renderRecentOrders(); openCart(); });
checkoutButton.addEventListener("click", submitOrder);
document.querySelectorAll('input[name="pickupMode"]').forEach((input) => input.addEventListener("change", updatePickupControls));
if (pickupTimeInput) pickupTimeInput.addEventListener("change", updatePickupControls);
[customerFirstName, customerLastName, customerPhone].forEach((field) => {
  if (!field) return;
  field.addEventListener("change", saveCustomerInfo);
  field.addEventListener("blur", saveCustomerInfo);
});

if (profileToggle) profileToggle.addEventListener("click", openProfileModal);

if (profileOrdersEl) {
  profileOrdersEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-order-toggle]");
    if (!button) return;
    const orderId = button.dataset.profileOrderToggle;
    expandedProfileOrderId = expandedProfileOrderId === orderId ? "" : orderId;
    if (expandedProfileOrderId) markOrderAsRead(orderId);
    renderProfileOrders();
  });
}

if (closeProfile) closeProfile.addEventListener("click", closeProfileModal);
if (profileModal) {
  profileModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeProfile !== undefined) closeProfileModal();
  });
}
if (closeOrderLive) closeOrderLive.addEventListener("click", closeOrderLiveModal);
if (orderLiveModal) {
  orderLiveModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeOrderLive !== undefined) closeOrderLiveModal();
  });
}

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
  if (orderLiveModal && !orderLiveModal.hidden) closeOrderLiveModal();
  if (profileModal && !profileModal.hidden) closeProfileModal();
  if (!productModal.hidden) closeProductModal();
  if (!infoModal.hidden) closeInfoModal();
  if (!cartModal.hidden) closeCartModal();
});

async function init() {
  applySiteSettings();
  await loadMenuConfig();
  prefillCustomerInfo();
  updatePickupControls();
  renderRecentOrders();
  renderProfileOrders();
  updateProfileDot();
  resumeActiveOrderPolling();
startRecentOrdersSync();
  renderCart();
  updateOpeningNotice();
}

init();
