#!/usr/bin/env node
// Node.js 18+; no dependencies, no writes. Run from repository root:
// node demo/tools/audit-references.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const issues = new Set();
let checked = 0;

const check = (ref, from) => {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean || /^(?:https?:|data:|blob:|mailto:|tel:|sms:|#)/i.test(clean)) return;
  if (!/^(?:\/demo\/|\.{1,2}\/)/.test(clean)) return;
  const base = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  checked += 1;
  if (!exists(base)) issues.add(from + ' → MISSING ' + base);
};

const html = ['demo/index.html','demo/admin.html','demo/tools/PrivatPrinter.html'];
for (const file of html) {
  if (!exists(file)) { issues.add('Missing entry point ' + file); continue; }
  const text = read(file);
  for (const m of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) check(m[1], file);
  const ids = new Set();
  for (const m of text.matchAll(/\bid=["']([^"']+)["']/g)) {
    if (ids.has(m[1])) issues.add(file + ' → duplicated id=' + m[1]);
    ids.add(m[1]);
  }
}
const jsFolder = path.join(root, 'demo/js');
for (const name of fs.readdirSync(jsFolder).filter(x=>x.endsWith('.js'))) {
  const file = 'demo/js/' + name;
  const code = read(file);
  for (const m of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) check(m[1], file);
  for (const m of code.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) check(m[1], file);
}
const sw = 'demo/service-worker.js';
if (exists(sw)) for (const m of read(sw).matchAll(/["'](\/demo\/[^"']+)["']/g)) check(m[1], sw);
const manifest = 'demo/manifest.webmanifest';
if (exists(manifest)) {
  const m = JSON.parse(read(manifest));
  for (const icon of m.icons || []) if (icon.src) check(icon.src.startsWith('/') ? icon.src : './'+icon.src,manifest);
  if (m.start_url) check(m.start_url.startsWith('/') ? m.start_url : './'+m.start_url,manifest);
}
if (issues.size) {
  console.error('FAIL:', [...issues].join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: local demo dependencies resolve. Checked ' + checked + ' references.');
}
