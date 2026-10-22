/**
 * KØL Grill & Pizza - Google Apps Script SMS bridge
 * Trigger: ~every 1 minute, no shop PC required.
 * SMS via Traccar Cloud -> Android phone with ice SIM.
 * Free Apps Script quotas apply. Not a guaranteed real-time service.
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
    return Utilities.formatDate(new Date(timestamp), 'Europe/Oslo', 'dd.MM HH:mm');
  }
  const manuallySelected = String(order.pickup || '').trim();
  return order.pickupMode === 'scheduled' && /^\d{1,2}:\d{2}$/.test(manuallySelected)
    ? manuallySelected : '';
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

/** One message per order, sent only on confirmed status. */
function kolMessage_(order, eventKind, orderId) {
  if (eventKind !== 'accepted') throw new Error('Only confirmation SMS is permitted');
  const firstName = String(order.customerName || '').trim().split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu, '').slice(0, 20);
  const greeting = firstName ? 'Hei ' + firstName + '! ' : 'Hei! ';
  const signature = ' – KØL Grill & Pizza';
  const isScheduled = order.pickupMode === 'scheduled'
    || /^\d{1,2}:\d{2}$/.test(String(order.pickup || '').trim());
  if (isScheduled) {
    const selectedTime = kolTime_(order);
    return greeting + 'Bestillingen din er bekreftet. Hentetid: '
      + (selectedTime || 'avtalt tidspunkt') + '.' + signature;
  }
  let minutes = Number(order.estimatedMinutes) || 0;
  if (!(minutes > 0 && minutes <= 180)) {
    const readyAt = Number(order.estimatedReadyAt) || 0;
    if (readyAt > Date.now()) minutes = Math.ceil((readyAt - Date.now()) / 60000);
  }
  const readyClock = kolAsapReadyClock_(order);
  if (Number.isFinite(minutes) && minutes > 0 && minutes <= 180) {
    minutes = Math.ceil(minutes);
    const unit = minutes === 1 ? 'minutt' : 'minutter';
    return greeting + 'Bestillingen din er bekreftet. Forventet hentetid: '
      + (readyClock ? 'kl. ' + readyClock + ' ' : '')
      + '(ca. ' + minutes + ' ' + unit + ').' + signature;
  }
  return greeting + 'Bestillingen din er bekreftet. Hentetid: snarest.' + signature;
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

/**
 * Write provider-accepted SMS evidence directly to the SAME RTDB as /demo/.
 * Only the server-side Apps Script sends SMS; browser code never sends.
 * If this write fails after sending, retain Script Properties 'sent' and
 * backfill a missing receipt on a later poll; NEVER resend the SMS.
 */
function kolFirebasePut_(path, data) {
  const url = KOL_SMS.databaseUrl + '/' + path + '.json';
  const result = UrlFetchApp.fetch(url, {
    method:'put', contentType:'application/json',
    payload:JSON.stringify(data), muteHttpExceptions:true
  });
  if (result.getResponseCode() !== 200) {
    throw new Error('Firebase receipt/status HTTP ' + result.getResponseCode());
  }
}

function kolPublishSmsReceipt_(orderId, order, sentAt) {
  const id = String(orderId || '');
  const when = Number(sentAt) || 0;
  if (!/^ord_[a-z0-9]{7,40}$/i.test(id) || !Number.isSafeInteger(when)
      || when <= 0 || when < (Number(order.createdAt) || 0)) {
    throw new Error('Invalid accepted SMS receipt');
  }
  kolFirebasePut_('orders/' + encodeURIComponent(id) + '/smsReceipts/accepted', {
    provider:'Traccar', state:'accepted', sentAt:when,
    statusUpdatedAt:Number(order.statusUpdatedAt) || 0
  });
}

