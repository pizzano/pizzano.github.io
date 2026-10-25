/**
 * KØL Grill & Pizza - Google Apps Script SMS bridge
 * Trigger: ~every 1 minute, no shop PC required.
 * SMS via Traccar Cloud -> Android phone with ice SIM.
 * Free Apps Script quotas apply. Not a guaranteed real-time service.
 * Sends via Traccar; a cloud acknowledgement does not prove handset delivery.
 *
 * PRIVATE script properties (Project Settings > Script properties):
 *   TRACCAR_TOKEN = <rotated Traccar Cloud token>
 *   TEST_PHONE    = +47XXXXXXXX (your own test receiving number)
 *
 * TEST mode sends only to TEST_PHONE. LIVE requires manual setupLiveSms()
 * after fresh-token verification. No credentials go into GitHub/browser JS.
 * ONE customer SMS per order: confirmation with expected pickup time.
 * No follow-up when staff changes pickup time or marks the order ready.
 * No timer-based SMS is ever sent.
 */

const KOL_SMS = Object.freeze({
  databaseUrl: 'https://kol-grill-pizza-default-rtdb.firebaseio.com',
  gatewayUrl: 'https://www.traccar.org/sms/',
  pollMinutes: 1,
  recentOrders: 80,
  orderAgeLimitMs: 24 * 60 * 60 * 1000,
  eventAgeLimitMs: 12 * 60 * 1000,
  maxPerRun: 6,
  maxPerDay: 100, // confirmations only; at most one automatic SMS per order
  // LIVE still requires an explicit, verified setupLiveSms() call.
  // Changing Script Properties alone cannot bypass the fresh-token check.
  allowLiveMode: true,
});

/** SHA256 fingerprint only, never store the token again or print it. */
function kolTokenHash_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return bytes.map(v => (v & 255).toString(16).padStart(2,'0')).join('');
}

function kolProps_() {
  return PropertiesService.getScriptProperties();
}

function kolPhone_(raw) {
  let value = String(raw || '').replace(/[\s().+-]/g, '');
  if (value.startsWith('0047')) value = value.slice(4);
  else if (value.startsWith('47') && value.length === 10) value = value.slice(2);
  if (!/^[49]\d{7}$/.test(value)) return '';
  return '+47' + value;
}

