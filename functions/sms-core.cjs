'use strict';

// Pure functions are deliberately independent of Firebase and Traccar.
const NO_SMS_STATES = new Set(['avvist', 'fullfort']);

function notificationKind(before, after) {
  if (!before || !after || before.id && after.id && before.id !== after.id) return null;
  const previous = String(before.status || '');
  const current = String(after.status || '');
  if (previous === 'mottatt' && current === 'bekreftet') return 'accepted';
  if (['bekreftet', 'tilberedning'].includes(previous) && current === 'klar') return 'ready';
  return null;
}

function norwegianMobile(value) {
  let digits = String(value || '').replace(/[\s()+.-]/g, '');
  if (digits.startsWith('0047')) digits = digits.slice(4);
  else if (digits.startsWith('47') && digits.length === 10) digits = digits.slice(2);
  if (!/^[49]\d{7}$/.test(digits)) return null;
  return '+47' + digits;
}

function pickupDate(order) {
  const milliseconds = Number(order.scheduledPickupAt) || Number(order.estimatedReadyAt) || 0;
  return Number.isFinite(milliseconds) && milliseconds > 0 ? new Date(milliseconds) : null;
}

function pickupLabel(order) {
  const date = pickupDate(order);
  if (date) {
    const f = new Intl.DateTimeFormat('nb-NO', {
      timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    return f.format(date);
  }
  if (order.pickupMode === 'scheduled' && /^\d{1,2}:\d{2}$/.test(String(order.pickup || ''))) {
    return String(order.pickup);
  }
  return '';
}

function smsText(order, kind) {
  const name = String(order.customerName || '').trim().split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu, '').slice(0, 22);
  const greeting = name ? 'Hei ' + name + '! ' : '';
  const code = String(order.id || '').slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const identifier = code ? ' #' + code : '';
  if (kind === 'accepted') {
    const pickup = pickupLabel(order);
    return 'KØL Grill & Pizza: ' + greeting + 'Bestilling' + identifier
      + ' er bekreftet. ' + (pickup ? 'Hentetid: ' + pickup + '. ' : 'Hentetid kommer snart. ')
      + 'Øgardsvegen 44, Skarnes.';
  }
  if (kind === 'ready') {
    return 'KØL Grill & Pizza: ' + greeting + 'Bestilling' + identifier
      + ' er klar for henting! Øgardsvegen 44, Skarnes.';
  }
  throw new Error('Unknown SMS kind');
}


/**
 * Guard against promoting old uncollected orders when a newly deployed
 * scheduler scans historical orders. Only very recent due orders qualify.
 */
function shouldAutoReady(order, now) {
  if (!order || !['bekreftet', 'tilberedning'].includes(order.status)) return false;
  const readyAt = Number(order.estimatedReadyAt) || 0;
  const createdAt = Number(order.createdAt) || 0;
  if (!Number.isFinite(now) || !readyAt || !createdAt) return false;
  const maxOrderAge = 24 * 60 * 60 * 1000;
  const maxOverdue = 60 * 60 * 1000;
  return readyAt <= now && readyAt > now - maxOverdue
    && createdAt > now - maxOrderAge && createdAt <= now;
}

function validGatewayResponse(httpStatus, payload) {
  return httpStatus >= 200 && httpStatus < 300
    && payload && typeof payload === 'object'
    && Number(payload.successCount) >= 1 && Number(payload.failureCount || 0) === 0;
}

module.exports = {
  notificationKind, norwegianMobile, pickupDate, pickupLabel, smsText,
  validGatewayResponse, shouldAutoReady, NO_SMS_STATES,
};
