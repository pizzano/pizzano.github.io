# Firebase security hardening plan

## What is fixed in this branch

- Customer browsers no longer download `/orders` to calculate **Mest bestilt**. They read only `/publicStats/mostOrdered`.
- Admin menu sync no longer listens to Firebase `/` as one giant value snapshot. Menu fields, orders, rescue deals, SMS queue and connection status use separate paths/listeners.
- SMS writes use `/iceSmsQueue/pending/{jobId}` and `/iceSmsQueue/current` only as the Tampermonkey consumer slot, so a second SMS cannot overwrite a waiting SMS.
- New orders use one canonical camelCase metadata model. Old snake_case records are still normalized on read.

## Important: Auth is still the missing security boundary

The current browser clients initialize Realtime Database with only `databaseURL`; there is no Firebase Authentication session that distinguishes an admin from a customer. Because customers must be able to create orders and the admin must be able to edit menu/orders, strict production rules cannot safely distinguish those roles yet.

Do **not** deploy the example rules file as-is until Auth is implemented. The target architecture is:

1. Customer: Firebase Anonymous Auth; each order stores `ownerUid`.
2. Admin: Firebase Auth plus an `admin: true` custom claim (set by a trusted Admin SDK environment / Cloud Function, never by browser JavaScript).
3. Rules: customers may create/read only their own orders; only admins may update order status, menu, rescue deals, public stats and SMS queue.
4. Move `customerOrders` from phone-number keys to UID keys. Phone numbers should be order data, not authorization keys.
5. Consider moving SMS enqueue and rescue-stock reservation to a trusted backend/Cloud Function for stronger tamper resistance.

`database.rules.hardened.example.json` is a target ruleset for that Auth-based architecture, not a drop-in rule for the current unauthenticated production client.
