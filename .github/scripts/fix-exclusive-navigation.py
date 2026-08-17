from pathlib import Path

path = Path('test/test.html')
text = path.read_text(encoding='utf-8')

old = """function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.toggle('kol-top-back-active',['productScreen','cartScreen','infoScreen'].includes(id))}\nfunction closeScreens(){$$('.screen').forEach(x=>x.hidden=true);document.body.classList.remove('kol-top-back-active');scheduleActiveCategorySync()}"""
new = """function closeTransientLayers(){\n $$('.screen').forEach(x=>x.hidden=true);\n const modal=$('#allergenModal');if(modal)modal.hidden=true;\n document.body.classList.remove('kol-top-back-active','allergen-modal-open');\n}\nfunction openScreen(id){closeTransientLayers();$('#'+id).hidden=false;document.body.classList.toggle('kol-top-back-active',['productScreen','cartScreen','infoScreen'].includes(id))}\nfunction closeScreens(){closeTransientLayers();scheduleActiveCategorySync()}\nfunction goToCategory(id){\n closeTransientLayers();\n requestAnimationFrame(()=>{\n  const section=document.querySelector(`[data-section=\"${id}\"]`),shell=$('#menuShell');\n  if(!section||!shell)return;\n  setActiveCategory(id,true);\n  const top=shell.scrollTop+section.getBoundingClientRect().top-shell.getBoundingClientRect().top;\n  shell.scrollTo({top:Math.max(0,top),behavior:'smooth'});\n });\n}"""
if old not in text:
    raise SystemExit('openScreen block not found')
text = text.replace(old, new, 1)

old = """$('#searchOpen').onclick=()=>{searchOpen=true;renderTabs()};$$('[data-tab]').forEach(b=>b.onclick=()=>{const id=b.dataset.tab,section=document.querySelector(`[data-section=\"${id}\"]`),shell=$('#menuShell');if(!section||!shell)return;setActiveCategory(id,true);const top=shell.scrollTop+section.getBoundingClientRect().top-shell.getBoundingClientRect().top;shell.scrollTo({top:Math.max(0,top),behavior:'smooth'})})"""
new = """$('#searchOpen').onclick=()=>{closeTransientLayers();searchOpen=true;renderTabs()};$$('[data-tab]').forEach(b=>b.onclick=()=>goToCategory(b.dataset.tab))"""
if old not in text:
    raise SystemExit('renderTabs navigation block not found')
text = text.replace(old, new, 1)

old = """function openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergens();$('#allergenModal').hidden=false;document.body.classList.add('allergen-modal-open')}"""
new = """function openAllergens(){closeTransientLayers();draftAllergens=new Set(selectedAllergens);renderAllergens();$('#allergenModal').hidden=false;document.body.classList.add('allergen-modal-open')}"""
if old not in text:
    raise SystemExit('openAllergens block not found')
text = text.replace(old, new, 1)

# Appbar destinations should rely on the same exclusive navigation rule.
text = text.replace("$('#brandBtn').onclick=()=>{closeAllergens();closeScreens()};$('#infoBtn').onclick=()=>{closeAllergens();openScreen('infoScreen');setInfoTab('about')};",
                    "$('#brandBtn').onclick=closeScreens;$('#infoBtn').onclick=()=>{openScreen('infoScreen');setInfoTab('about')};", 1)
text = text.replace("$('#infoAllergenBtn').onclick=()=>{closeScreens();openAllergens()};$('#profileBtn').onclick=()=>{closeAllergens();openScreen('accountScreen');account()?renderProfileMenu():renderLogin()};$('#cartBtn').onclick=()=>{closeAllergens();checkoutStep=1;renderCart();openScreen('cartScreen')};",
                    "$('#infoAllergenBtn').onclick=openAllergens;$('#profileBtn').onclick=()=>{openScreen('accountScreen');account()?renderProfileMenu():renderLogin()};$('#cartBtn').onclick=()=>{checkoutStep=1;renderCart();openScreen('cartScreen')};", 1)

path.write_text(text, encoding='utf-8')
print('patched exclusive navigation')
