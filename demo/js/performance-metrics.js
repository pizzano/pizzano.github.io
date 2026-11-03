/* Local browser measurements only. No phone numbers, order IDs, URLs,
 * customer content, network writes or app activity tracking.
 * Every measurement is a bounded duration under a fixed metric name. */
const KEY='kol_local_perf_v1';
const NAMES=Object.freeze({
  menu_render:'Meny', product_open:'Produktvindu', checkout_render:'Hentetid / kurv',
  firebase_read:'Firebase lesing', order_submit:'Ordresending',
  admin_orders_render:'Admin ordreliste', admin_accept:'Admin Godta',
});
const MAX_SAMPLES=24;
function safeRead() {
  try {
    const raw=JSON.parse(globalThis.localStorage?.getItem(KEY)||'{}');
    if (!raw || typeof raw!=='object') return {};
    return Object.fromEntries(Object.keys(NAMES).map(key=>[
      key,(Array.isArray(raw[key])?raw[key]:[])
        .filter(n=>Number.isFinite(n)&&n>=0&&n<=60000).slice(-MAX_SAMPLES)
    ]));
  } catch {return {};}
}
let samples=safeRead();
let pendingSave=null;
function flush() {
  pendingSave=null;
  try {globalThis.localStorage?.setItem(KEY,JSON.stringify(samples));}
  catch { /* local metrics should never block checkout or admin */ }
}
export function metricClock() {
  return typeof globalThis.performance?.now==='function'
    ? globalThis.performance.now() : Date.now();
}
export function recordDuration(name,started,ended=metricClock()) {
  if (!Object.hasOwn(NAMES,name)) return;
  const elapsed=Number(ended)-Number(started);
  if (!Number.isFinite(elapsed)||elapsed<0||elapsed>60000) return;
  const values=samples[name]||(samples[name]=[]);
  values.push(Math.round(elapsed*10)/10);
  if (values.length>MAX_SAMPLES)values.shift();
  if (!pendingSave && typeof globalThis.setTimeout==='function')
    pendingSave=setTimeout(flush,3000);
}
export function metricSummary() {
  // Pick up measurements saved by another tab of the same device.
  const saved=safeRead();
  return Object.entries(NAMES).map(([key,label])=>{
    const values=(samples[key]?.length?samples[key]:saved[key])||[];
    const sorted=[...values].sort((a,b)=>a-b);
    const avg=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;
    const p95=sorted.length?Math.round(sorted[Math.min(sorted.length-1,
      Math.ceil(sorted.length*.95)-1)]):null;
    return {key,label,samples:values.length,avg,p95};
  });
}
export function clearMetrics() {
  samples={};
  if (pendingSave)clearTimeout(pendingSave);
  pendingSave=null;
  try {globalThis.localStorage?.removeItem(KEY);}catch {}
}
if (typeof globalThis.window!=='undefined') {
  window.addEventListener('pagehide',()=>{if(pendingSave)clearTimeout(pendingSave);flush();});
}
