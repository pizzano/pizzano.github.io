/**
 * KØL Grill & Pizza — Gmail notification poller.
 * Reference source stored in GitHub; the live Google Apps Script project
 * is managed separately. SMS code is not used.
 * Reads the restaurant's new Firebase RTDB via its configured public-read rules.
 * Protect customer data by restricting reads before enabling production traffic.
 */
const KOL_DB = 'https://kol-grill-pizza-default-rtdb.firebaseio.com';
const KOL_MAX_ORDER_AGE_MS = 48 * 60 * 60 * 1000;
const KOL_CHECKPOINT_PREFIX = 'kol_order_';

// Narrow indexed Firebase query. Initial read covers the most recent 48h;
// subsequent scans read changes since the last successful poll (+ 2m overlap).
// Firebase RTDB /orders requires ".indexOn": ["statusUpdatedAt"].
const KOL_EMAIL_SCAN_CURSOR_KEY = 'KOL_EMAIL_LAST_SUCCESSFUL_SCAN_MS';
const KOL_EMAIL_SCAN_OVERLAP_MS = 2 * 60 * 1000;
// Only notify for recent staff status events. Prevents a new installation
// from suddenly emailing old test orders after first start.
const KOL_EMAIL_EVENT_MAX_AGE_MS = 60 * 60 * 1000;
let kolEmailIndexedQueryOk_ = false;

function kolReadOrders_() {
  const now = Date.now();
  const props = PropertiesService.getScriptProperties();
  const lastScan = Number(props.getProperty(KOL_EMAIL_SCAN_CURSOR_KEY)) || 0;
  const since = Math.max(
    now - KOL_MAX_ORDER_AGE_MS,
    lastScan > 0 ? lastScan - KOL_EMAIL_SCAN_OVERLAP_MS : now - KOL_MAX_ORDER_AGE_MS
  );
  const url = KOL_DB + '/orders.json?orderBy=' +
    encodeURIComponent(JSON.stringify('statusUpdatedAt')) +
    '&startAt=' + encodeURIComponent(String(since));
  const response = UrlFetchApp.fetch(url, {
    method: 'get', muteHttpExceptions: true
  });
  if (response.getResponseCode() === 200) {
    kolEmailIndexedQueryOk_ = true;
    const data = JSON.parse(response.getContentText() || 'null');
    return data && typeof data === 'object' ? data : {};
  }

  // Bounded fallback: keep notifications working even before the indexes
  // have been configured; never read /orders.json without a query.
  Logger.log('E-post: indeksert lesing feilet (HTTP ' +
    response.getResponseCode() + '). Bruker begrenset reserve; konfigurer .indexOn.');
  kolEmailIndexedQueryOk_ = false;
  const fallbackUrl = KOL_DB + '/orders.json?orderBy=' +
    encodeURIComponent(JSON.stringify('$key')) + '&limitToLast=120';
  const fallback = UrlFetchApp.fetch(fallbackUrl, {
    method: 'get', muteHttpExceptions: true
  });
  if (fallback.getResponseCode() !== 200) {
    throw new Error('Firebase lesefeil (HTTP ' + fallback.getResponseCode() + ').');
  }
  const data = JSON.parse(fallback.getContentText() || 'null');
  return data && typeof data === 'object' ? data : {};
}

