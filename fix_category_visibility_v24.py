from pathlib import Path
import re

p = Path('test/index.html')
s = p.read_text(encoding='utf-8')

# Category is a permanent second row of the fixed header. It must never rely on
# the HTML hidden attribute or inline display styles.
s = s.replace('<nav class="category-tabs-wrap" hidden id="categoryTabsWrap" aria-label="Kategorier">',
              '<nav class="category-tabs-wrap" id="categoryTabsWrap" aria-label="Kategorier">', 1)

# Replace the old visibility function completely. Only body state classes decide
# whether the category row is visually hidden (cart/profile/info/order screens).
pattern = r'function syncCategoryTabsVisibility\(\) \{.*?\n\}\n\nfunction syncBodyScrollLocks\(\) \{'
replacement = '''function syncCategoryTabsVisibility() {
  const hideTabs = document.body.classList.contains("cart-open") ||
    document.body.classList.contains("profile-open") ||
    document.body.classList.contains("info-open") ||
    document.body.classList.contains("order-live-open") ||
    document.body.classList.contains("settings-open");

  document.body.classList.toggle("category-tabs-hidden", hideTabs);
  if (categoryTabsWrap) {
    categoryTabsWrap.removeAttribute("hidden");
    categoryTabsWrap.setAttribute("aria-hidden", hideTabs ? "true" : "false");
    categoryTabsWrap.style.removeProperty("display");
  }

  if (!hideTabs && categoryTabs && categoryTabs.childElementCount === 0 && menuSectionsEl?.children?.length) {
    window.requestAnimationFrame(() => refreshCategoryTabsFromCurrentMenu({ preserveActive: true }));
  }
}

function syncBodyScrollLocks() {'''
s, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('syncCategoryTabsVisibility block not found exactly once')

# Remove any old direct hidden/display assignments that may remain elsewhere.
s = re.sub(r'\s*categoryTabsWrap\.hidden\s*=\s*[^;]+;', '', s)
s = re.sub(r'\s*categoryTabsWrap\.style\.display\s*=\s*[^;]+;', '', s)

# Update cache label only; no new CSS patch block is appended.
s = re.sub(r'kol-core\.css\?v=mobile-v\d+', 'kol-core.css?v=mobile-v24', s, count=1)

p.write_text(s, encoding='utf-8')

print('nav hidden attribute:', '<nav class="category-tabs-wrap" hidden' in s)
print('direct hidden assignments:', len(re.findall(r'categoryTabsWrap\\.hidden\\s*=', s)))
print('direct display assignments:', len(re.findall(r'categoryTabsWrap\\.style\\.display\\s*=', s)))
print('v24:', 'mobile-v24' in s)
