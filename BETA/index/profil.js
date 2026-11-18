/* FATIH1 profile and theme: local-first, no Firebase reads or polling. */
'use strict';
const FATIH1_THEME_STORAGE_KEY='kol-beta-theme-v1';
function fatih1ReadTheme(){
 try{return localStorage.getItem(FATIH1_THEME_STORAGE_KEY)==='dark'?'dark':'light'}catch{return 'light'}
}
function fatih1ApplyTheme(theme,persist=true){
 const dark=theme==='dark';
 document.documentElement.dataset.fatih1Theme=dark?'dark':'light';
 for(const id of ['fatih1ThemeToggle','fatih1ProfileThemeToggle','fatih1CartThemeToggle']){
  const button=$(id);
  if(!button)continue;
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',dark?'Bytt til lys modus':'Bytt til mørk modus');
  button.querySelector('.fatih1-theme-sun').hidden=dark;
  button.querySelector('.fatih1-theme-moon').hidden=!dark;
 }
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=dark?'#091f1b':'#133d32';
 if(persist){
  try{localStorage.setItem(FATIH1_THEME_STORAGE_KEY,dark?'dark':'light')}catch{}
  showFatih1Toast(dark?'Mørk modus er aktivert':'Lys modus er aktivert','info');
 }
}
function fatih1ProfileContact(){
 const current=customerContact||{};
 if(current.name||current.phone||current.email)return current;
 // DRAFT and FATIH1 share an origin; migrate its local contact only as a fallback.
 try{
  const old=JSON.parse(localStorage.getItem('bestill_profile_v2')||'null');
  if(old&&typeof old==='object')return {
   name:String(old.name||''),phone:String(old.phone||'').replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'').slice(0,8),
   email:String(old.email||'')
  };
 }catch{}
 return {name:'',phone:'',email:''};
}
function fatih1ProfileInitials(name){
 return String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('');
}
function fatih1ProfilePhoneNumber(phone){
 const d=String(phone||'').replace(/\D/g,'');
 return /^[49]\d{7}$/.test(d)?'+47 '+d.slice(0,2)+' '+d.slice(2,4)+' '+d.slice(4,6)+' '+d.slice(6):'Kundeprofil';
}
/* Pizzabonus: a single tiny RTDB REST/EventSource listener on the bonusCount leaf
 * ONLY while the profile bonus is visible. No Firebase SDK, no polling.
 * EventSource sends the initial value and any later change over one connection.
 * Local cache supplies immediate display during connection; manual refresh reconnects.
 */
