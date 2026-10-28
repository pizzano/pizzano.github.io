import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../js/admin.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
test('last-order cutoff defaults to 30 min and cannot be set below 30', () => {
  assert.match(data, /lastOrderBeforeCloseMinutes: 30/);
  assert.match(data, /Math\.max\(Number\(settings\.lastOrderBeforeCloseMinutes\) \|\| 30, 30\)/);
  assert.match(admin, /lastOrderBeforeCloseMinutes: \$\('sLastOrderBeforeClose'\)/);
  assert.match(html, /id="sLastOrderBeforeClose"[^>]*min="30"/);
});
test('ordering stays open until cutoff and closes 30 minutes before closing', () => {
  assert.match(data, /scheduled\.active\?\.minutesToClose \|\| 0\) > settings\.lastOrderBeforeCloseMinutes/);
  assert.match(data, /remaining<=settings\.lastOrderBeforeCloseMinutes/);
  assert.doesNotMatch(data, /remaining<=prep\+10/);
});
test('pickup settings keep only last-order cutoff control', () => {
  assert.doesNotMatch(html, /id="sPrepMinutes"/);
  assert.doesNotMatch(html, /id="sSlotInterval"/);
  assert.match(data, /const interval=15;/);
});
