# Bulk Item Families Plan - 2026-05-13

## Goal
- Make bulk item families behave like normal first-class items everywhere users discover, book, scan, check out, return, and audit gear.

## Source Checks
- `prisma/schema.prisma`: Keep `BulkSku` / `BulkSkuUnit` as the implementation model; no schema migration required for this slice.
- `docs/DECISIONS.md`: D-022 is reframed around item families with checkoutable units.
- `docs/AREA_ITEMS.md`: `/items` is the primary catalog for serialized assets, unit-tracked item families, and quantity-tracked item families.
- `docs/AREA_BULK_INVENTORY.md`: `/bulk-inventory` remains an admin/staff operations cockpit.
- `docs/AREA_SCAN.md`: app scan remains lookup-only; kiosk pickup/check-in remains the custody boundary.

## Slices
- [x] Slice 1: Canonical docs and decision reframe.
- [x] Slice 2: Items list/search parity copy, availability payloads, and item-family routing.
- [x] Slice 3: Normal item-detail route for item families using the current bulk detail experience under `/items/bulk-{id}`.
- [x] Slice 4: App scan lookup resolves parent SKU/bin QR and derived unit QR to item-family context.
- [x] Slice 5: Booking picker and creation copy use item-family language while preserving quantity-first payloads.
- [x] Slice 6: Admin/reporting/labels sync pass for touched item-family links, dashboard copy, kit copy, and operations copy.
- [x] Follow-up: Label print queue and remaining report/admin wording show item families as first-class printable and auditable items.
- [x] Follow-up: Rename the normal reports surface to Missing Units and keep item-family/SKU terms out of user-facing battery loss copy.
- [x] Follow-up: Creation and filter copy use Standard, Units, and Quantity while availability carries the item-kind signal in lists and pickers.
- [x] Follow-up: Item-family detail pages use normal item-detail language, compact Units/Quantity tracking labels, and Missing terminology for unit exceptions.
- [x] Follow-up: Battery cockpit and Missing Units report use Missing and Units language in empty states, metrics, actions, and section descriptions.
- [x] Follow-up: Admin navigation labels the battery operations surface as Battery Ops and item-family detail uses Stockroom view for the direct operations handoff.
- [x] Follow-up: Booking picker battery guidance recommends compatible battery families, labels quantities as requested, and keeps exact unit binding at kiosk pickup.
- [x] Follow-up: App scan exact unit QR results show parent item-family context, unit status, and current custody details without turning app scan into checkout.
- [x] Follow-up: Native kiosk pickup and return make battery unit scan progress explicit with required/scanned counts, exact unit chips, and clearer blocked pickup-confirm guidance.

## Verification
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] `npx vitest run tests/api-assets-item-families.test.ts`
- [x] `npx vitest run tests/kiosk-bulk-detail-routes.test.ts`
- [x] Browser smoke: unauthenticated `/items` redirects to `/login` without console errors.
- [x] Authenticated browser smoke: `/items?q=battery` mixed rows, `/items/bulk-{id}` detail, `/scan` derived unit QR lookup, and checkout picker quantity selection.

## Review
- Shipped:
  - First-class item-family docs and decision contract.
  - `/items/bulk-{id}` item-family detail route backed by the existing bulk detail experience.
  - Item-family availability payloads and unit-tracked/quantity-tracked Items filter copy.
  - App scan lookup for parent/bin QR and derived unit QR values.
  - Booking picker and creation copy shifted from bulk-user language to item-family language.
  - Admin-facing item-family operations copy/linkage cleaned up in the touched dashboard, kit, battery, and breadcrumb surfaces.
  - Label printing now includes item-family parent/bin QR labels from `/api/assets` alongside serialized item labels.
  - Remaining report and admin settings copy now says item family, unit-tracked, and quantity-tracked where the UI is not intentionally exposing implementation names.
  - Reports now label `/reports/bulk-losses` as Missing Units, which is friendlier than exposing item-family jargon in the report nav.
  - Add Item now presents Standard, Units, and Quantity with examples; Units creates numbered/scannable units and Quantity remains count-only.
  - Item-family detail pages now avoid user-facing bulk/SKU wording in headers, tabs, QR copy, settings, and unit exception actions.
  - Battery cockpit and Missing Units report now use Missing and Units language instead of old lost/numbered wording in visible labels.
  - Admin navigation now says Battery Ops, and the item-family detail operations link says Stockroom view.
  - Booking picker battery guidance now tells staff to request quantities first while exact unit scans happen during kiosk pickup.
  - App scan lookup now shows exact unit QR scans inside the parent item-family context, including Missing/Checked out/Available status and checked-out custody details when present.
  - Native kiosk pickup and return now show battery unit progress as a first-class step with exact scanned/returned unit chips and blocked pickup-confirm copy when unit scans are missing.
- Verified:
  - TypeScript, migration-prefix check, whitespace check, focused kiosk bulk-detail tests, and Next production build.
  - Focused `/api/assets` item-family tests for mixed search rows and derived unit QR parent-context payloads.
  - Authenticated browser smoke with seeded admin after a clean dev-server restart.
