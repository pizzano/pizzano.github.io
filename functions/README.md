# KØL Grill & Pizza — PC-independent SMS notifications

A Firebase **Realtime Database v2 trigger** listens for accepted and ready status transitions.
It does **not** require a browser, staff PC or admin panel to stay open. The shop's Android phone,
Traccar SMS Gateway and its mobile/internet connection must remain available.

## Status mapping

- mottatt -> bekreftet: confirmation SMS with estimated/preset hentetid
- bekreftet / tilberedning -> klar: "Klar for henting" SMS
- Rejected, finished and unchanged statuses do not send SMS
- Only a phone number fetched from the saved order is used; clients cannot
  pass arbitrary phone numbers to the SMS service
- Deduplication is recorded in Firebase RTDB at smsNotifications/{orderId}/{kind}.
  "failed" outcomes are not automatically resent. This avoids duplicate texts
  after an ambiguous HTTP timeout; failures require supervised investigation.

## Required setup before enabling

1. **Protect the database.** Verify proper Firebase RTDB rules and authenticated admin
   status changes; the current static-site REST integration cannot by itself prove admin
   identity. Never enable notifications if public writers can forge order status updates.
2. Check ice terms for sending automatically generated restaurant SMS.
3. In the Firebase console, ensure project bestill-19 uses the Blaze plan. Cloud
   Functions require Blaze; usage and Google Secret Manager may have charges.
4. Install firebase-tools (one-time) and authenticate to the project, or connect the
   official Firebase deployment plugin. From the repository root:
   - firebase use bestill-19
   - firebase functions:secrets:set TRACCAR_CLOUD_TOKEN
     (use a **freshly rotated token**, not the value previously posted in chat)
   - create LOCAL file functions/.env.bestill-19 containing:
       SMS_NOTIFICATIONS_ENABLED=true
       SMS_AUTO_READY_ENABLED=true
     (never commit this file). Activate only after reviewing the database rules
     and confirming that employees want automatic "klar" transitions.
   - firebase deploy --only functions
   - verify both smsOnOrderStatus and autoReadyOrders are shown as deployed.
5. Send two non-customer test orders with a valid Norwegian mobile number and verify
   SMS text and smsNotifications entries in the Firebase console. Check receipt on
   the destination handset; a Traccar gateway API success isn't a carrier delivery proof.
6. Exclude the SMS-status subtree from untrusted client writes in Firebase rules.

## Safety / privacy

- No Traccar token, phone list, SMS credentials or admin password in public JS.
- Secret is injected only into the Firebase function using Secret Manager.
- Notifications are **OFF by default** until SMS_NOTIFICATIONS_ENABLED=true is deployed.
- Cloud gateway passes recipients and message content via Traccar's cloud service.
- Send only essential transactional SMS; follow privacy rules and retention policies.
- The optional autoReadyOrders Cloud Scheduler function checks recent orders every minute,
  even if the admin panel is not open. This consumes billable Cloud Scheduler / Function
  resources and requires SMS_AUTO_READY_ENABLED=true to update statuses. Only
  orders with a ready time in the last hour and created in the last 24 hours are
  eligible, to avoid sending notifications for historical orders at first launch.
  It requires an index on "status" for efficient Firebase RTDB queries.
- The original admin.js timer may also mark orders ready while an employee is using
  the admin panel. The backend uses a transaction to avoid double updates, and
  the SMS sender deduplicates the resulting notification.
- Until both cloud functions are deployed with secrets and enabled, automatic SMS
  does NOT send. A test of the source code is not a test of live cloud delivery.

## Test locally

cd functions
npm install
npm test
