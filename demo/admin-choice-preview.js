(()=>{
'use strict';
const DB='https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
let groups=[];
const arr=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const style=document.createElement('style');
style.textContent=`
.choice-preview-box{margin-top:8px;border-top:1px solid #eee7e2;padding-top:8px}
.choice-preview-rule{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}
.choice-preview-pill{font-size:9px;font-weight:700;padding:3px 7px;border-radius:999px;background:#f3f0ee;color:#6d655f}
.choice-preview-pill.orange{background:#fff0e8;color:#c55629}.choice-preview-pill.green{background:#e9f7ef;color:#277b50}
.choice-preview-list{display:grid;gap:4px}.choice-preview-option{min-height:30px;border:1px solid #eee7e2;border-radius:7px;padding:5px 7px;display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:6px;align-items:center;background:#fcfbfa;font-size:10px}
.choice-preview-mark{width:16px;height:16px;border:1px solid #cfc7c1;border-radius:50%;display:grid;place-items:center;font-size:10px;color:#fff;background:#fff}
.choice-preview-option.default .choice-preview-mark{background:#f36a2d;border-color:#f36a2d}.choice-preview-option.default{border-color:#f0c3b0;background:#fff8f4}
.choice-preview-price{font-weight:700;color:#5e5752;white-space:nowrap}.choice-preview-empty{font-size:9.5px;color:#918983;padding:4px 0}
.attached-group{padding:10px!important}.attached-group-head{align-items:flex-start!important}.attached-group-actions .quiet{height:30px!important;padding:0 9px!important}.attached-group-actions .remove-mini{margin-top:1px}
`;
document.head.appendChild(style);

async function refreshGroups(){
 try{const r=await fetch(DB+'/.json',{cache:'no-store'});if(!r.ok)return;const cfg=await r.json()||{};groups=arr(cfg.optionGroups).map(g=>({...g,id:String(g?.id||''),options:arr(g?.options),defaultOptionIds:arr(g?.defaultOptionIds).map(String)}));enhance();}catch{}
}
function modeText(g){return g.selectionMode==='multiple'?`Flere valg · maks ${Math.max(1,Number(g.maxSelections)||1)}`:'Ett valg'}
function previewHtml(g){
 const defaults=new Set(arr(g.defaultOptionIds).map(String));
 const opts=arr(g.options);
 return `<div class="choice-preview-box"><div class="choice-preview-rule"><span class="choice-preview-pill orange">${esc(modeText(g))}</span><span class="choice-preview-pill ${g.required?'orange':'green'}">${g.required?'Obligatorisk':'Valgfritt'}</span>${defaults.size?`<span class="choice-preview-pill">${defaults.size} standardvalg</span>`:''}</div>${opts.length?`<div class="choice-preview-list">${opts.map(o=>{const on=defaults.has(String(o.id||''));const price=Number(o.price)||0;return `<div class="choice-preview-option ${on?'default':''}"><span class="choice-preview-mark">${on?'✓':''}</span><span>${esc(o.label||'Uten navn')}</span><span class="choice-preview-price">${price?`+${price} kr`:'0 kr'}</span></div>`}).join('')}</div>`:'<div class="choice-preview-empty">Ingen alternativer i denne valggruppen.</div>'}</div>`;
}
function enhance(){
 document.querySelectorAll('.attached-group[data-gid]').forEach(card=>{
   if(card.querySelector('.choice-preview-box'))return;
   const g=groups.find(x=>x.id===card.dataset.gid);if(!g)return;
   card.insertAdjacentHTML('beforeend',previewHtml(g));
 });
}
const observer=new MutationObserver(()=>{enhance();});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',refreshGroups);
setInterval(refreshGroups,5000);
refreshGroups();
})();