/**
 * KØL Grill & Pizza — Gmail notification poller.
 * SMS code is not used. No publicly readable Firebase rules required.
 * Uses the Google account authorized in Apps Script to read Firebase.
 */
const KOL_DB = 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
const KOL_MAX_ORDER_AGE_MS = 48 * 60 * 60 * 1000;
const KOL_CHECKPOINT_PREFIX = 'kol_order_';

function kolReadOrders_() {
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(KOL_DB + '/orders.json', {
    method: 'get',
    headers: {Authorization: 'Bearer ' + token},
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Firebase lesefeil (HTTP ' + response.getResponseCode() +
      '). Kontroller Apps Script OAuth-tilgang og Firebase IAM. Ikke gjør databasen offentlig.');
  }
  const data = JSON.parse(response.getContentText() || 'null');
  return data && typeof data === 'object' ? data : {};
}

function kolNotificationKind_(previous, order) {
  const after = String(order.status || '');
  if (previous === 'mottatt' && after === 'bekreftet') return 'accepted';
  if ((previous === 'bekreftet' || previous === 'tilberedning') && after === 'klar') return 'ready';
  return '';
}

function kolEmail_(order) {
  const email = String(order.email || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function kolPickup_(order) {
  const value = Number(order.scheduledPickupAt || order.estimatedReadyAt || 0);
  if (value > 0) return Utilities.formatDate(new Date(value), 'Europe/Oslo', 'dd.MM HH:mm');
  if (/^\d{1,2}:\d{2}$/.test(String(order.pickup || ''))) return order.pickup;
  return '';
}

function kolSendMail_(order, kind) {
  const address = kolEmail_(order);
  if (!address) return false;
  const name = String(order.customerName || '').trim().split(/\s+/)[0].slice(0,40);
  const greeting = name ? 'Hei ' + name + '!\n\n' : 'Hei!\n\n';
  const code = String(order.id || '').slice(-6).toUpperCase();
  const subject = kind === 'ready'
    ? 'Bestilling #' + code + ' er klar for henting – KØL Grill & Pizza'
    : 'Bestilling #' + code + ' er bekreftet – KØL Grill & Pizza';
  const text = kind === 'ready'
    ? 'Maten er klar for henting!\n'
    : 'Din bestilling er bekreftet.\n' +
      (kolPickup_(order) ? 'Estimert hentetid: ' + kolPickup_(order) + '\n' : '');
  MailApp.sendEmail({
    to: address,
    subject: subject,
    body: greeting + text + '\nHentested: Øgardsvegen 44, Skarnes.\n\nHilsen\nKØL Grill & Pizza',
    name: 'KØL Grill & Pizza'
  });
  return true;
}

function kolOrderKey_(id) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(id));
  return KOL_CHECKPOINT_PREFIX +
    Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '').slice(0,32);
}

/** Run this first: confirms Firebase read permission without emailing customers. */
function testFirebaseTilgang() {
  const orders = kolReadOrders_();
  Logger.log('Firebase-tilgang OK. Antall ordre: ' + Object.keys(orders).length);
}

/**
 * First installation seeds existing order statuses without sending old emails.
 * Creates one trigger that runs approximately every minute.
 */
function installerEpostVarsler() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const orders = kolReadOrders_();
    const props = PropertiesService.getScriptProperties();
    const now = Date.now();
    let seeded = 0;
    for (const id in orders) {
      const order = orders[id];
      if (!order || typeof order !== 'object') continue;
      const created = Number(order.createdAt || 0);
      if (!created || created < now - KOL_MAX_ORDER_AGE_MS) continue;
      const key = kolOrderKey_(id);
      if (!props.getProperty(key)) {
        props.setProperty(key, JSON.stringify({status: String(order.status || ''), updated: now, sent: {}}));
        seeded++;
      }
    }
    const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'kontrollerEpostBestillinger');
    for (const trigger of existing) ScriptApp.deleteTrigger(trigger);
    ScriptApp.newTrigger('kontrollerEpostBestillinger').timeBased().everyMinutes(1).create();
    Logger.log('E-postovervåking aktivert. Eksisterende ordre registrert: ' + seeded + '. Ingen gamle meldinger sendt.');
  } finally { lock.releaseLock(); }
}

/** Scheduled, email-only order status check. */
function kontrollerEpostBestillinger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const orders = kolReadOrders_();
    const now = Date.now();
    for (const id in orders) {
      const order = orders[id];
      if (!order || typeof order !== 'object') continue;
      const created = Number(order.createdAt || 0);
      if (!created || created < now - KOL_MAX_ORDER_AGE_MS) continue;
      const key = kolOrderKey_(id);
      const previousJson = props.getProperty(key);
      const status = String(order.status || '');
      if (!previousJson) {
        props.setProperty(key, JSON.stringify({status:status, updated:now, sent:{}}));
        continue;
      }
      const checkpoint = JSON.parse(previousJson);
      const kind = kolNotificationKind_(checkpoint.status, order);
      const stamp = String(order.statusUpdatedAt || '0');
      const eventKey = kind + ':' + stamp;
      if (kind && !checkpoint.sent[eventKey]) {
        // This is a single best-effort delivery: mark before sending to avoid duplicate mail.
        checkpoint.sent[eventKey] = 'attempted';
        checkpoint.status = status;
        checkpoint.updated = now;
        props.setProperty(key, JSON.stringify(checkpoint));
        try {
          if (kolSendMail_(Object.assign({id:id},order), kind)) {
            checkpoint.sent[eventKey] = 'sent';
            props.setProperty(key, JSON.stringify(checkpoint));
            Logger.log('E-post sendt: ' + kind + ', ordre ' + id.slice(-6));
          } else {
            checkpoint.sent[eventKey] = 'skipped_no_email';
            props.setProperty(key, JSON.stringify(checkpoint));
          }
        } catch (err) {
          checkpoint.sent[eventKey] = 'failed';
          props.setProperty(key, JSON.stringify(checkpoint));
          Logger.log('E-postfeil på ordre ' + id.slice(-6) + ': ' + err.message);
        }
      } else if (checkpoint.status !== status) {
        checkpoint.status = status;
        checkpoint.updated = now;
        props.setProperty(key, JSON.stringify(checkpoint));
      }
    }
  } finally { lock.releaseLock(); }
}

/** Stop just this email poller; does not affect any SMS project. */
function stoppEpostVarsler() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kontrollerEpostBestillinger')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('E-postovervåking stoppet.');
}
