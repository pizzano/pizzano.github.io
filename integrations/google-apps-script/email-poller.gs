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


function kolHtmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
  });
}
function kolKr_(value) {
  const number = Number(value);
  return 'kr ' + (Number.isFinite(number) ? number : 0).toLocaleString('nb-NO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function kolPlain_(value) {
  return String(value == null ? '' : value).trim();
}
function kolDetailRows_(line) {
  const details = [];
  if (line.size) details.push({name:'Størrelse', text:kolPlain_(line.size)});
  if (Array.isArray(line.optionDetails) && line.optionDetails.length) {
    line.optionDetails.forEach(function(option) {
      if (!option || !option.label) return;
      const price = Number(option.price) || 0;
      details.push({
        name:kolPlain_(option.groupTitle || 'Tilvalg'),
        text:kolPlain_(option.label) + (price > 0 ? ' (+' + kolKr_(price) + ' per stk.)' : '')
      });
    });
  } else if (Array.isArray(line.options)) {
    line.options.forEach(function(option) {
      const name = typeof option === 'string' ? option : option && option.label;
      if (name) details.push({name:'Tilvalg',text:kolPlain_(name)});
    });
  }
  if (Array.isArray(line.removedIngredients) && line.removedIngredients.length) {
    details.push({name:'Uten',text:line.removedIngredients.map(kolPlain_).join(', ')});
  }
  if (kolPlain_(line.comment)) details.push({name:'Kommentar',text:kolPlain_(line.comment)});
  return details;
}
function kolBuildReceipt_(order, kind) {
  const safe = kolHtmlEscape_;
  const name = kolPlain_(order.customerName);
  const firstName = name.split(/\s+/)[0] || '';
  const ref = kolPlain_(order.id).slice(-6).toUpperCase();
  const accepted = kind === 'accepted';
  const estimate = Number(order.estimatedMinutes) || 0;
  const pickup = kolPickup_(order);
  const headline = accepted ? 'Bestilling bekreftet' : 'Maten er klar for henting!';
  const pickupHeading = accepted
    ? (estimate > 0 ? 'Estimert hentetid: ' + estimate + ' min' : (pickup ? 'Hentetid: ' + pickup : 'Vi gir beskjed når maten er klar'))
    : 'Klar for henting';
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const rows = lines.map(function(line) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const detailHtml = kolDetailRows_(line).map(function(detail) {
      return '<div style="margin-top:5px;font-size:12px;line-height:1.5;color:#657185"><b>' +
        safe(detail.name) + ':</b> ' + safe(detail.text) + '</div>';
    }).join('');
    return '<tr><td style="padding:14px 16px;border-bottom:1px solid #edf0f2;vertical-align:top;">' +
      '<div style="font-size:14px;font-weight:700;color:#1c293b;">' + qty + ' × ' +
      safe(line.name || 'Produkt') + '</div>' + detailHtml +
      '</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #edf0f2;vertical-align:top;white-space:nowrap;font-weight:700;color:#1c293b;font-size:13px;">' +
      safe(kolKr_(line.price)) + '</td></tr>';
  }).join('');
  const detailText = lines.map(function(line) {
    const row = [(Math.max(1,Number(line.quantity)||1)) + ' x ' + kolPlain_(line.name) + ' – ' + kolKr_(line.price)];
    kolDetailRows_(line).forEach(function(d) {row.push('  ' + d.name + ': ' + d.text);});
    return row.join('\n');
  }).join('\n\n');
  const orderDate = Number(order.createdAt) > 0 ?
    Utilities.formatDate(new Date(Number(order.createdAt)), 'Europe/Oslo', 'dd.MM.yyyy HH:mm') : '';
  const info = [
    ['Ordrenummer', '#' + ref],
    ['Kunde', name || '—'],
    ['Telefon', kolPlain_(order.phone) || '—'],
    ['E-post', kolPlain_(order.email) || '—'],
    ['Bestilt', orderDate || '—'],
    ['Henting', pickup || kolPlain_(order.pickup) || 'Snarest']
  ];
  const infoHtml = info.map(function(pair) {
    return '<tr><td style="padding:7px 0;color:#7b8797;font-size:12px;">' +
      safe(pair[0]) + '</td><td align="right" style="padding:7px 0;color:#263447;font-size:12px;font-weight:600;">' +
      safe(pair[1]) + '</td></tr>';
  }).join('');
  const intro = accepted
    ? 'Takk for din bestilling! Vi har bekreftet bestillingen din for henting.'
    : 'Bestillingen din er nå markert som klar av restauranten. Du kan hente maten.';
  const total = kolKr_(order.total);
  const subtotal = kolKr_(order.subtotal == null ? order.total : order.subtotal);
  const html =
    '<!doctype html><html lang="no"><body style="margin:0;padding:20px 10px;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#1c293b;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:auto;border-collapse:collapse;background:#ffffff;border:1px solid #e6ebf0;border-radius:14px;">' +
    '<tr><td align="center" style="padding:24px 20px 16px;font-weight:800;font-size:20px;color:#1b293b;">KØL Grill &amp; Pizza</td></tr>' +
    '<tr><td align="center" style="padding:26px 18px;background:#eaf7ee;border-top:1px solid #d9eedd;border-bottom:1px solid #d9eedd;">' +
    '<div style="font-size:15px;font-weight:700;color:#207449;">' + safe(headline) + '</div>' +
    '<div style="font-size:23px;line-height:1.35;margin-top:8px;color:#163d2b;font-weight:800;">' + safe(pickupHeading) + '</div></td></tr>' +
    '<tr><td style="padding:22px 22px 10px;font-size:13px;line-height:1.65;color:#4b596c;">' +
    'Hei ' + safe(firstName || 'kunde') + '!<p style="margin:9px 0 0;">' + safe(intro) + '</p></td></tr>' +
    '<tr><td style="padding:14px 22px;"><div style="padding:15px 17px;border-radius:11px;background:#f3f9f5;border:1px solid #e0ece4;">' +
    '<div style="font-size:13px;font-weight:800;margin-bottom:9px;">Restaurantens adresse for henting</div>' +
    '<a href="https://www.google.com/maps/search/?api=1&amp;query=%C3%98gardsvegen+44%2C+2100+Skarnes" style="font-size:13px;color:#166e4b;">Øgardsvegen 44, 2100 Skarnes</a>' +
    '</div></td></tr>' +
    '<tr><td style="padding:9px 22px 17px;"><div style="font-size:14px;font-weight:800;margin:0 0 10px;">Dine bestillingsopplysninger</div>' +
    '<table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' + infoHtml + '</table></td></tr>' +
    '<tr><td style="padding:5px 22px;"><div style="font-size:15px;font-weight:800;margin-bottom:11px;">Dine bestillingsdetaljer</div>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fafbfc;border:1px solid #e9edf1;">' +
    (rows || '<tr><td style="padding:16px;">Ingen produktlinjer lagret.</td></tr>') +
    '<tr><td style="padding:12px 16px;color:#6c7788;font-size:12px;">Delsum</td><td align="right" style="padding:12px 16px;white-space:nowrap;font-size:13px;">' +
    safe(subtotal) + '</td></tr>' +
    '<tr><td style="padding:14px 16px;background:#edf7f0;font-size:15px;font-weight:800;">Totalt</td>' +
    '<td align="right" style="padding:14px 16px;background:#edf7f0;white-space:nowrap;font-size:16px;font-weight:800;">' +
    safe(total) + '</td></tr></table></td></tr>' +
    (kolPlain_(order.comment) ? '<tr><td style="padding:12px 22px;font-size:12px;color:#4b596c;"><b>Kommentar til bestillingen:</b> ' + safe(order.comment) + '</td></tr>' : '') +
    '<tr><td style="padding:23px 22px;font-size:12px;line-height:1.7;color:#667589;">Takk for bestillingen!<br>' +
    'Vennlig hilsen,<br><b>KØL Grill &amp; Pizza</b><br>' +
    '<a href="mailto:skarnes.restaurant@gmail.com" style="color:#1c7a53;">skarnes.restaurant@gmail.com</a></td></tr>' +
    '</table></body></html>';
  const text = 'KØL Grill & Pizza\n' + headline + '\n' + pickupHeading +
    '\n\nHei ' + (firstName || 'kunde') + '!\n' + intro +
    '\n\n' + info.map(function(row){return row.join(': ');}).join('\n') +
    '\n\nRestaurantens adresse: Øgardsvegen 44, 2100 Skarnes' +
    '\n\nDine bestillingsdetaljer:\n' + detailText +
    '\n\nDelsum: ' + subtotal + '\nTotalt: ' + total +
    '\n\nHilsen KØL Grill & Pizza\nskarnes.restaurant@gmail.com';
  return {html:html,text:text,subject:(accepted ? 'Bestilling bekreftet' : 'Klar for henting') + ' #' + ref + ' – KØL Grill & Pizza'};
}

function kolSendMail_(order, kind) {
  const address = kolEmail_(order);
  if (!address) return false;
  const receipt = kolBuildReceipt_(order, kind);
  MailApp.sendEmail({
    to:address,
    subject:receipt.subject,
    body:receipt.text,
    htmlBody:receipt.html,
    name:'KØL Grill & Pizza',
    replyTo:'skarnes.restaurant@gmail.com'
  });
  return true;
}

/** Preview without sending customer email. Run and inspect execution log. */
function forhåndsvisEpostEksempel() {
  const sample = {
    id:'TEST-ABCDE1',customerName:'Testkunde',phone:'+47 400 00 000',
    email:'test@example.com',createdAt:Date.now(),estimatedMinutes:25,
    pickup:'Snarest',subtotal:227,total:227,
    lines:[{quantity:1,name:'Classico',size:'Medium',price:227,
      optionDetails:[{groupTitle:'Ekstra topping',label:'Pepperoni',price:19}],
      removedIngredients:['Løk'],comment:'Godt stekt'}]
  };
  Logger.log(kolBuildReceipt_(sample,'accepted').html);
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
