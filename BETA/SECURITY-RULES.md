# BETA Firebase Realtime Database security — staged, NOT DEPLOYED

Database: `kol-grill-pizza-1-default-rtdb`. Authentication admin UID is restricted in server-side Rules.

Deploy `BETA/database.rules.json` only after integration and emulator tests. It is not automatically deployed by GitHub Pages.

Behavior:
- Authenticated admin UID gets full read/write via root rules.
- Public GET of /menu, /settings, /publicPickupLoad.
- Anonymous customers can create one /orders/{ord_ID}, with basic field validation, but cannot update/delete existing orders or read orders.
- No anonymous access to /customers, /notifications, /pizzaBonus, /systemErrors or other paths.
- Admin must use Firebase Authentication ID token. BETA admin PR #115 adds this only to /menu operations.
- Note /settings is fully public here: split public/private settings before deployment if any secrets are stored there.
- New checkout and profile flows WILL FAIL under these rules: BETA/sepet.js PATCH /customers/{phone}, bonus reads, and DEMO/customer tracking via /orders/{id} are not permitted. Those need authenticated/backend API redesign first.
- The open create-only /orders rule still permits spam, spoofed totals, and arbitrary order contents. For a production system prefer an API to validate menu prices, order inputs and abuse limits before trusted writes.
- Server-side Google Apps Script or other services must use their own trusted credentials; do not copy admin password/token into public JS.
- Tests required: anonymous create valid order succeeds, anonymous PUT overwrite/PATCH/DELETE existing order denied, anonymous GET orders/customers denied, anonymous GET public menu succeeds, admin menu PUT and approval works, profile and loyalty flow updated and tested, notification services work.
- Publish only to the intended Firebase database and maintain backups/rollback of the previous Rules. Firebase Console -> Realtime Database -> Rules.
