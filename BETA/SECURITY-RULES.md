# BETA Firebase security, backup and cleanup

Project: `kol-grill-pizza-1`; database: `kol-grill-pizza-1-default-rtdb`.

**GitHub is not a Firebase Rules deployment.** `BETA/database.rules.json` is a repository reference. Rules previously published manually through Firebase Console may differ. Confirm the live Rules in Firebase Console before relying on them. This file does not establish the live deployment status.

## Intended access model

- The single authorized Firebase Authentication admin UID may read/write protected database data using a Firebase ID token. The admin UI authenticates for `/menu` updates, including an ETag/If-Match conflict check.
- Anonymous customers may read `/menu`, `/settings`, and `/publicPickupLoad` as specified by repository Rules. **Do not put secrets in publicly readable `/settings`.**
- Anonymous clients may write only `/customers/{8-digit-phone}/name` and `/email` in the sample Rules, and read `/customers/{8-digit-phone}/bonusCount`. The parent `/customers` collection remains unreadable to them. Phone-number knowledge is not customer authentication; a caller who knows a number may read its bonus count and change the allowed fields. Review this risk before production use.
- The repository Rules allow anonymous **create-only** writes to `/orders/{ord_...}` with basic validation. They do not verify menu prices or prevent order spam. **BETA checkout currently saves a local demonstration order; it does not send it to the restaurant.** The public create rule should not be mistaken for an implemented order pipeline.
- Anonymous reads of `/orders`, `/notifications`, and other protected paths are not granted in the repository rules. Trusted SMS/admin services must use their own credentials rather than a public frontend token.

## Cleanup sequence: preserve data and test before deletion

1. Sign into `BETA/admin.html`. Before any cleanup, click **Last ned menybackup**. This exports the *original, most recently loaded* `/menu` JSON from Firebase, including any old fields. Keep it in a safe location.
2. Old `/menu/sections/*/items/*/ingredients` and `ingredientDefaults` fields are staged for removal by the admin when the menu loads. They are **deleted from Firebase only after you press Lagre endringer**. `description` and `ingredientRules` must be preserved. A concurrent menu edit is blocked by the ETag check.
3. The BETA customer uses only `ingredientRules` to show **Tilpass ingredienser**. If empty, the ingredient customization section is hidden. The description is kept as customer-facing text. The admin can explicitly copy ingredients from `description` into `ingredientRules`, then review and save them.
4. `/settings/cartSuggestionRules`, `/settings/cartSuggestionsEnabled`, and `/settings/quickKitchenNotesConfig` are **not used by current BETA customer code**. New admin selections live in `/menu/cartSuggestionRules` (up to ten; four shown at once). Other products/apps may still use old settings: inspect clients and export a backup of `/settings` **before manually deleting those old settings** in Firebase Console.
5. The admin export button backs up **only `/menu`**, not `/settings`, `/orders`, `/customers`, or the entire RTDB. For a complete backup, use Firebase Console's supported export/backup workflow with proper administrative permissions.
6. Unused BETA browser keys `kol-beta-cart-suggestions-once-v1` and `kol-beta-cart-dismissed-v1` are removed opportunistically. The current cart, favorites, theme, contact, bonus, order preview and menu/image caches are not wiped. Service Worker retains only its current version of the BETA static app shell.

## Verification checklist

- Confirm Rules in Firebase Console match the intended customer/admin access, and check that the authenticated admin alone can edit the menu.
- Before and after saving cleanup, compare menu product count, prices, options, `description`, `ingredientRules`, and `cartSuggestionRules` with the exported JSON backup.
- Test selected/unselected ingredients, quick kitchen notes, up to ten admin-selected suggestions and the four-visible random preview.
- Test checkout contact field writes only when changed, cart totals, pickup times, Android/iOS navigation, and mobile dark/light themes.
- **Do not consider the system production-ready until a trusted order submission backend, order validation, notifications, abuse protection, and appropriate customer verification are implemented and tested.**

The cleanup described here covers **BETA only**; never assume that a DEMO client or external integration has been migrated.
