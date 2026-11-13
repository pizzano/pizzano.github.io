/* BETA profile and theme: local-first, no Firebase reads or polling. */
'use strict';
const BETA_THEME_KEY='kol-beta-theme-v1';
function betaReadTheme(){
 try{return localStorage.getItem(BETA_THEME_KEY)==='dark'?'dark':'light'}catch{return 'light'}
}
function betaApplyTheme(theme,persist=true){
 const dark=theme==='dark';
 document.documentElement.dataset.betaTheme=dark?'dark':'light';
 for(const id of ['betaThemeToggle','betaProfileThemeToggle','betaCartThemeToggle']){
  const button=$(id);
  if(!button)continue;
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',dark?'Bytt til lys modus':'Bytt til mørk modus');
  button.querySelector('.beta-theme-sun').hidden=dark;
  button.querySelector('.beta-theme-moon').hidden=!dark;
 }
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=dark?'#091f1b':'#133d32';
 if(persist)try{localStorage.setItem(BETA_THEME_KEY,dark?'dark':'light')}catch{}
}
function betaProfileContact(){
 const current=demoContact||{};
 if(current.name||current.phone||current.email)return current;
 // DEMO and BETA share an origin; migrate its local contact only as a fallback.
 try{
  const old=JSON.parse(localStorage.getItem('bestill_profile_v2')||'null');
  if(old&&typeof old==='object')return {
   name:String(old.name||''),phone:String(old.phone||'').replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'').slice(0,8),
   email:String(old.email||'')
  };
 }catch{}
 return {name:'',phone:'',email:''};
}
function betaProfileInitials(name){
 return String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('');
}
function betaProfilePhoneNumber(phone){
 const d=String(phone||'').replace(/\D/g,'');
 return /^[49]\d{7}$/.test(d)?'+47 '+d.slice(0,2)+' '+d.slice(2,4)+' '+d.slice(4,6)+' '+d.slice(6):'Kundeprofil';
}
/* Pizzabonus: a single tiny RTDB REST/EventSource listener on the bonusCount leaf
 * ONLY while the profile bonus is visible. No Firebase SDK, no polling.
 * EventSource sends the initial value and any later change over one connection.
 * Local cache supplies immediate display during connection; manual refresh reconnects.
 */
