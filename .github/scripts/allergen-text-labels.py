from pathlib import Path
import re
p=Path('test/test.html')
s=p.read_text(encoding='utf-8')

pattern=r"function productAllergenText\(p\)\{.*?\}\nfunction productRow"
replacement="""function productAllergenText(p){
  if(!selectedAllergens.size)return '';
  const ids=allergensOf(p).filter(id=>selectedAllergens.has(id));
  if(!ids.length)return '';
  const labels=ids.map(id=>ALLERGENS.find(x=>x[0]===id)?.[2]||id);
  return `<div class=\"local-product-allergens\">Inneholder: ${labels.join(', ')}</div>`;
}
function productRow"""
s2,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit('productAllergenText block not found')
s=s2

# Remove obsolete icon-only CSS if present.
s=re.sub(r"\nbody\.kol-customer \.local-product-allergen-icon\{[^\n]*\}","",s,count=1)

css='''
/* Selected allergen warning: compact text instead of ambiguous icons. */
body.kol-customer .local-product-allergens{
  min-height:0;
  margin-top:4px;
  display:block;
  color:#c94f35;
  font-size:11px;
  font-weight:400;
  line-height:1.3;
  letter-spacing:.01em;
}
'''
if 'Selected allergen warning: compact text' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

p.write_text(s,encoding='utf-8')
