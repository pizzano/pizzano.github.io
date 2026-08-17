from pathlib import Path
import re

p=Path('test/test.html')
s=p.read_text(encoding='utf-8')

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing {label}')
    s=s.replace(old,new,1)

rep("body.kol-customer .local-search-button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n",
"body.kol-customer .local-search-button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\nbody.kol-customer .local-allergen-rail{flex:0 0 auto;height:48px;margin:0;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-bottom:2px solid transparent;border-radius:0;background:#fff;color:#403a36;font-size:13px;font-weight:500;white-space:nowrap}\nbody.kol-customer .local-allergen-rail.has-filter{color:#f36a2d;border-bottom-color:#f36a2d}\nbody.kol-customer .local-more-wrap{padding:7px 12px 11px;border-bottom:1px solid var(--line);background:#fff}\nbody.kol-customer .local-more-button{width:100%;height:30px;margin:0;padding:0;border:1px solid #e4ded9;border-radius:4px;background:#fff;color:#625b56;font-size:12.5px;font-weight:500;box-shadow:none}\n",
'allergen rail css')

rep("let menu=load(KEY.menu,seedMenu),cart=load(KEY.cart,[]),favorites=new Set(load(KEY.fav,[])),orders=load(KEY.orders,[]),customer=load(KEY.customer,{}),selectedAllergens=new Set(load(KEY.allergens,[])),draftAllergens=new Set(selectedAllergens),selected=null,qty=1,selectedSize=0,checkoutStep=1,searchOpen=false,searchQuery='';",
"let menu=load(KEY.menu,seedMenu),cart=load(KEY.cart,[]),favorites=new Set(load(KEY.fav,[])),orders=load(KEY.orders,[]),customer=load(KEY.customer,{}),selectedAllergens=new Set(load(KEY.allergens,[])),draftAllergens=new Set(selectedAllergens),selected=null,qty=1,selectedSize=0,checkoutStep=1,searchOpen=false,searchQuery='',expandedVirtual={favorites:false,popular:false};",
'expanded state')

old_tabs="""  els.tabs.innerHTML=`<button class=\"local-search-button\" data-search-open type=\"button\" aria-label=\"Søk\"><svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m16.5 16.5 4 4\"></path></svg></button>`+sectionsForRender().map((s,i)=>`<button class=\"category-tab ${i===0?'active':''}\" data-tab=\"${s.id}\" type=\"button\">${s.title}</button>`).join('');
"""
new_tabs="""  els.tabs.innerHTML=`<button class=\"local-search-button\" data-search-open type=\"button\" aria-label=\"Søk\"><svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m16.5 16.5 4 4\"></path></svg></button><button class=\"local-allergen-rail ${selectedAllergens.size?'has-filter':''}\" data-open-allergens type=\"button\">⚠ Alergener${selectedAllergens.size?` <span class=\"local-allergen-count\">${selectedAllergens.size}</span>`:''}</button>`+sectionsForRender().map((s,i)=>`<button class=\"category-tab ${i===0?'active':''}\" data-tab=\"${s.id}\" type=\"button\">${s.title}</button>`).join('');
"""
rep(old_tabs,new_tabs,'main allergen button')

old_render="""  els.sections.innerHTML=sections.map(s=>`<section class=\"menu-app-section\" data-section=\"${s.id}\"><div class=\"menu-app-section-head\"><h2>${s.title}</h2>${s.note?`<p>${s.note}</p>`:''}</div><div class=\"menu-list\">${(s.items||[]).map(productRow).join('')}</div></section>`).join('');renderTabs();
"""
new_render="""  els.sections.innerHTML=sections.map(s=>{const limited=s.id==='favorites'||s.id==='popular';const items=limited&&!expandedVirtual[s.id]?(s.items||[]).slice(0,3):(s.items||[]);const more=limited&&(s.items||[]).length>3?`<div class=\"local-more-wrap\"><button class=\"local-more-button\" data-vis-mer=\"${s.id}\" type=\"button\">${expandedVirtual[s.id]?'Vis mindre':'Vis mer'}</button></div>`:'';return `<section class=\"menu-app-section\" data-section=\"${s.id}\"><div class=\"menu-app-section-head\"><h2>${s.title}</h2>${s.note?`<p>${s.note}</p>`:''}</div><div class=\"menu-list\">${items.map(productRow).join('')}</div>${more}</section>`}).join('');renderTabs();
"""
rep(old_render,new_render,'three item limit')

old_sections="""els.sections.addEventListener('click',e=>{const fav=e.target.closest('[data-fav]');if(fav){e.stopPropagation();toggleFavorite(fav.dataset.fav);return}const add=e.target.closest('[data-add]');if(add){e.stopPropagation();openProduct(add.dataset.add);return}if(e.target.closest('[data-open-allergens]')){openAllergens();return}const row=e.target.closest('[data-product]');if(row)openProduct(row.dataset.product)});"""
new_sections="""els.sections.addEventListener('click',e=>{const fav=e.target.closest('[data-fav]');if(fav){e.stopPropagation();toggleFavorite(fav.dataset.fav);return}const add=e.target.closest('[data-add]');if(add){e.stopPropagation();openProduct(add.dataset.add);return}const more=e.target.closest('[data-vis-mer]');if(more){expandedVirtual[more.dataset.visMer]=!expandedVirtual[more.dataset.visMer];renderMenu();return}if(e.target.closest('[data-open-allergens]')){openAllergens();return}const row=e.target.closest('[data-product]');if(row)openProduct(row.dataset.product)});"""
rep(old_sections,new_sections,'vis mer handler')

old_tabs_click="""els.tabs.addEventListener('click',e=>{if(e.target.closest('[data-search-open]')){openSearch();return}if(e.target.closest('#cancelSearch')){closeSearch();return}const b=e.target.closest('[data-tab]');if(!b)return;$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelector(`[data-section=\"${b.dataset.tab}\"]`)?.scrollIntoView({block:'start'})});"""
new_tabs_click="""els.tabs.addEventListener('click',e=>{if(e.target.closest('[data-search-open]')){openSearch();return}if(e.target.closest('[data-open-allergens]')){openAllergens();return}if(e.target.closest('#cancelSearch')){closeSearch();return}const b=e.target.closest('[data-tab]');if(!b)return;$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelector(`[data-section=\"${b.dataset.tab}\"]`)?.scrollIntoView({block:'start'})});"""
rep(old_tabs_click,new_tabs_click,'allergen rail click')

for needle in ['local-allergen-rail','data-vis-mer','slice(0,3)','expandedVirtual','data-open-allergens']:
    if needle not in s: raise SystemExit(f'missing invariant {needle}')
p.write_text(s,encoding='utf-8')
print('patched test/test.html')
