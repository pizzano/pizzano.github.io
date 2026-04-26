const menuSections = [
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
      { id: "fantasia", number: 15, name: "Fantasia", ingredients: "Skinke, mais, l\u00f8k", price: 189, thumb: "mixed" },
      { id: "diavola", number: 16, name: "Diavola", ingredients: "Pepperoni, solt\u00f8rket tomater, sopp og gorgonzola ost.", price: 199, thumb: "spicy" },
      { id: "lag-din-egen", number: 17, name: "Lag din egen", ingredients: "Legg til de ingrediensene du \u00f8nsker! Ost og pizzasaus er inkludert.", price: 159, thumb: "pepperoni" },
      { id: "hvitloksdressing", name: "Hvitl\u00f8ksdressing", ingredients: "", price: 25, thumb: "sauce" },
      { id: "bearnaisesaus-product", name: "B\u00e9arnaisesaus", ingredients: "", price: 25, thumb: "sauce" }
    ]
  },
  {
    id: "kebab",
    title: "KEBAB RETTER",
    note: "",
    imageClass: "kebab-strip",
    items: [
      { id: "kebab-pita", name: "Kebab i pita", ingredients: "Med hjemmebakt pitabr\u00f8d, ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 179, thumb: "kebab" },
      { id: "kylling-pita", name: "Kylling kebab i pita", ingredients: "Med hjemmebakt pitabr\u00f8d, kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 179, thumb: "kebab" },
      { id: "kebab-rull", name: "Kebab Rull", ingredients: "Hjemmebakt lefsebr\u00f8d med ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 195, thumb: "wrap" },
      { id: "kylling-rull", name: "Kylling Kebab Rull", ingredients: "Hjemmebakt lefsebr\u00f8d med kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus", price: 195, thumb: "wrap" },
      { id: "kebabtallerken", name: "Kebabtallerken", ingredients: "Med ekte d\u00f6ner kebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hvitl\u00f8ksaus, pommes", price: 229, thumb: "plate" },
      { id: "kylling-kebabtallerken", name: "Kylling Kebabtallerken", ingredients: "Med kyllingkebabkj\u00f8tt, salat, r\u00f8dl\u00f8k, agurk, hjemmelaget hvitl\u00f8ksaus, pommes", price: 229, thumb: "plate" }
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

const extraOptions = [
  { id: "fries", label: "Pommes frites p\u00e5 pizzaen?", price: 39, pizzaOnly: true },
  { id: "extra-base", label: "Extra bunn - 300g deig?", price: 49, pizzaOnly: true },
  { id: "garlic", label: "Hvitl\u00f8ksaus", price: 25 },
  { id: "bearnaise", label: "B\u00e9arnaisesaus", price: 25 }
];

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
const productModal = document.querySelector("#productModal");
const productTitle = document.querySelector("#productTitle");
const productSummary = document.querySelector("#productSummary");
const optionGroups = document.querySelector("#optionGroups");
const specialInstructions = document.querySelector("#specialInstructions");
const productQuantity = document.querySelector("#productQuantity");
const productTotal = document.querySelector("#productTotal");
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
    const item = section.items.find((product) => product.id === id);
    if (item) return { item, section };
  }
  return {};
}

function hasSizes(item) {
  return item.mediumPrice !== undefined && item.largePrice !== undefined;
}

function getBasePrice(item, size) {
  if (!hasSizes(item)) return item.price;
  return size === "large" ? item.largePrice : item.mediumPrice;
}

function getVisibleExtras() {
  return extraOptions.filter((option) => selectedSection.id === "pizza" || !option.pizzaOnly);
}

function getCurrentUnitPrice() {
  const extrasTotal = getVisibleExtras()
    .filter((option) => selectedExtras.has(option.id))
    .reduce((sum, option) => sum + option.price, 0);
  return getBasePrice(selectedProduct, selectedSize) + extrasTotal;
}

function getCurrentTotal() {
  return getCurrentUnitPrice() * quantity;
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
  menuSectionsEl.innerHTML = menuSections
    .map(
      (section) => `
        <section class="category-panel" data-section="${section.id}">
          <button class="category-title" type="button" data-toggle-section="${section.id}">
            <span>${section.title}</span>
            <span>&#9662;</span>
          </button>
          ${section.note ? `<p class="category-note">${section.note}</p>` : ""}
          <div class="category-photo ${section.imageClass}" aria-hidden="true"></div>
          <div class="menu-list">
            ${section.items
              .map((item) => {
                const price = item.displayPrice || (hasSizes(item) ? item.mediumPrice : item.price);
                const prefix = item.number ? `${item.number}- ` : "";
                const details = hasSizes(item)
                  ? `<b>Medium</b> ${item.mediumPrice}kr | <b>Stor</b> ${item.largePrice}kr \u2192 ${item.ingredients}`
                  : item.ingredients;
                return `
                  <button class="menu-row" type="button" data-product="${item.id}">
                    <span class="food-thumb ${item.thumb}" aria-hidden="true"></span>
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
  const sizeOptions = hasSizes(selectedProduct)
    ? `
      <section class="option-group">
        <h3>St\u00f8rrelse <span>Obligatorisk</span></h3>
        <label class="option-line ${selectedSize === "medium" ? "selected" : ""}">
          <input type="radio" name="size" value="medium" ${selectedSize === "medium" ? "checked" : ""}>
          <span>Medium Pizza</span>
        </label>
        <label class="option-line ${selectedSize === "large" ? "selected" : ""}">
          <input type="radio" name="size" value="large" ${selectedSize === "large" ? "checked" : ""}>
          <span>STOR PIZZA</span>
          <strong>+${selectedProduct.largePrice - selectedProduct.mediumPrice},00</strong>
        </label>
      </section>
      <section class="option-group">
        <h3>Lojalitetsprogram!</h3>
        <label class="option-line muted-option">
          <input type="checkbox" checked disabled>
          <span>Hver 11. pizza gratis! Legges til automatisk.</span>
        </label>
      </section>
    `
    : "";

  optionGroups.innerHTML = `
    ${sizeOptions}
    <section class="option-group">
      <h3>Ekstra valg</h3>
      ${getVisibleExtras()
        .map(
          (option) => `
            <label class="option-line ${selectedExtras.has(option.id) ? "selected" : ""}">
              <input type="checkbox" value="${option.id}" ${selectedExtras.has(option.id) ? "checked" : ""}>
              <span>${option.label}</span>
              <strong>+${option.price},00</strong>
            </label>
          `
        )
        .join("")}
    </section>
  `;
}

function renderProductModal() {
  const titlePrefix = selectedProduct.number ? `${selectedProduct.number}- ` : "";
  productTitle.textContent = `${titlePrefix}${selectedProduct.name.toUpperCase()}`;
  productSummary.innerHTML = hasSizes(selectedProduct)
    ? `<b>Medium</b> ${selectedProduct.mediumPrice}kr | <b>Stor</b> ${selectedProduct.largePrice}kr \u2192 ${selectedProduct.ingredients}`
    : selectedProduct.ingredients;
  productQuantity.textContent = quantity;
  productTotal.textContent = formatPrice(getCurrentTotal()).toUpperCase();
  renderProductOptions();
}

function openProduct(id) {
  const result = findProduct(id);
  selectedProduct = result.item;
  selectedSection = result.section;
  selectedSize = hasSizes(selectedProduct) ? "large" : "regular";
  selectedExtras = new Set();
  quantity = 1;
  specialInstructions.value = "";
  renderProductModal();
  productModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  productModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function renderCart() {
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.total, 0);
  const taxValue = Math.round(cartSubtotal * 0.15 * 100) / 100;

  cartCount.textContent = itemCount;
  subtotal.textContent = formatPrice(cartSubtotal);
  tax.textContent = formatPrice(taxValue);
  total.textContent = formatPrice(cartSubtotal);
  cartEmpty.hidden = cart.length > 0;
  cartSummary.hidden = cart.length === 0;
  clearCart.disabled = cart.length === 0;

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
          <button class="remove-button" type="button" data-remove="${index}">&times;</button>
        </article>
      `
    )
    .join("");
}

function addConfiguredToCart() {
  const selectedExtraLines = getVisibleExtras().filter((option) => selectedExtras.has(option.id));
  const titlePrefix = selectedProduct.number ? `${selectedProduct.number}- ` : "";
  cart.push({
    id: `${selectedProduct.id}-${Date.now()}`,
    productId: selectedProduct.id,
    name: `${titlePrefix}${selectedProduct.name.toUpperCase()}`,
    size: selectedSize,
    sizeLabel: hasSizes(selectedProduct)
      ? selectedSize === "large" ? "St\u00f8rrelse: STOR PIZZA" : "St\u00f8rrelse: Medium Pizza"
      : "St\u00f8rrelse: Standard",
    extras: selectedExtraLines.map((option) => option.label),
    quantity,
    unitPrice: getCurrentUnitPrice(),
    total: getCurrentTotal(),
    note: specialInstructions.value.trim()
  });
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
  const row = event.target.closest("[data-product]");
  if (row) openProduct(row.dataset.product);
});

optionGroups.addEventListener("change", (event) => {
  if (event.target.name === "size") selectedSize = event.target.value;
  if (event.target.type === "checkbox" && event.target.value) {
    if (event.target.checked) selectedExtras.add(event.target.value);
    else selectedExtras.delete(event.target.value);
  }
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
closeCart.addEventListener("click", closeCartModal);
backToMenu.addEventListener("click", closeCartModal);

cartModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeCart !== undefined) closeCartModal();
});

infoModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeInfo !== undefined) closeInfoModal();
});

cartItems.addEventListener("click", (event) => {
  const index = event.target.dataset.remove;
  if (index === undefined) return;
  cart.splice(Number(index), 1);
  saveCart();
  renderCart();
});

clearCart.addEventListener("click", () => {
  cart = [];
  saveCart();
  renderCart();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!productModal.hidden) closeProductModal();
  if (!infoModal.hidden) closeInfoModal();
  if (!cartModal.hidden) closeCartModal();
});

renderMenu();
renderCart();
updateOpeningNotice();
