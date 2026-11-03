/* Dependency-free stylesheet inventory. Run: node scripts/css-audit.mjs
 * Never deletes rules automatically: runtime classes/media queries may be dynamic.
 */
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssDir = new URL('../css/', import.meta.url);
const names = (await readdir(cssDir)).filter(name => name.endsWith('.css')).sort();
const existing = new Set(names);
const pages = ['index.html', 'admin.html'];
const references = new Map(names.map(name => [name, new Set()]));
let failed = false;

function cssLinks(markup) {
  return [...markup.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](?:\.\/)?css\/([^"'?#]+\.css)(?:\?[^"']*)?["']/gi)]
    .map(match => match[1]);
}
for (const page of pages) {
  const text = await readFile(new URL(page, root), 'utf8');
  const used = cssLinks(text);
  const duplicates = used.filter((name, i) => used.indexOf(name) !== i);
  if (duplicates.length) { console.error(page + ': duplicate stylesheet links: ' + duplicates.join(', ')); failed = true; }
  for (const name of used) {
    if (!existing.has(name)) { console.error(page + ': missing CSS file: ' + name); failed = true; }
    else references.get(name).add(page);
  }
  if (page === 'index.html') {
    const product = used.indexOf('product-detail-redesign.css');
    const stateCards = used.indexOf('order-status-cards.css');
    if (product < 0 || product <= stateCards || used.includes('ui-controls.css')) {
      console.error('Customer product dialog/control layer has wrong cascade order.');
      failed = true;
    } else {
      const joined = await readFile(new URL('product-detail-redesign.css', cssDir), 'utf8');
      if (joined.indexOf('Shared customer control measurements') < 0 ||
          joined.indexOf('PRODUCT DETAIL') < joined.indexOf('Shared customer control measurements')) {
        console.error('Customer controls must precede product dialog styles in one file.');
        failed = true;
      }
    }
  }
  if (page === 'admin.html') {
    for (const name of ['admin-dashboard.css', 'admin-settings.css']) {
      if (!used.includes(name)) { console.error('Required admin module missing: '+name);failed=true; }
    }
    for (const retired of ['admin-choices.css', 'group-editor-modal.css', 'admin-product-modal.css']) {
      if (used.includes(retired)) { console.error('Retired CSS still linked: '+retired);failed=true; }
    }
  }
}

const observed = new Map();
async function crawl(dir, rel='') {
  for (const item of await readdir(dir, { withFileTypes:true })) {
    if (['node_modules','.git','build','dist'].includes(item.name)) continue;
    const child = new URL(item.name+(item.isDirectory()?'/':''),dir);
    if (item.isDirectory()) { await crawl(child,rel+item.name+'/');continue; }
    if (!/\.(?:html|js|mjs|css)$/.test(item.name) || rel.startsWith('tests/') ||
        rel.startsWith('scripts/')) continue;
    const content=await readFile(child,'utf8');
    for (const name of names) {
      if (content.includes('css/'+name)) {
        if (!observed.has(name)) observed.set(name,[]);
        observed.get(name).push(rel+item.name);
      }
    }
  }
}
await crawl(root);
const unused=names.filter(name=>!references.get(name).size && !observed.has(name));
const reports = await Promise.all(names.map(async name=>{
  const css=await readFile(new URL(name,cssDir),'utf8');
  return {name, lines:css.split('\n').length,
    important:(css.match(/!important\b/g)||[]).length,
    pages:[...references.get(name)]};
}));
/* A conservative collision inventory: selectors may legitimately repeat in
 * responsive or theme layers. Report them; never delete automatically. */
const selectorOwners = new Map();
for (const name of names) {
  const css = (await readFile(new URL(name, cssDir), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector=match[1].trim().replace(/\s+/g,' ');
    if (!/^[.#:\[*a-zA-Z]/.test(selector) || selector.startsWith('@')) continue;
    if (!selectorOwners.has(selector)) selectorOwners.set(selector,new Set());
    selectorOwners.get(selector).add(name);
  }
}
const collisions=[...selectorOwners.entries()]
  .filter(([,owners])=>owners.size>1)
  .sort((a,b)=>b[1].size-a[1].size)
  .slice(0,12);
if (collisions.length) {
  console.log('Shared/colliding selector groups (review, not auto-delete):');
  for (const [selector,owners] of collisions)
    console.log('   ' + selector.slice(0,90) + ' => ' + [...owners].join(', '));
}
const linked=names.filter(name=>references.get(name).size);
console.log('CSS audit: '+names.length+' files, '+linked.length+' directly linked, '+
  pages.length+' page entrypoints.');
for(const report of reports) {
  console.log(' - '+report.name+': '+report.lines+' lines, '+
    report.important+' !important, entrypoints: '+(report.pages.join(', ')||'indirect only'));
}
if(unused.length) console.warn('POTENTIALLY UNUSED (not auto-deleted): '+unused.join(', '));
else console.log('No unreferenced CSS found in HTML/JS/CSS source inventory.');
if(failed) process.exitCode=1;
