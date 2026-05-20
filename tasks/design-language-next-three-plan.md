# Design Language Next Three Plan - 2026-05-20

## Goal
- Ship the next three small design-language cleanup slices without changing route contracts or workflow policy.

## Required reads
- `docs/AREA_REPORTS.md`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `docs/DESIGN_LANGUAGE.md`
- `prisma/schema.prisma`
- Target and peer UI files listed below

## Peer patterns checked
- Items and Users already use `OperationalActiveFilterChips` for removable active facets.
- Booking rows, Trade Board, Items rows, and Settings rows already use `OperationalRowActions` for row overflow menus.
- Settings Categories, Departments, Locations, Calendar Sources, and Booking Presets already use shared inline `EmptyState` inside table/card interiors.

## Plan
- [x] Slice 11: Add shared active-filter chips to Reports period/phase toolbars.
- [x] Slice 12: Move item detail secondary actions onto `OperationalRowActions`.
- [x] Slice 13: Replace the Bulk SKU units text-only empty row with shared inline `EmptyState`.
- [x] Update area docs, design language, and task ledger.
- [x] Verify TypeScript, migration check, whitespace, build, and browser smoke.

## Review
- Shipped: Reports Checkouts, Scans, and Audit use shared active-filter chips for non-default period/phase filters; item detail secondary actions use `OperationalRowActions`; Bulk SKU units empty state uses shared inline `EmptyState`.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/reports/scans?period=7&phase=CHECKIN`, `/items/test-item-id`, and `/bulk-inventory/test-sku-id`.
- Deferred: Authenticated visual inspection of the changed controls remains useful when seeded local credentials are available.
