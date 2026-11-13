/* BETA profile and theme: local-first, no Firebase reads or polling. */
'use strict';
const BETA_THEME_KEY='kol-beta-theme-v1';
function betaReadTheme(){
 try{return localStorage.getItem(BETA_THEME_KEY)==='dark'?'dark':'light'}catch{return 'light'}
}
function betaApplyTheme(theme,persist=true){
 const dark=theme==='dark';
 document.documentElement.dataset.betaTheme=dark?'dark':'light';
 for(const id of ['betaThemeToggle','betaProfileThemeToggle']){
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
/* Pizzabonus: one small GET per stored phone on first view.
 * Local cache is reused indefinitely until the customer presses Oppdater.
 * Never download the whole /customers node or read personal contact fields.
 */
const BETA_BONUS_CACHE_KEY='kol-beta-bonus-cache-v1';
const BETA_BONUS_CONSENT_KEY='kol-beta-bonus-consent-v1';
const betaBonusRequested=new Set();
let betaBonusPending=null;
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
async function betaBonusLoad(force=false){
 const phone=betaBonusPhone();
 if(!phone){
  betaBonusRender(0);
  betaBonusStatus('Lagre et mobilnummer for å hente pizzabonus.');
  return;
 }
 const cached=betaBonusCached(phone);
 if(cached)betaBonusRender(cached.count);
 if(betaBonusPending)return betaBonusPending;
 if(!force&&(cached||betaBonusRequested.has(phone)))return;
 betaBonusRequested.add(phone);
 $('betaBonusRefresh').disabled=true;
 betaBonusStatus('Oppdaterer pizzabonus…');
 betaBonusPending=(async()=>{
  try{
   const response=await fetch(BASE+'/customers/'+phone+'/bonusCount.json',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const amount=betaBonusValue(await response.json());
   try{localStorage.setItem(BETA_BONUS_CACHE_KEY,JSON.stringify({phone,count:amount,savedAt:Date.now()}))}catch{}
   if(betaBonusPhone()===phone){
    betaBonusRender(amount);
    betaBonusStatus('Oppdatert');
   }
  }catch(err){
   console.warn('BETA bonus read failed:',err);
   if(betaBonusPhone()===phone)betaBonusStatus('Kunne ikke hente pizzabonus. Prøv Oppdater.');
  }finally{
   $('betaBonusRefresh').disabled=false;
   betaBonusPending=null;
  }
 })();
 return betaBonusPending;
}
function betaBonusDisplayHome(){
 const phone=betaBonusPhone(),cache=betaBonusCached(phone);
 betaBonusRender(cache?.count??0);
 betaBonusConsentShow();
 betaBonusStatus(phone?(cache?'Lokalt lagret · Oppdater for ny status':''):'Lagre mobilnummer for å hente pizzabonus.');
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

function betaProfileRenderRestaurant(){
 const settings=menu?.settings||{};
 const names=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
 const days=Array.isArray(settings.weeklyHours)&&settings.weeklyHours.length===7?openingDays(settings):null;
 const rows=days?days.map((d,i)=>'<div class="beta-profile-hours-row"><span>'+names[i]+'</span><strong>'+(d.enabled?esc(d.open)+'–'+esc(d.close):'Stengt')+'</strong></div>').join(''):'<p>Åpningstidene vises når menyen er lastet.</p>';
 const address=String(settings.address||settings.restaurantAddress||'').trim();
 const phone=String(settings.phone||settings.restaurantPhone||'').trim();
 $('betaProfileRestaurantInfo').innerHTML='<div class="beta-profile-info-card"><h3>'+esc(settings.restaurantName||'KØL Grill & Pizza')+'</h3>'+
 (address?'<p>'+esc(address)+'</p>':'')+(phone?'<p>'+esc(phone)+'</p>':'')+'<h4>Åpningstider</h4>'+rows+'</div>';
}
function betaProfileShowTab(tab){
 const home=tab==='home',names={contact:'Rediger profil',orders:'Mine bestillinger',restaurant:'Restaurantinformasjon'};
 $('betaProfileHome').hidden=!home;$('betaProfileDetail').hidden=home;
 for(const name of Object.keys(names))$('betaProfile'+name[0].toUpperCase()+name.slice(1)+'Panel').hidden=tab!==name;
 if(home){betaProfileRenderHome();void betaBonusLoad(false)}
 else{
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
 }catch(e){
  demoContact=before;error('Kunne ikke lagre opplysningene. Prøv igjen.');
 }finally{save.disabled=false;save.textContent='Lagre opplysninger'}
}
function betaProfileInit(){
 betaApplyTheme(betaReadTheme(),false);
 $('betaThemeToggle').addEventListener('click',()=>betaApplyTheme(document.documentElement.dataset.betaTheme==='dark'?'light':'dark'));
 $('betaProfileThemeToggle').addEventListener('click',()=>betaApplyTheme(document.documentElement.dataset.betaTheme==='dark'?'light':'dark'));
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
 $('betaProfileHome').addEventListener('click',event=>{
  const trigger=event.target.closest('[data-beta-profile-tab]');
  if(trigger)betaProfileShowTab(trigger.dataset.betaProfileTab);
 });
 window.addEventListener('storage',event=>{
  if(event.key===BETA_THEME_KEY)betaApplyTheme(betaReadTheme(),false);
  if(event.key===DEMO_CONTACT_KEY&&!$('betaProfileSheet').hidden)betaProfileRenderHome();
 });
}
betaProfileInit();