function kolShortCode_(orderId) {
  return String(orderId || '').slice(-6).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function kolTime_(order) {
  const timestamp = Number(order.scheduledPickupAt) || Number(order.estimatedReadyAt);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return Utilities.formatDate(new Date(timestamp), 'Europe/Oslo', 'HH:mm');
  }
  // In the compact order schema, pickupMode may be absent; pickup is
  // already either "Snarest" or a selected HH:mm slot.
  const manuallySelected = String(order.pickup || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(manuallySelected);
  if (!match) return '';
  const hours = Number(match[1]), minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
    ? String(hours).padStart(2, '0') + ':' + match[2] : '';
}

/** Norwegian clock time for an ASAP order's stored kitchen-ready estimate.
 * Never derive an absolute pickup time from when the scheduled poll happens:
 * that may be a minute or more after staff confirmed the order.
 */
function kolAsapReadyClock_(order) {
  let timestamp = Number(order.estimatedReadyAt) || 0;
  if (!(Number.isFinite(timestamp) && timestamp > 0)) {
    const acceptedAt = Number(order.estimatedAt) || 0;
    const prepMinutes = Number(order.estimatedMinutes) || 0;
    if (Number.isFinite(acceptedAt) && acceptedAt > 0 &&
        Number.isFinite(prepMinutes) && prepMinutes > 0 && prepMinutes <= 180) {
      timestamp = acceptedAt + prepMinutes * 60000;
    }
  }
  return Number.isFinite(timestamp) && timestamp > 0
    ? Utilities.formatDate(new Date(timestamp), 'Europe/Oslo', 'HH:mm')
    : '';
}

/** Human-readable preparation estimate for SMS {tidsinfo}.
 * For Snarest, use the number of minutes chosen by staff.
 * For selected pickup slots, express the remaining time when SMS is sent.
 * This text follows "Bestillingen din er klar om {tidsinfo}" naturally.
 */
function kolTidsinfo_(order) {
  const scheduled = order.pickupMode === 'scheduled' ||
    /^\d{1,2}:\d{2}$/.test(String(order.pickup || '').trim());
  let minutes = Number(order.estimatedMinutes) || 0;
  if (scheduled) {
    const time = Number(order.scheduledPickupAt) || Number(order.estimatedReadyAt);
    if (Number.isFinite(time) && time > Date.now()) {
      minutes = Math.ceil((time - Date.now()) / 60000);
    }
  }
  minutes = Math.round(minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return 'kort tid';
  if (minutes < 60) return 'ca. ' + minutes + (minutes === 1 ? ' minutt' : ' minutter');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours + (hours === 1 ? ' time' : ' timer');
  return 'ca. ' + hourLabel + (rest ? ' og ' + rest + (rest === 1 ? ' minutt' : ' minutter') : '');
}

/** Validate an absolute HTTPS customer-page URL. New orders record the
 * real site directory. Set Script Property ORDER_PAGE_URL for legacy orders.
 */
function kolCustomerPageUrl_(order) {
  const props = PropertiesService.getScriptProperties();
  const candidate = String((order && order.orderPageUrl) || props.getProperty('ORDER_PAGE_URL') || '').trim();
  if (candidate.length > 300 || /[?#\\\s]/.test(candidate))
    throw new Error('Ugyldig kunde-URL');
  const match = /^https:\/\/([a-z0-9.-]+)(?::[0-9]{1,5})?(\/[a-z0-9._~%!$&'()*+,;=:@/-]*)?$/i.exec(candidate);
  if (!match || !match[1].includes('.') || match[1].includes('..'))
    throw new Error('Ordren mangler gyldig kunde-URL. Eldre ordre krever Script Property ORDER_PAGE_URL.');
  return candidate.replace(/\/?(?:index|admin)\.html$/i, '/').replace(/\/+$/, '') + '/';
}

/** Full order ID is a private link; never put customer data in the URL. */
function kolOrderLink_(order, orderId) {
  const id = String(orderId || '').trim();
  if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(id))
    throw new Error('Invalid order ID for SMS link');
  return kolCustomerPageUrl_(order) + '?order=' + encodeURIComponent(id);
}

/** One confirmation SMS with Norwegian clock time, never a calendar date. */

/** Admin-controlled text, read fresh on each polling run. */
function kolReadSmsTemplate_() {
  try {
    const response=UrlFetchApp.fetch(KOL_SMS.databaseUrl+'/notificationTemplates/smsAccepted.json',
      {method:'get',muteHttpExceptions:true});
    if(response.getResponseCode()!==200)return null;
    const value=JSON.parse(response.getContentText()||'null');
    return value && value.version===1 && typeof value.body==='string'
      && value.body.length>0 && value.body.length<=2200 && value.body.includes('{lenke}')
      ? value.body : null;
  }catch(error){console.warn('SMS-mal kunne ikke lastes: '+error.message);return null;}
}
/** Template variables are substituted server-side; the recipient is never a variable. */
function kolMessage_(order,eventKind,orderId,template) {
  if(eventKind!=='accepted')throw new Error('Only confirmation SMS is permitted');
  const first=String(order.customerName||'').trim().split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu,'').slice(0,20);
  const scheduled=order.pickupMode==='scheduled'||/^\d{1,2}:\d{2}$/.test(String(order.pickup||'').trim());
  const clock=scheduled?kolTime_(order):kolAsapReadyClock_(order);
  const code=kolShortCode_(orderId),link=kolOrderLink_(order,orderId);
  const defaultBody='Hei '+(first||'kunde')+'! Bestillingen din er bekreftet ✅\n\n'
   +'Forventet hentetid: '+(clock?'kl. '+clock:'snarest')+'\n\n'
   +'Se bestillingen: '+link+'\n\nKØL Grill & Pizza';
  if(typeof template!=='string'||!template.trim())return defaultBody;
  const vars={navn:first||'kunde',kode:code,lenke:link,hentetid:clock||'snarest',
    tidsinfo:kolTidsinfo_(order),
    hentetype:scheduled?'Planlagt henting':'Snarest',
    total:String(Number(order.total)||0)+' kr',
    varer:(Array.isArray(order.lines)?order.lines:[]).map(x=>String(x.quantity||1)+' × '+String(x.name||'Produkt')).join(', ')};
  const message=template.replace(/\{([a-zA-Z]+)\}/g,function(token,key){
    return Object.prototype.hasOwnProperty.call(vars,key)?vars[key]:token;
  }).replace(/kl\. snarest\b/gi,'snarest').trim();
  return message.length<=2200 && message.length>0?message:defaultBody;
}

function kolApiSend_(to, message, token) {
  const result = UrlFetchApp.fetch(KOL_SMS.gatewayUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: token },
    payload: JSON.stringify({ to: to, message: message }),
    muteHttpExceptions: true,
  });
  const http = result.getResponseCode();
  let response = null;
  try { response = JSON.parse(result.getContentText()); } catch (_) {}
  const success = http >= 200 && http < 300 && response
    && Number(response.successCount) >= 1 && Number(response.failureCount || 0) === 0;
  if (!success) throw new Error('Traccar SMS rejected the request; HTTP ' + http);
  const props = kolProps_();
  props.setProperty('KOL_LAST_SMS_OK', new Date().toISOString());
  return true;
}

/** Public, non-sensitive SMS diagnostics/receipts are stored in Firebase.
 * Configure RTDB rules so only the trusted sender may WRITE these paths;
 * the existing open REST writes are not an authentication boundary.
 * A failed status/receipt write must never retry an already-submitted SMS.
 */
function kolFirebaseSmsPut_(path, value) {
  if (!/^(smsHealth|notificationTests\/smsAccepted\/result|orders\/ord_[a-zA-Z0-9]{7,40}\/smsReceipts\/(accepted|ready|estimateUpdated))$/.test(path)) {
    throw new Error('Unexpected Firebase SMS path');
  }
  const response = UrlFetchApp.fetch(KOL_SMS.databaseUrl + '/' + path + '.json', {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(value),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Firebase SMS write rejected (HTTP ' + response.getResponseCode() + ')');
  }
}

function kolSmsHeartbeat_(mode, checkedAt) {
  kolFirebaseSmsPut_('smsHealth', {
    source: 'apps-script-sms-poller',
    liveConfigured: mode === 'LIVE' && KOL_SMS.allowLiveMode,
    checkedAt: checkedAt,
    status: 'ok',
  });
}

function kolSmsReceipt_(orderId, kind, sentAt) {
  if (!Number.isSafeInteger(Number(sentAt)) || Number(sentAt) <= 0) return;
  kolFirebaseSmsPut_('orders/' + orderId + '/smsReceipts/' + kind, {
    state: 'accepted', // Traccar accepted the request; not handset delivery.
    provider: 'Traccar',
    sentAt: Number(sentAt),
  });
}

function kolFetchRecentOrders_() {
  // Firebase index: /orders .indexOn ["statusUpdatedAt"].
  // Read only orders with a recently modified status; do not download
  // historical orders or query estimateUpdatedAt (no second SMS).
  const since = Date.now() - Math.min(KOL_SMS.orderAgeLimitMs,
    KOL_SMS.eventAgeLimitMs + 5 * 60 * 1000);
  const url = KOL_SMS.databaseUrl + '/orders.json?orderBy=' +
    encodeURIComponent(JSON.stringify('statusUpdatedAt')) +
    '&startAt=' + encodeURIComponent(String(since));
  const resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  if (resp.getResponseCode() === 200) {
    const orders = JSON.parse(resp.getContentText() || 'null');
    return orders && typeof orders === 'object' ? orders : {};
  }
  // Only temporary fallback if the index isn't configured yet.
  // Never make an unlimited request to /orders.json.
  console.warn('SMS statusUpdatedAt indeks lesefeil (HTTP ' +
    resp.getResponseCode() + '). Bruker begrenset reserve.');
  const fallbackUrl = KOL_SMS.databaseUrl + '/orders.json?orderBy=' +
    encodeURIComponent(JSON.stringify('$key')) + '&limitToLast=' + KOL_SMS.recentOrders;
  const fallback = UrlFetchApp.fetch(fallbackUrl,
    { method: 'get', muteHttpExceptions: true });
  if (fallback.getResponseCode() !== 200) {
    throw new Error('Firebase orders cannot be read: HTTP ' + fallback.getResponseCode());
  }
  const data = JSON.parse(fallback.getContentText() || 'null');
  return data && typeof data === 'object' ? data : {};
}

function kolEvent_(order, activatedAt, now) {
  if (!order || typeof order !== 'object' || order.status !== 'bekreftet') return '';
  const createdAt = Number(order.createdAt) || 0;
  const changedAt = Number(order.statusUpdatedAt) || 0;
  if (!(createdAt && changedAt && changedAt >= activatedAt && changedAt <= now + 10000)) return '';
  if (createdAt < now - KOL_SMS.orderAgeLimitMs) return '';
  if (changedAt < now - KOL_SMS.eventAgeLimitMs) return '';
  return 'accepted';
}

function kolPropertyJson_(props, key) {
  try { return JSON.parse(String(props.getProperty(key) || 'null')); }
  catch (_) { return null; }
}

function kolTodayCounter_(props, dateKey) {
  return Number(props.getProperty('KOL_COUNT_' + dateKey) || 0);
}

function kolPurgeOldCounters_(props, currentDay) {
  // Old daily counters remain harmless for this small pilot, but remove
  // stale keys monthly to keep ScriptProperties within its free storage quota.
  const suffix = currentDay.replace(/-/g, '');
  const keys = Object.keys(props.getProperties());
  for (const key of keys) {
    if (key.indexOf('KOL_COUNT_') === 0 && key !== 'KOL_COUNT_' + suffix) {
      props.deleteProperty(key);
    }
  }
}


/** Admin test. Firebase request contains no recipient. Fixed TEST_PHONE only.
 * Reserve ID and quota before gateway call to avoid accidental resend.
 */
function kolCheckSmsTest_(props, token, fixedPhone) {
  const response=UrlFetchApp.fetch(KOL_SMS.databaseUrl+'/notificationTests/smsAccepted/request.json',
    {method:'get',muteHttpExceptions:true});
  if(response.getResponseCode()!==200)return;
  const request=JSON.parse(response.getContentText()||'null');
  if(!request||request.kind!=='smsAccepted'||!/^nt_[a-z0-9_]{8,45}$/.test(String(request.id)))return;
  const id=String(request.id);
  if(id===props.getProperty('KOL_SMS_TEST_LAST_ID'))return;
  props.setProperty('KOL_SMS_TEST_LAST_ID',id);
  const now=Date.now();
  const result=(state,message)=>{
    try{kolFirebaseSmsPut_('notificationTests/smsAccepted/result',{id,state,at:Date.now(),message})}
    catch(error){console.error('SMS teststatus kan ikke lagres: '+error.message)}
  };
  if(Math.abs(now-Number(request.requestedAt))>10*60000){result('ignored','Utløpt testforespørsel.');return}
  const date=Utilities.formatDate(new Date(now),'Europe/Oslo','yyyyMMdd');
  const count=props.getProperty('KOL_SMS_TEST_DAY')===date?Number(props.getProperty('KOL_SMS_TEST_COUNT')||0):0;
  const since=now-Number(props.getProperty('KOL_SMS_TEST_LAST_AT')||0);
  if(count>=3||since<180000){result('rate_limited','Maks 3 tester per dag og 3 minutter mellom dem.');return}
  if(!fixedPhone){result('failed','TEST_PHONE mangler.');return}
  props.setProperty('KOL_SMS_TEST_DAY',date);
  props.setProperty('KOL_SMS_TEST_COUNT',String(count+1));
  props.setProperty('KOL_SMS_TEST_LAST_AT',String(now));
  result('attempted','Testforespørsel mottatt.');
  const demo={customerName:'FATIH',pickup:'Snarest',estimatedReadyAt:now+15*60000,
    total:588,lines:[{name:'Stor Classico',quantity:2}]};
  try{
    kolApiSend_(fixedPhone,kolMessage_(demo,'accepted','ord_'+now.toString(36)+'test',
      kolReadSmsTemplate_()),token);
    result('sent','Traccar godtok test-SMS. Levering er ikke bekreftet.');
  }catch(error){result('failed',String(error.message).slice(0,150))}
}

function pollOrdersForSms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = kolProps_();
    const mode = props.getProperty('KOL_MODE');
    if (mode !== 'TEST' && !(mode === 'LIVE' && KOL_SMS.allowLiveMode)) return;
    const cloudToken = String(props.getProperty('TRACCAR_TOKEN') || '').trim();
    const testNumber = kolPhone_(props.getProperty('TEST_PHONE'));
    const activatedAt = Number(props.getProperty('KOL_ACTIVE_SINCE') || 0);
    if (!cloudToken || !testNumber || !activatedAt) throw new Error('SMS configuration incomplete');

    const now = Date.now();
    const data = kolFetchRecentOrders_();
    const smsTemplate = kolReadSmsTemplate_();
    props.setProperty('KOL_LAST_POLL_OK', new Date().toISOString());
    const today = Utilities.formatDate(new Date(now), 'Europe/Oslo', 'yyyyMMdd');
    kolPurgeOldCounters_(props, today);
    let todayCount = kolTodayCounter_(props, today);
    let sent = 0;

    const orders = Object.keys(data).map(id => ({ id: id, order: data[id] }));
    orders.sort((x,y) => Number(x.order.statusUpdatedAt || 0) - Number(y.order.statusUpdatedAt || 0));
    for (const item of orders) {
      if (sent >= KOL_SMS.maxPerRun || todayCount >= KOL_SMS.maxPerDay) break;
      const order = item.order;
      const kind = kolEvent_(order, activatedAt, now);
      // Historical state/ScriptProperties use _accepted; don't rename the key.
      const eventKey = 'KOL_SENT_' + item.id + '_accepted';
      if (kind !== 'accepted' || props.getProperty(eventKey)) continue;
      const phone = kolPhone_(order.phone);
      if (!phone) continue;
      // TEST mode does not send customer SMS to arbitrary numbers.
      if (mode === 'TEST' && phone !== testNumber) continue;

      // Reserve BEFORE making the HTTP request: after a timeout we cannot
      // know whether the carrier delivered it. Never silently retry SMS.
      const attempt = { state:'attempted', at:now };
      props.setProperty(eventKey, JSON.stringify(attempt));
      todayCount += 1;
      props.setProperty('KOL_COUNT_' + today, String(todayCount));
      try {
        kolApiSend_(phone, kolMessage_(order, kind, item.id, smsTemplate), cloudToken);
        const completed = { state:'sent', at:Date.now() };
        props.setProperty(eventKey, JSON.stringify(completed));
        // The ScriptProperties receipt is authoritative if Firebase is down.
        // Never resend SMS just because the UI receipt write failed.
        try {
          kolSmsReceipt_(item.id, 'accepted', completed.at);
        } catch (writeError) {
          console.error('SMS receipt could not be saved to Firebase: ' + writeError.message);
        }
        sent += 1;
        console.log('SMS accepted by Traccar: ' + kind + ' / ' + kolShortCode_(item.id));
      } catch (err) {
        const failed = { state:'failed', at:Date.now() };
        props.setProperty(eventKey, JSON.stringify(failed));
        console.error('SMS gateway error: ' + kind + ' / ' + kolShortCode_(item.id) + ' - ' + err.message);
      }
    }
    props.setProperty('KOL_LAST_POLL_COUNT', String(sent));
    try { kolCheckSmsTest_(props,cloudToken,testNumber); }
    catch(error){console.error('SMS test: '+error.message)}
    try {
      kolSmsHeartbeat_(mode, Date.now());
    } catch (healthError) {
      console.error('SMS heartbeat could not be saved to Firebase: ' + healthError.message);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * RUN THIS ONCE after setting the two private Script properties.
 * Installs a one-minute trigger, TEST recipient only, no charges for
 * Functions or Vercel cron. Google's free quotas still apply.
 */
function setupTestSms() {
  const props = kolProps_();
  if (!String(props.getProperty('TRACCAR_TOKEN') || '').trim()) {
    throw new Error('Missing script property: TRACCAR_TOKEN');
  }
  if (!kolPhone_(props.getProperty('TEST_PHONE'))) {
    throw new Error('Missing or invalid script property: TEST_PHONE');
  }
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'pollOrdersForSms') ScriptApp.deleteTrigger(trigger);
  });
  props.setProperty('KOL_ACTIVE_SINCE', String(Date.now()));
  props.setProperty('KOL_MODE', 'TEST');
  ScriptApp.newTrigger('pollOrdersForSms').timeBased().everyMinutes(1).create();
  console.log('Test-only SMS automation enabled. No customer SMS can be sent in TEST mode.');
}

/** Manual end-to-end cloud test (only your own test phone). */
function sendTestSms() {
  const props = kolProps_();
  const token = String(props.getProperty('TRACCAR_TOKEN') || '').trim();
  const phone = kolPhone_(props.getProperty('TEST_PHONE'));
  if (!token || !phone) throw new Error('Configure TRACCAR_TOKEN and TEST_PHONE first');
  kolApiSend_(phone, 'KOL Grill & Pizza - Google Apps Script SMS test.', token);
  // Require a successful test with THIS token, not with an older key.
  props.setProperty('KOL_LAST_VERIFIED_TOKEN_SHA256', kolTokenHash_(token));
  props.setProperty('KOL_LAST_VERIFIED_AT', String(Date.now()));
  console.log('Test SMS accepted by Traccar. Check the recipient handset.');
}

/**
 * STAFF-APPROVED LIVE ACTIVATION.
 *
 * Works on Google's existing free one-minute time-driven trigger.
 * Sending to customers is still OFF until this function is run manually.
 * Requires a freshly successful sendTestSms with the currently stored token.
 * No old orders are backfilled; only new state changes after activation.
 */
function setupLiveSms() {
  const props = kolProps_();
  if (!KOL_SMS.allowLiveMode) throw new Error('LIVE deliberately disabled in code');
  const token = String(props.getProperty('TRACCAR_TOKEN') || '').trim();
  const phone = kolPhone_(props.getProperty('TEST_PHONE'));
  if (!token || !phone) throw new Error('Configure TRACCAR_TOKEN and TEST_PHONE first');
  const verifiedSha = String(props.getProperty('KOL_LAST_VERIFIED_TOKEN_SHA256') || '');
  const verifiedAt = Number(props.getProperty('KOL_LAST_VERIFIED_AT') || 0);
  if (verifiedSha !== kolTokenHash_(token) || !verifiedAt || Date.now() - verifiedAt > 60 * 60 * 1000) {
    throw new Error('First run sendTestSms with the NEW token and verify delivery; then activate LIVE within 60 minutes.');
  }
  if (props.getProperty('KOL_MODE') === 'LIVE') {
    console.log('LIVE is already active. No changes made.');
    return;
  }
  // Confirm Firebase reads still work after any security-rule changes.
  // A successful gateway test alone does not prove order data is accessible.
  kolFetchRecentOrders_();
  // Install a new single poll trigger. If installation fails, remain in TEST.
  const all = ScriptApp.getProjectTriggers();
  all.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'pollOrdersForSms') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('pollOrdersForSms').timeBased().everyMinutes(1).create();
  props.setProperty('KOL_ACTIVE_SINCE', String(Date.now()));
  props.setProperty('KOL_MODE', 'LIVE');
  console.log('LIVE SMS: kun første bekreftelse med hentetid. Ingen ekstra SMS ved klar/Endre tid. Maks ' + KOL_SMS.maxPerDay + ' per dag.');
}

