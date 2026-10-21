# BETA internal testing – existing KØL Firebase RTDB only

Current branch: `20261021-beta27` (test-only). No Vercel API, Cloud
Functions, service-account secrets, or separate Firebase project is used by
the BETA order flow. The public BETA menu continues using:

`https://kol-grill-pizza-default-rtdb.firebaseio.com`

Orders are isolated under **`/betaTest/orders/{testId}`** of that **same**
Realtime Database, not `/orders` (existing operations) and not another
Firebase project. The UI always displays a BETA TEST label.

## Scope and safety

- Use dummy data only. Test orders intentionally discard names, phone numbers,
  email addresses, and free-text comments before writing to the database.
- No BETA test SMS, email or other customer notifications are sent.
- TEST-only orders are never shown as real orders. All records have
  `testMode: true` and IDs starting with `test_`.
- New orders use REST conditional `PUT` with `If-Match: null_etag` and
  a persistent per-checkout ID; this avoids duplicate saves on retry.
- Admin reads the latest **100** test orders via Firebase RTDB REST, and uses
  one SSE stream while visible. Status changes use ETag conditional writes
  and maintain monotonically increasing `statusUpdatedAt`.
- The test record can be confirmed, have its pickup time changed, be marked
  ready and be completed. Finalized records remain in the test collection for
  inspecting the history. The customer watches their own test ID only while
  viewing order status (10-second interval).
- The existing DEMO directory and root `index.html` are untouched. All
  original real order data, menu data and settings remain untouched.

## Realtime Database access

This repository deliberately **does not deploy or replace security rules**.
The database owner must configure access to the `betaTest/orders` path if
reads or writes are rejected (401/403). Do not set global `.read` or
`.write` to true to enable this test. Because the app has **no staff
authentication**, all test data must remain non-personal and the path must
never be repurposed for real customers.

Do not promote this mode to production. Real customer data requires an
authenticated backend and rules that restrict staff permissions.
