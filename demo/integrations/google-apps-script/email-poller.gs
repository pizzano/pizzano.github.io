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
const KOL_EMAIL_FIRST_SEEN_FIX_KEY = 'KOL_EMAIL_FIRST_SEEN_FIX_VERSION';
const KOL_EMAIL_FIRST_SEEN_FIX_VERSION = '20261017-v1';
let kolEmailIndexedQueryOk_ = false;

function kolReadOrders_() {
  const now = Date.now();
  const props = PropertiesService.getScriptProperties();
  const lastScan = Number(props.getProperty(KOL_EMAIL_SCAN_CURSOR_KEY)) || 0;
  // One-time recovery for accepted test orders missed by the old first-scan
  // bug. Normal subsequent polls retain the small indexed two-minute overlap.
  const firstRunWithFix = props.getProperty(KOL_EMAIL_FIRST_SEEN_FIX_KEY)
    !== KOL_EMAIL_FIRST_SEEN_FIX_VERSION;
  const since = Math.max(
    now - KOL_MAX_ORDER_AGE_MS,
    firstRunWithFix ? now - KOL_EMAIL_EVENT_MAX_AGE_MS :
      (lastScan > 0 ? lastScan - KOL_EMAIL_SCAN_OVERLAP_MS : now - KOL_MAX_ORDER_AGE_MS)
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

/** Templates are plain text, not arbitrary HTML. Existing invoice and item
 * rendering stays in script and continues to HTML-escape customer content.
 */
/** Reusable, strict HTML renderer for full Firebase email templates.
 * Bundled into email-poller.gs for the one-file Apps Script installation.
 */

function kolSafeTemplateStyle_(raw){
  const allowed='background background-color color padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left border border-top border-right border-bottom border-left border-radius border-collapse font-size font-family font-weight font-style text-align text-decoration line-height letter-spacing max-width min-width width height vertical-align white-space display'.split(' ');
  return String(raw||'').split(';').map(function(part){
    const i=part.indexOf(':');if(i<=0)return '';
    const prop=part.slice(0,i).trim().toLowerCase(),value=part.slice(i+1).trim();
    if(allowed.indexOf(prop)<0||!value||value.length>170||
      !/^[a-z0-9 .,#()%+-]+$/i.test(value)||
      /url\s*\(|expression\s*\(|@import|javascript|behavior/i.test(value))return '';
    return prop+':'+value;
  }).filter(Boolean).join(';');
}
function kolSanitizeFullTemplateHtml_(source){
  // Admin may paste a complete HTML document. We accept its visual body
  // while stripping document wrappers and head-only declarations; only
  // the safe email body layout is inserted in the MailApp HTML envelope.
  source=String(source||'').replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi,'')
    // Comments are design notes, never email content. Previously the strict
    // sanitizer escaped them, so Gmail displayed "<!-- Brand -->" as text.
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<!doctype[^>]*>/gi,'')
    .replace(/<\/?(?:html|body)\b[^>]*>/gi,'');
  const tags='table tbody thead tfoot tr td th div span p br b strong i em u s strike del a h1 h2 h3 h4 ul ol li hr center small'.split(' ');
  const attributes='style align valign width height colspan rowspan border cellpadding cellspacing role bgcolor href target title'.split(' ');
  const parts=String(source||'').replace(/<!doctype[^>]*>/gi,'').match(/<[^>]*>|[^<]+|</g)||[];
  const stack=[];let result='';
  parts.forEach(function(part){
    if(part[0]!=='<'){result+=part;return}
    const m=/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^<>]*)>$/i.exec(part);
    if(!m||tags.indexOf(m[2].toLowerCase())<0){
      // Drop all other markup declarations, including malformed comment
      // fragments, rather than showing HTML source to email recipients.
      if(/^<\s*!/.test(part))return;
      result+=kolHtmlEscape_(part);
      return;
    }
    const tag=m[2].toLowerCase();
    if(m[1]){
      const at=stack.lastIndexOf(tag);
      if(at>=0)while(stack.length>at)result+='</'+stack.pop()+'>';
      return;
    }
    let args='';
    const expr=/([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/gi;
    const raw=m[3].replace(/\/\s*$/,'');
    let match;
    while((match=expr.exec(raw))!==null){
      const key=match[1].toLowerCase();
      if(attributes.indexOf(key)<0)continue;
      let value=match[2]!==undefined?match[2]:(match[3]!==undefined?match[3]:(match[4]||''));
      if(key==='style')value=kolSafeTemplateStyle_(value);
      else if(key==='href'){
        if(!/^https:\/\/[^\s"'<>]{1,400}$/i.test(value)&&
          !/^mailto:[^\s"'<>]{1,240}$/i.test(value))continue;
      }else if(key==='target'){
        if(value!=='_blank')continue;
      }else if(!/^[a-z0-9 _.,%#-]{1,100}$/i.test(value))continue;
      if(value)args+=' '+key+'="'+kolHtmlEscape_(value)+'"';
    }
    result+='<'+tag+args+'>';
    if(tag!=='br'&&tag!=='hr')stack.push(tag);
  });
  while(stack.length)result+='</'+stack.pop()+'>';
  return result;
}
function kolSafeFullTemplateVariable_(source,vars){
  return String(source||'').replace(/\{([a-zA-Z]+)\}/g,function(token,key){
    return Object.prototype.hasOwnProperty.call(vars,key)?kolHtmlEscape_(vars[key]):token;
  });
}
function kolRenderFullEmailTemplate_(htmlTemplate,vars,order,money){
  if(typeof htmlTemplate!=='string'||htmlTemplate.length<30||htmlTemplate.length>45000)
    throw new Error('HTML mal har ugyldig størrelse.');
  const products=(Array.isArray(order.lines)?order.lines:[]).slice(0,100).map(function(line){
    const details=kolDetailRows_(line).map(d=>d.name+': '+d.text).join(', ');
    return {antall:String(Math.max(1,Number(line.quantity)||1)),
      produkt:String(line.name||'Produkt'),linjepris:money(Number(line.price)||0),
      valg:details||String(line.size||'')};
  });
  const details=[
    {etikett:'Bestillingskode',verdi:'#'+String(vars.kode||'')},
    {etikett:'Bestilt',verdi:String(vars.bestilt||'')},
    {etikett:'Navn',verdi:String(vars.navnFullt||'')},
    {etikett:'Telefon',verdi:String(vars.telefon||'')}
  ];
  let expanded=htmlTemplate.replace(/\{\{#each (items|details)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    function(original,kind,inner){
      const group=kind==='items'?products:details;
      return group.map(row=>kolSafeFullTemplateVariable_(inner,row)).join('');
    });
  expanded=kolSafeFullTemplateVariable_(expanded,vars);
  const clean=kolSanitizeFullTemplateHtml_(expanded);
  return '<!doctype html><html lang="no"><head><meta charset="UTF-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body style="margin:0;padding:20px 10px;background:#eef1eb;font-family:Arial,Helvetica,sans-serif;">'+
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+
    '<tr><td align="center">'+clean+'</td></tr></table></body></html>';
}


function kolReadMailTemplates_(){
  try{
    const response=UrlFetchApp.fetch(KOL_DB+'/notificationTemplates.json',
      {method:'get',muteHttpExceptions:true});
    if(response.getResponseCode()!==200)return {};
    const all=JSON.parse(response.getContentText()||'null');
    return all&&typeof all==='object'?all:{};
  }catch(error){Logger.log('E-postmaler utilgjengelige: '+error.message);return {}}
}
function kolMailTemplateText_(text,vars){
  return String(text||'').replace(/\{([a-zA-Z]+)\}/g,function(token,key){
    return Object.prototype.hasOwnProperty.call(vars,key)?vars[key]:token;
  });
}
function kolSafeMailTemplate_(template){
  if(!template||typeof template!=='object'||!template.subject||
     String(template.subject).length>220||/[\r\n]/.test(String(template.subject)))return null;
  if(template.version===2)return typeof template.html==='string' &&
    template.html.length>=30 && template.html.length<=45000?template:null;
  if(template.version!==1||typeof template.body!=='string'||!template.headline||
     template.body.length>2200||String(template.headline).length>160)return null;
  return template;
}



/** Fallback is used only when an HTML template has not yet been saved.
 * The visual design itself belongs in Firebase, not in this script.
 */
const KOL_FALLBACK_EMAIL_HTML = {"accepted":"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"width:100%;max-width:620px;border-collapse:collapse;background:#fffefa;\">\n<tr><td align=\"center\" style=\"padding:30px 15px 24px;background:#10291c;color:#fff8e8;border-bottom:4px solid #bda36b;\">\n<div style=\"font-size:11px;line-height:18px;letter-spacing:3px;color:#d7bf8b;\">✦ GOD MAT SAMLER FOLK ✦</div>\n<div style=\"font-size:46px;line-height:1.2;font-weight:800;letter-spacing:3px;color:#fff9ec;\">KØL</div>\n<div style=\"font-size:16px;line-height:24px;letter-spacing:5px;font-weight:bold;color:#fff9ec;\">GRILL &amp; PIZZA</div>\n<div style=\"padding-top:8px;font-size:11px;line-height:16px;letter-spacing:2px;color:#dac89e;\">PIZZA · GRILL · KVALITET</div>\n</td></tr>\n<tr><td style=\"padding:16px 15px 8px;background:#fffefa;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eef4e7;border-radius:16px;\">\n<tr><td align=\"center\" style=\"padding:20px 10px 8px;color:#20442b;font-size:12px;font-weight:800;letter-spacing:1px;\">{overskrift}</td></tr>\n<tr><td align=\"center\" style=\"padding:0 6px 23px;color:#10291c;\">\n<div style=\"font-size:20px;font-weight:800;\">{hovedetikett}</div>\n<div style=\"font-size:52px;line-height:1.15;font-weight:900;\">{hovedtid}</div>\n</td></tr></table></td></tr>\n<tr><td style=\"padding:0 15px 13px;background:#fffefa;\">\n<table role=\"presentation\" width=\"100%\" style=\"background:#f6f6f0;border-radius:13px;\"><tr><td width=\"48%\" align=\"center\" style=\"padding:15px 7px;color:#123c27;font-size:15px;font-weight:bold;\">{hentetype}</td><td width=\"52%\" align=\"center\" style=\"padding:15px 7px;border-left:1px solid #e3e6dd;color:#193b27;font-size:14px;font-weight:bold;\">{tidsinfo}</td></tr></table></td></tr>\n<tr><td style=\"padding:8px 26px 18px;font-size:14px;line-height:22px;color:#546358;\">__KOL_INTRO__</td></tr>\n<tr><td style=\"padding:0 15px 14px;\">\n<table role=\"presentation\" width=\"100%\" style=\"border:1px solid #e2e7dd;border-radius:13px;background:#fff;\">\n<tr><td colspan=\"2\" style=\"padding:16px 13px 5px;font-size:17px;font-weight:bold;color:#153321;\">Bestillingsdetaljer</td></tr>\n{{#each details}}\n<tr><td style=\"padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#68736c;font-size:13px;\">{etikett}</td><td align=\"right\" style=\"padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#15291d;font-size:13px;font-weight:bold;\">{verdi}</td></tr>\n{{/each}}\n<tr><td colspan=\"2\" style=\"padding:12px;font-size:12px;color:#65736a;\">Henting: {adresse}</td></tr></table></td></tr>\n<tr><td style=\"padding:0 15px 14px;\">\n<table role=\"presentation\" width=\"100%\" style=\"border:1px solid #e2e7dd;border-radius:13px;background:#fff;\">\n<tr><td colspan=\"2\" style=\"padding:16px 13px 7px;font-size:17px;font-weight:bold;color:#153321;\">Bestilte varer</td></tr>\n{{#each items}}\n<tr><td style=\"padding:14px 12px;border-bottom:1px solid #e5e8e1;vertical-align:top;\"><strong>{antall} × {produkt}</strong><div style=\"font-size:12px;color:#738077;\">{valg}</div></td><td align=\"right\" style=\"padding:14px 12px;border-bottom:1px solid #e5e8e1;font-weight:bold;\">{linjepris}</td></tr>\n{{/each}}\n<tr><td style=\"padding:12px;\">Delsum</td><td align=\"right\" style=\"padding:12px;\">{delsum}</td></tr><tr><td style=\"padding:0 12px 15px;\">Herav MVA (15 %)</td><td align=\"right\" style=\"padding:0 12px 15px;\">{mva}</td></tr><tr><td style=\"padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;\">Totalt</td><td align=\"right\" style=\"padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;\">{total}</td></tr></table></td></tr>\n<tr><td style=\"padding:0 25px 15px;color:#455c4b;font-size:13px;\">__KOL_FOOTER__</td></tr>\n<tr><td align=\"center\" style=\"padding:17px 15px 26px;color:#68756b;font-size:12px;\">KØL GRILL &amp; PIZZA<br><a href=\"{lenke}\" style=\"color:#286844;\">Se bestillingen</a></td></tr></table>","ready":"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"width:100%;max-width:620px;border-collapse:collapse;background:#fffefa;\">\n<tr><td align=\"center\" style=\"padding:30px 15px 24px;background:#10291c;color:#fff8e8;border-bottom:4px solid #bda36b;\">\n<div style=\"font-size:11px;line-height:18px;letter-spacing:3px;color:#d7bf8b;\">✦ GOD MAT SAMLER FOLK ✦</div>\n<div style=\"font-size:46px;line-height:1.2;font-weight:800;letter-spacing:3px;color:#fff9ec;\">KØL</div>\n<div style=\"font-size:16px;line-height:24px;letter-spacing:5px;font-weight:bold;color:#fff9ec;\">GRILL &amp; PIZZA</div>\n<div style=\"padding-top:8px;font-size:11px;line-height:16px;letter-spacing:2px;color:#dac89e;\">PIZZA · GRILL · KVALITET</div>\n</td></tr>\n<tr><td style=\"padding:16px 15px 8px;background:#fffefa;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eef4e7;border-radius:16px;\">\n<tr><td align=\"center\" style=\"padding:20px 10px 8px;color:#20442b;font-size:12px;font-weight:800;letter-spacing:1px;\">{overskrift}</td></tr>\n<tr><td align=\"center\" style=\"padding:0 6px 23px;color:#10291c;\">\n<div style=\"font-size:20px;font-weight:800;\">{hovedetikett}</div>\n<div style=\"font-size:52px;line-height:1.15;font-weight:900;\">{hovedtid}</div>\n</td></tr></table></td></tr>\n<tr><td style=\"padding:0 15px 13px;background:#fffefa;\">\n<table role=\"presentation\" width=\"100%\" style=\"background:#f6f6f0;border-radius:13px;\"><tr><td width=\"48%\" align=\"center\" style=\"padding:15px 7px;color:#123c27;font-size:15px;font-weight:bold;\">{hentetype}</td><td width=\"52%\" align=\"center\" style=\"padding:15px 7px;border-left:1px solid #e3e6dd;color:#193b27;font-size:14px;font-weight:bold;\">{tidsinfo}</td></tr></table></td></tr>\n<tr><td style=\"padding:8px 26px 18px;font-size:14px;line-height:22px;color:#546358;\">__KOL_INTRO__</td></tr>\n<tr><td style=\"padding:0 15px 14px;\">\n<table role=\"presentation\" width=\"100%\" style=\"border:1px solid #e2e7dd;border-radius:13px;background:#fff;\">\n<tr><td colspan=\"2\" style=\"padding:16px 13px 5px;font-size:17px;font-weight:bold;color:#153321;\">Bestillingsdetaljer</td></tr>\n{{#each details}}\n<tr><td style=\"padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#68736c;font-size:13px;\">{etikett}</td><td align=\"right\" style=\"padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#15291d;font-size:13px;font-weight:bold;\">{verdi}</td></tr>\n{{/each}}\n<tr><td colspan=\"2\" style=\"padding:12px;font-size:12px;color:#65736a;\">Henting: {adresse}</td></tr></table></td></tr>\n<tr><td style=\"padding:0 15px 14px;\">\n<table role=\"presentation\" width=\"100%\" style=\"border:1px solid #e2e7dd;border-radius:13px;background:#fff;\">\n<tr><td colspan=\"2\" style=\"padding:16px 13px 7px;font-size:17px;font-weight:bold;color:#153321;\">Bestilte varer</td></tr>\n{{#each items}}\n<tr><td style=\"padding:14px 12px;border-bottom:1px solid #e5e8e1;vertical-align:top;\"><strong>{antall} × {produkt}</strong><div style=\"font-size:12px;color:#738077;\">{valg}</div></td><td align=\"right\" style=\"padding:14px 12px;border-bottom:1px solid #e5e8e1;font-weight:bold;\">{linjepris}</td></tr>\n{{/each}}\n<tr><td style=\"padding:12px;\">Delsum</td><td align=\"right\" style=\"padding:12px;\">{delsum}</td></tr><tr><td style=\"padding:0 12px 15px;\">Herav MVA (15 %)</td><td align=\"right\" style=\"padding:0 12px 15px;\">{mva}</td></tr><tr><td style=\"padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;\">Totalt</td><td align=\"right\" style=\"padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;\">{total}</td></tr></table></td></tr>\n<tr><td style=\"padding:0 25px 15px;color:#455c4b;font-size:13px;\">__KOL_FOOTER__</td></tr>\n<tr><td align=\"center\" style=\"padding:17px 15px 26px;color:#68756b;font-size:12px;\">KØL GRILL &amp; PIZZA<br><a href=\"{lenke}\" style=\"color:#286844;\">Se bestillingen</a></td></tr></table>"};
/** Resolve public order links from the page URL captured by the customer
 * browser when the order was created. Scripts cannot access window.location.
 * ORDER_PAGE_URL Script Property is only for orders created before this change.
 */
function kolEmailOrderLink_(order, orderId) {
  const id = String(orderId || '').trim();
  if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(id))
    throw new Error('Ugyldig bestillings-ID for e-postlenke.');
  const props = PropertiesService.getScriptProperties();
  const candidate = String((order && order.orderPageUrl) || props.getProperty('ORDER_PAGE_URL') || '').trim();
  if (candidate.length > 300 || /[?#\\\s]/.test(candidate))
    throw new Error('Ugyldig kunde-URL for e-post.');
  const match = /^https:\/\/([a-z0-9.-]+)(?::[0-9]{1,5})?(\/[a-z0-9._~%!$&'()*+,;=:@/-]*)?$/i.exec(candidate);
  if (!match || !match[1].includes('.') || match[1].includes('..'))
    throw new Error('Ordren mangler gyldig kunde-URL. Eldre ordre krever Script Property ORDER_PAGE_URL.');
  const base = candidate.replace(/\/?(?:index|admin)\.html$/i, '/').replace(/\/+$/, '') + '/';
  return base + '?order=' + encodeURIComponent(id);
}

function kolBuildReceipt_(order,kind,templates) {
  if(kind!=='accepted'&&kind!=='ready')throw new Error('Ukjent e-postvarsel: '+kind);
  const accepted=kind==='accepted';
  const template=kolSafeMailTemplate_((templates||{})[accepted?'emailAccepted':'emailReady']);
  const name=kolPlain_(order.customerName);
  const first=name.split(/\s+/)[0]||'kunde';
  const code=kolPlain_(order.id).slice(-6).toUpperCase()||'ORDRE';
  const total=Number(order.total)||0;
  const subtotal=Number(order.subtotal==null?order.total:order.subtotal)||0;
  const fmt=(amount,decimals)=>{
    const number=Number(amount)||0;
    return number.toLocaleString('nb-NO',{
      minimumFractionDigits:decimals,maximumFractionDigits:decimals
    })+' kr';
  };
  const money=value=>fmt(value,Number.isInteger(Number(value))?0:2);
  const money2=value=>fmt(value,2);
  const time=(stamp,pattern)=>Number(stamp)>0
    ? Utilities.formatDate(new Date(Number(stamp)),'Europe/Oslo',pattern):'';
  const scheduled=order.pickupMode==='scheduled'||/^\d{1,2}:\d{2}$/.test(kolPlain_(order.pickup));
  const chosen=/^\d{1,2}:\d{2}$/.test(kolPlain_(order.pickup))
    ?kolPlain_(order.pickup).padStart(5,'0'):'';
  const pickup=time(Number(order.scheduledPickupAt)||Number(order.estimatedReadyAt),'HH:mm')||chosen;
  const ready=time(Number(order.staffReadyAt)||Number(order.statusUpdatedAt),'HH:mm');
  const clock=accepted?(pickup||'Snarest'):(ready||'Nå');
  const label=accepted?'Hentetid:':'Klar kl.';
  const pickupType=accepted?(scheduled?'Planlagt henting':'Snarest'):'Klar for henting';
  const minutes=Math.max(0,Math.ceil(Number(order.estimatedMinutes)||0));
  const statusInfo=accepted
    ?(scheduled?(time(order.scheduledPickupAt,'dd.MM.yyyy')||'Avtalt tid'):
      (minutes>0?'Ca. '+minutes+(minutes===1?' minutt':' minutter'):'Så snart som mulig'))
    :'Du kan hente maten nå';
  const heading=accepted?'BESTILLINGEN DIN ER BEKREFTET':'DIN BESTILLING ER KLAR TIL HENTING';
  const intro=accepted
    ?'Hei <strong>{navn}</strong>! Vi har bekreftet bestillingen din og forbereder maten.'
    :'Hei <strong>{navn}</strong>! Maten din er klar for henting.';
  const outro='Takk for at du bestiller hos KØL Grill & Pizza!';
  const id=String(order.id||'');
  const link=kolEmailOrderLink_(order,id);
  const vars={
    navn:first,navnFullt:name||first,kode:code,telefon:kolPlain_(order.phone),
    hentetid:clock,hovedtid:clock,hovedetikett:template?.timeLabel||label,
    hentetype:pickupType,tidsinfo:statusInfo,
    bestilt:time(order.createdAt,'dd.MM.yyyy, HH:mm')||'—',
    delsum:money2(subtotal),mva:money2(total*15/115),total:money(total),
    lenke:link,adresse:'Øgardsvegen 44, 2100 Skarnes',
    overskrift:template?.headline||heading
  };
  const htmlSource=template?.version===2 ?template.html:
    KOL_FALLBACK_EMAIL_HTML[kind];
  // Older v1 templates stay functional; HTML is still sanitized by the
  // same renderer. They do not need any manual migration.
  const body=template?.version===1?String(template.body||'').slice(0,2200):intro;
  const footer=template?.version===1?String(template.footer||'').slice(0,500):outro;
  const finalSource=template?.version===2?htmlSource:
    htmlSource.replace('__KOL_INTRO__',body).replace('__KOL_FOOTER__',footer)
      .replace('Bestillingsdetaljer',template?.detailsTitle||'Bestillingsdetaljer')
      .replace('Bestilte varer',template?.itemsTitle||'Bestilte varer');
  if(template?.version===1) {
    if(template.statusLeft)vars.hentetype=kolMailTemplateText_(template.statusLeft,vars);
    if(template.statusRight)vars.tidsinfo=kolMailTemplateText_(template.statusRight,vars);
  }
  const subjectTemplate=template?.subject||
    (accepted?'Bestillingen din er bekreftet':'Bestillingen din er klar for henting')+
    ' #{kode} – KØL Grill & Pizza';
  const subject=kolMailTemplateText_(subjectTemplate,vars);
  const html=kolRenderFullEmailTemplate_(finalSource,vars,order,money);
  const products=(Array.isArray(order.lines)?order.lines:[]).map(line=>
    (Number(line.quantity)||1)+' × '+kolPlain_(line.name)+' — '+money(line.price)+
    kolDetailRows_(line).map(d=>'\n  '+d.name+': '+d.text).join('')
  ).join('\n');
  const text='KØL Grill & Pizza\n'+heading+
    '\n'+vars.hovedetikett+' '+clock+
    '\n'+vars.hentetype+' – '+vars.tidsinfo+
    '\n\n'+(template?.version===1
      ?kolMailTemplateText_(template.body,vars).replace(/<[^>]*>/g,'')
      :('Hei '+first+'! Bestillingen din hos KØL Grill & Pizza.'))+
    '\n\nBestillingskode: #'+code+
    '\nBestilt: '+vars.bestilt+'\nNavn: '+name+'\nTelefon: '+vars.telefon+
    '\nHenting: '+vars.adresse+'\n\nBestilte varer:\n'+products+
    '\n\nDelsum: '+vars.delsum+'\nHerav MVA (15 %): '+vars.mva+
    '\nTotalt: '+vars.total+'\n\nSe bestillingen: '+link+
    '\n\nKØL Grill & Pizza';
  return {subject,html,text};
}

function kolSendMail_(order, kind, mailTemplates) {
  const address = kolEmail_(order);
  if (!address) return false;
  const receipt = kolBuildReceipt_(order, kind, mailTemplates);
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
    source:'apps-script-email-poller',
    // Admin Varslinger uses this to detect whether the live sender supports
    // the editor's <strong> tags. Old workers do not publish this marker.
    templateEngineVersion:4,
    completeHtmlEditor:true,
    strongFormatting:true,
    safeInlineFormatting:true
  });
}

/** Preview without sending customer email. Run and inspect execution log. */
function forhåndsvisEpostEksempel() {
  const sample = {
    id:'ord_previewabc123',customerName:'Testkunde',phone:'+47 400 00 000',
    email:'test@example.com',orderPageUrl:'https://example.org/',
    createdAt:Date.now(),estimatedMinutes:25,
    pickup:'Snarest',subtotal:227,total:227,
    lines:[{quantity:1,name:'Classico',size:'Medium',price:227,
      optionDetails:[{groupTitle:'Ekstra topping',label:'Pepperoni',price:19}],
      removedIngredients:['Løk'],comment:'Godt stekt'}]
  };
  Logger.log('BEKREFTET HTML: ' + kolBuildReceipt_(sample,'accepted',kolReadMailTemplates_()).html);
  sample.staffReadyAt = Date.now();
  sample.statusUpdatedAt = sample.staffReadyAt;
  Logger.log('KLAR HTML: ' + kolBuildReceipt_(sample,'ready',kolReadMailTemplates_()).html);
}

/** Sends two sample template emails ONLY to this Apps Script account. */
function testBeggeEpostMalerTilMeg() {
  const to = Session.getEffectiveUser().getEmail();
  if (!to) throw new Error('Fant ingen e-postadresse til pålogget konto.');
  const now = Date.now();
  const sample = {
    id:'ord_testemail123', customerName:'Testkunde', phone:'+47 40000000',
    email:to, orderPageUrl:'https://example.org/',
    createdAt:now-300000, pickup:'Snarest', pickupMode:'asap',
    estimatedMinutes:15, estimatedReadyAt:now+15*60000,
    staffReadyAt:now, statusUpdatedAt:now,
    subtotal:503, total:503,
    lines:[
      {name:'1. Classico',quantity:1,price:294,size:'Stor',optionDetails:[{groupTitle:'Alternativer',label:'Bare skinke'}]},
      {name:'Hamburger Tallerken',quantity:1,price:209,size:'Standard'}
    ]
  };
  const templates = kolReadMailTemplates_();
  kolSendMail_(sample,'accepted',templates);
  kolSendMail_(sample,'ready',templates);
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


/** Test to the authenticated Apps Script owner's own mailbox only.
 * Browser requests cannot specify recipients. 4/day and 3-minute cooldown.
 */
function kolProcessMailTests_(props,mailTemplates){
  for(const kind of ['emailAccepted','emailReady']){
    const response=UrlFetchApp.fetch(KOL_DB+'/notificationTests/'+kind+'/request.json',
      {method:'get',muteHttpExceptions:true});
    if(response.getResponseCode()!==200)continue;
    const request=JSON.parse(response.getContentText()||'null');
    if(!request||request.kind!==kind||!/^nt_[a-z0-9_]{8,45}$/.test(String(request.id)))continue;
    const id=String(request.id),key='KOL_MAIL_TEST_ID_'+kind;
    if(props.getProperty(key)===id)continue;
    props.setProperty(key,id);
    const now=Date.now();
    const result=(state,message)=>{
      try{kolEmailPutJson_('notificationTests/'+kind+'/result',
        {id,state,at:Date.now(),message})}
      catch(error){Logger.log('Teststatus kunne ikke lagres: '+error.message)}
    };
    if(Math.abs(now-Number(request.requestedAt))>10*60000){
      result('ignored','Testforespørselen er utløpt.');continue;
    }
    const day=Utilities.formatDate(new Date(now),'Europe/Oslo','yyyyMMdd');
    const count=props.getProperty('KOL_MAIL_TEST_DAY')===day?
      Number(props.getProperty('KOL_MAIL_TEST_COUNT')||0):0;
    const since=now-Number(props.getProperty('KOL_MAIL_TEST_LAST_AT')||0);
    if(count>=4||since<180000){result('rate_limited','Maks 4 e-posttester per dag og 3 minutter mellom dem.');continue}
    // Fixed test mailbox set privately in Apps Script Properties; never
    // accept a recipient from Firebase or the public admin browser.
    // If unset, default to the account owning the time-driven trigger.
    const to=String(props.getProperty('KOL_TEST_EMAIL')||
      Session.getEffectiveUser().getEmail()||'').trim();
    if(!kolEmail_({email:to})){
      result('failed','Ingen gyldig testadresse. Angi KOL_TEST_EMAIL i Apps Script → Script Properties.');continue;
    }
    props.setProperty('KOL_MAIL_TEST_DAY',day);
    props.setProperty('KOL_MAIL_TEST_COUNT',String(count+1));
    props.setProperty('KOL_MAIL_TEST_LAST_AT',String(now));
    result('attempted','Test godkjent for avsenderkontoens innboks.');
    const sample={id:'ord_'+now.toString(36)+'test',customerName:'FATIH',
      email:to,phone:'+47 40000000',createdAt:now-120000,
      pickup:'Snarest',estimatedReadyAt:now+15*60000,
      staffReadyAt:now,total:588,
      lines:[{name:'Stor Classico',quantity:2,price:588,size:'Stor'}]};
    try{
      if(kolSendMail_(sample,kind==='emailReady'?'ready':'accepted',mailTemplates)){
        result('sent','MailApp godtok test til avsenderkontoen (innbokslevering ikke bekreftet).');
      }else result('failed','Ugyldig testmottaker.');
    }catch(error){result('failed',String(error.message).slice(0,150))}
  }
}

/** Scheduled, email-only order status check. */
function kontrollerEpostBestillinger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const mailTemplates = kolReadMailTemplates_();
    // Handle admin email tests first, independently of the normal orders
    // query. A missing/invalid Firebase order index must not block test mail.
    try { kolProcessMailTests_(props,mailTemplates); }
    catch (error) { Logger.log('E-posttest feilet: ' + error.message); }
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
          if (kolSendMail_(Object.assign({id:id},order), kind,mailTemplates)) {
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
    props.setProperty(KOL_EMAIL_FIRST_SEEN_FIX_KEY, KOL_EMAIL_FIRST_SEEN_FIX_VERSION);
    try { kolEmailHeartbeat_(now, 'ok'); }
    catch (err) { Logger.log('E-postkontroll kunne ikke publiseres: ' + err.message); }
  } catch (err) {
    Logger.log('E-postpoller feilet: ' + err.message);
    try { kolEmailHeartbeat_(Date.now(), 'error'); } catch (_) {}
    throw err;
  } finally { lock.releaseLock(); }
}

/** Run manually in Apps Script to diagnose/admin-test without touching
 * customer orders. Respects the same fixed recipient and daily limits.
 * Check Executions log and Admin > Varslinger > Kontroller teststatus.
 */
function kontrollerEpostTestNaa() {
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    Logger.log('Kontrollerer Varslinger-test: testmottaker='+
      (PropertiesService.getScriptProperties().getProperty('KOL_TEST_EMAIL')||
       Session.getEffectiveUser().getEmail()||'(ukjent)'));
    kolProcessMailTests_(PropertiesService.getScriptProperties(),kolReadMailTemplates_());
    // Publish the formatting engine version even when only a manual test was run.
    try { kolEmailHeartbeat_(Date.now(),'ok'); }
    catch(error){Logger.log('Versjonsstatus kan ikke publiseres: '+error.message)}
    Logger.log('Testkontroll ferdig. Hvis ingen test ble sendt: kontroller Firebase Rules, mottakerkonto, testbegrensning og siste request.id.');
  } finally { lock.releaseLock(); }
}

/** Stop just this email poller; does not affect any SMS project. */
function stoppEpostVarsler() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kontrollerEpostBestillinger')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('E-postovervåking stoppet.');
}
