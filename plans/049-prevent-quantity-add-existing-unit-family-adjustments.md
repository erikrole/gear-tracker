# Plan 049: Prevent Quantity add-to-existing from adjusting unit families

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/(app)/items/new-item-sheet/BulkItemForm.tsx src/app/api/bulk-skus/[id]/adjust/route.ts src/app/api/bulk-skus/[id]/units/route.ts tests/api-hardening-wave11.test.ts tests/new-item-sheet-ui-source.test.ts docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

The Add Item sheet's Quantity path can add stock to an existing item family. Today that selector is fed by all active `BulkSku` rows, including unit-tracked families. If an operator picks a unit-tracked family there, the sheet posts to `/api/bulk-skus/[id]/adjust`, which changes `BulkStockBalance` but does not create `BulkSkuUnit` records. That violates the accepted item-family model where unit-tracked counts are backed by permanent unit rows.

## Current state

- `docs/DECISIONS.md` D-022 says `BulkSkuUnit` records are created under unit-tracked item families, unit status is stored directly, and unit numbers are permanent.
- `docs/AREA_BULK_INVENTORY.md` lines 15-25 split Quantity-tracked and Unit-tracked families, and say quantity-only availability derives from `BulkStockBalance`.
- `BulkItemForm.tsx` fetches every active bulk SKU when the sheet opens:

```tsx
// src/app/(app)/items/new-item-sheet/BulkItemForm.tsx:58-74
useEffect(() => {
  if (!open) return;
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/bulk-skus", { signal: controller.signal });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) return;
      const json = await parseJsonSafely<BulkSkuListResponse>(res);
      if (!controller.signal.aborted) setExistingBulkSkus(Array.isArray(json?.data) ? json.data : []);
    } catch {
      // ignore
    }
  })();
  return () => controller.abort();
}, [open]);
```

- The existing Quantity add-to-existing payload posts to the generic stock-adjust endpoint:

```tsx
// src/app/(app)/items/new-item-sheet/BulkItemForm.tsx:93-103
if (bulkMode === "existing") {
  const sku = existingBulkSkus.find((s) => s.id === selectedBulkSkuId);
  return {
    url: `/api/bulk-skus/${selectedBulkSkuId}/adjust`,
    body: { quantityDelta: addQty, reason: "Added via New Item sheet" },
    label: sku?.name || "Item",
    handoffHref: `/items/bulk-${selectedBulkSkuId}`,
    openLabel: "Open item",
  };
}
```

- The adjustment route updates balance and movement only. It does not reject `trackByNumber` SKUs:

```ts
// src/app/api/bulk-skus/[id]/adjust/route.ts:15-38
const result = await db.$transaction(async (tx) => {
  const sku = await tx.bulkSku.findUnique({ where: { id: params.id } });
  if (!sku) {
    throw new HttpError(404, "Bulk SKU not found");
  }

  const balance = await tx.bulkStockBalance.findUnique({
    where: {
      bulkSkuId_locationId: {
        bulkSkuId: sku.id,
        locationId: sku.locationId
      }
    }
  });

  const current = balance?.onHandQuantity ?? 0;
  const next = current + body.quantityDelta;
```

- The correct route for unit-tracked additions already exists and rejects quantity-only SKUs:

```ts
// src/app/api/bulk-skus/[id]/units/route.ts:24-33
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const { id } = params;
  const body = addBulkUnitsSchema.parse(await req.json());

  const result = await db.$transaction(async (tx) => {
    const sku = await tx.bulkSku.findUnique({ where: { id } });
    if (!sku) throw new HttpError(404, "Bulk SKU not found");
    if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused route tests | `npx vitest run tests/api-hardening-wave11.test.ts` | exit 0, all tests pass |
| Source-contract tests | `npx vitest run tests/new-item-sheet-ui-source.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/(app)/items/new-item-sheet/BulkItemForm.tsx`
- `src/app/api/bulk-skus/[id]/adjust/route.ts`
- `tests/api-hardening-wave11.test.ts`
- `tests/new-item-sheet-ui-source.test.ts`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`

