from pathlib import Path

path = Path('test/index.html')
text = path.read_text(encoding='utf-8')
marker = '/* ===== KOL SEARCH + ALLERGEN UI V1 ===== */'

if marker in text:
    print('Search/allergen UI already present')
    raise SystemExit(0)

style = r'''
<style id="kol-search-allergen-style">
body.kol-customer .kol-rail-search{flex:0 0 48px!important;width:48px!important;min-width:48px!important;height:48px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:#fff!important;color:#191919!important;box-shadow:none!important}
body.kol-customer .kol-rail-search svg{width:21px!important;height:21px!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
body.kol-customer .kol-search-rail{width:100%!important;height:48px!important;display:grid!important;grid-template-columns:1fr auto!important;align-items:center!important;gap:8px!important;padding:0 12px!important;background:#fff!important}
body.kol-customer .kol-search-input-wrap{min-width:0!important;height:44px!important;display:flex!important;align-items:center!important;gap:9px!important}
body.kol-customer .kol-search-input-wrap svg{flex:0 0 20px!important;width:20px!important;height:20px!important;fill:none!important;stroke:#171717!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
body.kol-customer .kol-search-input{width:100%!important;height:44px!important;margin:0!important;padding:0!important;border:0!important;outline:0!important;background:#fff!important;color:#171717!important;font-size:16px!important;font-weight:400!important;box-shadow:none!important}
body.kol-customer .kol-search-input::placeholder{color:#8a8d91!important}
body.kol-customer .kol-search-cancel{height:40px!important;margin:0!important;padding:0 2px 0 10px!important;border:0!important;background:transparent!important;color:#171717!important;font-size:15px!important;font-weight:500!important;box-shadow:none!important}
body.kol-customer .kol-menu-tools{min-height:62px!important;padding:10px 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;border-bottom:1px solid #e7e2de!important;background:#fff!important}
body.kol-customer .kol-menu-tools-title{margin:0!important;color:#26211e!important;font-size:18px!important;font-weight:550!important;line-height:1.2!important}
body.kol-customer .kol-allergen-trigger{min-height:42px!important;margin:0!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;border:1px solid #e5e1de!important;border-radius:12px!important;background:#fff!important;color:#2b2724!important;font-size:14px!important;font-weight:500!important;box-shadow:none!important;white-space:nowrap!important}
body.kol-customer .kol-allergen-trigger .kol-warning{font-size:18px!important;line-height:1!important}
body.kol-customer .kol-allergen-count{min-width:22px!important;height:22px!important;padding:0 6px!important;display:inline-grid!important;place-items:center!important;border-radius:999px!important;background:#111!important;color:#fff!important;font-size:12px!important;font-weight:650!important}
body.kol-customer .kol-search-screen{width:100%!important;margin:0!important;padding:0!important;background:#fff!important}
body.kol-customer .kol-search-summary{padding:20px 14px 12px!important;border-bottom:1px solid #eee9e5!important;background:#fff!important}
body.kol-customer .kol-search-summary-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
body.kol-customer .kol-search-summary h2{margin:0!important;color:#211e1b!important;font-size:22px!important;font-weight:550!important;line-height:1.25!important}
body.kol-customer .kol-search-clear{min-height:34px!important;padding:0 10px!important;border:0!important;border-radius:999px!important;background:#f0f1f2!important;color:#404246!important;font-size:13px!important;font-weight:500!important;box-shadow:none!important}
body.kol-customer .kol-search-subrow{margin-top:14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
body.kol-customer .kol-search-count{color:#2d2926!important;font-size:15px!important;font-weight:500!important}
body.kol-customer .kol-search-empty{padding:34px 18px!important;color:#77716c!important;font-size:15px!important;line-height:1.5!important;text-align:center!important}
body.kol-customer .kol-allergen-warning{margin-top:3px!important;display:inline-flex!important;align-items:center!important;gap:5px!important;color:#8a4d00!important;font-size:12px!important;font-weight:600!important;line-height:1.3!important}
body.kol-customer .kol-allergen-warning::before{content:'⚠';font-size:13px!important}
body.kol-customer .kol-allergen-modal{position:fixed!important;z-index:9000!important;inset:0!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;background:rgba(20,20,20,.26)!important}
body.kol-customer .kol-allergen-modal[hidden]{display:none!important}
body.kol-customer .kol-allergen-sheet{position:relative!important;width:min(100vw,480px)!important;max-width:480px!important;height:min(92dvh,760px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:28px 28px 0 0!important;background:#fff!important;box-shadow:0 -12px 40px rgba(0,0,0,.16)!important}
body.kol-customer .kol-allergen-head{position:relative!important;padding:25px 46px 12px!important;text-align:center!important;background:#fff!important}
body.kol-customer .kol-allergen-head h2{margin:0!important;color:#171717!important;font-size:24px!important;font-weight:550!important;line-height:1.2!important}
body.kol-customer .kol-allergen-head p{margin:10px 0 0!important;color:#343434!important;font-size:14px!important;line-height:1.35!important}
body.kol-customer .kol-allergen-close{position:absolute!important;top:14px!important;right:14px!important;width:34px!important;height:34px!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;background:#050505!important;color:#fff!important;font-size:25px!important;font-weight:400!important;line-height:1!important;box-shadow:none!important}
body.kol-customer .kol-allergen-search-wrap{margin:12px 12px 8px!important;height:46px!important;padding:0 14px!important;display:flex!important;align-items:center!important;gap:9px!important;border-radius:999px!important;background:#f0f1f2!important}
body.kol-customer .kol-allergen-search-wrap svg{width:19px!important;height:19px!important;fill:none!important;stroke:#8b9095!important;stroke-width:2!important}
body.kol-customer .kol-allergen-search{width:100%!important;height:40px!important;margin:0!important;padding:0!important;border:0!important;outline:0!important;background:transparent!important;color:#171717!important;font-size:15px!important;box-shadow:none!important}
body.kol-customer .kol-allergen-selected-row{min-height:36px!important;padding:0 12px 8px!important;display:flex!important;align-items:center!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important}
body.kol-customer .kol-allergen-selected-row:empty{display:none!important}
body.kol-customer .kol-allergen-chip{flex:0 0 auto!important;min-height:32px!important;padding:0 11px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;border:0!important;border-radius:999px!important;background:#f0f1f2!important;color:#656b70!important;font-size:12px!important;font-weight:500!important}
body.kol-customer .kol-allergen-chip b{font-size:16px!important;font-weight:400!important}
body.kol-customer .kol-allergen-grid-scroll{min-height:0!important;flex:1 1 auto!important;overflow-y:auto!important;padding:10px 12px 118px!important;-webkit-overflow-scrolling:touch!important}
body.kol-customer .kol-allergen-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
body.kol-customer .kol-allergen-option{min-height:76px!important;margin:0!important;padding:9px 5px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:1px solid #e0e2e4!important;border-radius:12px!important;background:#fff!important;color:#81868a!important;font-size:13px!important;font-weight:500!important;box-shadow:none!important}
body.kol-customer .kol-allergen-option.selected{border-color:#555!important;background:#f3f4f4!important;color:#111!important}
body.kol-customer .kol-allergen-symbol{font-size:20px!important;line-height:1!important;filter:grayscale(1)!important}
body.kol-customer .kol-allergen-footer{position:absolute!important;left:0!important;right:0!important;bottom:0!important;padding:10px 12px calc(10px + env(safe-area-inset-bottom))!important;display:grid!important;gap:8px!important;border-top:1px solid #ece8e5!important;background:rgba(255,255,255,.97)!important;backdrop-filter:blur(10px)!important}
body.kol-customer .kol-allergen-local-note{min-height:42px!important;padding:0 12px!important;display:flex!important;align-items:center!important;border-radius:11px!important;background:#f1f2f2!important;color:#414141!important;font-size:12px!important}
body.kol-customer .kol-allergen-save{height:52px!important;margin:0!important;border:0!important;border-radius:999px!important;background:#050505!important;color:#fff!important;font-size:16px!important;font-weight:550!important;box-shadow:none!important}
@media (max-width:370px){body.kol-customer .kol-allergen-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
</style>
'''

