/** BETA restaurant orders. No direct Firebase access and no anonymous admin writes.
 * The server must enforce roles, CSRF, tenant isolation and atomic transitions.
 * EventSource carries only active orders (max 100) and closes when tab is hidden.
 */
import {config} from './config.js?v=20261021-beta15';
import {orderLabels} from './order-status.js?v=20261021-beta15';
import {printKitchenTicket,checkEpsonConnection,savePrinterHost,currentPrinterHost} from './printer.js?v=20261021-beta15';

const $=id=>document.getElementById(id);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(Number(value)||0)+' kr';
const fmt=time=>Number(time)>0?new Intl.DateTimeFormat('nb-NO',{timeZone:config.restaurant.timezone||'Europe/Oslo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(time))):'–';
const orders=new Map(),running=new Set(),actionKeys=new Map();
let selected='',filter='all',query='',stream=null,healthy=false,connected=false;
let fallback=null,initialTimer=null,syncRequest=null,csrfToken='',session=false,seenInitial=false,lastList='',soundEnabled=true;
const base=()=>config.apiBase.replace(/\/$/,'')+'/v1/tenants/'+encodeURIComponent(config.tenantId)+'/admin';
function toast(message){
 const target=$('adminToast');target.textContent=message;target.hidden=false;
 setTimeout(()=>{if(target.textContent===message)target.hidden=true;},4700);
}
function connectedState(ok){
 connected=ok;
 $('connectionStatus').textContent=ok?'Tilkoblet':'Frakoblet';
 $('connectionStatus').classList.toggle('is-online',ok);
 $('sidebarStatus').textContent=ok?'● Aktiv bestillingsovervåking':'● Ingen aktiv strøm';
}
async function request(path,{method='GET',body=null,csrf=false}={}){
 if(!config.apiBase)throw new Error('API er ikke konfigurert.');
 const headers={Accept:'application/json'};
 if(body!==null)headers['Content-Type']='application/json';
 if(csrf){
  if(!csrfToken)throw new Error('Sesjonen mangler CSRF-beskyttelse.');
  headers['X-CSRF-Token']=csrfToken;
 }
 const response=await fetch(base()+path,{method,headers,body:body===null?undefined:JSON.stringify(body),credentials:'include',cache:'no-store'});
 if(response.status===401||response.status===403){
  // An expired session cannot leave the customer list accessible on screen.
  if(path!=='/sessions'&&path!=='/session')signOut(false);
  throw new Error('Ingen gyldig administratortilgang.');
 }
 if(!response.ok)throw new Error('Serveren avviste forespørselen (HTTP '+response.status+').');
 return response.status===204?{}:response.json();
}
function showGate(message,login=false){
 $('adminGate').hidden=false;$('workspace').hidden=true;
 $('gateTitle').textContent=login?'Logg inn som ansatt':'Bestillingsadministrasjon';
 $('gateHelp').textContent=message;
 $('loginForm').hidden=!login;
 $('logout').hidden=true;
}
function showWorkspace(){
 $('adminGate').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
 $('shopTitle').textContent=config.restaurant.name;
 renderList();renderDetails();
}
function stopSync(){
 if(stream){stream.close();stream=null;}
 if(fallback!==null)clearInterval(fallback);fallback=null;
 if(initialTimer!==null)clearTimeout(initialTimer);initialTimer=null;
 healthy=false;connectedState(false);
}
function signOut(clearCookie=true){
 const token=csrfToken;
 stopSync();orders.clear();session=false;csrfToken='';selected='';seenInitial=false;lastList='';
 showGate('Logg inn for å håndtere bestillinger.',Boolean(config.apiBase));
 if(clearCookie&&config.apiBase&&token){
  // Explicit logout is protected by the existing session's CSRF token.
  void fetch(base()+'/sessions',{method:'DELETE',credentials:'include',cache:'no-store',
   headers:{'X-CSRF-Token':token}}).catch(()=>{});
 }
}
function snapshot(data){
 if(!Array.isArray(data))return;
 // Never accept an unbounded server response. The API must also cap at 100.
 orders.clear();
 for(const o of data.slice(0,100))if(o&&typeof o.id==='string'&&o.tenantId===config.tenantId)orders.set(o.id,o);
 seenInitial=true;updateScreen();
}
function change(message){
 const type=message?.type||'';
 if(type==='snapshot'){snapshot(message.orders);return;}
 if(type==='upsert'){
  const o=message.order;
  if(!o||o.tenantId!==config.tenantId||!o.id)return;
  const old=orders.get(o.id);
  orders.set(o.id,o);
  if(seenInitial&&!old&&o.status==='mottatt')alertNew();
  // Guard against an incorrect server which attempts to stream unlimited orders.
  if(orders.size>100){
   const sorted=[...orders.values()].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
   for(const stale of sorted.slice(100))orders.delete(stale.id);
  }
  updateScreen();
 }else if(type==='remove'){
  if(orders.delete(message.id)){if(selected===message.id)selected='';updateScreen();}
 }
}
let audioContext=null;
function alertNew(){
 if(!soundEnabled)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  audioContext??=new C();
  if(audioContext.state!=='running')return; // browser gesture required
  const tone=audioContext.createOscillator(),vol=audioContext.createGain();
  tone.connect(vol);vol.connect(audioContext.destination);
  tone.frequency.value=790;vol.gain.setValueAtTime(.09,audioContext.currentTime);
  vol.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.35);
  tone.start();tone.stop(audioContext.currentTime+.35);
 }catch{}
}
function activeOrders(){
 return [...orders.values()].filter(o=>['mottatt','bekreftet','tilberedning','klar'].includes(o.status))
  .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)||String(b.id).localeCompare(String(a.id)));
}
function visibleOrders(){
 const now=Date.now();
 return activeOrders().filter(o=>{
  if(filter==='scheduled'&&!(o.pickupMode==='scheduled'&&Number(o.scheduledPickupAt)>now))return false;
  if(!query)return true;
  return (String(o.customerName||'')+' '+String(o.phone||'')+' '+String(o.id||'')).toLocaleLowerCase('nb-NO').includes(query);
 });
}
function renderList(){
 const list=activeOrders();
 $('allCount').textContent=String(list.length);
 $('scheduledCount').textContent=String(list.filter(o=>o.pickupMode==='scheduled'&&Number(o.scheduledPickupAt)>Date.now()).length);
 const visible=visibleOrders();
 const signature=visible.map(o=>o.id+':'+String(o.statusUpdatedAt||0)+':'+(o.id===selected)).join('|');
 if(signature===lastList)return;
 lastList=signature;
 const host=$('orderList'),scroll=host.scrollTop;
 host.innerHTML=visible.map(o=>{
  const status=orderLabels[o.status]||o.status;
  return '<button class="order-row'+(o.id===selected?' is-selected':'')+'" type="button" data-select="'+e(o.id)+'">'+
   '<strong>'+e(o.customerName||'Ukjent kunde')+'</strong>'+
   '<div class="order-row-meta"><span class="status">'+e(status)+'</span><b>'+money(o.total)+'</b></div>'+
   '<div class="order-row-meta"><span>'+e(o.pickupMode==='scheduled'?'Planlagt':'Snarest')+'</span><span>'+e(fmt(o.createdAt))+'</span></div></button>';
 }).join('')||'<p class="detail-note">Ingen aktive bestillinger.</p>';
 host.scrollTop=scroll;
}
function lineMarkup(line){
 const extras=Array.isArray(line.optionDetails)?line.optionDetails:Array.isArray(line.options)?line.options:[];
 return '<div class="detail-line"><strong>'+e(Number(line.quantity)||1)+'× '+e(line.name||'Produkt')+'</strong>'+
  '<small>'+e(line.size||'')+'</small>'+
  extras.map(item=>'<small>'+e(typeof item==='string'?item:item.label||item.description||'')+'</small>').join('')+
  (line.removedIngredients?.length?'<small>Uten: '+e(line.removedIngredients.join(', '))+'</small>':'')+
  (line.comment?'<small>Kommentar: '+e(line.comment)+'</small>':'')+'</div>';
}
function detailButtons(order){
 if(order.status==='mottatt'){
  const scheduled=order.pickupMode==='scheduled';
  return '<div class="detail-actions">'+
   (scheduled?'<p class="detail-note">Bekreft valgt hentetid: '+e(fmt(order.scheduledPickupAt))+'</p>':
    '<label>Tilberedningstid <input id="prepareMinutes" type="number" min="1" max="180" value="25"> min</label>')+
   '<button type="button" data-act="confirm">Bekreft bestilling</button></div>';
 }
 if(['bekreftet','tilberedning'].includes(order.status)){
  return '<div class="detail-actions"><button type="button" data-act="ready">Marker klar for henting</button>'+
   '<button type="button" class="secondary" data-act="print">Skriv ut på nytt</button></div>';
 }
 if(order.status==='klar')return '<div class="detail-actions"><button data-act="complete">Utlevert · fullfør bestilling</button>'+
  '<button class="secondary" data-act="print">Skriv ut på nytt</button></div>';
 return '';
}
function renderDetails(){
 const host=$('orderDetails'),o=orders.get(selected);
 if(!o){host.innerHTML='<div class="empty-detail"><span>↗</span><h2>Velg en bestilling</h2><p>Trykk på en bestilling til venstre for å se varer og håndtere den.</p></div>';return;}
 host.innerHTML='<div class="detail-header"><div><h2>'+e(o.customerName||'Bestilling')+'</h2><p>#'+e(o.id)+'</p></div><button type="button" class="detail-close" data-act="close">Lukk</button></div>'+
  '<div class="detail-facts"><div><span>Telefon</span><strong>'+e(o.phone||'–')+'</strong></div><div><span>E-post</span><strong>'+e(o.email||'–')+'</strong></div>'+
  '<div><span>Mottatt</span><strong>'+e(fmt(o.createdAt))+'</strong></div><div><span>Hentetid</span><strong>'+e(fmt(o.scheduledPickupAt||o.estimatedReadyAt))+'</strong></div></div>'+
  '<section class="detail-items"><h3>Bestilte varer</h3>'+
  (Array.isArray(o.lines)?o.lines:[]).map(lineMarkup).join('')+
  '<div class="detail-total"><span>Totalt</span><strong>'+money(o.total)+'</strong></div></section>'+
  '<p class="detail-note">SMS og e-post håndteres av separate serverprosesser etter lagret bekreftelse. Klar sender ingen automatisk SMS.</p>'+
  detailButtons(o)+
  '<div class="detail-actions"><label>Epson IP <input id="printerHost" value="'+e(currentPrinterHost())+'" placeholder="192.168.1.25" inputmode="decimal"></label>'+
  '<button class="secondary" type="button" data-act="test-printer">Test skriver</button></div>';
}
function updateScreen(){renderList();if(selected)renderDetails();}
async function refresh(){
 if(!session||document.hidden||syncRequest)return;
 syncRequest=request('/orders?status=active&limit=100').then(data=>snapshot(data.orders||[]))
  .then(()=>connectedState(true)).catch(()=>connectedState(false)).finally(()=>syncRequest=null);
 return syncRequest;
}
function startSync(){
 if(!session||document.hidden||stream||!config.apiBase)return;
 // Open exactly one tenant-scoped, authenticated SSE for active orders.
 const url=base()+'/orders/events?status=active&limit=100';
 if(typeof EventSource!=='undefined'){
  stream=new EventSource(url,{withCredentials:true});
  const accept=event=>{try{const payload=JSON.parse(event.data);healthy=true;connectedState(true);change(payload);}catch{}};
  stream.onmessage=accept;
  stream.addEventListener('snapshot',accept);
  stream.addEventListener('upsert',accept);
  stream.addEventListener('remove',accept);
  stream.onerror=()=>{healthy=false;connectedState(false);};
  initialTimer=setTimeout(()=>{initialTimer=null;if(!seenInitial)void refresh();},8000);
 }else void refresh();
 fallback=setInterval(()=>{if(!healthy)void refresh();},30000);
}
async function action(type,o){
 if(!session||!o||running.has(o.id))return;
 if(type==='print'){try{await printKitchenTicket(o,{reprint:true});toast('Kvitteringen ble sendt til Epson.');}catch(err){toast('Utskrift feilet: '+err.message);}return;}
 if(type==='test-printer'){
  try{
   savePrinterHost($('printerHost')?.value);
   await checkEpsonConnection();
   toast('Epson svarte.');
  }catch(err){toast('Epson-test feilet: '+err.message);}
  return;
 }
 const allowed={confirm:['mottatt'],ready:['bekreftet','tilberedning'],complete:['klar']};
 if(!allowed[type]?.includes(o.status))return;
 let minutes=0;
 if(type==='confirm'&&o.pickupMode!=='scheduled'){
  minutes=Number($('prepareMinutes')?.value);
  if(!Number.isInteger(minutes)||minutes<1||minutes>180){toast('Velg 1–180 minutter.');return;}
 }
 const key=o.id+':'+type+':'+String(o.statusUpdatedAt||0);
 if(!actionKeys.has(key))actionKeys.set(key,crypto.randomUUID());
 running.add(o.id);renderDetails();
 try{
  const output=await request('/orders/'+encodeURIComponent(o.id)+'/'+type,{
   method:'POST',csrf:true,
   body:{idempotencyKey:actionKeys.get(key),expectedStatus:o.status,expectedVersion:o.statusUpdatedAt||0,
    ...(type==='confirm'&&o.pickupMode!=='scheduled'?{estimatedMinutes:minutes}:{})}
  });
  const changed=output.order;
  if(!changed||changed.id!==o.id||changed.tenantId!==config.tenantId)throw new Error('Ugyldig svar fra serveren.');
  orders.set(o.id,changed);actionKeys.delete(key);
  updateScreen();toast('Ordren er oppdatert.');
  // A duplicate confirmation MUST NOT automatically print again.
  if(type==='confirm'&&output.transitioned===true){
   try{await printKitchenTicket(changed);toast('Kjøkkenkvittering sendt til Epson.');}
   catch(error){toast('Bestillingen er bekreftet. Utskrift feilet: '+error.message);}
  }
  if(type==='complete'){selected='';updateScreen();}
 }catch(err){toast(err.message||'Kunne ikke oppdatere bestillingen.');}
 finally{running.delete(o.id);renderDetails();}
}
async function checkSession(){
 if(!config.apiBase){showGate('Sikker ordre-API er ennå ikke konfigurert. Ingen bestillinger blir behandlet.');return;}
 try{
  const info=await request('/session');
  if(info.authenticated!==true||!info.csrfToken)throw new Error('Ingen gyldig sesjon');
  csrfToken=info.csrfToken;session=true;showWorkspace();startSync();
 }catch{showGate('Logg inn med en godkjent administratorkonto.',true);}
}
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();
 $('loginButton').disabled=true;
 try{
  const info=await request('/sessions',{method:'POST',body:{username:$('username').value,password:$('password').value}});
  $('password').value='';
  if(info.authenticated!==true||!info.csrfToken)throw new Error('Ugyldig sesjon fra serveren.');
  session=true;csrfToken=info.csrfToken;showWorkspace();startSync();
 }catch(error){toast('Innlogging feilet. '+error.message);}
 finally{$('loginButton').disabled=false;}
});
$('logout').addEventListener('click',()=>signOut());
$('orderList').addEventListener('click',event=>{
 const button=event.target.closest('[data-select]');
 if(!button)return;
 selected=button.dataset.select;lastList='';updateScreen();
});
$('orderDetails').addEventListener('click',event=>{
 const button=event.target.closest('[data-act]');
 if(!button)return;
 if(button.dataset.act==='close'){selected='';lastList='';updateScreen();return;}
 void action(button.dataset.act,orders.get(selected));
});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('is-active',b===button);b.setAttribute('aria-pressed',String(b===button));});
 lastList='';renderList();
}));
$('orderSearch').addEventListener('input',event=>{query=event.target.value.toLocaleLowerCase('nb-NO').trim();lastList='';renderList();});
$('refreshOrders').addEventListener('click',()=>void refresh());
$('toggleSound').addEventListener('click',()=>{
 soundEnabled=!soundEnabled;
 $('toggleSound').setAttribute('aria-pressed',String(soundEnabled));
 $('toggleSound').textContent=soundEnabled?'🔊':'🔇';
 if(soundEnabled)try{
  const C=window.AudioContext||window.webkitAudioContext;
  if(C){audioContext??=new C();void audioContext.resume();}
 }catch{}
});
$('toggleSidebar').addEventListener('click',()=>$('adminSidebar').classList.toggle('is-open'));
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopSync();
 else if(session)startSync();
});
window.addEventListener('pagehide',stopSync);
window.addEventListener('pageshow',()=>{if(session)startSync();});
void checkSession();
