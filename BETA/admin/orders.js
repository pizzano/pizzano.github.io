/* BestillOnline · order reception. One bounded Firebase SSE stream, no polling. */
'use strict';
(()=>{
 const DB='https://kol-grill-pizza-1-default-rtdb.firebaseio.com';
 const ADMIN_UID='CkvfzzzQ9MaPD8lZWKx10RB6iX22';
 // Firebase web keys identify an application; authentication still requires the admin account.
 const FIREBASE_WEB_API_KEY='AIzaSyDanHMWBBN260CS9S9IVpFPnb2BfnWXF-0';
 const $=id=>document.getElementById(id);
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>Math.round(Number(value)||0).toLocaleString('nb-NO')+' kr';
 const fmtTime=value=>value?new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(new Date(Number(value))):'—';
 const fmtDate=value=>value?new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(new Date(Number(value))):'—';
 const statusNames={mottatt:'Ny bestilling',godkjent:'✓ Godkjent og under tilberedning',klar:'✓ Klar til henting',avvist:'✕ Avvist'};
 // Pickup slots arrive as Norwegian local wall time, e.g. 2026-11-18T12:15.
 // Convert with Europe/Oslo explicitly; Date.parse(localTime) uses the viewer's timezone.
 function scheduledPickupTimestamp(pickup){
  if(pickup?.mode!=='scheduled'||typeof pickup.time!=='string')return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(pickup.time);
  if(!match)return null;
  const [year,month,day,hour,minute]=match.slice(1).map(Number);
  const wall=Date.UTC(year,month-1,day,hour,minute);
  const valid=new Date(wall);
  if(valid.getUTCFullYear()!==year||valid.getUTCMonth()!==month-1||valid.getUTCDate()!==day||valid.getUTCHours()!==hour||valid.getUTCMinutes()!==minute)return null;
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const desired=pickup.time.replace('T',' ');
  // Both CET and CEST candidates are checked, including the DST transition.
  for(const hours of [2,1]){
   const timestamp=wall-hours*3600000;
   const parts=fmt.formatToParts(new Date(timestamp));
   const field=type=>parts.find(part=>part.type===type)?.value||'';
   const result=field('year')+'-'+field('month')+'-'+field('day')+' '+field('hour')+':'+field('minute');
   if(result===desired)return timestamp;
  }
  return null;
 }

 let auth=null,stream=null,orders=new Map(),filter='all',activeId=null,pendingAction=false,pruning=false,pruneWanted=false;
 let renderedIds='',connected=false,initialLoaded=false,lastEventAt=0;
 let countdownTicker=null,automaticReadyBusy=false;
 let pruneCheckedKeySignature='',authStreamRenewing=false;
 const autoReadyAttempts=new Map();
 function remainingCountdown(time,now=Date.now()){
  const left=Math.max(0,Math.ceil((Number(time)-now)/1000));
  const minutes=Math.floor(left/60),seconds=left%60;
  return String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
 }
 function updateCountdowns(){
  const now=Date.now();
  for(const node of document.querySelectorAll('[data-countdown-id]')){
   const order=orders.get(node.dataset.countdownId);
   if(!order||order.status!=='godkjent'||!Number.isFinite(Number(order.expectedReadyAt))){
    node.textContent='';continue;
   }
   const time=Number(order.expectedReadyAt);
   node.textContent=time>now?remainingCountdown(time,now)+' igjen':'00:00 · Klar nå';
   node.classList.toggle('is-due',time<=now);
  }
 }
 function stopCountdowns(){
  if(countdownTicker!==null){clearInterval(countdownTicker);countdownTicker=null}
 }
 function startCountdowns(){
  stopCountdowns();
  if(!authReady())return;
  updateCountdowns();
  countdownTicker=setInterval(()=>{
   if(document.hidden||!authReady()||!initialLoaded)return;
   updateCountdowns();
   void finalizeDueOrder();
  },1000);
 }
 async function finalizeDueOrder(){
  if(automaticReadyBusy||pendingAction||document.hidden||!authReady()||!initialLoaded)return;
  const now=Date.now();
  const due=[...orders.values()].filter(o=>o.status==='godkjent'&&Number.isFinite(Number(o.expectedReadyAt))&&Number(o.expectedReadyAt)>0&&Number(o.expectedReadyAt)<=now)
   .sort((a,b)=>Number(a.expectedReadyAt)-Number(b.expectedReadyAt));
  const order=due.find(o=>now-(autoReadyAttempts.get(o.id)||0)>60000);
  if(!order)return;
  autoReadyAttempts.set(order.id,now);
  automaticReadyBusy=true;
  try{await changeStatus(order.id,'klar',{},true)}
  catch(error){console.warn('BestillOnline: automatisk klar feilet',error);feedback('Automatisk klar kunne ikke lagres. Prøv Klar manuelt.',true)}
  finally{automaticReadyBusy=false}
 }
 const streamQuery='orderBy=%22%24key%22&limitToLast=101';
 const show=(id,visible)=>{$(id).hidden=!visible};
 const text=(id,value)=>{$(id).textContent=value};
 function feedback(message,error=false){
  const node=$('ordersFeedback');node.hidden=!message;
  node.textContent=message;node.className='orders-feedback'+(error?' error':'');
 }
 function connection(label,online=false,offline=false){
  connected=online;
  $('ordersConnection').className='orders-connection'+(online?' is-online':offline?' is-offline':'');
  $('ordersConnection').querySelector('span').textContent=label;
 }
 function authReady(){return auth?.currentUser?.uid===ADMIN_UID}
 async function authorizedURL(path){
  if(!authReady())throw Error('Administratortilgang kreves.');
  const token=await auth.currentUser.getIdToken();
  return DB+'/'+path+'.json?auth='+encodeURIComponent(token);
 }
 async function configure(){
  if(auth)return;
  if(!window.firebase?.auth)throw Error('Firebase Authentication ble ikke lastet.');
  const app=window.firebase.apps.length?window.firebase.app():window.firebase.initializeApp({
   apiKey:FIREBASE_WEB_API_KEY,authDomain:'kol-grill-pizza-1.firebaseapp.com',projectId:'kol-grill-pizza-1'
  });
  auth=app.auth();
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
 }
 function logoutView(message=''){
  stopCountdowns();
  closeStream();orders.clear();renderedIds='';activeId=null;
  show('ordersApp',false);show('ordersLogin',true);show('ordersSignOut',false);
  closeSheet();closeDialog();
  connection('Logg inn',false,true);
  $('ordersLoginError').hidden=!message;
  $('ordersLoginError').textContent=message;
 }
 async function login(event){
  event.preventDefault();
  const pass=$('ordersPassword').value;
  if(!pass)return;
  $('ordersLoginSubmit').disabled=true;
  try{
   await configure();
   const email='fatihsemb@gmail.com';
   const result=await auth.signInWithEmailAndPassword(email,pass);
   if(result.user.uid!==ADMIN_UID){await auth.signOut();throw Error('Ikke en administrator.')}
   $('ordersPassword').value='';
   await enterOrders();
  }catch(error){logoutView(error.code?.startsWith('auth/')?'Feil passord eller konto.':error.message)}
  finally{$('ordersLoginSubmit').disabled=false}
 }
 async function boot(){
  try{
   await configure();
   const user=await new Promise(resolve=>{
    const stop=auth.onAuthStateChanged(value=>{stop();resolve(value)},()=>resolve(null));
   });
   if(user?.uid===ADMIN_UID)await enterOrders();
   else logoutView();
   // Firebase Auth refreshes tokens automatically. Do not restart the order
   // stream on each refresh; each restart downloads the complete 101-order snapshot.
   // If the existing stream is actually revoked, reconnect just once below.
  }catch(error){logoutView(error.message)}
 }
 async function enterOrders(){
  show('ordersLogin',false);show('ordersApp',true);show('ordersSignOut',true);
  connection('Kobler til…');
  render();
  // Brand is part of the static HTML: no extra /settings read.
  await connectOrders();
  startCountdowns();
 }
 function closeStream(){if(stream){stream.close();stream=null}initialLoaded=false}
 function isOrder(value,id){
  return !!value&&typeof value==='object'&&value.id===id&&
    ['mottatt','godkjent','klar','avvist'].includes(value.status);
 }
 function receivedPatch(path,value,isPatch){
  const bits=String(path||'/').split('/').filter(Boolean);
  if(!bits.length){
   if(!isPatch){
    orders=new Map(Object.entries(value&&typeof value==='object'?value:{}).filter(([id,v])=>isOrder(v,id)));
   }else if(value&&typeof value==='object'){
    for(const [id,v]of Object.entries(value)){
     if(v===null)orders.delete(id);
     else if(isOrder(v,id))orders.set(id,v);
     else if(orders.has(id)&&typeof v==='object')orders.set(id,{...orders.get(id),...v});
    }
   }
   return;
  }
  const id=bits.shift();
  if(!bits.length){
   if(value===null)orders.delete(id);
   else if(isOrder(value,id))orders.set(id,value);
   return;
  }
  const base=orders.get(id);
  if(!base)return;
  // Firebase SSE patch paths represent individual modified order fields.
  let current=base;
  for(const segment of bits.slice(0,-1)){
   if(!current[segment]||typeof current[segment]!=='object')current[segment]={};
   current=current[segment];
  }
  if(value===null)delete current[bits.at(-1)];
  else current[bits.at(-1)]=value;
  orders.set(id,base);
 }
 function onStreamEvent(event,patch=false){
  try{
   const payload=JSON.parse(event.data);
   receivedPatch(payload.path,payload.data,patch);
   initialLoaded=true;lastEventAt=Date.now();connection('Tilkoblet',true);
   render();
   updateCountdowns();
   void finalizeDueOrder();
   // Avoid repeated shallow reads for the same 101 keys when a status changes.
   if(orders.size>=101){
    const signature=[...orders.keys()].sort().join('|');
    if(signature!==pruneCheckedKeySignature){
     pruneCheckedKeySignature=signature;
     void requestPrune();
    }
   }else pruneCheckedKeySignature='';
   if(activeId&&!orders.has(activeId))closeSheet();
  }catch(error){console.warn('BestillOnline: ugyldig ordreoppdatering',error)}
 }
 async function connectOrders(){
  if(!authReady())return;
  closeStream();
  connection('Kobler til…');
  let url;
  try{url=await authorizedURL('ORDERS')}
  catch(error){connection('Ikke tilkoblet',false,true);feedback(error.message,true);return}
  const source=new EventSource(url+'&'+streamQuery);
  stream=source;
  source.addEventListener('put',e=>{if(stream===source)onStreamEvent(e,false)});
  source.addEventListener('patch',e=>{if(stream===source)onStreamEvent(e,true)});
  source.addEventListener('cancel',e=>{if(stream!==source)return;connection('Ingen tilgang',false,true);feedback('Firebase-regler tillater ikke å lese /ORDERS. Publiser database.rules.json.',true);source.close()});
  source.addEventListener('auth_revoked',()=>{
   if(stream!==source||authStreamRenewing)return;
   source.close();stream=null;
   connection('Fornyer tilkobling…',false,true);
   authStreamRenewing=true;
   void (async()=>{
    try{
     if(!authReady())return;
     await auth.currentUser.getIdToken(true);
     await connectOrders();
    }catch(error){connection('Innlogging utløpt',false,true);feedback('Klarte ikke å fornye ordretilkoblingen.',true)}
    finally{authStreamRenewing=false}
   })();
  });
  source.onerror=()=>{
   if(stream===source)connection('Prøver å koble til…',false,true);
   // EventSource handles reconnect automatically. No timer or GET loop.
  };
 }
 function newest(){
  return [...orders.values()].filter(order=>isOrder(order,order.id))
   .sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)||String(b.id).localeCompare(String(a.id)))
   .slice(0,100);
 }
 const pickupIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1 11H6L5 9Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/><path d="M4 9h16"/></svg>';
 function render(){
  const all=newest();
  // Pending orders are always shown first on the all-orders tab.
  const filtered=filter==='all'?
   [...all].sort((a,b)=>(a.status==='mottatt'?0:1)-(b.status==='mottatt'?0:1)||
    (Number(b.createdAt)||0)-(Number(a.createdAt)||0)):
   all.filter(o=>o.status===filter);
  document.querySelectorAll('.orders-tabs button').forEach(button=>{
   const active=button.dataset.filter===filter;
   button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  });
  $('ordersEmpty').hidden=filtered.length>0;
  $('ordersEmpty').querySelector('strong').textContent=filter==='all'?'Ingen bestillinger':'Ingen bestillinger her';
  const hasPending=filter==='all'&&filtered.some(order=>order.status==='mottatt');
  $('ordersList').innerHTML=filtered.map((order,index)=>{
   const id=safe(String(order.id).slice(-6).toUpperCase());
   const name=safe(order.name||order.customer?.fullName||'Kunde');
   const items=Array.isArray(order.items)?order.items:[];
   const qty=items.reduce((sum,line)=>sum+Math.max(0,Number(line.qty)||0),0);
   const showReady=order.status==='godkjent';
   const scheduled=scheduledPickupTimestamp(order.pickup);
   const clock=order.expectedReadyAt?fmtTime(order.expectedReadyAt):scheduled?fmtTime(scheduled):fmtTime(order.createdAt);
   const groupBreak=filter==='all'&&hasPending&&order.status!=='mottatt'&&
    (index===0||filtered[index-1].status==='mottatt');
   return (groupBreak?'<div class="orders-group-divider" role="separator"><span>Tidligere bestillinger</span></div>':'')+
    '<article class="order-row" data-order-row="'+safe(order.id)+'" data-status="'+safe(order.status)+'">'+
    (showReady?'<button class="order-swipe-action" type="button" data-order-ready="'+safe(order.id)+'" aria-label="Marker klar: '+name+'">Klar <small>til henting</small></button>':'')+
    '<div class="order-row-body"><button type="button" class="order-open" data-order-open="'+safe(order.id)+'">'+
    '<span class="order-initial">'+pickupIcon+'</span><span class="order-meta">'+
    '<strong class="order-name">'+(order.status==='mottatt'?'<span class="order-new-indicator" aria-hidden="true"></span>':'')+name+'</strong>'+
    '<span class="order-status" data-status="'+safe(order.status)+'">'+safe(statusNames[order.status]||order.status)+'</span>'+
    '<small class="order-sub">#'+id+' · '+qty+' varer · Henting <span class="order-pickup-badge" data-kind="'+pickupKind(order)+'">'+pickupKind(order)+'</span></small></span></button>'+
    (order.status==='godkjent'?'<span class="order-countdown" data-countdown-id="'+safe(order.id)+'" aria-label="Tid igjen til henting"></span>':'')+
    '<span class="order-end"><span class="order-price">'+money(order.total)+'</span><small class="order-time">'+clock+'</small></span>'+
    '</div></article>';
  }).join('');
  if(activeId&&orders.has(activeId))renderDetails();
  updateCountdowns();
 }
 function pickupKind(order){
  return order?.pickup?.mode==='scheduled'?'SENERE':'SNAREST';
 }
 function orderProductDetails(line){
  const details=[];
  const opts=Array.isArray(line.choices)?line.choices:[];
  const extra=opts.reduce((sum,group)=>sum+(Array.isArray(group.options)?group.options:[]).reduce((acc,option)=>acc+(Number(option.price)||0)*Math.max(1,Number(option.count)||1),0),0);
  const price=Number(line.unitPrice)||0;
  details.push('<div class="order-product-option"><span><b>Størrelse:</b> '+safe(line.size?.label||'Standard')+'</span><strong>'+money(price-extra)+'</strong></div>');
  for(const group of opts){
   for(const option of Array.isArray(group.options)?group.options:[]){
    const count=Math.max(1,Number(option.count)||1);
    const price=Number(option.price)||0;
    const unit=price>0?'+ '+money(price):price<0?money(price):'Inkludert';
    details.push('<div class="order-product-option"><span><b>'+safe(group.group||'Valg')+':</b> '+safe((count>1?count+' × ':'')+String(option.label||''))+'</span><small>'+unit+'</small></div>');
   }
  }
  if(Array.isArray(line.removedIngredients)&&line.removedIngredients.length)
   details.push('<div class="order-product-option is-alert"><span><b>Uten:</b> '+safe(line.removedIngredients.join(', '))+'</span></div>');
  const notes=[...(Array.isArray(line.quickNotes)?line.quickNotes:[]),...String(line.comment||'').split(/\r?\n/)].map(v=>String(v).trim()).filter(Boolean);
  if(notes.length)details.push('<div class="order-product-option is-alert"><span><b>Kommentar:</b> '+safe([...new Set(notes)].join(' · '))+'</span></div>');
  return details.join('');
 }
 function renderDetails(){
  const o=orders.get(activeId);
  if(!o)return;
  const previous=$('ordersDetail').querySelector('.detail-customer-accordion');
  const wasExpanded=previous?.open&&previous.dataset.detailAccordion===o.id;
  text('detailTitle',money(o.total));
  const pickup=o.pickup||{},items=Array.isArray(o.items)?o.items:[];
  const phone=String(o.phone||o.customer?.phone||'').replace(/[^+\d]/g,'');
  const mail=String(o.email||o.customer?.email||'');
  const phoneLink=phone?'<a href="tel:'+safe(phone)+'">'+safe(phone)+'</a>':'—';
  const when=o.expectedReadyAt?'Bekreftet hentetid: '+fmtDate(o.expectedReadyAt):scheduledPickupTimestamp(o.pickup)?'Ønsket hentetid: '+fmtDate(scheduledPickupTimestamp(o.pickup)):'Hentetid bekreftes ved godkjenning';
  const lines=items.map(line=>{
   const quantity=Math.max(1,Number(line.qty)||1),unitPrice=Number(line.unitPrice)||0;
   return '<article class="order-product-card"><div class="order-product-title"><strong>'+
    quantity+' × '+safe(line.name||'Produkt')+'</strong></div>'+
    '<div class="order-product-options">'+orderProductDetails(line)+'</div>'+
    '<div class="order-product-total"><span>Sum'+(quantity>1?' ('+quantity+' × '+money(unitPrice)+')':'')+'</span><strong>'+money(quantity*unitPrice)+'</strong></div></article>';
  }).join('');
  $('ordersDetail').innerHTML=
   '<div class="detail-summary"><div><div class="detail-status">'+safe(statusNames[o.status]||o.status)+' <span class="order-pickup-badge" data-kind="'+pickupKind(o)+'">'+pickupKind(o)+'</span></div><small>'+safe(when)+'</small></div><strong>'+money(o.total)+'</strong></div>'+
   '<details class="detail-customer-accordion" data-detail-accordion="'+safe(o.id)+'"'+(wasExpanded?' open':'')+'>'+
   '<summary><span class="detail-accordion-customer"><small>Kunde</small><strong>'+safe(o.name||o.customer?.fullName||'—')+'</strong></span>'+
   '<span class="detail-accordion-prep"><small>Tilberedning</small><strong>'+safe(o.prepMinutes?o.prepMinutes+' min':'—')+'</strong></span>'+
   '<span class="detail-accordion-chevron" aria-hidden="true">⌄</span></summary>'+
   '<div class="detail-facts"><div><label>Bestillings-ID</label><strong>#'+safe(o.id.slice(-8).toUpperCase())+'</strong></div>'+
   '<div><label>Bestilt</label><strong>'+fmtDate(o.createdAt)+'</strong></div>'+
   '<div><label>Godkjent</label><strong>'+fmtDate(o.acceptedAt)+'</strong></div>'+
   '<div><label>Henting</label><strong>'+pickupKind(o)+' · '+safe(pickup.label||'Snarest')+'</strong></div>'+
   '<div><label>Telefon</label>'+phoneLink+'</div>'+
   (mail?'<div><label>E-post</label><strong>'+safe(mail)+'</strong></div>':'')+
   '</div></details>'+
   '<section class="detail-items"><h3>Produkter</h3><div class="order-products-grid">'+lines+'</div></section>'+
   (o.rejectReason?'<p class="orders-feedback error">Avvist: '+safe(o.rejectReason)+'</p>':'')+
   '<div class="detail-total"><span>Totalt</span><strong>'+money(o.total)+'</strong></div>';
  $('ordersActionBar').innerHTML=o.status==='mottatt'?
   '<button class="orders-danger" type="button" data-action="reject">Avvis</button><button class="orders-primary" type="button" data-action="accept">Godta</button>':
   o.status==='godkjent'?'<button class="orders-primary" type="button" data-action="ready">Klar til henting</button>':
   '<button class="orders-secondary" type="button" data-action="close">Lukk</button>';
 }
 function openSheet(id){
  if(!orders.has(id))return;
  activeId=id;renderDetails();
  show('ordersSheetOverlay',true);show('ordersSheet',true);
  document.body.classList.add('is-dialog-open');
 }
 function closeSheet(){
  activeId=null;show('ordersSheetOverlay',false);show('ordersSheet',false);
  if($('ordersAcceptOverlay').hidden&&$('ordersRejectOverlay').hidden)document.body.classList.remove('is-dialog-open');
 }
 function closeDialog(){
  show('ordersAcceptOverlay',false);show('ordersRejectOverlay',false);
  if($('ordersSheet').hidden)document.body.classList.remove('is-dialog-open');
 }
 function startDialog(type,id=activeId){
  if(!id||!orders.has(id))return;
  activeId=id;show('ordersAcceptOverlay',type==='accept');show('ordersRejectOverlay',type==='reject');
  document.body.classList.add('is-dialog-open');
  if(type==='accept'){
   const order=orders.get(id);
   const later=order?.pickup?.mode==='scheduled';
   $('ordersPrep').value='';
   $('ordersPrep').disabled=later;
   $('ordersPrep').required=!later;
   $('ordersAcceptPrepBlock').hidden=later;
   $('ordersAcceptScheduled').hidden=!later;
   $('ordersAcceptScheduledTime').textContent=later?(order.pickup.label||''):'';
   if(!later)$('ordersPrep').focus();
  }
  if(type==='reject'){$('ordersRejectReason').value='';$('ordersRejectReason').focus()}
 }
 // Conditional, per-order write. No full /ORDERS download/overwrite for state changes.
 async function changeStatus(id,status,extra={},automatic=false){
  if(pendingAction)return;
  const old=orders.get(id);
  if(!old)throw Error('Bestillingen finnes ikke lenger.');
  if(status==='godkjent'&&old.status!=='mottatt')throw Error('Bestillingen er allerede behandlet.');
  if(status==='klar'&&old.status!=='godkjent')throw Error('Bare godkjente bestillinger kan markeres klare.');
  if(status==='avvist'&&old.status!=='mottatt')throw Error('Bare nye bestillinger kan avvises.');
  pendingAction=true;feedback('');
  try{
   const url=await authorizedURL('ORDERS/'+encodeURIComponent(id));
   const response=await fetch(url,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
   if(!response.ok)throw Error('Kunne ikke kontrollere bestillingen ('+response.status+').');
   const etag=response.headers.get('ETag');
   if(!etag)throw Error('Firebase returnerte ikke ETag. Bestillingen ble ikke endret.');
   const current=await response.json();
   if(!current||current.status!==old.status)throw Error('Bestillingen ble endret av en annen administrator. Oppdater siden.');
   if(automatic&&(status!=='klar'||current.status!=='godkjent'||!Number.isFinite(Number(current.expectedReadyAt))||Number(current.expectedReadyAt)<=0||Number(current.expectedReadyAt)>Date.now())){
    return;
   }
   const changedAt=Date.now();
   const next={...current,...extra,status,updatedAt:changedAt};
   if(status==='godkjent'){
    next.acceptedAt=changedAt;
    if(current.pickup?.mode==='scheduled'){
     const selected=scheduledPickupTimestamp(current.pickup);
     if(!selected||selected<=changedAt)throw Error('Valgt hentetid er passert eller ugyldig. Kontakt kunden før du godtar.');
     delete next.prepMinutes;
     next.expectedReadyAt=selected;
     next.pickupTimeAdjusted=false;
    }else{
     const minutes=Number(extra.prepMinutes);
     if(!Number.isInteger(minutes)||minutes<1||minutes>99)throw Error('Skriv inn gyldig tilberedningstid.');
     next.expectedReadyAt=changedAt+minutes*60000;
     next.pickupTimeAdjusted=false;
    }
   }
   if(status==='klar')next.readyAt=changedAt;
   if(status==='avvist')next.rejectedAt=changedAt;
   // Update the customer's non-personal status at the same time and under
   // the same ETag as the private order; no additional Firebase write.
   next.statusPublic={status,updatedAt:changedAt,
    ...(status==='godkjent'?{expectedReadyAt:next.expectedReadyAt,...(next.pickupTimeAdjusted?{pickupTimeAdjusted:true}:{})}:{}),
    ...(status==='klar'&&Number(current.statusPublic?.expectedReadyAt)>0?{
     expectedReadyAt:Number(current.statusPublic.expectedReadyAt),
     ...(current.statusPublic.pickupTimeAdjusted?{pickupTimeAdjusted:true}:{})
    }:{}),
    ...(status==='avvist'?{rejectReason:String(extra.rejectReason||'').slice(0,180)}:{})
   };
   const options={method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},
    body:JSON.stringify(next),cache:'no-store'};
   let saved=await fetch(url+'&print=silent',options);
   if(saved.status===400)saved=await fetch(url,options);
   if(saved.status===412)throw Error('Bestillingen ble endret samtidig. Hent oppdaterte opplysninger.');
   if(!saved.ok)throw Error('Kunne ikke lagre status ('+saved.status+').');
   orders.set(id,next);
   render();
   if(!automatic)closeDialog();
   if(!automatic)feedback(status==='godkjent'?'Bestillingen er godkjent.':status==='klar'?'Bestillingen er markert klar.':'Bestillingen er avvist.');
   if(status==='godkjent')void finalizeDueOrder();
   // Leave the successful result visible briefly, then return to the order inbox.
   if(!automatic&&activeId===id&&!$('ordersSheet').hidden){
    const completedId=id;
    window.setTimeout(()=>{
     if(activeId===completedId){
      closeSheet();
      filter='all';
      render();
     }
    },1000);
   }
  }finally{pendingAction=false}
 }
 // No Cloud Functions: prune while the order receiver is open.
 // Any overflow created while closed is cleaned the next time it opens.
 async function requestPrune(){
  if(pruning){pruneWanted=true;return}
  if(!authReady())return;
  pruning=true;
  try{
   do{
    pruneWanted=false;
    const url=await authorizedURL('ORDERS');
    // shallow=true returns order IDs only, never customer details.
    const r=await fetch(url+'&shallow=true',{cache:'no-store'});
    if(!r.ok){feedback('Kan ikke kontrollere ordregrensen (Firebase HTTP '+r.status+').',true);break}
    const keys=Object.keys(await r.json()||{}).sort();
    if(keys.length<=100)break;
    const excess=keys.slice(0,keys.length-100);
    const removals=Object.fromEntries(excess.map(id=>[id,null]));
    const deleted=await fetch(url+'&print=silent',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(removals)});
    if(!deleted.ok){feedback('Gamle bestillinger kunne ikke ryddes (Firebase HTTP '+deleted.status+').',true);break}
    for(const id of excess)orders.delete(id);
    render();
    // The keys response already proves that trimming this batch reaches 100.
    // Re-check only if new orders arrived during pruning.
   }while(pruneWanted&&authReady());
  }catch(error){console.warn('BestillOnline: pruning failed',error);feedback('Opprydding av gamle bestillinger feilet.',true)}
  finally{pruning=false}
 }
 let swipe=null;
 function events(){
  $('ordersLoginForm').addEventListener('submit',login);
  $('ordersSignOut').onclick=async()=>{closeStream();await auth.signOut();logoutView()};
  document.querySelectorAll('.orders-tabs button').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render()}));
  $('ordersList').addEventListener('click',async event=>{
   const ready=event.target.closest('[data-order-ready]');
   if(ready){
    try{await changeStatus(ready.dataset.orderReady,'klar')}catch(error){feedback(error.message,true)}return;
   }
   const open=event.target.closest('[data-order-open]');if(open)openSheet(open.dataset.orderOpen);
  });
  $('ordersList').addEventListener('touchstart',event=>{
   const row=event.target.closest('[data-order-row]');
   if(!row||!orders.get(row.dataset.orderRow)||orders.get(row.dataset.orderRow).status!=='godkjent')return;
   swipe={id:row.dataset.orderRow,x:event.changedTouches[0].clientX,y:event.changedTouches[0].clientY};
  },{passive:true});
  $('ordersList').addEventListener('touchend',event=>{
   if(!swipe)return;
   const start=swipe;swipe=null;
   const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;
   if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4){
    const row=$('ordersList').querySelector('[data-order-row="'+start.id+'"]');
    if(row){
     $('ordersList').querySelectorAll('.order-row.is-swiped').forEach(other=>{if(other!==row)other.classList.remove('is-swiped')});
     row.classList.toggle('is-swiped',dx<0);
    }
   }
  },{passive:true});
  $('ordersBack').onclick=closeSheet;$('ordersSheetOverlay').onclick=closeSheet;
  $('ordersPrint').onclick=()=>window.print();
  $('ordersActionBar').addEventListener('click',async event=>{
   const button=event.target.closest('[data-action]');if(!button)return;
   if(button.dataset.action==='accept'||button.dataset.action==='reject')startDialog(button.dataset.action);
   else if(button.dataset.action==='close')closeSheet();
   else if(button.dataset.action==='ready'){
    try{await changeStatus(activeId,'klar')}catch(error){feedback(error.message,true)}
   }
  });
  $('ordersCancelAccept').onclick=closeDialog;$('ordersCancelReject').onclick=closeDialog;
  $('ordersAcceptOverlay').addEventListener('click',event=>{if(event.target.id==='ordersAcceptOverlay')closeDialog()});
  $('ordersRejectOverlay').addEventListener('click',event=>{if(event.target.id==='ordersRejectOverlay')closeDialog()});
  $('ordersPrepMinus').onclick=()=>{
   const field=$('ordersPrep');
   field.value=String(Math.max(1,(Number(field.value)||1)-1));
  };
  $('ordersPrepPlus').onclick=()=>{
   const field=$('ordersPrep');
   field.value=String(Math.min(99,(Number(field.value)||0)+1));
  };
  $('ordersAcceptForm').addEventListener('submit',async event=>{
   event.preventDefault();
   const order=orders.get(activeId);
   const later=order?.pickup?.mode==='scheduled';
   const raw=$('ordersPrep').value.trim();
   const value=Number(raw);
   if(!later&&(!raw||!Number.isInteger(value)||value<1||value>99)){
    $('ordersPrep').reportValidity();return;
   }
   $('ordersConfirmAccept').disabled=true;
   try{await changeStatus(activeId,'godkjent',later?{}:{prepMinutes:value})}
   catch(error){feedback(error.message,true)}
   finally{$('ordersConfirmAccept').disabled=false}
  });
  $('ordersRejectForm').addEventListener('submit',async event=>{
   event.preventDefault();const reason=$('ordersRejectReason').value.trim();
   if(!reason)return;
   $('ordersConfirmReject').disabled=true;
   try{await changeStatus(activeId,'avvist',{rejectReason:reason.slice(0,180)})}
   catch(error){feedback(error.message,true)}
   finally{$('ordersConfirmReject').disabled=false}
  });
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden)stopCountdowns();
   else{startCountdowns();void finalizeDueOrder()}
  });
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;
   if(!$('ordersAcceptOverlay').hidden||!$('ordersRejectOverlay').hidden)closeDialog();
   else if(!$('ordersSheet').hidden)closeSheet();
  });
 }
 events();
 void boot();
})();