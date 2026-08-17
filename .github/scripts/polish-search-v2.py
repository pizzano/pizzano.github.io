from pathlib import Path
p=Path('test/test.html')
s=p.read_text(encoding='utf-8')

old='''    <div class="local-allergen-toolbar"><label class="local-allergen-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg><input id="allergenSearch" type="search" autocomplete="off" placeholder="Søk i allergener" aria-label="Søk i allergener"></label><button class="local-allergen-reset" id="resetAllergens" type="button">Nullstill</button></div>'''
new='''    <div class="local-allergen-toolbar local-allergen-toolbar-reset"><button class="local-allergen-reset" id="resetAllergens" type="button">Nullstill</button></div>'''
if old not in s: raise SystemExit('allergen toolbar pattern missing')
s=s.replace(old,new,1)

s=s.replace(",allergenSearchQuery='',selected=null",",selected=null",1)

old="""function renderAllergenGrid(){const q=normalize(allergenSearchQuery);const visible=ALLERGENS.filter(([id,,label])=>!q||normalize(`${id} ${label}`).includes(q));els.allergenGrid.innerHTML=visible.length?visible.map(([id,symbol,label])=>`<button class=\"local-allergen-option ${draftAllergens.has(id)?'selected':''}\" data-allergen=\"${id}\" type=\"button\"><span class=\"local-allergen-symbol\">${symbol}</span><span>${label}</span></button>`).join(''):'<div class=\"local-allergen-empty\">Ingen allergener funnet.</div>';const reset=$('#resetAllergens');if(reset)reset.disabled=draftAllergens.size===0}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);allergenSearchQuery='';const input=$('#allergenSearch');if(input)input.value='';renderAllergenGrid();els.allergenModal.hidden=false}"""
new="""function renderAllergenGrid(){els.allergenGrid.innerHTML=ALLERGENS.map(([id,symbol,label])=>`<button class=\"local-allergen-option ${draftAllergens.has(id)?'selected':''}\" data-allergen=\"${id}\" type=\"button\"><span class=\"local-allergen-symbol\">${symbol}</span><span>${label}</span></button>`).join('');const reset=$('#resetAllergens');if(reset)reset.disabled=draftAllergens.size===0}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergenGrid();els.allergenModal.hidden=false}"""
if old not in s: raise SystemExit('allergen render/search pattern missing')
s=s.replace(old,new,1)

listener="$('#allergenSearch').addEventListener('input',e=>{allergenSearchQuery=e.target.value;renderAllergenGrid()});"
s=s.replace(listener,'',1)

css='''
/* Search polish v2: one surface, no nested focus ring. */
body.kol-customer .local-search-rail{height:54px;padding:6px 12px;gap:8px;border-bottom:1px solid #ece8e5;background:#fff}
body.kol-customer .local-search-input-wrap{height:42px;padding:0 12px;grid-template-columns:20px minmax(0,1fr);gap:8px;border:1px solid #e3ded9!important;border-radius:13px!important;background:#f8f7f6!important;box-shadow:none!important;transition:border-color .12s ease,background .12s ease}
body.kol-customer .local-search-input-wrap:focus-within{border-color:#d4cdc7!important;background:#fff!important;box-shadow:none!important;outline:none!important}
body.kol-customer .local-search-input-wrap svg{width:18px;height:18px;stroke:#77716c}
body.kol-customer #localSearchInput{height:40px!important;padding:0 6px!important;border:0!important;border-radius:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;-webkit-appearance:none!important;appearance:none!important;-webkit-tap-highlight-color:transparent}
body.kol-customer #localSearchInput:focus,body.kol-customer #localSearchInput:focus-visible{border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important}
body.kol-customer .local-search-cancel{height:42px;padding:0 4px 0 10px;font-size:14px;color:#312d2a}
body.kol-customer .local-allergen-toolbar-reset{min-height:40px;padding:0 12px 8px;display:flex;justify-content:flex-end;align-items:center;background:#fff}
body.kol-customer .local-allergen-toolbar-reset .local-allergen-reset{height:32px;padding:0 11px;border-radius:9px;font-size:12px}
'''
if '/* Search polish v2:' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

p.write_text(s,encoding='utf-8')
