const test=require('node:test'),fs=require('node:fs'),path=require('node:path');

async function checkSharing(source){
 const channels=new Set(),queue=new Map(),events=[];
 const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve()};
 const assert=(ok,label)=>{if(!ok)throw Error(label);events.push(label)};
 class Channel{constructor(scope){this.scope=scope;channels.add(this)}postMessage(data){for(const c of channels)if(c!==this&&c.scope===this.scope)c.onmessage?.({data})}close(){channels.delete(this)}}
 class Controller{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}}
 const locks={request(scope,opts,fn){return new Promise((resolve,reject)=>{const q=queue.get(scope)||[];queue.set(scope,q);q.push({opts,fn,resolve,reject});if(q.length===1)run(q)})}};
 function run(q){if(!q.length)return;const a=q[0];Promise.resolve().then(()=>a.opts.signal.aborted?undefined:a.fn()).then(a.resolve,a.reject).finally(()=>{q.shift();run(q)})}
 class Encoder{encode(s){return Uint8Array.from(Array.from(s,c=>c.charCodeAt(0)))}}
 class Decoder{decode(a){return String.fromCharCode(...a)}}
 // Crypto is mocked only to exercise channel/lock orchestration; not a cryptographic test.
 const fakeCrypto={getRandomValues:a=>a,subtle:{digest:async(_,a)=>Uint8Array.from([a[a.length-1]]).buffer,importKey:async(_,a)=>new Uint8Array(a)[0],encrypt:async(_,key,a)=>[key,a],decrypt:async(_,key,a)=>{if(a[0]!==key)throw Error('wrong session');return a[1]}}};
 const factory=new Function('env',source+'\nreturn {startAdminSharing,closeAdminSharing,broadcastAdminState,ownsAdminStreams,inspect:()=>({leader:adminLeader,sharing:adminSharing,ids:[...orders.keys()]})}');
 function tab(id,secret,allowed=true){
  const env={id,secret,allowed,Channel,Controller,locks,fakeCrypto,Encoder,Decoder,opened:0,closed:0};
  const prefix="const ADMIN_UID='admin',auth={currentUser:{refreshToken:env.secret}},authReady=()=>env.allowed,BroadcastChannel=env.Channel,AbortController=env.Controller,navigator={locks:env.locks},crypto=env.fakeCrypto,TextEncoder=env.Encoder,TextDecoder=env.Decoder;let orders=new Map(),sourceSnapshots=new Map(),knownKeys=new Set(),initialLoaded=false,indexedMode=true,keysReady=false,historyForceRefresh=false,historySyncPending=false,countdownTicker=null;const isOrder=o=>!!o?.id,mergeOrder=o=>orders.set(o.id,o),removeHistoryRecord=()=>{},connection=()=>{},render=()=>{},hydrateRecentHistory=async()=>{},startCountdowns=()=>{countdownTicker=1},closeStream=()=>{env.closed++};async function connectOrders(){env.opened++;initialLoaded=true;keysReady=true;orders.set('test',{id:'test'});knownKeys.add('test');broadcastAdminState();}";
  return {env,api:new Function('env',prefix+source+'\nreturn {startAdminSharing,closeAdminSharing,broadcastAdminState,ownsAdminStreams,inspect:()=>({leader:adminLeader,sharing:adminSharing,ids:[...orders.keys()]})}')(env)};
 }
 const a=tab('a','same'),b=tab('b','same'),u=tab('u','same',false);
 await a.api.startAdminSharing();await b.api.startAdminSharing();await u.api.startAdminSharing();await flush();
 assert(a.env.opened+b.env.opened===1,'one leader stream owner');
 assert(b.api.inspect().ids.includes('test'),'follower receives state');
 assert(u.env.opened===0&&!u.api.inspect().sharing,'unauthorized tab blocked');
 const lead=a.api.inspect().leader?a:b,follow=lead===a?b:a;
 lead.api.closeAdminSharing();await flush();
 assert(follow.api.inspect().leader&&follow.env.opened===1,'follower takes over on close');
 const other=tab('other','different');await other.api.startAdminSharing();await flush();
 assert(other.api.inspect().leader,'different session isolated');
 follow.api.closeAdminSharing();other.api.closeAdminSharing();await flush();
 assert(channels.size===0,'channel cleanup');
 return events;
}
test('admin multi-tab coordination with mocked browser primitives',async()=>{const code=fs.readFileSync(path.join(__dirname,'../admin/orders.js'),'utf8');const source=code.slice(code.indexOf(' const ADMIN_STREAM_LOCK='),code.indexOf(' function closeStream(){'));await checkSharing(source)});
