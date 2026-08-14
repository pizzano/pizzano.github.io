from pathlib import Path

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
html = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

html = html.replace('kol-core.css?v=mobile-v10', 'kol-core.css?v=mobile-v11', 1)

css += r'''

/* ===== MOBILE V11: cleaner Meny back control ===== */
@layer mobile{
body.kol-customer .brand-back-label{
  display:none!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  height:46px!important;
  padding:0 2px!important;
  color:#fff!important;
  font-size:0!important;
  font-weight:900!important;
  line-height:1!important;
  white-space:nowrap!important;
}
body.kol-customer.kol-top-back-active .brand-back-label{
  display:flex!important;
}
body.kol-customer .brand-back-label::before{
  content:"‹";
  display:block!important;
  flex:0 0 auto!important;
  margin-top:-2px!important;
  color:#fff!important;
  font-family:Arial,sans-serif!important;
  font-size:32px!important;
  font-weight:500!important;
  line-height:.8!important;
}
body.kol-customer .brand-back-label::after{
  content:"Meny";
  display:block!important;
  color:#fff!important;
  font-size:18px!important;
  font-weight:900!important;
  line-height:1!important;
  letter-spacing:-.15px!important;
}
body.kol-customer.kol-top-back-active .appbar-brand{
  min-width:104px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
}
}
'''

index_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
assert 'mobile-v11' in html
assert 'MOBILE V11: cleaner Meny back control' in css
print('v11 ready')
