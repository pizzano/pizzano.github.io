# KØL runtime and test boundaries (26 October 2026)

**Production:** GitHub Pages customer and admin frontend, Firebase Realtime Database, Google Apps Script SMS/e-mail. No Vercel.

**Order flow:** Customer builds cart and submits order with a stable retry ID to Firebase. Admin listens for new orders and attempts `Godta` via Firebase PATCH. Customer watches status. Google Apps Script writes sending receipts; UI reflects actual receipt data. Archive/loyalty helpers process recorded orders.

**Hours and confirmations:** Configured weekly operating days/hours in Firebase `settings` decide availability. Ordering before today's opening is permitted on enabled days, earliest collection 15 minutes after opening, with `confirmationNoTimeout: true`. Orders placed during open hours have a 180-second pending confirmation deadline. Manual close disables new orders.

**Firebase paths:** `settings` (single current settings node), order records, customer records, loyalty state and archive are managed in `data.js` and helper modules. Existing records must remain intact. Never wipe or reset the database during verification.

**Module identity:** Every browser import of `./data.js` must resolve to the same URL including its query string. Otherwise each URL instantiates separate Firebase stream/state logic. The reference audit checks this.

**Safety/limitations:** Existing admin acknowledgement uses one PATCH; receipt fields are preserved, but simultaneous staff clients are not protected by a server-side conditional status transaction. Do not claim this race is solved. Test with emulator/stubs before changing. Offline checks cover syntax, references, and pure timeout rules, not browser delivery, Firebase auth/rules, concurrent actual transactions, SMS or email.

**Editing map:** Checkout: `customer.js`; accepted orders: `admin.js` plus `data.js`; confirmation deadlines: `order-confirmation.js`; restaurant schedule: `data.js`; notifications: Apps Script + receipt renderers; CSS in `demo/css/`; loyalty: `loyalty.js`, `loyalty-sync.js`, `data.js`.

**Checks:** `node demo/tools/audit-references.mjs`; `node --experimental-default-type=module --test demo/tests/*.test.mjs`. CI workflow: `.github/workflows/demo-audit.yml`. Finish with browser, emulator and controlled notification tests before release.

## Diagnostic notifications (audit branch only)
- `demo/js/system-errors.js` is an isolated, best-effort RTDB writer. `data.js` reports confirmed failures on order creation, Godta, settings persistence and timeout cancellation. It never reports successful operations.
- RTDB nodes: `systemErrors/{category_reason}` and manually archived `systemErrorsArchive/{category_reason}`. The deterministic key groups repeats. ETag conditional PUT prevents lost repeat-count updates, with bounded retry. Names/phone/e-mail and arbitrary exception text are not stored.
- Admin `Restaurantinnstillinger → Varsler` polls every 12 seconds while visible, and offers `Lest`, `Løst` and manually triggered archival of resolved records older than 30 days (max 25 per action).
- `intentionalTest` uses separate `test_` keys. Browser mock tests do not send anything to production Firebase.
- **Not fully covered:** Google Apps Script runs independently. SMS/EPOST failures inside those deployed scripts are NOT yet forwarded into `systemErrors`; current health/receipt fields remain authoritative. Separate GAS publishing/permissions must be verified before changing those flows. Browser errors that occur before JS starts or when the network is fully offline cannot be persisted until connectivity returns; this reporter currently does not queue them.
- Access: verify dedicated RTDB read/write rules before enabling in production. These diagnostics endpoints currently use the same REST access mechanism as the frontend; do not rely on client-provided severity or read/resolved state for authorization.

## Critical operation watchdog (audit branch; not in production)
- `monitorCriticalOperation` observes the original order-create and Godta Firebase request without changing its Promise, retrying a write or modifying the three-minute order deadline.
- A request still pending after 12.5 seconds (Godta) or 15 seconds (order creation) is logged as a potential stall. If it subsequently completes, its record is marked `recovered`; manual `resolved` remains separate.
- The diagnostic writer uses ETag-based repeat counters, a 5-minute per-type cooldown, 4-second transport timeouts, and a maximum of 16 locally queued error types. Offline queue is retried on browser reconnect and once shortly after startup; it contains codes/counts/timestamps only.
- The browser is NOT an independent always-on monitor. Closing all admin/customer tabs stops browser watchdogs. Deployed Google Apps Script SMS/e-mail server failures are still not connected to `systemErrors`. No unconditional global JS error handler is installed because it would flood staff with unrelated exceptions.
- Mock tests do not establish browser compatibility, database rules or real end-to-end availability. All code remains on `audit-fixes-20261026` pending testing and review.
