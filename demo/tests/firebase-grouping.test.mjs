import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGrouping} from '../tools/prepare-firebase-grouping.mjs';

test('group data without deleting active root paths',()=>{
  const input={orders:{o1:{status:'mottatt'}},customers:{x:1},settings:{y:2},
    sections:[{id:'pizza'}],smsHealth:{status:'ok'},notificationTemplates:{smsAccepted:{text:'test'}}};
  const before=structuredClone(input);
  const {patch,report}=prepareGrouping(input);
  assert.deepEqual(input,before);
  assert.equal(patch.menu.sections[0].id,'pizza');
  assert.equal(patch.notifications.smsHealth.status,'ok');
  assert.deepEqual(patch.notifications.templates,input.notificationTemplates);
  assert.equal(report.length,3);
  assert.ok(!('orders' in patch));
  assert.ok(!('customers' in patch));
});
test('conflicts refuse to overwrite a different grouped record',()=>{
  assert.throws(()=>prepareGrouping({menu:{sections:[1]},sections:[2]}),/Conflict/);
});
test('existing equivalent destination is accepted',()=>{
  const {patch}=prepareGrouping({menu:{sections:[1]},sections:[1]});
  assert.deepEqual(patch.menu.sections,[1]);
});
