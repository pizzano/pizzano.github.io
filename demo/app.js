/*
 * STABLE BOOTSTRAP — DO NOT CHANGE WITHOUT A NEW, EXPLICIT USER REQUEST.
 * app-core.js is the frozen working customer application.
 * checkout-stability.js contains pickup-time handling (currently in explicit test mode).
 * checkout-3step.js presents checkout as cart → contact → pickup.
 * checkout-guidance.js keeps Send bestilling clickable and explains missing pickup choice.
 * Keep load order exactly as written so the existing Firebase/menu bridge remains compatible.
 */
document.write('<script src="app-core.js?v=20260822-stable"><\/script><script src="checkout-stability.js?v=20260823-test1"><\/script><script src="checkout-3step.js?v=20260823-nav2"><\/script><script src="checkout-guidance.js?v=20260823-choice1"><\/script>');
