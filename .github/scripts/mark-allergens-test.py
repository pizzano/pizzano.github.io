from pathlib import Path
p=Path('test/test.html')
s=p.read_text(encoding='utf-8')
repls=[
("body.kol-customer .local-product-allergens{margin-top:2px;color:#c74336;font-size:11.5px;font-weight:400;line-height:1.25;white-space:normal}","body.kol-customer .local-product-allergens{margin-top:5px;display:flex;align-items:center;gap:4px;min-height:20px}\nbody.kol-customer .local-product-allergen-icon{width:20px;height:20px;display:inline-grid;place-items:center;border:1px solid #efc9c2;border-radius:50%;background:#fff8f6;font-size:12px;line-height:1}") ,
("Velg allergener du vil unngå. Produkter som inneholder dem skjules.","Velg allergener du vil markere i menyen. Produktene skjules ikke."),
("function visibleItems(items=[]){return items.filter(p=>passesAllergens(p)&&matchesSearch(p))}","function visibleItems(items=[]){return items.filter(matchesSearch)}"),
("  const favItems=allItems().filter(x=>favorites.has(x.id)&&passesAllergens(x));const popular=allItems().filter(passesAllergens).slice(0,5);\n  return menu.map(s=>s.id==='favorites'?{...s,note:'Produkter du har lagret.',items:favItems}:s.id==='popular'?{...s,note:'Populære valg i testmenyen.',items:popular}:{...s,items:(s.items||[]).filter(passesAllergens)}).filter(s=>(!s.virtual||(s.items&&s.items.length))&&(s.items||[]).length);",
"  const favItems=allItems().filter(x=>favorites.has(x.id));const popular=allItems().slice(0,5);\n  return menu.map(s=>s.id==='favorites'?{...s,note:'Produkter du har lagret.',items:favItems}:s.id==='popular'?{...s,note:'Populære valg i testmenyen.',items:popular}:{...s,items:(s.items||[])}).filter(s=>(!s.virtual||(s.items&&s.items.length))&&(s.items||[]).length);") ,
("function productAllergenText(p){if(!selectedAllergens.size)return '';const ids=allergensOf(p);if(!ids.length)return '';const labels=ids.map(id=>ALLERGENS.find(a=>a[0]===id)?.[2]||id);return `<div class=\"local-product-allergens\">Inneholder: ${labels.join(', ')}</div>`}",
"function productAllergenText(p){if(!selectedAllergens.size)return '';const ids=allergensOf(p).filter(id=>selectedAllergens.has(id));if(!ids.length)return '';return `<div class=\"local-product-allergens\" aria-label=\"Markerte allergener\">${ids.map(id=>{const a=ALLERGENS.find(x=>x[0]===id);return `<span class=\"local-product-allergen-icon\" title=\"${a?.[2]||id}\" aria-label=\"${a?.[2]||id}\">${a?.[1]||'⚠'}</span>`}).join('')}</div>`}") ,
("${selectedAllergens.size?`<div class=\"local-filter-note\">Skjuler produkter med: ${[...selectedAllergens].map(id=>ALLERGENS.find(a=>a[0]===id)?.[2]||id).join(', ')}</div>`:''}",""),
("  els.sections.innerHTML=tools+(selectedAllergens.size?`<div class=\"local-filter-note\">Skjuler produkter med: ${[...selectedAllergens].map(id=>ALLERGENS.find(a=>a[0]===id)?.[2]||id).join(', ')}</div>`:'')+sections.map(s=>","  els.sections.innerHTML=tools+sections.map(s=>")
]
for old,new in repls:
    if old not in s:
        raise SystemExit('missing pattern: '+old[:120])
    s=s.replace(old,new,1)
# passesAllergens can remain as a harmless helper, but it must no longer be used for rendering.
p.write_text(s,encoding='utf-8')
