/*
 * =============================================================
 * KØL GRILL & PIZZA — CUSTOMER APP — STABLE BASELINE 2026-08-23
 * =============================================================
 *
 * READ THIS BEFORE EDITING — especially if you are another AI agent.
 *
 * STATUS
 * - This customer ordering flow is currently considered WORKING/STABLE.
 * - Do not rewrite it from scratch for cosmetic or architectural reasons.
 * - Prefer the smallest possible local change and verify the full order flow afterwards.
 *
 * FILE RESPONSIBILITIES
 * - index.html ........ DOM/HTML shell + Firebase menu bridge.
 * - kol.css ........... canonical customer styling.
 * - app-core.js ....... frozen main customer application/business logic.
 * - checkout-stability.js ... pickup-time behavior. CURRENTLY TEST MODE.
 * - checkout-3step.js ....... 3-step checkout UX.
 * - checkout-guidance.js .... missing-pickup warning/focus behavior.
 * - app.js ............ ONLY the ordered bootstrap/maintenance map you are reading now.
 *
 * CHECKOUT CONTRACT — DO NOT BREAK
 * 1. Bestilling -> 2. Kontakt -> 3. Hentetid.
 * - No pickup option is preselected.
 * - Completed progress steps are clickable for backwards navigation.
 * - Customer must explicitly choose Snarest mulig OR a pickup time.
 * - If Send bestilling is pressed without a pickup choice, DO NOT submit.
 *   Show guidance and focus/highlight the pickup choice instead.
 * - Every major customer screen must remain vertically scrollable.
 * - Preserve the kol:order-ready event and admin payload shape unless the
 *   admin side is changed at the same time.
 *
 * IMPORTANT TEST FLAG
 * checkout-stability.js currently has PICKUP_TEST_MODE = true so Snarest
 * and all opening-hour slots can be tested regardless of the real clock.
 * Before production launch this must be deliberately reviewed and switched
 * back to real opening-hour restrictions. Do not silently change it during UX work.
 *
 * MAINTENANCE RULES
 * - Do NOT add another checkout patch/override file for normal fixes.
 * - Do NOT duplicate functions/styles simply to override earlier code.
 * - Do NOT rename DOM IDs used by app-core.js without updating all references.
 * - Do NOT change script order below: later checkout layers intentionally refine
 *   the frozen core behavior in a known order.
 * - If a larger refactor is desired, use backup branch:
 *   backup-demo-stable-2026-08-23
 *   and verify cart -> contact -> pickup -> submit before merging.
 *
 * FUTURE CLEANUP NOTE
 * The long-term target may be index.html + app.js + kol.css only, but merging
 * the frozen core and checkout layers should be done as a dedicated refactor
 * with regression testing, not as an incidental cleanup. Stability wins.
 */

document.write(
  '<script src="app-core.js?v=20260822-stable"><\/script>' +
  '<script src="checkout-stability.js?v=20260823-test1"><\/script>' +
  '<script src="checkout-3step.js?v=20260823-nav2"><\/script>' +
  '<script src="checkout-guidance.js?v=20260823-choice1"><\/script>'
);
