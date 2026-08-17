from pathlib import Path

p = Path('test/test.html')
s = p.read_text(encoding='utf-8')

def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'missing pattern: {label}')
    s = s.replace(old, new, 1)

rep(
"""body.kol-customer .local-search-rail{width:100%;height:48px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:0 12px;background:#fff;border:0}
body.kol-customer .local-search-input-wrap{min-width:0;height:48px;margin:0;padding:0;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:5px;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
body.kol-customer .local-search-input-wrap svg{width:21px;height:21px;fill:none;stroke:#171717;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
body.kol-customer .local-search-input{width:100%!important;height:48px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;outline:0!important;background:transparent!important;color:#171717!important;font-size:16px!important;box-shadow:none!important;-webkit-appearance:none!important;appearance:none!important}
body.kol-customer .local-search-input::-webkit-search-decoration,body.kol-customer .local-search-input::-webkit-search-cancel-button{-webkit-appearance:none}
body.kol-customer .local-search-cancel{height:48px;margin:0;padding:0 0 0 10px;border:0;border-radius:0;background:transparent;color:#171717;font-size:15px;font-weight:500;box-shadow:none}""",
"""body.kol-customer .local-search-rail{width:100%;height:58px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 10px;background:#fff;border:0;border-bottom:1px solid #eee9e5}
body.kol-customer .local-search-input-wrap{min-width:0;height:46px;margin:0;padding:0 14px;display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:9px;border:1px solid #e3ded9!important;border-radius:15px!important;background:#f8f7f6!important;box-shadow:0 1px 2px rgba(33,28,24,.03)!important}
body.kol-customer .local-search-input-wrap:focus-within{border-color:#cfc7c0!important;background:#fff!important;box-shadow:0 0 0 3px rgba(243,106,45,.08)!important}
body.kol-customer .local-search-input-wrap svg{width:20px;height:20px;fill:none;stroke:#5d5752;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
body.kol-customer .local-search-input{width:100%!important;height:44px!important;margin:0!important;padding:0 8px 0 2px!important;border:0!important;border-radius:0!important;outline:0!important;background:transparent!important;color:#211d1a!important;font-size:15.5px!important;box-shadow:none!important;-webkit-appearance:none!important;appearance:none!important}
body.kol-customer .local-search-input::placeholder{color:#8b847e;opacity:1}
body.kol-customer .local-search-input::-webkit-search-decoration,body.kol-customer .local-search-input::-webkit-search-cancel-button{-webkit-appearance:none}
body.kol-customer .local-search-cancel{height:42px;margin:0;padding:0 4px 0 8px;border:0;border-radius:10px;background:transparent;color:#2d2926;font-size:14.5px;font-weight:550;box-shadow:none}""",
'main search styles')

