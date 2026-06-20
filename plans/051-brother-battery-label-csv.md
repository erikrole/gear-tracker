# Brother battery label CSV and printed label tracking

## Status

- **State**: DONE ON MAIN (2026-06-19 reconciliation; implementation originally shipped 2026-06-11)
- **Priority**: P1
- **Effort**: M
- **Depends on**: D-022 numbered bulk-unit model

## 1. Executive summary

Add a Brother P-Touch-ready CSV export for numbered bulk battery units, starting with Sony battery SKUs, and add durable per-unit tracking for labels that have been printed and applied.

The right source of truth is `BulkSkuUnit`, not a new label table. Batteries already use numbered unit tracking, and their unit QR value is derived from the bulk SKU bin QR plus the unit number. This plan keeps that model intact:

- CSV column `item_number` is the battery unit number as a string.
- CSV column `qr_code` is the existing derived unit QR value, formatted as `{binQrCodeValue}-{unitNumber}`.
- Label state is stored on each `BulkSkuUnit`, so the app can distinguish unprinted, printed, and already labeled units without changing equipment status.

No open question blocks implementation. Default behavior should export unprinted, non-retired units for the selected battery SKU. The UI should expose this from Battery Ops cards, so "Sony Battery" is handled naturally by using the Sony card instead of hardcoding Sony in the backend.

## 2. Source-grounded facts

- `BulkSkuUnit` is the existing numbered physical unit model, with `bulkSkuId`, `unitNumber`, `status`, `notes`, and a unique `[bulkSkuId, unitNumber]` constraint. It currently has no label tracking fields.
- `BulkSku` already stores `binQrCodeValue`, `trackByNumber`, and `units`; `binQrCodeValue` is unique within a location.
- Decision D-022 says batteries are first-class item families, physical unit labels must match unit numbers, and unit QR values are derived from `{binQrCodeValue}-{unitNumber}`.
- `docs/AREA_BULK_INVENTORY.md` says QR behavior is derived for unit-tracked bulk items and there is no separate QR field to assign manually.
- `src/lib/bulk-unit-qr.ts` already parses derived QR values from the longest `binQrCodeValue` prefix and validates the unit number.
- `src/lib/csv.ts` already centralizes CSV field escaping and spreadsheet formula protection.
- Existing export routes use `NextResponse`, `text/csv`, `Content-Disposition`, permission checks, and `csvField`.
- Battery Ops currently returns battery SKUs and their units, including status and notes, but not label state.

## 3. Product behavior

### Brother CSV

Add a CSV export for a selected unit-tracked bulk SKU:

`GET /api/bulk-skus/[id]/units/labels?scope=unprinted`

Response:

```csv
item_number,qr_code
1,SONY-BATTERY-1
2,SONY-BATTERY-2
3,SONY-BATTERY-3
```

Rules:

- Only allow export for `trackByNumber = true` SKUs.
- Default `scope=unprinted` includes units where `labelPrintedAt IS NULL` and `status != RETIRED`.
- Support `scope=all` for reprints.
- Sort rows by `unitNumber` ascending.
- Use `csvField` for every value.
- Filename should be stable and readable: `brother-labels-{sku-slug}-{YYYY-MM-DD}.csv`.
- Do not store QR values. Derive them from `BulkSku.binQrCodeValue` and `BulkSkuUnit.unitNumber` at export time.
- If `binQrCodeValue` is missing, return a clear 400 and do not generate a partial file.

### Printed label tracking

Add a batch mark endpoint:

`POST /api/bulk-skus/[id]/units/labels`

Body:

```json
{
  "unitNumbers": [1, 2, 3],
  "printed": true
}
```

Rules:

- Require the same bulk SKU adjustment permission used by unit status changes.
- Validate every unit number belongs to the selected SKU.
- Do not allow marking retired units unless a future explicit reprint workflow needs it.
- Set `labelPrintedAt` only for units that are not already marked printed.
- Set `labelPrintedById` to the current user id.
- Set `labelPrintBatchId` to a generated batch id for the operation.
- Return counts for `updated`, `alreadyPrinted`, and `skippedRetired`.
- Write one audit entry for the batch with the SKU id, unit numbers, counts, and batch id.

Keep this distinct from `BulkUnitStatus`. A printed label is a physical workflow state, not inventory availability.

### Battery Ops UI

Update Battery Ops first, because that is the operator surface for this task.

For every unit-tracked battery family card:

- Show label progress: `12 of 24 labels printed`.
- Show a subtle `needs labels` count when there are unprinted non-retired units.
- Add a `Brother CSV` action that downloads the unprinted label CSV for that card.
- After a successful download, show a confirmation action: `Mark exported labels printed`.
- The confirmation should list the count and unit numbers, for example `Mark 12 Sony Battery labels printed? Units 1, 2, 3...`.
- Marking printed should call the batch endpoint using the exact unit numbers that were exported.

For unit chips or unit menus:

- Add a small printed-label indicator.
- Show `Label printed Jun 11, 2026` when printed.
- Show `Needs label` when `labelPrintedAt` is null and the unit is not retired.
- Do not make label state the dominant visual state. Availability status remains primary.

### Bulk SKU detail UI

Thread the same label fields into the generic numbered unit tab, but keep controls secondary:

- Display the printed-label indicator in `BulkUnitGrid`.
- Add an export action near existing numbered-unit actions only when `trackByNumber` is true.
- Avoid duplicating the full Battery Ops workflow if that would make the generic tab crowded.

## 4. Data model

Add fields to `BulkSkuUnit`:

```prisma
labelPrintedAt DateTime? @map("label_printed_at")
labelPrintedById String? @map("label_printed_by_id")
labelPrintBatchId String? @map("label_print_batch_id")

@@index([bulkSkuId, labelPrintedAt])
```

