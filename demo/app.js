/* KØL customer app — consolidated 2026-08-20 */
/* Core menu, cart, profile, loyalty, allergens and admin bridge */

const KEY={cart:'kol-demo-cart-v3',orders:'kol-demo-orders-v3',allergens:'kol-demo-allergens-v3',accounts:'kol-demo-accounts-v2',session:'kol-demo-session-v2',guestFav:'kol-demo-guest-fav-v2'};
const IMG=['https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=640&q=80','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=640&q=80','https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=640&q=80'];
let MENU=[{id:'popular',title:'Mest bestilt',virtual:true},{id:'pizza',title:'Pizza',note:'Alle pizzaer kommer med ost og tomatsaus: Stor for 2–3 personer, medium for 1 person.',items:[{id:'p1',name:'1. Clasico',description:'Skinke eller pepperoni',image:IMG[0],allergens:['gluten','melk'],sizes:[['Medium',145],['Stor',175]]},{id:'p2',name:'2. Capri',description:'Skinke, bacon og sopp',image:IMG[1],allergens:['gluten','melk'],sizes:[['Medium',155],['Stor',185]]},{id:'p3',name:'3. Al capone',description:'Pepperoni, biff, paprika og løk',image:IMG[0],allergens:['gluten','melk'],sizes:[['Medium',165],['Stor',195]]},{id:'p4',name:'4. Parma',description:'Parmaskinke, pesto-olje, rukkola og parmesanost',image:IMG[1],allergens:['gluten','melk','nøtter'],sizes:[['Medium',185],['Stor',215]]},{id:'p5',name:'5. Sjefens favoritt',description:'Biff, skinke, pepperoni og paprika',image:IMG[0],allergens:['gluten','melk'],sizes:[['Medium',185],['Stor',215]]},{id:'p6',name:'6. Torino',description:'Pepperoni, skinke, løk og paprika',image:IMG[1],allergens:['gluten','melk'],sizes:[['Medium',175],['Stor',205]]}]},{id:'kebab',title:'Kebab retter',items:[{id:'k1',name:'Kebab i pita',description:'Kebabkjøtt, salat og dressing',image:IMG[2],allergens:['gluten','melk','egg','sennep','sesam'],strengths:['Mild','Medium','Sterk'],sizes:[['Standard',149]]},{id:'k2',name:'Kebab tallerken',description:'Kebabkjøtt, pommes frites, salat og dressing',image:IMG[2],allergens:['melk','egg','sennep'],strengths:['Mild','Medium','Sterk'],sizes:[['Standard',189]]}]},{id:'burger',title:'Hjemmelagde burgere',items:[{id:'b1',name:'Cheeseburger',description:'Burger, ost, salat og dressing',image:IMG[2],allergens:['gluten','melk','egg','sennep','sesam'],sizes:[['160 g',159],['250 g',199]]},{id:'b2',name:'Baconburger',description:'Burger, bacon, ost og salat',image:IMG[2],allergens:['gluten','melk','egg','sennep','sesam'],sizes:[['160 g',179],['250 g',219]]}]},{id:'drikke',title:'Drikke',items:[{id:'d1',name:'Coca-Cola 0,5L',description:'Kald drikke',image:'',allergens:[],sizes:[['0,5L',39]]},{id:'d2',name:'Fanta 0,5L',description:'Kald drikke',image:'',allergens:[],sizes:[['0,5L',39]]}]}];
const ALLERGENS=[['melk','🥛','Melk'],['gluten','🌾','Hvete / gluten'],['egg','🥚','Egg'],['soya','🫘','Soya'],['selleri','🌿','Selleri'],['sennep','🟡','Sennep'],['sesam','◌','Sesam'],['fisk','🐟','Fisk'],['skalldyr','🦐','Skalldyr'],['peanøtter','🥜','Peanøtter'],['nøtter','🌰','Nøtter'],['sulfitter','◇','Sulfitter']];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const KOL_ADMIN_BRIDGE={mode:'local-demo',databaseURL:'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app/',menuKeys:['sections','extraOptions','customPizzaToppings','kebabPitaOptions','optionGroups','siteSettings','rescueDeals']};
let ACTIVE_SITE_SETTINGS={restaurantName:'KØL Grill & Pizza',phone:'+47 41 14 53 53',streetAddress:'ØGARDSVEGEN 44',postalCode:'2100',city:'SKARNES',openingDays:'Mandag - Søndag',orderOpenTime:'14:00',orderCloseTime:'22:00',minPreorderMinutes:'0'};
const ADMIN_ALLERGEN_MAP={melk:'melk',hvete:'gluten',gluten:'gluten',egg:'egg',soya:'soya',selleri:'selleri',sennep:'sennep',sesam:'sesam',fisk:'fisk',skalldyr:'skalldyr','peanøtter':'peanøtter',peanotter:'peanøtter','nøtter':'nøtter',notter:'nøtter',sulfitter:'sulfitter'};
function adminArray(value){return Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[])}
function adminAllergens(value){const source=Array.isArray(value)?value:String(value||'').split(/[,;|]/);return [...new Set(source.map(v=>ADMIN_ALLERGEN_MAP[norm(String(v).trim())]).filter(Boolean))]}
function adminSizes(product={}){let source=adminArray(product.sizes).map((size,index)=>[String(size?.label||size?.name||size?.id||`Valg ${index+1}`),Number(size?.price)]).filter(size=>Number.isFinite(size[1]));if(!source.length&&Number.isFinite(Number(product.mediumPrice)))source.push(['Medium',Number(product.mediumPrice)]);if(!source.length&&Number.isFinite(Number(product.price)))source.push(['Standard',Number(product.price)]);if(Number.isFinite(Number(product.largePrice))&&!source.some(size=>norm(size[0])==='stor'))source.push(['Stor',Number(product.largePrice)]);return source.length?source:[['Standard',0]]}
function adminStrengths(product={},config={}){const ids=new Set(adminArray(product.optionGroupIds).map(String));const group=adminArray(config.optionGroups).find(g=>ids.has(String(g.id))&&(norm(g.title).includes('styrke')||adminArray(g.options).some(o=>['mild','medium','sterk'].includes(norm(o.label)))));return group?adminArray(group.options).map(o=>String(o.label||'').trim()).filter(Boolean):[]}
function normalizeAdminConfigForCustomer(config={}){return adminArray(config.sections).map((section,index)=>{const sectionId=String(section?.id||`section-${index+1}`),title=String(section?.title||section?.name||`Kategori ${index+1}`),pizzaSection=norm(`${sectionId} ${title}`).includes('pizza');const sectionItems=adminArray(section?.items).filter(p=>p&&p.hidden!==true&&p.soldOut!==true).map((p,pIndex)=>({id:String(p.id||`${sectionId}-${pIndex+1}`),name:String(p.name||'Produkt'),description:String(p.ingredients||p.description||''),image:String(p.imageUrl||p.image||''),allergens:adminAllergens(p.allergens),sizes:adminSizes(p),strengths:adminStrengths(p,config),optionGroups:adminArray(p.optionGroupIds),loyaltyEligible:pizzaSection}));return{id:sectionId,title,note:String(section?.note||section?.description||''),items:sectionItems}}).filter(section=>section.items.length)}
function formatStorePhone(value=''){const digits=String(value).replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'');return digits.length===8?`+47 ${formatPhone(digits)}`:String(value||'')}
function applySiteSettings(settings={}){ACTIVE_SITE_SETTINGS={...ACTIVE_SITE_SETTINGS,...settings};const name=ACTIVE_SITE_SETTINGS.restaurantName||'KØL Grill & Pizza',address=[ACTIVE_SITE_SETTINGS.streetAddress,[ACTIVE_SITE_SETTINGS.postalCode,ACTIVE_SITE_SETTINGS.city].filter(Boolean).join(' ')].filter(Boolean).join(' · '),phone=formatStorePhone(ACTIVE_SITE_SETTINGS.phone),tel=String(ACTIVE_SITE_SETTINGS.phone||'').replace(/[^+\d]/g,''),days=String(ACTIVE_SITE_SETTINGS.openingDays||'Mandag - Søndag').replace(/ - /g,'–'),hours=`${ACTIVE_SITE_SETTINGS.orderOpenTime||'14:00'}–${ACTIVE_SITE_SETTINGS.orderCloseTime||'22:00'}`;if($('#storeName'))$('#storeName').textContent=name;if($('#storeAddress'))$('#storeAddress').textContent=address;if($('#storePhoneText'))$('#storePhoneText').textContent=phone;if($('#storeCallAction'))$('#storeCallAction').href=`tel:${tel}`;if($('#storePhoneRow'))$('#storePhoneRow').href=`tel:${tel}`;if($('#storeOpeningDays'))$('#storeOpeningDays').textContent=days;if($('#storeOpeningTime'))$('#storeOpeningTime').textContent=hours}
function applyAdminConfig(config={}){const sections=normalizeAdminConfigForCustomer(config);if(!sections.length)return false;MENU=[{id:'popular',title:'Mest bestilt',virtual:true},...sections];applySiteSettings(config.siteSettings||{});renderAll();return true}
function splitCustomerName(fullName=''){const parts=String(fullName).trim().split(/\s+/).filter(Boolean);return{firstName:parts[0]||'',lastName:parts.slice(1).join(' ')}}
function buildAdminOrderPayload({id,name,phone,total,pickup,lines,createdAt=new Date().toISOString()}){const person=splitCustomerName(name),scheduled=pickup&&pickup!=='asap';return{id:String(id),status:'pending',source:'kol-customer',customer:{fullName:String(name),firstName:person.firstName,lastName:person.lastName,phone:String(phone)},pickup:{mode:scheduled?'scheduled':'asap',time:scheduled?String(pickup):''},items:(lines||[]).map(line=>({productId:String(line.productId||''),name:String(line.name||'Produkt'),quantity:Math.max(1,Number(line.qty)||1),size:String(line.size||''),sizeLabel:String(line.size||''),extras:line.strength?[`Styrke: ${line.strength}`]:[],note:String(line.note||''),unitPrice:Number(line.price)||0,total:(Number(line.price)||0)*(Math.max(1,Number(line.qty)||1)),freeReward:line.freeReward===true})),subtotal:Number(total)||0,total:Number(total)||0,createdAt,updatedAt:createdAt}}
window.KOLIntegration={...KOL_ADMIN_BRIDGE,applyAdminConfig,applySiteSettings,normalizeAdminConfigForCustomer,buildAdminOrderPayload};
const money=n=>`${Number(n||0).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})} kr`,productMoney=n=>`${Number(n||0).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})} KR`,norm=s=>String(s||'').toLocaleLowerCase('nb-NO').normalize('NFD').replace(/[\u0300-\u036f]/g,''),escapeHtml=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),formatPhone=p=>String(p||'').replace(/(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4');
let cart=load(KEY.cart,[]),orders=load(KEY.orders,[]),accounts=load(KEY.accounts,{}),session=load(KEY.session,null),selectedAllergens=new Set(load(KEY.allergens,[])),draftAllergens=new Set(selectedAllergens),allergenSearch='',searchOpen=false,searchQuery='',expanded={popular:false,favorites:false},selectedProduct=null,selectedSize=0,selectedStrength='',qty=1,checkoutStep=1,editingCartIndex=-1,pickupChoice='asap',toastTimer=0,rewardMode=false;
const realSections=()=>MENU.filter(s=>!s.virtual),items=()=>realSections().flatMap(s=>(s.items||[]).map(p=>({...p,sectionId:s.id}))),product=id=>items().find(p=>p.id===id),allergenLabel=id=>ALLERGENS.find(a=>a[0]===id)?.[2]||id;
function normalizeLoyalty(a){if(!a)return a;let changed=false;const legacy=Math.max(0,Number(a.rewards)||0);let stamps=Math.max(0,Number(a.stamps)||0);if(legacy>0&&stamps<10){stamps=10;changed=true}if(stamps>10){stamps=10;changed=true}if(a.stamps!==stamps){a.stamps=stamps;changed=true}if(a.rewards!==0){a.rewards=0;changed=true}if(Object.prototype.hasOwnProperty.call(a,'savings')){delete a.savings;changed=true}if(changed)save(KEY.accounts,accounts);return a}
const account=()=>session&&accounts[session]?normalizeLoyalty(accounts[session]):null,favSet=()=>new Set(account()?.favorites||load(KEY.guestFav,[]));
const saveFav=set=>{if(account()){accounts[session].favorites=[...set];save(KEY.accounts,accounts)}else save(KEY.guestFav,[...set])};
function showToast(message){const toast=$('#actionToast');if(!toast||!message)return;clearTimeout(toastTimer);toast.textContent=message;toast.classList.remove('show');requestAnimationFrame(()=>toast.classList.add('show'));toastTimer=setTimeout(()=>toast.classList.remove('show'),2000)}
function ensureAccount(phone){if(!accounts[phone])accounts[phone]={phone,name:'',email:'',marketing:true,stamps:0,rewards:0,favorites:[]};normalizeLoyalty(accounts[phone]);save(KEY.accounts,accounts);return accounts[phone]}function saveAccounts(){save(KEY.accounts,accounts)}function setSession(phone){session=phone||null;save(KEY.session,session);renderHeader();renderTabs();renderMenu()}
function closeViews(){$$('.screen').forEach(s=>s.hidden=true);document.body.classList.remove('view-open','hide-tabs');$('#cartScreen').style.top=''}function openView(id,{tabs=true}={}){closeViews();const el=$('#'+id);if(!el)return;el.hidden=false;document.body.classList.add('view-open');if(!tabs)document.body.classList.add('hide-tabs')}function goMenu(){rewardMode=false;closeViews();requestAnimationFrame(syncActiveCategory)}
function goToCategory(id){rewardMode=false;closeViews();requestAnimationFrame(()=>{const shell=$('#menuShell'),sec=document.querySelector(`[data-section="${id}"]`);if(!shell||!sec)return;setActiveTab(id,true);const top=shell.scrollTop+sec.getBoundingClientRect().top-shell.getBoundingClientRect().top;shell.scrollTo({top:Math.max(0,top),behavior:'smooth'})})}
function renderHeader(){const a=account(),p=$('#profileBtn');p.innerHTML=a?`<span class="profile-letter">${escapeHtml((a.name||a.phone||'K').trim().charAt(0).toUpperCase())}</span>`:'<svg class="plain-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 19c.8-3.1 3-4.7 6.2-4.7s5.4 1.6 6.2 4.7"/></svg>'}function renderCartCount(){$('#cartCount').textContent=cart.reduce((n,x)=>n+x.qty,0)}
function renderTabs(){const host=$('#tabs');if(searchOpen){host.innerHTML=`<div class="tab-search"><span>⌕</span><input id="menuSearch" placeholder="Søk i menyen" value="${escapeHtml(searchQuery)}"><button id="searchCancel">Avbryt</button></div>`;$('#menuSearch').focus();$('#menuSearch').oninput=e=>{searchQuery=e.target.value;renderMenu()};$('#searchCancel').onclick=()=>{searchOpen=false;searchQuery='';renderTabs();renderMenu()};return}const fav=favSet(),tabs=[...(fav.size?[{id:'favorites',title:'Mine favoritter'}]:[]),...MENU];host.innerHTML='<button class="search-tab" id="searchOpen">⌕</button>'+tabs.map(s=>`<button class="category-tab" data-tab="${s.id}">${s.title}</button>`).join('');$('#searchOpen').onclick=()=>{goMenu();searchOpen=true;renderTabs()};$$('[data-tab]').forEach(b=>b.onclick=()=>goToCategory(b.dataset.tab))}
function setActiveTab(id,center=true){if(searchOpen)return;$$('.category-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));const tab=document.querySelector(`.category-tab[data-tab="${id}"]`);if(tab&&center)tab.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}
let syncFrame=0;function syncActiveCategory(){syncFrame=0;if(searchOpen||document.body.classList.contains('view-open'))return;const shell=$('#menuShell'),secs=$$('.menu-section[data-section]');if(!shell||!secs.length)return;const marker=shell.getBoundingClientRect().top+70;let active=secs[0].dataset.section;for(const sec of secs){if(sec.getBoundingClientRect().top<=marker)active=sec.dataset.section;else break}setActiveTab(active,true)}function scheduleSync(){if(syncFrame)cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(syncActiveCategory)}
function warning(p){const hits=(p.allergens||[]).filter(a=>selectedAllergens.has(a));return hits.length?`<div class="menu-allergen-warning">Inneholder: ${hits.map(allergenLabel).join(', ')}</div>`:''}function productRow(p){const fav=favSet().has(p.id),price=Math.min(...p.sizes.map(s=>s[1]));return `<article class="menu-row" data-product="${p.id}"><div class="menu-thumb" style="${p.image?`background-image:url('${p.image}')`:''}"></div><div class="menu-main"><strong>${p.name}</strong><div class="menu-desc">${p.description||''}</div>${warning(p)}</div><div class="menu-side"><button class="heart ${fav?'active':''}" data-fav="${p.id}">${fav?'♥':'♡'}</button><button class="plus" data-plus="${p.id}">+</button><span class="price">Fra ${money(price).replace(',00','')}</span></div></article>`}
function menuSection(id,title,list,note='',virtual=false){let shown=list,more='';if(virtual&&list.length>3&&!expanded[id])shown=list.slice(0,3);if(virtual&&list.length>3)more=`<button class="vis-more" data-more="${id}">${expanded[id]?'Vis mindre':'Vis mer'}</button>`;return `<section class="menu-section" data-section="${id}"><div class="menu-section-head"><div><h2>${title}</h2>${note?`<p>${note}</p>`:''}</div></div>${shown.map(productRow).join('')||'<div class="empty-note">Ingen produkter her ennå.</div>'}${more}</section>`}
function renderMenu(){const all=items(),fav=favSet(),q=norm(searchQuery);if(searchOpen&&q){const found=all.filter(p=>norm(`${p.name} ${p.description}`).includes(q));$('#menuSections').innerHTML=menuSection('search','Søkeresultater',found,`${found.length} produkter`);bindMenu();return}let html='';const favItems=all.filter(p=>fav.has(p.id));if(favItems.length)html+=menuSection('favorites','Mine favoritter',favItems,'',true);html+=menuSection('popular','Mest bestilt',all.slice(0,5),'Populære valg i testmenyen.',true);realSections().forEach(s=>html+=menuSection(s.id,s.title,s.items||[],s.note||''));$('#menuSections').innerHTML=html;bindMenu();scheduleSync()}
function refreshFavoriteUi(){const activeBefore=document.querySelector('.category-tab.active')?.dataset.tab||'',hasFavorites=favSet().size>0;renderMenu();renderTabs();requestAnimationFrame(()=>{if(activeBefore&&document.querySelector(`.category-tab[data-tab="${activeBefore}"]`))setActiveTab(activeBefore,false);else if(!hasFavorites)setActiveTab('popular',false);else scheduleSync()})}function bindMenu(){$$('[data-plus]').forEach(b=>b.onclick=e=>{e.stopPropagation();openProduct(b.dataset.plus)});$$('[data-product]').forEach(r=>r.onclick=e=>{if(!e.target.closest('button'))openProduct(r.dataset.product)});$$('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const f=favSet(),id=b.dataset.fav,was=f.has(id);was?f.delete(id):f.add(id);saveFav(f);refreshFavoriteUi();showToast(was?'Fjernet fra favoritter':'Lagt til i favoritter')});$$('[data-more]').forEach(b=>b.onclick=()=>{expanded[b.dataset.more]=!expanded[b.dataset.more];renderMenu()})}
function openProduct(id,{reward=false}={}){const p=product(id);if(!p)return;rewardMode=!!reward;editingCartIndex=-1;selectedProduct=p;selectedSize=0;selectedStrength=p.strengths?.[0]||'';qty=1;if(rewardMode){const stor=p.sizes.findIndex(s=>norm(s[0])==='stor');if(stor<0){rewardMode=false;showToast('Denne pizzaen finnes ikke som Stor');return}selectedSize=stor}$('#addToCart').textContent=rewardMode?'Legg til gratis Stor Pizza':'Legg til i handlekurven';fillProduct();openView('productScreen',{tabs:true});setActiveTab(p.sectionId,true)}
function openCartEdit(index){const line=cart[index],p=line&&product(line.productId);if(!line||!p)return;rewardMode=!!line.freeReward;editingCartIndex=index;selectedProduct=p;selectedSize=Math.max(0,p.sizes.findIndex(s=>s[0]===line.size));selectedStrength=line.strength||p.strengths?.[0]||'';qty=rewardMode?1:Math.max(1,line.qty||1);$('#addToCart').textContent=rewardMode?'Oppdater gratis pizza':'Oppdater handlekurven';fillProduct(line.note||'');openView('productScreen',{tabs:true});setActiveTab(p.sectionId,true)}
function fillProduct(note=''){$('#productTitle').textContent=selectedProduct.name;$('#productDesc').textContent=selectedProduct.description||'';$('#productPhoto').style.backgroundImage=selectedProduct.image?`url('${selectedProduct.image}')`:'';const names=(selectedProduct.allergens||[]).map(allergenLabel);$('#productAllergens').innerHTML=`<strong>Allergener:</strong> ${names.length?names.join(', '):'Ingen oppgitt'}`;$('#qtyValue').textContent=qty;$('#productNote').value=note;const banner=$('#rewardProductBanner'),qr=document.querySelector('.quantity-row');if(rewardMode){const regular=selectedProduct.sizes[selectedSize][1];banner.hidden=false;banner.innerHTML=`🎁 <strong>Gratis Stor Pizza</strong><span>Du sparer ${money(regular)}</span>`;qr.hidden=true}else{banner.hidden=true;banner.innerHTML='';qr.hidden=false}renderSizeOptions();renderStrengthOptions();updateProductTotal()}
function renderSizeOptions(){const group=$('#sizeGroup');if(rewardMode||selectedProduct.sizes.length<=1){group.hidden=true;$('#sizeOptions').innerHTML='';return}group.hidden=false;$('#sizeOptions').innerHTML=selectedProduct.sizes.map((s,i)=>`<button class="product-choice ${i===selectedSize?'active':''}" data-size="${i}"><span class="choice-mark">${i===selectedSize?'✓':''}</span><span>${s[0]}</span><strong>${money(s[1]).replace(',00','')}</strong></button>`).join('');$$('[data-size]').forEach(b=>b.onclick=()=>{selectedSize=+b.dataset.size;renderSizeOptions();updateProductTotal()})}
function renderStrengthOptions(){const group=$('#strengthGroup'),values=selectedProduct.strengths||[];if(!values.length||rewardMode){group.hidden=true;$('#strengthOptions').innerHTML='';return}group.hidden=false;$('#strengthOptions').innerHTML=values.map(v=>`<button class="product-choice ${v===selectedStrength?'active':''}" data-strength="${v}"><span class="choice-mark">${v===selectedStrength?'✓':''}</span><span>${v}</span></button>`).join('');$$('[data-strength]').forEach(b=>b.onclick=()=>{selectedStrength=b.dataset.strength;renderStrengthOptions()})}
function updateProductTotal(){$('#productTotal').textContent=rewardMode?'0,00 KR':productMoney(selectedProduct.sizes[selectedSize][1]*qty)}
function addOrUpdateCart(){const size=selectedProduct.sizes[selectedSize],note=$('#productNote').value.trim(),strength=selectedProduct.strengths?.length?selectedStrength:'';if(rewardMode){const a=account();if(!a||a.stamps<10){rewardMode=false;showToast('Gratis pizza er ikke tilgjengelig');return}if(cart.some((x,i)=>x.freeReward&&i!==editingCartIndex)){showToast('Gratis pizza ligger allerede i handlekurven');return}const entry={key:`reward|${selectedProduct.id}|Stor|${note}`,productId:selectedProduct.id,name:selectedProduct.name,size:'Stor',strength:'',price:0,regularPrice:size[1],qty:1,note,freeReward:true};if(editingCartIndex>=0&&cart[editingCartIndex])cart[editingCartIndex]=entry;else cart.push(entry);editingCartIndex=-1;rewardMode=false;save(KEY.cart,cart);renderCartCount();renderCart();openView('cartScreen',{tabs:true});showToast(`Gratis pizza lagt i handlekurven – du sparer ${money(size[1])}`);return}const entry={key:`${selectedProduct.id}|${size[0]}|${strength}|${note}`,productId:selectedProduct.id,name:selectedProduct.name,size:size[0],strength,price:size[1],qty,note,loyaltyEligible:selectedProduct.loyaltyEligible===true||selectedProduct.sectionId==='pizza'};if(editingCartIndex>=0&&cart[editingCartIndex]){cart[editingCartIndex]=entry;editingCartIndex=-1;save(KEY.cart,cart);renderCartCount();renderCart();openView('cartScreen',{tabs:true});showToast('Handlekurv oppdatert');return}const old=cart.find(x=>x.key===entry.key);old?old.qty+=qty:cart.push(entry);save(KEY.cart,cart);renderCartCount();goMenu();showToast(`${selectedProduct.name} lagt i handlekurven`)}
function checkoutContactState(){const name=$('#checkoutName')?.value.trim()||'',phone=$('#checkoutPhone')?.value.replace(/\D/g,'')||'';return{name,phone,nameOk:name.length>=2,phoneOk:phone.length===8}}
function syncCheckoutValidation(){const s=checkoutContactState(),ready=s.nameOk&&s.phoneOk,nf=$('#checkoutNameField'),pf=$('#checkoutPhoneField'),card=$('#checkoutConfirmCard');nf?.classList.toggle('valid',s.nameOk);pf?.classList.toggle('valid',s.phoneOk);if(card)card.hidden=!ready;const badge=$('#checkoutStep3 .checkout-title>span');if(badge){badge.textContent=ready?'✓':'3';badge.classList.toggle('step-ok',ready)}if(checkoutStep===3){const next=$('#checkoutNext');if(next){next.disabled=!ready;next.classList.toggle('ready',ready);next.style.background=ready?'':'#d4cfcb';next.style.opacity=ready?'1':'.78';next.style.cursor=ready?'pointer':'not-allowed'}}}
function bindCheckoutValidation(){const n=$('#checkoutName'),p=$('#checkoutPhone');if(n&&!n.dataset.validationBound){n.dataset.validationBound='1';['input','change','blur'].forEach(ev=>n.addEventListener(ev,syncCheckoutValidation))}if(p&&!p.dataset.validationBound){p.dataset.validationBound='1';['input','change','blur'].forEach(ev=>p.addEventListener(ev,()=>{p.value=p.value.replace(/\D/g,'').slice(0,8);syncCheckoutValidation()}))}syncCheckoutValidation();requestAnimationFrame(syncCheckoutValidation);setTimeout(syncCheckoutValidation,120)}
function upsertCheckoutAccount(name,phone){const guest=load(KEY.guestFav,[]);let a=account();if(a&&session!==phone){const oldPhone=session,existing=accounts[phone];if(existing){existing.favorites=[...new Set([...(existing.favorites||[]),...(a.favorites||[])])];existing.stamps=Math.max(Number(existing.stamps)||0,Number(a.stamps)||0);existing.email=existing.email||a.email||'';existing.marketing=existing.marketing??a.marketing;delete accounts[oldPhone];a=existing}else{delete accounts[oldPhone];a={...a,phone};accounts[phone]=a}session=phone;save(KEY.session,session)}if(!a){a=ensureAccount(phone);session=phone;save(KEY.session,session)}a.name=name;a.phone=phone;a.favorites=[...new Set([...(a.favorites||[]),...guest])];save(KEY.guestFav,[]);saveAccounts();return a}
function renderCart(){const total=cart.reduce((s,x)=>s+x.price*x.qty,0),savings=cart.reduce((s,x)=>s+(x.freeReward?(Number(x.regularPrice)||0)*x.qty:0),0);$('#cartLines').innerHTML=cart.map((x,i)=>`<div class="cart-line ${x.freeReward?'reward-line':''}"><div class="cart-line-main"><span class="cart-qty-badge">${x.qty}x</span><div class="cart-line-copy"><strong>${escapeHtml(x.name)}</strong><small>Størrelse: <b>${escapeHtml(x.size)}</b>${x.strength?`<br>Styrke: <b>${escapeHtml(x.strength)}</b>`:''}${x.freeReward?`<br><span class="reward-cart-note">Gratis medlemsfordel · Du sparer ${money(x.regularPrice||0)}</span>`:''}${x.note?`<br>${escapeHtml(x.note)}`:''}</small></div></div><div class="cart-line-side"><b class="cart-line-price">${x.freeReward?`<span class="reward-old-price">${money(x.regularPrice||0)}</span><span class="reward-free-price">0,00 kr</span>`:money(x.price*x.qty)}</b><div class="cart-line-actions"><button class="cart-edit-btn" data-editcart="${i}" aria-label="Rediger" title="Rediger">✎</button><button class="cart-remove-btn" data-remove="${i}" aria-label="Fjern" title="Fjern">×</button></div></div></div>`).join('');$('#cartEmpty').hidden=cart.length>0;$('#cartTotal').textContent=money(total);$('#cartSavings').hidden=!savings;$('#cartSavings').textContent=savings?`Du sparer ${money(savings)} med medlemsfordelen`:'';$('#taxNote').textContent=`(inkl. mva ${money(total*15/115)})`;$$('[data-editcart]').forEach(b=>b.onclick=()=>openCartEdit(+b.dataset.editcart));$$('[data-remove]').forEach(b=>b.onclick=()=>{const removed=cart[+b.dataset.remove];cart.splice(+b.dataset.remove,1);save(KEY.cart,cart);renderCart();renderCartCount();showToast(`${removed?.name||'Produkt'} fjernet fra handlekurven`)});const a=account(),name=$('#checkoutName'),phone=$('#checkoutPhone');if(name&&document.activeElement!==name&&!name.value)name.value=a?.name||'';if(phone&&document.activeElement!==phone&&!phone.value)phone.value=a?.phone||'';if(phone)phone.disabled=false;$('#checkoutLoginHint').textContent=a?'Navn og telefon kan endres før bestillingen sendes.':'Fyll inn kontaktinformasjonen din.';bindCheckoutValidation();renderCheckoutStep()}
function pickupSlots(){const now=new Date(),open=new Date(now),close=new Date(now),start=new Date(now),clock=(value,fallback)=>{const m=String(value||fallback).match(/^(\d{1,2}):(\d{2})$/);return m?[Math.min(23,+m[1]),Math.min(59,+m[2])]:fallback.split(':').map(Number)},[oh,om]=clock(ACTIVE_SITE_SETTINGS.orderOpenTime,'14:00'),[ch,cm]=clock(ACTIVE_SITE_SETTINGS.orderCloseTime,'22:00');open.setHours(oh,om,0,0);close.setHours(ch,cm,0,0);start.setSeconds(0,0);const lead=Math.max(0,Number(ACTIVE_SITE_SETTINGS.minPreorderMinutes)||0);start.setMinutes(start.getMinutes()+lead);const rem=start.getMinutes()%15;if(rem)start.setMinutes(start.getMinutes()+(15-rem));else if(now.getSeconds()>0||now.getMilliseconds()>0)start.setMinutes(start.getMinutes()+15);if(start<open)start.setTime(open.getTime());const slots=[];for(let d=new Date(start);d<close;d.setMinutes(d.getMinutes()+15))slots.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);return slots}
function renderPickupTimes(){const slots=pickupSlots();if(pickupChoice!=='asap'&&!slots.includes(pickupChoice))pickupChoice='asap';$('#pickupOptions').innerHTML=`<label class="pickup-option"><input type="radio" name="pickup" value="asap" ${pickupChoice==='asap'?'checked':''}><span>Snarest mulig</span></label>`+slots.map(t=>`<label class="pickup-option"><input type="radio" name="pickup" value="${t}" ${pickupChoice===t?'checked':''}><span>${t}</span></label>`).join('');$$('input[name="pickup"]').forEach(r=>r.onchange=()=>{if(r.checked){pickupChoice=r.value;renderCheckoutStep()}})}
function renderCheckoutStep(){[1,2,3].forEach(n=>$('#checkoutStep'+n).hidden=n!==checkoutStep);$('#checkoutBack').hidden=checkoutStep===1;const step1=$('#checkoutStep1 .checkout-title>span'),step2=$('#checkoutStep2 .checkout-title>span');if(step1){step1.textContent=cart.length?'✓':'1';step1.classList.toggle('step-ok',!!cart.length)}if(step2){step2.textContent=pickupChoice?'✓':'2';step2.classList.toggle('step-ok',!!pickupChoice)}const next=$('#checkoutNext');next.textContent=checkoutStep===3?'Send bestilling':'Neste';const contact=checkoutContactState();next.disabled=(checkoutStep===1&&!cart.length)||(checkoutStep===3&&!(contact.nameOk&&contact.phoneOk));next.style.background=next.disabled?'#d4cfcb':'';next.style.opacity=next.disabled?'.78':'1';next.style.cursor=next.disabled?'not-allowed':'pointer';next.classList.toggle('ready',!next.disabled);if(checkoutStep===2)renderPickupTimes();if(checkoutStep===3)syncCheckoutValidation();const cartOpen=!$('#cartScreen').hidden,focused=cartOpen&&checkoutStep>1;document.body.classList.toggle('hide-tabs',focused);$('#cartScreen').style.top=focused?'var(--head)':'calc(var(--head) + var(--tabs))'}
function placeOrder(){if(!cart.length)return;const c=checkoutContactState(),name=c.name,phone=c.phone;if(!c.nameOk||!c.phoneOk){syncCheckoutValidation();showToast('Kontroller navn og telefonnummer');return}const total=cart.reduce((s,x)=>s+x.price*x.qty,0),id=Math.random().toString(36).slice(2,8).toUpperCase(),pickupTime=pickupChoice==='asap'?'Snarest mulig':pickupChoice,orderSavings=cart.reduce((s,x)=>s+(x.freeReward?(Number(x.regularPrice)||0)*x.qty:0),0);const adminPayload=buildAdminOrderPayload({id,name,phone,total,pickup:pickupChoice,lines:cart});window.dispatchEvent(new CustomEvent('kol:order-ready',{detail:adminPayload}));orders.unshift({id,createdAt:Date.now(),name,phone,total,pickupTime,savings:orderSavings,items:cart.map(x=>({...x})),status:'Sendt'});save(KEY.orders,orders);const a=upsertCheckoutAccount(name,phone);normalizeLoyalty(a);const locked=(a.stamps||0)>=10,freeUsed=cart.some(x=>x.freeReward),paidLarge=cart.filter(x=>!x.freeReward&&x.loyaltyEligible===true&&norm(x.size)==='stor').reduce((n,x)=>n+x.qty,0);if(locked){if(freeUsed)a.stamps=Math.min(10,paidLarge)}else if(paidLarge)a.stamps=Math.min(10,(a.stamps||0)+paidLarge);a.rewards=0;saveAccounts();cart=[];save(KEY.cart,cart);checkoutStep=1;pickupChoice='asap';goMenu();renderCartCount();renderHeader();renderMenu();renderTabs();showToast(`Bestilling ${id} sendt${orderSavings?` · du sparte ${money(orderSavings)}`:''}`)}
function stampsHtml(a){const count=Math.min(10,Math.max(0,Number(a.stamps)||0));return Array.from({length:10},(_,i)=>`<span class="stamp ${i<count?'on':''}"><b>${i+1}</b><i>🍕</i></span>`).join('')}
function pizzaProgress(a){normalizeLoyalty(a);const count=Math.min(10,Math.max(0,Number(a.stamps)||0)),ready=count>=10,rewardInCart=cart.some(x=>x.freeReward);let message='';if(ready)message='<strong>Neste Stor Pizza er gratis.</strong>';else if(count===9)message='Kjøp 1 Stor Pizza til – <strong>så er neste Stor Pizza gratis.</strong>';else{const left=10-count;message=`Kjøp ${left} Stor Pizza${left===1?'':'er'} til – så får du <strong>neste Stor Pizza gratis.</strong>`}return `<section class="pizza-loyalty-card"><div class="pizza-loyalty-top"><div><small>STOR PIZZA-KUPONGER</small><h3>${count} av 10</h3></div></div><div class="stamps">${stampsHtml(a)}</div><p>${message}</p>${ready?`<div class="reward-ready">🎁 Gratis Stor Pizza klar</div><button class="reward-claim-button" id="claimRewardBtn" ${rewardInCart?'disabled':''}>${rewardInCart?'Gratis pizza ligger i handlekurven':'Velg gratis Stor Pizza'}</button>`:''}<button class="coupon-qr-button" id="couponQrBtn">▦ Vis QR-kode</button></section>`}
function renderRewardPicker(){const a=account();if(!a||a.stamps<10){showToast('Du har ikke en gratis pizza klar');return}if(cart.some(x=>x.freeReward)){showToast('Gratis pizza ligger allerede i handlekurven');return}const pizzas=items().filter(p=>p.loyaltyEligible===true||p.sectionId==='pizza');$('#rewardPizzaList').innerHTML=pizzas.map(p=>{const stor=p.sizes.find(s=>norm(s[0])==='stor');if(!stor)return'';return `<button class="reward-pizza-card" data-reward-pizza="${p.id}"><span class="reward-pizza-image" style="background-image:url('${p.image||''}')"></span><span class="reward-pizza-copy"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.description||'')}</small><em>Stor · ${money(stor[1])} → Gratis</em></span><b>Velg</b></button>`}).join('');$$('[data-reward-pizza]').forEach(b=>b.onclick=()=>openProduct(b.dataset.rewardPizza,{reward:true}));openView('rewardScreen',{tabs:true});setActiveTab('pizza',true)}
function renderCouponQr(){const a=account();if(!a)return;$('#couponQrName').textContent=a.name||'KØL-medlem';$('#couponQrPhone').textContent=`+47 ${formatPhone(a.phone)}`;const box=$('#couponQrCode');box.innerHTML='';const url=`${location.origin}${location.pathname}?kasse=${encodeURIComponent(a.phone)}`;if(window.QRCode)new QRCode(box,{text:url,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});else box.textContent=url;openView('couponQrScreen',{tabs:true});$('#couponQrBack').onclick=()=>{openView('accountScreen',{tabs:true});renderProfileHome()}}
function renderKasseMode(phone){const p=String(phone||'').replace(/\D/g,'').slice(-8),a=accounts[p];openView('kasseScreen',{tabs:false});if(!a){$('#kasseContent').innerHTML=`<div class="kasse-empty"><strong>Kunden ble ikke funnet</strong><p>Denne demoen bruker LocalStorage. På en annen enhet finnes ikke kundedataene ennå.</p></div>`;return}normalizeLoyalty(a);const count=Math.min(10,Math.max(0,Number(a.stamps)||0));$('#kasseContent').innerHTML=`<div class="kasse-customer-card"><div class="kasse-customer-head"><div class="kasse-avatar">${escapeHtml((a.name||'K').charAt(0).toUpperCase())}</div><div><strong>${escapeHtml(a.name||'KØL-medlem')}</strong><small>+47 ${formatPhone(a.phone)}</small></div></div><div class="kasse-counter"><small>STOR PIZZA-KUPONGER</small><strong>${count} / 10</strong><div class="kasse-adjust"><button id="kasseMinus" ${count<=0?'disabled':''}>−</button><span>Juster manuelt</span><button id="kassePlus" ${count>=10?'disabled':''}>+</button></div><button class="kasse-reset" id="kasseReset">${count>=10?'Gratispizza brukt – nullstill':'Nullstill kuponger'}</button></div><div class="kasse-demo-note">Bruk + for telefonbestillinger av Stor Pizza. Verdien stopper på 10 til gratispizzaen er brukt.</div></div>`;$('#kasseMinus').onclick=()=>adjustKasseStamp(p,-1);$('#kassePlus').onclick=()=>adjustKasseStamp(p,1);$('#kasseReset').onclick=()=>resetKasseStamps(p)}function adjustKasseStamp(phone,delta){const a=accounts[phone];if(!a)return;normalizeLoyalty(a);const before=Math.min(10,Math.max(0,Number(a.stamps)||0));a.stamps=Math.max(0,Math.min(10,before+delta));saveAccounts();renderKasseMode(phone);showToast(delta>0?'1 kupong lagt til':'1 kupong fjernet')}function resetKasseStamps(phone){const a=accounts[phone];if(!a)return;a.stamps=0;a.rewards=0;saveAccounts();renderKasseMode(phone);showToast('Kupongkort nullstilt')}
function renderLogin(){$('#accountContent').innerHTML=`<div class="screen-title"><h2>Logg inn</h2><p>Telefonnummer og navn er nok.</p></div><div class="login-wrap"><label>Telefonnummer</label><div class="phone-field"><span>🇳🇴 +47</span><input id="loginPhone" inputmode="numeric" maxlength="8" placeholder="95 55 74 74"></div><label>Hele navn</label><input id="loginName" class="text-input" placeholder="Fatih Alemdar"><button class="primary full" id="loginContinue">Fortsett</button></div>`;$('#loginContinue').onclick=()=>{const p=$('#loginPhone').value.replace(/\D/g,''),name=$('#loginName').value.trim();if(p.length!==8||!name){alert('Skriv inn hele navnet og et 8-sifret telefonnummer.');return}const a=ensureAccount(p);a.name=name;saveAccounts();setSession(p);renderProfileHome();showToast('Innlogget')}}
function renderProfileHome(){const a=account();if(!a){renderLogin();return}const count=orders.filter(o=>o.phone===a.phone).length;$('#accountContent').innerHTML=`<div class="profile-home"><div class="profile-greeting"><div class="member-avatar">${escapeHtml((a.name||'K').charAt(0).toUpperCase())}</div><div><small>KØL MEDLEM</small><h2>${escapeHtml(a.name||'KØL-medlem')}</h2><p>+47 ${formatPhone(a.phone)}</p></div></div>${pizzaProgress(a)}<div class="profile-actions"><button data-account="orders"><strong>Bestillinger</strong><small>${count} lagret</small><b>›</b></button><button data-account="contact"><strong>Kontaktinfo</strong><small>Navn, telefon og e-post</small><b>›</b></button></div><button class="logout-link" id="logoutBtn">Logg ut</button></div>`;$$('[data-account]').forEach(b=>b.onclick=()=>b.dataset.account==='orders'?renderOrders():renderContact());const claim=$('#claimRewardBtn');if(claim&&!claim.disabled)claim.onclick=renderRewardPicker;const qr=$('#couponQrBtn');if(qr)qr.onclick=renderCouponQr;$('#logoutBtn').onclick=()=>{setSession(null);renderLogin();showToast('Logget ut')}}
function renderOrders(){const a=account(),list=orders.filter(o=>o.phone===a.phone);$('#accountContent').innerHTML=`<div class="subhead"><button id="accountBack">‹ Profil</button><h2>Bestillinger</h2></div><div class="profile-body">${list.length?list.map(o=>`<div class="order-card"><div><strong>Ordre ${o.id}</strong><b>${money(o.total)}</b></div><small>${new Date(o.createdAt).toLocaleString('nb-NO')} · ${escapeHtml(o.pickupTime||'Snarest mulig')}</small><p>${o.items.map(x=>`${x.qty}x ${escapeHtml(x.name)} (${escapeHtml(x.size)})${x.freeReward?' – GRATIS':''}`).join('<br>')}</p>${o.savings?`<small style="color:#18714e;font-weight:700">Du sparte ${money(o.savings)}</small>`:''}</div>`).join(''):'<div class="empty-note">Ingen bestillinger ennå.</div>'}</div>`;$('#accountBack').onclick=renderProfileHome}
function renderContact(){const a=account();$('#accountContent').innerHTML=`<div class="subhead"><button id="accountBack">‹ Profil</button><h2>Kontaktinfo</h2></div><div class="profile-form modern-profile-form"><label class="profile-field" id="pfNameField">Hele navn<span class="field-control"><input id="pfName" class="text-input" value="${escapeHtml(a.name||'')}"><i class="field-check">✓</i></span></label><label class="profile-field" id="pfPhoneField">Telefonnummer<span class="field-control"><input id="pfPhone" class="text-input" inputmode="numeric" maxlength="8" value="${escapeHtml(a.phone||'')}"><i class="field-check">✓</i></span></label><label class="profile-field optional-field">E-post <small>(valgfritt)</small><span class="field-control"><input id="pfEmail" class="text-input" value="${escapeHtml(a.email||'')}"></span></label><label class="check-row"><input id="pfMarketing" type="checkbox" ${a.marketing?'checked':''}> Jeg ønsker tilbud fra KØL</label><button class="primary full" id="saveProfile">Lagre endringer</button></div>`;const validate=()=>{const name=$('#pfName').value.trim(),phone=$('#pfPhone').value.replace(/\D/g,'');$('#pfNameField').classList.toggle('valid',name.length>=2);$('#pfPhoneField').classList.toggle('valid',phone.length===8);return{name,phone,ok:name.length>=2&&phone.length===8}};$('#pfName').oninput=validate;$('#pfPhone').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);validate()};validate();$('#accountBack').onclick=renderProfileHome;$('#saveProfile').onclick=()=>{const v=validate();if(!v.ok){showToast('Kontroller navn og telefonnummer');return}const email=$('#pfEmail').value.trim(),marketing=$('#pfMarketing').checked,newA=upsertCheckoutAccount(v.name,v.phone);newA.email=email;newA.marketing=marketing;saveAccounts();renderHeader();renderProfileHome();showToast('Kontaktinfo oppdatert')}}
function setInfoTab(tab){$$('[data-info-tab]').forEach(b=>b.classList.toggle('active',b.dataset.infoTab===tab));$$('[data-info-panel]').forEach(p=>p.classList.toggle('active',p.dataset.infoPanel===tab))}function renderAllergens(){const q=norm(allergenSearch),visible=ALLERGENS.filter(a=>!q||norm(`${a[0]} ${a[2]}`).includes(q));$('#allergenGrid').innerHTML=visible.length?visible.map(a=>`<button class="allergen-choice ${draftAllergens.has(a[0])?'active':''}" data-allergen="${a[0]}"><span>${a[1]}</span>${a[2]}</button>`).join(''):'<div class="allergen-empty">Ingen allergener funnet.</div>';$$('[data-allergen]').forEach(b=>b.onclick=()=>{const id=b.dataset.allergen,label=allergenLabel(id),was=draftAllergens.has(id);was?draftAllergens.delete(id):draftAllergens.add(id);renderAllergens();showToast(was?`${label} fjernet`:`${label} valgt`)})}function openAllergens(){rewardMode=false;draftAllergens=new Set(selectedAllergens);allergenSearch='';$('#allergenSearch').value='';renderAllergens();openView('allergenScreen',{tabs:true})}function renderAll(){renderHeader();renderTabs();renderMenu();renderCartCount();$('#allergenCount').textContent=selectedAllergens.size||''}
$('#brandBtn').onclick=goMenu;$('#infoBtn').onclick=()=>{rewardMode=false;openView('infoScreen',{tabs:true});setInfoTab('about')};$('#profileBtn').onclick=()=>{rewardMode=false;openView('accountScreen',{tabs:true});account()?renderProfileHome():renderLogin()};$('#cartBtn').onclick=()=>{rewardMode=false;checkoutStep=1;renderCart();openView('cartScreen',{tabs:true});renderCheckoutStep()};$('#allergenBtn').onclick=openAllergens;$('#infoAllergenBtn').onclick=openAllergens;$('#storeMapBtn').onclick=()=>{const query=[ACTIVE_SITE_SETTINGS.streetAddress,ACTIVE_SITE_SETTINGS.postalCode,ACTIVE_SITE_SETTINGS.city].filter(Boolean).join(', ');window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,'_blank','noopener')};$$('[data-info-tab]').forEach(b=>b.onclick=()=>setInfoTab(b.dataset.infoTab));$('#qtyMinus').onclick=()=>{qty=Math.max(1,qty-1);$('#qtyValue').textContent=qty;updateProductTotal()};$('#qtyPlus').onclick=()=>{qty++;$('#qtyValue').textContent=qty;updateProductTotal()};$('#addToCart').onclick=addOrUpdateCart;$('#checkoutBack').onclick=()=>{checkoutStep=Math.max(1,checkoutStep-1);renderCheckoutStep()};$('#checkoutNext').onclick=()=>{if(checkoutStep===1&&!cart.length)return;if(checkoutStep<3){checkoutStep++;renderCheckoutStep()}else placeOrder()};$('#allergenSearch').oninput=e=>{allergenSearch=e.target.value;renderAllergens()};$('#allergenReset').onclick=()=>{draftAllergens.clear();selectedAllergens.clear();save(KEY.allergens,[]);allergenSearch='';$('#allergenSearch').value='';renderAllergens();renderAll();showToast('Allergener nullstilt')};$('#allergenSave').onclick=()=>{selectedAllergens=new Set(draftAllergens);save(KEY.allergens,[...selectedAllergens]);renderAll();goMenu();showToast('Allergener lagret')};$('#menuShell').addEventListener('scroll',scheduleSync,{passive:true});applySiteSettings(ACTIVE_SITE_SETTINGS);renderAll();scheduleSync();const kassePhone=new URLSearchParams(location.search).get('kasse');if(kassePhone)requestAnimationFrame(()=>renderKasseMode(kassePhone));

/* Two-step checkout and mobile keyboard UX */
(() => {
  const infoTitle = document.querySelector('#infoScreen .info-title');
  if (infoTitle) infoTitle.remove();

  const step1 = document.querySelector('#checkoutStep1');
  const step2 = document.querySelector('#checkoutStep2');
  const step3 = document.querySelector('#checkoutStep3');
  const pickupOptions = document.querySelector('#pickupOptions');
  const contactGrid = step3?.querySelector('.checkout-grid');
  const loginHint = document.querySelector('#checkoutLoginHint');
  if (!step1 || !step2 || !step3 || !pickupOptions || !contactGrid) return;

  let pickupMode = '';
  pickupChoice = '';

  const title = step2.querySelector('.checkout-title');
  const titleStrong = title?.querySelector('strong');
  const titleSmall = title?.querySelector('small');
  if (titleStrong) titleStrong.textContent = 'Fullfør bestilling';
  if (titleSmall) titleSmall.textContent = 'Fyll inn kontaktinfo først, og velg deretter hentetid.';

  const contactSection = document.createElement('section');
  contactSection.className = 'final-checkout-section';
  contactSection.id = 'finalContactSection';
  const contactHead = document.createElement('div');
  contactHead.className = 'final-section-head';
  contactHead.innerHTML = '<span>1</span><div><strong>Navn og telefon</strong><small>Vi bruker dette bare for bestillingen din.</small></div>';
  if (loginHint) loginHint.hidden = true;
  contactSection.appendChild(contactHead);
  contactSection.appendChild(contactGrid);

  const pickupSection = document.createElement('section');
  pickupSection.className = 'final-checkout-section';
  pickupSection.id = 'finalPickupSection';
  pickupSection.innerHTML = '<div class="final-section-head"><span>2</span><div><strong>Velg hentetid</strong><small>Velg alltid Snarest mulig eller et bestemt tidspunkt.</small></div></div>';
  pickupSection.appendChild(pickupOptions);

  step2.appendChild(contactSection);
  step2.appendChild(pickupSection);
  step3.hidden = true;

  const nameInput = document.querySelector('#checkoutName');
  const phoneInput = document.querySelector('#checkoutPhone');
  if (nameInput) {
    nameInput.type = 'text';
    nameInput.autocomplete = 'name';
    nameInput.setAttribute('autocapitalize', 'words');
    nameInput.setAttribute('enterkeyhint', 'next');
  }
  if (phoneInput) {
    phoneInput.type = 'tel';
    phoneInput.autocomplete = 'tel-national';
    phoneInput.setAttribute('inputmode', 'tel');
    phoneInput.setAttribute('enterkeyhint', 'done');
    phoneInput.maxLength = 8;
  }

  const keyboardHint = document.createElement('small');
  keyboardHint.className = 'keyboard-hint';
  keyboardHint.textContent = 'Trykk Ferdig på tastaturet eller trykk utenfor feltet.';
  contactGrid.insertBefore(keyboardHint, document.querySelector('#checkoutConfirmCard'));

  const pickupReady = () =>
    pickupChoice === 'asap' ||
    /^\d{2}:\d{2}$/.test(String(pickupChoice || ''));

  function syncPickupUi() {
    const ready = pickupReady();
    pickupSection.classList.toggle('is-complete', ready);
    pickupSection.classList.toggle('needs-choice', !ready);
  }

  renderPickupTimes = function () {
    const slots = pickupSlots();

    if (/^\d{2}:\d{2}$/.test(String(pickupChoice || '')) && !slots.includes(pickupChoice)) {
      pickupChoice = '';
      pickupMode = '';
    }
    if (pickupChoice === 'asap') pickupMode = 'asap';
    else if (/^\d{2}:\d{2}$/.test(String(pickupChoice || ''))) pickupMode = 'scheduled';

    pickupOptions.innerHTML = `
      <div class="pickup-mode-row">
        <button type="button" class="pickup-mode-btn ${pickupMode === 'asap' ? 'active' : ''}" data-pickup-mode="asap">
          <span class="pickup-mode-check">${pickupMode === 'asap' ? '✓' : ''}</span>
          <span><strong>Snarest mulig</strong><small>Hent så snart maten er klar</small></span>
        </button>
        <button type="button" class="pickup-mode-btn ${pickupMode === 'scheduled' ? 'active' : ''}" data-pickup-mode="scheduled">
          <span class="pickup-mode-check">${pickupMode === 'scheduled' ? '✓' : ''}</span>
          <span><strong>Velg hentetid</strong><small>Velg et tidspunkt</small></span>
        </button>
      </div>
      <div class="pickup-time-grid" ${pickupMode === 'scheduled' ? '' : 'hidden'}>
        ${slots.map(t => `<button type="button" class="pickup-time-btn ${pickupChoice === t ? 'active' : ''}" data-pickup-time="${t}">${t}</button>`).join('')}
      </div>`;

    pickupOptions.querySelectorAll('[data-pickup-mode]').forEach(btn => {
      btn.onclick = () => {
        pickupMode = btn.dataset.pickupMode;
        pickupChoice = pickupMode === 'asap' ? 'asap' : '';
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    pickupOptions.querySelectorAll('[data-pickup-time]').forEach(btn => {
      btn.onclick = () => {
        pickupMode = 'scheduled';
        pickupChoice = btn.dataset.pickupTime;
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    syncPickupUi();
  };

  syncCheckoutValidation = function () {
    const s = checkoutContactState();
    const contactReady = s.nameOk && s.phoneOk;
    const timeReady = pickupReady();
    const nf = document.querySelector('#checkoutNameField');
    const pf = document.querySelector('#checkoutPhoneField');
    const card = document.querySelector('#checkoutConfirmCard');

    nf?.classList.toggle('valid', s.nameOk);
    pf?.classList.toggle('valid', s.phoneOk);

    if (card) {
      card.hidden = !contactReady;
      if (contactReady) card.querySelector('small').textContent = 'Kontaktinfo er ferdig. Velg hentetid nedenfor.';
    }

    contactSection.classList.toggle('is-complete', contactReady);
    syncPickupUi();

    const badge = step2.querySelector('.checkout-title > span');
    if (badge) {
      const complete = contactReady && timeReady;
      badge.textContent = complete ? '✓' : '2';
      badge.classList.toggle('step-ok', complete);
    }

    if (checkoutStep === 2) {
      const next = document.querySelector('#checkoutNext');
      if (next) {
        const canPromptTime = contactReady && !timeReady;
        const canSend = contactReady && timeReady;
        next.disabled = !contactReady;
        next.classList.toggle('ready', canSend);
        next.classList.toggle('needs-time', canPromptTime);
        next.classList.remove('store-closed');
        next.style.background = '';
        next.style.opacity = '1';
        next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
      }
    }
  };

  bindCheckoutValidation = function () {
    const n = document.querySelector('#checkoutName');
    const p = document.querySelector('#checkoutPhone');
    const bringIntoView = input =>
      setTimeout(() => input?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);

    if (n && !n.dataset.twoStepValidationBound) {
      n.dataset.twoStepValidationBound = '1';
      ['input', 'change', 'blur'].forEach(ev => n.addEventListener(ev, syncCheckoutValidation));
      n.addEventListener('focus', () => bringIntoView(n));
      n.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p?.focus();
        }
      });
    }

    if (p && !p.dataset.twoStepValidationBound) {
      p.dataset.twoStepValidationBound = '1';
      ['input', 'change', 'blur'].forEach(ev =>
        p.addEventListener(ev, () => {
          p.value = p.value.replace(/\D/g, '').slice(0, 8);
          renderPickupTimes();
          syncCheckoutValidation();
        })
      );
      p.addEventListener('focus', () => bringIntoView(p));
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p.blur();
          if (checkoutContactState().nameOk && checkoutContactState().phoneOk && !pickupReady()) {
            setTimeout(() => pickupSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
          }
        }
      });
    }

    if (!document.documentElement.dataset.checkoutKeyboardBound) {
      document.documentElement.dataset.checkoutKeyboardBound = '1';
      document.addEventListener(
        'pointerdown',
        e => {
          const active = document.activeElement;
          if (!active || !['checkoutName', 'checkoutPhone'].includes(active.id)) return;
          if (e.target === active || e.target.closest('input, textarea')) return;
          active.blur();
        },
        { capture: true }
      );
    }

    syncCheckoutValidation();
    requestAnimationFrame(syncCheckoutValidation);
    setTimeout(syncCheckoutValidation, 120);
  };

  renderCheckoutStep = function () {
    step1.hidden = checkoutStep !== 1;
    step2.hidden = checkoutStep !== 2;
    step3.hidden = true;

    const back = document.querySelector('#checkoutBack');
    if (back) back.hidden = checkoutStep === 1;

    const step1Badge = step1.querySelector('.checkout-title > span');
    const step2Badge = step2.querySelector('.checkout-title > span');
    const contact = checkoutContactState();
    const complete = contact.nameOk && contact.phoneOk && pickupReady();

    if (step1Badge) {
      step1Badge.textContent = cart.length ? '✓' : '1';
      step1Badge.classList.toggle('step-ok', !!cart.length);
    }

    if (step2Badge) {
      step2Badge.textContent = complete ? '✓' : '2';
      step2Badge.classList.toggle('step-ok', complete);
    }

    const next = document.querySelector('#checkoutNext');
    if (next) {
      next.textContent = checkoutStep === 2 ? 'Send bestilling' : 'Neste';

      if (checkoutStep === 1) {
        const canContinue = !!cart.length;
        next.disabled = !canContinue;
        next.classList.toggle('ready', canContinue);
        next.classList.remove('needs-time', 'store-closed');
      } else {
        const contactReady = contact.nameOk && contact.phoneOk;
        next.disabled = !contactReady;
        next.classList.toggle('ready', complete);
        next.classList.toggle('needs-time', contactReady && !pickupReady());
        next.classList.remove('store-closed');
      }

      next.style.background = '';
      next.style.opacity = '1';
      next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
    }

    if (checkoutStep === 2) {
      renderPickupTimes();
      syncCheckoutValidation();
    }

    const cartOpen = !document.querySelector('#cartScreen').hidden;
    const focused = cartOpen && checkoutStep === 2;
    document.body.classList.toggle('hide-tabs', focused);
    document.querySelector('#cartScreen').style.top = focused
      ? 'var(--head)'
      : 'calc(var(--head) + var(--tabs))';
  };

  const originalPlaceOrder = placeOrder;
  placeOrder = function () {
    originalPlaceOrder();
    if (!cart.length) {
      pickupChoice = '';
      pickupMode = '';
    }
  };

  const back = document.querySelector('#checkoutBack');
  const next = document.querySelector('#checkoutNext');

  if (back) {
    back.onclick = () => {
      document.activeElement?.blur?.();
      checkoutStep = 1;
      renderCheckoutStep();
    };
  }

  if (next) {
    next.onclick = () => {
      if (checkoutStep === 1 && !cart.length) return;

      if (checkoutStep === 1) {
        checkoutStep = 2;
        renderCheckoutStep();

        const c = checkoutContactState();
        if (!c.nameOk) document.querySelector('#checkoutName')?.focus();
        else if (!c.phoneOk) document.querySelector('#checkoutPhone')?.focus();
        return;
      }

      const c = checkoutContactState();
      if (!c.nameOk || !c.phoneOk) {
        syncCheckoutValidation();
        return;
      }

      if (!pickupReady()) {
        document.activeElement?.blur?.();
        pickupSection.classList.add('attention');
        pickupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Velg hentetid før du sender bestillingen');
        setTimeout(() => pickupSection.classList.remove('attention'), 1400);
        return;
      }

      document.activeElement?.blur?.();
      placeOrder();
    };
  }

  bindCheckoutValidation();
  renderCheckoutStep();
})();
