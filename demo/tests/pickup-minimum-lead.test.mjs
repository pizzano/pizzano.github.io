import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../js/data.js',import.meta.url),'utf8');
const start=source.indexOf('export function getPickupSlots() {');
const end=source.indexOf('\n/* ------------------------------------------------------------------ *',start);
const code=source.slice(start,end).replace('export function ','function ');
function slots(nowMinute,remaining,lead=30) {
  const deps={
    store:{settings:{pickupLeadMinutes:lead,timezone:'Europe/Oslo'}},
    DEFAULT_SETTINGS:{pickupLeadMinutes:30},
    getOpenState:()=>({open:true,preOpen:false,minutesToClose:remaining,todayOpensAt:'14:00',todayClosesAt:'22:00'}),
    localClock:()=>({minute:nowMinute}),
    parseTime:value=>{const [h,m]=value.split(':').map(Number);return h*60+m;},
    formatMinutes:minute=>String(Math.floor(minute/60)%24).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')
  };
  return new Function('d','const {'+Object.keys(deps).join(',')+'}=d;'+code+';return getPickupSlots()')(deps).map(slot=>slot.value);
}
test('21:10 with 22:00 closing allows 21:45 pickup with 30-min minimum',()=>{
  assert.deepEqual(slots(21*60+10,50),['21:45']);
});
test('first pickup is rounded to next quarter-hour',()=>{
  assert.equal(slots(18*60+1,239,30)[0],'18:45');
  assert.deepEqual(slots(19*60,180,30).slice(0,3),['19:30','19:45','20:00']);
});
test('60-minute minimum is independent of closing cutoff',()=>{
  assert.equal(slots(19*60+10,170,60)[0],'20:15');
});