**Out of scope**:
- Do not add a Units add-to-existing path to Add Item in this plan.
- Do not change `POST /api/bulk-skus/[id]/units`; it is already the unit-safe path.
- Do not change booking or kiosk scan behavior.

## Git workflow

- Branch: `advisor/049-quantity-existing-unit-family-guard`
- Commit style: conventional commit, for example `fix: block quantity adjustments for unit-tracked item families`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Filter the Quantity add-to-existing selector

In `BulkItemForm.tsx`, derive a `quantityOnlyBulkSkus` list from `existingBulkSkus.filter((sku) => !sku.trackByNumber)`.

Use that filtered list for:
- The empty state.
- `BulkSkuCombobox`.
- The selected SKU lookup.
- The stock preview.

Update empty copy from "No quantity items found. Create one first." only if needed, but keep the meaning quantity-specific.

**Verify**: `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0 after adding a source-contract assertion that the Quantity existing selector filters out `trackByNumber` SKUs.

### Step 2: Add a server-side guard to the adjustment route

In `src/app/api/bulk-skus/[id]/adjust/route.ts`, after loading `sku` and before reading balance, reject unit-tracked SKUs:

```ts
if (sku.trackByNumber) {
  throw new HttpError(400, "Use Add units for unit-tracked item families");
}
```

This keeps direct API calls from corrupting the unit-family model even if a future UI path forgets to filter.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Add route coverage

Extend `tests/api-hardening-wave11.test.ts` or add a focused adjust-route test if the existing mocks are too broad.

Test:
- `tx.bulkSku.findUnique` returns `{ id: "sku-1", locationId: "loc-1", trackByNumber: true }`.
- `POST /api/bulk-skus/sku-1/adjust` returns 400.
- The response error mentions unit-tracked item families or Add units.
- `bulkStockBalance.upsert` and `bulkStockMovement.create` are not called.

Keep the existing operational cap test intact.

**Verify**: `npx vitest run tests/api-hardening-wave11.test.ts` exits 0.

### Step 4: Sync docs

Update `docs/AREA_ITEMS.md` and `docs/AREA_BULK_INVENTORY.md` change logs.

Document:
- Quantity add-to-existing only targets quantity-tracked families.
- Unit-tracked family additions remain owned by Add units / Battery Ops / stockroom flows so each new count creates `BulkSkuUnit` rows.
- The generic adjust endpoint rejects unit-tracked SKUs.

**Verify**: `rg -n "unit-tracked|Quantity add|adjust endpoint|Change Log" docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md` shows the new entries.

## Test plan

- Source-contract test for client filtering in `tests/new-item-sheet-ui-source.test.ts`.
- Route test for the server guard in `tests/api-hardening-wave11.test.ts` or a new focused route test.
- `npx tsc --noEmit`.
- `git diff --check`.

## Done criteria

- [ ] Quantity add-to-existing selector excludes unit-tracked item families.
- [ ] `/api/bulk-skus/[id]/adjust` rejects `trackByNumber: true` SKUs before balance or movement writes.
- [ ] Unit additions remain handled through `/api/bulk-skus/[id]/units`.
- [ ] `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0.
- [ ] `npx vitest run tests/api-hardening-wave11.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 049 is updated.

## STOP conditions

Stop and report back if:

- `BulkSkuOption` no longer includes `trackByNumber`.
- The adjustment route has already been replaced by a shared service that enforces tracking mode.
- Fixing the bug requires changing Prisma schema or migration files.
- Existing tests reveal a deliberate product requirement to adjust unit-tracked families through `/adjust`.

## Maintenance notes

This plan protects the core D-022 split between quantity-only counts and unit-backed custody. A future "Units add to existing" Add Item flow is valid, but it must call `/api/bulk-skus/[id]/units` and collect an operator reason, not reuse the quantity adjustment endpoint.
