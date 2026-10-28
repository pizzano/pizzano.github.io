import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const info=readFileSync(new URL('../js/shop-info.js',import.meta.url),'utf8');
const admin=readFileSync(new URL('../js/admin.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
test('restaurant info uses actual weeklyHours rather than obsolete legacy time fields',()=>{
 assert.match(info,/getWeeklyHours\(settings\)/);
 assert.match(info,/RESTAURANT_WEEKDAYS\[index\]/);
 assert.match(info,/hours\.textContent = hoursSummary/);
 assert.match(info,/daysEl\.textContent = weeklySummary/);
 assert.doesNotMatch(info,/settings\.orderOpenTime|settings\.orderCloseTime|settings\.openingDays/);
});
test('restored estimated preparation time remains editable and independent of pickup lead',()=>{
 assert.match(html,/id="sPrepMinutes"/);
 assert.match(html,/id="sPickupLeadMinutes"/);
 assert.match(admin,/prepMinutes: \$\('sPrepMinutes'\)/);
 assert.match(admin,/\['prepMinutes', 'number'\]/);
});
