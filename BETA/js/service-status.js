/** Service indicators adapted from DEMO, without its customer data or listeners.
 * Checks real HTTP reachability; configured does not mean SMS/e-mail delivered.
 * Only 1 small backend health GET every 90 seconds when the tab is visible.
 */
import {config} from './config.js?v=20261021-beta28';
import {testHealth} from './test-orders.js?v=20261021-beta28';
import {checkEpsonConnection,currentPrinterHost,savePrinterHost} from './printer.js?v=20261021-beta28';
const $=id=>document.getElementById(id);
let healthBusy=false,printerBusy=false,lastHealth=0,healthTimer=null,started=false;
function indicator(name,mode,label,description){
 const node=$('service'+name);
 if(!node)return;
 node.classList.toggle('is-on',mode==='on');
 node.classList.toggle('is-error',mode==='error');
 node.classList.toggle('is-pending',mode==='pending');
 node.title=label+' · '+description;
 node.setAttribute('aria-label',label+': '+description);
 node.dataset.state=mode;
}
function printerHost(){
 const host=currentPrinterHost();
 $('servicePrinterIp').value=host;
 $('servicePrinterOpen').href=/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)?'https://'+host+'/':'#';
}
function printerMessage(message){
 $('servicePrinterMessage').textContent=message;
}
async function checkPrinter(){
 if(printerBusy||document.hidden)return;
 printerBusy=true;
 $('servicePrinterTest').disabled=true;
 indicator('Printer','pending','Epson kontrolleres','Kontrollerer ePOS via lokalnettet');
 printerMessage('Tester skriverens faktiske ePOS-tilkobling…');
 try{
  savePrinterHost($('servicePrinterIp').value);
  printerHost();
  await checkEpsonConnection();
  indicator('Printer','on','Epson tilkoblet','Skriveren svarte på ePOS-testen');
  printerMessage('Tilkobling bekreftet fra denne nettleseren.');
 }catch(error){
  const explanation=error?.message||'Kan ikke kontakte Epson';
  indicator('Printer','error','Epson frakoblet',explanation);
  printerMessage(explanation+'. Sjekk samme Wi-Fi og skriverens HTTPS-sertifikat.');
 }finally{
  printerBusy=false;$('servicePrinterTest').disabled=false;
 }
}
function unavailable(){
 indicator('Net','error','Internett frakoblet','API kan ikke kontrolleres uten internett');
 indicator('Sms','error','SMS ikke kontrollert','BETA-serveren kan ikke nås');
 indicator('Email','error','E-post ikke kontrollert','BETA-serveren kan ikke nås');
 $('connectionStatus').textContent='Ingen API-forbindelse';
 $('sidebarStatus').textContent='Ordremottak ikke tilgjengelig';
}
async function checkServices(force=false){
 if(healthBusy||document.hidden)return;
 if(!force&&Date.now()-lastHealth<85000)return;
 if(navigator.onLine===false){unavailable();return;}
 if(config.mode!=='firebase-test'&&!config.apiBase){unavailable();return;}
 healthBusy=true;
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),6500);
 try{
  if(config.mode==='firebase-test'){
   await testHealth();
   indicator('Net','on','Firebase tilkoblet','BETA testordrer leses fra den eksisterende databasen');
   indicator('Sms','pending','SMS avskrudd','Ingen SMS sendes fra BETA testbestillinger');
   indicator('Email','pending','E-post avskrudd','Ingen e-post sendes fra BETA testbestillinger');
   $('connectionStatus').textContent='Firebase BETA test';
   $('sidebarStatus').textContent='● Testordrer · Firebase Realtime Database';
   lastHealth=Date.now();return;
  }
  const url=config.apiBase.replace(/\/$/,'')+'/v1/tenants/'+encodeURIComponent(config.tenantId)+'/health';
  const result=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:ctrl.signal});
  if(!result.ok)throw new Error('HTTP '+result.status);
  const info=await result.json();
  if(info?.apiReachable!==true)throw new Error('Ugyldig helsesvar');
  indicator('Net','on','Internett og API tilgjengelig',info.ordersConfigured?'Serveroppsett funnet':'Ordremottak er ikke aktivert');
  indicator('Sms',info.smsConfigured?'pending':'error',info.smsConfigured?'SMS konfigurert':'SMS ikke konfigurert',
   info.smsConfigured?'Gateway-sending og mottak er ikke testet':'BETA_SMS_GATEWAY_TOKEN mangler på serveren');
  indicator('Email',info.emailConfigured?'pending':'error',info.emailConfigured?'E-post konfigurert':'E-post ikke konfigurert',
   info.emailConfigured?'E-postlevering er ikke testet':'E-postleverandør mangler på serveren');
  $('connectionStatus').textContent=info.ordersConfigured?'Ordre-API konfigurert':'Ordremottak ikke aktivert';
  $('sidebarStatus').textContent=info.ordersConfigured?'API-oppsett funnet · innlogging kreves':'Ordremottak ikke konfigurert';
  lastHealth=Date.now();
 }catch(error){
  indicator('Net','error','Ordre-API frakoblet','Kunne ikke bekrefte HTTP-tilkoblingen');
  indicator('Sms','error','SMS-status ukjent','Kunne ikke kontrollere BETA-serveren');
  indicator('Email','error','E-poststatus ukjent','Kunne ikke kontrollere BETA-serveren');
  $('connectionStatus').textContent='Ordre-API utilgjengelig';
  $('sidebarStatus').textContent='Ingen bekreftet ordretilkobling';
  lastHealth=Date.now();
 }finally{
  clearTimeout(timeout);healthBusy=false;
 }
}
export function startServiceStatus(){
 if(started)return;
 started=true;
 printerHost();
 indicator('Printer','pending','Epson ikke kontrollert','Trykk på skriverikonet for å teste lokalnettforbindelsen');
 $('serviceNet').addEventListener('click',()=>void checkServices(true));
 $('serviceSms').addEventListener('click',()=>void checkServices(true));
 $('serviceEmail').addEventListener('click',()=>void checkServices(true));
 $('servicePrinter').addEventListener('click',()=>{
  const panel=$('servicePrinterPanel');
  panel.hidden=!panel.hidden;
  $('servicePrinter').setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden){printerHost();void checkPrinter();}
 });
 $('servicePrinterTest').addEventListener('click',()=>void checkPrinter());
 $('servicePrinterIp').addEventListener('change',()=>{
  try{savePrinterHost($('servicePrinterIp').value);printerHost();}catch{printerMessage('Ugyldig IP-adresse.');}
 });
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-lastHealth>=85000)void checkServices();
 });
 window.addEventListener('online',()=>void checkServices(true));
 window.addEventListener('offline',unavailable);
 const restart=()=>{
  if(healthTimer===null)healthTimer=setInterval(()=>{if(!document.hidden)void checkServices();},90000);
 };
 window.addEventListener('pagehide',()=>{if(healthTimer!==null)clearInterval(healthTimer);healthTimer=null;});
 window.addEventListener('pageshow',()=>{restart();void checkServices(true);});
 restart();
 void checkServices(true);
}
