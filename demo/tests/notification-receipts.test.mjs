import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const load = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('SMS: completed send repairs only Firebase receipt, without gateway call', () => {
  const code = load('../integrations/google-apps-script/Kode.gs');
  const block = code.slice(code.indexOf('const prior = props.getProperty(eventKey);'), code.indexOf("if (kind !== 'accepted') continue;"));
  assert.match(block, /completed\.state === 'sent'/);
  assert.match(block, /kolSmsReceipt_\(/);
  assert.match(block, /continue;/);
  assert.doesNotMatch(block, /kolApiSend_\(/);
});
test('Email: completed send receipt reconciliation does not call MailApp', () => {
  const code = load('../integrations/google-apps-script/email-poller.gs');
  const block = code.slice(code.indexOf('for (const completedKey in checkpoint.sent)'), code.indexOf('const kind = kolNotificationKind_', code.indexOf('for (const completedKey in checkpoint.sent)')));
  assert.match(block, /checkpoint\.sent\[completedKey\] !== 'sent'/);
  assert.match(block, /kolEmailReceipt_\(/);
  assert.doesNotMatch(block, /kolSendMail_|MailApp\.sendEmail/);
});
test('Epson uncertainty warns employee to check paper before manual reprint', () => {
  const code = load('../js/admin.js');
  assert.match(code, /Sjekk om Epson allerede skrev ut før du velger/);
  assert.match(code, /printingOrderIds\.has\(orderId\)/);
});

test('SMS scans only changes since last successful poll with bounded overlap', () => {
  const code = load('../integrations/google-apps-script/Kode.gs');
  assert.match(code, /KOL_SMS_SCAN_OVERLAP_MS = 5 \* 60 \* 1000/);
  assert.match(code, /successfulAt - KOL_SMS_SCAN_OVERLAP_MS/);
  assert.match(code, /if \(kolSmsIndexedQueryOk_ && !scanHasMore\)/);
  assert.match(code, /if \(sent >= KOL_SMS.maxPerRun \|\| todayCount >= KOL_SMS.maxPerDay\)/);
  assert.match(code, /kolSmsRespondToManualHealth_\(kolProps_\(\), healthMode, scanStatus\)/);
  assert.match(code, /everyMinutes\(1\)/, 'independent Apps Script trigger must keep running');
});
test('Email and SMS load large templates only when sending, not every idle minute', () => {
  const sms = load('../integrations/google-apps-script/Kode.gs');
  const email = load('../integrations/google-apps-script/email-poller.gs');
  const smsPoll = sms.slice(sms.indexOf('function pollOrdersForSms()'), sms.indexOf('function setupTestSms()'));
  assert.match(smsPoll, /const templateForSend = \(\) =>/);
  assert.match(smsPoll, /kolMessage_\(order, kind, item.id, templateForSend\(\)\)/);
  const emailPoll = email.slice(email.indexOf('function kontrollerEpostBestillinger()'),
    email.indexOf('function kontrollerEpostTestNaa()'));
  assert.match(emailPoll, /const templatesForSend = \(\) =>/);
  assert.match(emailPoll, /kolProcessMailTests_\(props,templatesForSend\)/);
  assert.match(emailPoll, /kind,templatesForSend\(\)/);
  assert.match(emailPoll, /kolEmailRespondToManualHealth_\('ok'\)/);
});

test('sender health writes require a fresh nonduplicate request from admin', () => {
  const sms=load('../integrations/google-apps-script/Kode.gs');
  const email=load('../integrations/google-apps-script/email-poller.gs');
  const smsFn=sms.slice(sms.indexOf('function kolSmsRespondToManualHealth_('),
    sms.indexOf('function kolSmsReceipt_('));
  const emailFn=email.slice(email.indexOf('function kolEmailRespondToManualHealth_('),
    email.indexOf('function forhåndsvisEpostEksempel('));
  assert.match(smsFn,/requestId === props\.getProperty\(KOL_SMS_LAST_HEALTH_REQUEST_KEY\)/);
  assert.match(emailFn,/requestId === props\.getProperty\(KOL_EMAIL_LAST_HEALTH_REQUEST_KEY\)/);
  assert.match(smsFn,/age > 5 \* 60 \* 1000/);
  assert.match(emailFn,/age > 5 \* 60 \* 1000/);
  assert.match(smsFn,/kolSmsHeartbeat_\(mode, Date\.now\(\), status, requestId\)/);
  assert.match(emailFn,/kolEmailHeartbeat_\(Date\.now\(\),state,requestId\)/);
  const smsPoll=sms.slice(sms.indexOf('function pollOrdersForSms()'),sms.indexOf('function setupTestSms()'));
  const emailPoll=email.slice(email.indexOf('function kontrollerEpostBestillinger()'),email.indexOf('function kontrollerEpostTestNaa()'));
  assert.doesNotMatch(smsPoll,/kolSmsHeartbeat_\(mode,/);
  assert.doesNotMatch(emailPoll,/kolEmailHeartbeat_\(now,/);
  assert.match(sms,/everyMinutes\(1\)/);
  assert.match(email,/everyMinutes\(1\)/);
});

test('on-demand GAS health responder is idempotent and rejects stale requests', () => {
  const now=1800000000000;
  for (const source of ['Kode.gs','email-poller.gs']) {
    const code=load('../integrations/google-apps-script/'+source);
    const isSms=source==='Kode.gs';
    const start=code.indexOf(isSms
      ? 'function kolSmsRespondToManualHealth_(' : 'function kolEmailRespondToManualHealth_(');
    const end=code.indexOf(isSms
      ? 'function kolSmsReceipt_(' : '/** Preview without sending customer email.',start);
    assert.ok(start>0 && end>start,'manual health function missing '+source);
    let request={id:'hc_abcdefghi_1234567',requestedAt:now-5000};
    const states=new Map(),writes=[];
    const props={
      getProperty:key=>states.get(key)||null,
      setProperty:(key,value)=>states.set(key,value)
    };
    const sandbox={
      Date:class extends Date {static now(){return now;}},
      KOL_HEALTH_REQUEST_PATH:'notifications/healthCheckRequest',
      KOL_SMS_LAST_HEALTH_REQUEST_KEY:'SMS_LAST_HEALTH',
      KOL_EMAIL_LAST_HEALTH_REQUEST_KEY:'EMAIL_LAST_HEALTH',
      KOL_SMS:{databaseUrl:'https://example.invalid'},
      KOL_DB:'https://example.invalid',
      UrlFetchApp:{fetch:(url,opts)=>{
        assert.match(url,/notifications\/healthCheckRequest\.json$/);
        assert.equal(opts.method,'get');
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(request)};
      }},
      PropertiesService:{getScriptProperties:()=>props},
      kolSmsHeartbeat_:(...args)=>writes.push(args),
      kolEmailHeartbeat_:(...args)=>writes.push(args),
    };
    runInNewContext(code.slice(start,end),sandbox,{timeout:1000});
    const poll=()=>isSms
      ?sandbox.kolSmsRespondToManualHealth_(props,'LIVE','ok')
      :sandbox.kolEmailRespondToManualHealth_('ok');
    poll();
    assert.equal(writes.length,1,'fresh request answered exactly once');
    assert.equal(writes[0].at(-1),request.id,'response must include request ID');
    poll();
    assert.equal(writes.length,1,'duplicate poll must not write again');
    request={...request,id:'hc_abcdefghi_1234568',requestedAt:now-400000};
    poll();
    assert.equal(writes.length,1,'expired request ignored');
    request={id:'bad',requestedAt:now};
    poll();
    assert.equal(writes.length,1,'malformed request ignored');
    request=null;
    poll();
    assert.equal(writes.length,1,'idle minute never writes a heartbeat');
  }
});

test('SMS/email webhook handlers validate only an ID, fetch one stored order and deduplicate', () => {
  const data=load('../js/data.js'),config=load('../config.js');
  const sms=load('../integrations/google-apps-script/Kode.gs');
  const email=load('../integrations/google-apps-script/email-poller.gs');
  assert.match(data,/notifyOrderSenders\(order\.id,'accepted'\)/);
  assert.match(data,/notifyOrderSenders\(orderId,'ready'\)/);
  assert.match(data,/mode:'no-cors',keepalive:true/);
  assert.match(data,/body:JSON\.stringify\(\{orderId,kind\}\)/);
  assert.match(config,/smsWebhookUrl:\s*''/);
  assert.match(config,/emailWebhookUrl:\s*''/);
  for(const script of [sms,email]) {
    const handler=script.slice(script.lastIndexOf('function doPost(e)'));
    assert.match(handler,/\/orders\/.*encodeURIComponent\(id\)/);
    assert.match(handler,/getResponseCode\(\)!==200/);
    assert.match(handler,/already_processed/);
    assert.match(handler,/LockService\.getScriptLock\(\)/);
    assert.doesNotMatch(handler,/kolFetchRecentOrders_\(|kolReadOrders_\(/);
  }
  assert.match(sms,/function stoppSmsMinuttSjekk\(\)/);
  assert.match(email,/function stoppEpostMinuttSjekk\(\)/);
  assert.match(sms,/kolFirebaseSmsPut_\('orders\/'\+id\+'\/smsReceipts\/accepted'/);
  assert.match(email,/kolEmailPutJson_\('orders\/'\+encodeURIComponent\(id\)\+'\/emailReceipts\/'\+kind/);
});

