from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

s = index_path.read_text(encoding='utf-8')
s = s.replace('kol-core.css?v=mobile-v19', 'kol-core.css?v=mobile-v20')
index_path.write_text(s, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')

# Remove the two experimental scroll/layout overrides and replace them with one
# simple flex layout. This avoids inherited fixed-position transforms shifting
# the header/category rail sideways.
start = css.find('/* MOBILE V18: hidden category scrollbar + reliable menu scroll + selected order */')
if start != -1:
    end = css.rfind('\n}')
    if end == -1 or end <= start:
        raise SystemExit('Could not find mobile layer closing brace')
    # Preserve only the selected-order styling from V18 below in the new block.
    css = css[:start] + css[end:]

marker = '/* MOBILE V20: stable header + category rail + one menu scroller */'
if marker not in css:
    block = r'''

/* MOBILE V20: stable header + category rail + one menu scroller */
body.kol-customer{
  height:100dvh!important;
  min-height:100dvh!important;
  overflow:hidden!important;
}
body.kol-customer .customer-app{
  display:flex!important;
  flex-direction:column!important;
  width:100%!important;
  height:100dvh!important;
  min-height:0!important;
  overflow:hidden!important;
}
body.kol-customer .appbar{
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  left:auto!important;
  right:auto!important;
  flex:0 0 var(--head)!important;
  width:100%!important;
  max-width:none!important;
  height:var(--head)!important;
  margin:0!important;
  transform:none!important;
}
body.kol-customer .category-tabs-wrap{
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  left:auto!important;
  right:auto!important;
  flex:0 0 var(--tabs)!important;
  width:100%!important;
  max-width:none!important;
  height:var(--tabs)!important;
  margin:0!important;
  overflow:hidden!important;
  transform:none!important;
}
body.kol-customer .category-tabs-scroll{
  width:100%!important;
  height:100%!important;
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
  position:relative!important;
  inset:auto!important;
  top:auto!important;
  flex:1 1 auto!important;
  width:100%!important;
  min-height:0!important;
  height:auto!important;
  max-height:none!important;
  margin:0!important;
  padding:0 0 28px!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior-y:contain!important;
  -webkit-overflow-scrolling:touch!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar{
  width:6px!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-track{
  background:transparent!important;
}
body.kol-customer .menu-shell::-webkit-scrollbar-thumb{
  background:#cfc8c2!important;
  border-radius:6px!important;
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
  min-height:22px!important;
  margin:0 0 5px!important;
  padding:0 7px!important;
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
