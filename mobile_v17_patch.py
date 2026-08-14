from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')

s = index_path.read_text(encoding='utf-8')
s = s.replace('kol-core.css?v=mobile-v16', 'kol-core.css?v=mobile-v17')
s = s.replace('setCheckoutStep(3, { focus: customerFullName });', 'setCheckoutStep(3);')
s = s.replace('<div class="checkout-section-title"><span>2</span><div><strong>Velg hentetid</strong></div></div>', '<div class="checkout-section-title"><span>2</span><div><strong>Velg hentetid</strong><small>Velg når du ønsker at maten skal være klar.</small></div></div>')
s = s.replace('<div class="checkout-section-title"><span>3</span><div><strong>Navn og telefon</strong></div></div>', '<div class="checkout-section-title"><span>3</span><div><strong>Navn og telefon</strong><small>Kontroller at navn og telefonnummer stemmer.</small></div></div>')
index_path.write_text(s, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
marker = '/* PRODUCT OPTION CHECKS V17 */'
if marker not in css:
    block = r'''

/* PRODUCT OPTION CHECKS V17 */
body.kol-customer #optionGroups input[type="radio"],
body.kol-customer #optionGroups input[type="checkbox"]{
  -webkit-appearance:none!important;
  appearance:none!important;
  position:static!important;
  display:inline-grid!important;
  place-content:center!important;
  flex:0 0 24px!important;
  width:24px!important;
  min-width:24px!important;
  height:24px!important;
  min-height:24px!important;
  margin:0 12px 0 0!important;
  padding:0!important;
  opacity:1!important;
  visibility:visible!important;
  border:1.5px solid #a6a19d!important;
  border-radius:50%!important;
  background:#fff!important;
  box-shadow:none!important;
}
body.kol-customer #optionGroups input[type="radio"]::after,
body.kol-customer #optionGroups input[type="checkbox"]::after{
  content:"✓";
  display:block!important;
  color:#168653!important;
  font-size:15px!important;
  font-weight:700!important;
  line-height:1!important;
  opacity:0!important;
}
body.kol-customer #optionGroups input[type="radio"]:checked,
body.kol-customer #optionGroups input[type="checkbox"]:checked{
  border-color:#58b985!important;
  background:#eef9f2!important;
}
body.kol-customer #optionGroups input[type="radio"]:checked::after,
body.kol-customer #optionGroups input[type="checkbox"]:checked::after{
  opacity:1!important;
}
body.kol-customer #optionGroups label:has(input[type="radio"]:checked),
body.kol-customer #optionGroups label:has(input[type="checkbox"]:checked){
  background:#f4fbf7!important;
  color:#185f3e!important;
}
body.kol-customer .checkout-section-title>div{
  min-width:0!important;
  display:flex!important;
  flex-direction:column!important;
  gap:2px!important;
}
body.kol-customer .checkout-section-title small{
  display:block!important;
  margin:0!important;
  color:var(--muted)!important;
  font-size:12.5px!important;
  font-weight:400!important;
  line-height:1.35!important;
}
'''
    pos = css.rfind('\n}')
    if pos == -1:
        raise SystemExit('Could not find closing layer brace')
    css = css[:pos] + block + css[pos:]
css_path.write_text(css, encoding='utf-8')

# trigger v17 workflow
