/* BestillOnline /ORDERS retention.
 * Deploy using Firebase CLI from BETA/ (see ORDERS-SETUP.md).
 * Never put service-account keys in this repository.
 */
'use strict';
const {onValueCreated}=require('firebase-functions/v2/database');
const {initializeApp,getApp,applicationDefault}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const DATABASE_URL='https://kol-grill-pizza-1-default-rtdb.firebaseio.com';
initializeApp({credential:applicationDefault(),databaseURL:DATABASE_URL});
const MAX_ORDERS=100;
async function listOrderKeys(){
 const credential=getApp().options.credential;
 const token=await credential.getAccessToken();
 const response=await fetch(DATABASE_URL+'/ORDERS.json?shallow=true',{
  headers:{Authorization:'Bearer '+token.access_token},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error('Read order keys failed: HTTP '+response.status);
 const result=await response.json();
 return Object.keys(result&&typeof result==='object'?result:{}).sort();
}
// A single shallow GET reads only order keys (a few KB for 100 entries).
// An atomic PATCH deletes all older keys without downloading order contents.
exports.retainNewest100Orders=onValueCreated({
 ref:'/ORDERS/{orderId}',
 instance:'kol-grill-pizza-1-default-rtdb',
 region:'europe-west1',
 maxInstances:1,
 concurrency:1,
 timeoutSeconds:60,
 retry:true
},async()=>{
 for(let pass=0;pass<8;pass++){
  const keys=await listOrderKeys();
  if(keys.length<=MAX_ORDERS)return;
  const remove=Object.fromEntries(keys.slice(0,keys.length-MAX_ORDERS).map(key=>[key,null]));
  await getDatabase().ref('/ORDERS').update(remove);
 }
 throw Error('More than 100 orders remain; retry cleanup.');
});