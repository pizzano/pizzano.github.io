/* BETA static asset builder. No dependencies. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// BEGIN PURE BUILD
const pages={
 'index.html':['index/style.css','shared/bonus.js','index/sepet.js','index/smart-customer.js','index/app.js','index/profil.js'],
 'admin.html':['admin/admin.css','admin/admin.js'],
 'orders.html':['admin/orders.css','shared/bonus.js','admin/local-sales.js','admin/orders.js']
};
const sources=[...new Set(Object.values(pages).flat())];
const inputs=[...sources,...Object.keys(pages),'sw.js'];
function assert(ok,msg){if(!ok)throw Error(msg)}
function notice(s){return /@license|copyright|spdx|lucide|\(isc\)|^!/i.test(s.trim())}
function stripComments(s){
 return s.replace(/^[ \t]*\/\*((?:(?!\*\/)[\s\S])*)\*\/[ \t]*(?=\r?$)/gm,(m,b)=>notice(b)?m:'');
}
function compactJS(s){
 // Keep multiline literal sources intact rather than risk changing their values.
 if(s.includes(String.fromCharCode(96))||/\\\r?\n/.test(s))return s;
 return stripComments(s).split(/\r?\n/).map(l=>/^[ \t]*\/\//.test(l)&&!l.includes('*/')&&!notice(l)?'':l.replace(/^[ \t]+|[ \t]+$/g,'')).join('\n').replace(/\n{2,}/g,'\n').trim()+'\n';
}
function compactCSS(s){
 // CSS escapes may consume following whitespace. Keep these sources intact.
 if(s.includes('\\'))return s;
 s=stripComments(s);
 let out='',pending=false,quote='',paren=0,bracket=0,brace=0;
 function flush(next){
  if(!pending)return;
  const prev=out.at(-1)||'';
  if(prev&&!'{;}'.includes(prev)&&next!=='{')out+=' ';
  pending=false;
 }
 for(let i=0;i<s.length;i++){
  const c=s[i],n=s[i+1];
  if(quote){out+=c;if(c===quote)quote='';continue}
  if(c==='/'&&n==='*'){const end=s.indexOf('*/',i+2);assert(end>=0,'Unclosed CSS comment');flush(c);out+=s.slice(i,end+2);i=end+1;continue}
  if(c==="'"||c==='"'){flush(c);quote=c;out+=c;continue}
  if(/[ \t\r\n\f]/.test(c)){if(paren||bracket)out+=c;else pending=true;continue}
  flush(c);
  if(c==='(')paren++;else if(c===')')paren--;
  else if(c==='[')bracket++;else if(c===']')bracket--;
  else if(!paren&&!bracket&&c==='{')brace++;
  else if(!paren&&!bracket&&c==='}')brace--;
  assert(paren>=0&&bracket>=0&&brace>=0,'Unbalanced CSS');
  out+=c;
 }
 assert(!quote&&!paren&&!bracket&&!brace,'Unclosed CSS token');
 return out.trim()+'\n';
}
function compactHTML(s){
 // Keep meaningful text whitespace and indentation; only remove blank lines.
 if(/<pre\b/i.test(s)||[...s.matchAll(/<(textarea|script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)].some(m=>m[2].includes('\n')))return s;
 return s.replace(/^[ \t]+$/gm,'').replace(/\n{2,}/g,'\n').replace(/[ \t]+$/gm,'');
}
function minPath(p){return p.replace(/\.(js|css)$/,'.min.$1')}
function hash(s){
 let h=0xcbf29ce484222325n;
 for(let i=0;i<s.length;i++){h^=BigInt(s.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n)}
 return h.toString(16).padStart(16,'0');
}
function bytes(s){let n=0;for(const ch of s){const c=ch.codePointAt(0);n+=c<=127?1:c<=2047?2:c<=65535?3:4}return n}
function one(s,rx,fn){
 let count=0;
 const result=s.replace(rx,(...args)=>{count++;return typeof fn==='function'?fn(...args):fn});
 assert(count===1,'Expected one match for '+rx+', got '+count);
 return result;
}
function buildFiles(input){
 const output={},urls={};
 for(const p of sources){
  const raw=input[p];assert(typeof raw==='string','Missing '+p);
  const data=p.endsWith('.js')?compactJS(raw):compactCSS(raw);
  if(p.endsWith('.js')){new Function(raw);new Function(data)}
  const min=minPath(p);
  output[min]='/* Generated: edit '+p+'; rebuild assets. */\n'+data;
  urls[p]=min+'?v='+hash(output[min]);
 }
 for(const [page,paths] of Object.entries(pages)){
  let html=compactHTML(input[page]);
  for(const p of paths){
   const dot=p.lastIndexOf('.'),base=p.slice(0,dot),ext=p.slice(dot+1);
   assert(/^[a-zA-Z0-9/_-]+$/.test(base),'Unexpected asset path');
   const rx=new RegExp('((?:src|href)=")\\.\\/'+base+'(?:\\.min)?\\.'+ext+'(?:\\?v=[^"]*)?"','g');
   html=one(html,rx,(_,prefix)=>prefix+'./'+urls[p]+'"');
  }
  output[page]=html;
 }
 const list=['index.html',...pages['index.html'].map(p=>urls[p])];
 let sw=input['sw.js'];
 sw=one(sw,/const CACHE_NAME='[^']*';/g,"const CACHE_NAME='fatih1-static-opt-"+hash(output['index.html']+list.join('\n')+'|coherent-shell-v2')+"';");
 sw=one(sw,/const STATIC_URLS=\[[\s\S]*?\]\.map\(path=>new URL\(path,ROOT\)\.href\);/g,"const STATIC_URLS=[\n"+list.map(p=>"  '"+p+"',").join('\n')+"\n].map(path=>new URL(path,ROOT).href);");
 assert(sw.includes("if(!STATIC_URLS.includes(url.href)||url.href===INDEX_URL)return;"),'Expected exact-version service worker asset guard');
 new Function(sw);
 output['sw.js']=sw;
 return {output,urls};
}
// END PURE BUILD

const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check');
const input=Object.fromEntries(inputs.map(p=>[p,readFileSync(resolve(root,p),'utf8')]));
const {output}=buildFiles(input);
const stale=[];
for(const [p,data] of Object.entries(output)){
 const file=resolve(root,p);
 if(!existsSync(file)||readFileSync(file,'utf8')!==data){
  stale.push(p);
  if(!check)writeFileSync(file,data,'utf8');
 }
}
if(check&&stale.length){console.error('Generated assets are stale:',stale.join(', '));process.exitCode=1}
else{
 console.log(check?'Generated assets and cache versions are current.':'Updated '+stale.length+' file(s).');
 for(const p of sources)console.log(p+': '+bytes(input[p])+' -> '+bytes(output[minPath(p)])+' bytes');
}
