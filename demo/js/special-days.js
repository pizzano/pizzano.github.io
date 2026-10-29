// Norwegian special days. Dates are calculated locally in Europe/Oslo; no network requests.
export const SPECIAL_DAYS=[
{id:'newyear',name:'Nyttårsdag',emoji:'🎆',month:1,day:1,accent:'#315b9c',message:'Godt nytt år!',effect:'sparkle'},
{id:'sami',name:'Samefolkets dag',emoji:'🌈',month:2,day:6,accent:'#386c98',message:'Lihkku beivviin!',effect:'sparkle'},
{id:'mother',name:'Morsdag',emoji:'💐',rule:'mother',accent:'#c45e87',message:'Gratulerer med morsdagen!',effect:'petal'},
{id:'valentine',name:'Valentinsdag',emoji:'❤️',month:2,day:14,accent:'#ca3975',message:'God valentinsdag!',effect:'heart'},
{id:'fastelavn',name:'Fastelavn',emoji:'🌸',rule:'fastelavn',accent:'#a05db6',message:'God fastelavn!',effect:'petal'},
{id:'easter',name:'Påskedag',emoji:'🐣',rule:'easter',accent:'#b58922',message:'God påske!',effect:'sparkle'},
{id:'mayday',name:'Arbeidernes dag',emoji:'🌷',month:5,day:1,accent:'#bc4145',message:'God 1. mai!',effect:'petal'},
{id:'ascension',name:'Kristi himmelfartsdag',emoji:'🌿',rule:'ascension',accent:'#39816c',message:'Ha en fin fridag!',effect:'sparkle'},
{id:'constitution',name:'17. mai',emoji:'🇳🇴',month:5,day:17,accent:'#b92b43',message:'Gratulerer med dagen!',effect:'flag'},
{id:'pentecost',name:'Første pinsedag',emoji:'☀️',rule:'pentecost',accent:'#be8426',message:'God pinse!',effect:'sparkle'},
{id:'sankthans',name:'Sankthansaften',emoji:'☀️',month:6,day:23,accent:'#c47729',message:'God sankthans!',effect:'sparkle'},
{id:'halloween',name:'Halloween',emoji:'🎃',month:10,day:31,accent:'#8840a5',message:'Ha en skremmende fin Halloween!',effect:'bat'},
{id:'father',name:'Farsdag',emoji:'👨',rule:'father',accent:'#436eac',message:'Gratulerer med farsdagen!',effect:'sparkle'},
{id:'blackfriday',name:'Black Friday',emoji:'🛍️',rule:'blackfriday',accent:'#52545c',message:'God fredag!',effect:'sparkle'},
{id:'advent',name:'Første søndag i advent',emoji:'🕯️',rule:'advent',accent:'#8153a3',message:'God advent!',effect:'snow'},
{id:'lucia',name:'Luciadagen',emoji:'🕯️',month:12,day:13,accent:'#a07b3b',message:'God luciadag!',effect:'sparkle'},
{id:'christmasEve',name:'Julaften',emoji:'🎄',month:12,day:24,accent:'#aa3037',message:'God jul!',effect:'snow'},
{id:'christmas',name:'Første juledag',emoji:'🎁',month:12,day:25,accent:'#aa3037',message:'God jul!',effect:'snow'},
{id:'boxing',name:'Andre juledag',emoji:'🎄',month:12,day:26,accent:'#aa3037',message:'Fortsatt god jul!',effect:'snow'},
{id:'newyearEve',name:'Nyttårsaften',emoji:'🎇',month:12,day:31,accent:'#315b9c',message:'Godt nytt år!',effect:'sparkle'}
];
function nthSunday(year,month,n){const first=new Date(Date.UTC(year,month-1,1)).getUTCDay();return 1+(7-first)%7+(n-1)*7}
function easter(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);return new Date(Date.UTC(year,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1))}
export function dateForDay(day,year){if(day.month)return {year,month:day.month,day:day.day};let date;if(day.rule==='mother')date=new Date(Date.UTC(year,1,nthSunday(year,2,2)));else if(day.rule==='father')date=new Date(Date.UTC(year,10,nthSunday(year,11,2)));else if(day.rule==='blackfriday'){const fourthThursday=1+(4-new Date(Date.UTC(year,10,1)).getUTCDay()+7)%7+21;date=new Date(Date.UTC(year,10,fourthThursday+1))}else if(day.rule==='advent'){date=new Date(Date.UTC(year,10,27));date.setUTCDate(27+(7-date.getUTCDay())%7)}else{date=easter(year);const offset={fastelavn:-49,easter:0,ascension:39,pentecost:49}[day.rule]||0;date.setUTCDate(date.getUTCDate()+offset)}return {year,month:date.getUTCMonth()+1,day:date.getUTCDate()}}
export function osloToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=k=>Number(parts.find(x=>x.type===k)?.value);return {year:get('year'),month:get('month'),day:get('day')}}
export function parseSpecialDays(raw){try{const value=JSON.parse(raw||'{}');return {enabled:value.enabled!==false,animation:['off','light','medium'].includes(value.animation)?value.animation:'light',days:value.days&&typeof value.days==='object'?value.days:{}}}catch{return {enabled:true,animation:'light',days:{}}}}
export function todaysSpecialDays(raw,now=new Date()){const config=parseSpecialDays(raw);if(!config.enabled)return [];const today=osloToday(now);return SPECIAL_DAYS.filter(d=>{if(config.days[d.id]?.enabled===false)return false;const date=dateForDay(d,today.year);return date.day===today.day&&date.month===today.month}).map(d=>({...d,...config.days[d.id]}))}
