from pathlib import Path

admin_path = Path("test/admin-panel.html")
index_path = Path("test/index.html")
css_path = Path("test/kol-core.css")

admin = admin_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

old = '''<label>Antall igjen
<input id="rescueQuantity" min="1" max="99" step="1" type="number" value="1"/>
</label>
<label>Ordinær pris'''
new = '''<label>Antall igjen
<input id="rescueQuantity" min="1" max="99" step="1" type="number" value="1"/>
</label>
<label>Størrelse / variant
<input id="rescueVariant" maxlength="40" placeholder="F.eks. Stor, Liten, 40 cm" type="text"/>
</label>
<label>Ordinær pris'''
assert old in admin, "admin variant input anchor missing"
admin = admin.replace(old, new, 1)

old = '''const rescueFields = {
  enabled: document.querySelector("#rescueEnabled"),
  quantity: document.querySelector("#rescueQuantity"),
  originalPrice: document.querySelector("#rescueOriginalPrice"),'''
new = '''const rescueFields = {
  enabled: document.querySelector("#rescueEnabled"),
  quantity: document.querySelector("#rescueQuantity"),
  variant: document.querySelector("#rescueVariant"),
  originalPrice: document.querySelector("#rescueOriginalPrice"),'''
assert old in admin
admin = admin.replace(old, new, 1)

old = '''    if (rescueFields.quantity) rescueFields.quantity.value = "1";
    if (rescueFields.originalPrice) rescueFields.originalPrice.value = "";'''
new = '''    if (rescueFields.quantity) rescueFields.quantity.value = "1";
    if (rescueFields.variant) rescueFields.variant.value = "";
    if (rescueFields.originalPrice) rescueFields.originalPrice.value = "";'''
assert old in admin
admin = admin.replace(old, new, 1)

old = '''  if (rescueFields.quantity) rescueFields.quantity.value = String(Math.max(1, Math.floor(safeAdminNumber(deal?.quantity, 1))));
  if (rescueFields.originalPrice) rescueFields.originalPrice.value = String(safeAdminNumber(deal?.originalPrice, getDefaultRescueOriginalPrice(product)));'''
new = '''  if (rescueFields.quantity) rescueFields.quantity.value = String(Math.max(1, Math.floor(safeAdminNumber(deal?.quantity, 1))));
  if (rescueFields.variant) rescueFields.variant.value = String(deal?.variantLabel || "");
  if (rescueFields.originalPrice) rescueFields.originalPrice.value = String(safeAdminNumber(deal?.originalPrice, getDefaultRescueOriginalPrice(product)));'''
assert old in admin
admin = admin.replace(old, new, 1)

old = '''  const quantity = Math.max(1, Math.min(99, Math.floor(safeAdminNumber(rescueFields.quantity?.value, 1))));
  const originalPrice = Math.max(0, safeAdminNumber(rescueFields.originalPrice?.value, getDefaultRescueOriginalPrice(product)));'''
new = '''  const quantity = Math.max(1, Math.min(99, Math.floor(safeAdminNumber(rescueFields.quantity?.value, 1))));
  const variantLabel = String(rescueFields.variant?.value || "").trim().slice(0, 40);
  const originalPrice = Math.max(0, safeAdminNumber(rescueFields.originalPrice?.value, getDefaultRescueOriginalPrice(product)));'''
assert old in admin
admin = admin.replace(old, new, 1)

old = '''    quantity,
    originalPrice,
    discountPercent,'''
new = '''    quantity,
    variantLabel,
    originalPrice,
    discountPercent,'''
assert old in admin
admin = admin.replace(old, new, 1)

old = '''function getRescueDealById(dealId = "") {
  return rescueDeals[String(dealId || "")] || null;
}'''
new = '''function getRescueCartQuantity(dealId = "") {
  const target = String(dealId || "");
  return cart.reduce((sum, line) => {
    if (line?.rescueDeal !== true || String(line.rescueDealId || "") !== target) return sum;
    return sum + Math.max(1, Math.floor(safeNumber(line.quantity, 1)));
  }, 0);
}

function getRescueDealById(dealId = "") {
  return rescueDeals[String(dealId || "")] || null;
}'''
assert old in index
index = index.replace(old, new, 1)

old = '''        rescueQuantity: deal.quantity,
        rescueOriginalPrice: deal.originalPrice,'''