const BETA_BONUS_CACHE_KEY='kol-beta-bonus-cache-v1';
const BETA_BONUS_CONSENT_KEY='kol-beta-bonus-consent-v1';
let betaBonusSource=null,betaBonusSourcePhone='',betaBonusStreamId=0;
let betaBonusGetPending=null;
function betaBonusPhone(){
 const phone=String(betaProfileContact().phone||'').replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'');
 return /^[49]\d{7}$/.test(phone)?phone:'';
}
function betaBonusValue(value){
 return Math.min(10,Math.max(0,Math.floor(Number(value)||0)));
}
function betaBonusCached(phone){
 if(!phone)return null;
 try{
  const entry=JSON.parse(localStorage.getItem(BETA_BONUS_CACHE_KEY)||'null');
  return entry&&entry.phone===phone&&Number.isInteger(entry.count)&&entry.count>=0?
   entry:null;
 }catch{return null}
}
function betaBonusRender(count){
 const earned=betaBonusValue(count);
 const pts=(radius,angle)=>[
  120+radius*Math.cos(angle*Math.PI/180),
  120+radius*Math.sin(angle*Math.PI/180)
 ];
 const segments=Array.from({length:10},(_,i)=>{
  const start=i*36-90+1.5,end=start+33;
  const a=pts(104,start),b=pts(104,end),c=pts(72,end),d=pts(72,start),pos=pts(88,start+16.5);
  return '<g class="beta-bonus-piece'+(i<earned?' earned':'')+'">'+
   '<path class="beta-bonus-wedge" d="M'+a.join(' ')+' A104 104 0 0 1 '+b.join(' ')+
   ' L'+c.join(' ')+' A72 72 0 0 0 '+d.join(' ')+'Z"/>'+
   '<g class="beta-bonus-pizza" transform="translate('+(pos[0]-10)+' '+(pos[1]-10)+')">'+
   '<path d="M4 3Q10-1 17 5L5 19Z M4 3Q10 1 16 6"/>'+
   '<circle cx="8" cy="7" r="1.2"/><circle cx="11" cy="10" r="1.2"/>'+
   '<circle cx="6.5" cy="13" r="1"/></g></g>';
 }).join('');
 $('betaBonusSegments').innerHTML=segments;
 $('betaBonusCount').textContent=earned;
 $('betaBonusRing').setAttribute('aria-label',earned+' av 10 pizzaer registrert');
 const remaining=10-earned;
 $('betaBonusRemaining').textContent=remaining?
  remaining+' '+(remaining===1?'pizza igjen':'pizzaer igjen')+' til din gratis pizza':
  'Du har opptjent en gratis pizza!';
}
function betaBonusStatus(message){
 $('betaBonusStatus').textContent=message||'';
}
function betaBonusConsentKey(){
 return BETA_BONUS_CONSENT_KEY+':'+(betaBonusPhone()||'local');
}
function betaBonusConsentShow(){
 try{$('betaBonusConsent').checked=localStorage.getItem(betaBonusConsentKey())==='true'}
 catch{$('betaBonusConsent').checked=false}
}
function betaBonusStop(){
 betaBonusStreamId++;
 if(betaBonusSource){betaBonusSource.close();betaBonusSource=null}
 betaBonusSourcePhone='';
}
function betaBonusVisible(){
 return !$('betaProfileSheet').hidden&&!$('betaProfileHome').hidden&&!document.hidden;
}
function betaBonusStore(phone,count){
 const amount=betaBonusValue(count);
 try{localStorage.setItem(BETA_BONUS_CACHE_KEY,JSON.stringify({phone,count:amount,savedAt:Date.now()}))}catch{}
 if(betaBonusVisible()&&betaBonusPhone()===phone){
  betaBonusRender(amount);
  betaBonusStatus('Oppdatert automatisk');
 }
}
async function betaBonusGetOnce(phone){
 // Fallback for browsers without SSE support or if establishing the stream fails.
 if(betaBonusGetPending)return betaBonusGetPending;
 const task=(async()=>{
  try{
   const response=await fetch(BASE+'/customers/'+phone+'/bonusCount.json',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const value=await response.json();
   if(value!==null&&(!Number.isFinite(Number(value))||typeof value==='object'))throw Error('Invalid bonus data');
   if(betaBonusPhone()===phone){
    betaBonusStore(phone,value);
    betaBonusStatus('Oppdatert');
   }
  }catch(error){
   console.warn('BETA bonus read failed:',error);
   if(betaBonusPhone()===phone&&betaBonusVisible())betaBonusStatus('Kunne ikke oppdatere pizzabonus. Trykk Oppdater.');
  }
 })();
 betaBonusGetPending=task;
 try{await task}finally{if(betaBonusGetPending===task)betaBonusGetPending=null}
}
function betaBonusStart(force=false){
 const phone=betaBonusPhone();
 if(!phone){
  betaBonusStop();
  betaBonusRender(0);
  betaBonusStatus('Lagre mobilnummer for å hente pizzabonus.');
  return;
 }
 if(!betaBonusVisible())return;
 if(!force&&betaBonusSource&&betaBonusSourcePhone===phone)return;
 betaBonusStop();
 if(typeof EventSource==='undefined'){
  betaBonusStatus('Henter pizzabonus…');
  void betaBonusGetOnce(phone);
  return;
 }
 const token=betaBonusStreamId,source=new EventSource(BASE+'/customers/'+phone+'/bonusCount.json');
 betaBonusSource=source;
 betaBonusSourcePhone=phone;
 betaBonusStatus('Kobler til pizzabonus…');
 const onData=event=>{
  if(betaBonusSource!==source||betaBonusStreamId!==token||betaBonusPhone()!==phone||!betaBonusVisible())return;
  try{
   const payload=JSON.parse(event.data);
   // bonusCount itself is a number; parent customer fields are never streamed.
   if(payload.path!=='/'&&payload.path!=='')return;
   const value=payload.data;
   if(value!==null&&(typeof value==='object'||!Number.isFinite(Number(value))))return;
   betaBonusStore(phone,value);
  }catch(error){console.warn('BETA bonus stream event ignored:',error)}
 };
 source.addEventListener('put',onData);
 source.addEventListener('patch',onData);
 const denied=()=>{
  if(betaBonusSource!==source)return;
  betaBonusStop();
  betaBonusStatus('Tilgang til pizzabonus ble avvist.');
 };
 source.addEventListener('cancel',denied);
 source.addEventListener('auth_revoked',denied);
 source.addEventListener('error',()=>{
  if(betaBonusSource!==source)return;
  // EventSource normally reconnects on short network interruptions.
  // Do not create duplicate streams or periodic REST requests.
  if(source.readyState===2){
   betaBonusStop();
   betaBonusStatus('Live-tilkobling brutt. Trykk Oppdater.');
  }else{
   betaBonusStatus('Prøver å koble til pizzabonus igjen…');
  }
 });
}
function betaBonusLoad(force=false){
 betaBonusStart(force);
}
function betaBonusDisplayHome(){
 const phone=betaBonusPhone(),cache=betaBonusCached(phone);
 betaBonusRender(cache?.count??0);
 betaBonusConsentShow();
 betaBonusStatus(phone?(cache?'Lokalt lagret · kobler til live status':''):'Lagre mobilnummer for å hente pizzabonus.');
}
function betaProfileRenderHome(){
 const c=betaProfileContact(),name=String(c.name||'').trim(),avatar=betaProfileInitials(name);
 $('betaProfileName').textContent=name||'Min profil';
 $('betaProfilePhone').textContent=betaProfilePhoneNumber(c.phone);
 $('betaProfileInitials').textContent=avatar||'👤';
 $('betaProfileContactMeta').textContent=(name||c.phone)?(c.email?'Navn, mobilnummer og e-post lagret':'Navn og mobilnummer lagret'):'Navn, mobilnummer og e-post';
 $('betaProfileOrdersMeta').textContent=demoOrder?'1 lokalt lagret bestillingsoversikt':'Ingen lagrede bestillinger';
 betaBonusDisplayHome();
}
function betaProfileRenderOrders(){
 const host=$('betaProfileOrders');
 if(!demoOrder){host.innerHTML='<p class="beta-profile-empty">Ingen bestillinger lagret på denne enheten.</p>';return}
 const order=demoOrder,items=Array.isArray(order.items)?order.items:[];
 host.innerHTML='<article class="beta-profile-order-card">'+
 '<div class="beta-profile-order-head"><strong>Bestilling '+esc(order.id||'')+'</strong><span>Lokalt lagret</span></div>'+
 '<p>Ikke sendt til restauranten</p><p>'+items.map(item=>esc((Number(item.qty)||1)+' × '+String(item.name||''))).join(' · ')+'</p>'+
 '<div><span>'+esc(order.pickup?.label||'Snarest')+'</span><strong>'+money(order.total)+'</strong></div></article>';
}

/* Restaurantinformasjon: ONLY menu.settings, already fetched from /settings.
 * Opening profile performs no Firebase requests. Manual refresh reads only
 * /settings.json and updates the existing menu cache (no duplicate settings).
 */
let betaRestaurantLoading=null,betaRestaurantMessage='';
function betaRestaurantText(value){
 return String(value||'').trim();
}
function betaRestaurantCleanHref(raw){
 try{
  const u=new URL(String(raw||'').trim());
  if(u.protocol==='https:'||u.protocol==='http:')return u.href;
 }catch{}
 return '';
}
function betaRestaurantIcons(name){
 const paths={
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone:'<path d="M22 16.9V20a2 2 0 0 1-2.2 2A19.5 19.5 0 0 1 2 4.2 2 2 0 0 1 4 2h3.1a2 2 0 0 1 2 1.7l.5 3.1a2 2 0 0 1-.6 1.8L7 10.4a16 16 0 0 0 6.6 6.6l1.8-2a2 2 0 0 1 1.8-.6l3.1.5a2 2 0 0 1 1.7 2Z"/>',
  mail:'<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bag:'<path d="M4 8h16l-1 13H5L4 8Z M9 9V6a3 3 0 0 1 6 0v3"/>',
  card:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19 M6 15h4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18"/>',
  shop:'<path d="M4 10 6 4h12l2 6 M6 10v11h12V10M9 21v-7h6v7M4 10c1 2 3 2 4.5 0 1.5 2 3 2 4.5 0 1.5 2 3 2 4.5 0 1.5 2 3 2 4.5 0"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 1M4 16l1 1a8 8 0 0 0 14-2"/>'
 };
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.shop)+'</svg>';
}
function betaRestaurantRow(icon,label,value,href='',action=''){
 if(!value)return '';
 const a=href?'<a href="'+esc(href)+'" target="'+(href.startsWith('http')?'_blank':'_self')+'"'+(href.startsWith('http')?' rel="noopener noreferrer"':'')+' class="beta-restaurant-row-action">'+esc(action||'Åpne')+' <span aria-hidden="true">↗</span></a>':'';
 return '<div class="beta-restaurant-fact"><span class="beta-restaurant-icon">'+betaRestaurantIcons(icon)+'</span>'+
 '<div class="beta-restaurant-fact-copy"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>'+a+'</div>';
}
function betaProfileRenderRestaurant(){
 const settings=menu?.settings||{};
 const restaurant=betaRestaurantText(settings.restaurantName)||'KØL Grill & Pizza';
 const addressParts=[settings.streetAddress||settings.address,settings.postalCode,settings.city].map(betaRestaurantText).filter(Boolean);
 const address=addressParts.join(', '),phone=betaRestaurantText(settings.phone).replace(/[^\d+ ]/g,'');
 const phoneDigits=phone.replace(/\D/g,'');
 const tel=phoneDigits.length===8?'+47'+phoneDigits:phoneDigits.length===10&&phoneDigits.startsWith('47')?'+'+phoneDigits:'';
 const email=betaRestaurantText(settings.email);
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';
 const hourList=Array.isArray(settings.weeklyHours)&&settings.weeklyHours.length===7?openingDays(settings):null;
 const weekdays=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
 const current=typeof osloTime==='function'?osloTime():{day:-1};
 const state=hourList&&typeof calculateHoursStatus==='function'?calculateHoursStatus(settings,current):null;
 const hours=hourList?hourList.map((day,index)=>{
  const hoursText=day.enabled?esc(day.open)+' – '+esc(day.close):'Stengt';
  return '<div class="beta-restaurant-hours-row'+(index===current.day?' is-today':'')+'"><span>'+weekdays[index]+(index===current.day?'<small>I dag</small>':'')+'</span><strong>'+hoursText+'</strong></div>';
 }).join(''):'<p class="beta-restaurant-empty">Åpningstider er ikke registrert.</p>';
 const status=state?(state.open?'Åpent nå':state.preOpen?'Forhåndsbestilling':'Stengt nå'):'Åpningstider';
 const statusCls=state?(state.open?' is-open':state.preOpen?' is-preorder':' is-closed'):'';
 const statusNote=state?state.pill:'Se åpningstider nedenfor';
 const map=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
 const website=betaRestaurantCleanHref(settings.website);
 const insta=betaRestaurantCleanHref(settings.instagram);
 const facebook=betaRestaurantCleanHref(settings.facebook);
 const pickup=betaRestaurantText(settings.pickupInfo)||'Henting i restauranten';
 const payment=betaRestaurantText(settings.paymentInfo);
 const description=betaRestaurantText(settings.description);
 const meta=[betaRestaurantText(settings.city),'Takeaway'].filter(Boolean).join(' · ');
 const facts=[
  betaRestaurantRow('pin','Adresse',address,map,'Kart'),
  betaRestaurantRow('phone','Telefon',phone,tel?'tel:'+tel:'','Ring'),
  betaRestaurantRow('mail','E-post',validEmail,validEmail?'mailto:'+validEmail:'','Skriv'),
 ].filter(Boolean).join('');
 const other=betaRestaurantRow('bag','Henting',pickup)+betaRestaurantRow('card','Betaling',payment);
 const links=[
  website?'<a target="_blank" rel="noopener noreferrer" href="'+esc(website)+'">'+betaRestaurantIcons('globe')+' Nettside</a>':'',
  insta?'<a target="_blank" rel="noopener noreferrer" href="'+esc(insta)+'">Instagram ↗</a>':'',
  facebook?'<a target="_blank" rel="noopener noreferrer" href="'+esc(facebook)+'">Facebook ↗</a>':''
 ].filter(Boolean).join('');
 const host=$('betaProfileRestaurantInfo');
 host.innerHTML='<div class="beta-restaurant-hero"><div class="beta-restaurant-logo">'+betaRestaurantIcons('shop')+'</div>'+
 '<div class="beta-restaurant-hero-copy"><small>RESTAURANTINFORMASJON</small><h3>'+esc(restaurant)+'</h3><p>'+esc(meta)+'</p></div></div>'+
 (description?'<p class="beta-restaurant-description">'+esc(description)+'</p>':'')+
 '<div class="beta-restaurant-status'+statusCls+'"><span class="beta-restaurant-status-dot" aria-hidden="true"></span><div><strong>'+esc(status)+'</strong><small>'+esc(statusNote)+'</small></div></div>'+
 '<section class="beta-restaurant-card"><h3>Kontakt og adresse</h3>'+
 (facts||'<p class="beta-restaurant-empty">Kontaktinformasjon er ikke registrert ennå.</p>')+'</section>'+
 '<section class="beta-restaurant-card"><div class="beta-restaurant-section-title"><h3>Åpningstider</h3><span>Europe/Oslo</span></div><div class="beta-restaurant-hours">'+hours+'</div></section>'+
 '<section class="beta-restaurant-card"><h3>Bestilling og henting</h3>'+other+'</section>'+
 (links?'<div class="beta-restaurant-links">'+links+'</div>':'')+
 '<div class="beta-restaurant-sync"><p id="betaRestaurantStatus" role="status">'+esc(betaRestaurantMessage||'Viser lagret restaurantinformasjon')+'</p>'+
 '<button id="betaRestaurantRefresh" type="button" data-beta-restaurant-refresh>'+betaRestaurantIcons('refresh')+' Oppdater informasjon</button></div>';
}
async function betaRestaurantRefresh(){
 if(betaRestaurantLoading)return betaRestaurantLoading;
 const task=(async()=>{
  betaRestaurantMessage='Oppdaterer fra settings…';
  betaProfileRenderRestaurant();
  try{
   const response=await fetch(BASE+'/settings.json',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ugyldig settings-format');
   if(!menu)throw Error('Menyen er ikke lastet');
   menu.settings=data;
   await localPut(menu);
   $('brandName').textContent=betaRestaurantText(menu.settings.restaurantName)||'KØL Grill & Pizza';
   updateHoursStatus();
   betaRestaurantMessage='Oppdatert fra settings · lagret på enheten';
  }catch(error){
   console.warn('BETA restaurant settings refresh failed:',error);
   betaRestaurantMessage='Kunne ikke oppdatere. Viser lagret informasjon.';
  }finally{
   if(!$('betaProfileRestaurantPanel').hidden)betaProfileRenderRestaurant();
  }
 })();
 betaRestaurantLoading=task;
 try{return await task}finally{betaRestaurantLoading=null}
}
function betaProfileShowTab(tab){
 const home=tab==='home',names={contact:'Rediger profil',orders:'Mine bestillinger',restaurant:'Restaurantinformasjon'};
 $('betaProfileHome').hidden=!home;$('betaProfileDetail').hidden=home;
 for(const name of Object.keys(names))$('betaProfile'+name[0].toUpperCase()+name.slice(1)+'Panel').hidden=tab!==name;
 if(home){betaProfileRenderHome();betaBonusStart(false)}
 else{
  betaBonusStop();
  $('betaProfileDetailTitle').textContent=names[tab]||'Min profil';
  if(tab==='contact'){
   const c=betaProfileContact();
   $('betaProfName').value=c.name||'';
   $('betaProfPhone').value=c.phone||'';
   $('betaProfEmail').value=c.email||'';
   $('betaProfileSaveStatus').hidden=true;
  }else if(tab==='orders')betaProfileRenderOrders();
  else if(tab==='restaurant')betaProfileRenderRestaurant();
 }
 $('betaProfileScroll').scrollTop=0;
}
function betaProfileOpen(){
 hideAll();
 show('betaProfileSheet');
 $('btnProfile').setAttribute('aria-expanded','true');
 betaProfileShowTab('home');
 const count=cart.reduce((n,line)=>n+(Number(line.qty)||0),0);
 $('betaProfileCartCount').hidden=!count;
 $('betaProfileCartCount').textContent=count;
 $('betaProfileClose').focus();
}
function betaProfileClose(){
 hideAll();
 $('btnProfile').focus();
}
async function betaProfileSaveContact(event){
 event.preventDefault();
 const name=$('betaProfName').value.trim().replace(/\s+/g,' ').slice(0,120);
 const phone=$('betaProfPhone').value.replace(/\D/g,'').slice(0,8);
 const email=$('betaProfEmail').value.trim().toLowerCase().slice(0,200);
 const status=$('betaProfileSaveStatus');
 const error=(message,id)=>{status.textContent=message;status.hidden=false;status.dataset.kind='error';if(id)$(id).focus()};
 if(name.length<2){error('Skriv inn hele navnet ditt.','betaProfName');return}
 if(!/^[49]\d{7}$/.test(phone)){error('Mobilnummer må ha 8 siffer og starte på 4 eller 9.','betaProfPhone');return}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error('Skriv inn en gyldig e-postadresse.','betaProfEmail');return}
 const current=demoContact||{};
 if(current.name===name&&current.phone===phone&&String(current.email||'').toLowerCase()===email){
  status.textContent='Opplysningene er allerede lagret på denne enheten.';
  status.hidden=false;status.dataset.kind='success';return;
 }
 const before=demoContact,save=$('betaProfileSave');
 save.disabled=true;save.textContent='Lagrer…';
 demoContact={name,phone,email};
 try{
  const ok=await syncBetaCustomer(); // One existing PATCH on explicit save, no customer GET.
  if(!ok){demoContact=before;error('Kunne ikke lagre i Firebase. Prøv igjen.');return}
  demoStore(DEMO_CONTACT_KEY,demoContact);
  $('demoFullName').value=name;$('demoPhone').value=phone;$('demoEmail').value=email;
  updateContactValidation();
  status.textContent='✓ Opplysningene er lagret.';
  status.hidden=false;status.dataset.kind='success';
  betaProfileRenderHome();
  if(betaBonusVisible())betaBonusStart(true);
 }catch(e){
  demoContact=before;error('Kunne ikke lagre opplysningene. Prøv igjen.');
 }finally{save.disabled=false;save.textContent='Lagre opplysninger'}
}
function betaProfileInit(){
 betaApplyTheme(betaReadTheme(),false);
 $('betaThemeToggle').addEventListener('click',()=>betaApplyTheme(document.documentElement.dataset.betaTheme==='dark'?'light':'dark'));
 $('betaProfileThemeToggle').addEventListener('click',()=>betaApplyTheme(document.documentElement.dataset.betaTheme==='dark'?'light':'dark'));
 $('betaCartThemeToggle').addEventListener('click',()=>betaApplyTheme(document.documentElement.dataset.betaTheme==='dark'?'light':'dark'));
 $('betaCartProfile').addEventListener('click',betaProfileOpen);
 $('betaCartCart').addEventListener('click',()=>checkoutNavigate('cart'));
 $('betaProfileNav').addEventListener('click',()=>betaProfileShowTab('home'));
 $('betaProfileCart').addEventListener('click',()=>{hideAll();showCart()});
 $('betaBonusRefresh').addEventListener('click',()=>{void betaBonusLoad(true)});
 $('betaBonusConsent').addEventListener('change',event=>{
  try{localStorage.setItem(betaBonusConsentKey(),String(event.target.checked))}catch{}
  betaBonusStatus('Valget er lagret lokalt. Varslinger er ikke aktivert i BETA ennå.');
 });
 $('btnProfile').addEventListener('click',()=>{$('betaProfileSheet').hidden?betaProfileOpen():betaProfileClose()});
 $('betaProfileClose').addEventListener('click',betaProfileClose);
 $('betaProfileHomeButton').addEventListener('click',()=>betaProfileShowTab('home'));
 $('betaProfileForm').addEventListener('submit',event=>{void betaProfileSaveContact(event)});
 $('betaProfileRestaurantInfo').addEventListener('click',event=>{
  if(event.target.closest('[data-beta-restaurant-refresh]'))void betaRestaurantRefresh();
 });
 $('betaProfileHome').addEventListener('click',event=>{
  const trigger=event.target.closest('[data-beta-profile-tab]');
  if(trigger)betaProfileShowTab(trigger.dataset.betaProfileTab);
 });
 window.addEventListener('storage',event=>{
  if(event.key===BETA_THEME_KEY)betaApplyTheme(betaReadTheme(),false);
  if(event.key===DEMO_CONTACT_KEY&&!$('betaProfileSheet').hidden){
   betaProfileRenderHome();
   betaBonusStart(true);
  }
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)betaBonusStop();
  else if(betaBonusVisible())betaBonusStart(false);
 });
}
betaProfileInit();
