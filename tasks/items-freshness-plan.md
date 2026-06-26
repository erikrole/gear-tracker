# Items freshness plan

## Goal

Make item and item-family updates visible across Items surfaces without requiring a manual browser refresh, especially after editing an item detail and navigating back to `/items`.

## Sources checked

- `docs/NORTH_STAR.md`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`
- `docs/AREA_DASHBOARD.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `docs/BRIEF_*`
- `docs/AREA_*`
- `prisma/schema.prisma`
- Items list/detail hooks and API routes
- Existing booking change-sync implementation and tests

## Implementation checklist

- [x] Add an item catalog change signal backed by `Asset.updatedAt`, `BulkSku.updatedAt`, and audit rows.
- [x] Force `/items` query data to verify server truth on mount.
- [x] Invalidate item-family list and form-option caches after successful item and bulk SKU detail mutations.
- [x] Wire item change sync into Items list and detail experiences.
- [x] Refresh open serialized-item and bulk-SKU detail views when their changed ID is signaled.
- [x] Add source-contract tests for the freshness behavior.
- [x] Sync docs and task tracking.
- [x] Run focused tests, docs verification, migration check, typecheck, and build.

## Review

2026-06-26: Shipped locally. `/items` refetches on mount, successful serialized item and item-family detail saves invalidate `["items"]` and `["form-options"]`, and `/api/items/changes` exposes a no-store cursor over `Asset`, `BulkSku`, and audit-log changes. Items list, serialized detail, and item-family detail mount the shared change-sync hook; open detail hooks refresh when their changed ID is signaled.

Verification passed:
- `npx vitest run tests/item-freshness-sync-source.test.ts tests/booking-realtime-sync-source.test.ts tests/hook-escape-hatches-source.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run codemap`
- `npm run verify:docs`
- `npm run db:migrate:check`
- `git diff --check`
- `npm run build:app`
