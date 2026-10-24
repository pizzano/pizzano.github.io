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
  const tags='table tbody thead tfoot tr td th div span p br b strong i em u s strike del a h1 h2 h3 h4 ul ol li hr center small'.split(' ');
  const attributes='style align valign width height colspan rowspan border cellpadding cellspacing role bgcolor href target title'.split(' ');
  const parts=String(source||'').replace(/<!doctype[^>]*>/gi,'').match(/<[^>]*>|[^<]+|</g)||[];
  const stack=[];let result='';
  parts.forEach(function(part){
    if(part[0]!=='<'){result+=part;return}
    const m=/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^<>]*)>$/i.exec(part);
    if(!m||tags.indexOf(m[2].toLowerCase())<0){
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