function kolNotificationKind_(previous, order, now) {
  const after = String(order.status || '');
  const statusAt = Number(order.statusUpdatedAt) || 0;
  const age = now - statusAt;
  if (!statusAt || age < -60000 || age > KOL_EMAIL_EVENT_MAX_AGE_MS) return '';
  // Polling runs about once per minute. First seen can already be confirmed;
  // previous === after is NOT proof that an email has been sent.
  if (after === 'bekreftet' &&
      ['', 'mottatt', 'bekreftet'].includes(String(previous || ''))) {
    return 'accepted';
  }
  // A countdown cannot trigger "ready": manual staffReadyAt is required.
  const staffReadyAt = Number(order.staffReadyAt) || 0;
  if (after === 'klar' &&
      ['', 'mottatt', 'bekreftet', 'tilberedning', 'klar'].includes(String(previous || '')) &&
      staffReadyAt > 0 && Math.abs(staffReadyAt - statusAt) <= 10000) {
    return 'ready';
  }
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
/** Gmail-safe, mobile-first HTML e-mail templates.
 * Accepted and ready both use the same branded order summary and their OWN
 * heading. The ready e-mail never shows a countdown or asks the customer to
 * wait another N minutes.
 */
function kolBuildReceipt_(order, kind) {
  const safe = kolHtmlEscape_;
  const accepted = kind === 'accepted';
  if (!accepted && kind !== 'ready') throw new Error('Ukjent e-postvarsel: ' + kind);

  const firstName = kolPlain_(order.customerName).split(/\s+/)[0] || 'kunde';
  const ref = kolPlain_(order.id).slice(-6).toUpperCase() || 'ORDRE';
  const total = Number(order.total) || 0;
  const subtotal = Number(order.subtotal == null ? order.total : order.subtotal) || 0;
  const numberFormat = function(amount, decimals) {
    return Number(amount || 0).toLocaleString('nb-NO', {
      minimumFractionDigits:decimals, maximumFractionDigits:decimals
    });
  };
  const money = function(amount) {
    const value = Number(amount) || 0;
    return numberFormat(value, Number.isInteger(value) ? 0 : 2) + ' kr';
  };
  const money2 = function(amount) { return numberFormat(amount, 2) + ' kr'; };
  const hms = function(timeMs, pattern) {
    return timeMs > 0 ? Utilities.formatDate(new Date(timeMs), 'Europe/Oslo', pattern) : '';
  };
  const scheduled = order.pickupMode === 'scheduled' ||
    /^\d{1,2}:\d{2}$/.test(kolPlain_(order.pickup));
  const plannedAt = Number(order.scheduledPickupAt) ||
    Number(order.estimatedReadyAt) || 0;
  const chosenTime = /^\d{1,2}:\d{2}$/.test(kolPlain_(order.pickup))
    ? kolPlain_(order.pickup).padStart(5, '0') : '';
  const clock = hms(plannedAt, 'HH:mm') || chosenTime;
  const minutes = Number(order.estimatedMinutes) || 0;
  const readyAt = Number(order.staffReadyAt) || Number(order.statusUpdatedAt) || 0;
  const readyClock = hms(readyAt, 'HH:mm');
  const createdAt = Number(order.createdAt) || 0;

  const headline = accepted ? 'BESTILLINGEN DIN ER BEKREFTET' : 'DIN BESTILLING ER KLAR TIL HENTING';
  const mainTime = accepted ? (clock || 'Snarest') : (readyClock || 'Nå');
  const mainLabel = accepted ? 'Hentetid:' : 'Klar kl.';
  const statusLeft = accepted ? (scheduled ? 'Planlagt henting' : 'Snarest') : 'Klar for henting';
  const statusRight = accepted
    ? (scheduled ? (hms(Number(order.scheduledPickupAt) || 0, 'dd.MM.yyyy') || 'Avtalt tid')
      : (minutes > 0 ? 'Ca. ' + Math.ceil(minutes) + ' ' + (Math.ceil(minutes) === 1 ? 'minutt' : 'minutter') : 'Så snart som mulig'))
    : 'Du kan hente maten nå';
  const intro = accepted
    ? 'Vi har bekreftet bestillingen din og forbereder maten. Du kan hente den på tidspunktet som er vist over.'
    : 'Gode nyheter! Personalet har markert bestillingen din som klar. Du kan komme og hente maten.';
  const subject = (accepted ? 'Bestillingen din er bekreftet' : 'Bestillingen din er klar for henting')
    + ' #' + ref + ' – KØL Grill & Pizza';

  const info = [
    ['Bestillingskode', '#' + ref],
    ['Bestilt', createdAt ? hms(createdAt, 'dd.MM.yyyy, HH:mm') : '—'],
    ['Navn', kolPlain_(order.customerName) || '—'],
    ['Telefon', kolPlain_(order.phone) || '—']
  ];
  const infoRows = info.map(function(pair) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e8e1;font-size:13px;color:#68736c;">' + safe(pair[0]) + '</td>' +
      '<td align="right" style="padding:10px 12px;border-bottom:1px solid #e5e8e1;font-size:13px;font-weight:bold;color:#15291d;">' + safe(pair[1]) + '</td>' +
      '</tr>';
  }).join('');

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const rows = lines.map(function(line) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const details = kolDetailRows_(line);
    const detailsHtml = details.map(function(detail) {
      return '<div style="font-size:12px;line-height:18px;color:#738077;margin-top:4px;">' +
        '<strong style="color:#415449;">' + safe(detail.name) + ':</strong> ' + safe(detail.text) + '</div>';
    }).join('');
    return '<tr><td style="padding:14px 12px;border-bottom:1px solid #e5e8e1;vertical-align:top;">' +
      '<div style="font-size:15px;line-height:21px;color:#142a1d;">' +
      '<strong>' + safe(qty) + ' ×</strong> <strong>' + safe(line.name || 'Produkt') + '</strong></div>' +
      detailsHtml + '</td>' +
      '<td align="right" style="padding:14px 12px;border-bottom:1px solid #e5e8e1;vertical-align:top;white-space:nowrap;font-size:14px;font-weight:bold;color:#142a1d;">' +
      safe(money(line.price)) + '</td></tr>';
  }).join('');

  const detailsPlain = lines.map(function(line) {
    const row = [Math.max(1, Number(line.quantity)||1) + ' x ' +
      kolPlain_(line.name) + ' — ' + money(line.price)];
    kolDetailRows_(line).forEach(function(d) {row.push('  ' + d.name + ': ' + d.text);});
    return row.join('\n');
  }).join('\n\n');

  const orderLink = 'https://bestill.online/demo/index.html';
  const totalMva = total * 15 / 115; // Display as included (not added to total).
  const html =
    '<!doctype html><html lang="no"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#eef1eb;font-family:Arial,Helvetica,sans-serif;color:#15291d;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef1eb;border-collapse:collapse;">' +
    '<tr><td align="center" style="padding:20px 10px 30px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:620px;border-collapse:collapse;background:#fffefa;">' +

    // Branded hero: avoids remotely loaded CSS or images, which Gmail can block.
    '<tr><td align="center" style="padding:30px 15px 24px;background:#10291c;color:#fff8e8;border-bottom:4px solid #bda36b;">' +
    '<div style="font-size:11px;line-height:18px;letter-spacing:3px;color:#d7bf8b;">✦ GOD MAT SAMLER FOLK ✦</div>' +
    '<div style="font-size:46px;line-height:1.2;font-weight:800;letter-spacing:3px;color:#fff9ec;">KØL</div>' +
    '<div style="font-size:16px;line-height:24px;letter-spacing:5px;font-weight:bold;color:#fff9ec;">GRILL &amp; PIZZA</div>' +
    '<div style="padding-top:8px;font-size:11px;line-height:16px;letter-spacing:2px;color:#dac89e;">PIZZA &nbsp;·&nbsp; GRILL &nbsp;·&nbsp; KVALITET</div>' +
    '</td></tr>' +

    '<tr><td style="padding:16px 15px 8px;background:#fffefa;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;background:#eef4e7;border-radius:16px;">' +
    '<tr><td align="center" style="padding:20px 10px 8px;color:#20442b;font-size:12px;line-height:20px;font-weight:800;letter-spacing:1px;">' +
    safe(headline) + '</td></tr>' +
    '<tr><td align="center" style="padding:0 6px 23px;color:#10291c;">' +
    '<div style="font-size:20px;font-weight:800;line-height:26px;">' + safe(mainLabel) + '</div>' +
    '<div style="font-size:52px;line-height:1.15;font-weight:900;letter-spacing:-1px;">' + safe(mainTime) + '</div>' +
    '</td></tr></table></td></tr>' +

    '<tr><td style="padding:0 15px 13px;background:#fffefa;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f6f0;border-collapse:separate;border-radius:13px;">' +
    '<tr><td width="48%" align="center" style="padding:15px 7px;color:#123c27;font-size:15px;font-weight:bold;">' + safe(statusLeft) + '</td>' +
    '<td width="52%" align="center" style="padding:15px 7px;border-left:1px solid #e3e6dd;color:#193b27;font-size:14px;font-weight:bold;">' +
    safe(statusRight) + '</td></tr></table></td></tr>' +

    '<tr><td style="padding:8px 26px 18px;font-size:14px;line-height:22px;color:#546358;">' +
    'Hei ' + safe(firstName) + '!<br>' + safe(intro) + '</td></tr>' +

    '<tr><td style="padding:0 15px 14px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e2e7dd;border-radius:13px;border-collapse:separate;background:#ffffff;">' +
    '<tr><td colspan="2" style="padding:16px 13px 5px;font-size:17px;font-weight:bold;color:#153321;">Bestillingsdetaljer</td></tr>' +
    infoRows +
    '<tr><td colspan="2" style="padding:12px;font-size:12px;color:#65736a;line-height:19px;">' +
    '<strong>Henting:</strong> Øgardsvegen 44, 2100 Skarnes<br>' +
    '<a href="https://www.google.com/maps/search/?api=1&amp;query=%C3%98gardsvegen+44%2C+2100+Skarnes" style="color:#286844;text-decoration:underline;">Vis veibeskrivelse</a>' +
    '</td></tr></table></td></tr>' +

    '<tr><td style="padding:0 15px 14px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e2e7dd;border-radius:13px;border-collapse:separate;background:#ffffff;">' +
    '<tr><td colspan="2" style="padding:16px 13px 7px;font-size:17px;font-weight:bold;color:#153321;">Bestilte varer</td></tr>' +
    (rows || '<tr><td colspan="2" style="padding:15px;font-size:13px;">Ingen produktlinjer lagret.</td></tr>') +
    '<tr><td style="padding:12px;color:#657369;font-size:13px;">Delsum</td><td align="right" style="padding:12px;color:#263c2e;font-size:13px;white-space:nowrap;">' +
    safe(money2(subtotal)) + '</td></tr>' +
    '<tr><td style="padding:0 12px 15px;color:#657369;font-size:13px;">Herav MVA (15 %)</td><td align="right" style="padding:0 12px 15px;color:#263c2e;font-size:13px;white-space:nowrap;">' +
    safe(money2(totalMva)) + '</td></tr>' +
    '<tr><td style="padding:17px 12px;background:#123c2b;color:white;font-size:23px;font-weight:800;">Totalt</td>' +
    '<td align="right" style="padding:17px 12px;background:#123c2b;color:white;font-size:23px;font-weight:800;white-space:nowrap;">' +
    safe(money(total)) + '</td></tr>' +
    '</table></td></tr>' +

    (kolPlain_(order.comment) ? '<tr><td style="padding:2px 26px 14px;font-size:12px;color:#536457;"><strong>Kommentar:</strong> ' + safe(order.comment) + '</td></tr>' : '') +
    '<tr><td align="center" style="padding:17px 15px 26px;color:#68756b;font-size:12px;line-height:20px;">' +
    'Takk for at du bestiller hos<br><strong style="color:#143623;font-size:13px;letter-spacing:1px;">KØL GRILL &amp; PIZZA</strong><br>' +
    '<a href="' + orderLink + '" style="color:#286844;">Se vår meny</a><br>' +
    '<a href="mailto:skarnes.restaurant@gmail.com" style="color:#286844;">skarnes.restaurant@gmail.com</a>' +
    '</td></tr></table></td></tr></table></body></html>';

  const text =
    'KØL Grill & Pizza\n' +
    (accepted ? 'Bestillingen din er bekreftet.' : 'Bestillingen din er klar for henting!') +
    '\n' + mainLabel + ' ' + mainTime +
    '\n' + statusLeft + ' – ' + statusRight +
    '\n\nHei ' + firstName + '! ' + intro +
    '\n\n' + info.map(function(p) {return p[0] + ': ' + p[1];}).join('\n') +
    '\nHenting: Øgardsvegen 44, 2100 Skarnes' +
    '\n\nBestilte varer:\n' + detailsPlain +
    '\n\nDelsum: ' + money2(subtotal) +
    '\nHerav MVA (15 %): ' + money2(totalMva) +
    '\nTotalt: ' + money(total) +
    '\n\nVennlig hilsen KØL Grill & Pizza';
  return { subject:subject, html:html, text:text };
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

