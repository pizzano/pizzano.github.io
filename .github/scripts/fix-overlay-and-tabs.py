from pathlib import Path

html_path=Path('test/test.html')
css_path=Path('test/test.css')
html=html_path.read_text()
css=css_path.read_text()

# 1) Hide favorites tab when there are no favorites.
old="host.innerHTML='<button class=\"search-tab\" id=\"searchOpen\">⌕</button>'+menu.map(s=>`<button class=\"category-tab\" data-tab=\"${s.id}\">${s.title}</button>`).join('');"
new="const tabMenu=menu.filter(s=>s.id!=='favorites'||activeFav().size>0);host.innerHTML='<button class=\"search-tab\" id=\"searchOpen\">⌕</button>'+tabMenu.map(s=>`<button class=\"category-tab\" data-tab=\"${s.id}\">${s.title}</button>`).join('');"
assert old in html, 'renderTabs target not found'
html=html.replace(old,new,1)

# 2) Centralize allergen modal open/close state.
old="function openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergens();$('#allergenModal').hidden=false}"
new="function closeAllergens(){const modal=$('#allergenModal');if(modal)modal.hidden=true;document.body.classList.remove('allergen-modal-open')}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergens();$('#allergenModal').hidden=false;document.body.classList.add('allergen-modal-open')}"
assert old in html, 'openAllergens target not found'
html=html.replace(old,new,1)

# 3) Header actions close allergen modal first, then execute requested action.
old="$('#brandBtn').onclick=closeScreens;$('#infoBtn').onclick=()=>{openScreen('infoScreen');setInfoTab('about')};"
new="$('#brandBtn').onclick=()=>{closeAllergens();closeScreens()};$('#infoBtn').onclick=()=>{closeAllergens();openScreen('infoScreen');setInfoTab('about')};"
assert old in html, 'header info binding target not found'
html=html.replace(old,new,1)

old="$('#infoAllergenBtn').onclick=()=>{closeScreens();openAllergens()};$('#profileBtn').onclick=()=>{openScreen('accountScreen');account()?renderProfileMenu():renderLogin()};$('#cartBtn').onclick=()=>{checkoutStep=1;renderCart();openScreen('cartScreen')};$$('[data-close]').forEach(b=>b.onclick=closeScreens);"
new="$('#infoAllergenBtn').onclick=()=>{closeScreens();openAllergens()};$('#profileBtn').onclick=()=>{closeAllergens();openScreen('accountScreen');account()?renderProfileMenu():renderLogin()};$('#cartBtn').onclick=()=>{closeAllergens();checkoutStep=1;renderCart();openScreen('cartScreen')};$$('[data-close]').forEach(b=>b.onclick=closeScreens);"
assert old in html, 'profile/cart binding target not found'
html=html.replace(old,new,1)

# 4) Allergen close/save/reset behavior + outside click.
old="$('#allergenBtn').onclick=openAllergens;$('#allergenClose').onclick=()=>$('#allergenModal').hidden=true;$('#allergenReset').onclick=()=>{draftAllergens.clear();renderAllergens()};$('#allergenSave').onclick=()=>{selectedAllergens=new Set(draftAllergens);save(KEY.allergens,[...selectedAllergens]);$('#allergenModal').hidden=true;renderAll()};$('#menuShell').addEventListener('scroll',scheduleActiveCategorySync,{passive:true});renderAll();scheduleActiveCategorySync();"
new="$('#allergenBtn').onclick=openAllergens;$('#allergenClose').onclick=closeAllergens;$('#allergenReset').onclick=()=>{draftAllergens.clear();renderAllergens()};$('#allergenSave').onclick=()=>{selectedAllergens=new Set(draftAllergens);save(KEY.allergens,[...selectedAllergens]);closeAllergens();renderAll()};$('#allergenModal').addEventListener('click',e=>{if(e.target===$('#allergenModal'))closeAllergens()});document.addEventListener('click',e=>{const openSheet=$$('.account-sheet,.info-sheet').find(s=>!s.hidden);if(!openSheet||openSheet.contains(e.target)||e.target.closest('.appbar'))return;closeScreens()},{capture:true});$('#menuShell').addEventListener('scroll',scheduleActiveCategorySync,{passive:true});renderAll();scheduleActiveCategorySync();"
assert old in html, 'allergen footer binding target not found'
html=html.replace(old,new,1)

# CSS: modal begins below orange bar; hide category strip only while allergen modal is open.
old_css=".local-allergen-modal{position:fixed;z-index:150;inset:0;left:50%;transform:translateX(-50%);width:min(100vw,var(--app));background:#0005;display:flex;align-items:flex-end}"
new_css=".local-allergen-modal{position:fixed;z-index:150;top:var(--head);bottom:0;left:50%;transform:translateX(-50%);width:min(100vw,var(--app));background:#0005;display:flex;align-items:flex-end}.allergen-modal-open .category-tabs-wrap{display:none}"
assert old_css in css, 'allergen modal CSS target not found'
css=css.replace(old_css,new_css,1)

html_path.write_text(html)
css_path.write_text(css)
