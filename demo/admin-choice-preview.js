(()=>{
'use strict';
const DB='https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
let groups=[];
let quickFilter='all';
const arr=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const style=document.createElement('style');
style.textContent=`
/* === modern admin foundation === */
:root{--admin-soft:#faf8f6;--admin-border:#e8e0da;--admin-orange:#f36a2d;--admin-orange-soft:#fff4ee;--admin-green:#2f9b63;--admin-shadow:0 4px 18px rgba(55,43,35,.06)}
body{background:#f7f5f2!important}
.sidebar{background:#fff!important;border-right:1px solid #eee7e2!important}
.sidebar .brand{padding:2px 5px 10px!important}
.sidebar .nav-btn{min-height:42px!important;margin:3px 0!important;border-radius:10px!important;font-size:12px!important;line-height:1.25!important;transition:background .15s ease,color .15s ease,transform .15s ease}
.sidebar .nav-btn:hover{background:#f8f5f2!important;transform:translateX(1px)}
.sidebar .nav-btn.active{background:#fff0e9!important;color:#c84f22!important;box-shadow:inset 3px 0 0 #f36a2d!important}
.sidebar .nav-note{background:#faf8f6;border:1px solid #eee7e2!important;border-radius:10px;padding:10px!important;margin:14px 0 0!important;line-height:1.45!important}
.topbar{box-shadow:0 1px 0 rgba(62,47,39,.04)!important}
.content{background:transparent!important}
.category-head,.item,.library-card{border-color:var(--admin-border)!important;box-shadow:var(--admin-shadow)!important}
.category-head:hover,.item:hover,.library-card:hover{border-color:#dccfc6!important}
.item-actions .item-more{display:none!important}
#duplicate{display:none!important}

/* quick filters */
.admin-quick-filters{display:flex;gap:5px;align-items:center;margin-left:2px}
.admin-filter-btn{height:38px;border:1px solid #ded6d0;background:#fff;color:#6c625c;border-radius:9px;padding:0 11px;font-size:10.5px;font-weight:700;white-space:nowrap}
.admin-filter-btn:hover{border-color:#efb79f;background:#fff9f6}
.admin-filter-btn.active{border-color:#f0a382;background:#fff0e9;color:#be4d22}
.admin-filter-btn .filter-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:#aaa}
.admin-filter-btn[data-filter="sold"] .filter-dot{background:#d94a4a}.admin-filter-btn[data-filter="hidden"] .filter-dot{background:#85807c}

/* product editor section architecture */
.editor-body{background:#f7f5f2!important}
.editor-card.admin-section-card{border:1px solid var(--admin-border)!important;border-radius:12px!important;background:#fff!important;box-shadow:0 2px 10px rgba(55,43,35,.035)!important;overflow:hidden!important}
.admin-section-card .editor-card-head{height:44px!important;padding:0 11px!important;background:#fcfbfa!important;border-bottom:1px solid #eee8e4!important;position:relative!important}
.admin-section-card .editor-card-head h4{font-size:12px!important;font-weight:800!important;display:flex!important;align-items:center!important;gap:7px!important;color:#332e2a!important}
.admin-section-card .editor-card-head h4:before{content:attr(data-icon);width:23px;height:23px;border-radius:7px;background:#f4f1ef;color:#716862;display:inline-grid;place-items:center;font-size:12px;font-weight:500}
.admin-section-card .editor-card-head small{font-size:8.5px!important;color:#918781!important;text-transform:none!important}
.admin-section-card .editor-card-body{padding:10px!important}
.admin-section-card[data-section="choices"]{border-color:#efc3af!important;background:#fffaf7!important}
.admin-section-card[data-section="choices"] .editor-card-head{background:#fff3ed!important;border-bottom-color:#f2cfbf!important}
.admin-section-card[data-section="choices"] .editor-card-head h4{color:#b94b22!important}
.admin-section-card[data-section="choices"] .editor-card-head h4:before{background:#f36a2d;color:#fff}
.admin-section-card[data-section="availability"] .editor-card-head h4:before{background:#eaf7f0;color:#23754c}
.admin-section-card[data-section="danger"] .editor-card-head h4:before{background:#fff0f0;color:#bd4141}
.admin-section-card[data-section="danger"] .editor-card-body{display:flex;justify-content:flex-end;padding:8px 10px!important}
.admin-section-card[data-section="danger"] .danger-wide{background:#fff!important;border-color:#efcccc!important;color:#c24141!important}

/* section navigator */
.product-section-nav{position:sticky;top:58px;z-index:3;display:flex;gap:5px;overflow-x:auto;padding:7px 3px 8px;margin:-2px 0 7px;background:linear-gradient(#f7f5f2 82%,rgba(247,245,242,0));scrollbar-width:none}
.product-section-nav::-webkit-scrollbar{display:none}
.product-section-nav button{height:29px;border:1px solid #ddd5cf;background:#fff;border-radius:999px;padding:0 9px;font-size:9px;color:#6e655f;white-space:nowrap}
.product-section-nav button:hover{border-color:#efad90;background:#fff7f2;color:#bb4c23}
.product-section-nav button.choices{border-color:#f0b89f;background:#fff1ea;color:#ba4d24;font-weight:700}

/* Choices & addons detailed preview */
.choice-preview-box{margin-top:8px;border-top:1px solid #eee7e2;padding-top:8px}
.choice-preview-rule{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}
.choice-preview-pill{font-size:9px;font-weight:700;padding:3px 7px;border-radius:999px;background:#f3f0ee;color:#6d655f}
.choice-preview-pill.orange{background:#fff0e8;color:#c55629}.choice-preview-pill.green{background:#e9f7ef;color:#277b50}
.choice-preview-list{display:grid;gap:4px}.choice-preview-option{min-height:30px;border:1px solid #eee7e2;border-radius:7px;padding:5px 7px;display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:6px;align-items:center;background:#fcfbfa;font-size:10px}
.choice-preview-mark{width:16px;height:16px;border:1px solid #cfc7c1;border-radius:50%;display:grid;place-items:center;font-size:10px;color:#fff;background:#fff}
.choice-preview-option.default .choice-preview-mark{background:#f36a2d;border-color:#f36a2d}.choice-preview-option.default{border-color:#f0c3b0;background:#fff8f4}
.choice-preview-price{font-weight:700;color:#5e5752;white-space:nowrap}.choice-preview-empty{font-size:9.5px;color:#918983;padding:4px 0}
.attached-group{padding:10px!important;border-color:#ebd8cf!important;background:#fff!important}.attached-group-head{align-items:flex-start!important}.attached-group-actions .quiet{height:30px!important;padding:0 9px!important}.attached-group-actions .remove-mini{margin-top:1px}

/* clearer buttons / inputs */
.primary-line{box-shadow:none!important}.field input,.field textarea,.size-row input,.choice-row input{transition:border-color .15s ease,box-shadow .15s ease}.field input:focus,.field textarea:focus,.size-row input:focus,.choice-row input:focus{outline:none!important;border-color:#eda487!important;box-shadow:0 0 0 3px rgba(243,106,45,.08)!important}
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

function removeLowValueActions(){
 document.querySelectorAll('#duplicate').forEach(e=>e.remove());
 document.querySelectorAll('.item-more').forEach(e=>e.remove());
}
function sectionInfo(title){
 const t=(title||'').trim().toLowerCase();
 if(t.includes('grunninformasjon'))return ['product','Produkt','▤'];
 if(t.includes('størrelser'))return ['sizes','Størrelser & priser','↔'];
 if(t.includes('allergener'))return ['allergens','Allergener','!'];
 if(t.includes('choices')||t.includes('tillegg og valg'))return ['choices','Choices & addons','+'];
 if(t.includes('tilgjengelighet'))return ['availability','Tilgjengelighet','✓'];
 if(t==='mer'||t.includes('handlinger'))return ['danger','Handlinger','⋮'];
 return ['other',title||'Innstillinger','•'];
}
function modernizeEditorCards(){
 const body=document.querySelector('#editorBody');if(!body)return;
 const cards=[...body.querySelectorAll(':scope > .editor-card')];
 cards.forEach(card=>{
   const h=card.querySelector('.editor-card-head h4');if(!h)return;
   const [key,label,icon]=sectionInfo(h.textContent);
   card.classList.add('admin-section-card');card.dataset.section=key;
   h.textContent=label;h.setAttribute('data-icon',icon);
 });
 const isProduct=document.querySelector('#editorEyebrow')?.textContent?.toUpperCase().includes('PRODUKT');
 if(isProduct&&cards.length&&!body.querySelector('.product-section-nav')){
   const nav=document.createElement('div');nav.className='product-section-nav';
   cards.filter(c=>c.dataset.section!=='other').forEach(c=>{
     const b=document.createElement('button');const h=c.querySelector('h4');b.textContent=h?.textContent||'Seksjon';if(c.dataset.section==='choices')b.classList.add('choices');b.onclick=()=>c.scrollIntoView({behavior:'smooth',block:'start'});nav.appendChild(b);
   });
   body.prepend(nav);
 }
}
function ensureQuickFilters(){
 const tools=document.querySelector('.tools');if(!tools||!document.querySelector('#menuSearch'))return;
 if(tools.querySelector('.admin-quick-filters'))return;
 const box=document.createElement('div');box.className='admin-quick-filters';
 box.innerHTML=`<button class="admin-filter-btn active" data-filter="all">Alle</button><button class="admin-filter-btn" data-filter="sold"><span class="filter-dot"></span>Utsolgt</button><button class="admin-filter-btn" data-filter="hidden"><span class="filter-dot"></span>Skjult</button>`;
 tools.appendChild(box);
 box.querySelectorAll('button').forEach(b=>b.onclick=()=>{quickFilter=b.dataset.filter;box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));applyQuickFilter();});
}
function applyQuickFilter(){
 document.querySelectorAll('.category').forEach(cat=>{
   const items=[...cat.querySelectorAll('.item')];let visible=0;
   items.forEach(item=>{
     const sold=[...item.querySelectorAll('.badge')].some(x=>x.textContent.includes('Utsolgt'));
     const hidden=[...item.querySelectorAll('.badge')].some(x=>x.textContent.includes('Skjult'));
     const show=quickFilter==='all'||(quickFilter==='sold'&&sold)||(quickFilter==='hidden'&&hidden);
     item.style.display=show?'':'none';if(show)visible++;
   });
   cat.style.display=(quickFilter==='all'||visible>0)?'':'none';
 });
}
function enhance(){
 removeLowValueActions();
 ensureQuickFilters();
 modernizeEditorCards();
 applyQuickFilter();
 document.querySelectorAll('.attached-group[data-gid]').forEach(card=>{
   if(card.querySelector('.choice-preview-box'))return;
   const g=groups.find(x=>x.id===card.dataset.gid);if(!g)return;
   card.insertAdjacentHTML('beforeend',previewHtml(g));
 });
}
let scheduled=false;
const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',refreshGroups);
setInterval(refreshGroups,5000);
refreshGroups();
enhance();
})();