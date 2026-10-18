'use strict';

/**
 * Token-free public health status for KØL Grill & Pizza's SMS operations.
 * Serves only boolean status and a poll timestamp, never customer data or SMS credentials.
 * The Google Apps Script doGet() deployment URL lives in the Vercel environment as
 * KOL_SMS_HEALTH_URL, not in public browser JS.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const safeDown = () => res.status(200).json({
    smsEnabled: false,
    gatewayOnline: false,
    lastGatewayCheckAt: null,
    liveConfigured: null,
    pollHealthy: false,
    statusReachable: false,
    lastSuccessfulPollAt: null,
  });

  const address = String(process.env.KOL_SMS_HEALTH_URL || '').trim();
  // This route is intentionally not a general-purpose HTTP proxy.
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(address)) {
    return safeDown();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(address, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!response.ok) return safeDown();
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) return safeDown();
    const date = Date.parse(String(result.lastGatewayCheckAt || ''));
    const age = Date.now() - date;
    const recentlyPolled = Number.isFinite(age) && age >= 0 && age < 90000;
    // The one-minute Google trigger may run late. This is a successful
    // Firebase polling heartbeat, NOT proof that an SMS was delivered.
    const pollHealthy = Number.isFinite(age) && age >= 0 && age < 180000;
    const liveConfigured = result.smsEnabled === true;
    // Keep previous response fields for backward compatibility.
    return res.status(200).json({
      smsEnabled: liveConfigured && recentlyPolled,
      gatewayOnline: result.gatewayOnline === true && recentlyPolled,
      lastGatewayCheckAt: recentlyPolled ? new Date(date).toISOString() : null,
      liveConfigured,
      pollHealthy,
      statusReachable: true,
      lastSuccessfulPollAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
    });
  } catch (_) {
    // Avoid leaking Google error pages, Script URLs or credentials.
    return safeDown();
  } finally {
    clearTimeout(timeout);
  }
};
