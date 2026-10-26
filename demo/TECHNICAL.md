# KØL runtime and test boundaries (26 October 2026)

**Production:** GitHub Pages customer and admin frontend, Firebase Realtime Database, Google Apps Script SMS/e-mail. No Vercel.

**Order flow:** Customer builds cart and submits order with a stable retry ID to Firebase. Admin listens for new orders and attempts `Godta` via Firebase PATCH. Customer watches status. Google Apps Script writes sending receipts; UI reflects actual receipt data. Archive/loyalty helpers process recorded orders.

**Hours and confirmations:** Configured weekly operating days/hours in Firebase `settings` decide availability. Ordering before today's opening is permitted on enabled days, earliest collection 15 minutes after opening, with `confirmationNoTimeout: true`. Orders placed during open hours have a 180-second pending confirmation deadline. Manual close disables new orders.

**Firebase paths:** `settings` (single current settings node), order records, customer records, loyalty state and archive are managed in `data.js` and helper modules. Existing records must remain intact. Never wipe or reset the database during verification.

**Module identity:** Every browser import of `./data.js` must resolve to the same URL including its query string. Otherwise each URL instantiates separate Firebase stream/state logic. The reference audit checks this.

**Safety/limitations:** Existing admin acknowledgement uses one PATCH; receipt fields are preserved, but simultaneous staff clients are not protected by a server-side conditional status transaction. Do not claim this race is solved. Test with emulator/stubs before changing. Offline checks cover syntax, references, and pure timeout rules, not browser delivery, Firebase auth/rules, concurrent actual transactions, SMS or email.

**Editing map:** Checkout: `customer.js`; accepted orders: `admin.js` plus `data.js`; confirmation deadlines: `order-confirmation.js`; restaurant schedule: `data.js`; notifications: Apps Script + receipt renderers; CSS in `demo/css/`; loyalty: `loyalty.js`, `loyalty-sync.js`, `data.js`.

**Checks:** `node demo/tools/audit-references.mjs`; `node --experimental-default-type=module --test demo/tests/*.test.mjs`. CI workflow: `.github/workflows/demo-audit.yml`. Finish with browser, emulator and controlled notification tests before release.