new = '''        rescueQuantity: deal.quantity,
        rescueVariantLabel: String(deal.variantLabel || ""),
        rescueOriginalPrice: deal.originalPrice,'''
assert old in index
index = index.replace(old, new, 1)

old = '''                  const stock = Math.max(0, Number(item.rescueQuantity || 0));
                  const discount = Math.max(0, Math.round(Number(item.rescueDiscountPercent || 0)));'''
new = '''                  const rawStock = Math.max(0, Math.floor(Number(item.rescueQuantity || 0)));
                  const stock = Math.max(0, rawStock - getRescueCartQuantity(item._rescueDealId));
                  const discount = Math.max(0, Math.round(Number(item.rescueDiscountPercent || 0)));'''
assert old in index
index = index.replace(old, new, 1)

old = '''                        <span class="menu-row-description">${details ? escapeAttribute(details) : "Ferdiglaget mat til redusert pris"}</span>
                        <span class="rescue-stock-label ${stock === 1 ? "last-one" : ""}">${stock === 1 ? "Kun 1 igjen" : `${stock} igjen`}</span>'''
new = '''                        <span class="menu-row-description">${details ? escapeAttribute(details) : "Ferdiglaget mat til redusert pris"}</span>
                        ${item.rescueVariantLabel ? `<span class="rescue-variant-label">${escapeAttribute(item.rescueVariantLabel)}</span>` : ""}
                        <span class="rescue-stock-label ${stock === 1 ? "last-one" : ""}">${stock <= 0 ? "0 igjen · ligger i handlekurven" : (stock === 1 ? "Kun 1 igjen" : `${stock} igjen`)}</span>'''
assert old in index
index = index.replace(old, new, 1)

old = '''      size: "",
      sizeLabel: "",
      extras: [],'''
new = '''      size: String(deal.variantLabel || ""),
      sizeLabel: String(deal.variantLabel || ""),
      extras: [],'''
assert old in index
index = index.replace(old, new, 1)

old = '''function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
}'''
new = '''function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
  if (typeof renderMenu === "function" && rescueDeals && Object.keys(rescueDeals).length) {
    queueMicrotask(() => {
      try { renderMenu(); } catch (error) { console.warn("Redde maten-visning kunne ikke oppdateres.", error); }
    });
  }
}'''
assert old in index
index = index.replace(old, new, 1)

old = '''  if (existingQty >= available) {
    showCustomerFavoriteNotice(available === 1 ? "Kun 1 igjen – den ligger allerede i handlekurven" : `Kun ${available} igjen`);
    return;
  }'''
new = '''  if (existingQty >= available) {
    showCustomerFavoriteNotice(available === 1 ? "Den siste ligger allerede i handlekurven" : "Alle tilgjengelige ligger allerede i handlekurven");
    return;
  }'''
assert old in index
index = index.replace(old, new, 1)

marker = "/* ===== REDDE MATEN VARIANT + LIVE STOCK ===== */"
if marker not in css:
    css += '''\n\n/* ===== REDDE MATEN VARIANT + LIVE STOCK ===== */\nbody.kol-admin .rescue-editor-grid{grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;}\nbody.kol-admin #rescueVariant{min-width:0;}\nbody.kol-customer .rescue-variant-label{width:max-content;max-width:100%;display:inline-flex;align-items:center;min-height:24px;padding:3px 9px;border:1px solid #f2b16c;border-radius:999px;color:#9a4a12;background:#fff4e8;font-size:11px;font-weight:850;line-height:1.2;}\nbody.kol-customer .rescue-stock-label{transition:color .15s ease,background .15s ease;}\n@media (max-width:900px){body.kol-admin .rescue-editor-grid{grid-template-columns:repeat(2,minmax(0,1fr));}body.kol-admin .rescue-price-preview{min-height:64px;}}\n@media (max-width:560px){body.kol-admin .rescue-editor-grid{grid-template-columns:1fr;}}\n'''

assert '<style' not in index.lower()
assert '<style' not in admin.lower()
assert 'id="rescueVariant"' in admin
assert 'variantLabel' in admin
assert 'rescueVariantLabel' in index
assert 'getRescueCartQuantity' in index
assert marker in css

admin_path.write_text(admin, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
print("patch ok")