/** One-click emergency stop. The token stays private. */
function stopSms() {
  const props = kolProps_();
  props.setProperty('KOL_MODE', 'OFF');
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'pollOrdersForSms') ScriptApp.deleteTrigger(trigger);
  });
  console.log('SMS automation disabled.');
}

function diagnoseSms() {
  const props = kolProps_();
  const now = Date.now();
  const activated = Number(props.getProperty('KOL_ACTIVE_SINCE') || 0);
  const testPhone = kolPhone_(props.getProperty('TEST_PHONE'));

  const orders = Object.entries(kolFetchRecentOrders_())
    .sort((a, b) =>
      Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0))
    .slice(0, 8);

  console.log('SMS mode:', props.getProperty('KOL_MODE'));
  console.log('Test phone configured:', Boolean(testPhone));
  console.log('Orders found:', orders.length);

  for (const [id, order] of orders) {
    const changed = Number(order.statusUpdatedAt) || 0;
    const event = kolEvent_(order, activated, now);
    const phoneMatch = kolPhone_(order.phone) === testPhone;
    const alreadySent = Boolean(
      props.getProperty('KOL_SENT_' + id + '_accepted')
    );

    console.log(
      kolShortCode_(id),
      'status=' + order.status,
      'phoneMatch=' + phoneMatch,
      'afterActivation=' + (changed >= activated),
      'event=' + (event || 'none'),
      'alreadySent=' + alreadySent,
      'manualReady=' + (
        Number(order.staffReadyAt) > 0 &&
        Number(order.staffReadyAt) === changed
      )
    );
  }
}

function checkSmsResults() {
  const props = kolProps_();
  const orders = Object.entries(kolFetchRecentOrders_())
    .sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0))
    .slice(0, 4);
  for (const [id, order] of orders) {
    const confirmation = kolPropertyJson_(props, 'KOL_SENT_' + id + '_accepted');
    console.log(kolShortCode_(id),
      'status=' + order.status,
      'hentetidSms=' + (confirmation?.state || 'none'));
  }
}
