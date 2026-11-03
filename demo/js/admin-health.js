/* Read-only Systemhelse panel. Only probes when the health tab is visible
 * or staff explicitly clicks "Kontroller nå". No order mutation, SMS send,
 * email send, printer receipt or background polling on other pages. */
import { DB_URL, backendInfo } from './data.js?v=20261103-slot-ci1';
import { checkEpsonConnection } from './order-printer.js?v=20261016-cleanall1';
import { smsHealthState, emailHealthState, activeCriticalAlerts } from './admin-health-policy.js';

const $ = id => document.getElementById(id);
const healthTab = document.querySelector('[data-settings-section="health"]');
const refreshButton = $('healthRefresh');
const printerButton = $('healthPrinterProbe');
const criticalBanner = $('criticalSystemBanner');
let running = false;
let lastRun = 0;
let lastAlerts = null;

function visible() {
  return !document.hidden && !document.getElementById('pageSettings')?.hidden &&
    !!healthTab && !healthTab.hidden;
}
function setService(key, state, label, detail) {
  const output = $('health' + key);
  if (!output) return;
  const card = output.closest('[data-health-item]');
  if (card) card.dataset.state = state;
  output.textContent = label;
  const detailNode = $('health' + key + 'Detail');
  if (detailNode) detailNode.textContent = detail;
}
function networkStatus() {
  const online = navigator.onLine !== false;
  setService('Network', online ? 'ok' : 'error',
    online ? 'Nettleseren er på nett' : 'Ingen internettforbindelse',
    'Nettlesersignal – ikke en uavhengig internettmåling');
  return online;
}
function showAlertSnapshot(records) {
  lastAlerts = records && typeof records === 'object' ? records : {};
  const active = activeCriticalAlerts(lastAlerts);
  const count = active.length;
  setService('Alerts',count?'error':'ok',
    count ? count + ' kritiske varsler' : 'Ingen nye kritiske varsler',
    'Uavklarte kritiske feil siste 30 minutter · se Varsler for alle historiske feil');
  if (!criticalBanner) return;
  criticalBanner.hidden = !count;
  if (count) {
    const title = String(active[0][1]?.operation || 'Bestillingssystem');
    $('criticalSystemMessage').textContent =
      'Kritisk: ' + title + ' · ' + count + ' aktiv(e) feil de siste 30 minuttene. Åpne Varsler.';
  }
}
window.addEventListener('kol-alert-snapshot', event => showAlertSnapshot(event.detail?.records));
window.addEventListener('kol-alert-fetch-error', () => {
  setService('Alerts','unknown','Varsler kunne ikke hentes',
    'Kontroller nettverk/Firebase. Tidligere varselinformasjon er ikke bekreftet på nytt');
});
$('criticalSystemOpenAlerts')?.addEventListener('click', () => {
  document.querySelector('[data-nav="settings"]')?.click();
  document.querySelector('[data-settings-section-tab="alerts"]')?.click();
});
function printerLastStatus() {
  const badge = $('ordersPrinterStatus');
  if (badge?.classList.contains('is-active')) {
    setService('Printer','warning','Epson: Tidligere bekreftet',
      'Siste status fra Bestillinger. Trykk «Sjekk Epson» for ny papirfri måling.');
  } else if (badge?.classList.contains('is-offline')) {
    setService('Printer','error','Epson: Tidligere feil',
      'Siste status fra Bestillinger. Lokal nettverkstilkobling må kontrolleres.');
  } else {
    setService('Printer','unknown','Epson: Ikke kontrollert her',
      'Sjekk printeren manuelt uten å skrive ut en kvittering.');
  }
}
async function readOnly(path, shallow = false) {
  if (!DB_URL) throw new Error('Firebase-adresse mangler');
  const suffix = shallow ? '?shallow=true' : '?_=' + Date.now();
  const response = await fetch(DB_URL + '/' + path + '.json' + suffix, {
    method:'GET', cache:'no-store', headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}
function statusTime() {
  return new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit',second:'2-digit',
    timeZone:'Europe/Oslo'}).format(new Date());
}
async function runChecks(force = false) {
  if (!visible() || running) return;
  if (!force && Date.now()-lastRun < 45000) return;
  lastRun = Date.now();
  refreshButton.disabled = true;
  running = true;
  const online = networkStatus();
  printerLastStatus();
  window.dispatchEvent(new Event('kol-health-refresh-request'));
  if (!online || !DB_URL) {
    setService('Firebase','error','Firebase: Ingen kontakt','Lesekontrollen kunne ikke starte');
    setService('Sms','unknown','SMS: Ikke kontrollert','Internett/Firebase mangler');
    setService('Email','unknown','E-post: Ikke kontrollert','Internett/Firebase mangler');
    $('healthLastChecked').textContent = 'Sjekk stoppet: nettverk/Firebase er utilgjengelig.';
    refreshButton.disabled = false;
    running = false;
    return;
  }
  try {
    const results = await Promise.allSettled([
      readOnly('orders',true),
      readOnly('notifications/smsHealth'),
      readOnly('notifications/emailHealth'),
    ]);
    const [firebase,sms,email] = results;
    if (firebase.status === 'fulfilled') {
      setService('Firebase','ok','Firebase: Lesing bekreftet',
        'Ordre-nøkler ble lest uten å laste kundeopplysninger; dette garanterer ikke ny ordreskriving');
    } else {
      setService('Firebase','error','Firebase: Lesing mislyktes',
        'Kunne ikke lese ordrenøkler fra Firebase');
    }
    if (sms.status === 'fulfilled') {
      const result = smsHealthState(sms.value);
      setService('Sms',result.state,result.label,result.detail);
    } else {
      setService('Sms','unknown','SMS: Kontroll utilgjengelig',
        'Kunne ikke lese eksisterende Apps Script-hjerteslag');
    }
    if (email.status === 'fulfilled') {
      const result = emailHealthState(email.value);
      setService('Email',result.state,result.label,result.detail);
    } else {
      setService('Email','unknown','E-post: Kontroll utilgjengelig',
        'Kunne ikke lese eksisterende Apps Script-hjerteslag');
    }
    $('healthLastChecked').textContent = 'Lesekontroller utført kl. ' + statusTime() +
      ' · Ingen ordre eller varsler sendt.';
  } finally {
    running = false;
    refreshButton.disabled = false;
  }
}
refreshButton?.addEventListener('click', () => { void runChecks(true); });
printerButton?.addEventListener('click', async () => {
  if (printerButton.disabled || !visible()) return;
  printerButton.disabled = true;
  setService('Printer','unknown','Epson: Sjekker','Kun ePOS-kontroll uten papir');
  try {
    await checkEpsonConnection(); // No image, no cut, no receipt.
    setService('Printer','ok','Epson: ePOS svarte',
      'Skriveren bekreftet papirfri status kl. '+statusTime()+'. Utskrift er ikke testet.');
  } catch {
    setService('Printer','error','Epson: Ingen kontakt',
      'Sjekk restaurantens Wi-Fi, Epson-sertifikat og skriveradresse.');
  } finally {
    printerButton.disabled = false;
  }
});
function onChange() {
  networkStatus();
  if (visible()) void runChecks();
}
window.addEventListener('kol-admin-page-change',onChange);
window.addEventListener('kol-admin-settings-change',onChange);
window.addEventListener('online',onChange);
window.addEventListener('offline',onChange);
document.addEventListener('visibilitychange',onChange);
window.setInterval(() => {
  if (visible()) void runChecks();
},60000);
networkStatus();
printerLastStatus();