Use a scalar `labelPrintedById` rather than a required relation. Audit logs already preserve actor context, and label history should remain readable if user records are later changed or deactivated.

Migration acceptance:

- Existing units backfill as unprinted with all three new fields null.
- No data migration is needed for QR values because they are still derived.
- Prisma client generation succeeds after migration.

## 5. Implementation files

### Backend

- `prisma/schema.prisma`
  - Add the three label fields and index to `BulkSkuUnit`.
- `src/lib/bulk-unit-qr.ts`
  - Add a formatter helper such as `buildDerivedBulkUnitQrValue(binQrCodeValue: string, unitNumber: number): string`.
  - Keep parser behavior unchanged.
- `src/lib/validation.ts`
  - Add schemas for label export query and mark-printed body.
- `src/app/api/bulk-skus/[id]/units/labels/route.ts`
  - New route with `GET` for CSV export and `POST` for mark printed.
  - Reuse permission, audit, CSV, and route response patterns from existing bulk unit and export routes.
- `src/app/api/bulk-skus/batteries/route.ts`
  - Include `labelPrintedAt`, `labelPrintedById`, and `labelPrintBatchId` in returned units.
  - Add per-SKU counts: `labelPrintedCount` and `labelNeededCount`.
- `src/app/api/bulk-skus/[id]/units/route.ts`
  - Include label fields in unit responses.
- `src/app/api/bulk-skus/[id]/units/[unitNumber]/route.ts`
  - Preserve label fields when status or notes are patched. No status endpoint should clear label state.

### Frontend

- `src/app/(app)/bulk-inventory/batteries/page.tsx`
  - Add label progress and Brother CSV actions to each unit-tracked battery card.
  - Store the last exported unit numbers in component state so the follow-up mark-printed confirmation uses the exact exported set.
  - Refresh battery data after marking printed.
- `src/app/(app)/bulk-inventory/[id]/types.ts`
  - Add label fields to unit types.
- `src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx`
  - Pass label fields through to the grid.
- `src/components/BulkUnitGrid.tsx`
  - Add the small printed-label indicator and accessible labels.

### Tests

- `tests/bulk-unit-qr.test.ts`
  - Add formatter coverage for derived unit QR values.
- `tests/bulk-unit-label-export-route.test.ts`
  - Cover CSV headers, row sorting, unprinted default filtering, reprint scope, permission denial, invalid SKU, non-numbered SKU rejection, missing bin QR rejection, and formula-safe escaping.
  - Cover mark-printed batch behavior, already-printed counts, retired skips, and audit write.
- `tests/battery-ops-route.test.ts`
  - Cover returned label fields and label counts for Sony Battery test data.
- `tests/bulk-unit-adjustment-routes.test.ts`
  - Confirm status updates do not clear printed-label fields.

## 6. UX acceptance criteria

- A user can open Battery Ops, find Sony Battery, download a Brother-ready CSV, and import it into Brother P-Touch using `item_number` and `qr_code`.
- The CSV has exactly the fields needed for the Brother template by default.
- The QR values in the CSV match scanner behavior already supported by the app.
- After printing, the user can mark the exported units as printed without manually selecting every unit.
- Printed label tracking survives page refresh and is visible at both the battery-card level and unit level.
- Reprinting remains possible through `scope=all`, but it does not reset or duplicate printed tracking.

## 7. Verification plan

Run focused checks:

```bash
npx vitest run tests/bulk-unit-qr.test.ts tests/bulk-unit-label-export-route.test.ts tests/battery-ops-route.test.ts tests/bulk-unit-adjustment-routes.test.ts tests/csv.test.ts
npm run db:migrate:check
npx tsc --noEmit --pretty false
git diff --check
```

If live migration credentials are available, also run:

```bash
npm run build
```

If live migration credentials are not available, use the project fallback:

```bash
npm run db:migrate:check
npm run build:app
```

Manual smoke:

1. Seed or use a Sony Battery SKU with numbered units.
2. Mark at least one unit as already printed and leave at least one unprinted.
3. Export unprinted CSV from Battery Ops.
4. Confirm the file contains only `item_number,qr_code` and only unprinted non-retired units.
5. Mark exported labels printed.
6. Refresh Battery Ops and confirm label counts and per-unit indicators update.
7. Re-export unprinted and confirm previously marked units are excluded.

## 8. Stop conditions

- Stop if Brother P-Touch rejects `item_number,qr_code` headers and the app needs different field names.
- Stop if a target battery family is not unit-tracked. Label CSV generation depends on `BulkSkuUnit`.
- Stop if any implementation attempts to store a second QR value per unit. Derived QR remains the project rule.
- Stop if export filtering cannot clearly tell the user which units are being marked printed.

## 9. Documentation updates for executor

When implementing, update:

- `docs/AREA_BULK_INVENTORY.md`
  - Add Brother label CSV export and printed-label tracking to the battery/unit-tracked section.
  - Add changelog entry for this slice.
- `docs/DECISIONS.md`
  - Extend D-022 consequences to state label print state may be stored per unit, but QR data remains derived.
- `docs/GAPS_AND_RISKS.md`
  - Remove or close any related battery-label tracking gap if one exists during implementation.

## 10. Review

- Shipped: numbered bulk units carry printed-label metadata, Brother CSV export derives QR values from `{binQrCodeValue}-{unitNumber}`, and Battery Ops plus numbered-unit detail expose export and label-state controls.
- Verified: focused QR, label export, battery ops, bulk-unit adjustment, CSV, migration-check, typecheck, and diff hygiene commands pass in the 2026-06-19 reconciliation pass.
- Deferred: no follow-up needed unless the Brother template requires different column names.
