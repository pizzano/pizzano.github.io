# Firebase Cloud Functions – BETA private order API

The static customer and restaurant panels remain at `bestill.online/BETA/`,
but **all BETA order operations now target Firebase Cloud Functions directly**.
They do not call Vercel. Backend endpoint (after deployment):
`https://europe-west1-bestill-19.cloudfunctions.net/betaOrders`

## Isolation and prerequisite access

- Firebase project: `bestill-19` (already contains unrelated existing functions).
  BETA has its **own** `BETA/firebase.json`, `BETA/functions`, and unique
  `kol-beta-orders` codebase. It does not change or redeploy `functions/index.js`,
  the DEMO site, the default SMS database, or the public catalog database.
- The Firebase project owner must authorize a Firebase connection or Firebase
  CLI deployment. Cloud Functions Gen 2 require Blaze billing (charges possible).
- Create a **separate Realtime Database instance** in europe-west1, not
  `bestill-19-default-rtdb` or `kol-grill-pizza-default-rtdb`. Apply
  `BETA/firebase.rules.json` **only** to that instance, denying all
  unauthenticated read/write operations. Index active orders by createdAt.
  This action is not automated and must be verified before accepting real orders.
- The Gen 2 runtime uses Google Application Default Credentials (ADC) rather
  than checked-in service-account JSON. Give its runtime identity only the
  Firebase RTDB project/database permissions it needs. Never commit tokens,
  credentials, or customer orders to GitHub.

## Secure Cloud Functions configuration (never in git)

Deploy from the `BETA` directory with the Firebase CLI, selecting project
`bestill-19`. Install dependencies once in `BETA/functions` (`npm install`).
Provide non-secret Firebase parameters when prompted (they are written to an
ignored `BETA/functions/.env.bestill-19`):

- `BETA_FIREBASE_DATABASE_URL` – **new private** RTDB URL.
- `BETA_ADMIN_EMAIL` – real staff mailbox for 8-digit OTP.
- `BETA_EMAIL_FROM` – verified Resend sending address.

Create these three Firebase Secret Manager secrets with
`firebase functions:secrets:set <NAME>` in project `bestill-19`:

- `BETA_SESSION_SECRET` – random 32+-character secret.
- `BETA_SMS_GATEWAY_TOKEN` – rotated Traccar gateway key.
- `BETA_RESEND_API_KEY` – verified Resend API key.

Deploy only the isolated codebase from the `BETA` directory:
`firebase deploy --project bestill-19 --only functions:kol-beta-orders`.
Deploying the root/default functions risks affecting unrelated SMS functions.

The public `health` endpoint must show `ordersConfigured: true`. Open
`/BETA/admin.html`, select **Koble til**, send and verify the administrator
OTP, and import the approved menu into the private RTDB **once** with the ☷
button. Price checks then use only the locked private menu snapshot, not
publicly editable data. Re-import after approved menu changes.

## Behavior and verification

- Customers submit public checkout requests through Firebase; idempotency
  prevents duplicate orders on retry. Data is stored only in private RTDB.
- Admin login uses 8-digit one-use email code; signed sessions and CSRF
  are verified on the server. Active Admin SSE stream is bounded to **100**
  recent active orders. Order history is loaded only on explicit request.
- Only first confirmation attempts SMS and optional email. Ready never sends
  a second SMS automatically. Provider requests use atomic claims to avoid
  duplicate sends on unclear delivery outcomes.
- Customer order-scoped tokens authorize only their own status, never
  other customers' names/numbers/orders. Epson prints from Admin browser.
- Run both API suites plus Firebase entrypoint tests; then verify a full
  live transaction with dummy customer details and valid test recipients:
  new order, Admin receipt, confirm, pickup time, email, SMS, printing,
  ready, archive, and denied anonymous private RTDB read (401/403).
- **Not live until Firebase owner configures/deploys and tests the function,
  secrets, protected database and notifications.** The API fails closed
  rather than falsely accepting a real order.
