from pathlib import Path

p = Path('test/test.html')
s = p.read_text(encoding='utf-8')

old = "function renderAllergens(){draftAllergens=new Set(selectedAllergens);$('#allergenGrid').innerHTML=ALLERGENS.map(a=>`<button class=\"allergen-choice ${draftAllergens.has(a[0])?'active':''}\" data-allergen=\"${a[0]}\"><span>${a[1]}</span>${a[2]}</button>`).join('');$$('[data-allergen]').forEach(b=>b.onclick=()=>{draftAllergens.has(b.dataset.allergen)?draftAllergens.delete(b.dataset.allergen):draftAllergens.add(b.dataset.allergen);renderAllergens()})}"
new = "function renderAllergens(){$('#allergenGrid').innerHTML=ALLERGENS.map(a=>`<button class=\"allergen-choice ${draftAllergens.has(a[0])?'active':''}\" data-allergen=\"${a[0]}\"><span>${a[1]}</span>${a[2]}</button>`).join('');$$('[data-allergen]').forEach(b=>b.onclick=()=>{draftAllergens.has(b.dataset.allergen)?draftAllergens.delete(b.dataset.allergen):draftAllergens.add(b.dataset.allergen);renderAllergens()})}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergens();$('#allergenModal').hidden=false}"
assert old in s, 'old allergen renderer not found'
s = s.replace(old, new, 1)

s = s.replace("$('#infoAllergenBtn').onclick=()=>{closeScreens();renderAllergens();$('#allergenModal').hidden=false}", "$('#infoAllergenBtn').onclick=()=>{closeScreens();openAllergens()}", 1)
s = s.replace("$('#allergenBtn').onclick=()=>{renderAllergens();$('#allergenModal').hidden=false}", "$('#allergenBtn').onclick=openAllergens", 1)
s = s.replace("$('#allergenReset').onclick=()=>{draftAllergens.clear();renderAllergens()}", "$('#allergenReset').onclick=()=>{draftAllergens.clear();renderAllergens()}", 1)

assert "function openAllergens(){draftAllergens=new Set(selectedAllergens);" in s
assert "function renderAllergens(){draftAllergens=new Set(selectedAllergens)" not in s
assert "$('#allergenBtn').onclick=openAllergens" in s
assert "$('#allergenSave').onclick" in s
assert "$('#profileBtn').onclick" in s
assert "$('#cartBtn').onclick" in s
assert "$('#infoBtn').onclick" in s

p.write_text(s, encoding='utf-8')
