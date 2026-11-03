/* Keyboard, admin print and Android wrapper contracts. No hardware access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { trapDialogTab, dialogFocusables, focusDialog } from '../js/dialog-focus.js';

const file = name => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('Tab wraps around modal controls in both directions', () => {
  const calls = [];
  const first = {
    closest: () => null, getClientRects: () => [1],
    focus: () => calls.push('first'),
  };
  const last = {
    closest: () => null, getClientRects: () => [1],
    focus: () => calls.push('last'),
  };
  const dialog = {
    hidden: false,
    querySelectorAll: () => [first,last],
    contains: target => target === first || target === last,
  };
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { activeElement: last };
    let prevented = false;
    assert.equal(trapDialogTab({
      key:'Tab',shiftKey:false,preventDefault(){prevented=true;}
    },dialog),true);
    assert.equal(prevented,true);
    assert.equal(calls.at(-1),'first');
    globalThis.document.activeElement=first;
    prevented=false;
    trapDialogTab({key:'Tab',shiftKey:true,preventDefault(){prevented=true;}},dialog);
    assert.equal(prevented,true);
    assert.equal(calls.at(-1),'last');
    assert.equal(dialogFocusables(dialog).length,2);
    focusDialog(dialog);
    assert.equal(calls.at(-1),'first');
  } finally { globalThis.document = previousDocument; }
});

test('hidden dialogs are not given focus or trapped', () => {
  assert.deepEqual(dialogFocusables({hidden:true}),[]);
  assert.equal(trapDialogTab({key:'Tab'}, {hidden:true}),false);
});

test('customer sheet and confirmation panel share dialog focus behavior', async () => {
  const js = await file('js/customer.js');
  const html = await file('index.html');
  assert.match(js, /trapDialogTab\(event, el\.sheet\)/);
  assert.match(js, /trapDialogTab\(event, el\.confirmModal\)/);
  assert.match(html, /id="confirmModal"[^>]*tabindex="-1"/);
});

test('admin acceptance and Epson printing keep duplicate-guard and state feedback', async () => {
  const admin = await file('js/admin.js');
  assert.match(admin, /printingOrderIds\.has\(orderId\)/);
  assert.match(admin, /printerCheckRunning \|\| printingOrderIds\.size/);
  assert.match(admin, /setEpsonPrinterStatus\('pending', reprint/);
  assert.match(admin, /await printKitchenTicket\(order,/);
  assert.match(admin, /never automatically retry an uncertain print/i);
  assert.match(admin, /trapDialogTab\(event, active\)/);
});

test('Epson probe is no-paper; ticket delivery is explicit only', async () => {
  const printer = await file('js/order-printer.js');
  assert.match(printer, /export async function checkEpsonConnection/);
  assert.match(printer, /export async function printKitchenTicket/);
  assert.match(printer, /const timer = window\.setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
});

test('Android admin APK uses its WebView and offers a retry on main-page failure', async () => {
  const java = await file('admin-apk/app/src/main/java/no/siparis/admin/MainActivity.java');
  const manifest = await file('admin-apk/app/src/main/AndroidManifest.xml');
  assert.match(java, /https:\/\/bestill\.online\/demo\/admin\.html/);
  assert.match(java, /onReceivedError\(WebView view, WebResourceRequest request, WebResourceError error\)/);
  assert.match(java, /if \(!request\.isForMainFrame\(\)\) return;/);
  assert.match(java, /retry\.setOnClickListener/);
  assert.match(manifest, /Sipariş Admin Version2/);
});

test('small mobile screens retain visible CTA and predictable scroll', async () => {
  const css = await file('css/product-detail-redesign.css');
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /scroll-padding-bottom: 100px/);
  assert.match(css, /text-overflow: ellipsis/);
});