function kolPublishSmsHealth_(mode, at) {
  kolFirebasePut_('smsHealth', {
    source:'apps-script-sms-poller',
    checkedAt:Number(at) || Date.now(),
    lastSuccessfulPollAt:new Date(at).toISOString(),
    liveConfigured:mode === 'LIVE' && KOL_SMS.allowLiveMode,
    pollHealthy:true
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
    props.setProperty('KOL_LAST_POLL_OK', new Date().toISOString());
    // This is a sender heartbeat, NOT a promise of carrier delivery.
    try { kolPublishSmsHealth_(mode, now); }
    catch (healthErr) { console.error('SMS Firebase health write: ' + healthErr.message); }
    const today = Utilities.formatDate(new Date(now), 'Europe/Oslo', 'yyyyMMdd');
    kolPurgeOldCounters_(props, today);
    let todayCount = kolTodayCounter_(props, today);
    let sent = 0;
    let receiptsBackfilled = 0;

    const orders = Object.keys(data).map(id => ({ id: id, order: data[id] }));
    orders.sort((x,y) => Number(x.order.statusUpdatedAt || 0) - Number(y.order.statusUpdatedAt || 0));
    for (const item of orders) {
      if (sent >= KOL_SMS.maxPerRun || todayCount >= KOL_SMS.maxPerDay) break;
      const order = item.order;
      const kind = kolEvent_(order, activatedAt, now);
      // Historical state/ScriptProperties use _accepted; don't rename the key.
      const eventKey = 'KOL_SENT_' + item.id + '_accepted';
      // Migrate accepted receipts from existing Script Properties with no
      // network SMS call. Cap writes to avoid extra Firebase load.
      const previousReceipt = kolPropertyJson_(props, eventKey);
      if (previousReceipt && previousReceipt.state === 'sent'
          && !order.smsReceipts?.accepted && receiptsBackfilled < 12) {
        receiptsBackfilled++;
        try { kolPublishSmsReceipt_(item.id, order, previousReceipt.at); }
        catch (receiptErr) {
          console.error('SMS receipt backfill for ' + kolShortCode_(item.id)
            + ': ' + receiptErr.message);
        }
      }
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
        kolApiSend_(phone, kolMessage_(order, kind, item.id), cloudToken);
        const completed = { state:'sent', at:Date.now() };
        props.setProperty(eventKey, JSON.stringify(completed));
        // A receipt write failure must NEVER reclassify or resend an accepted SMS.
        try { kolPublishSmsReceipt_(item.id, order, completed.at); }
        catch (receiptErr) {
          console.error('SMS was accepted but Firebase receipt was not saved: '
            + kolShortCode_(item.id) + ' - ' + receiptErr.message);
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

/** Read-only status. Does not send messages or reveal any phone/token.
 * An optional receiptIds query returns only already-confirmed SMS submits.
 * Receipt IDs are opaque order IDs, not telephone numbers. Never return
 * attempts/failures as successful. No messaging actions are exposed here.
 */
function doGet(e) {
  const props = kolProps_();
  const ids = String(e?.parameter?.receiptIds || '').trim();
  if (ids) {
    const parsed = ids.split(',').slice(0, 40);
    const receipts = {};
    for (const id of new Set(parsed)) {
      if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(id)) continue;
      const accepted = kolPropertyJson_(props, 'KOL_SENT_' + id + '_accepted');
      const ready = kolPropertyJson_(props, 'KOL_SENT_' + id + '_ready');
      const estimate = kolPropertyJson_(props, 'KOL_EST_NOTICE_' + id);
      const at = event => event && event.state === 'sent' && Number.isSafeInteger(Number(event.at))
        ? Number(event.at) : null;
      receipts[id] = {
        acceptedAt: at(accepted),
        readyAt: at(ready),
        estimateUpdatedAt: at(estimate),
      };
    }
    return ContentService.createTextOutput(JSON.stringify({ receipts }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const lastPoll = String(props.getProperty('KOL_LAST_POLL_OK') || '');
  const lastSms = String(props.getProperty('KOL_LAST_SMS_OK') || '');
  const mode = String(props.getProperty('KOL_MODE') || 'OFF');
  const age = Date.now() - Date.parse(lastPoll);
  const lastSmsAge = Date.now() - Date.parse(lastSms);
  const data = {
    // Green is reserved for a live, configured sender that has actually
    // submitted SMS recently, not merely a working Google trigger.
    smsEnabled: mode === 'LIVE' && KOL_SMS.allowLiveMode,
    gatewayOnline: mode === 'LIVE' && KOL_SMS.allowLiveMode
      && Number.isFinite(age) && age < 180000
      && Number.isFinite(lastSmsAge) && lastSmsAge < 24 * 3600000,
    lastGatewayCheckAt: lastPoll,
    testMode: mode === 'TEST',
  };
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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
