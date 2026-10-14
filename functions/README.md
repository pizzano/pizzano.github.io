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
3. In the Firebase console, ensure project kol-grill-pizza uses the Blaze plan. Cloud
   Functions require Blaze; usage and Google Secret Manager may have charges.
4. Install firebase-tools (one-time) and authenticate to the project, or connect the
   official Firebase deployment plugin. From the repository root:
   - firebase use kol-grill-pizza
   - firebase functions:secrets:set TRACCAR_CLOUD_TOKEN
     (use a **freshly rotated token**, not the value previously posted in chat)
   - create LOCAL file functions/.env.kol-grill-pizza containing:
       SMS_NOTIFICATIONS_ENABLED=true
     (never commit this file). Activate only after reviewing database rules
     and ice's commercial SMS conditions.
   - firebase deploy --only functions:smsOnOrderStatus
   - verify smsOnOrderStatus is shown as deployed.
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
- **Klar for henting is manual only.** Pickup countdown expiry never updates status.
  Only staff pressing "Marker klar for henting" records that transition.
  The second SMS can only trigger after this saved transition.
- Customer page never PATCHes an order to "klar" just because the timer elapsed.
- There is no Firebase Cloud Scheduler or recurring backend SMS job.
- Until the SMS function is deployed with its secret and enabled, automatic SMS
  does NOT send. A test of the source code is not a test of live cloud delivery.

## Test locally

cd functions
npm install
npm test
