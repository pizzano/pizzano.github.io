from pathlib import Path
import re

hp=Path('test/test.html')
cp=Path('test/test.css')
h=hp.read_text(encoding='utf-8')
c=cp.read_text(encoding='utf-8')

old="function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.remove('kol-top-back-active')}\nfunction closeScreens(){$$('.screen').forEach(x=>x.hidden=true);document.body.classList.remove('kol-top-back-active')}"
new="function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.toggle('kol-top-back-active',['productScreen','cartScreen','infoScreen'].includes(id))}\nfunction closeScreens(){$$('.screen').forEach(x=>x.hidden=true);document.body.classList.remove('kol-top-back-active');scheduleActiveCategorySync()}"
assert old in h, 'openScreen block not found'
h=h.replace(old,new,1)

anchor="function renderHeader(){const a=account(),pb=$('#profileBtn');if(a){const letter=(a.name||a.phone||'K').trim().charAt(0).toUpperCase();pb.innerHTML=`<span class=\"profile-letter\">${letter}</span>`}else{pb.innerHTML='<svg class=\"plain-icon\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"3.2\"/><path d=\"M5.8 19c.8-3.1 3-4.7 6.2-4.7s5.4 1.6 6.2 4.7\"/></svg>'}}\n"
assert anchor in h, 'renderHeader anchor not found'
helpers=r'''let categorySyncFrame=0;
function setActiveCategory(id,bringIntoView=true){
 if(searchOpen)return;
 $$('.category-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
 const tab=document.querySelector(`.category-tab[data-tab="${id}"]`);
 if(tab&&bringIntoView)tab.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}
function syncActiveCategory(){
 categorySyncFrame=0;
 if(searchOpen)return;
 const shell=$('#menuShell'),sections=$$('.menu-section[data-section]');
 if(!shell||!sections.length)return;
 const marker=shell.getBoundingClientRect().top+Math.min(90,shell.clientHeight*.22);
 let active=sections[0].dataset.section;
 for(const sec of sections){if(sec.getBoundingClientRect().top<=marker)active=sec.dataset.section;else break}
 setActiveCategory(active,true);
}
function scheduleActiveCategorySync(){
 if(categorySyncFrame)cancelAnimationFrame(categorySyncFrame);
 categorySyncFrame=requestAnimationFrame(syncActiveCategory);
}
'''
h=h.replace(anchor,anchor+helpers,1)

old_click="$$('[data-tab]').forEach(b=>b.onclick=()=>document.querySelector(`[data-section=\"${b.dataset.tab}\"]`)?.scrollIntoView({behavior:'smooth',block:'start'}))"
new_click="$$('[data-tab]').forEach(b=>b.onclick=()=>{const id=b.dataset.tab,section=document.querySelector(`[data-section=\"${id}\"]`),shell=$('#menuShell');if(!section||!shell)return;setActiveCategory(id,true);const top=shell.scrollTop+section.getBoundingClientRect().top-shell.getBoundingClientRect().top;shell.scrollTo({top:Math.max(0,top),behavior:'smooth'})})"
assert old_click in h, 'category click binding not found'
h=h.replace(old_click,new_click,1)

old_tail="$('#allergenSave').onclick=()=>{selectedAllergens=new Set(draftAllergens);save(KEY.allergens,[...selectedAllergens]);$('#allergenModal').hidden=true;renderAll()};renderAll();"
new_tail="$('#allergenSave').onclick=()=>{selectedAllergens=new Set(draftAllergens);save(KEY.allergens,[...selectedAllergens]);$('#allergenModal').hidden=true;renderAll()};$('#menuShell').addEventListener('scroll',scheduleActiveCategorySync,{passive:true});renderAll();scheduleActiveCategorySync();"
assert old_tail in h, 'bootstrap tail not found'
h=h.replace(old_tail,new_tail,1)

# Keep the active tab in sync after every normal menu render.
old_render_end="$('#menuSections').innerHTML=html;bindMenu()}"
new_render_end="$('#menuSections').innerHTML=html;bindMenu();scheduleActiveCategorySync()}"
assert old_render_end in h, 'renderMenu normal tail not found'
h=h.replace(old_render_end,new_render_end,1)

# Normalize back-label CSS into one canonical rule set, without !important patches.
c=re.sub(r'(?:body\.)?\.kol-top-back-active \.brand-label\{[^}]*\}', '', c)
c=re.sub(r'(?:body\.)?\.kol-top-back-active \.brand-back-label\{[^}]*\}', '', c)
css_anchor='.brand-back-label{display:none;font-size:18px;font-weight:650}'
assert css_anchor in c, 'brand back css anchor not found'
c=c.replace(css_anchor, css_anchor+'body.kol-top-back-active .brand-label{display:none}body.kol-top-back-active .brand-back-label{display:block}',1)

# Cache bust only because CSS behavior changed.
h=re.sub(r'test\.css\?v=[^"\']+', 'test.css?v=back-tabs-20260818-0011', h, count=1)

hp.write_text(h,encoding='utf-8')
cp.write_text(c,encoding='utf-8')

# Static invariants for regression safety.
assert "['productScreen','cartScreen','infoScreen'].includes(id)" in h
assert "addEventListener('scroll',scheduleActiveCategorySync" in h
assert "classList.toggle('active',b.dataset.tab===id)" in h
assert 'body.kol-top-back-active .brand-label{display:none}' in c
assert 'body.kol-top-back-active .brand-back-label{display:block}' in c
print('PASS: back state + active category sync installed')
