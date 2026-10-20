// Run: node BETA/tests/check.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'css/site.css'), 'utf8');
const script = readFileSync(resolve(root, 'js/app.js'), 'utf8');

assert.match(html, /lang="nb"/, 'Norwegian locale');
assert.match(html, /BETA · FORHÅNDSVISNING/, 'Beta warning must be visible');
assert.match(html, /js\/app\.js\?v=beta-03/, 'Missing versioned BETA app import');
assert.match(html, /css\/site\.css\?v=beta-03/, 'Missing versioned BETA stylesheet');
assert.doesNotMatch(html + css + script, /\/demo\/|\/DEMO\//i, 'No imported DEMO source allowed');
assert.doesNotMatch(script, /new EventSource\s*\(|onValue\s*\(/, 'No browsing streams');
assert.doesNotMatch(script, /method:\s*['"](PUT|POST|PATCH|DELETE)['"]/i, 'Read-only preview cannot write orders');
assert.doesNotMatch(script, /\/orders\.json/, 'Browsing must not download orders');
assert.doesNotMatch(css, /@import|fonts\.googleapis/, 'No external font request');
assert.match(script, /getPrice\s*\(/, 'Missing price calculator');
assert.match(script, /pickupTimes\s*\(/, 'Missing pickup logic');
assert.match(script, /function saveProfile\(/, 'Missing profile editing');
assert.match(script, /function menuCard\(/, 'Missing product rendering');
assert.doesNotMatch(css.replace('[hidden]{display:none!important}',''), /!important/, 'Do not layer emergency CSS overrides');
new Function(script);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
const idSet = new Set(ids);
for (const match of script.matchAll(/\$\('([^']+)'\)/g)) {
  assert(idSet.has(match[1]), 'Missing element #' + match[1]);
}
for (const name of ['menuView','cartView','contactView','pickupView','profileView','successView']) {
  assert(idSet.has(name), 'Missing step ' + name);
}

const db = {
  updatedAt: 202610201,
  sections: [{
    id:'sec_pizza',title:'Pizza',note:'Fra steinovn',
    items:[{id:'it_margherita',name:'Margherita',
      description:'Tomat og ost', sizes:[
        {id:'sz_stor',label:'Stor',price:175,optionGroupIds:['og_ekstra']}
      ],optionGroupIds:[],defaultSizeIndex:0,allergens:['melk']}]
  }],
  optionGroups:[{id:'og_ekstra',title:'Ekstra ost',selectionMode:'single',
    required:false,options:[{id:'opt_ja',label:'Ekstra ost',price:20}]}],
  allergenCatalog:[{id:'melk',label:'Melk'}],
  settings:{manualClosed:false,orderOpenTime:'10:00',orderCloseTime:'23:00'},
  popularItemIds:['it_margherita']
};
const requested = [];
const storage = new Map();
const nodes = new Map();
function node(id) {
  if (nodes.has(id)) return nodes.get(id);
  const value = {
    id,value:'',textContent:'',innerHTML:'',hidden: true,disabled:false,
    checked:false,style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},setAttribute(){},focus(){},scrollIntoView(){},
    getBoundingClientRect(){return {top:120,bottom:120}},
    querySelectorAll(){return []}
  };
  nodes.set(id,value);
  return value;
}
const document = {
  getElementById:node,querySelectorAll(){return []},addEventListener(){},
  documentElement:{dataset:{}},body:{dataset:{},style:{}}
};
const fetch = async (url,options={}) => {
  assert.equal((options.method || 'GET').toUpperCase(),'GET','No database mutation');
  const pathname = url.split('.firebaseio.com/')[1]?.replace(/\.json$/, '');
  requested.push(pathname);
  return {ok:true,json:async () => structuredClone(db[pathname] ?? null)};
};
const context = {
  document,window:{addEventListener(){},scrollTo(){}},
  navigator:{onLine:true},location:{href:'https://bestill.online/BETA/index.html'},
  localStorage:{
    getItem:key=>storage.get(key) || null,
    setItem:(key,val)=>storage.set(key,val)
  },fetch,console,setInterval(){return 0},setTimeout(){return 0},
  clearTimeout(){},requestAnimationFrame:fn=>fn(),AbortController,Date,Intl
};
const api = runInNewContext(script + '\n({state,refreshCatalog,openProduct,addToCart,total,showView,getPrice,renderMenu})',context);
await api.refreshCatalog();
assert.equal(api.state.catalog.sections.length,1,'Menu loads');
assert(node('menuSections').innerHTML.includes('Margherita'),'Menu card renders');
assert.deepEqual([...requested],[
  'updatedAt','sections','optionGroups','allergenCatalog','settings','popularItemIds'
], 'Cold launch must have one version check and only public menu fields');
requested.length = 0;
await api.refreshCatalog(true);
assert.deepEqual([...requested],['updatedAt'],'Warm visit must fetch only the revision');
api.openProduct('it_margherita');
api.addToCart();
assert.equal(api.total(),175,'Correct base pizza price');
api.showView('cart');
assert(node('cartLines').innerHTML.includes('Margherita'),'Cart renders');
const size = api.state.catalog.sections[0].items[0];
assert.equal(api.getPrice(size,'sz_stor',{og_ekstra:['opt_ja']}),195,'Addon price');

console.log('BETA OK: assets isolated, read-only, no SSE, minimal reads, menu, cart and prices.');
