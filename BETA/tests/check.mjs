// Run: node BETA/tests/check.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'css/site.css'), 'utf8');
const script = readFileSync(resolve(root, 'js/app.js'), 'utf8');

assert.match(html, /lang="nb"/, 'Norwegian locale');
assert.match(html, /BETA FORHÅNDSVISNING/, 'Beta warning must be visible');
assert.match(html, /js\/app\.js/, 'Missing beta app import');
assert.match(html, /css\/site\.css/, 'Missing beta stylesheet');
assert.doesNotMatch(html + css + script, /\/demo\/|\/DEMO\//i, 'Beta must not import demo sources');
assert.doesNotMatch(script, /new EventSource\s*\(|onValue\s*\(/, 'Do not add background streams to browsing');
assert.doesNotMatch(script, /method:\s*['"](PUT|POST|PATCH|DELETE)['"]/i, 'Read-only preview must not write to the database');
assert.doesNotMatch(script, /\/orders\.json/, 'Do not query live orders from beta preview');
assert.match(script, /getPrice\s*\(/, 'Missing line-price calculator');
assert.match(script, /validateContact\s*\(/, 'Missing contact validation');
assert.match(script, /pickupTimes\s*\(/, 'Missing pickup time logic');
assert.match(script, /orderPreview\s*\(/, 'Missing isolated preview');
new Function(script);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
for (const match of script.matchAll(/\$\('([^']+)'\)/g)) {
  assert(ids.has(match[1]), 'Missing element #' + match[1]);
}
for (const id of ['menuView','cartView','contactView','pickupView','successView']) {
  assert(ids.has(id), 'Missing view #' + id);
}
console.log('BETA checks passed: independent assets, read-only database, required UI IDs, valid JS.');
