import {
 config,catalog,state,loadCatalog,menuStatus,catalogReady,persist,money,findProduct,
 basePrice,selectedSize,applicableGroups,unitPrice,linePrice,cartTotal,cartQuantity,
 addLine,changeQuantity,clearCart,setProfile,toggleFavorite,escapeHtml,openState,
 pickupSlots,sendOrder
} from './store.js';

const $=id=>document.getElementById(id);
const main=$('mainContent'),bar=$('bottomBar'),cats=$('categoryScroller'),sheet=$('sheet'),backdrop=$('backdrop'),categoryIndicator=$('categoryIndicator');
const e=escapeHtml;
const vs={page:'menu',step:1,search:false,query:'',pickupMode:'',pickupTime:'',expanded:false,showPopular:true,submitting:false};
let draft=null,editLineId=null,ingredientsExpanded=false,noticeTimer=null;
const prettyDay=()=>new Intl.DateTimeFormat(config.locale,{weekday:'long',day:'numeric',month:'long'}).format(new Date());
const btn=(label,action,primary=false,disabled=false,extra='')=>'<button class="button '+(primary?'primary':'ghost')+' '+extra+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';

function toast(message){
 const n=$('notice');n.textContent=message;n.hidden=false;clearTimeout(noticeTimer);
 noticeTimer=setTimeout(()=>n.hidden=true,3200);
}
function photo(product,cls='product-photo'){
 if(!product.image)return '<span class="product-placeholder" aria-hidden="true">🍽️</span>';
 return '<img src="'+e(product.image)+'" alt="'+e(product.name)+'" class="'+cls+'" loading="lazy">';
}
function header(){
 const r=config.restaurant;
 $('brandLogo').innerHTML=r.logoUrl?'<img src="'+e(r.logoUrl)+'" alt="" style="width:100%;height:100%;object-fit:contain">':e(r.logo||'🍕');
 $('brandButton').textContent=r.name;
 document.title=r.name+' — Bestill takeaway';
 $('cartBadge').textContent=cartQuantity();
 $('cartBadge').hidden=cartQuantity()===0;
 $('backButton').hidden=vs.page==='menu';
 $('categorySection').hidden=vs.page!=='menu';
 const palette=['reference','lively','fresh','gourmet'].includes(r.palette)?r.palette:'reference';
 document.body.classList.remove('theme-reference','theme-lively','theme-fresh','theme-gourmet');
 document.body.classList.add('theme-'+palette);
 document.body.classList.toggle('dark',state.theme==='dark');
}
function scrollMainTop(){main.scrollTop=0;}
function setPage(page){
 if(!sheet.hidden)closeSheet();
 vs.page=page;
 if(page==='cart'&&vs.step<1)vs.step=1;
 render();
 scrollMainTop();
}
function updateCategoryIndicator(){
 if(!categoryIndicator)return;
 const thumb=categoryIndicator.querySelector('span');if(!thumb)return;
 const total=Math.max(1,cats.scrollWidth),view=Math.max(0,cats.clientWidth);
 const maxScroll=Math.max(0,cats.scrollWidth-cats.clientWidth);
 const width=Math.min(100,Math.max(8,(view/total)*100));
 const left=maxScroll>0?(Math.min(maxScroll,Math.max(0,cats.scrollLeft))/total)*100:0;
 thumb.style.width=width+'%';
 thumb.style.left=left+'%';
 categoryIndicator.setAttribute('aria-valuemin','0');
 categoryIndicator.setAttribute('aria-valuemax',String(Math.round(maxScroll)));
 categoryIndicator.setAttribute('aria-valuenow',String(Math.round(cats.scrollLeft)));
 categoryIndicator.style.visibility=maxScroll>1?'visible':'hidden';
}
function categories(){
 const previousScroll=cats.scrollLeft;
 const blocks=[{id:'search',name:'Søk',icon:'⌕'},{id:'popular',name:'Mest bestilt',icon:'☆'}]
  .concat(catalog.categories.map(c=>({id:c.id,name:c.name,icon:c.icon})));
 cats.innerHTML=blocks.map(c=>'<button type="button" class="category-button" data-action="category" data-id="'+e(c.id)+'"><span class="cat-icon">'+e(c.icon)+'</span><span class="cat-name">'+e(c.name)+'</span></button>').join('');
 cats.scrollLeft=previousScroll;
 lastActiveCategory='';
 requestAnimationFrame(updateCategoryIndicator);
}
let lastActiveCategory='';
function activateCategory(id,center=true){
 if(!id)return;
 const buttons=Array.from(cats.querySelectorAll('.category-button'));
 const active=buttons.find(button=>button.dataset.id===id);
 buttons.forEach(button=>button.classList.toggle('active',button===active));
 if(active&&center){
  const left=active.offsetLeft-(cats.clientWidth-active.offsetWidth)/2;
  const max=Math.max(0,cats.scrollWidth-cats.clientWidth);
  const target=Math.min(max,Math.max(0,left));
  cats.scrollTo({left:target,behavior:'smooth'});
 }
 lastActiveCategory=id;
}
function menuCard(p){
 const allergen=state.allergens&&p.allergens?.length?'<p class="product-allergens">Inneholder '+e(p.allergens.join(', '))+'</p>':'';
 const inCart=state.cart.filter(line=>line.productId===p.id).reduce((n,l)=>n+l.quantity,0);
 return '<article class="product-card" data-action="product" data-id="'+e(p.id)+'" tabindex="0" role="button" aria-label="Velg '+e(p.name)+'">'+
  photo(p)+'<div class="product-info"><div class="product-title">'+e(p.name)+(inCart?' <span class="status-pill">✓ '+inCart+' i kurven</span>':'')+'</div>'+
  '<div class="product-description">'+e(p.description)+'</div>'+allergen+'</div>'+
  '<div class="product-action">'+
  '<button class="plus-btn" data-action="product" data-id="'+e(p.id)+'" '+(p.soldOut?'disabled':'')+' aria-label="Velg '+e(p.name)+'">'+(p.soldOut?'×':'+')+'</button>'+
  '<span class="price">'+(p.sizes.length>1?'<span class="tiny">fra </span>':'')+money(basePrice(p))+'</span></div></article>';
}
function sectionBlock(id,title,note,items){
 if(!items.length)return '';
 return '<section id="cat-'+e(id)+'"><div class="section-heading"><h2>'+e(title)+'</h2>'+(note?'<p class="small">'+e(note)+'</p>':'')+'</div>'+items.map(menuCard).join('')+'</section>';
}
function menuMarkup(){
 const status=openState(),r=config.restaurant;
 let html='<div class="status-card"><div class="status-main"><span class="status-dot '+(!status.open?'closed':'')+'"></span><div><strong>'+(!status.open?'Stengt nå':'Åpent nå')+'</strong><p class="small">Kun henting · '+(status.open?'stenger '+e(status.closesAt):'åpner '+e(status.opensAt))+'</p></div></div>'+
  '<button type="button" class="status-details" data-action="restaurant-info" aria-label="Restaurantinformasjon" title="Restaurantinformasjon">i</button>'+ 
  '<label class="toggle-inline">Vis allergener <input data-toggle="allergens" type="checkbox" '+(state.allergens?'checked':'')+' aria-label="Vis allergener"></label></div>';
 if(config.mode==='preview')html+='<div class="preview-banner">BETA forhåndsvisning · Menyen hentes fra Firebase. Bestillinger sendes ikke til restauranten.</div>';
 if(vs.search){
  html+='<label class="search-box"><span style="font-size:24px">⌕</span><input id="menuSearch" type="search" placeholder="Søk pizza, kebab, burger…" value="'+e(vs.query)+'" autocomplete="off"><button class="round-close" data-action="close-search" type="button" style="width:30px;height:30px">×</button></label>';
  const q=vs.query.toLocaleLowerCase('nb-NO').trim();
  const results=catalog.categories.flatMap(c=>c.products.filter(p=>(p.name+' '+p.description+' '+c.name).toLocaleLowerCase('nb-NO').includes(q)));
  return html+(results.length?results.map(menuCard).join(''):'<div class="no-results">Ingen produkter funnet.</div>');
 }
 const popular=catalog.popularIds.map(id=>findProduct(id)?.p).filter(Boolean);
 if(popular.length)html+=sectionBlock('popular','Mest bestilt','Gjestenes favoritter',popular.slice(0,vs.showPopular?99:4));
 for(const c of catalog.categories)html+=sectionBlock(c.id,c.name,c.description,c.products);
 return html;
}
function sheetHeader(title,favorite=false){
 return '<div class="sheet-head"><button type="button" class="round-close" data-action="close-sheet" aria-label="Lukk">×</button><h2>'+e(title)+'</h2>'+
  (favorite?'<button type="button" class="round-close" data-action="favorite" aria-label="Favoritt">'+(state.favorites.includes(draft?.productId)?'♥':'♡')+'</button>':'<span style="width:42px"></span>')+'</div>';
}
function showSheet(html){const firstOpen=sheet.hidden;sheet.innerHTML=html;backdrop.hidden=false;sheet.hidden=false;if(firstOpen){const scroll=sheet.querySelector('.sheet-scroll');if(scroll)scroll.scrollTop=0;}}
function closeSheet(){sheet.hidden=true;backdrop.hidden=true;sheet.innerHTML='';draft=null;editLineId=null;}
function newDraft(p){
 const size=selectedSize(p,p.defaultSizeId),options={};
 for(const g of applicableGroups(p,size.id)){
  options[g.id]=(g.defaultOptionIds||[]).filter(id=>g.options.some(x=>x.id===id));
 }
 return {productId:p.id,sizeId:size.id,quantity:1,options,removedIngredients:[],comment:''};
}
function sheetPrice(){return draft?money(unitPrice(draft)*draft.quantity):money(0);}
function openProduct(id,editId=null){
 const found=findProduct(id);if(!found||found.p.soldOut)return;
 const p=found.p;editLineId=editId;
 const old=editId?state.cart.find(l=>l.id===editId):null;
 draft=old?JSON.parse(JSON.stringify(old)):newDraft(p);
 ingredientsExpanded=false;renderProductSheet();
}
function renderProductSheet(){
 if(!draft)return;const found=findProduct(draft.productId);if(!found)return;
 const p=found.p,oldScroll=sheet.querySelector('.sheet-scroll')?.scrollTop||0;
 const removable=(p.ingredientRules||[]).filter(x=>x.removable).map(x=>x.name);
 let body=sheetHeader(p.name,true)+photo(p,'sheet-photo')+
  '<div class="sheet-scroll"><div class="muted">'+e(p.description)+'</div>';
 if(config.restaurant.ingredientCustomizationEnabled&&removable.length){
  body+='<button class="ingredient-box" data-action="ingredients" type="button"><span><strong>⚙ &nbsp; Tilpass ingredienser</strong><span class="small block">'+(draft.removedIngredients.length?e(draft.removedIngredients.join(', '))+' fjernet':'Ingen endringer')+'</span></span><span>›</span></button>';
  if(ingredientsExpanded){
   body+='<div class="ingredient-panel">'+removable.map(name=>'<button class="ingredient-chip '+(draft.removedIngredients.includes(name)?'off':'')+'" data-action="remove-ingredient" data-value="'+e(name)+'" type="button">'+(draft.removedIngredients.includes(name)?'＋ ':'✓ ')+e(name)+'</button>').join('')+'</div>';
  }
 }
 body+='<section class="option-group"><div class="option-heading">Størrelse <span class="option-hint">Påkrevd</span></div>';
 body+=p.sizes.map(s=>'<label class="option-label '+(draft.sizeId===s.id?'selected':'')+'"><input type="radio" name="size" data-field="size" value="'+e(s.id)+'" '+(draft.sizeId===s.id?'checked':'')+'><span class="grow">'+e(s.name)+'</span><span class="small">'+money(s.price)+'</span></label>').join('');
 body+='</section>';
 for(const g of applicableGroups(p,draft.sizeId)){
  const values=draft.options[g.id]||[];
  body+='<section class="option-group"><div class="option-heading">'+e(g.title)+'<span class="option-hint">'+(g.required?'Påkrevd':'Valgfritt')+'</span></div>'+
   g.options.map(o=>'<label class="option-label '+(values.includes(o.id)?'selected':'')+'"><input type="'+(g.multiple?'checkbox':'radio')+'" name="group-'+e(g.id)+'" data-field="option" data-group="'+e(g.id)+'" value="'+e(o.id)+'" '+(values.includes(o.id)?'checked':'')+'><span class="grow">'+e(o.label)+'</span><span class="small">'+(o.price?'+':'')+money(o.price)+'</span></label>').join('')+'</section>';
 }
 body+='<section class="option-group"><div class="option-heading">Kommentar <span class="option-hint">Valgfritt</span></div>'+
  '<textarea id="productComment" class="input-field" maxlength="300" placeholder="Spesielle ønsker…">'+e(draft.comment||'')+'</textarea></section></div>';
 body+='<div class="sheet-footer"><div class="qty-control"><button data-action="draft-minus" aria-label="Mindre">−</button><strong>'+draft.quantity+'</strong><button data-action="draft-plus" aria-label="Mer">+</button></div>'+
  '<button class="button primary" data-action="add-product"><span>'+(editLineId?'Oppdater':'Legg til')+'</span><strong>'+sheetPrice()+'</strong></button></div>';
 showSheet(body);const scroll=sheet.querySelector('.sheet-scroll');if(scroll)scroll.scrollTop=oldScroll;
}
function optionUpdate(groupId,optionId,checked){
 const found=findProduct(draft.productId);const g=applicableGroups(found.p,draft.sizeId).find(x=>x.id===groupId);
 if(!g)return;
 let arr=draft.options[groupId]||[];
 if(g.multiple){
  if(checked&&!arr.includes(optionId)&&arr.length>=g.max){toast('Maks '+g.max+' valg.');return;}
  arr=checked?[...new Set([...arr,optionId])]:arr.filter(id=>id!==optionId);
 }else arr=checked?[optionId]:[];
 draft.options[groupId]=arr;renderProductSheet();
}
function addSelectedProduct(){
 const f=findProduct(draft.productId);if(!f)return;
 for(const g of applicableGroups(f.p,draft.sizeId)){
  const n=(draft.options[g.id]||[]).length;
  if(n<g.min){toast('Velg '+g.title.toLowerCase()+' før du fortsetter.');return;}
 }
 draft.comment=$('productComment')?.value||draft.comment||'';
 addLine(draft,editLineId);closeSheet();render();toast('Lagt i handlekurven.');
}
function steps(){
 return '<div class="steps">'+['Kurv','Kontakt','Hentetid'].map((name,i)=>'<div class="step '+(i+1<vs.step?'done':i+1===vs.step?'active':'')+'"><span class="step-num">'+(i+1)+'</span>'+name+'</div>').join('')+'</div>';
}
function cartCard(line){
 const f=findProduct(line.productId);if(!f)return '';
 const p=f.p,size=selectedSize(p,line.sizeId);
 const extras=[];
 for(const g of applicableGroups(p,line.sizeId)){
  for(const id of line.options?.[g.id]||[]){
   const o=g.options.find(x=>x.id===id);if(o)extras.push('<div class="cart-line"><strong>'+e(o.label)+'</strong><span>'+ (o.price?money(o.price):'inkludert')+'</span></div>');
  }
 }
 if(line.removedIngredients?.length)extras.push('<div class="cart-line"><strong>Uten:</strong> '+e(line.removedIngredients.join(', '))+'</div>');
 if(line.comment)extras.push('<div class="cart-line">Kommentar: '+e(line.comment)+'</div>');
 return '<article class="cart-card"><div class="cart-head"><button class="brand-name" style="color:var(--green);font-size:15px" data-action="edit-line" data-line="'+e(line.id)+'">'+e(p.name)+'</button>'+
  '<div class="cart-qty"><button data-action="delete-line" data-line="'+e(line.id)+'" aria-label="Fjern vare" title="Fjern vare"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/></svg></button><span>'+line.quantity+'</span><button data-action="plus-line" data-line="'+e(line.id)+'" aria-label="Flere">+</button></div></div>'+
  '<div class="cart-line"><span><b>Størrelse:</b> '+e(size.name)+'</span><strong>'+money(size.price*line.quantity)+'</strong></div>'+
  extras.join('')+'<div class="cart-sum"><span class="muted">Sum</span><strong>'+money(linePrice(line))+'</strong></div></article>';
}
function cartMarkup(){
 return steps()+'<div class="page-heading"><h2>Handlekurv</h2>'+btn('♧ Tøm handlekurv','clear-cart',false,false,'small-btn')+'</div>'+
 (state.cart.length?state.cart.map(cartCard).join('')+'<div class="cart-card total-card"><span>Totalt</span><span>'+money(cartTotal())+'</span></div>':
 '<div class="empty"><div class="emoji">🛒</div><h2>Handlekurven er tom</h2><p>Velg noe godt fra menyen.</p></div>');
}
function contactMarkup(profileMode=false){
 const data=state.profile;
 const form='<div class="panel"><h2>Kontaktinformasjon</h2>'+
  '<label class="field-label" for="fullName"><span class="field-icon">♙</span> Hele navn <span class="optional">(påkrevd)</span></label>'+
  '<input class="input-field" id="fullName" autocomplete="name" maxlength="80" value="'+e(data.name)+'" placeholder="Navn og etternavn" required>'+
  '<label class="field-label" for="phoneNumber"><span class="field-icon">♧</span> Mobilnummer <span class="optional">(påkrevd)</span></label>'+
  '<div class="phone-field"><span class="prefix">+47</span><input class="input-field" id="phoneNumber" type="tel" inputmode="numeric" maxlength="8" autocomplete="tel-national" value="'+e(data.phone)+'" placeholder="8 sifre" required></div>'+
  '<label class="field-label" for="emailAddress"><span class="field-icon">✉</span> E-postadresse <span class="optional">(valgfri)</span></label>'+
  '<input class="input-field" id="emailAddress" type="email" autocomplete="email" maxlength="120" value="'+e(data.email)+'" placeholder="navn@example.no">'+
  '<p class="helper">Hvis du skriver inn e-post, sender restauranten informasjon om bestillingen når en ekte bestillingstjeneste er tilkoblet.</p>'+
  (profileMode?'<button class="button primary full mt20" data-action="save-profile">Lagre opplysninger</button>':'')+'</div>';
 return (profileMode?'<div class="page-heading"><div><span class="small">PROFIL</span><h1>Rediger profil</h1><p class="small mt8">Lagre kontaktopplysningene dine for raskere bestilling.</p></div></div>':steps())+form;
}
function storeForm(){
 const name=$('fullName')?.value.trim()||'',phone=$('phoneNumber')?.value.replace(/\D/g,'')||'',
  email=$('emailAddress')?.value.trim()||'';
 if(name.length<2){toast('Skriv inn hele navnet ditt.');$('fullName')?.focus();return false;}
 if(!/^\d{8}$/.test(phone)){toast('Skriv inn 8 sifre i mobilnummeret.');$('phoneNumber')?.focus();return false;}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Kontroller e-postadressen.');$('emailAddress')?.focus();return false;}
 setProfile({name,phone,email});return true;
}
function pickupMarkup(){
 const slots=pickupSlots(),open=openState().open;
 let html=steps()+'<div class="panel"><h3 style="font-size:18px">Når vil du hente?</h3><p class="muted mt8">Velg når du vil hente bestillingen.</p>';
 html+='<div class="pickup-grid mt14">'+
  '<button class="pickup-choice '+(vs.pickupMode==='asap'?'selected':'')+'" data-action="pickup-mode" data-value="asap" '+(!open?'disabled':'')+'><strong>Snarest</strong><small>Så snart som mulig</small></button>'+
  '<button class="pickup-choice '+(vs.pickupMode==='scheduled'?'selected':'')+'" data-action="pickup-mode" data-value="scheduled" '+(!open||!slots.length?'disabled':'')+'><strong>Velg tid</strong><small>Hent på et klokkeslett</small></button></div>';
 if(!open)html+='<p class="helper">Restauranten er stengt nå. Test av bestilling er ikke tilgjengelig utenfor åpningstiden.</p>';
 if(vs.pickupMode==='scheduled')html+='<div class="time-grid">'+slots.map(time=>'<button class="time-pill '+(vs.pickupTime===time?'selected':'')+'" data-action="pickup-time" data-value="'+e(time)+'">'+e(time)+'</button>').join('')+'</div>';
 html+='<button class="order-summary-toggle" data-action="expand-order"><span><b>'+cartQuantity()+' varer</b> <span class="small">Se innhold og detaljer</span></span><strong>'+(vs.expanded?'Vis mindre':'Vis mer')+'</strong></button>';
 if(vs.expanded)html+='<div>'+state.cart.map(cartCard).join('')+'</div>';
 return html+'</div>';
}
function bonusMarkup(){
 const enabled=config.restaurant.loyalty.enabled,goal=config.restaurant.loyalty.buy||10;
 const count=state.loyalty.count%goal;
 const colors=Array.from({length:goal},(_,i)=>((i<count?'var(--bonus-accent)':'var(--bonus-idle)')+' '+(i*360/goal)+'deg '+((i+1)*360/goal-5)+'deg, var(--card) '+((i+1)*360/goal-5)+'deg '+((i+1)*360/goal)+'deg')).join(', ');
 if(!enabled)return '';
 return '<div class="panel bonus-box"><h2>Din pizzabonus</h2><p class="muted mt14">Kjøp '+goal+' store pizzaer, få den '+(goal+1)+'. gratis</p>'+
  '<div class="bonus-ring" style="background:conic-gradient('+colors+')"><div class="ring-center"><b>'+count+'</b><span>pizza<br>registrert</span></div></div>'+
  '<strong>'+(goal-count)+' pizzaer igjen til din gratis pizza</strong>'+
  '<p class="helper">BETA: Viser kun lokale testpoeng. Ekte pizzabonus kobles trygt til en restaurantserver senere.</p>'+
  '<label class="preference"><input type="checkbox" data-toggle="offers" '+(state.loyalty.offersConsent?'checked':'')+'> Varsle meg om gratis pizza og bruk pizzabonus automatisk.</label></div>';
}
function profileMarkup(){
 const p=state.profile,name=p.name||'Gjest';
 const initials=name.split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
 return '<div class="profile-summary"><div class="avatar">'+e(initials||'G')+'</div><div><h2>'+e(name)+'</h2><span class="muted">'+(p.phone?'+47 '+e(p.phone):'Ingen telefon registrert')+'</span></div></div>'+
  bonusMarkup()+
  '<button class="menu-row" data-action="profile-edit"><span class="row-icon">♙</span><span class="grow"><strong>Rediger profil</strong><span class="small block">Navn, mobilnummer og e-post lagret</span></span>›</button>'+
  '<button class="menu-row" data-action="orders"><span class="row-icon">▤</span><span class="grow"><strong>Mine bestillinger</strong><span class="small block">'+(state.orders.length?state.orders.length+' lokale testbestillinger':'Ingen aktive bestillinger')+'</span></span>›</button>'+
  '<button class="menu-row" data-action="favorites"><span class="row-icon">♡</span><span class="grow"><strong>Mine favoritter</strong><span class="small block">'+state.favorites.length+' lagret</span></span>›</button>';
}
function ordersMarkup(){
 let html='<div class="page-heading"><h1>Mine bestillinger</h1></div>';
 if(!state.orders.length)return html+'<div class="empty"><div class="emoji">▤</div>Ingen bestillinger her ennå.</div>';
 return html+'<div class="preview-banner">Dette er lokale BETA-testbestillinger, ikke bestillinger hos restauranten.</div>'+
  state.orders.map(o=>'<div class="cart-card"><div class="cart-head"><strong>'+new Date(o.createdAt).toLocaleString(config.locale)+'</strong><span class="status-pill">Testbestilling</span></div><p class="small mt8">'+o.lines.map(l=>e(l.name)+' × '+l.quantity).join(', ')+'</p><div class="cart-sum"><span>'+e(o.pickupMode==='asap'?'Snarest':o.pickup)+'</span><strong>'+money(o.total)+'</strong></div></div>').join('');
}
function infoMarkup(){
 const r=config.restaurant,s=openState();
 return '<div class="info-heading"><span class="info-icon">▣</span><div><span class="small">RESTAURANTINFORMASJON</span><h2>'+e(r.name)+'</h2></div></div>'+
  '<div class="info-card"><span class="status-dot '+(!s.open?'closed':'')+'"></span> <strong style="display:inline">'+(s.open?'Åpent for bestilling · stenger '+e(s.closesAt):'Stengt nå')+'</strong></div>'+
  '<div class="info-section">BESTILLING & HENTING</div>'+
  '<div class="info-card"><span class="small">◷ &nbsp; Bestillingstider</span><strong>'+e(r.openTimes[(new Date().getDay()+6)%7]?.from||'14:00')+'–'+e(r.openTimes[(new Date().getDay()+6)%7]?.to||'22:00')+'</strong></div>'+
  '<div class="info-card"><span class="small">♧ &nbsp; Estimert hentetid</span><strong>Ca. '+r.pickupMinutes+' min</strong><span class="small">Henting i restauranten</span></div>'+
  '<div class="info-card"><span class="small">☰ &nbsp; Neste hentetider</span><div class="time-grid">'+pickupSlots().slice(0,8).map(t=>'<span class="time-pill">'+e(t)+'</span>').join('')+'</div></div>'+
  '<div class="info-section">PRAKTISK INFORMASJON</div>'+
  '<div class="info-card"><span class="small">⌖ &nbsp; Adresse</span><strong>'+e([r.address,r.postcode,r.city].filter(Boolean).join(', ')||'Adresse ikke angitt')+'</strong></div>'+
  '<div class="info-card"><span class="small">♧ &nbsp; Telefon</span><strong>'+e(r.phone||'Telefon ikke angitt')+'</strong></div>'+
  '<div class="sheet-footer" style="position:relative;box-shadow:none;padding:7px 0">'+
   (r.phone?'<a class="button primary" style="flex:1" href="tel:'+e(r.phone.replace(/\s/g,''))+'">Ring restauranten</a>':'')+
   (r.address?'<a class="button" style="flex:1" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([r.address,r.city].join(', '))+'">Vis adresse</a>':'')+'</div>';
}
function openInfo(){showSheet(sheetHeader('Restaurantinformasjon')+'<div class="sheet-scroll">'+infoMarkup()+'</div>');}
function renderBottom(){
 if(vs.page!=='cart'){bar.hidden=true;bar.innerHTML='';return;}
 bar.hidden=false;
 if(vs.step===1)bar.innerHTML=btn('Fortsett å handle','continue-shop')+btn('Neste: Kontakt','next-contact',true,!state.cart.length);
 else if(vs.step===2)bar.innerHTML=btn('Tilbake','previous-step')+btn('Neste: Hentetid','next-pickup',true);
 else bar.innerHTML=btn('Tilbake','previous-step')+btn(vs.submitting?'Sender…':config.mode==='preview'?'Opprett testbestilling':'Send bestilling','send-order',true,vs.submitting||!vs.pickupMode||(vs.pickupMode==='scheduled'&&!vs.pickupTime)||!openState().open);
}
function render(){
 header();if(!catalogReady()){bar.hidden=true;return;}
 if(vs.page==='menu'){categories();main.innerHTML=menuMarkup();}
 else if(vs.page==='cart'){
  main.innerHTML=vs.step===1?cartMarkup():vs.step===2?contactMarkup():pickupMarkup();
 }else if(vs.page==='profile')main.innerHTML=profileMarkup();
 else if(vs.page==='profile-edit')main.innerHTML=contactMarkup(true);
 else if(vs.page==='orders')main.innerHTML=ordersMarkup();
 else if(vs.page==='favorites'){
  main.innerHTML='<div class="page-heading"><h1>Mine favoritter</h1></div>'+
  (state.favorites.length?state.favorites.map(id=>findProduct(id)?.p).filter(Boolean).map(menuCard).join(''):'<div class="empty">Ingen favoritter lagret ennå.</div>');
 }else if(vs.page==='confirmed'){
  main.innerHTML='<div class="panel" style="text-align:center;margin-top:45px"><div style="font-size:48px">✓</div>'+
   '<h2>Testbestilling opprettet</h2><p class="helper">BETA er i forhåndsvisning. Ingen bestilling, SMS eller e-post er sendt til restauranten.</p>'+
   '<button class="button primary full mt20" data-action="go-menu">Tilbake til menyen</button></div>';
 }
 renderBottom();
}
function validateCart(){
 if(!state.cart.length){toast('Handlekurven er tom.');return false;}
 for(const line of state.cart){
  const f=findProduct(line.productId);
  if(!f||f.p.soldOut){toast('Et produkt er ikke lenger tilgjengelig.');return false;}
  for(const g of applicableGroups(f.p,line.sizeId))if((line.options?.[g.id]||[]).length<g.min){
   toast('Kontroller valg for '+f.p.name);return false;
  }
 }
 return true;
}
async function submit(){
 if(vs.submitting||!validateCart()||!vs.pickupMode||(vs.pickupMode==='scheduled'&&!vs.pickupTime))return;
 if(config.mode!=='preview'&&!openState().open){toast('Restauranten er stengt.');return;}
 vs.submitting=true;renderBottom();
 const lines=state.cart.map(l=>{const f=findProduct(l.productId),p=f.p,s=selectedSize(p,l.sizeId);
  const options=applicableGroups(p,l.sizeId).flatMap(g=>(l.options?.[g.id]||[]).map(id=>g.options.find(x=>x.id===id)).filter(Boolean).map(x=>({label:x.label,price:x.price})));
  return {itemId:p.id,productId:p.id,name:p.name,size:s.name,sizeId:s.id,quantity:l.quantity,options,removedIngredients:l.removedIngredients||[],comment:l.comment||'',price:linePrice(l)};
 });
 try{
  await sendOrder({tenantId:config.tenantId,customerName:state.profile.name,phone:state.profile.phone,email:state.profile.email,
   type:'henting',pickupMode:vs.pickupMode,pickup:vs.pickupMode==='asap'?'Snarest':vs.pickupTime,total:cartTotal(),lines});
  clearCart();vs.step=1;vs.pickupMode='';vs.pickupTime='';setPage('confirmed');
 }catch(err){toast(err.message||'Kunne ikke lagre.');}
 finally{vs.submitting=false;renderBottom();}
}
function onAction(action,target){
 const id=target.dataset.id,line=target.dataset.line;
 if(action==='category'){
  if(id==='search'){vs.search=true;vs.query='';render();$('menuSearch')?.focus();return;}
  if(id==='popular'&&!catalog.popularIds.length)return;
  activateCategory(id);
  document.getElementById('cat-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 if(action==='restaurant-info'){openInfo();return;}
 if(action==='close-search'){vs.search=false;vs.query='';render();return;}
 if(action==='product'){openProduct(id);return;}
 if(action==='close-sheet'){closeSheet();return;}
 if(action==='ingredients'){ingredientsExpanded=!ingredientsExpanded;renderProductSheet();return;}
 if(action==='remove-ingredient'){
  const v=target.dataset.value||'';draft.removedIngredients=draft.removedIngredients.includes(v)?draft.removedIngredients.filter(x=>x!==v):[...draft.removedIngredients,v];
  draft.comment=$('productComment')?.value||draft.comment;renderProductSheet();return;
 }
 if(action==='favorite'){
  toggleFavorite(draft.productId);renderProductSheet();toast('Favoritter oppdatert.');return;
 }
 if(action==='draft-plus'||action==='draft-minus'){
  draft.comment=$('productComment')?.value||draft.comment;
  draft.quantity=Math.max(1,Math.min(99,draft.quantity+(action==='draft-plus'?1:-1)));renderProductSheet();return;
 }
 if(action==='add-product'){addSelectedProduct();return;}
 if(action==='clear-cart'){clearCart();render();return;}
 if(action==='plus-line'||action==='delete-line'){changeQuantity(line,action==='plus-line'?1:-1);render();return;}
 if(action==='edit-line'){const l=state.cart.find(x=>x.id===line);if(l)openProduct(l.productId,l.id);return;}
 if(action==='continue-shop'||action==='go-menu'){setPage('menu');return;}
 if(action==='next-contact'){if(validateCart()){vs.step=2;render();scrollMainTop();}return;}
 if(action==='next-pickup'){if(storeForm()){vs.step=3;render();scrollMainTop();}return;}
 if(action==='previous-step'){vs.step=Math.max(1,vs.step-1);render();scrollMainTop();return;}
 if(action==='pickup-mode'){vs.pickupMode=target.dataset.value;vs.pickupTime='';render();return;}
 if(action==='pickup-time'){vs.pickupTime=target.dataset.value;render();return;}
 if(action==='expand-order'){vs.expanded=!vs.expanded;render();return;}
 if(action==='send-order'){void submit();return;}
 if(action==='profile-edit'){setPage('profile-edit');return;}
 if(action==='save-profile'){if(storeForm()){toast('Opplysninger lagret.');setPage('profile');}return;}
 if(action==='orders'){setPage('orders');return;}
 if(action==='favorites'){setPage('favorites');return;}
}
document.addEventListener('click',event=>{
 const t=event.target.closest('[data-action]');if(!t)return;
 if(t.closest('#sheet')===null&&t.closest('#mainContent')===null&&t.closest('#bottomBar')===null&&t.closest('#categoryScroller')===null)return;
 event.preventDefault();onAction(t.dataset.action,t);
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.dataset.field==='size'&&draft){
  draft.comment=$('productComment')?.value||draft.comment;
  draft.sizeId=t.value;
  const f=findProduct(draft.productId);
  const allowed=new Set(applicableGroups(f.p,draft.sizeId).map(g=>g.id));
  draft.options=Object.fromEntries(Object.entries(draft.options).filter(([id])=>allowed.has(id)));
  for(const g of applicableGroups(f.p,draft.sizeId))if(!draft.options[g.id])draft.options[g.id]=(g.defaultOptionIds||[]).slice();
  renderProductSheet();return;
 }
 if(t.dataset.field==='option'&&draft){
  draft.comment=$('productComment')?.value||draft.comment;
  optionUpdate(t.dataset.group,t.value,t.checked);return;
 }
 if(t.dataset.toggle==='allergens'){state.allergens=t.checked;persist();render();return;}
 if(t.dataset.toggle==='offers'){state.loyalty.offersConsent=t.checked;persist();return;}
});
document.addEventListener('input',event=>{
 const t=event.target;
 if(t.id==='menuSearch'){
  const start=t.selectionStart;vs.query=t.value;
  // Keep the input and focus while replacing only the results area.
  const q=t.value.toLocaleLowerCase('nb-NO').trim();
  for(const card of main.querySelectorAll('.product-card')){
   const categoryName=findProduct(card.dataset.id)?.c.name||'';
   const txt=(card.textContent+' '+categoryName).toLocaleLowerCase('nb-NO');card.hidden=!txt.includes(q);
  }
  return;
 }
 if(t.id==='productComment'&&draft){draft.comment=t.value;}
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!sheet.hidden)closeSheet();
 if((event.key==='Enter'||event.key===' ')&&event.target.matches('article.product-card')){
  event.preventDefault();openProduct(event.target.dataset.id);
 }
});
backdrop.addEventListener('click',closeSheet);
$('brandButton').addEventListener('click',()=>{vs.search=false;vs.query='';setPage('menu');});
$('profileButton').addEventListener('click',()=>setPage('profile'));
$('cartButton').addEventListener('click',()=>{vs.step=1;setPage('cart');});
$('backButton').addEventListener('click',()=>{if(vs.page==='cart'&&vs.step>1){vs.step--;render();return;}if(vs.page==='profile-edit'||vs.page==='orders'||vs.page==='favorites'){setPage('profile');return;}setPage('menu');});
$('themeButton').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';persist();render();});
async function boot(){
 main.innerHTML='<div class="empty"><div class="emoji">🍕</div><h2>Henter menyen…</h2><p>Fra Firebase</p></div>';
 header();
 try{
  await loadCatalog();
  if(!catalogReady())throw new Error('Ingen produkter tilgjengelig.');
  render();
 }catch(err){
  main.innerHTML='<div class="empty"><div class="emoji">⚠️</div><h2>Kunne ikke hente menyen</h2><p>'+e(err.message||'Firebase svarer ikke.')+'</p><button class="button primary mt20" id="retryMenu">Prøv igjen</button></div>';
  $('retryMenu')?.addEventListener('click',()=>void boot());
 }
}
void boot();
// Only revalidate the revision occasionally, never listen to entire /orders or root.
let refreshing=false;
async function checkMenu(){
 if(refreshing||document.hidden||!catalogReady())return;
 refreshing=true;const old=catalog.version;
 try{
  await loadCatalog();
  if(catalog.version!==old){render();toast('Menyen er oppdatert.');}
 }catch{}
 finally{refreshing=false;}
}
main.addEventListener('scroll',()=>{
 if(vs.page!=='menu'||vs.search||document.hidden)return;
 const offset=main.getBoundingClientRect().top+30;
 let active='';
 for(const block of main.querySelectorAll('section[id^="cat-"]')){
  if(block.getBoundingClientRect().top<=offset)active=block.id.slice(4);
 }
 if(!active)active=main.querySelector('section[id^="cat-"]')?.id.slice(4)||'';
 if(active&&active!==lastActiveCategory)activateCategory(active);
},{passive:true});
cats.addEventListener('scroll',updateCategoryIndicator,{passive:true});
categoryIndicator?.addEventListener('click',event=>{
 const bounds=categoryIndicator.getBoundingClientRect();
 if(!bounds.width)return;
 const progress=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
 const target=Math.max(0,progress*cats.scrollWidth-cats.clientWidth/2);
 cats.scrollTo({left:target,behavior:'smooth'});
});
categoryIndicator?.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();
 const delta=event.key==='ArrowLeft'?-100:event.key==='ArrowRight'?100:0;
 const destination=event.key==='Home'?0:event.key==='End'?cats.scrollWidth:cats.scrollLeft+delta;
 cats.scrollTo({left:destination,behavior:'smooth'});
});
window.addEventListener('resize',updateCategoryIndicator);
window.addEventListener('focus',()=>void checkMenu());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkMenu();});
setInterval(()=>{if(!document.hidden)void checkMenu();},5*60*1000);
