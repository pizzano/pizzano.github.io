/* Full HTML e-mail editor shared by the two admin template tabs.
 * Browser preview is sandboxed and independently sanitized. The Google Apps
 * Script sender applies its own strict HTML allowlist before MailApp.
 */
const ALLOWED_TAGS=new Set('table tbody thead tfoot tr td th div span p br b strong i em u s strike del a h1 h2 h3 h4 ul ol li hr center small'.split(' '));
const ALLOWED_STYLES=new Set('background background-color color padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left border border-top border-right border-bottom border-left border-radius border-collapse font-size font-family font-weight font-style text-align text-decoration line-height letter-spacing max-width min-width width height vertical-align white-space display'.split(' '));
const ALLOWED_ATTRS=new Set('style align valign width height colspan rowspan border cellpadding cellspacing role bgcolor href target title'.split(' '));
const textEscape=(value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const SAMPLE={
  navn:'Kunde',navnFullt:'Eksempel Kunde',kode:'ABC123',telefon:'+47 40000000',
  hentetid:'01:45',hovedtid:'01:45',hovedetikett:'Hentetid:',
  hentetype:'Snarest',tidsinfo:'Ca. 15 minutter',total:'588 kr',
  delsum:'588,00 kr',mva:'76,70 kr',bestilt:'24.10.2026, 01:30',
  lenke:'https://example.org/bestilling',
  adresse:'Eksempelveien 1, 0001 Oslo'
};
const SAMPLE_LINES=[
  {antall:'2',produkt:'Stor Classico',linjepris:'588 kr',valg:'Størrelse: Stor'}
];

/** Restaurant-neutral default receipt, fully editable in the admin editor.
 * Restaurant identity comes from settings, never from a hard-coded brand.
 */
const KOL_ACCEPTED_STANDARD_HTML="<!doctype html>\n<html lang=\"no\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Bestillingen er bekreftet – KØL Grill &amp; Pizza</title>\n<style>\n@media only screen and (max-width:600px){\n  .outer-pad{padding:12px 7px!important}\n  .main-pad{padding-left:17px!important;padding-right:17px!important}\n  .hero-title{font-size:25px!important;line-height:31px!important}\n  .pickup-time{font-size:40px!important;line-height:45px!important}\n  .item-name{font-size:13px!important}\n  .item-option{font-size:11px!important}\n  .price-cell{font-size:13px!important}\n  .pickup-cell{padding:13px 6px!important}\n}\n</style>\n</head>\n<body style=\"margin:0;padding:0;background:#f3f4ef;font-family:Arial,Helvetica,sans-serif;color:#172b22;-webkit-text-size-adjust:100%;\">\n\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;border-collapse:collapse;background:#f3f4ef;\">\n<tr>\n<td align=\"center\" class=\"outer-pad\" style=\"padding:28px 12px;\">\n\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;max-width:560px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #dfe6dd;border-radius:17px;overflow:hidden;\">\n\n<tr>\n<td align=\"center\" style=\"padding:23px 18px 21px;background:#fffefa;\">\n  <div style=\"font-size:34px;line-height:36px;font-weight:900;letter-spacing:3px;color:#173a2a;\">KØL</div>\n  <div style=\"padding-top:4px;font-size:11px;line-height:16px;font-weight:800;letter-spacing:4px;color:#173a2a;\">GRILL &amp; PIZZA</div>\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:13px auto 0;\">\n    <tr>\n      <td bgcolor=\"#d48143\" width=\"45\" height=\"3\" style=\"height:3px;font-size:0;line-height:3px;background:#d48143;\">&nbsp;</td>\n    </tr>\n  </table>\n</td>\n</tr>\n\n<tr>\n<td align=\"center\" class=\"main-pad\" style=\"background:#18382b;padding:24px 28px 26px;\">\n  <div style=\"font-size:11px;line-height:18px;letter-spacing:2px;font-weight:800;color:#dac9a8;\">ORDREBEKREFTELSE &nbsp;·&nbsp; #{kode}</div>\n  <div class=\"hero-title\" style=\"padding-top:9px;font-size:29px;line-height:36px;font-weight:800;color:#ffffff;\">Bestillingen er bekreftet!</div>\n  <div style=\"padding-top:9px;font-size:14px;line-height:22px;color:#e1e9e3;\">Hei {navn}! Takk for bestillingen.<br>Vi gir beskjed når maten er klar.</div>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:18px 24px 7px;background:#ffffff;\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;border-collapse:separate;border-spacing:0;background:#edf5ee;border:1px solid #d7e9dc;border-radius:12px;\">\n    <tr>\n      <td align=\"center\" style=\"padding:15px 12px 3px;font-size:11px;letter-spacing:1.4px;font-weight:800;text-transform:uppercase;color:#526e5b;\">{hovedetikett}</td>\n    </tr>\n    <tr>\n      <td align=\"center\" class=\"pickup-time\" style=\"padding:0 12px 12px;font-size:44px;line-height:49px;font-weight:800;color:#153f2b;\">{hovedtid}</td>\n    </tr>\n  </table>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:5px 24px 7px;background:#ffffff;\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;border-collapse:separate;border-spacing:0;background:#f7f8f5;border:1px solid #eaeeea;border-radius:10px;\">\n    <tr>\n      <td class=\"pickup-cell\" width=\"50%\" align=\"center\" valign=\"middle\" style=\"padding:13px 10px;border-right:1px solid #e2e9e1;\">\n        <div style=\"font-size:10px;line-height:15px;letter-spacing:1px;font-weight:800;color:#728276;\">HENTING</div>\n        <div style=\"padding-top:4px;font-size:14px;line-height:20px;font-weight:700;color:#1d422e;\">{hentetype}</div>\n      </td>\n      <td class=\"pickup-cell\" width=\"50%\" align=\"center\" valign=\"middle\" style=\"padding:13px 10px;\">\n        <div style=\"font-size:10px;line-height:15px;letter-spacing:1px;font-weight:800;color:#728276;\">TIDSINFO</div>\n        <div style=\"padding-top:4px;font-size:14px;line-height:20px;font-weight:700;color:#1d422e;\">{tidsinfo}</div>\n      </td>\n    </tr>\n  </table>\n</td>\n</tr>\n\n<tr>\n<td align=\"center\" class=\"main-pad\" style=\"padding:17px 24px 14px;background:#ffffff;\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\">\n    <tr>\n      <td bgcolor=\"#256044\" style=\"background:#256044;border-radius:9px;text-align:center;\">\n        <a href=\"{lenke}\" style=\"display:inline-block;padding:14px 25px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;\">Se bestillingen &nbsp;&#8594;</a>\n      </td>\n    </tr>\n  </table>\n  <div style=\"padding-top:10px;font-size:11px;line-height:16px;color:#728076;\">Følg bestillingen din via knappen over.</div>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:15px 24px 4px;background:#ffffff;border-top:1px solid #edf0eb;\">\n  <div style=\"font-size:17px;line-height:23px;font-weight:800;color:#18382b;\">Dette har du bestilt</div>\n  <div style=\"padding-top:2px;font-size:12px;line-height:17px;color:#77857b;\">En oversikt over varene og tilvalgene dine</div>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:8px 24px 11px;background:#ffffff;\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;table-layout:fixed;border-collapse:collapse;\">\n    <tr bgcolor=\"#f2f4f0\" style=\"background:#f2f4f0;\">\n      <th width=\"47\" align=\"center\" style=\"padding:10px 4px;border-bottom:1px solid #dfe8df;font-size:11px;font-weight:700;color:#596e61;\">Ant.</th>\n      <th align=\"left\" style=\"padding:10px 6px;border-bottom:1px solid #dfe8df;font-size:11px;font-weight:700;color:#596e61;\">Vare / tilvalg</th>\n      <th width=\"83\" align=\"right\" style=\"padding:10px 7px;border-bottom:1px solid #dfe8df;font-size:11px;font-weight:700;color:#596e61;\">Pris</th>\n    </tr>\n\n    {{#each items}}\n    <tr>\n      <td align=\"center\" valign=\"top\" style=\"padding:13px 4px;font-size:13px;font-weight:800;color:#173a2a;border-bottom:1px solid #edf1eb;\">{antall}x</td>\n      <td valign=\"top\" style=\"padding:13px 6px;border-bottom:1px solid #edf1eb;word-break:break-word;\">\n        <div class=\"item-name\" style=\"font-size:14px;line-height:20px;font-weight:700;color:#182c21;\">{produkt}</div>\n        <div class=\"item-option\" style=\"padding-top:4px;font-size:12px;line-height:18px;color:#687a6e;\">{valg}</div>\n      </td>\n      <td align=\"right\" valign=\"top\" class=\"price-cell\" style=\"padding:13px 7px;font-size:14px;line-height:19px;font-weight:700;color:#182c21;border-bottom:1px solid #edf1eb;white-space:nowrap;\">{linjepris}</td>\n    </tr>\n    {{/each}}\n\n    <tr>\n      <td colspan=\"2\" style=\"padding:12px 6px 5px;font-size:12px;color:#637368;\">Delsum</td>\n      <td align=\"right\" style=\"padding:12px 7px 5px;font-size:12px;color:#637368;white-space:nowrap;\">{delsum}</td>\n    </tr>\n    <tr>\n      <td colspan=\"2\" style=\"padding:3px 6px 12px;font-size:12px;color:#637368;\">Herav MVA (15 %)</td>\n      <td align=\"right\" style=\"padding:3px 7px 12px;font-size:12px;color:#637368;white-space:nowrap;\">{mva}</td>\n    </tr>\n    <tr bgcolor=\"#18382b\" style=\"background:#18382b;\">\n      <td colspan=\"2\" style=\"padding:14px 11px;color:#ffffff;font-size:17px;font-weight:800;\">Totalt</td>\n      <td align=\"right\" style=\"padding:14px 10px;color:#ffffff;font-size:19px;font-weight:800;white-space:nowrap;\">{total}</td>\n    </tr>\n  </table>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:10px 24px 6px;background:#ffffff;\">\n  <div style=\"font-size:16px;line-height:22px;font-weight:800;color:#18382b;\">Bestillingsdetaljer</div>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:0 24px 18px;background:#ffffff;\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;border-collapse:collapse;\">\n    {{#each details}}\n    <tr>\n      <td valign=\"top\" style=\"padding:8px 5px;border-bottom:1px solid #edf1eb;font-size:12px;line-height:19px;color:#718176;\">{etikett}</td>\n      <td align=\"right\" valign=\"top\" style=\"padding:8px 5px;border-bottom:1px solid #edf1eb;font-size:12px;line-height:19px;font-weight:700;color:#20362a;word-break:break-word;\">{verdi}</td>\n    </tr>\n    {{/each}}\n  </table>\n</td>\n</tr>\n\n<tr>\n<td class=\"main-pad\" style=\"padding:18px 24px 14px;background:#f6f7f3;border-top:1px solid #e2e9e1;\">\n  <div style=\"font-size:10px;line-height:15px;font-weight:800;letter-spacing:1.4px;color:#486957;\">HENTES HOS</div>\n  <div style=\"padding-top:5px;font-size:14px;line-height:19px;font-weight:800;color:#173a2a;\">KØL Grill &amp; Pizza</div>\n  <div style=\"padding-top:4px;font-size:13px;line-height:20px;color:#65766b;\">{adresse}</div>\n  <div style=\"padding-top:7px;font-size:12px;line-height:18px;\">\n    <a href=\"mailto:skarnes.restaurant@gmail.com\" style=\"color:#2a694b;text-decoration:underline;\">skarnes.restaurant@gmail.com</a>\n  </div>\n</td>\n</tr>\n\n<tr>\n<td align=\"center\" style=\"padding:12px 18px 15px;background:#f6f7f3;border-top:1px solid #e5ebe4;font-size:11px;line-height:18px;color:#849087;\">Takk for at du bestiller hos KØL Grill &amp; Pizza!</td>\n</tr>\n\n</table>\n</td>\n</tr>\n</table>\n\n</body>\n</html>";

export function defaultOrderEmailHtml(kind='emailAccepted',existing={},branding={}) {
  if(kind==='emailAccepted')return KOL_ACCEPTED_STANDARD_HTML;
  const restaurantName=String(branding.name||'').trim()||'Restauranten';
  const safeRestaurantName=textEscape(restaurantName);
  const ready=kind==='emailReady';
  const heading=String(existing.headline||(
    ready?'DIN BESTILLING ER KLAR TIL HENTING':'BESTILLINGEN DIN ER BEKREFTET'));
  const msg=String(existing.body||(
    ready?'Hei <strong>{navn}</strong>! Maten din er klar for henting. Velkommen!'
      :'Hei <strong>{navn}</strong>! Vi har bekreftet bestillingen din og forbereder maten.'));
  const footer=String(existing.footer||('Takk for at du bestiller hos '+restaurantName+'!'));
  const headline=ready?'{hovedetikett}':'{hovedetikett}';
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:620px;border-collapse:collapse;background:#fffefa;">\n'
    +'<tr><td align="center" style="padding:30px 15px 24px;background:#10291c;color:#fff8e8;border-bottom:4px solid #bda36b;">\n'
    +'<div style="font-size:28px;line-height:1.25;font-weight:800;letter-spacing:.4px;color:#fff9ec;">'+safeRestaurantName+'</div>\n'
    +'<div style="padding-top:8px;font-size:12px;line-height:20px;letter-spacing:2px;color:#dac89e;">BESTILLING · HENTING</div>\n'
    +'</td></tr>\n'
    +'<tr><td style="padding:16px 15px 8px;background:#fffefa;">\n'
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e7;border-radius:16px;">\n'
    +'<tr><td align="center" style="padding:20px 10px 8px;color:#20442b;font-size:12px;font-weight:800;letter-spacing:1px;">'
    +heading+'</td></tr>\n'
    +'<tr><td align="center" style="padding:0 6px 23px;color:#10291c;">\n'
    +'<div style="font-size:20px;font-weight:800;">'+headline+'</div>\n'
    +'<div style="font-size:52px;line-height:1.15;font-weight:900;">{hovedtid}</div>\n'
    +'</td></tr></table></td></tr>\n'
    +'<tr><td style="padding:0 15px 13px;background:#fffefa;">\n'
    +'<table role="presentation" width="100%" style="background:#f6f6f0;border-radius:13px;">'
    +'<tr><td width="48%" align="center" style="padding:15px 7px;color:#123c27;font-size:15px;font-weight:bold;">{hentetype}</td>'
    +'<td width="52%" align="center" style="padding:15px 7px;border-left:1px solid #e3e6dd;color:#193b27;font-size:14px;font-weight:bold;">{tidsinfo}</td></tr>'
    +'</table></td></tr>\n'
    +'<tr><td style="padding:8px 26px 18px;font-size:14px;line-height:22px;color:#546358;">'
    +msg.replace(/\r?\n/g,'<br>')+'</td></tr>\n'
    +'<tr><td style="padding:0 15px 14px;">\n'
    +'<table role="presentation" width="100%" style="border:1px solid #e2e7dd;border-radius:13px;background:#fff;">\n'
    +'<tr><td colspan="2" style="padding:16px 13px 5px;font-size:17px;font-weight:bold;color:#153321;">Bestillingsdetaljer</td></tr>\n'
    +'{{#each details}}\n'
    +'<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#68736c;font-size:13px;">{etikett}</td>'
    +'<td align="right" style="padding:10px 12px;border-bottom:1px solid #e5e8e1;color:#15291d;font-size:13px;font-weight:bold;">{verdi}</td></tr>\n'
    +'{{/each}}\n'
    +'<tr><td colspan="2" style="padding:12px;font-size:12px;color:#65736a;">Henting: {adresse}</td></tr>'
    +'</table></td></tr>\n'
    +'<tr><td style="padding:0 15px 14px;">\n'
    +'<table role="presentation" width="100%" style="border:1px solid #e2e7dd;border-radius:13px;background:#fff;">\n'
    +'<tr><td colspan="2" style="padding:16px 13px 7px;font-size:17px;font-weight:bold;color:#153321;">Bestilte varer</td></tr>\n'
    +'{{#each items}}\n'
    +'<tr><td style="padding:14px 12px;border-bottom:1px solid #e5e8e1;vertical-align:top;">'
    +'<strong>{antall} × {produkt}</strong><div style="font-size:12px;color:#738077;">{valg}</div></td>'
    +'<td align="right" style="padding:14px 12px;border-bottom:1px solid #e5e8e1;font-weight:bold;">{linjepris}</td></tr>\n'
    +'{{/each}}\n'
    +'<tr><td style="padding:12px;">Delsum</td><td align="right" style="padding:12px;">{delsum}</td></tr>'
    +'<tr><td style="padding:0 12px 15px;">Herav MVA (15 %)</td><td align="right" style="padding:0 12px 15px;">{mva}</td></tr>'
    +'<tr><td style="padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;">Totalt</td>'
    +'<td align="right" style="padding:17px 12px;background:#123c2b;color:#fff;font-size:23px;font-weight:800;">{total}</td></tr>'
    +'</table></td></tr>\n'
    +'<tr><td style="padding:0 25px 15px;color:#455c4b;font-size:13px;">'
    +footer.replace(/\r?\n/g,'<br>')+'</td></tr>\n'
    +'<tr><td align="center" style="padding:17px 15px 26px;color:#68756b;font-size:12px;">'
    +safeRestaurantName+'<br><a href="{lenke}" style="color:#286844;">Se bestillingen</a>'
    +'</td></tr></table>';
}

function safeStyle(raw){');
  // For the built-in compact design, insert before the order details.
  const details=/<tr><td style="padding:0 15px 14px;">\s*<table role="presentation" width="100%" style="border:1px solid #e2e7dd/;
  if(details.test(html))return html.replace(details,block+'\nfunction safeStyle(raw){');
  // No recognized insertion point: never risk damaging a user-edited template.
  return html;
}

function safeStyle(raw){
  return String(raw||'').split(';').map(part=>{
    const at=part.indexOf(':');if(at<1)return '';
    const prop=part.slice(0,at).trim().toLowerCase();
    const val=part.slice(at+1).trim();
    if(!ALLOWED_STYLES.has(prop)||!val||val.length>170||
       !/^[a-z0-9 .,#()%+-]+$/i.test(val) ||
       /url\s*\(|expression\s*\(|@import|javascript|behavior|position\s*:/i.test(val))return '';
    return prop+':'+val;
  }).filter(Boolean).join(';');
}
/** Browser-side strict preview sanitizer: never insert arbitrary user HTML
 * into the live admin DOM; only render in a sandboxed iframe.
 */
export function sanitizeOrderEmailHtml(source){
  const parsed=new DOMParser().parseFromString(String(source||''),'text/html');
  const doc=document.implementation.createHTMLDocument('Safe email');
  const clean=(parent,destination)=>{
    for(const child of Array.from(parent.childNodes)){
      if(child.nodeType===3){destination.appendChild(doc.createTextNode(child.nodeValue));continue}
      if(child.nodeType!==1)continue;
      const tag=child.tagName.toLowerCase();
      if(!ALLOWED_TAGS.has(tag))continue;
      const element=doc.createElement(tag);
      for(const attr of Array.from(child.attributes)){
        const name=attr.name.toLowerCase(),value=attr.value;
        if(!ALLOWED_ATTRS.has(name))continue;
        if(name==='style'){const style=safeStyle(value);if(style)element.setAttribute('style',style);continue}
        if(name==='href'){
          if(/^https:\/\/[^\s"'<>]{1,400}$/i.test(value)||/^mailto:[^\s"'<>]{1,240}$/i.test(value))element.setAttribute('href',value);
          continue;
        }
        if(name==='target'){if(value==='_blank')element.setAttribute(name,value);continue}
        if(!/^[a-z0-9 _.,%#-]{1,100}$/i.test(value))continue;
        element.setAttribute(name,value);
      }
      destination.appendChild(element);
      if(!['br','hr'].includes(tag))clean(child,element);
    }
  };
  const wrap=doc.createElement('div');
  clean(parsed.body,wrap);
  return wrap.innerHTML;
}
const substitute=(text,vars)=>String(text||'').replace(/\{([a-zA-Z]+)\}/g,(whole,key)=>
  Object.prototype.hasOwnProperty.call(vars,key)?textEscape(vars[key]):whole);
export function renderEmailPreviewHtml(source,variables=SAMPLE,items=SAMPLE_LINES){
  const details=[
    {etikett:'Bestillingskode',verdi:'#'+variables.kode},
    {etikett:'Bestilt',verdi:variables.bestilt},
    {etikett:'Navn',verdi:variables.navnFullt},
    {etikett:'Telefon',verdi:variables.telefon}
  ];
  const escapedRepeats=String(source||'').replace(/\{\{#each (items|details)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match,type,inner)=>{
      const group=type==='items'?items:details;
      return group.slice(0,50).map(row=>substitute(inner,row)).join('');
    });
  const html=substitute(escapedRepeats,variables);
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    +'<body style="margin:0;padding:20px 10px;background:#eef1eb;font-family:Arial,Helvetica,sans-serif">'
    +'<div style="max-width:620px;margin:0 auto">'+sanitizeOrderEmailHtml(html)+'</div></body></html>';
}
