# KØL online ordering — contributor safety rules

Scope: `demo/`. Production is GitHub Pages + Firebase Realtime Database; SMS/e-mail via Google Apps Script. **Do not reintroduce Vercel**.

## Safe editing
- Work on an audit/feature branch; never auto-merge into `main`. Preserve `backup-before-audit-20261026`.
- Never read, delete, or alter real customer/order records for testing. Do not trigger real SMS or e-mail.
- Verify every HTML ID, CSS selector, event handler, dynamic template and import before removing code. Old order/loyalty compatibility requires evidence before deletion.
- Keep Firebase `data.js` import URLs identical across all entry points: differing query strings create independent state and listeners.
- Do not use duplicate listeners or cascading CSS overrides as patches. Preserve current responsive layout and themes.
- Preserve three-minute expiry for normal pending orders and `confirmationNoTimeout` for orders placed before opening; never expire accepted orders.
- Preserve customer order IDs on retries, Firebase success-before-success-UI, SMS/EPOST receipt flags, and customer/order/loyalty history.
- Firebase multi-client acknowledgement uses PATCH; it is **not** an atomic compare-and-swap. Do not assume two simultaneous staff confirmations cannot race without an explicit concurrency guard.
- Changes must pass `node demo/tools/audit-references.mjs`, JS syntax checks and `node --experimental-default-type=module --test demo/tests/*.test.mjs` before proposing publication.
- Run browser and Firebase emulator tests before declaring full end-to-end readiness; CI alone is insufficient.

## Primary files
- `demo/index.html`, `demo/js/customer.js`: customer UI, checkout, status.
- `demo/admin.html`, `demo/js/admin.js`: admin UI and order processing.
- `demo/js/data.js`: Firebase reads, writes, streams, settings, menu, orders, loyalty bridge.
- `demo/js/order-confirmation.js`: pure three-minute/exception logic.
- `demo/js/loyalty-sync.js`, `demo/js/orders-archive.js`: admin auxiliary processing.
- `demo/js/shop-info.js`: customer restaurant info.
- `demo/integrations/google-apps-script/`: out-of-browser SMS and e-mail services.
- `demo/service-worker.js`: cached offline assets; do not silently reload active orders.
- `demo/tests/` and `demo/tools/audit-references.mjs`: offline checks.
