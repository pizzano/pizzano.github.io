# BETA private order API – deployment readiness

API origin: https://pizzano-github-io.vercel.app/api/beta
Only the BETA private order API uses this new route; DEMO routes are untouched.
Production credentials required in Vercel environment (never in GitHub):
BETA_FIREBASE_DATABASE_URL (a NEW dedicated Realtime Database, not DEMO).
BETA_FIREBASE_SERVICE_ACCOUNT_JSON (service account JSON for that private instance).
BETA_SESSION_SECRET (random secret at least 32 characters).
BETA_ADMIN_EMAIL (verified recipient of one-time admin login codes).
BETA_SMS_GATEWAY_TOKEN (separate SMS authorization token for the BETA Traccar gateway).
BETA_RESEND_API_KEY and BETA_EMAIL_FROM (verified email sender for BETA email).

The separate database MUST deny unauthenticated reads and writes. Candidate rules are BETA/firebase.rules.json.
Rules are not applied automatically, and Firebase credentials cannot be recovered from the public GitHub repository.
Live API refuses all requests without the required separate Firebase/admin configuration.
An unauthenticated Firebase read probe must return 401/403, otherwise API refuses to process orders.

After admin authentication, its menu/status and menu/import routes can initialize a private verified
menu snapshot from the public DEMO menu. This is a one-time staff-approved import, not a DEMO modification.
Customer orders use only the private snapshot for server-side size, option and price validation.
DEMO menu version updates will require a new controlled import until the BETA admin manages its own public menu.

Admin login is one-time email code (8 digits, 7 minutes TTL, 5 guesses, 2-minute cooldown). Signed Bearer session lasts up to 8 hours and is stored per-tab in sessionStorage.
Public checkout uses a deterministic order ID derived from HMAC of tenant + idempotency key.
Customer status uses a scoped token; active admin orders use one bounded last-100 SSE.
State changes use Firebase ETag CAS with staff role and expected status/version checks.
Complete moves an order to archive and removes it from the active orders stream.
No Klar SMS is sent; the only SMS attempt is after the first confirmed transition.
Provider attempts are claimed atomically before HTTP send; uncertain delivery is not retried blindly.
Provider success does not prove delivery to the customer.

Remaining production prerequisites: deploy service credentials, initialize protected snapshot,
verify rate limits and notification providers, test against a private test database and dummy recipients.
Do not treat code tests or Vercel deployment readiness as an end-to-end customer transaction.
