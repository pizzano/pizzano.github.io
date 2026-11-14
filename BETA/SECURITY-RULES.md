# BETA Firebase Realtime Database security — staged, NOT DEPLOYED

Database: `kol-grill-pizza-1-default-rtdb`. Authentication admin UID is restricted in server-side Rules.

Deploy `BETA/database.rules.json` only after integration and emulator tests. It is not automatically deployed by GitHub Pages.

Behavior:
- Authenticated admin UID gets full read/write via root rules.
- Public GET of /menu, /settings, /publicPickupLoad.
- Anonymous customers can create one /orders/{ord_ID}, with basic field validation, but cannot update/delete existing orders or read orders.
- Anonymous writes to /customers/{8-digit-phone}/name and /email are allowed with type/length checks.
- Anonymous READ is permitted only on /customers/{8-digit-phone}/bonusCount (for the existing BETA bonus display). Parent /customers and other fields remain unreadable. Anyone knowing a phone number may view its bonus count. Anonymous /customers reads and all other customer writes remain denied. Knowing a phone number permits changing those two fields; this is an accepted trade-off for the no-login design.
- No anonymous access to /notifications, /pizzaBonus, /systemErrors or other private paths.
- Admin must use Firebase Authentication ID token. BETA admin PR #115 adds this only to /menu operations.
- Note /settings is fully public here: split public/private settings before deployment if any secrets are stored there.
- BETA customer contact now issues two leaf-level PUT requests, not a parent PATCH. Bonus reads and DEMO/customer order tracking remain blocked without a secure API; BETA order checkout currently only creates a local demo order.
- The open create-only /orders rule still permits spam, spoofed totals, and arbitrary order contents. For a production system prefer an API to validate menu prices, order inputs and abuse limits before trusted writes.
- Server-side Google Apps Script or other services must use their own trusted credentials; do not copy admin password/token into public JS.
- Tests required: anonymous create valid order succeeds, anonymous PUT overwrite/PATCH/DELETE existing order denied, anonymous GET orders/customers denied, anonymous GET public menu succeeds, admin menu PUT and approval works, profile and loyalty flow updated and tested, notification services work.
- Publish only to the intended Firebase database and maintain backups/rollback of the previous Rules. Firebase Console -> Realtime Database -> Rules.
