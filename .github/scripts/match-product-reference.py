from pathlib import Path

html_path=Path('test/test.html')
css_path=Path('test/test.css')
html=html_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

html=html.replace('<span class="brand-back-label">← Til meny</span>','<span class="brand-back-label">‹ Meny</span>',1)

# Add a dedicated product price formatter so menu prices remain unchanged.
anchor="const money=n=>`${Number(n||0).toLocaleString('nb-NO')} kr`;"
if "const productMoney=" not in html:
    html=html.replace(anchor,anchor+"\nconst productMoney=n=>`${Number(n||0).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})} KR`;",1)
html=html.replace("function updateProductTotal(){$('#productTotal').textContent=money(selectedProduct.sizes[selectedSize][1]*qty)}",
                  "function updateProductTotal(){$('#productTotal').textContent=productMoney(selectedProduct.sizes[selectedSize][1]*qty)}",1)

# Product view should keep search visible at far left and active real category visible, without leaving virtual tabs centered over it.
old="function openProduct(id){selectedProduct=product(id);selectedSize=0;selectedStrength=selectedProduct.strengths?.[0]||'';qty=1;$('#productBodyTitle').textContent=selectedProduct.name;$('#productDesc').textContent=selectedProduct.description;$('#productPhoto').style.backgroundImage=selectedProduct.image?`url('${selectedProduct.image}')`:'';renderSizeOptions();renderStrengthOptions();$('#qtyValue').textContent=qty;$('#productNote').value='';updateProductTotal();setActiveCategory(selectedProduct.sectionId,true);openScreen('productScreen')}"
new="function openProduct(id){selectedProduct=product(id);selectedSize=0;selectedStrength=selectedProduct.strengths?.[0]||'';qty=1;$('#productBodyTitle').textContent=selectedProduct.name;$('#productDesc').textContent=selectedProduct.description;$('#productPhoto').style.backgroundImage=selectedProduct.image?`url('${selectedProduct.image}')`:'';renderSizeOptions();renderStrengthOptions();$('#qtyValue').textContent=qty;$('#productNote').value='';updateProductTotal();openScreen('productScreen');setActiveCategory(selectedProduct.sectionId,false);const tabs=$('#tabs');if(tabs){tabs.scrollLeft=0;requestAnimationFrame(()=>{const active=document.querySelector(`.category-tab[data-tab=\"${selectedProduct.sectionId}\"]`);if(active)active.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'})})}}"
if old not in html:
    raise SystemExit('openProduct block not found')
html=html.replace(old,new,1)

# Product-specific layout polish, intentionally scoped to product screen only.
append='''\n/* Product detail reference layout */\n#productScreen{top:calc(var(--head) + var(--tabs));background:#fff}\n#productScreen .product-detail-scroll{background:#fff}\n#productScreen .product-photo{height:228px;border-bottom:1px solid var(--line);background-size:cover;background-position:center}\n#productScreen .product-name{padding:15px 12px 10px;font-size:21px;font-weight:750;background:#fff}\n#productScreen .product-summary{padding:13px 12px;font-size:14px;line-height:1.45;background:#fff}\n#productScreen .product-choice-head{min-height:46px;padding:0 12px;background:#fbf7f2;font-size:14px}\n#productScreen .product-choice{min-height:52px;padding:0 12px;grid-template-columns:28px minmax(0,1fr) auto;background:#fff}\n#productScreen .product-choice.active{background:#eff9f4;color:#2d765b}\n#productScreen .product-choice .choice-mark{width:24px;height:24px;background:#fff;border-color:#cfc8c3}\n#productScreen .product-choice.active .choice-mark{border-color:#4eb586;background:#f6fffa;color:#27905f}\n#productScreen .product-note-block{padding:15px 12px 8px;border-top:1px solid var(--line)}\n#productScreen .product-body textarea{min-height:74px;border-radius:9px}\n#productScreen .quantity-row{padding:12px;border-top:1px solid var(--line)}\n#productScreen .product-footer{grid-template-columns:98px minmax(0,1fr);padding:9px 10px max(9px,env(safe-area-inset-bottom));background:#fff}\n#productScreen .product-footer>strong{font-size:16px;font-weight:500}\n#productScreen .product-footer .primary{height:52px;border-radius:9px;font-size:15px}\nbody.kol-top-back-active .category-tabs-wrap{display:block}\nbody.kol-top-back-active .category-tabs-scroll{scroll-behavior:auto}\n'''
if '/* Product detail reference layout */' not in css:
    css += append
else:
    start=css.index('/* Product detail reference layout */')
    css=css[:start]+append

# Cache bust.
import re
html=re.sub(r'test\.css\?v=[^"\']+', 'test.css?v=product-reference-20260818-0024', html, count=1)

html_path.write_text(html,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
print('matched product reference')
