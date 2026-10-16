/**
 * BETA is an isolated mock environment. This file deliberately contains no
 * Firebase URL, authentication, SMS or email endpoints.
 */
export const BETA_CONFIG = Object.freeze({
  mode: 'local-only',
  storagePrefix: 'kol:beta:v1',
  maxMockOrders: 100,
  appName: 'KØL Grill & Pizza — BETA',
});
