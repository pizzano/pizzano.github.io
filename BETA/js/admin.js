import {config} from './config.js?v=20261021-beta17';
import {catalog,loadCatalog,catalogReady,startCatalogSync,stopCatalogSync} from './catalog.js?v=20261021-beta17';
import {getAdminSession,watchAdminOrders,updateAdminOrder,deleteOldOrders} from './orders.js?v=20261021-beta17';
import {printKitchenTicket,checkEpsonConnection} from './printer.js?v=20261021-beta15';
const $=id=>document.getElementById(id);
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(Number(n)||0)+' kr';
const date=n=>n?new Date(n).toLocaleString('nb-NO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const time=n=>n?new Date(n).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'}):'—';
const labels={mottatt:'Ny',bekreftet:'Bekreftet',klar:'Klar for henting',utlevert:'Utlevert',fullfort:'Fullført',avvist:'Avvist'};
let session=null,unsubscribe=null,filter='all',selected=null,audio=null;
let orders=new Map(),toastTimer=0,alarmTimer=0,maintenanceTimer=0;
let activeTx=new Set(),expirationBusy=new Set();
let soundEnabled=false,cleanupBusy=false,initialLoad=true,lastCleanupAt=0;
const printKey='beta:printed:'+config.tenantId+':';
function showToast(message){const box=$('toast');box.textContent=message;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,5500);}
function setConnection(message,type=''){const n=$('connection');n.textContent=message;n.className='connection '+type;}
function sortedOrders(){return [...orders.values()].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));}
function filteredOrders(){
 const q=$('searchInput').value.trim().toLocaleLowerCase('nb-NO');
 return sortedOrders().filter(o=>(filter!=='scheduled'||o.pickupMode==='scheduled')&&(!q||
  [o.id,o.customerName,o.phone,o.email].some(x=>String(x||'').toLocaleLowerCase('nb-NO').includes(q))));
}
function isExpired(o){return o.status==='mottatt'&&Date.now()>Number(o.confirmationDeadline||0);}
function remaining(n){const v=Math.max(0,Math.ceil((Number(n||0)-Date.now())/1000)),mins=Math.floor(v/60);return String(mins).padStart(2,'0')+':'+String(v%60).padStart(2,'0');}
function pickup(o){
 if(o.pickupMode==='scheduled')return 'PLANLAGT '+(o.scheduledPickupAt?time(o.scheduledPickupAt):(o.pickup||'—'));
 return 'SNAREST '+(o.status==='mottatt'?'venter':(o.estimatedReadyAt?time(o.estimatedReadyAt):''));
}
function renderList(){
 const arr=filteredOrders(),all=sortedOrders();
 const fresh=all.filter(o=>o.status==='mottatt'&&!isExpired(o)).length;
 $('orderCount').textContent=all.length;$('newCount').textContent=fresh;
 $('newBadge').hidden=!fresh;$('newBadge').textContent=fresh;
 $('newAlert').hidden=!fresh;
 $('newAlert').textContent=fresh===1?'● Ny bestilling venter på svar':'● '+fresh+' nye bestillinger venter på svar';
 $('printerDot').hidden=!all.some(o=>o.status==='mottatt'&&!isExpired(o));
 const node=$('orderList');
 node.innerHTML=arr.length?arr.map(o=>{
  const expired=isExpired(o),isNew=o.status==='mottatt'&&!expired;
  const state=expired?'avvist':o.status;
  const smsSent=o.notification?.sms==='sent',emailSent=o.notification?.email==='sent';
  return '<button class="order-row '+(o.id===selected?'selected ':'')+(isNew?'is-new':'')+
   '" type="button" data-order="'+e(o.id)+'" aria-label="Bestilling fra '+e(o.customerName||'Kunde')+'">'+
   '<span class="order-status-dot '+e(state)+'"></span>'+
   '<div class="order-row-content"><div class="order-row-top"><span class="order-row-name">'+e(o.customerName||'Kunde')+'</span>'+
    (smsSent?'<span class="mini-receipt" title="SMS bekreftet sendt">✉</span>':'')+
    (emailSent?'<span class="mini-receipt" title="E-post bekreftet sendt">✉</span>':'')+
    (isNew?'<span class="pill mottatt">Ny</span>':'')+
   '</div><div class="order-row-bottom"><div class="order-row-meta">'+
   '<span class="pickup-chip '+(o.pickupMode==='scheduled'?'scheduled':'')+'">'+e(o.pickupMode==='scheduled'?'PLANLAGT':'SNAREST')+'</span>'+
   '<span class="row-clock">'+(isNew?'<b data-countdown="'+e(o.id)+'">'+remaining(o.confirmationDeadline)+'</b>':e(date(o.createdAt)))+'</span></div>'+
   '<strong class="order-price">'+money(o.total)+'</strong><span class="order-chevron">›</span></div></div></button>';
 }).join(''):'<div class="empty-list">Ingen bestillinger i dette utvalget.</div>';
 if(!arr.some(o=>o.id===selected))selected=arr[0]?.id||null;
 if(selected)renderDetail();else{$('orderDetail').hidden=true;$('detailEmpty').hidden=false;}
}
function expectedPrice(order){
 if(!catalogReady())return {valid:false,reason:'Menyen er ikke tilgjengelig. Kan ikke bekrefte pris.'};
 let total=0;
 for(const line of order.lines||[]){
  const p=catalog.categories.flatMap(c=>c.products).find(x=>x.id===line.itemId);
  if(!p||p.soldOut)return {valid:false,reason:'Ukjent eller utsolgt produkt: '+String(line.name||'')};
  const size=p.sizes.find(x=>x.id===line.sizeId);
  if(!size)return {valid:false,reason:'Ugyldig størrelse: '+p.name};
  const attached=[...new Set([...(p.optionGroupIds||[]),...(size.optionGroupIds||[])])];
  let unit=Number(size.price);
  if(!Number.isFinite(unit))return {valid:false,reason:'Ugyldig produktpris.'};
  const choices=new Map((line.options||[]).map(x=>[String(x.groupId)+'|'+String(x.id),x]));
  for(const groupId of attached){
   const g=catalog.optionGroups[groupId];
   if(!g)return {valid:false,reason:'Valggruppe mangler.'};
   const chosen=[...choices.keys()].filter(key=>key.startsWith(groupId+'|'));
   if(chosen.length<Number(g.min||0)||chosen.length>Number(g.max||99))
    return {valid:false,reason:'Valggruppen er ikke gyldig: '+g.title};
   for(const key of chosen){
    const opt=g.options.find(x=>key===groupId+'|'+x.id);
    if(!opt)return {valid:false,reason:'Ugyldig ekstra-valg.'};
    unit+=Number(opt.price)||0;choices.delete(key);
   }
  }
  if(choices.size)return {valid:false,reason:'Ukjente ekstra-valg i bestillingen.'};
  const qty=Number(line.quantity);
  if(!Number.isInteger(qty)||qty<1||qty>20)return {valid:false,reason:'Ugyldig antall.'};
  const lineAmount=Math.round(unit*qty*100)/100;
  if(Math.abs(lineAmount-Number(line.price))>.01)return {valid:false,reason:'Ulik pris på '+p.name+'.'};
  total+=lineAmount;
 }
 if(!order.lines?.length||Math.abs(total-Number(order.total))>.01)return {valid:false,reason:'Totalsummen stemmer ikke med menyen.'};
 return {valid:true,total};
}
function noteStatus(o){
 const sms=o.notification?.sms||'not_configured',email=o.notification?.email||'not_configured';
 const display=s=>({sent:'Sendt',failed:'Feilet',pending:'Venter',not_configured:'Ingen sendetjeneste tilkoblet'})[s]||'Ikke bekreftet';
 return 'SMS: '+display(sms)+' · E-post: '+display(email);
}
function emailDraft(o){
 const items=(o.lines||[]).map(x=>String(x.quantity)+' × '+x.name+' ('+x.size+')').join('\n');
 return 'Hei '+o.customerName+'!\n\nBestillingen er '+(o.status==='bekreftet'?'bekreftet.':'mottatt.')+
 '\nForventet hentetid: '+pickup(o)+'\n\n'+items+'\n\nTotalt: '+money(o.total)+
 '\n\n'+config.restaurant.name;
}
function smsDraft(o){
 return 'Hei '+o.customerName+'! Din bestilling hos '+config.restaurant.name+
 ' er bekreftet. Forventet hentetid: '+pickup(o)+'.';
}
function renderDetail(){
 const o=orders.get(selected);
 if(!o){$('detailEmpty').hidden=false;$('orderDetail').hidden=true;return;}
 $('detailEmpty').hidden=true;$('orderDetail').hidden=false;
 const expired=isExpired(o),check=expectedPrice(o),isNew=o.status==='mottatt'&&!expired;
 const displayAt=Number(o.estimatedReadyAt||o.scheduledPickupAt)||0;
 const printDone=localStorage.getItem(printKey+o.id)==='1';
 const notify=o.notification||{};
 const displayNotification=(kind,text)=>{
  const state=notify[kind];
  return '<span class="notification-chip '+(state==='sent'?'sent':'unsent')+'">'+
   (state==='sent'?'✓ ':'○ ')+text+(state==='sent'?' sendt':state==='failed'?' feilet':state==='pending'?' venter':' ikke bekreftet')+'</span>';
 };
 const productLines=(o.lines||[]).map(line=>{
  const choices=(Array.isArray(line.options)?line.options:[]).map(x=>
   e((x.groupTitle?x.groupTitle+': ':'')+(x.description||x.label||x.id))).join(' · ');
  const extras=[line.size,choices,
   Array.isArray(line.removedIngredients)&&line.removedIngredients.length?'Uten: '+line.removedIngredients.join(', '):'',
   line.comment?'Kommentar: '+line.comment:''].filter(Boolean).map(e).join('<br>');
  return '<div class="ordered-product"><span class="item-qty">'+e(line.quantity)+'×</span>'+
    '<div class="item-description"><strong>'+e(line.name)+'</strong><p>'+extras+'</p></div>'+
    '<strong class="item-cost">'+money(line.price)+'</strong></div>';
 }).join('');
 let footer='';
 if(isNew){
  footer='<div class="footer-pickup">'+(o.pickupMode==='scheduled'?
    '<label>Hentetid <input class="time-input" id="acceptTime" type="time" value="'+e(o.pickup)+'"></label>':
    '<label>SNAREST · minutter <input class="action-input" id="minutesInput" type="number" min="5" max="180" value="'+e(String(config.restaurant.pickupMinutes||25))+'"></label>')+
   '</div><div class="footer-actions"><button class="danger" data-action="reject">Avvis</button>'+
   '<button class="primary main-action" data-action="accept" '+(!check.valid?'disabled':'')+'>✓ Godta bestilling</button></div>';
 }else if(o.status==='bekreftet'){
  footer='<button class="outline-print" data-action="print">▣ Skriv ut på nytt</button>'+
   '<div class="footer-pickup"><span class="footer-pickup-label">'+e(pickup(o))+'</span>'+
   '<label>Ny hentetid <input class="time-input" id="changeTime" type="time" value="'+e(displayAt?time(displayAt):'')+'"></label>'+
   '<button class="secondary" data-action="change">Endre tid</button></div>'+
   '<button class="primary main-action" data-action="ready">✓ Marker klar for henting</button>';
 }else if(o.status==='klar'){
  footer='<button class="outline-print" data-action="print">▣ Skriv ut på nytt</button>'+
   '<span class="footer-pickup-label">KLAR FOR HENTING</span>'+
   '<button class="primary main-action" data-action="delivered">✓ Utlevert</button>';
 }else{
  footer='<button class="outline-print" data-action="print">▣ Skriv ut på nytt</button>'+
   '<span class="pill '+e(o.status)+'">'+e(expired?'Frist utløpt':labels[o.status]||o.status)+'</span>';
 }
 $('orderDetail').innerHTML='<div class="detail">'+
  '<div class="detail-body"><section class="order-hero">'+
   '<div class="hero-content"><h2>'+e(o.customerName||'Kunde')+'</h2>'+
   '<p>Bestillingskode <strong>#'+e(o.id.slice(-8).toUpperCase())+'</strong></p>'+
   '<div class="notification-chips">'+displayNotification('sms','SMS')+displayNotification('email','E-post')+'</div>'+
   '</div><div class="hero-bag" aria-hidden="true">♧</div></section>'+
  '<section class="order-info-strip">'+
   '<div class="info-unit"><span class="round-icon">◷</span><div><small>Mottatt</small><strong>'+e(date(o.createdAt))+'</strong></div></div>'+
   '<div class="info-unit"><span class="round-icon">☎</span><div><small>Telefonnummer</small><strong>'+e(o.phone||'—')+'</strong></div></div>'+
   '<span class="pill '+e(expired?'avvist':o.status)+'">'+e(expired?'Frist utløpt':labels[o.status]||o.status)+'</span></section>'+
  '<div class="items-heading"><h3>Bestilte varer</h3><span>'+(o.lines||[]).reduce((n,l)=>n+(Number(l.quantity)||0),0)+' varer</span></div>'+
  '<section class="ordered-products">'+productLines+'</section>'+
  '<div class="order-total-line"><span>Totalt</span><strong>'+money(o.total)+'</strong></div>'+
  (isNew?'<div class="answer-countdown">Ny bestilling – svar innen <strong data-countdown="'+e(o.id)+'">'+remaining(o.confirmationDeadline)+'</strong></div>':'')+
  (expired?'<p class="warn">Svarfristen er utløpt. Bestillingen kan ikke godtas.</p>':'')+
  (!check.valid?'<p class="warn">Kontroller pris før godkjenning: '+e(check.reason)+'</p>':'')+
  '<details class="order-extra-tools"><summary>Kontakt, varslingsstatus og skriverinnstillinger</summary>'+
  '<p class="helper">'+e(noteStatus(o))+' · Åpning av SMS/e-post er ikke bekreftet sending.</p>'+
  '<div class="button-row"><button data-action="sms">Åpne SMS</button><button data-action="email" '+(!o.email?'disabled':'')+'>Åpne e-postkvittering</button></div>'+
  '<p class="helper">Epson: '+(printDone?'Utskrift bekreftet på denne enheten.':'Ingen bekreftet utskrift på denne enheten.')+'</p>'+
  '<div class="button-row"><label>Skriver-IP <input class="time-input" id="printerHost" value="'+e(localStorage.getItem('beta:printer:host')||'192.168.1.25')+'" placeholder="192.168.1.25"></label>'+
  '<button data-action="save-printer">Lagre skriver</button><button data-action="check-printer">Test skriver</button></div></details>'+
  '</div><footer class="order-footer">'+footer+'</footer></div>';
}
function stopAlarm(){if(alarmTimer){clearInterval(alarmTimer);alarmTimer=0;}}
function beep(){
 if(!soundEnabled||!audio)return;
 try{
  const t=audio.currentTime;
  for(let i=0;i<3;i++){
   const osc=audio.createOscillator(),gain=audio.createGain();
   osc.frequency.value=i===2?880:670;osc.type='sine';
   gain.gain.setValueAtTime(0.0001,t+i*.22);
   gain.gain.exponentialRampToValueAtTime(.16,t+i*.22+.02);
   gain.gain.exponentialRampToValueAtTime(.0001,t+i*.22+.17);
   osc.connect(gain);gain.connect(audio.destination);osc.start(t+i*.22);osc.stop(t+i*.22+.18);
  }
 }catch(err){console.warn(err);}
}
function refreshAlarm(){
 const pending=sortedOrders().some(o=>o.status==='mottatt'&&!isExpired(o));
 if(!pending){stopAlarm();return;}
 if(!alarmTimer){beep();alarmTimer=setInterval(()=>{
  if(document.hidden||!sortedOrders().some(o=>o.status==='mottatt'&&!isExpired(o))){stopAlarm();return;}
  beep();
 },9000);}
}
function reconnect(){
 unsubscribe?.();unsubscribe=null;orders=new Map();selected=null;initialLoad=true;
 if(!session||document.hidden)return;
 setConnection('Kobler til Firebase…');
 unsubscribe=watchAdminOrders(session,(operation,id,value)=>{
  if(operation==='remove')orders.delete(id);
  else if(value)orders.set(id,value);
  renderList();
  refreshAlarm();
  if(initialLoad){initialLoad=false;return;}
  if(operation==='upsert'&&value?.status==='mottatt'&&!document.hidden)refreshAlarm();
  if(orders.size>=100&&Date.now()-lastCleanupAt>600000)void maintain();
 },error=>{setConnection('Firebase: '+error.message,'error');showToast('Firebase-lesing ble avvist. Sjekk sikkerhetsreglene.');});
 setConnection('Firebase tilkoblet','connected');
}
async function expirySweep(){
 if(!session||document.hidden)return;
 for(const o of sortedOrders().filter(isExpired).slice(0,5)){
  if(expirationBusy.has(o.id))continue;
  expirationBusy.add(o.id);
  try{await updateAdminOrder(session,o.id,'utlopt');}
  catch(err){console.warn('Utløpt ordre:',err.message);}
  finally{expirationBusy.delete(o.id);}
 }
}
async function maintain(){
 if(cleanupBusy||!session||document.hidden||orders.size<100||Date.now()-lastCleanupAt<600000)return;
 cleanupBusy=true;lastCleanupAt=Date.now();
 try{
  // Small oldest-children read only during cleanup; SSE already holds latest 100.
  const c=session;
  const q=c.db.query(c.db.ref(c.database,'beta/tenants/'+config.tenantId+'/orders'),
   c.db.orderByChild('createdAt'),c.db.limitToFirst(25));
  const snap=await c.db.get(q);
  const old=snap.exists()?Object.values(snap.val()):[];
  const latest=sortedOrders();
  await deleteOldOrders(c,[...latest,...old.filter(o=>!orders.has(o.id))]);
 }catch(err){console.warn('Ordreopprydding:',err.message);}
 finally{cleanupBusy=false;}
}
function pickerMillis(raw){
 if(!/^\d{2}:\d{2}$/.test(raw||''))return NaN;
 const [h,m]=raw.split(':').map(Number);
 if(h>23||m>59)return NaN;
 const d=new Date();d.setHours(h,m,0,0);
 if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);
 return d.getTime();
}
async function writeAction(action){
 const o=orders.get(selected);if(!o||!session||activeTx.has(o.id))return;
 let op='',payload=null;
 if(action==='accept'){
  if(!expectedPrice(o).valid)return showToast('Menyprisen må kontrolleres før godkjenning.');
  if(o.pickupMode==='scheduled'){op='godta-planlagt';payload=pickerMillis($('acceptTime')?.value);}
  else{op='godta';payload=Number($('minutesInput')?.value);}
 }else if(action==='reject'){op='avvis';payload='Restauranten kunne ikke ta imot bestillingen.';}
 else if(action==='change'){op='endre';payload=pickerMillis($('changeTime')?.value);}
 else if(action==='ready')op='klar';
 else if(action==='delivered')op='utlevert';
 if(!op)return;
 activeTx.add(o.id);
 try{
  const saved=await updateAdminOrder(session,o.id,op,payload);
  orders.set(o.id,saved);renderList();refreshAlarm();
  if(action==='accept')await autoPrint(saved);
  showToast('Endringen er lagret i Firebase.');
 }catch(err){showToast(err.message||'Kunne ikke endre bestillingen.');}
 finally{activeTx.delete(o.id);}
}
async function autoPrint(order){
 if(localStorage.getItem(printKey+order.id)==='1')return;
 try{await printKitchenTicket(order);localStorage.setItem(printKey+order.id,'1');renderDetail();}
 catch(error){showToast('Ordren er godkjent, men Epson-utskriften feilet: '+error.message);}
}
async function clickAction(action){
 const o=orders.get(selected);
 if(['accept','reject','change','ready','delivered'].includes(action)){await writeAction(action);return;}
 if(!o)return;
 if(action==='print'){
  try{await printKitchenTicket(o,{reprint:true});localStorage.setItem(printKey+o.id,'1');renderDetail();showToast('Epson bekreftet utskriften.');}
  catch(err){showToast('Utskrift mislyktes: '+err.message);}
 }else if(action==='sms'){
  const phone=String(o.phone||'').replace(/\D/g,'');
  if(phone)location.href='sms:+47'+phone+'?body='+encodeURIComponent(smsDraft(o));
 }else if(action==='email'){
  if(o.email)location.href='mailto:'+encodeURIComponent(o.email)+'?subject='+encodeURIComponent('Bestilling '+o.id)+'&body='+encodeURIComponent(emailDraft(o));
 }else if(action==='save-printer'){
  const host=$('printerHost')?.value.trim();
  if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(host))return showToast('Skriv en gyldig lokal IP-adresse.');
  localStorage.setItem('beta:printer:host',host);showToast('Skriveren er lagret lokalt på denne enheten.');
 }else if(action==='check-printer'){
  try{await checkEpsonConnection();showToast('Epson bekreftet forbindelsen.');}
  catch(err){showToast('Epson kunne ikke nås: '+err.message);}
 }
}
async function openAdmin(){
 // Direct Realtime Database connection: admin opens without authentication.
 renderList();
 try{
  session=await getAdminSession();
  if(!session){
   setConnection('Firebase-tilgang ikke tilgjengelig');
   return;
  }
  try{await loadCatalog();startCatalogSync(()=>renderDetail());}catch(error){console.warn('Meny:',error.message);}
  reconnect();
  await expirySweep();
 }catch(error){
  session=null;
  setConnection('Firebase: '+(error?.message||'tilkobling mislyktes'),'error');
  console.error('Firebase-tilkobling mislyktes:',error.message);
 }
}
$('enableSound').addEventListener('click',async()=>{
 try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();await audio.resume();soundEnabled=true;
  $('enableSound').textContent='Lyd aktiv';beep();refreshAlarm();}
 catch(err){showToast('Lyd kan ikke aktiveres: '+err.message);}
});
$('searchInput').addEventListener('input',renderList);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
 filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>t.classList.toggle('active',t===b));selected=null;renderList();
}));
$('orderList').addEventListener('click',event=>{
 const btn=event.target.closest('[data-order]');
 if(btn){selected=btn.dataset.order;renderList();}
});
$('orderDetail').addEventListener('click',event=>{
 const btn=event.target.closest('[data-action]');
 if(btn)void clickAction(btn.dataset.action);
});
function tick(){
 if(!session||document.hidden)return;
 for(const node of document.querySelectorAll('[data-countdown]')){
  const o=orders.get(node.dataset.countdown);
  if(o)node.textContent=remaining(o.confirmationDeadline);
 }
 for(const node of document.querySelectorAll('[data-remaining]')){
  const o=orders.get(node.dataset.remaining);
  if(o)node.textContent=remaining(o.estimatedReadyAt||o.scheduledPickupAt);
 }
 refreshAlarm();
}
setInterval(tick,1000);
setInterval(()=>{void expirySweep();},15000);
maintenanceTimer=setInterval(()=>{void maintain();},600000);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){unsubscribe?.();unsubscribe=null;stopAlarm();stopCatalogSync();}
 else if(session){startCatalogSync(()=>renderDetail());reconnect();void expirySweep();}
});
window.addEventListener('pagehide',()=>{unsubscribe?.();unsubscribe=null;stopAlarm();stopCatalogSync();});
$('restaurantName').textContent=config.restaurant.name;
void openAdmin();
