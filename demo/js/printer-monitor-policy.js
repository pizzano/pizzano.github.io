/* Epson ePOS connection checks are independent from printing.
 * Health probes are no-paper requests; confirmed orders print immediately.
 * A healthy Epson needs fewer checks, an outage gets limited backoff.
 */
export const EPSON_HEALTHY_INTERVAL_MS = 30000;
export const EPSON_INITIAL_INTERVAL_MS = 5000;
export const EPSON_ERROR_INITIAL_INTERVAL_MS = 10000;
export const EPSON_ERROR_MAX_INTERVAL_MS = 60000;

export function epsonProbeInterval(status = 'pending', failures = 0) {
  if (status === 'ok') return EPSON_HEALTHY_INTERVAL_MS;
  if (status !== 'error') return EPSON_INITIAL_INTERVAL_MS;
  const exponent = Math.min(3, Math.max(0, Math.floor(Number(failures) || 1) - 1));
  return Math.min(EPSON_ERROR_MAX_INTERVAL_MS, EPSON_ERROR_INITIAL_INTERVAL_MS * (2 ** exponent));
}

export function shouldProbeEpson({
  page = 'orders', visible = true, busy = false,
  status = 'pending', failures = 0, lastCheckedAt = 0,
  now = Date.now(), force = false,
} = {}) {
  if (!visible || page !== 'orders' || busy) return false;
  if (force) return true;
  if (!Number.isFinite(lastCheckedAt) || lastCheckedAt <= 0) return true;
  return now - lastCheckedAt >= epsonProbeInterval(status, failures);
}
