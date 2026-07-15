# Monitor Battery Product Family Plan - 2026-07-15

## Goal
- Present one bookable `Monitor Battery` item-family row while retaining the exact Watson or GVM product identity of every numbered physical battery.
- Keep one permanent family QR sequence and the existing Sony-style quantity-first reservation and exact-unit kiosk custody workflow.

## Route
- Owner area: Items and Bulk Inventory
- Ledger: this plan, then archive to `tasks/archive/completed-2026-07/` after code verification and the live data consolidation are both closed.
- Existing references: D-022, `docs/AREA_BULK_INVENTORY.md`, and `tasks/item-family-detail-ownership-pass.md`.

## Source Checks
- `BulkSku` is the bookable item-family record and owns the base QR code.
- `BulkSkuUnit` owns the permanent unit number and custody status, but currently has no structured product identity.
- Derived unit QR values already follow `{binQrCodeValue}-{unitNumber}` and must not change.
- Live read-only evidence on 2026-07-15 found:
  - `Monitor Battery`: quantity-tracked, 14 on hand, base QR `bdf15b57`, no booking, movement, or scan history.
  - `Watson NP-F550`: four numbered units, base QR `4a0bed87`, no booking, movement, or scan history.
  - No GVM family or serialized GVM record.
  - Serialized `Monitor Battery` / `BA-001`: Watson B-4205, with no booking, allocation, scan, kit, or check-in-report history.
- The Cheqroom source identifies the 14-count family as Watson B-4205 NP-F770 and the four-count family as Watson B-4203 NP-F550. Physical inventory must confirm where GVM units belong before live consolidation.

## Stop Conditions
- Stop live data consolidation if physical unit counts and product assignments do not match the stored Watson evidence.
- Stop if a source family gains booking, movement, scan, or active custody history before consolidation.
- Stop if migration health disagrees with the local migration chain.
- Do not rewrite the in-progress profile-completion migration or item-family QR replacement work.

## Slices
- [x] Slice 1: Extend D-022 and the schema with family product records plus an optional product assignment on numbered units.
- [x] Slice 2: Add audited product create/edit/archive and per-unit product-assignment APIs.
- [x] Slice 3: Add product management, product counts, add-unit product selection, and per-unit assignment to item-family detail.
- [x] Slice 4: Add a dry-run-first, state-guarded Monitor Battery consolidation script without guessing GVM assignments.
- [x] Slice 5: Add focused schema, route, and source-contract tests.
- [x] Slice 6: Sync area docs, task ledgers, codemaps, and closeout evidence.

## Verification
- [x] `npx prisma format`
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] Focused Vitest route, schema, and UI source-contract tests
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for touched source
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] Authenticated browser smoke for `/items/bulk-{id}`, or record why blocked
- [x] Live migration deploy and guarded data consolidation

## Review
- Shipped: Schema, migration, audited APIs, item-family product management UI, exact unit assignment, and live Monitor Battery consolidation into one 18-unit family.
- Verified: Prisma format and validation, migration-chain check, focused tests, TypeScript, focused ESLint, codemap, docs verification, diff check, application build, guarded live apply, and independent live database audit.
- Deferred: Authenticated browser proof and physical product assignment for Monitor units 1-14.
- Blocked: None for the singular catalog outcome. Physical staff verification is still required before units 1-14 can be assigned to Watson NP-F770 or GVM products.
- Proof artifacts: `prisma/migrations/0093_item_family_products/migration.sql`, `tests/item-family-products-route.test.ts`, `tests/item-family-products-schema.test.ts`, `scripts/consolidate-battery-families.mjs`, and `.tmp/battery-family-consolidation-1784148055331.json`.
- Next slice or stop: Stop software work. Physically identify Monitor units 1-14, assign products in item-family detail, and print the derived labels.
