/* Share in-flight, opt-in Firebase GETs; never cache settled responses. */
(function(root){
'use strict';
function create(fetcher){
 const pending=new Map();
 const allowed=new Set(['cache','signal','credentials','method','headers','mode','redirect','referrer','referrerPolicy','integrity','keepalive','priority']);
 function get(url,options={}){
  const headers=new Headers(options.headers);
  if(String(options.method||'GET').toUpperCase()!=='GET'||Object.keys(options).some(k=>!allowed.has(k))||[...headers.keys()].some(k=>k.startsWith('if-')||k==='x-firebase-etag'||k==='range'))return fetcher(url,options);
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!(/\.firebaseio\.com$|\.firebasedatabase\.app$/).test(parsed.hostname)||!parsed.pathname.endsWith('.json'))return fetcher(url,options);
  const key=JSON.stringify([parsed.href,[...headers.entries()],Object.keys(options).filter(k=>k!=='signal'&&k!=='headers'&&k!=='method').sort().map(k=>[k,options[k]])]);
  const signal=options.signal,reason=()=>signal?.reason||new DOMException('Aborted','AbortError');
  if(signal?.aborted)return Promise.reject(reason());
  let entry=pending.get(key);
  if(!entry){
   entry={controller:new AbortController(),users:new Set(),done:false};
   pending.set(key,entry);
   const finish=(error,response)=>{
    entry.done=true;
    if(pending.get(key)===entry)pending.delete(key);
    for(const user of [...entry.users]){
     if(error)user.fail(error);
     else try{user.ok(response.clone())}catch(e){user.fail(e)}
    }
    // Release the unused original stream branch after cloning.
    if(response?.body)void response.body.cancel().catch(()=>{});
   };
   Promise.resolve().then(()=>{
    if(entry.controller.signal.aborted)throw entry.controller.signal.reason;
    return fetcher(url,{...options,signal:entry.controller.signal});
   }).then(async r=>{
    // Keep sharing through body download, not merely until headers arrive.
    // An independent buffered response is safe for every caller.
    if(r.body)await r.clone().arrayBuffer();
    finish(null,r);
   }).catch(e=>finish(e||Error('Firebase request failed')));
  }
  return new Promise((resolve,reject)=>{
   let active=true;
   const detach=()=>{
    if(!active)return false;
    active=false;entry.users.delete(user);signal?.removeEventListener('abort',abort);
    if(!entry.done&&!entry.users.size){
     if(pending.get(key)===entry)pending.delete(key);
     entry.controller.abort();
    }
    return true;
   };
   const abort=()=>{if(detach())reject(reason())};
   const user={ok:r=>{if(detach())resolve(r)},fail:e=>{if(detach())reject(e)}};
   entry.users.add(user);
   signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted)abort();
  });
 }
 return {get};
}
const api={create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.BOFirebaseIO=create((url,options)=>root.fetch(url,options));
})(typeof globalThis!=='undefined'?globalThis:this);
