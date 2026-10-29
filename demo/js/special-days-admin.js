import {store,mutate,subscribe,ready} from './data.js?v=20261028-fullslots1';
import {SPECIAL_DAYS,parseSpecialDays,dateForDay,osloToday} from './special-days.js';
const panel=document.getElementById('specialDayAdmin');
if(panel){
  const title=document.createElement('h2');title.textContent='🎉 Spesielle dager';
  const hint=document.createElement('p');hint.textContent='Automatiske datoer. Hver aktiv merkedag kan slås av. Ved kollisjon velges et tilfeldig tema ved hver sideoppdatering.';
  const master=document.createElement('label');master.className='holiday-row';
  const masterText=document.createElement('strong');masterText.textContent='Vis spesielle dager på kundesiden';
  const masterCheckbox=document.createElement('input');masterCheckbox.type='checkbox';
  master.append(masterText,masterCheckbox);
  const animationRow=document.createElement('div');animationRow.className='holiday-row';
  const animationLabel=document.createElement('span');animationLabel.textContent='Animasjoner';
  const animation=document.createElement('select');
  for(const [value,label] of [['off','Ingen'],['light','Lett'],['medium','Synlig']]){const op=document.createElement('option');op.value=value;op.textContent=label;animation.append(op)}
  animationRow.append(animationLabel,animation);
  const list=document.createElement('div');list.className='holiday-list';
  const preview=document.createElement('div');
  preview.className='special-day-preview';
  preview.hidden=true;
  const previewHeading=document.createElement('div');
  previewHeading.className='special-day-preview-head';
  const previewLabel=document.createElement('strong');previewLabel.textContent='Forhåndsvisning – bare i admin';
  const closePreview=document.createElement('button');closePreview.type='button';closePreview.textContent='Lukk ×';
  closePreview.addEventListener('click',()=>{preview.hidden=true});
  previewHeading.append(previewLabel,closePreview);
  const previewBanner=document.createElement('section');
  previewBanner.id='specialDayGreeting';
  preview.append(previewHeading,previewBanner);
  panel.append(title,hint,master,animationRow,preview,list);
  function showPreview(day,message,color){
    previewBanner.replaceChildren();
    const mode=animation.value;
    previewBanner.className='effect-'+mode;
    previewBanner.style.setProperty('--holiday-color',color.value);
    previewBanner.style.setProperty('--holiday-border',color.value);
    previewBanner.style.setProperty('--holiday-soft','#f4eff9');
    const icon=document.createElement('span');icon.className='special-day-icon';icon.textContent=day.emoji;
    const copy=document.createElement('div');copy.className='special-day-copy';
    const strong=document.createElement('strong');strong.textContent=message.value.trim()||day.message;
    const subtitle=document.createElement('span');subtitle.textContent='Vi ønsker deg en fin dag!';
    copy.append(strong,subtitle);
    const decoration=document.createElement('span');decoration.className='special-day-deco';
    decoration.setAttribute('aria-hidden','true');
    decoration.textContent=day.effect==='bat'?'🦇':day.effect==='snow'?'❄️':day.effect==='heart'?'💕':day.emoji;
    previewBanner.append(icon,copy,decoration);
    preview.hidden=false;
    preview.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  const config=()=>parseSpecialDays(store.settings?.specialDaysConfig);
  function save(patch){
    const next=config();patch(next);
    mutate(s=>{s.settings.specialDaysConfig=JSON.stringify(next)});
  }
  masterCheckbox.addEventListener('change',()=>save(c=>{c.enabled=masterCheckbox.checked}));
  animation.addEventListener('change',()=>save(c=>{c.animation=animation.value}));
  const controls=[];
  for(const day of SPECIAL_DAYS){
    const row=document.createElement('div');row.className='holiday-row';
    const left=document.createElement('div');
    const label=document.createElement('label');
    const check=document.createElement('input');check.type='checkbox';
    const name=document.createElement('span');name.textContent=day.emoji+' '+day.name;
    label.append(check,name);
    const date=document.createElement('small');date.className='holiday-date';
    left.append(label,date);
    const message=document.createElement('input');message.type='text';message.maxLength=90;message.placeholder='Hilsen...';message.title='Hilsen til kundene';
    const color=document.createElement('input');color.type='color';color.title='Temafarge';color.value=day.accent;
    const controlsBox=document.createElement('div');controlsBox.style.display='flex';controlsBox.style.alignItems='center';controlsBox.style.gap='7px';
    const show=document.createElement('button');show.type='button';show.className='holiday-preview-btn';show.textContent='Forhåndsvis';show.title='Forhåndsvis temaet uten å vise det til kunder';
    show.addEventListener('click',()=>showPreview(day,message,color));
    controlsBox.append(color,message,show);
    row.append(left,controlsBox);list.append(row);
    color.addEventListener('change',()=>save(c=>{c.days[day.id]={...(c.days[day.id]||{}),accent:color.value}}));
    check.addEventListener('change',()=>save(c=>{c.days[day.id]={...(c.days[day.id]||{}),enabled:check.checked}}));
    message.addEventListener('change',()=>save(c=>{c.days[day.id]={...(c.days[day.id]||{}),message:message.value.trim()||day.message}}));
    controls.push({day,check,date,message,color});
  }
  let updating=false;
  function update(){
    if(updating)return;updating=true;
    const c=config();masterCheckbox.checked=c.enabled;animation.value=c.animation;
    const year=osloToday().year;
    for(const {day,check,date,message,color} of controls){
      const v=c.days[day.id]||{},d=dateForDay(day,year);
      if(document.activeElement!==check)check.checked=v.enabled!==false;
      if(document.activeElement!==message)message.value=v.message||day.message;
      if(document.activeElement!==color)color.value=/^#[0-9a-f]{6}$/i.test(v.accent||'')?v.accent:day.accent;
      date.textContent=String(d.day).padStart(2,'0')+'.'+String(d.month).padStart(2,'0')+'.'+year;
    }
    updating=false;
  }
  subscribe(update);ready.then(update).catch(()=>{});update();
}
