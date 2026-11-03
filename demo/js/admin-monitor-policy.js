/* Pure scheduling policy for noncritical admin health badges.
 * Live order streams, acceptance, printing and sender workflows are separate.
 * The policy never controls incoming orders or acknowledgements. */
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
