/*
 * STABLE BOOTSTRAP — DO NOT CHANGE WITHOUT A NEW, EXPLICIT USER REQUEST.
 * app-core.js is the frozen working customer application.
 * checkout-stability.js contains only the hardened pickup-time correction.
 * Keep load order exactly as written so the existing Firebase/menu bridge remains compatible.
 */
document.write('<script src="app-core.js?v=20260822-stable"><\/script><script src="checkout-stability.js?v=20260822-stable"><\/script>');