const FATIH1_BONUS_STORAGE_KEY='kol-beta-bonus-cache-v1';
const FATIH1_BONUS_CONSENT_KEY='kol-beta-bonus-consent-v1';
let fatih1BonusSource=null,fatih1BonusSourcePhone='',fatih1BonusStreamId=0;
let fatih1BonusGetPending=null;
function fatih1BonusPhone(){
 const phone=String(fatih1ProfileContact().phone||'').replace(/\D/g,'').replace(/^47(?=\d{8}$)/,'');
 return /^[49]\d{7}$/.test(phone)?phone:'';
}
function fatih1BonusValue(value){
 return Math.min(10,Math.max(0,Math.floor(Number(value)||0)));
}
function fatih1BonusCached(phone){
 if(!phone)return null;
 try{
  const entry=JSON.parse(localStorage.getItem(FATIH1_BONUS_STORAGE_KEY)||'null');
  return entry&&entry.phone===phone&&Number.isInteger(entry.count)&&entry.count>=0?
   entry:null;
 }catch{return null}
}
function fatih1BonusRender(count){
 const earned=fatih1BonusValue(count);
 const pts=(radius,angle)=>[
  120+radius*Math.cos(angle*Math.PI/180),
  120+radius*Math.sin(angle*Math.PI/180)
 ];
 const segments=Array.from({length:10},(_,i)=>{
  const start=i*36-90+1.5,end=start+33;
  const a=pts(104,start),b=pts(104,end),c=pts(72,end),d=pts(72,start),pos=pts(88,start+16.5);
  return '<g class="fatih1-bonus-piece'+(i<earned?' earned':'')+'">'+
   '<path class="fatih1-bonus-wedge" d="M'+a.join(' ')+' A104 104 0 0 1 '+b.join(' ')+
   ' L'+c.join(' ')+' A72 72 0 0 0 '+d.join(' ')+'Z"/>'+
   '<g class="fatih1-bonus-pizza" transform="translate('+(pos[0]-10)+' '+(pos[1]-10)+')">'+
   '<path d="M4 3Q10-1 17 5L5 19Z M4 3Q10 1 16 6"/>'+
   '<circle cx="8" cy="7" r="1.2"/><circle cx="11" cy="10" r="1.2"/>'+
   '<circle cx="6.5" cy="13" r="1"/></g></g>';
 }).join('');
 $('fatih1BonusSegments').innerHTML=segments;
 $('fatih1BonusCount').textContent=earned;
 $('fatih1BonusRing').setAttribute('aria-label',earned+' av 10 pizzaer registrert');
 const remaining=10-earned;
 $('fatih1BonusRemaining').textContent=remaining?
  remaining+' '+(remaining===1?'pizza igjen':'pizzaer igjen')+' til din gratis pizza':
  'Du har opptjent en gratis pizza!';
}
function fatih1BonusStatus(message){
 $('fatih1BonusStatus').textContent=message||'';
}
function fatih1BonusConsentKey(){
 return FATIH1_BONUS_CONSENT_KEY+':'+(fatih1BonusPhone()||'local');
}
function fatih1BonusConsentShow(){
 try{$('fatih1BonusConsent').checked=localStorage.getItem(fatih1BonusConsentKey())==='true'}
 catch{$('fatih1BonusConsent').checked=false}
}
function fatih1BonusStop(){
 fatih1BonusStreamId++;
 if(fatih1BonusSource){fatih1BonusSource.close();fatih1BonusSource=null}
 fatih1BonusSourcePhone='';
}
function fatih1BonusVisible(){
 return !$('fatih1ProfileSheet').hidden&&!$('fatih1ProfileHome').hidden&&!document.hidden;
}
function fatih1BonusStore(phone,count){
 const amount=fatih1BonusValue(count);
 try{localStorage.setItem(FATIH1_BONUS_STORAGE_KEY,JSON.stringify({phone,count:amount,savedAt:Date.now()}))}catch{}
 if(fatih1BonusVisible()&&fatih1BonusPhone()===phone){
  fatih1BonusRender(amount);
  fatih1BonusStatus('Oppdatert automatisk');
 }
}
async function fatih1BonusGetOnce(phone){
 // Fallback for browsers without SSE support or if establishing the stream fails.
 if(fatih1BonusGetPending)return fatih1BonusGetPending;
 const task=(async()=>{
  try{
   const response=await fetch(BASE+'/customers/'+phone+'/bonusCount.json',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const value=await response.json();
   if(value!==null&&(!Number.isFinite(Number(value))||typeof value==='object'))throw Error('Invalid bonus data');
   if(fatih1BonusPhone()===phone){
    fatih1BonusStore(phone,value);
    fatih1BonusStatus('Oppdatert');
   }
  }catch(error){
   console.warn('BestillOnline bonus read failed:',error);
   if(fatih1BonusPhone()===phone&&fatih1BonusVisible())fatih1BonusStatus('Kunne ikke oppdatere pizzabonus. Trykk Oppdater.');
  }
 })();
 fatih1BonusGetPending=task;
 try{await task}finally{if(fatih1BonusGetPending===task)fatih1BonusGetPending=null}
}
function fatih1BonusStart(force=false){
 const phone=fatih1BonusPhone();
 if(!phone){
  fatih1BonusStop();
  fatih1BonusRender(0);
  fatih1BonusStatus('Lagre mobilnummer for å hente pizzabonus.');
  return;
 }
 if(!fatih1BonusVisible())return;
 if(!force&&fatih1BonusSource&&fatih1BonusSourcePhone===phone)return;
 fatih1BonusStop();
 if(typeof EventSource==='undefined'){
  fatih1BonusStatus('Henter pizzabonus…');
  void fatih1BonusGetOnce(phone);
  return;
 }
 const token=fatih1BonusStreamId,source=new EventSource(BASE+'/customers/'+phone+'/bonusCount.json');
 fatih1BonusSource=source;
 fatih1BonusSourcePhone=phone;
 fatih1BonusStatus('Kobler til pizzabonus…');
 const onData=event=>{
  if(fatih1BonusSource!==source||fatih1BonusStreamId!==token||fatih1BonusPhone()!==phone||!fatih1BonusVisible())return;
  try{
   const payload=JSON.parse(event.data);
   // bonusCount itself is a number; parent customer fields are never streamed.
   if(payload.path!=='/'&&payload.path!=='')return;
   const value=payload.data;
   if(value!==null&&(typeof value==='object'||!Number.isFinite(Number(value))))return;
   fatih1BonusStore(phone,value);
  }catch(error){console.warn('BestillOnline bonus stream event ignored:',error)}
 };
 source.addEventListener('put',onData);
 source.addEventListener('patch',onData);
 const denied=()=>{
  if(fatih1BonusSource!==source)return;
  fatih1BonusStop();
  fatih1BonusStatus('Tilgang til pizzabonus ble avvist.');
 };
 source.addEventListener('cancel',denied);
 source.addEventListener('auth_revoked',denied);
 source.addEventListener('error',()=>{
  if(fatih1BonusSource!==source)return;
  // EventSource normally reconnects on short network interruptions.
  // Do not create duplicate streams or periodic REST requests.
  if(source.readyState===2){
   fatih1BonusStop();
   fatih1BonusStatus('Live-tilkobling brutt. Trykk Oppdater.');
  }else{
   fatih1BonusStatus('Prøver å koble til pizzabonus igjen…');
  }
 });
}
function fatih1BonusLoad(force=false){
 fatih1BonusStart(force);
}
function fatih1BonusDisplayHome(){
 const phone=fatih1BonusPhone(),cache=fatih1BonusCached(phone);
 fatih1BonusRender(cache?.count??0);
 fatih1BonusConsentShow();
 fatih1BonusStatus(phone?(cache?'Lokalt lagret · kobler til live status':''):'Lagre mobilnummer for å hente pizzabonus.');
}
function fatih1ReadLocalOrders(){
 const key='bestillonline-orders-history-v1';
 let history=[];
 try{const stored=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(stored))history=stored}catch{}
 // Older customer sessions only saved the latest order.
 if(localOrder?.id&&!history.some(item=>item?.id===localOrder.id)){
  history.unshift({
   id:localOrder.id,createdAt:localOrder.createdAt,
   status:localOrder.statusPublic?.status||localOrder.status,
   expectedReadyAt:localOrder.statusPublic?.expectedReadyAt||0,
   pickupLabel:localOrder.pickup?.label||'Snarest',
   pickupMode:localOrder.pickup?.mode||'asap',
   pickupTime:localOrder.pickup?.time||'',
   total:localOrder.total,
   items:localOrder.items
  });
 }
 return history.filter(item=>item&&typeof item.id==='string').sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,30);
}
function fatih1ProfileRenderHome(){
 const c=fatih1ProfileContact(),name=String(c.name||'').trim(),avatar=fatih1ProfileInitials(name);
 $('fatih1ProfileName').textContent=name||'Min profil';
 $('fatih1ProfilePhone').textContent=fatih1ProfilePhoneNumber(c.phone);
 $('fatih1ProfileInitials').textContent=avatar||'👤';
 $('fatih1ProfileContactMeta').textContent=(name||c.phone)?(c.email?'Navn, mobilnummer og e-post lagret':'Navn og mobilnummer lagret'):'Navn, mobilnummer og e-post';
 const count=fatih1ReadLocalOrders().length;
 $('fatih1ProfileOrdersMeta').textContent=count?count+' bestilling'+(count===1?'':'er')+' lagret på enheten':'Ingen lagrede bestillinger';
 fatih1BonusDisplayHome();
}
function fatih1ProfileRenderOrders(){
 const host=$('fatih1ProfileOrders');
 const orders=fatih1ReadLocalOrders();
 if(!orders.length){host.innerHTML='<p class="fatih1-profile-empty">Ingen bestillinger lagret på denne enheten.</p>';return}
 const labels={mottatt:'Venter på godkjenning',godkjent:'Bekreftet',klar:'Klar til henting',avvist:'Avvist'};
 host.innerHTML=orders.map(order=>{
  const current=localOrder?.id===order.id?localOrder:order;
  const state=current.statusPublic?.status||current.status||'mottatt';
  const items=Array.isArray(current.items)?current.items:[];
  const created=new Date(Number(current.createdAt)||0);
  const day=Number.isFinite(created.getTime())&&created.getTime()>0?
   new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'short',year:'numeric'}).format(created):'';
  const pickupRecord=current.pickup||{mode:current.pickupMode,time:current.pickupTime};
  const statusRecord=current.statusPublic||{expectedReadyAt:current.expectedReadyAt};
  const ready=typeof visiblePickupAt==='function'?visiblePickupAt({pickup:pickupRecord,statusPublic:statusRecord}):Number(statusRecord.expectedReadyAt)||0;
  const readyLabel=ready&&state==='godkjent'?'Henting kl. '+new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(new Date(ready)):'';
  return '<article class="fatih1-profile-order-card">'+
   '<div class="fatih1-profile-order-head"><strong>#'+esc(String(order.id).slice(-6).toUpperCase())+'</strong><span>'+esc(day)+'</span></div>'+
   '<p><strong>'+esc(labels[state]||state)+'</strong>'+(readyLabel?' · '+esc(readyLabel):'')+'</p>'+
   '<p>'+items.map(item=>esc((Number(item.qty)||1)+' × '+String(item.name||''))).join(' · ')+'</p>'+
   '<div><span>'+esc(String(current.pickup?.label||current.pickupLabel||'Snarest'))+'</span><strong>'+money(current.total)+'</strong></div></article>';
 }).join('');
}

