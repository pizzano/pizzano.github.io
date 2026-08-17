from pathlib import Path
p=Path('test/test.html')
s=p.read_text(encoding='utf-8')
css='''
/* Keep only the explicit "← Til meny" label; suppress legacy extra chevron. */
body.kol-customer .appbar-brand::before,
body.kol-customer.kol-top-back-active .appbar-brand::before{
  content:none!important;
  display:none!important;
}
'''
if 'suppress legacy extra chevron' not in s:
    s=s.replace('</style>', css+'\n</style>', 1)
p.write_text(s,encoding='utf-8')
