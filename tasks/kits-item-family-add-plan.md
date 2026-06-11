# Kits — Add Item Families Plan

Created: 2026-06-03

## Goal
Let staff add item families (bulk SKUs) to a kit from the kit detail page. The page
already displays and removes item families, and the backend `POST /api/kits/[id]/bulk-members`
already exists — only the add UI is missing.

## Source Audit
- `src/app/(app)/kits/[id]/page.tsx`: kit detail. Has serialized add-search, serialized
  remove, bulk-member display table, and bulk-member remove. No bulk-member add path.
- `src/app/api/kits/[id]/bulk-members/route.ts`: `POST { bulkSkuId, quantity (1-999) }`
  upserts a `KitBulkMembership`, audits `bulk_member_added`, returns `{ data: membership }`
  (201) with `bulkSku { id, name, category, unit, imageUrl }` included. `DELETE` already wired.
- `src/app/api/bulk-skus/route.ts`: `GET ?location_id=&limit=` returns active SKUs with a
  computed `availableQuantity`. No text `q` param — filter client-side.
- `prisma/schema.prisma`: `KitBulkMembership` is `@@unique([kitId, bulkSkuId])`; POST upserts.

## Approach (single thin slice — UI wiring only)
- No backend/schema change. Reuse the existing POST.
- Lazy-load the kit location's item families once when the bulk add-search is first used,
  cache in state, filter client-side by name/category, exclude already-added families.
- Each result row: name + category + available-qty hint + a quantity input (default 1,
  1–999) + Add button. On add, POST and optimistically append the returned membership.
- Gate the add UI on `kit.active` (mirrors the existing remove gating).
- Match the serialized add-search markup, spacing, spinner/error/empty states, and the
  optimistic `setKit` cache pattern already in the file.

## Non-Goals
- No inline quantity edit (no PATCH endpoint exists; re-add via upsert covers correction).
- No backend `q` search param on `/api/bulk-skus`.
- No change to serialized add/remove or any other kit behavior.

## Checklist
- [x] Add `BulkSkuOption` type + add-state (search, lazy options, qty map, adding ids).
- [x] Add lazy-fetch effect for location item families.
- [x] Add `handleAddBulkMember` (POST + optimistic append + toast).
- [x] Add the add-search UI inside the Bulk Items card, above the table/empty state.
- [x] Sync `docs/AREA_KITS.md` change log.
- [x] Verify: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`.
- [ ] Authenticated browser smoke remains blocked by local login environment.

## Verification
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [ ] Browser smoke: open a kit, search item families, set qty, add, confirm it lands in
  the Bulk Items table and is excluded from subsequent search results; remove still works.

## Review
- Shipped 2026-06-03 (single slice). `src/app/(app)/kits/[id]/page.tsx`: the Bulk Items
  card now has an add-search that lazy-loads the kit location's active item families
  (`GET /api/bulk-skus?location_id=&limit=200`), filters client-side by name/category,
  excludes already-added families, and adds each via `POST /api/kits/[id]/bulk-members`
  with a per-row quantity (1-999), optimistically appending the returned membership.
  Active-kit gated, mirrors the serialized add-search markup/state patterns.
- Root finding confirmed by docs: `AREA_KITS.md` listed "Add bulk SKUs (quantity picker)"
  as expected and the 2026-05-24 batch had removed the empty-state copy that promised the
  then-missing control. The route (`POST .../bulk-members`) already existed; only the UI
  was absent. This slice makes code match the documented AC-2/AC-3 spec. No backend/schema change.
- Verified: `npx tsc --noEmit` (clean), `npm run db:migrate:check` (75 migrations, no
  collisions), `git diff --check` (clean), `npx next build` (success). Interactive browser
  smoke not run: local login is blocked by Prisma P1000 in this environment (recurring,
  noted across prior sessions); the change is type-checked and production-built.
- Docs synced: `AREA_KITS.md` change log.