/* Restaurantinformasjon: ONLY menu.settings, already fetched from /settings.
 * Opening profile performs no Firebase requests. Manual refresh reads only
 * /settings.json and updates the existing menu cache (no duplicate settings).
 */
let fatih1RestaurantLoading=null,fatih1RestaurantMessage='';
function fatih1RestaurantText(value){
 return String(value||'').trim();
}
function fatih1RestaurantCleanHref(raw){
 try{
  const u=new URL(String(raw||'').trim());
  if(u.protocol==='https:'||u.protocol==='http:')return u.href;
 }catch{}
 return '';
}
function fatih1RestaurantIcons(name){
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
function fatih1RestaurantRow(icon,label,value,href='',action=''){
 if(!value)return '';
 const a=href?'<a href="'+esc(href)+'" target="'+(href.startsWith('http')?'_blank':'_self')+'"'+(href.startsWith('http')?' rel="noopener noreferrer"':'')+' class="fatih1-restaurant-row-action">'+esc(action||'Åpne')+' <span aria-hidden="true">↗</span></a>':'';
 return '<div class="fatih1-restaurant-fact"><span class="fatih1-restaurant-icon">'+fatih1RestaurantIcons(icon)+'</span>'+
 '<div class="fatih1-restaurant-fact-copy"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>'+a+'</div>';
}
function fatih1ProfileRenderRestaurant(){
 const settings=menu?.settings||{};
 const restaurant=fatih1RestaurantText(settings.restaurantName)||'BestillOnline';
 const addressParts=[settings.streetAddress||settings.address,settings.postalCode,settings.city].map(fatih1RestaurantText).filter(Boolean);
 const address=addressParts.join(', '),phone=fatih1RestaurantText(settings.phone).replace(/[^\d+ ]/g,'');
 const phoneDigits=phone.replace(/\D/g,'');
 const tel=phoneDigits.length===8?'+47'+phoneDigits:phoneDigits.length===10&&phoneDigits.startsWith('47')?'+'+phoneDigits:'';
 const email=fatih1RestaurantText(settings.email);
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';
 const hourList=Array.isArray(settings.weeklyHours)&&settings.weeklyHours.length===7?openingDays(settings):null;
 const weekdays=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
 const current=typeof osloTime==='function'?osloTime():{day:-1};
 const state=hourList&&typeof calculateHoursStatus==='function'?calculateHoursStatus(settings,current):null;
 const hours=hourList?hourList.map((day,index)=>{
  const hoursText=day.enabled?esc(day.open)+' – '+esc(day.close):'Stengt';
  return '<div class="fatih1-restaurant-hours-row'+(index===current.day?' is-today':'')+'"><span>'+weekdays[index]+(index===current.day?'<small>I dag</small>':'')+'</span><strong>'+hoursText+'</strong></div>';
 }).join(''):'<p class="fatih1-restaurant-empty">Åpningstider er ikke registrert.</p>';
 const status=state?(state.open?'Åpent nå':state.preOpen?'Forhåndsbestilling':'Stengt nå'):'Åpningstider';
 const statusCls=state?(state.open?' is-open':state.preOpen?' is-preorder':' is-closed'):'';
 const statusNote=state?state.pill:'Se åpningstider nedenfor';
 const map=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
 const website=fatih1RestaurantCleanHref(settings.website);
 const insta=fatih1RestaurantCleanHref(settings.instagram);
 const facebook=fatih1RestaurantCleanHref(settings.facebook);
 const pickup=fatih1RestaurantText(settings.pickupInfo)||'Henting i restauranten';
 const payment=fatih1RestaurantText(settings.paymentInfo);
 const description=fatih1RestaurantText(settings.description);
 const meta=[fatih1RestaurantText(settings.city),'Takeaway'].filter(Boolean).join(' · ');
 const facts=[
  fatih1RestaurantRow('pin','Adresse',address,map,'Kart'),
  fatih1RestaurantRow('phone','Telefon',phone,tel?'tel:'+tel:'','Ring'),
  fatih1RestaurantRow('mail','E-post',validEmail,validEmail?'mailto:'+validEmail:'','Skriv'),
 ].filter(Boolean).join('');
 const other=fatih1RestaurantRow('bag','Henting',pickup)+fatih1RestaurantRow('card','Betaling',payment);
 const links=[
  website?'<a target="_blank" rel="noopener noreferrer" href="'+esc(website)+'">'+fatih1RestaurantIcons('globe')+' Nettside</a>':'',
  insta?'<a target="_blank" rel="noopener noreferrer" href="'+esc(insta)+'">Instagram ↗</a>':'',
  facebook?'<a target="_blank" rel="noopener noreferrer" href="'+esc(facebook)+'">Facebook ↗</a>':''
 ].filter(Boolean).join('');
 const host=$('fatih1ProfileRestaurantInfo');
 host.innerHTML='<div class="fatih1-restaurant-hero"><div class="fatih1-restaurant-logo">'+fatih1RestaurantIcons('shop')+'</div>'+
 '<div class="fatih1-restaurant-hero-copy"><small>RESTAURANTINFORMASJON</small><h3>'+esc(restaurant)+'</h3><p>'+esc(meta)+'</p></div></div>'+
 (description?'<p class="fatih1-restaurant-description">'+esc(description)+'</p>':'')+
 '<div class="fatih1-restaurant-status'+statusCls+'"><span class="fatih1-restaurant-status-dot" aria-hidden="true"></span><div><strong>'+esc(status)+'</strong><small>'+esc(statusNote)+'</small></div></div>'+
 '<section class="fatih1-restaurant-card"><h3>Kontakt og adresse</h3>'+
 (facts||'<p class="fatih1-restaurant-empty">Kontaktinformasjon er ikke registrert ennå.</p>')+'</section>'+
 '<section class="fatih1-restaurant-card"><div class="fatih1-restaurant-section-title"><h3>Åpningstider</h3><span>Europe/Oslo</span></div><div class="fatih1-restaurant-hours">'+hours+'</div></section>'+
 '<section class="fatih1-restaurant-card"><h3>Bestilling og henting</h3>'+other+'</section>'+
 (links?'<div class="fatih1-restaurant-links">'+links+'</div>':'')+
 '<div class="fatih1-restaurant-sync"><p id="fatih1RestaurantStatus" role="status">'+esc(fatih1RestaurantMessage||'Viser lagret restaurantinformasjon')+'</p>'+
 '<button id="fatih1RestaurantRefresh" type="button" data-fatih1-restaurant-refresh>'+fatih1RestaurantIcons('refresh')+' Oppdater informasjon</button></div>';
}
async function fatih1RestaurantRefresh(){
 if(fatih1RestaurantLoading)return fatih1RestaurantLoading;
 const task=(async()=>{
  fatih1RestaurantMessage='Oppdaterer fra settings…';
  fatih1ProfileRenderRestaurant();
  try{
   const response=await fetch(BASE+'/settings.json',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ugyldig settings-format');
   if(!menu)throw Error('Menyen er ikke lastet');
   menu.settings=data;
   await localPut(menu);
   updateRestaurantBrand();
   updateHoursStatus();
   fatih1RestaurantMessage='Oppdatert fra settings · lagret på enheten';
   showFatih1Toast('Restaurantinformasjonen er oppdatert');
  }catch(error){
   console.warn('BestillOnline restaurant settings refresh failed:',error);
   fatih1RestaurantMessage='Kunne ikke oppdatere. Viser lagret informasjon.';
   showFatih1Toast('Kunne ikke oppdatere restaurantinformasjonen','error');
  }finally{
   if(!$('fatih1ProfileRestaurantPanel').hidden)fatih1ProfileRenderRestaurant();
  }
 })();
 fatih1RestaurantLoading=task;
 try{return await task}finally{fatih1RestaurantLoading=null}
}
function fatih1ProfileShowTab(tab){
 if(!$('fatih1ProfileSheet').hidden)fatih1HistoryWrite({view:'profile',tab});
 const home=tab==='home',names={contact:'Rediger profil',orders:'Mine bestillinger',restaurant:'Restaurantinformasjon'};
 $('fatih1ProfileHome').hidden=!home;$('fatih1ProfileDetail').hidden=home;
 for(const name of Object.keys(names))$('fatih1Profile'+name[0].toUpperCase()+name.slice(1)+'Panel').hidden=tab!==name;
 if(home){fatih1ProfileRenderHome();fatih1BonusStart(false)}
 else{
  fatih1BonusStop();
  $('fatih1ProfileDetailTitle').textContent=names[tab]||'Min profil';
  if(tab==='contact'){
   const c=fatih1ProfileContact();
   $('fatih1ProfName').value=c.name||'';
   $('fatih1ProfPhone').value=c.phone||'';
   $('fatih1ProfEmail').value=c.email||'';
   $('fatih1ProfileSaveStatus').hidden=true;
  }else if(tab==='orders')fatih1ProfileRenderOrders();
  else if(tab==='restaurant')fatih1ProfileRenderRestaurant();
 }
 $('fatih1ProfileScroll').scrollTop=0;
}
function fatih1ProfileOpen(){
 hideAll();
 show('fatih1ProfileSheet');
 $('btnProfile').setAttribute('aria-expanded','true');
 fatih1ProfileShowTab('home');
 const count=cart.reduce((n,line)=>n+(Number(line.qty)||0),0);
 $('fatih1ProfileCartCount').hidden=!count;
 $('fatih1ProfileCartCount').textContent=count;
 $('fatih1ProfileClose').focus();
}
function fatih1ProfileClose(){
 fatih1HistoryToMenu();
 $('btnProfile').focus();
}
async function fatih1ProfileSaveContact(event){
 event.preventDefault();
 const name=$('fatih1ProfName').value.trim().replace(/\s+/g,' ').slice(0,120);
 const phone=$('fatih1ProfPhone').value.replace(/\D/g,'').slice(0,8);
 const email=$('fatih1ProfEmail').value.trim().toLowerCase().slice(0,200);
 const status=$('fatih1ProfileSaveStatus');
 const error=(message,id)=>{status.textContent=message;status.hidden=false;status.dataset.kind='error';if(id)$(id).focus()};
 if(name.length<2){error('Skriv inn hele navnet ditt.','fatih1ProfName');return}
 if(!/^[49]\d{7}$/.test(phone)){error('Mobilnummer må ha 8 siffer og starte på 4 eller 9.','fatih1ProfPhone');return}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error('Skriv inn en gyldig e-postadresse.','fatih1ProfEmail');return}
 const current=customerContact||{};
 if(current.name===name&&current.phone===phone&&String(current.email||'').toLowerCase()===email&&fatih1ContactIsSynced({name,phone,email})){
  status.textContent='Opplysningene er allerede lagret på denne enheten.';
  status.hidden=false;status.dataset.kind='success';return;
 }
 const before=customerContact,save=$('fatih1ProfileSave');
 save.disabled=true;save.textContent='Lagrer…';
 customerContact={name,phone,email};
 try{
  const result=await syncFatih1Customer(); // Only changed contact fields go to Firebase.
  if(!result){customerContact=before;error('Kunne ikke lagre i Firebase. Prøv igjen.');return}
  $('draftFullName').value=name;$('draftPhone').value=phone;$('draftEmail').value=email;
  updateContactValidation();
  status.textContent=result==='saved'?'✓ Opplysningene er lagret i Firebase.':'Opplysningene er allerede lagret.';
  status.hidden=false;status.dataset.kind='success';
  if(result==='saved')showFatih1Toast('Profilen er oppdatert i Firebase');
  fatih1ProfileRenderHome();
  if(fatih1BonusVisible())fatih1BonusStart(true);
 }catch(e){
  customerContact=before;error('Kunne ikke lagre opplysningene. Prøv igjen.');
 }finally{save.disabled=false;save.textContent='Lagre opplysninger'}
}
function fatih1ProfileInit(){
 fatih1ApplyTheme(fatih1ReadTheme(),false);
 $('fatih1ThemeToggle').addEventListener('click',()=>fatih1ApplyTheme(document.documentElement.dataset.fatih1Theme==='dark'?'light':'dark'));
 $('fatih1ProfileThemeToggle').addEventListener('click',()=>fatih1ApplyTheme(document.documentElement.dataset.fatih1Theme==='dark'?'light':'dark'));
 $('fatih1CartThemeToggle').addEventListener('click',()=>fatih1ApplyTheme(document.documentElement.dataset.fatih1Theme==='dark'?'light':'dark'));
 $('fatih1CartProfile').addEventListener('click',fatih1ProfileOpen);
 $('fatih1CartCart').addEventListener('click',()=>checkoutNavigate('cart'));
 $('fatih1ProfileNav').addEventListener('click',()=>fatih1HistoryBack());
 $('fatih1ProfileCart').addEventListener('click',()=>{hideAll();showCart()});
 $('fatih1BonusRefresh').addEventListener('click',()=>{void fatih1BonusLoad(true);showFatih1Toast('Oppdaterer pizzabonus…','info')});
 $('fatih1BonusConsent').addEventListener('change',event=>{
  try{localStorage.setItem(fatih1BonusConsentKey(),String(event.target.checked))}catch{}
  fatih1BonusStatus('Valget er lagret lokalt. Varslinger er ikke aktivert i FATIH1 ennå.');
  showFatih1Toast('Valget er lagret på denne enheten','info');
 });
 $('btnProfile').addEventListener('click',()=>{$('fatih1ProfileSheet').hidden?fatih1ProfileOpen():fatih1ProfileClose()});
 $('fatih1ProfileClose').addEventListener('click',fatih1ProfileClose);
 $('fatih1ProfileBrandHome').addEventListener('click',returnToMenu);
 $('fatih1ProfileHomeButton').addEventListener('click',()=>fatih1HistoryBack());
 $('fatih1ProfileForm').addEventListener('submit',event=>{void fatih1ProfileSaveContact(event)});
 $('fatih1ProfileRestaurantInfo').addEventListener('click',event=>{
  if(event.target.closest('[data-fatih1-restaurant-refresh]'))void fatih1RestaurantRefresh();
 });
 $('fatih1ProfileHome').addEventListener('click',event=>{
  const trigger=event.target.closest('[data-fatih1-profile-tab]');
  if(trigger)fatih1ProfileShowTab(trigger.dataset.fatih1ProfileTab);
 });
 window.addEventListener('storage',event=>{
  if(event.key===FATIH1_THEME_STORAGE_KEY)fatih1ApplyTheme(fatih1ReadTheme(),false);
  if(event.key===FATIH1_CONTACT_STORAGE_KEY&&!$('fatih1ProfileSheet').hidden){
   fatih1ProfileRenderHome();
   fatih1BonusStart(true);
  }
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)fatih1BonusStop();
  else if(fatih1BonusVisible())fatih1BonusStart(false);
 });
}
fatih1ProfileInit();
