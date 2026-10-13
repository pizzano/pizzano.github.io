'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { onValueUpdated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const {
  notificationKind, norwegianMobile, smsText, validGatewayResponse,
} = require('./sms-core.cjs');

initializeApp({
  databaseURL: 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app',
});

const gatewayToken = defineSecret('TRACCAR_CLOUD_TOKEN');

async function sendSMS(phone, message, token) {
  const response = await fetch('https://www.traccar.org/sms/', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, message }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => null);
  if (!validGatewayResponse(response.status, data)) {
    // Do not log personal data or secrets from the gateway response.
    throw new Error('Traccar rejected message (HTTP ' + response.status + ')');
  }
}

/**
 * Automatically sends a single SMS on a saved order-status transition.
 * Does not require any browser, PC, or Vercel page to remain open.
 *
 * Fail closed: deployment alone does not activate sending.
 * Set SMS_NOTIFICATIONS_ENABLED=true after verifying database access rules,
 * replacing the publicly shared token, and confirming ice's SMS conditions.
 */
exports.smsOnOrderStatus = onValueUpdated({
  ref: '/orders/{orderId}',
  instance: 'bestill-19-default-rtdb',
  region: 'europe-west1',
  secrets: [gatewayToken],
  maxInstances: 3,
  memory: '256MiB',
  retry: false,
}, async (event) => {
  if (process.env.SMS_NOTIFICATIONS_ENABLED !== 'true') return;

  const before = event.data.before.val();
  const after = event.data.after.val();
  const kind = notificationKind(before, after);
  if (!kind) return;

  const phone = norwegianMobile(after.phone);
  if (!phone) {
    logger.warn('SMS skipped: no valid Norwegian mobile number', { kind });
    return;
  }
  const token = gatewayToken.value();
  if (!token) {
    logger.error('SMS disabled: missing server-side Cloud token');
    return;
  }

  const database = getDatabase();
  const orderId = String(event.params.orderId || '');
  const destination = database.ref('smsNotifications').child(orderId).child(kind);
  const reservation = await destination.transaction((current) => {
    if (current !== null) return; // already claimed: no duplicate notifications
    return { state: 'sending', createdAt: Date.now(), eventId: event.id };
  }, undefined, false);

  if (!reservation.committed) return;

  try {
    // Avoid late events sending texts about orders that have already moved on.
    const latest = (await database.ref('orders').child(orderId).get()).val();
    if (!latest || latest.status !== after.status
        || Number(latest.statusUpdatedAt || 0) !== Number(after.statusUpdatedAt || 0)) {
      await destination.update({ state: 'skipped', reason: 'status_changed', updatedAt: Date.now() });
      return;
    }

    const message = smsText(latest, kind);
    await sendSMS(phone, message, token);
    await destination.update({ state: 'sent', updatedAt: Date.now() });
    logger.info('Traccar accepted SMS notification', { kind, orderId });
  } catch (error) {
    // Leave a durable failure state instead of silently retrying and
    // potentially sending a duplicate after an uncertain network timeout.
    await destination.update({ state: 'failed', updatedAt: Date.now() });
    logger.error('SMS notification failed', { kind, orderId, error: error.message });
  }
});
