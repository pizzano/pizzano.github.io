import {store,mutate,subscribe,ready} from './data.js?v=20261028-fullslots1';
import {SPECIAL_DAYS,parseSpecialDays,dateForDay,osloToday} from './special-days.js';
const panel=document.getElementById('specialDayAdmin');
if(panel){
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
  preview.className='special-day-preview-modal';
  preview.hidden=true;
  preview.setAttribute('role','dialog');
  preview.setAttribute('aria-modal','true');
  preview.setAttribute('aria-label','Forhåndsvisning av merkedag');
  const previewWindow=document.createElement('div');
  previewWindow.className='special-day-preview-window';
  const previewHeading=document.createElement('div');
  previewHeading.className='special-day-preview-head';
  const previewLabel=document.createElement('strong');previewLabel.textContent='Forhåndsvisning – bare i admin';
  const closePreview=document.createElement('button');closePreview.type='button';closePreview.textContent='Lukk ×';
  const closeDialog=()=>{preview.hidden=true};
  closePreview.addEventListener('click',closeDialog);
  preview.addEventListener('click',event=>{if(event.target===preview)closeDialog()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!preview.hidden)closeDialog()});
  previewHeading.append(previewLabel,closePreview);
  const previewStage=document.createElement('div');
  previewStage.className='special-day-preview-stage';
  const previewDecor=document.createElement('div');previewDecor.className='special-day-preview-decor';
  const previewMessage=document.createElement('strong');previewMessage.className='special-day-preview-message';
  const previewPercent=document.createElement('span');previewPercent.className='special-day-preview-percent';previewPercent.textContent='93 %';
  const previewText=document.createElement('span');previewText.className='special-day-preview-loading';previewText.textContent='Laster siden...';
  previewStage.append(previewDecor,previewMessage,previewText,previewPercent);
  previewWindow.append(previewHeading,previewStage);
  preview.append(previewWindow);
  document.body.append(preview);
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='special-day-toggle';
  toggle.setAttribute('aria-expanded','false');
  const toggleTitle=document.createElement('strong');
  toggleTitle.textContent='🎉 Spesielle dager';
  const chevron=document.createElement('span');
  chevron.textContent='⌄';
  chevron.setAttribute('aria-hidden','true');
  toggle.append(toggleTitle,chevron);
  const body=document.createElement('div');
  body.className='special-day-body';
  body.hidden=true;
  const intro=document.createElement('div');intro.className='holiday-intro';
  const introIcon=document.createElement('span');introIcon.textContent='▦';introIcon.className='holiday-intro-icon';
  const introCopy=document.createElement('div');
  const introTitle=document.createElement('h2');introTitle.textContent='Automatiske datoer';
  introCopy.append(introTitle,hint);intro.append(introIcon,introCopy);
  const settingsBar=document.createElement('div');settingsBar.className='holiday-settings-bar';
  settingsBar.append(master,animationRow);
  const tableScroll=document.createElement('div');tableScroll.className='holiday-table-scroll';
  const columns=document.createElement('div');columns.className='holiday-table-header';
  for(const name of ['AKTIV','IKON','MERKEDAG','DATO','TEMA / FARGE','HILSEN (VIS PÅ KUNDESIDEN)','FORHÅNDSVIS']){
    const cell=document.createElement('span');cell.textContent=name;columns.append(cell);
  }
  tableScroll.append(columns,list);
  body.append(intro,settingsBar,tableScroll);
  panel.append(toggle,body);
  toggle.addEventListener('click',()=>{
    body.hidden=!body.hidden;
    toggle.setAttribute('aria-expanded',String(!body.hidden));
  });
  function showPreview(day,message,color){
    previewStage.style.setProperty('--holiday-color',color.value);
    previewStage.dataset.effect=animation.value;
    previewStage.dataset.holiday=day.id;
    previewDecor.textContent=day.effect==='bat'?'🕸️  🦇  🕷️':day.effect==='snow'?'❄️  ✨  ❄️':day.effect==='heart'?'💕  💗  💕':day.emoji+'  ✨  '+day.emoji;
    previewMessage.textContent=message.value.trim()||day.message;
    preview.hidden=false;
    closePreview.focus();
  }
  const config=()=>parseSpecialDays(store.settings?.specialDaysConfig);
  function save(patch){
    const next=config();patch(next);
    mutate(s=>{s.settings.specialDaysConfig=JSON.stringify(next)});
  }
  masterCheckbox.addEventListener('change',()=>save(c=>{c.enabled=masterCheckbox.checked}));
  animation.addEventListener('change',()=>save(c=>{c.animation=animation.value}));
  const controls=[];
  const seasons=[
    {label:'❄️  Vinter og tidlig vår',ids:['newyear','sami','mother','valentine','fastelavn']},
    {label:'🌿  Vår og sommer',ids:['easter','mayday','ascension','constitution','pentecost','sankthans']},
    {label:'🍂  Høst og vinter',ids:['halloween','father','blackfriday','advent','lucia','christmasEve','christmas','boxing','newyearEve']}
  ];
  for(const season of seasons){
    const heading=document.createElement('div');heading.className='holiday-season-heading';heading.textContent=season.label;list.append(heading);
    for(const id of season.ids){
      const day=SPECIAL_DAYS.find(d=>d.id===id);
      if(!day)continue;
      const row=document.createElement('div');row.className='holiday-row';
      const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',day.name+' aktiv');
      const emoji=document.createElement('span');emoji.className='holiday-emoji';emoji.textContent=day.emoji;
      const name=document.createElement('span');name.className='holiday-name';name.textContent=day.name;
      const date=document.createElement('small');date.className='holiday-date';
      const color=document.createElement('input');color.type='color';color.title='Temafarge for '+day.name;color.value=day.accent;
      const message=document.createElement('input');message.type='text';message.maxLength=90;message.placeholder='Hilsen...';message.title='Hilsen til kundene';
      const show=document.createElement('button');show.type='button';show.className='holiday-preview-btn';show.textContent='◉  Forhåndsvis';
      show.addEventListener('click',()=>showPreview(day,message,color));
      row.append(check,emoji,name,date,color,message,show);
      list.append(row);
      color.addEventListener('change',()=>save(config=>{config.days[day.id]={...(config.days[day.id]||{}),accent:color.value}}));
      check.addEventListener('change',()=>save(config=>{config.days[day.id]={...(config.days[day.id]||{}),enabled:check.checked}}));
      message.addEventListener('change',()=>save(config=>{config.days[day.id]={...(config.days[day.id]||{}),message:message.value.trim()||day.message}}));
      controls.push({day,check,date,message,color});
    }
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
