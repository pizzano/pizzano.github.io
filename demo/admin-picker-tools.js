(()=>{
'use strict';
const DB='https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const asArray=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);

const style=document.createElement('style');
style.textContent=`
.attach-row{grid-template-columns:minmax(0,1fr) auto!important}
.attach-row-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.attach-row-tools .manage-group{height:40px;padding:0 11px;border:1px solid #d8d1cc;border-radius:10px;background:#fff;color:#5d5651;font-weight:700;font-size:11px}
.attach-row-tools .delete-group-picker{width:40px;height:40px;border:1px solid #f0cccc;border-radius:10px;background:#fff6f6;color:#c74747;font-size:16px;font-weight:800}
.attach-row-tools .attach-existing{height:40px!important;border-radius:10px!important}
.attach-row-tools button:hover{filter:brightness(.985)}
`;
document.head.appendChild(style);

async function currentConfig(){
 const r=await fetch(DB+'/.json',{cache:'no-store'});
 if(!r.ok)throw new Error('HTTP '+r.status);
 return await r.json()||{};
}
async function groupIndex(gid){
 const cfg=await currentConfig();
 const groups=asArray(cfg.optionGroups);
 return groups.findIndex(g=>String(g?.id||'')===String(gid));
}
async function openExistingEditor(gid){
 const idx=await groupIndex(gid);
 if(idx<0)throw new Error('Valggruppen ble ikke funnet');
 document.querySelector('.modal-backdrop')?.remove();
 document.querySelector('#navChoices')?.click();
 await sleep(60);
 const btn=document.querySelector(`[data-edit-group="${idx}"]`);
 if(!btn)throw new Error('Redigeringsknappen ble ikke funnet');
 btn.click();
}
async function deleteExisting(gid,title){
 const cfg=await currentConfig();
 const groups=asArray(cfg.optionGroups);
 const idx=groups.findIndex(g=>String(g?.id||'')===String(gid));
 if(idx<0)throw new Error('Valggruppen ble ikke funnet');
 let used=0;
 asArray(cfg.sections).forEach(s=>asArray(s?.items).forEach(p=>{if(asArray(p?.optionGroupIds).map(String).includes(String(gid)))used++;}));
 const name=title&&title!=='Uten navn'?`«${title}»`:'denne valggruppen';
 const msg=used
   ? `${name} brukes på ${used} produkt${used===1?'':'er'}. Vil du slette gruppen og fjerne den fra alle disse produktene?`
   : `Vil du slette ${name}?`;
 if(!confirm(msg))return;
 document.querySelector('.modal-backdrop')?.remove();
 document.querySelector('#navChoices')?.click();
 await sleep(60);
 const edit=document.querySelector(`[data-edit-group="${idx}"]`);
 if(!edit)throw new Error('Valggruppen kunne ikke åpnes');
 edit.click();
 await sleep(40);
 const del=document.querySelector('#deleteGroup');
 if(!del)throw new Error('Slett-knappen ble ikke funnet');
 del.click();
}
function enhancePicker(modal){
 if(!modal||modal.dataset.manageEnhanced==='1')return;
 modal.dataset.manageEnhanced='1';
 modal.querySelectorAll('.attach-row').forEach(row=>{
   const add=row.querySelector('.attach-existing');
   if(!add)return;
   const gid=add.dataset.gid;
   const title=row.querySelector('strong')?.textContent?.trim()||'Uten navn';
   const tools=document.createElement('div');
   tools.className='attach-row-tools';
   const edit=document.createElement('button');
   edit.type='button';edit.className='manage-group';edit.textContent='Rediger';edit.title='Rediger denne valggruppen';
   const del=document.createElement('button');
   del.type='button';del.className='delete-group-picker';del.textContent='🗑';del.title='Slett valggruppen';del.setAttribute('aria-label','Slett valggruppen');
   add.replaceWith(tools);tools.append(edit,del,add);
   edit.onclick=async()=>{try{await openExistingEditor(gid)}catch(e){alert(e.message)}};
   del.onclick=async()=>{try{await deleteExisting(gid,title)}catch(e){alert(e.message)}};
 });
}
const observer=new MutationObserver(()=>{
 document.querySelectorAll('.modal-backdrop .modal-card').forEach(card=>{
   if(card.querySelector('.attach-existing'))enhancePicker(card);
 });
});
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
