from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

s = index_path.read_text(encoding='utf-8')
s = s.replace('kol-core.css?v=mobile-v18', 'kol-core.css?v=mobile-v19')

# Keep the header inside .customer-app. An old compatibility block moved it to <body>,
# which made the menu scrollbar start behind the header/category rail.
s = s.replace('''  const header = document.querySelector(".appbar");\n  if (header && document.body.firstElementChild !== header) {\n    document.body.insertBefore(header, document.body.firstElementChild);\n  }\n''', '')

new_scroll_to = r'''function scrollToMenuSection(sectionId) {
  const panel = getSectionPanelById(sectionId);
  if (!panel) return;

  const productWasOpen = productModal && !productModal.hidden;
  if (productWasOpen) {
    productModal.hidden = true;
    productModal.classList.remove("simple-product", "kebab-product");
    editingCartIndex = null;
    document.body.classList.remove("modal-open");
    syncBodyScrollLocks();
  }

  panel.classList.remove("collapsed");
  setActiveCategoryTab(sectionId, { centerIntoView: true, behavior: "auto" });

  window.requestAnimationFrame(() => {
    const shell = document.querySelector(".menu-shell");
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const targetTop = shell.scrollTop + panelRect.top - shellRect.top;
    shell.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    window.requestAnimationFrame(updateActiveCategoryFromScroll);
  });
}
'''

s, count1 = re.subn(r'function scrollToMenuSection\(sectionId\) \{.*?\n\}\n\nfunction updateActiveCategoryFromScroll', new_scroll_to + '\nfunction updateActiveCategoryFromScroll', s, count=1, flags=re.S)
if count1 != 1:
    raise SystemExit(f'Could not replace scrollToMenuSection: {count1}')

new_update = r'''function updateActiveCategoryFromScroll() {
  if (!categoryTabsWrap || categoryTabsWrap.hidden || document.body.classList.contains("category-tabs-hidden")) return;

  if (productModal && !productModal.hidden && selectedSection?.id) {
    if (activeCategoryTabId !== selectedSection.id) {
      setActiveCategoryTab(selectedSection.id, { centerIntoView: true, behavior: "auto" });
    }
    return;
  }

  const shell = document.querySelector(".menu-shell");
  const panels = [...menuSectionsEl.querySelectorAll(".category-panel[data-section]")].filter((panel) => !panel.hidden);
  if (!shell || !panels.length) return;

  const shellRect = shell.getBoundingClientRect();
  const probeLine = shellRect.top + 8;
  const atBottom = shell.scrollTop + shell.clientHeight >= shell.scrollHeight - 4;
  let activePanel = panels[0];

  if (atBottom) {
    activePanel = panels[panels.length - 1];
  } else {
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      if (rect.top <= probeLine) activePanel = panel;
      if (rect.top > probeLine) break;
    }
  }

  const nextId = activePanel?.dataset.section || "";
  if (nextId && nextId !== activeCategoryTabId) {
    setActiveCategoryTab(nextId, { centerIntoView: true, behavior: "auto" });
  }
}
'''

s, count2 = re.subn(r'function updateActiveCategoryFromScroll\(\) \{.*?\n\}\n\nfunction requestCategoryScrollSync', new_update + '\nfunction requestCategoryScrollSync', s, count=1, flags=re.S)
if count2 != 1:
    raise SystemExit(f'Could not replace updateActiveCategoryFromScroll: {count2}')

index_path.write_text(s, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
marker = '/* MOBILE V19: one real menu scroller below header + category rail */'
if marker not in css:
    block = r'''

/* MOBILE V19: one real menu scroller below header + category rail */
body.kol-customer{
  overflow:hidden!important;
}
body.kol-customer .customer-app{
  display:grid!important;
  grid-template-rows:auto auto minmax(0,1fr)!important;
  width:100%!important;
  height:100dvh!important;
  min-height:100dvh!important;
  overflow:hidden!important;
}
body.kol-customer .appbar{
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  z-index:20!important;
  flex:none!important;
}
body.kol-customer .category-tabs-wrap{
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  z-index:19!important;
  flex:none!important;
  overflow:hidden!important;
}
body.kol-customer .category-tabs-scroll{
  overflow-x:auto!important;
  overflow-y:hidden!important;
  scrollbar-width:none!important;
  -ms-overflow-style:none!important;
}
body.kol-customer .category-tabs-scroll::-webkit-scrollbar{
  display:none!important;
  width:0!important;
  height:0!important;
}
body.kol-customer .menu-shell{
  grid-row:3!important;
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  width:100%!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior-y:contain!important;
  -webkit-overflow-scrolling:touch!important;
  scrollbar-gutter:auto!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar{
  width:7px!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-track{
  background:transparent!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-thumb{
  background:#cfc8c2!important;
  border-radius:999px!important;
}
'''
    pos = css.rfind('\n}')
    if pos == -1:
        raise SystemExit('Could not find closing @layer brace')
    css = css[:pos] + block + css[pos:]

css_path.write_text(css, encoding='utf-8')
