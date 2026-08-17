from pathlib import Path
import re

html_path=Path('test/test.html')
css_path=Path('test/test.css')
html=html_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

# Product detail markup: image -> title/description -> required option groups -> note/quantity -> footer.
new_product='''<section class="screen" id="productScreen" hidden>
  <div class="screen-scroll product-detail-scroll">
    <div class="product-photo" id="productPhoto"></div>
    <div class="product-body">
      <h2 class="product-name" id="productBodyTitle">Produkt</h2>
      <p class="product-summary" id="productDesc"></p>
      <div class="product-choice-group" id="sizeGroup">
        <div class="product-choice-head"><strong>Velg størrelse</strong><span>Obligatorisk</span></div>
        <div class="size-options" id="sizeOptions"></div>
      </div>
      <div class="product-choice-group" id="strengthGroup" hidden>
        <div class="product-choice-head"><strong>Velg styrke</strong><span>Obligatorisk</span></div>
        <div class="strength-options" id="strengthOptions"></div>
      </div>
      <div class="product-note-block">
        <label class="note-label">Spesielle instrukser</label>
        <textarea id="productNote" placeholder="Eksempel: Ingen løk"></textarea>
      </div>
      <div class="quantity-row"><span>Mengde</span><div class="quantity-stepper"><button id="qtyMinus">−</button><strong id="qtyValue">1</strong><button id="qtyPlus">+</button></div></div>
    </div>
  </div>
  <div class="product-footer"><strong id="productTotal">0 kr</strong><button class="primary" id="addToCart">Legg til i handlekurven</button></div>
</section>'''
html,n=re.subn(r'<section class="screen" id="productScreen" hidden>.*?</section>',new_product,html,count=1,flags=re.S)
assert n==1,'product screen not replaced'

# Kebab gets the old-style mandatory heat choice.
html=html.replace("{id:'k1',name:'Kebab i pita',description:'Kebabkjøtt, salat og dressing',image:IMG[2],allergens:['gluten','melk'],sizes:[['Standard',149]]}","{id:'k1',name:'Kebab i pita',description:'Kebabkjøtt, salat og dressing',image:IMG[2],allergens:['gluten','melk'],strengths:['Mild','Medium','Sterk'],sizes:[['Standard',149]]}")
html=html.replace("{id:'k2',name:'Kebab tallerken',description:'Kebabkjøtt, pommes frites, salat og dressing',image:IMG[2],allergens:['melk'],sizes:[['Standard',189]]}","{id:'k2',name:'Kebab tallerken',description:'Kebabkjøtt, pommes frites, salat og dressing',image:IMG[2],allergens:['melk'],strengths:['Mild','Medium','Sterk'],sizes:[['Standard',189]]}")

html=html.replace("selectedProduct=null,selectedSize=0,qty=1,checkoutStep=1;","selectedProduct=null,selectedSize=0,selectedStrength='',qty=1,checkoutStep=1;")

open_block='''function openProduct(id){selectedProduct=product(id);selectedSize=0;selectedStrength=selectedProduct.strengths?.[0]||'';qty=1;$('#productBodyTitle').textContent=selectedProduct.name;$('#productDesc').textContent=selectedProduct.description;$('#productPhoto').style.backgroundImage=selectedProduct.image?`url('${selectedProduct.image}')`:'';renderSizeOptions();renderStrengthOptions();$('#qtyValue').textContent=qty;$('#productNote').value='';updateProductTotal();setActiveCategory(selectedProduct.sectionId,true);openScreen('productScreen')}\nfunction renderSizeOptions(){const group=$('#sizeGroup');if(selectedProduct.sizes.length<=1){group.hidden=true;$('#sizeOptions').innerHTML='';return}group.hidden=false;$('#sizeOptions').innerHTML=selectedProduct.sizes.map((s,i)=>`<button class="product-choice ${i===selectedSize?'active':''}" data-size="${i}"><span class="choice-mark">${i===selectedSize?'✓':''}</span><span class="choice-label">${s[0]}</span><strong>${money(s[1])}</strong></button>`).join('');$$('[data-size]').forEach(b=>b.onclick=()=>{selectedSize=+b.dataset.size;renderSizeOptions();updateProductTotal()})}\nfunction renderStrengthOptions(){const group=$('#strengthGroup'),values=selectedProduct.strengths||[];if(!values.length){group.hidden=true;$('#strengthOptions').innerHTML='';return}group.hidden=false;$('#strengthOptions').innerHTML=values.map(v=>`<button class="product-choice ${v===selectedStrength?'active':''}" data-strength="${v}"><span class="choice-mark">${v===selectedStrength?'✓':''}</span><span class="choice-label">${v}</span></button>`).join('');$$('[data-strength]').forEach(b=>b.onclick=()=>{selectedStrength=b.dataset.strength;renderStrengthOptions()})}'''
html,n=re.subn(r'function openProduct\(id\)\{.*?\}\nfunction renderSizeOptions\(\)\{.*?\}\n(?=function updateProductTotal)',open_block+'\n',html,count=1,flags=re.S)
assert n==1,'product JS block not replaced'