rep(
"""body.kol-customer .local-allergen-sheet{position:relative;width:min(100vw,480px);max-width:480px;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:24px 24px 0 0;background:#fff;box-shadow:0 -12px 40px rgba(0,0,0,.16)}
body.kol-customer .local-allergen-head{position:relative;padding:22px 46px 12px;text-align:center}
body.kol-customer .local-allergen-head h2{margin:0;font-size:23px;font-weight:550}.local-allergen-head p{margin:8px 0 0;color:#666;font-size:13px}
body.kol-customer .local-allergen-close{position:absolute;top:13px;right:13px;width:34px;height:34px;border:0;border-radius:50%;background:#111;color:#fff;font-size:24px;line-height:1}
body.kol-customer .local-allergen-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:10px 12px 18px;overflow-y:auto}
body.kol-customer .local-allergen-option{min-height:72px;padding:8px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:1px solid #e0e2e4;border-radius:11px;background:#fff;color:#73777a;font-size:12.5px;font-weight:500}
body.kol-customer .local-allergen-option.selected{border-color:#555;background:#f3f4f4;color:#111}
body.kol-customer .local-allergen-symbol{font-size:20px;line-height:1;filter:grayscale(1)}
body.kol-customer .local-allergen-footer{padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:110px 1fr;gap:8px;border-top:1px solid #ece8e5;background:#fff}
body.kol-customer .local-allergen-reset,body.kol-customer .local-allergen-save{height:50px;border:0;border-radius:999px;font-size:15px;font-weight:550}
body.kol-customer .local-allergen-reset{background:#f0f1f2;color:#333}.local-allergen-save{background:#111;color:#fff}
@media(max-width:370px){body.kol-customer .local-allergen-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}""",
"""body.kol-customer .local-allergen-sheet{position:relative;width:min(100vw,480px);max-width:480px;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:24px 24px 0 0;background:#fff;box-shadow:0 -14px 44px rgba(0,0,0,.18)}
body.kol-customer .local-allergen-head{position:relative;padding:24px 52px 12px;text-align:center;background:#fff}
body.kol-customer .local-allergen-head h2{margin:0;color:#151312;font-size:25px;font-weight:650;letter-spacing:-.35px}.local-allergen-head p{max-width:390px;margin:9px auto 0;color:#5f5954;font-size:13.5px;line-height:1.45}
body.kol-customer .local-allergen-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border:0;border-radius:50%;background:#111;color:#fff;font-size:21px;line-height:1;box-shadow:none}
body.kol-customer .local-allergen-toolbar{padding:10px 12px 11px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;background:#fff}
body.kol-customer .local-allergen-search{height:46px;padding:0 13px;display:grid;grid-template-columns:21px minmax(0,1fr);align-items:center;gap:9px;border:1px solid #e2ddd8;border-radius:15px;background:#f7f6f5;box-shadow:0 1px 2px rgba(33,28,24,.03)}
body.kol-customer .local-allergen-search:focus-within{border-color:#cfc6bf;background:#fff;box-shadow:0 0 0 3px rgba(243,106,45,.08)}
body.kol-customer .local-allergen-search svg{width:19px;height:19px;fill:none;stroke:#77716c;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
body.kol-customer .local-allergen-search input{width:100%;height:44px;margin:0;padding:0 10px 0 3px;border:0;outline:0;background:transparent;color:#211d1a;font-size:15px;box-shadow:none;-webkit-appearance:none;appearance:none}
body.kol-customer .local-allergen-search input::placeholder{color:#8b847e;opacity:1}
body.kol-customer .local-allergen-search input::-webkit-search-decoration,body.kol-customer .local-allergen-search input::-webkit-search-cancel-button{-webkit-appearance:none}
body.kol-customer .local-allergen-reset{height:36px;padding:0 12px;border:1px solid #e5e0dc;border-radius:10px;background:#fff;color:#59534e;font-size:12.5px;font-weight:600;white-space:nowrap;box-shadow:none}
body.kol-customer .local-allergen-reset:disabled{opacity:.38}
body.kol-customer .local-allergen-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:8px 12px 16px;overflow-y:auto;overscroll-behavior:contain}
body.kol-customer .local-allergen-option{position:relative;min-height:76px;padding:9px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid #e0dcda;border-radius:13px;background:#fff;color:#77716c;font-size:12.5px;font-weight:520;transition:border-color .12s ease,background .12s ease,color .12s ease}
body.kol-customer .local-allergen-option.selected{border-color:#ef9c79;background:#fff5f0;color:#b94d21}
body.kol-customer .local-allergen-option.selected::after{content:'✓';position:absolute;top:7px;right:8px;width:16px;height:16px;display:grid;place-items:center;border-radius:50%;background:#f36a2d;color:#fff;font-size:10px;font-weight:700}
body.kol-customer .local-allergen-symbol{font-size:20px;line-height:1;filter:grayscale(1);opacity:.82}
body.kol-customer .local-allergen-option.selected .local-allergen-symbol{filter:none;opacity:1}
body.kol-customer .local-allergen-empty{grid-column:1/-1;padding:30px 12px;color:#8a837d;text-align:center;font-size:13px}
body.kol-customer .local-allergen-footer{padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr;gap:8px;border-top:1px solid #ece8e5;background:#fff}
body.kol-customer .local-allergen-device-note{min-height:40px;padding:0 12px;display:flex;align-items:center;border-radius:10px;background:#f5f5f4;color:#5e5853;font-size:12px}
body.kol-customer .local-allergen-save{height:50px;border:0;border-radius:14px;background:#111;color:#fff;font-size:15px;font-weight:650;box-shadow:none}
body.kol-customer .local-allergen-save:active{transform:translateY(1px)}
@media(max-width:370px){body.kol-customer .local-allergen-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.local-allergen-toolbar{grid-template-columns:1fr}.local-allergen-reset{justify-self:end}}""",
'allergen styles')

rep(
"""    <div class=\"local-allergen-head\"><button class=\"local-allergen-close\" id=\"closeAllergens\" type=\"button\" aria-label=\"Lukk\">×</button><h2 id=\"allergenTitle\">Alergener</h2><p>Velg allergener du vil markere i menyen. Produktene skjules ikke.</p></div>
    <div class=\"local-allergen-grid\" id=\"allergenGrid\"></div>
    <div class=\"local-allergen-footer\"><button class=\"local-allergen-reset\" id=\"resetAllergens\" type=\"button\">Nullstill</button><button class=\"local-allergen-save\" id=\"saveAllergens\" type=\"button\">Lagre filter</button></div>""",
"""    <div class=\"local-allergen-head\"><button class=\"local-allergen-close\" id=\"closeAllergens\" type=\"button\" aria-label=\"Lukk\">×</button><h2 id=\"allergenTitle\">Matallergier</h2><p>Velg dine matallergier, så varsler vi deg i menyen når et produkt inneholder noen av de valgte allergenene.</p></div>
    <div class=\"local-allergen-toolbar\"><label class=\"local-allergen-search\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m16.5 16.5 4 4\"></path></svg><input id=\"allergenSearch\" type=\"search\" autocomplete=\"off\" placeholder=\"Søk i allergener\" aria-label=\"Søk i allergener\"></label><button class=\"local-allergen-reset\" id=\"resetAllergens\" type=\"button\">Nullstill</button></div>
    <div class=\"local-allergen-grid\" id=\"allergenGrid\"></div>
    <div class=\"local-allergen-footer\"><div class=\"local-allergen-device-note\">Valgene lagres bare på denne enheten.</div><button class=\"local-allergen-save\" id=\"saveAllergens\" type=\"button\">Lagre</button></div>""",
'allergen markup')

