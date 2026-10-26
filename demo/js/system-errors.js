// Privacy-safe, best-effort diagnostics. Does not depend on data.js so that
// reporting failures cannot recursively invoke the main Firebase error path.
const CATEGORY = Object.freeze({
  order_create:'Sipariş oluşturma', order_accept:'Godta', firebase:'Firebase',
  sms:'SMS', email:'E-post', loyalty:'Sadakat', timeout:'Zaman aşımı'
});
const REASONS = Object.freeze({
  network:'Bağlantı kesintisi veya erişilemeyen servis',
  http:'Firebase erişimi veya veritabanı kuralları',
  timeout:'İstek zaman sınırını aştı',
  state:'Beklenmeyen işlem durumu',
  provider:'Bildirim servisi veya gönderim hatası',
  unknown:'İşlem başarısız; ayrıntılar uygulama kayıtlarında'
});
const pending = new Set();
const url = () => String(globalThis.window?.BESTILL_CONFIG?.databaseUrl || '').replace(/\/$/,'');
export function diagnosticCode(category, reason) {
  return CATEGORY[category] && REASONS[reason] ? category + '_' + reason : 'firebase_unknown';
}
export function diagnosticEntry(category, reason, severity='warning', now=Date.now(), intentional=false) {
  const code=diagnosticCode(category,reason);
  const c=code.split('_'); // category name may contain underscore: use explicit lookup.
  const kind=Object.keys(CATEGORY).find(k=>code.startsWith(k+'_')) || 'firebase';
  const reasonKey=code.slice(kind.length+1);
  return {code, category:kind, operation:CATEGORY[kind], reason:reasonKey,
    severity:['critical','warning','info'].includes(severity)?severity:'warning',
    message:CATEGORY[kind]+' mislyktes', possibleCause:REASONS[reasonKey]||REASONS.unknown,
    firstSeen:now,lastSeen:now,count:1,read:false,resolved:false,
    intentionalTest:Boolean(intentional)};
}
export async function reportSystemError(category, reason='unknown', severity='warning', options={}) {
  if (!url() || options?.disabled) return false;
  const entry=diagnosticEntry(category,reason,severity,Date.now(),options?.intentionalTest);
  // Separate intentional tests from real failures. Key contains no user data.
  const key=(entry.intentionalTest?'test_':'')+entry.code;
  if(pending.has(key))return false;
  pending.add(key);
  try {
    const endpoint=url()+'/systemErrors/'+key+'.json';
    for(let attempt=0;attempt<2;attempt++){
      const response=await fetch(endpoint,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
      if(!response.ok)return false;
      const old=await response.json();
      const etag=response.headers.get('ETag');
      if(!etag)return false;
      const record=old&&typeof old==='object'
        ? {...old,lastSeen:entry.lastSeen,count:Math.max(0,Number(old.count)||0)+1,
           severity:entry.severity, read:false, resolved:false}
        : entry;
      const saved=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},
        body:JSON.stringify(record)});
      if(saved.ok)return true;
      if(saved.status!==412)return false;
    }
  } catch { /* Diagnostics may never stop checkout or re-report themselves. */ }
  finally {pending.delete(key);}
  return false;
}
// Read-only safe view; callers explicitly choose when to fetch.
export async function readSystemErrors() {
  if(!url())return {};
  const response=await fetch(url()+'/systemErrors.json',{cache:'no-store'});
  if(!response.ok)throw new Error('diagnostics_read_failed');
  return await response.json() || {};
}
export async function setSystemErrorStatus(key,patch) {
  if(!/^(test_)?(?:order_create|order_accept|firebase|sms|email|loyalty|timeout)_(?:network|http|timeout|state|provider|unknown)$/.test(key))return false;
  if(!url() || !patch || Object.keys(patch).some(k=>!['read','resolved'].includes(k)))return false;
  const response=await fetch(url()+'/systemErrors/'+key+'.json',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(patch)});
  return response.ok;
}

// Manual, conservative archive: only resolved entries older than 30 days.
// Archive first; delete via ETag only if source was unchanged. No customer data.
export async function archiveResolvedSystemErrors(now=Date.now()) {
  const records=await readSystemErrors();
  let archived=0;
  const keys=Object.keys(records).filter(key=>
    /^(test_)?(?:order_create|order_accept|firebase|sms|email|loyalty|timeout)_(?:network|http|timeout|state|provider|unknown)$/.test(key)
    && records[key]?.resolved===true && Number(records[key].lastSeen)>0
    && now-Number(records[key].lastSeen)>=30*86400000);
  for(const key of keys.slice(0,25)){
    try{
      const source=url()+'/systemErrors/'+key+'.json';
      const currentResponse=await fetch(source,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
      if(!currentResponse.ok)continue;
      const current=await currentResponse.json(),etag=currentResponse.headers.get('ETag');
      if(!etag||!current?.resolved||now-Number(current.lastSeen)<30*86400000)continue;
      const archive=await fetch(url()+'/systemErrorsArchive/'+key+'.json',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...current,archivedAt:now})});
      if(!archive.ok)continue;
      const deleted=await fetch(source,{method:'DELETE',headers:{'if-match':etag}});
      if(deleted.ok)archived++;
    }catch{/* Continue safely; never report recorder's errors. */}
  }
  return archived;
}