/**
 * Persist independent evidence AFTER MailApp.sendEmail returns successfully.
 * The admin reads the existing order SSE; no per-order polling is needed.
 * "accepted" means accepted by MailApp, not proven delivered to inbox.
 */
function kolEmailPutJson_(path, body) {
  const response = UrlFetchApp.fetch(KOL_DB + '/' + path + '.json', {
    method:'put', contentType:'application/json',
    payload:JSON.stringify(body), muteHttpExceptions:true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Firebase bekreftelse HTTP ' + response.getResponseCode());
  }
}

function kolEmailReceipt_(id, kind, order, sentAt) {
  if (!/^ord_[a-z0-9]{7,40}$/i.test(String(id)) || !['accepted','ready'].includes(kind)) {
    throw new Error('Ugyldig e-postkvitteringsnøkkel.');
  }
  kolEmailPutJson_('orders/' + encodeURIComponent(id) +
    '/emailReceipts/' + kind, {
      sentAt: Number(sentAt) || Date.now(),
      statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
      provider: 'MailApp', state:'accepted'
    });
}

/** Fresh proof of working polling and mail authorization, not mail delivery. */
function kolEmailHeartbeat_(now, state) {
  const quota = MailApp.getRemainingDailyQuota();
  kolEmailPutJson_('emailHealth', {
    checkedAt:now, quotaRemaining:Number(quota) || 0,
    status:state === 'ok' && quota > 0 ? 'ok' : 'unavailable',
    source:'apps-script-email-poller'
  });
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
  Logger.log('BEKREFTET HTML: ' + kolBuildReceipt_(sample,'accepted').html);
  sample.staffReadyAt = Date.now();
  sample.statusUpdatedAt = sample.staffReadyAt;
  Logger.log('KLAR HTML: ' + kolBuildReceipt_(sample,'ready').html);
}

/** Sends two sample template emails ONLY to this Apps Script account. */
function testBeggeEpostMalerTilMeg() {
  const to = Session.getEffectiveUser().getEmail();
  if (!to) throw new Error('Fant ingen e-postadresse til pålogget konto.');
  const now = Date.now();
  const sample = {
    id:'TEST-5549NO', customerName:'Testkunde', phone:'+47 40000000',
    email:to, createdAt:now-300000, pickup:'Snarest', pickupMode:'asap',
    estimatedMinutes:15, estimatedReadyAt:now+15*60000,
    staffReadyAt:now, statusUpdatedAt:now,
    subtotal:503, total:503,
    lines:[
      {name:'1. Classico',quantity:1,price:294,size:'Stor',optionDetails:[{groupTitle:'Alternativer',label:'Bare skinke'}]},
      {name:'Hamburger Tallerken',quantity:1,price:209,size:'Standard'}
    ]
  };
  kolSendMail_(sample,'accepted');
  kolSendMail_(sample,'ready');
  Logger.log('Begge HTML-malene sendt til skripteieren: ' + to);
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
    if (kolEmailIndexedQueryOk_) props.setProperty(KOL_EMAIL_SCAN_CURSOR_KEY, String(now));
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
      const checkpoint = previousJson
        ? JSON.parse(previousJson)
        : {status:'', updated:now, sent:{}};
      if (!checkpoint.sent || typeof checkpoint.sent !== 'object') checkpoint.sent = {};

      const kind = kolNotificationKind_(checkpoint.status, order, now);
      const stamp = String(order.statusUpdatedAt || '0');
      const eventKey = kind + ':' + stamp;
      // One email of each kind maximum: never duplicate a completed or
      // uncertain MailApp send after timeout or a manual re-confirmation.
      const alreadyProcessed = kind && Object.keys(checkpoint.sent).some(function(k) {
        return k.indexOf(kind + ':') === 0;
      });
      if (kind && !alreadyProcessed) {
        checkpoint.sent[eventKey] = 'attempted';
        checkpoint.status = status;
        checkpoint.updated = now;
        props.setProperty(key, JSON.stringify(checkpoint));
        try {
          if (kolSendMail_(Object.assign({id:id},order), kind)) {
            const sentAt = Date.now();
            checkpoint.sent[eventKey] = 'sent';
            props.setProperty(key, JSON.stringify(checkpoint));
            // MailApp succeeded; only then publish the order confirmation.
            try {
              kolEmailReceipt_(id, kind, order, sentAt);
            } catch (receiptError) {
              // Never claim a receipt that was not stored. Do not resend mail
              // just because this separate bookkeeping write failed.
              Logger.log('E-post sendt, men kvittering ikke lagret for ordre '
                + id.slice(-6) + ': ' + receiptError.message);
            }
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
      } else if (!previousJson || checkpoint.status !== status) {
        checkpoint.status = status;
        checkpoint.updated = now;
        props.setProperty(key, JSON.stringify(checkpoint));
      }
    }
    if (kolEmailIndexedQueryOk_) props.setProperty(KOL_EMAIL_SCAN_CURSOR_KEY, String(now));
    try { kolEmailHeartbeat_(now, 'ok'); }
    catch (err) { Logger.log('E-postkontroll kunne ikke publiseres: ' + err.message); }
  } catch (err) {
    Logger.log('E-postpoller feilet: ' + err.message);
    try { kolEmailHeartbeat_(Date.now(), 'error'); } catch (_) {}
    throw err;
  } finally { lock.releaseLock(); }
}

/** Stop just this email poller; does not affect any SMS project. */
function stoppEpostVarsler() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kontrollerEpostBestillinger')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('E-postovervåking stoppet.');
}
