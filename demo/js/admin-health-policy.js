/* Side-effect-free service-health classifications.
 * "OK" is never interpreted as end-to-end delivery to a customer. */
export const HEALTH_STALE_MS = 3 * 60 * 1000;
export function isFreshHeartbeat(record, now = Date.now()) {
  const stamp = Number(record?.checkedAt || 0);
  return Number.isFinite(stamp) && stamp > 0 &&
    now - stamp >= -60000 && now - stamp < HEALTH_STALE_MS;
}
export function smsHealthState(record, now = Date.now()) {
  if (!record || record.source !== 'apps-script-sms-poller')
    return { state:'unknown', label:'SMS: Ingen gyldig status', detail:'Ingen fersk Apps Script-kontroll' };
  if (record.liveConfigured !== true)
    return { state:'error', label:'SMS: Automatisering av', detail:'Polleren er ikke i LIVE-modus' };
  if (record.status !== 'ok' || !isFreshHeartbeat(record, now))
    return { state:'error', label:'SMS: Sjekk poller', detail:'Ingen vellykket poll siste 3 minutter' };
  return { state:'warning', label:'SMS: Poller aktiv', detail:'Telefon og faktisk levering ikke bekreftet' };
}
export function emailHealthState(record, now = Date.now()) {
  if (!record || record.source !== 'apps-script-email-poller')
    return { state:'unknown', label:'E-post: Ingen gyldig status', detail:'Ingen fersk Apps Script-kontroll' };
  if (record.status === 'unavailable' || (record.quotaRemaining != null && Number(record.quotaRemaining) <= 0))
    return { state:'error', label:'E-post: Sender ikke tilgjengelig', detail:'Sjekk MailApp og kvote' };
  if (record.status !== 'ok' || !isFreshHeartbeat(record, now) || !(Number(record.quotaRemaining) > 0))
    return { state:'warning', label:'E-post: Poller ikke bekreftet', detail:'Ingen fersk vellykket kontroll' };
  return { state:'warning', label:'E-post: Sender aktiv', detail:'Innbokslevering ikke bekreftet' };
}
export function activeCriticalAlerts(records, now = Date.now(), maxAgeMs = 30 * 60 * 1000) {
  return Object.entries(records && typeof records === 'object' ? records : {})
    .filter(([key, value]) => {
      if (String(key).startsWith('test_') || !value || typeof value !== 'object' || value.intentionalTest ||
          value.resolved || value.status === 'recovered' || value.severity !== 'critical') return false;
      const stamp = Number(value.lastSeen);
      return Number.isFinite(stamp) && stamp > 0 && now >= stamp - 60000 &&
        now - stamp <= maxAgeMs;
    })
    .sort((a,b)=>Number(b[1].lastSeen)-Number(a[1].lastSeen));
}


export const SMS_STATUS_INTERVAL_MS = 45000;
export const ALERTS_BACKGROUND_INTERVAL_MS = 30000;
export const ALERTS_VISIBLE_INTERVAL_MS = 12000;

export function smsStatusShouldPoll({ page, visible, sinceLastCheckMs, force = false } = {}) {
  return visible === true && page === 'orders' &&
    (force || sinceLastCheckMs >= SMS_STATUS_INTERVAL_MS);
}

export function systemAlertsShouldPoll({
  visible, page, settingsSection, sinceLastCheckMs, force = false,
} = {}) {
  if (visible !== true) return false;
  const activeAlerts = page === 'settings' && settingsSection === 'alerts';
  const interval = activeAlerts ? ALERTS_VISIBLE_INTERVAL_MS : ALERTS_BACKGROUND_INTERVAL_MS;
  return force || sinceLastCheckMs >= interval;
}