rep(
"const ALLERGENS=[['gluten','🌾','Gluten'],['melk','🥛','Melk'],['egg','🥚','Egg'],['nøtter','🥜','Nøtter'],['soya','🫘','Soya'],['sennep','🌱','Sennep'],['selleri','🥬','Selleri'],['fisk','🐟','Fisk']];",
"const ALLERGENS=[['melk','🥛','Melk'],['gluten','🌾','Hvete / gluten'],['egg','🥚','Egg'],['soya','🫘','Soya'],['selleri','🌿','Selleri'],['sennep','🟡','Sennep'],['sesam','◌','Sesam'],['fisk','🐟','Fisk'],['skalldyr','🦐','Skalldyr'],['peanøtter','🥜','Peanøtter'],['nøtter','🌰','Nøtter'],['sulfitter','◇','Sulfitter']];",
'allergen list')

rep(
"let menu=load(KEY.menu,seedMenu),cart=load(KEY.cart,[]),favorites=new Set(load(KEY.fav,[])),orders=load(KEY.orders,[]),customer=load(KEY.customer,{}),selectedAllergens=new Set(load(KEY.allergens,[])),draftAllergens=new Set(selectedAllergens),selected=null,qty=1,selectedSize=0,checkoutStep=1,searchOpen=false,searchQuery='',expandedVirtual={favorites:false,popular:false};",
"let menu=load(KEY.menu,seedMenu),cart=load(KEY.cart,[]),favorites=new Set(load(KEY.fav,[])),orders=load(KEY.orders,[]),customer=load(KEY.customer,{}),selectedAllergens=new Set(load(KEY.allergens,[])),draftAllergens=new Set(selectedAllergens),allergenSearchQuery='',selected=null,qty=1,selectedSize=0,checkoutStep=1,searchOpen=false,searchQuery='',expandedVirtual={favorites:false,popular:false};",
'allergen search state')

rep(
"function renderAllergenGrid(){els.allergenGrid.innerHTML=ALLERGENS.map(([id,symbol,label])=>`<button class=\"local-allergen-option ${draftAllergens.has(id)?'selected':''}\" data-allergen=\"${id}\" type=\"button\"><span class=\"local-allergen-symbol\">${symbol}</span><span>${label}</span></button>`).join('')}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);renderAllergenGrid();els.allergenModal.hidden=false}",
"function renderAllergenGrid(){const q=normalize(allergenSearchQuery);const visible=ALLERGENS.filter(([id,,label])=>!q||normalize(`${id} ${label}`).includes(q));els.allergenGrid.innerHTML=visible.length?visible.map(([id,symbol,label])=>`<button class=\"local-allergen-option ${draftAllergens.has(id)?'selected':''}\" data-allergen=\"${id}\" type=\"button\"><span class=\"local-allergen-symbol\">${symbol}</span><span>${label}</span></button>`).join(''):'<div class=\"local-allergen-empty\">Ingen allergener funnet.</div>';const reset=$('#resetAllergens');if(reset)reset.disabled=draftAllergens.size===0}\nfunction openAllergens(){draftAllergens=new Set(selectedAllergens);allergenSearchQuery='';const input=$('#allergenSearch');if(input)input.value='';renderAllergenGrid();els.allergenModal.hidden=false}",
'allergen rendering')

rep(
"$('#closeAllergens').onclick=closeAllergens;$('#resetAllergens').onclick=()=>{draftAllergens.clear();renderAllergenGrid()};$('#saveAllergens').onclick=saveAllergens;els.allergenModal.addEventListener('click',e=>{if(e.target===els.allergenModal)closeAllergens()});",
"$('#closeAllergens').onclick=closeAllergens;$('#resetAllergens').onclick=()=>{draftAllergens.clear();renderAllergenGrid()};$('#saveAllergens').onclick=saveAllergens;$('#allergenSearch').addEventListener('input',e=>{allergenSearchQuery=e.target.value;renderAllergenGrid()});els.allergenModal.addEventListener('click',e=>{if(e.target===els.allergenModal)closeAllergens()});",
'allergen events')

# Copy-safe wording now that allergens are markers, not filters.
s = s.replace('Ingen produkter passer søket eller allergenfilteret.', 'Ingen produkter passer søket.')

p.write_text(s, encoding='utf-8')
