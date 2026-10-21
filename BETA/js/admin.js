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
 const node=$('orderList');
 node.innerHTML=arr.length?arr.map(o=>{
  const expired=isExpired(o),name=o.customerName||'Kunde';
  return '<button class="order-row '+(o.id===selected?'selected':'')+'" type="button" data-order="'+e(o.id)+'">'+
   '<div class="order-row-top"><span class="order-row-name">'+e(name)+'</span><span class="pill '+e(o.status)+'">'+e(expired?'Utløpt':(labels[o.status]||o.status))+'</span></div>'+
   '<div class="order-row-note">#'+e(o.id.slice(-8))+' · '+e(date(o.createdAt))+' · '+e(o.phone)+'</div>'+
   '<div class="order-row-bottom"><span class="muted">'+e(pickup(o))+'</span><span class="order-price">'+money(o.total)+'</span></div>'+
   (o.status==='mottatt'?'<div class="order-row-note">Svar innen <b data-countdown="'+e(o.id)+'">'+remaining(o.confirmationDeadline)+'</b></div>':'')+
   '</button>';
 }).join(''):'<p class="helper" style="padding:10px">Ingen bestillinger i dette utvalget.</p>';
 if(selected&&!orders.has(selected))selected=null;
 if(!selected&&arr.length)selected=arr[0].id;
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
 const expired=isExpired(o),check=expectedPrice(o);
 const canEdit=['mottatt','bekreftet'].includes(o.status);
 const displayAt=o.estimatedReadyAt||o.scheduledPickupAt||0;
 const details=(o.lines||[]).map(l=>'<div class="item">'+
  '<div class="item-main"><span>'+e(l.quantity)+' × '+e(l.name)+'</span><span>'+money(l.price)+'</span></div>'+
  '<p class="sub">'+e(l.size||'')+
  (Array.isArray(l.options)&&l.options.length?'<br>'+l.options.map(x=>e((x.groupTitle?x.groupTitle+': ':'')+(x.description||x.label||x.id))).join('<br>'):'')+
  (l.removedIngredients?.length?'<br>Uten: '+e(l.removedIngredients.join(', ')):'')+
  (l.comment?'<br>Kommentar: '+e(l.comment):'')+'</p></div>').join('');
 const printDone=localStorage.getItem(printKey+o.id)==='1';
 $('orderDetail').innerHTML='<div class="detail">'+
  '<div class="detail-head"><div><p>BESTILLING #'+e(o.id.slice(-10))+'</p><h2>'+e(o.customerName||'Kunde')+'</h2><p>'+e(date(o.createdAt))+'</p></div>'+
  '<span class="pill '+e(o.status)+'">'+e(expired?'Utløpt':(labels[o.status]||o.status))+'</span></div>'+
  '<div class="clock-box '+(expired?'expired':'')+'"><div class="summary-line"><span>'+e(pickup(o))+'</span><strong '+(o.status==='mottatt'?'data-countdown="'+e(o.id)+'"':'data-remaining="'+e(o.id)+'"')+'>'+e(o.status==='mottatt'?(expired?'Frist utløpt':remaining(o.confirmationDeadline)):remaining(displayAt))+'</strong></div>'+
   '<div class="big-time">'+e(displayAt?time(displayAt):(o.pickupMode==='scheduled'?o.pickup:'Snarest'))+'</div>'+
   '<p>'+e(o.status==='mottatt'?'Venter på restaurantens godkjenning':o.status==='klar'?'Klar til henting':o.status==='avvist'?(o.rejectionReason||'Avvist'):'Forventet hentetid')+'</p></div>'+
  '<div class="box"><h3>Bestilte varer</h3>'+details+
  '<div class="summary-line total"><span>Totalt</span><strong>'+money(o.total)+'</strong></div></div>'+
  '<div class="box"><h3>Kundeinformasjon</h3><dl class="info-grid"><div><dt>Navn</dt><dd>'+e(o.customerName)+'</dd></div>'+
  '<div><dt>Telefon</dt><dd>'+e(o.phone)+'</dd></div><div><dt>E-post</dt><dd>'+e(o.email||'Ikke oppgitt')+'</dd></div>'+
  '<div><dt>Henting</dt><dd>'+e(pickup(o))+'</dd></div></dl></div>'+
  (!check.valid?'<p class="warn">Pris må kontrolleres: '+e(check.reason)+'</p>':'')+
  '<div class="box"><h3>Behandle bestillingen</h3>'+
  (o.status==='mottatt'&&!expired?
   '<div class="button-row">'+(o.pickupMode==='asap'?'<label>Minutter <input class="action-input" id="minutesInput" type="number" min="5" max="180" value="'+e(String(config.restaurant.pickupMinutes||25))+'"></label>':'<label>Hentetid <input class="time-input" id="acceptTime" type="time" value="'+e(o.pickup)+'"></label>')+
   '<button class="primary" data-action="accept" '+(!check.valid?'disabled':'')+'>Godta</button><button class="danger" data-action="reject">Avvis</button></div>':'')+
  (o.status==='bekreftet'?'<div class="button-row"><label>Ny hentetid <input class="time-input" id="changeTime" type="time" value="'+e(displayAt?time(displayAt):'')+'"></label><button data-action="change">Endre tid</button><button class="primary" data-action="ready">Klar</button></div>':'')+
  (o.status==='klar'?'<div class="button-row"><button class="primary" data-action="delivered">Utlevert</button></div>':'')+
  ((o.status==='mottatt'&&expired)?'<p class="warn">Fristen er utløpt. Ordren kan ikke godtas.</p>':'')+
  '<div class="button-row"><button class="secondary" data-action="print">Skriv ut på nytt</button></div>'+
  '<p class="helper">Epson: '+(printDone?'Utskrift bekreftet på denne enheten.':'Ingen bekreftet utskrift på denne enheten.')+'</p>'+
  '</div><div class="box"><h3>Varslinger og kvittering</h3>'+
  '<p class="helper">'+e(noteStatus(o))+'</p>'+
  '<p class="helper">Automatisk SMS og e-post krever en egen sendetjeneste. Åpning av SMS/e-post nedenfor bekrefter ikke levering.</p>'+
  '<div class="button-row"><button data-action="sms">Åpne SMS</button><button data-action="email" '+(!o.email?'disabled':'')+'>Åpne e-postkvittering</button></div></div>'+
  '<div class="box"><h3>Skriverinnstillinger</h3>'+
  '<div class="button-row"><label>IP <input class="time-input" id="printerHost" placeholder="192.168.1.25" value="'+e(localStorage.getItem('beta:printer:host')||'192.168.1.25')+'"></label>'+
  '<button data-action="save-printer">Lagre skriver</button><button data-action="check-printer">Test skriver</button></div>'+
  '<p class="helper">Epson ePOS, 80 mm papir. Lokal HTTPS-tilgang må være tillatt av nettleseren.</p></div>'+
  '</div>';
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
