import {store,subscribe,ready} from './data.js?v=20261028-fullslots1';
import {todaysSpecialDays,parseSpecialDays,osloToday} from './special-days.js';
const banner=document.getElementById('specialDayGreeting');
let selectedDay=null,selectionKey='';
function renderSpecialDay(){
  if(!banner)return;
  const raw=store.settings?.specialDaysConfig;
  const available=todaysSpecialDays(raw);
  const today=osloToday();
  const key=[today.year,today.month,today.day,raw||''].join('-');
  if(key!==selectionKey){selectionKey=key;selectedDay=available.length?available[Math.floor(Math.random()*available.length)]:null}
  if(!selectedDay){banner.hidden=true;return}
  const day=selectedDay;
  const cfg=parseSpecialDays(raw);
  banner.hidden=false;
  banner.style.setProperty('--holiday-color',day.accent||'#8840a5');
  banner.style.setProperty('--holiday-soft',day.accent==='#aa3037'?'#fbecef':'#f4eff9');
  banner.style.setProperty('--holiday-border',day.accent||'#d4c5df');
  banner.className='effect-'+cfg.animation;
  banner.replaceChildren();
  const icon=document.createElement('span');icon.className='special-day-icon';icon.textContent=day.emoji;
  const copy=document.createElement('div');copy.className='special-day-copy';
  const title=document.createElement('strong');title.textContent=day.message||day.name;
  const detail=document.createElement('span');detail.textContent='Vi ønsker deg en fin dag!';
  copy.append(title,detail);
  const decoration=document.createElement('span');decoration.className='special-day-deco';decoration.setAttribute('aria-hidden','true');decoration.textContent=day.effect==='bat'?'🦇':day.effect==='snow'?'❄️':day.effect==='heart'?'💕':day.emoji;
  banner.append(icon,copy,decoration);
}
subscribe(renderSpecialDay);
ready.then(renderSpecialDay).catch(()=>{});
renderSpecialDay();
document.addEventListener('visibilitychange',()=>{if(!document.hidden){selectionKey='';renderSpecialDay()}});
