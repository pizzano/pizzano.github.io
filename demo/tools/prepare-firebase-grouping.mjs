#!/usr/bin/env node
// Prepare a NON-DESTRUCTIVE Firebase RTDB grouping patch from an offline JSON export.
// No network, authentication, Firebase mutation or deletion. Originals are never removed.
// Usage: node demo/tools/prepare-firebase-grouping.mjs backup.json grouped.patch.json
import fs from 'node:fs';
import { resolve } from 'node:path';

export const GROUPS = Object.freeze({
  menu: Object.freeze(['sections','optionGroups','allergenCatalog','popularItemIds']),
  notifications: Object.freeze(['notificationTemplates','notificationTests','smsHealth','emailHealth']),
});
export function prepareGrouping(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Invalid RTDB root object');
  const patch={};
  const report=[];
  for (const [group,fields] of Object.entries(GROUPS)) {
    const existing=root[group];
    if (existing != null && (typeof existing !== 'object' || Array.isArray(existing)))
      throw new Error('Existing /'+group+' is not a map; refusing to overwrite');
    const grouped={...(existing||{})};
    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(root,field)) continue;
      const dest=group==='notifications' ?
        ({notificationTemplates:'templates',notificationTests:'tests',smsHealth:'smsHealth',emailHealth:'emailHealth'})[field] : field;
      if (Object.prototype.hasOwnProperty.call(grouped,dest)
          && JSON.stringify(grouped[dest]) !== JSON.stringify(root[field]))
        throw new Error('Conflict: /'+field+' differs from /'+group+'/'+dest);
      grouped[dest]=root[field];
      report.push({from:'/'+field,to:'/'+group+'/'+dest});
    }
    if (report.some(x=>x.to.startsWith('/'+group+'/'))) patch[group]=grouped;
  }
  return {patch,report};
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [src,dest]=process.argv.slice(2);
  if (!src || !dest) {console.error('Usage: node prepare-firebase-grouping.mjs backup.json grouped.patch.json');process.exitCode=2;}
  else {
    const root=JSON.parse(fs.readFileSync(src,'utf8'));
    const {patch,report}=prepareGrouping(root);
    fs.writeFileSync(dest,JSON.stringify(patch,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify({mode:'OFFLINE_ONLY',sourceUnchanged:true,rootKeysRetained:true,copies:report},null,2));
  }
}
