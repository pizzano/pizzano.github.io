from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

s = index_path.read_text(encoding='utf-8')
s = s.replace('kol-core.css?v=mobile-v17', 'kol-core.css?v=mobile-v18')

# Make the currently expanded old order visibly selected.
needle = '<span class="profile-order-main">\n          <span class="profile-order-title-row">'
replacement = '<span class="profile-order-main">\n          ${isExpanded ? `<span class="profile-selected-marker">Valgt</span>` : ""}\n          <span class="profile-order-title-row">'
if needle in s and 'profile-selected-marker' not in s:
    s = s.replace(needle, replacement, 1)

# Menu is its own reliable vertical scroll container on desktop and mobile.
anchor = 'window.addEventListener("scroll", requestCategoryScrollSync, { passive: true });'
insert = '''const kolMenuScroll = document.querySelector(".menu-shell");
kolMenuScroll?.addEventListener("scroll", requestCategoryScrollSync, { passive: true });
window.addEventListener("scroll", requestCategoryScrollSync, { passive: true });'''
if anchor in s and 'const kolMenuScroll' not in s:
    s = s.replace(anchor, insert, 1)

index_path.write_text(s, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
marker = '/* MOBILE V18: hidden category scrollbar + reliable menu scroll + selected order */'
if marker not in css:
    block = r'''

/* MOBILE V18: hidden category scrollbar + reliable menu scroll + selected order */
body.kol-customer .category-tabs-wrap,
body.kol-customer .category-tabs-scroll{
  scrollbar-width:none!important;
  -ms-overflow-style:none!important;
}
body.kol-customer .category-tabs-wrap::-webkit-scrollbar,
body.kol-customer .category-tabs-scroll::-webkit-scrollbar{
  width:0!important;
  height:0!important;
  display:none!important;
  background:transparent!important;
}
body.kol-customer .customer-app{
  height:100dvh!important;
  min-height:100dvh!important;
  overflow:hidden!important;
}
body.kol-customer .menu-shell{
  height:100dvh!important;
  min-height:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior-y:contain!important;
  -webkit-overflow-scrolling:touch!important;
  scrollbar-gutter:auto!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar{
  width:7px!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-thumb{
  background:#d7d0ca!important;
  border-radius:999px!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-track{
  background:transparent!important;
}
body.kol-customer .profile-order-card.is-expanded{
  position:relative!important;
  background:#fff8f3!important;
  box-shadow:inset 4px 0 0 var(--o)!important;
}
body.kol-customer .profile-order-card.is-expanded .profile-order-summary{
  background:#fff8f3!important;
}
body.kol-customer .profile-selected-marker{
  display:inline-flex!important;
  align-items:center!important;
  align-self:flex-start!important;
  min-height:23px!important;
  margin:0 0 6px!important;
  padding:0 8px!important;
  border:1px solid #f6a47e!important;
  border-radius:999px!important;
  background:#fff!important;
  color:var(--o)!important;
  font-size:12px!important;
  font-weight:600!important;
  line-height:1!important;
}
body.kol-customer .profile-order-card.is-expanded .profile-order-details{
  border-top:1px solid #f0d8cc!important;
  background:#fff!important;
}
'''
    pos = css.rfind('\n}')
    if pos == -1:
        raise SystemExit('Could not find closing @layer brace')
    css = css[:pos] + block + css[pos:]
css_path.write_text(css, encoding='utf-8')
