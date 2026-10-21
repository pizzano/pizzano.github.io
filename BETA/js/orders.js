/**
 * BETA-only realtime order transport. Authentication + RTDB, no own backend.
 * All write/read access is enforced by the deployed Firebase Security Rules.
 */
import {config} from './config.js?v=20261021-beta15';
const tenant=config.tenantId;
const path='beta/tenants/'+tenant+'/orders';
const adminsPath='beta/admins';
let apiPromise=null;
const version='10.14.1';
function failSetup(){
 if(!config.firebase?.apiKey||!config.firebase?.projectId||!config.orders?.databaseUrl)
  throw new Error('Firebase Authentication er ikke konfigurert. Bestillinger er deaktivert.');
 if(config.orders.databaseUrl.replace(/\/$/,'')===config.menu.databaseUrl.replace(/\/$/,''))
  throw new Error('Bestillingsdatabasen må isoleres fra den offentlige DEMO-databasen.');
}
async function client(){
 failSetup();
 if(apiPromise)return apiPromise;
 apiPromise=Promise.all([
  import('https://www.gstatic.com/firebasejs/'+version+'/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/'+version+'/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/'+version+'/firebase-database.js')
 ]).then(([base,auth,db])=>{
  const app=base.getApps().find(x=>x.name==='beta-'+tenant)||base.initializeApp({
   apiKey:config.firebase.apiKey,
   authDomain:config.firebase.authDomain||config.firebase.projectId+'.firebaseapp.com',
   projectId:config.firebase.projectId,
   databaseURL:config.orders.databaseUrl
  },'beta-'+tenant);
  return {auth,db,authClient:auth.getAuth(app),database:db.getDatabase(app,config.orders.databaseUrl)};
 }).catch(error=>{apiPromise=null;throw error;});
 return apiPromise;
}
async function signedCustomer(){
 const c=await client();
 await c.authClient.authStateReady();
 if(!c.authClient.currentUser)await c.auth.signInAnonymously(c.authClient);
 const user=c.authClient.currentUser;
 if(!user)throw new Error('Kunne ikke logge inn kunden.');
 return {...c,user};
}
export async function getAdminSession(){
 const c=await client();
 await c.authClient.authStateReady();
 if(!c.authClient.currentUser||c.authClient.currentUser.isAnonymous)return null;
 const user=c.authClient.currentUser;
 const role=await c.db.get(c.db.ref(c.database,adminsPath+'/'+user.uid+'/tenants/'+tenant));
 return role.val()==='admin'?{...c,user}:null;
}
export async function adminLogin(email,password){
 const c=await client();
 await c.auth.signInWithEmailAndPassword(c.authClient,email,password);
 const session=await getAdminSession();
 if(!session){await c.auth.signOut(c.authClient);throw new Error('Ingen admin-tilgang til denne restauranten.');}
 return session;
}
export async function adminLogout(){
 const c=await client();await c.auth.signOut(c.authClient);
}
const ticketKey='beta:pending:'+tenant;
function loadTicket(){try{return JSON.parse(localStorage.getItem(ticketKey)||'null');}catch{return null;}}
function saveTicket(ticket){try{localStorage.setItem(ticketKey,JSON.stringify(ticket));}catch{}}
function clearTicket(){try{localStorage.removeItem(ticketKey);}catch{}}
function newId(){
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 return 'ord_'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
function orderPayload(draft,uid,id){
 const t=Date.now();
 return {id,tenantId:tenant,customerUid:uid,customerName:String(draft.customerName||'').trim().slice(0,90),
  phone:String(draft.phone||'').replace(/\D/g,'').slice(0,15),email:String(draft.email||'').trim().slice(0,180),
  type:'henting',pickupMode:draft.pickupMode,
  pickup:draft.pickupMode==='asap'?'Snarest':draft.pickup,
  lines:draft.lines.map(line=>({
   itemId:String(line.itemId||''),productId:String(line.productId||line.itemId||''),
   name:String(line.name||'').slice(0,150),size:String(line.size||'').slice(0,80),
   sizeId:String(line.sizeId||''),quantity:Number(line.quantity),
   price:Number(line.price),options:Array.isArray(line.options)?line.options.slice(0,40):[],
   comment:String(line.comment||'').slice(0,500),
   removedIngredients:Array.isArray(line.removedIngredients)?line.removedIngredients.slice(0,30):[]
  })),
  total:Number(draft.total),status:'mottatt',createdAt:t,statusUpdatedAt:t,
  confirmationDeadline:t+180000,
  notification:{sms:'not_configured',email:'not_configured'}};
}
/** Exactly one generated id per identical pending draft; recover after lost ACK. */
export async function submitFirebaseOrder(draft){
 const c=await signedCustomer();
 const fingerprint=JSON.stringify(draft);
 let ticket=loadTicket();
 if(!ticket||ticket.uid!==c.user.uid||ticket.fingerprint!==fingerprint)
  ticket={id:newId(),uid:c.user.uid,fingerprint};
 const ref=c.db.ref(c.database,path+'/'+ticket.id);
 saveTicket(ticket);
 const payload=orderPayload(draft,c.user.uid,ticket.id);
 if(!/^\d{8}$/.test(payload.phone)||payload.customerName.length<2||!payload.lines.length||
    payload.lines.length>40||!Number.isFinite(payload.total)||payload.total<0)
  throw new Error('Ugyldig bestilling.');
 try{
  await c.db.set(ref,payload);
  clearTicket();return payload;
 }catch(error){
  // A retried write may be rejected because the first request already succeeded.
  try {
   const snap=await c.db.get(ref);
   if(snap.exists()&&snap.val().customerUid===c.user.uid){
    clearTicket();return snap.val();
   }
  }catch(_){}
  throw new Error('Firebase avviste bestillingen. Kontroller tilkobling og sikkerhetsregler.');
 }
}
export async function watchCustomerOrder(id,onChange){
 const c=await signedCustomer();
 const orderRef=c.db.ref(c.database,path+'/'+id);
 const unsubscribe=c.db.onValue(orderRef,snapshot=>{
  const value=snapshot.val();
  if(value&&value.customerUid===c.user.uid)onChange(value);
 },error=>onChange(null,error));
 return unsubscribe;
}
/** One ordered bounded admin listener; change events carry only changed children. */
export function watchAdminOrders(session,onChange,onError){
 const c=session;
 const q=c.db.query(c.db.ref(c.database,path),c.db.orderByChild('createdAt'),c.db.limitToLast(100));
 const stops=[
  c.db.onChildAdded(q,s=>onChange('upsert',s.key,s.val()),onError),
  c.db.onChildChanged(q,s=>onChange('upsert',s.key,s.val()),onError),
  c.db.onChildRemoved(q,s=>onChange('remove',s.key,null),onError)
 ];
 return ()=>stops.forEach(stop=>stop());
}
export async function updateAdminOrder(session,id,operation,value){
 const c=session,r=c.db.ref(c.database,path+'/'+id);
 let changed=false;
 const result=await c.db.runTransaction(r,current=>{
  if(!current)return;
  const now=Date.now();
  const prev=current.status;
  const final=['avvist','utlevert','fullfort'].includes(prev);
  if(final)return;
  if(operation==='godta'){
   if(prev!=='mottatt'||now>Number(current.confirmationDeadline||0))return;
   const mins=Math.max(5,Math.min(180,Number(value)||25));
   current.status='bekreftet';current.estimatedMinutes=mins;current.estimatedAt=now;
   current.estimatedReadyAt=now+mins*60000;
   current.pickupMode='asap';
   current.notification={...(current.notification||{}),sms:'not_configured',email:'not_configured'};
  }else if(operation==='godta-planlagt'){
   if(prev!=='mottatt'||now>Number(current.confirmationDeadline||0))return;
   const at=Number(value);
   if(!Number.isFinite(at)||at<=now||at>now+86400000)return;
   current.status='bekreftet';current.pickupMode='scheduled';
   current.scheduledPickupAt=at;current.estimatedReadyAt=at;
   current.notification={...(current.notification||{}),sms:'not_configured',email:'not_configured'};
  }else if(operation==='avvis'){
   if(prev!=='mottatt'&&prev!=='bekreftet')return;
   current.status='avvist';
   current.rejectionReason=String(value||'Bestillingen kunne ikke godtas.').slice(0,160);
  }else if(operation==='endre'){
   if(prev!=='bekreftet')return;
   const at=Number(value);
   if(!Number.isFinite(at)||at<=now||at>now+86400000)return;
   current.scheduledPickupAt=at;current.pickupMode='scheduled';
   current.estimatedReadyAt=at;current.estimateUpdatedAt=now;
  }else if(operation==='klar'){
   if(prev!=='bekreftet')return;
   current.status='klar';current.staffReadyAt=now;
  }else if(operation==='utlevert'){
   if(prev!=='klar')return;
   current.status='utlevert';current.deliveredAt=now;
  }else if(operation==='utlopt'){
   if(prev!=='mottatt'||now<=Number(current.confirmationDeadline||0))return;
   current.status='avvist';current.rejectionReason='Bekreftelsesfristen er utløpt.';
  }else return;
  current.statusUpdatedAt=now;changed=true;
  return current;
 },{applyLocally:false});
 if(!result.committed||!changed)throw new Error('Ordren ble endret eller handlingen er ikke tillatt. Oppdater.');
 return result.snapshot.val();
}
export async function deleteOldOrders(session,orders){
 const c=session,sorted=[...orders].filter(x=>x?.id)
  .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
 if(sorted.length<=100)return 0;
 // Only delete completed, settled orders after 72h. No archive.
 const eligible=sorted.slice(100).filter(o=>
  ['utlevert','fullfort','avvist'].includes(o.status)&&
  Date.now()-Math.max(Number(o.statusUpdatedAt)||0,Number(o.createdAt)||0)>72*3600000);
 let count=0;
 for(const o of eligible.slice(0,12)){
  const r=c.db.ref(c.database,path+'/'+o.id);
  const tx=await c.db.runTransaction(r,current=>{
   if(!current||!['utlevert','fullfort','avvist'].includes(current.status)||
      Date.now()-Math.max(Number(current.statusUpdatedAt)||0,Number(current.createdAt)||0)<=72*3600000)return;
   // Never delete a completed order before its pizza-bonus credit is reconciled.
   // Until a trusted bonus worker marks loyaltySettled=true, preserve it.
   if(current.status!=='avvist' && current.loyaltySettled!==true)return;
   return null;
  },{applyLocally:false});
  if(tx.committed)count++;
 }
 return count;
}
