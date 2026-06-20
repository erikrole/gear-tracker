# Battery Ops Empty State Plan - 2026-05-20

## Goal
- Replace the Battery Ops checked-out-units text-only empty row with shared inline `EmptyState` without changing battery status actions or data loading.

## Required reads
- `docs/AREA_BULK_INVENTORY.md`
- `docs/DESIGN_LANGUAGE.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/app/(app)/bulk-inventory/batteries/page.tsx`
- `src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx`

## Peer patterns checked
- Bulk SKU Units tab now uses shared inline `EmptyState` for no units.
- Settings and admin tables use `EmptyState inline` for card/table interiors.

## Plan
- [x] Replace checked-out unit local empty paragraph with shared inline `EmptyState`.
- [x] Update Bulk Inventory and design-language docs.
- [x] Update task ledger.
- [x] Verify TypeScript, migration check, whitespace, build, and browser smoke.

## Review
- Shipped: Battery Ops checked-out-units panel now uses shared inline `EmptyState` copy when no battery units are currently checked out.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/bulk-inventory/batteries`.
- Deferred: Authenticated inspection of the actual empty panel remains useful when seeded local credentials are available.
