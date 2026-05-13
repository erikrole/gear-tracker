# Battery Audit Reporting Plan

## Goal
Close GAP-37 with a small, read-only reporting slice for numbered battery SKUs.

## Scope
- [x] Audit current battery cockpit, bulk-loss report, schema, and gap docs.
- [x] Add battery-specific audit data to the bulk-loss report service/API:
  - missing batteries by unit
  - loss rate by SKU
  - unit checkout history
  - repeated missing-unit patterns
- [x] Surface the battery audit sections on `/reports/bulk-losses`.
- [x] Add focused regression coverage for the new report aggregation.
- [x] Sync `AREA_BULK_INVENTORY`, `AREA_REPORTS`, `GAPS_AND_RISKS`, and task notes.
- [x] Run focused tests, TypeScript, Prisma checks, full tests, build, and browser smoke.

## Constraints
- No schema change for this slice.
- Keep battery identification aligned with the existing cockpit term-boundary matching.
- Keep the report ADMIN/STAFF read-only under the existing `/api/reports/bulk-losses` permission boundary.
