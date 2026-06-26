# Battery Custody Trust Hardening - 2026-06-25

## Scope

Make numbered battery custody trustworthy after stale Sony Battery rows exposed that stored `BulkSkuUnit.status` can drift from active unit allocations.

## Plan

- [x] Add one shared effective numbered-unit status helper: active allocation wins; orphaned raw `CHECKED_OUT` reads as `AVAILABLE`; `LOST` and `RETIRED` remain blocking.
- [x] Adopt the helper in `/api/assets`, kiosk pickup/reservation staging, generic scan recording, and scan lookup paths.
- [x] Add an audited Battery Ops repair action for stale checked-out battery flags with no active allocation.
- [x] Add a raw Prisma migration that prevents two active allocation rows for the same numbered unit.
- [x] Add focused regression tests for stale pickup reuse, true active-allocation blocking, repair auditing, and the migration constraint.
- [x] Sync Scan, Bulk Inventory, Mobile, Gaps/Risks, codemaps, and verification notes.

## Review

- 2026-06-25: Implemented `src/lib/bulk-unit-status.ts` as the shared effective numbered-unit status rule, adopted it in `/api/assets`, Battery Ops, kiosk pickup/reservation staging, generic scan recording, and scan lookup. Added `POST /api/bulk-skus/batteries/repair-stale` to repair active battery-family units whose raw status is `CHECKED_OUT` without an active allocation, with one audit entry per unit and `bulk_sku.adjust` permission. Added migration `0084_unique_active_bulk_unit_allocation` with a partial unique index on active `booking_bulk_unit_allocations.bulk_sku_unit_id`.
- Focused verification passed: `npx vitest run tests/bulk-unit-status.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/bulk-scan-race.test.ts tests/api-assets-item-families.test.ts tests/battery-ops-route.test.ts tests/battery-ops-repair-route.test.ts tests/bulk-unit-allocation-migration.test.ts`.
- Full closeout verification passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npm run codemap`, `npm run verify:docs`, `npm run drift:ios`, `npm run audit:ios:gaps`, and `npm run build:app`.