extension = r'''
/* ===== KOL SEARCH + ALLERGEN UI V1 ===== */
const kolSearchAllergenState = {
  searchOpen: false,
  query: "",
  menuScrollTop: 0,
  allergenQuery: ""
};
const kolAllergenStorageKey = "kol-food-allergens-v1";
const kolAllergenDefinitions = [
  { id: "melk", label: "Melk", symbol: "🥛", aliases: ["melk", "milk"] },
  { id: "hvete", label: "Hvete / gluten", symbol: "🌾", aliases: ["hvete", "gluten", "bygg", "rug", "havre", "korn"] },
  { id: "egg", label: "Egg", symbol: "🥚", aliases: ["egg"] },
  { id: "soya", label: "Soya", symbol: "🌱", aliases: ["soya", "soy"] },
  { id: "selleri", label: "Selleri", symbol: "🌿", aliases: ["selleri", "celery"] },
  { id: "sennep", label: "Sennep", symbol: "◉", aliases: ["sennep", "mustard"] },
  { id: "sesam", label: "Sesam", symbol: "◌", aliases: ["sesam", "sesame"] },
  { id: "fisk", label: "Fisk", symbol: "🐟", aliases: ["fisk", "fish"] },
  { id: "skalldyr", label: "Skalldyr", symbol: "🦐", aliases: ["skalldyr", "reke", "reker", "shrimp", "crustacean"] },
  { id: "peanott", label: "Peanøtter", symbol: "🥜", aliases: ["peanøtt", "peanott", "peanut"] },
  { id: "notter", label: "Nøtter", symbol: "🌰", aliases: ["nøtter", "notter", "mandel", "mandler", "cashew", "paranøtt", "hasselnøtt", "valnøtt", "pistasj"] },
  { id: "sulfitt", label: "Sulfitter", symbol: "◇", aliases: ["sulfitt", "sulfites", "svoveldioksid"] }
];

function kolNormalizeSearchText(value = "") {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function kolReadSelectedAllergens() {
  try {
    const saved = JSON.parse(localStorage.getItem(kolAllergenStorageKey) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch (error) {
    return new Set();
  }
}

function kolSaveSelectedAllergens(ids) {
  try { localStorage.setItem(kolAllergenStorageKey, JSON.stringify([...ids])); } catch (error) {}
}

function kolGetProductAllergenIds(item = {}) {
  let source = Array.isArray(item?.allergens) ? item.allergens.join(", ") : String(item?.allergens || item?.allergen || "");
  if (!source) {
    if (item?.type === "sauce") source = "Melk, Egg, Sennep";
    else if (typeof isKebabCustomItem === "function" && isKebabCustomItem(item)) source = "Melk, Egg, Hvete, Sennep, Selleri, Soya";
    else if (typeof isPizzaItem === "function" && isPizzaItem(item)) source = "Melk, Hvete";
  }
  const normalized = kolNormalizeSearchText(source);
  return kolAllergenDefinitions
    .filter((entry) => entry.aliases.some((alias) => normalized.includes(kolNormalizeSearchText(alias))))
    .map((entry) => entry.id);
}

function kolProductSelectedAllergenLabels(item = {}) {
  const selected = kolReadSelectedAllergens();
  if (!selected.size) return [];
  const ids = kolGetProductAllergenIds(item);
  return ids.filter((id) => selected.has(id)).map((id) => kolAllergenDefinitions.find((entry) => entry.id === id)?.label).filter(Boolean);
}

function kolAllergenButtonMarkup() {
  const count = kolReadSelectedAllergens().size;
  return `<button class="kol-allergen-trigger" type="button" data-kol-allergen-open><span class="kol-warning">⚠️</span><span>Matallergier</span>${count ? `<span class="kol-allergen-count">${count}</span>` : ""}</button>`;
}

function kolSearchIconMarkup() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.8"></circle><path d="m16 16 4.2 4.2"></path></svg>`;
}

function kolRenderSearchRail() {
  if (!categoryTabs) return;
  categoryTabs.innerHTML = `
    <div class="kol-search-rail">
      <label class="kol-search-input-wrap" for="kolMenuSearchInput">${kolSearchIconMarkup()}<input class="kol-search-input" id="kolMenuSearchInput" type="search" inputmode="search" autocomplete="off" placeholder="Søk" value="${escapeAttribute(kolSearchAllergenState.query)}"></label>
      <button class="kol-search-cancel" type="button" data-kol-search-cancel>Avbryt</button>
    </div>`;
  const input = document.getElementById("kolMenuSearchInput");
  if (input) {
    input.addEventListener("input", () => {
      kolSearchAllergenState.query = input.value || "";
      kolRenderSearchResults();
    });
  }
  syncCategoryTabsHeight?.();
}

function kolEnsureSearchRailButton() {
  if (!categoryTabs || kolSearchAllergenState.searchOpen) return;
  if (categoryTabs.querySelector("[data-kol-search-open]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kol-rail-search";
  button.dataset.kolSearchOpen = "";
  button.setAttribute("aria-label", "Søk i menyen");
  button.innerHTML = kolSearchIconMarkup();
  categoryTabs.insertBefore(button, categoryTabs.firstChild);
}

function kolFindSearchProducts(query = "") {
  const normalizedQuery = kolNormalizeSearchText(query);
  if (!normalizedQuery) return [];
  const seen = new Set();
  return getAllVisibleMenuProducts()
    .filter(({ section, item }) => {
      const haystack = kolNormalizeSearchText([
        item?.number,
        item?.name,
        item?.title,
        item?.ingredients,
        item?.description,
        item?.allergens,
        section?.title
      ].filter(Boolean).join(" "));
      return haystack.includes(normalizedQuery);
    })
    .filter(({ item }) => {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function kolRenderSearchProductRow(section, item) {
  const rowSoldOut = isSoldOutItem(item, isSoldOutItem(section));
  const prefix = item?.number ? `${item.number}. ` : "";
  const details = safeText(item?.ingredients || item?.description || "");
  const isSelected = getMarkedMenuProductIds().has(String(item?.id || ""));
  const isFavorite = getFavoriteProductIds().has(String(item?.id || ""));
  const allergyLabels = kolProductSelectedAllergenLabels(item);
  return `
    <button class="menu-row menu-app-product ${rowSoldOut ? "sold-out" : ""} ${isSelected ? "selected-product" : ""}" type="button" data-product="${escapeAttribute(item.id)}" data-product-section="${escapeAttribute(section.id)}" data-source-section="${escapeAttribute(item._sourceSectionId || section.id)}" ${isSelected ? 'aria-current="true"' : ""} ${rowSoldOut ? 'disabled aria-disabled="true"' : ""}>
      <span class="menu-thumb-wrap">${renderThumb(item)}</span>
      <span class="menu-row-main">
        <span class="menu-row-headline"><strong>${escapeAttribute(prefix + item.name)}</strong></span>
        <span class="menu-row-description">${details ? escapeAttribute(details) : "Trykk for valg og tilbehør"}</span>
        ${allergyLabels.length ? `<span class="kol-allergen-warning">Inneholder ${escapeAttribute(allergyLabels.join(", "))}</span>` : ""}
      </span>
      <span class="menu-app-product-side">
        <span class="menu-card-actions">
          <span class="menu-favorite ${isFavorite ? "saved" : ""}" role="button" tabindex="0" data-favorite-product="${escapeAttribute(item.id)}" aria-pressed="${isFavorite ? "true" : "false"}" aria-label="${isFavorite ? "Fjern fra favoritter" : "Legg til i favoritter"}">${favoriteIconMarkup()}</span>
          <span class="menu-add-state">${isSelected ? '<span class="selected-chip">Valgt</span>' : ''}<span class="menu-app-plus" aria-hidden="true" ${isSelected ? 'hidden' : ''}>+</span></span>
        </span>
        <span class="menu-row-inline-price">${renderMenuRowPrice(item, rowSoldOut)}</span>
      </span>
    </button>`;
}

function kolRenderSearchResults() {
  if (!menuSectionsEl || !kolSearchAllergenState.searchOpen) return;
  const query = String(kolSearchAllergenState.query || "").trim();
  const results = kolFindSearchProducts(query);
  const resultRows = results.map(({ section, item }) => kolRenderSearchProductRow(section, item)).join("");
  menuSectionsEl.innerHTML = `
    <section class="kol-search-screen">
      <div class="kol-search-summary">
        <div class="kol-search-summary-top">
          <h2>${query ? `Resultater for &quot;${escapeAttribute(query)}&quot;` : "Søk i menyen"}</h2>
          ${query ? '<button class="kol-search-clear" type="button" data-kol-search-clear>Tøm søk</button>' : ""}
        </div>
        <div class="kol-search-subrow">
          <span class="kol-search-count">${query ? `${results.length} ${results.length === 1 ? "resultat" : "resultater"}` : "Skriv navnet på en rett eller ingrediens"}</span>
          ${kolAllergenButtonMarkup()}
        </div>
      </div>
      ${query ? (results.length ? `<div class="menu-list">${resultRows}</div>` : '<div class="kol-search-empty">Ingen produkter matcher søket ditt.</div>') : '<div class="kol-search-empty">Begynn å skrive for å søke i hele menyen.</div>'}
    </section>`;
  applyFavoritesView?.();
  markSelectedMenuProduct?.();
  const shell = document.querySelector(".menu-shell");
  if (shell) shell.scrollTop = 0;
}

function kolDecorateMenuWithTools() {
  if (!menuSectionsEl || kolSearchAllergenState.searchOpen) return;
  menuSectionsEl.querySelector(".kol-menu-tools")?.remove();
  const tools = document.createElement("div");
  tools.className = "kol-menu-tools";
  tools.innerHTML = `<p class="kol-menu-tools-title">Meny</p>${kolAllergenButtonMarkup()}`;
  menuSectionsEl.insertBefore(tools, menuSectionsEl.firstChild);
  kolApplyAllergenWarningsToMenuRows();
}

function kolApplyAllergenWarningsToMenuRows() {
  if (!menuSectionsEl) return;
  const productMap = new Map(getAllVisibleMenuProducts().map(({ item }) => [String(item.id || ""), item]));
  menuSectionsEl.querySelectorAll(".menu-row[data-product]").forEach((row) => {
    row.querySelector(".kol-allergen-warning")?.remove();
    const item = productMap.get(String(row.dataset.product || ""));
    if (!item) return;
    const labels = kolProductSelectedAllergenLabels(item);
    if (!labels.length) return;
    const warning = document.createElement("span");
    warning.className = "kol-allergen-warning";
    warning.textContent = `Inneholder ${labels.join(", ")}`;
    row.querySelector(".menu-row-main")?.appendChild(warning);
  });
}

function kolOpenSearch() {
  if (kolSearchAllergenState.searchOpen) return;
  kolSearchAllergenState.searchOpen = true;
  kolSearchAllergenState.query = "";
  kolSearchAllergenState.menuScrollTop = document.querySelector(".menu-shell")?.scrollTop || 0;
  document.body.classList.add("kol-search-open");
  kolRenderSearchRail();
  kolRenderSearchResults();
  window.setTimeout(() => document.getElementById("kolMenuSearchInput")?.focus(), 30);
}

function kolCloseSearch() {
  if (!kolSearchAllergenState.searchOpen) return;
  kolSearchAllergenState.searchOpen = false;
  kolSearchAllergenState.query = "";
  document.body.classList.remove("kol-search-open");
  renderMenu();
  window.requestAnimationFrame(() => {
    const shell = document.querySelector(".menu-shell");
    if (shell) shell.scrollTop = kolSearchAllergenState.menuScrollTop || 0;
    requestCategoryScrollSync?.();
  });
}

function kolEnsureAllergenModal() {
  if (document.getElementById("kolAllergenModal")) return;
  const modal = document.createElement("div");
  modal.id = "kolAllergenModal";
  modal.className = "kol-allergen-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="kol-allergen-sheet" role="dialog" aria-modal="true" aria-labelledby="kolAllergenTitle">
      <div class="kol-allergen-head">
        <button class="kol-allergen-close" type="button" data-kol-allergen-close aria-label="Lukk">×</button>
        <h2 id="kolAllergenTitle">Matallergier</h2>
        <p>Velg dine matallergier, så varsler vi deg hvis et produkt inneholder noen av de valgte allergenene.</p>
      </div>
      <label class="kol-allergen-search-wrap">${kolSearchIconMarkup()}<input class="kol-allergen-search" type="search" placeholder="Søk" data-kol-allergen-search></label>
      <div class="kol-allergen-selected-row" data-kol-allergen-selected></div>
      <div class="kol-allergen-grid-scroll"><div class="kol-allergen-grid" data-kol-allergen-grid></div></div>
      <div class="kol-allergen-footer">
        <div class="kol-allergen-local-note">Valgene lagres bare på denne enheten.</div>
        <button class="kol-allergen-save" type="button" data-kol-allergen-save>Lagre</button>
      </div>
    </section>`;
  document.body.appendChild(modal);
}

function kolRenderAllergenModalContents() {
  kolEnsureAllergenModal();
  const selected = kolReadSelectedAllergens();
  const filter = kolNormalizeSearchText(kolSearchAllergenState.allergenQuery || "");
  const grid = document.querySelector("[data-kol-allergen-grid]");
  const selectedRow = document.querySelector("[data-kol-allergen-selected]");
  if (grid) {
    grid.innerHTML = kolAllergenDefinitions
      .filter((entry) => !filter || kolNormalizeSearchText(entry.label).includes(filter))
      .map((entry) => `<button class="kol-allergen-option ${selected.has(entry.id) ? "selected" : ""}" type="button" data-kol-allergen-option="${entry.id}" aria-pressed="${selected.has(entry.id) ? "true" : "false"}"><span class="kol-allergen-symbol">${entry.symbol}</span><span>${entry.label}</span></button>`)
      .join("");
  }
  if (selectedRow) {
    selectedRow.innerHTML = [...selected]
      .map((id) => kolAllergenDefinitions.find((entry) => entry.id === id))
      .filter(Boolean)
      .map((entry) => `<button class="kol-allergen-chip" type="button" data-kol-allergen-remove="${entry.id}"><span>${entry.symbol} ${entry.label}</span><b>×</b></button>`)
      .join("");
  }
}

function kolOpenAllergens() {
  kolEnsureAllergenModal();
  kolSearchAllergenState.allergenQuery = "";
  const modal = document.getElementById("kolAllergenModal");
  if (!modal) return;
  const search = modal.querySelector("[data-kol-allergen-search]");
  if (search) search.value = "";
  kolRenderAllergenModalContents();
  modal.hidden = false;
  document.body.classList.add("kol-allergen-open");
  setPageScrollLocked?.(true);
}

function kolCloseAllergens({ save = true } = {}) {
  const modal = document.getElementById("kolAllergenModal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("kol-allergen-open");
  setPageScrollLocked?.(false);
  if (save) {
    if (kolSearchAllergenState.searchOpen) {
      kolRenderSearchRail();
      kolRenderSearchResults();
    } else {
      kolDecorateMenuWithTools();
    }
  }
}

const kolBaseRenderCategoryTabs = renderCategoryTabs;
renderCategoryTabs = function kolRenderCategoryTabsWithSearch(sections) {
  kolBaseRenderCategoryTabs(sections);
  if (kolSearchAllergenState.searchOpen) kolRenderSearchRail();
  else kolEnsureSearchRailButton();
};

const kolBaseRenderMenu = renderMenu;
renderMenu = function kolRenderMenuWithSearchAndAllergens() {
  kolBaseRenderMenu();
  kolEnsureAllergenModal();
  if (kolSearchAllergenState.searchOpen) {
    kolRenderSearchRail();
    kolRenderSearchResults();
  } else {
    kolEnsureSearchRailButton();
    kolDecorateMenuWithTools();
  }
};

document.addEventListener("click", (event) => {
  if (event.target.closest?.("[data-kol-search-open]")) {
    event.preventDefault();
    event.stopPropagation();
    kolOpenSearch();
    return;
  }
  if (event.target.closest?.("[data-kol-search-cancel]")) {
    event.preventDefault();
    event.stopPropagation();
    kolCloseSearch();
    return;
  }
  if (event.target.closest?.("[data-kol-search-clear]")) {
    event.preventDefault();
    kolSearchAllergenState.query = "";
    kolRenderSearchRail();
    kolRenderSearchResults();
    window.setTimeout(() => document.getElementById("kolMenuSearchInput")?.focus(), 20);
    return;
  }
  if (event.target.closest?.("[data-kol-allergen-open]")) {
    event.preventDefault();
    event.stopPropagation();
    kolOpenAllergens();
    return;
  }
  const option = event.target.closest?.("[data-kol-allergen-option]");
  if (option) {
    event.preventDefault();
    const selected = kolReadSelectedAllergens();
    const id = String(option.dataset.kolAllergenOption || "");
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    kolSaveSelectedAllergens(selected);
    kolRenderAllergenModalContents();
    return;
  }
  const remove = event.target.closest?.("[data-kol-allergen-remove]");
  if (remove) {
    event.preventDefault();
    const selected = kolReadSelectedAllergens();
    selected.delete(String(remove.dataset.kolAllergenRemove || ""));
    kolSaveSelectedAllergens(selected);
    kolRenderAllergenModalContents();
    return;
  }
  if (event.target.closest?.("[data-kol-allergen-save]")) {
    event.preventDefault();
    kolCloseAllergens({ save: true });
    return;
  }
  if (event.target.closest?.("[data-kol-allergen-close]")) {
    event.preventDefault();
    kolCloseAllergens({ save: true });
  }
}, true);

document.addEventListener("input", (event) => {
  if (!event.target.matches?.("[data-kol-allergen-search]")) return;
  kolSearchAllergenState.allergenQuery = event.target.value || "";
  kolRenderAllergenModalContents();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const modal = document.getElementById("kolAllergenModal");
  if (modal && !modal.hidden) {
    event.preventDefault();
    event.stopImmediatePropagation();
    kolCloseAllergens({ save: true });
    return;
  }
  if (kolSearchAllergenState.searchOpen) {
    event.preventDefault();
    event.stopImmediatePropagation();
    kolCloseSearch();
  }
}, true);
'''

if '</head>' not in text:
    raise SystemExit('Missing </head>')
if '\nasync function init() {' not in text:
    raise SystemExit('Missing init() insertion point')

text = text.replace('</head>', style + '\n</head>', 1)
text = text.replace('\nasync function init() {', '\n' + extension + '\nasync function init() {', 1)
path.write_text(text, encoding='utf-8')
print('Applied KOL search + allergen UI V1')
