/**
 * Private, per-order status stream: never listens to Firebase /orders.
 * Requires an opaque, order-scoped customer token issued by the backend.
 * Only the visible order page opens a connection; status is never guessed from time.
 */
import {config} from './config.js?v=20261021-beta28';
import {getTestOrder} from './test-orders.js?v=20261021-beta28';

export const orderLabels=Object.freeze({
 mottatt:'Mottatt – venter på bekreftelse',
 bekreftet:'Bekreftet',tilberedning:'Tilberedes',klar:'Klar for henting',
 fullfort:'Utlevert',avvist:'Avvist'
});
const safeStatus=value=>Object.hasOwn(orderLabels,String(value||''))?String(value):null;
const activeStates=new Set(['mottatt','bekreftet','tilberedning','klar']);
const safeId=id=>/^[a-zA-Z0-9_-]{8,90}$/.test(String(id||''));
const root=()=>config.apiBase.replace(/\/$/,'')+'/v1/tenants/'+encodeURIComponent(config.tenantId);
export function orderCanTrack(order){
 if(config.mode==='firebase-test')return Boolean(/^test_[0-9]{13}_[a-f0-9]{12}$/.test(String(order?.id||''))&&activeStates.has(order?.status));
 return Boolean(config.apiBase&&safeId(order?.id)&&typeof order?.accessToken==='string'&&order.accessToken.length>=20&&activeStates.has(order?.status));
}
/**
 * The HTTP gateway MUST authenticate Authorization: Bearer <order accessToken>.
 * GET /orders/:id/events streams initial current status then only changes.
 * No personal data or full order collection should be returned in this stream.
 * The gateway must enforce tenant boundary, TTL and HTTP no-store.
 */
export function watchOrder(order,notify){
 if(!orderCanTrack(order)||typeof fetch!=='function')return ()=>{};
 if(config.mode==='firebase-test'){
  let stopped=false,timer=null,busy=false;
  async function check(){
   if(stopped||busy||document.hidden)return;
   busy=true;
   try{
    const remote=await getTestOrder(order.id);
    if(!remote||stopped)return;
    if(Number(remote.statusUpdatedAt)>Number(order.statusUpdatedAt||0)){
     order.status=remote.status;
     order.statusUpdatedAt=remote.statusUpdatedAt;
     order.estimatedReadyAt=remote.estimatedReadyAt||0;
     notify(order);
     if(!activeStates.has(remote.status))stop();
    }
   }catch(error){console.warn('BETA teststatus er midlertidig utilgjengelig');}
   finally{busy=false;}
  }
  function stop(){stopped=true;if(timer!==null)clearInterval(timer);timer=null;}
  void check();
  timer=setInterval(()=>{if(!document.hidden)void check();},10000);
  return stop;
 }
 let stopped=false,controller=null,timer=null,delay=5000,etag='';
 let consecutiveFailures=0;
 const base=root()+'/orders/'+encodeURIComponent(order.id);
 const headers=()=>({Authorization:'Bearer '+order.accessToken});
 const statusUpdate=payload=>{
  if(!payload||payload.id!==order.id)return;
  const status=safeStatus(payload.status);
  if(!status)return;
  const timestamp=Number(payload.statusUpdatedAt)||0;
  if(timestamp && Number(order.statusUpdatedAt)>timestamp)return;
  if(order.status===status&&Number(order.statusUpdatedAt)===timestamp)return;
  order.status=status;order.statusUpdatedAt=timestamp;
  if(Number.isFinite(Number(payload.estimatedReadyAt)))order.estimatedReadyAt=Number(payload.estimatedReadyAt);
  notify(order);
  if(!activeStates.has(status))stop();
 };
 function stop(){
  stopped=true;controller?.abort();controller=null;
  if(timer!==null)clearTimeout(timer);
  timer=null;
 }
 function later(){
  if(stopped)return;
  const backoff=delay;
  delay=Math.min(60000,delay*2);
  timer=setTimeout(()=>{timer=null;void stream();},backoff);
 }
 async function pollOnce(){
  if(stopped||document.hidden)return;
  try{
   const response=await fetch(base+'/status',{headers:{...headers(),...(etag?{'If-None-Match':etag}:{})},cache:'no-store',signal:controller?.signal});
   if(response.status===304)return;
   if(response.status===401||response.status===403||response.status===404){stop();return;}
   if(!response.ok)return;
   etag=response.headers.get('ETag')||'';
   statusUpdate(await response.json());
  }catch(error){if(error.name!=='AbortError')console.warn('Order status is temporarily unavailable');}
 }
 async function stream(){
  if(stopped||document.hidden)return;
  controller=new AbortController();
  try{
   const response=await fetch(base+'/events',{headers:{...headers(),Accept:'text/event-stream'},cache:'no-store',signal:controller.signal});
   if(response.status===401||response.status===403||response.status===404){stop();return;}
   if(!response.ok||!response.body||!response.headers.get('Content-Type')?.includes('text/event-stream'))throw new Error('SSE not available');
   delay=5000;consecutiveFailures=0;
   const reader=response.body.getReader();
   const decoder=new TextDecoder();
   let buffer='';
   while(!stopped){
    const {value,done}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    // Bound the memory used by an incorrect or malicious SSE response.
    if(buffer.length>16384)throw new Error('Oversized status event');
    let split;
    // Normalize Windows CRLF without assuming SSE chunk boundaries.
    buffer=buffer.replace(/\r\n/g,'\n');
    while((split=buffer.indexOf('\n\n'))>=0){
     const chunk=buffer.slice(0,split).replace(/\r/g,'');
     buffer=buffer.slice(split+2);
     const data=chunk.split('\n').filter(s=>s.startsWith('data:')).map(s=>s.slice(5).trimStart()).join('\n');
     if(data){try{statusUpdate(JSON.parse(data));}catch{}}
    }
   }
  }catch(error){
   if(!stopped&&error.name!=='AbortError'&&++consecutiveFailures===1)await pollOnce();
  }finally{
   controller=null;
   later();
  }
 }
 void stream();
 return stop;
}