old_add=re.search(r'function addCart\(\)\{.*?\}\nfunction renderCartCount',html,re.S)
assert old_add,'addCart not found'
new_add="""function addCart(){const size=selectedProduct.sizes[selectedSize],note=$('#productNote').value.trim(),strength=selectedProduct.strengths?.length?selectedStrength:'',key=`${selectedProduct.id}|${size[0]}|${strength}|${note}`,old=cart.find(x=>x.key===key);if(old)old.qty+=qty;else cart.push({key,productId:selectedProduct.id,name:selectedProduct.name,size:size[0],strength,price:size[1],qty,note});save(KEY.cart,cart);renderCartCount();closeScreens()}\nfunction renderCartCount"""
html=html[:old_add.start()]+new_add+html[old_add.end():]

html=html.replace("<small>Størrelse: ${x.size}${x.note?`<br>${x.note}`:''}</small>","<small>Størrelse: ${x.size}${x.strength?`<br>Styrke: ${x.strength}`:''}${x.note?`<br>${x.note}`:''}</small>")

# Cache bust because this update changes both HTML and CSS.
html=re.sub(r'test\.css\?v=[^\"\']+', 'test.css?v=product-detail-20260818-0013', html, count=1)

# Replace the old product-specific styling, not append a competing patch layer.
pattern=r'\.product-titlebar\{display:none\}\.product-photo\{.*?\}\.size-option\.active\{.*?\}'
new_css='''.product-titlebar{display:none}.product-detail-scroll{background:#fff}.product-photo{height:240px;background:#eee center/cover no-repeat}.product-body{padding:0;background:#fff}.product-name{margin:0;padding:14px 12px 9px;border-bottom:1px solid var(--line);font-size:21px;line-height:1.2}.product-summary{margin:0;padding:12px;color:var(--mut);font-size:14px;line-height:1.45;border-bottom:1px solid var(--line)}.product-choice-group{margin:0;border-bottom:1px solid var(--line)}.product-choice-head{min-height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#fbf7f2;border-bottom:1px solid var(--line);font-size:14px}.product-choice-head span{font-weight:700;color:#2f2925}.size-options,.strength-options{display:grid}.product-choice{min-height:50px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:0 12px;border:0;border-bottom:1px solid var(--line);background:#fff;text-align:left;color:var(--txt)}.product-choice:last-child{border-bottom:0}.product-choice .choice-mark{width:24px;height:24px;border:1px solid #c9c1bc;border-radius:50%;display:grid;place-items:center;color:transparent;font-size:15px}.product-choice .choice-label{font-size:14px}.product-choice strong{font-size:14px}.product-choice.active{background:#eff9f4;color:#246b50}.product-choice.active .choice-mark{border-color:#52b98b;color:#25835a;background:#f4fff9}.product-note-block{padding:14px 12px 0}.note-label{display:block;font-size:13px;font-weight:650;margin:0 0 7px}.product-body textarea{width:100%;min-height:68px;padding:11px;border:1px solid #d9d3cf;border-radius:10px;background:#fff;outline:0;resize:vertical}.product-body textarea:focus{border-color:#bbb2ad}.quantity-row{display:flex;justify-content:space-between;align-items:center;padding:14px 12px;margin:0}.quantity-stepper{display:flex;align-items:center;gap:10px}.quantity-stepper button{width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:#fff}'''
css,n=re.subn(pattern,new_css,css,count=1,flags=re.S)
assert n==1,'product CSS block not replaced'

# Remove now-duplicate old textarea/quantity product rules while preserving shared checkout/profile selectors.
css=css.replace('.product-body textarea,.checkout-grid input,.profile-form input,.profile-form select{width:100%;border:1px solid #d9d3cf;border-radius:11px;background:#fff;outline:0}.product-body textarea{min-height:70px;padding:11px}.quantity-row{display:flex;justify-content:space-between;align-items:center;margin-top:16px}.quantity-stepper{display:flex;align-items:center;gap:10px}.quantity-stepper button{width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:#fff}', '.checkout-grid input,.profile-form input,.profile-form select{width:100%;border:1px solid #d9d3cf;border-radius:11px;background:#fff;outline:0}')

html_path.write_text(html,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
