# Plan 018: Make a resumed kiosk pickup completable instead of a dead end

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e4b35ae..HEAD -- src/app/api/kiosk/checkout/[id]/route.ts ios/Wisconsin/Kiosk/KioskPickupView.swift tests/kiosk-bulk-detail-routes.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e4b35ae`, 2026-06-13

## Why this matters

A kiosk pickup scan **commits immediately and independently of the final "Confirm Pickup" press**: a battery scan writes the unit allocation, flips the unit to `CHECKED_OUT`, and increments `checkedOutQuantity` (`src/lib/services/bulk-unit-scans.ts:208-223`); a serialized scan writes a successful `CHECKOUT`-phase `ScanEvent` (`src/app/api/kiosk/pickup/[id]/scan/route.ts:94-105`). But when the pickup screen reloads, the checkout-detail endpoint's `PENDING_PICKUP` branch renders battery rows as generic placeholders that ignore existing allocations, and serialized rows expose no "already scanned" signal at all. The iOS pickup view starts `confirmedIds = []` on every load and never seeds from server progress.

Net effect: if a student scans some items and then walks away or taps Back (kiosk idle/abandon is routine), the partial state persists. On the next attempt every already-scanned item rejects re-scan as `"already scanned"` (so it never enters `confirmedIds`), while the Confirm button stays disabled on `!allConfirmed`. The student **cannot complete the pickup**, and there is no recovery: the expiry cron does not reset progress -- it only fires once the booking's `startsAt` passes the no-show window and then **cancels the whole booking** (`src/lib/services/pending-pickup-expiry.ts:91-103`). The return flow already solved exactly this: its detail endpoint sets `returned` per item and `KioskReturnView` seeds `returnedIds` from it on load. This plan brings the pickup flow to the same standard.

## Current state

### File 1 -- `src/app/api/kiosk/checkout/[id]/route.ts` (the detail endpoint, shared by pickup + return)

The booking query selects `serializedItems`, `bulkItems` (with `unitAllocations` ordered by `checkedOutAt asc`, selecting `checkedInAt` and `bulkSkuUnit {id, unitNumber}`), but **does not select `scanEvents`**.

Serialized rows (lines 64-70) -- `returned` is computed the same way regardless of booking status:

```ts
const serializedItems = booking.serializedItems.map((si) => ({
  id: si.asset.id,
  tagName: si.asset.assetTag,
  name: si.asset.name || si.asset.assetTag,
  returned: si.allocationStatus === "returned",
  type: "serialized" as const,
}));
```

Battery rows (lines 72-96) -- the `PENDING_PICKUP` branch builds placeholder slots that ignore `unitAllocations` and `checkedOutQuantity`:

```ts
const bulkItems = booking.status === "PENDING_PICKUP"
  ? booking.bulkItems.flatMap((bi) =>
      Array.from({ length: bi.plannedQuantity }, (_, index) => ({
        id: `${bi.id}:slot:${index + 1}`,
        tagName: `#${index + 1}`,
        name: `${bi.bulkSku.name} ${index + 1}`,
        returned: false,
        type: "numbered_bulk" as const,
        bulkSkuId: bi.bulkSku.id,
        bulkSkuName: bi.bulkSku.name,
        unitNumber: null,
      }))
    )
  : booking.bulkItems.flatMap((bi) =>
      bi.unitAllocations.map((allocation) => ({
        id: allocation.bulkSkuUnit.id,
        tagName: `#${allocation.bulkSkuUnit.unitNumber}`,
        name: `${bi.bulkSku.name} #${allocation.bulkSkuUnit.unitNumber}`,
        returned: !!allocation.checkedInAt,
        type: "numbered_bulk" as const,
        bulkSkuId: bi.bulkSku.id,
        bulkSkuName: bi.bulkSku.name,
        unitNumber: allocation.bulkSkuUnit.unitNumber,
      }))
    );
```

**Key fact about slot ordering**: the scan service returns a freshly scanned battery's id as `` `${bulkItem.id}:slot:${checkedOutQuantity + 1}` `` using the DB `checkedOutQuantity` *before* the increment (`src/lib/services/bulk-unit-scans.ts:189,229`). So the first physical unit scanned maps to `slot:1`, the second to `slot:2`, in `checkedOutAt asc` order. The fix must preserve this mapping: the first `N` already-checked-out units fill `slot:1..N`, and the next live scan (which returns `slot:N+1`) lands on the first still-empty slot.

### File 2 -- `ios/Wisconsin/Kiosk/KioskPickupView.swift`

`confirmedIds` starts empty (line 11) and `loadDetail()` never seeds it (lines 373-382):

```swift
@State private var confirmedIds: Set<String> = []
...
private func loadDetail() async {
    isLoading = true
    error = nil
    do {
        detail = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
    } catch {
        self.error = (error as? APIError)?.errorDescription ?? "Could not load pickup details."
    }
    isLoading = false
}
```

### Exemplar to copy -- `ios/Wisconsin/Kiosk/KioskReturnView.swift:379-388`

The return view already does exactly what pickup is missing:

```swift
private func loadDetail() async {
    ...
        let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
        ...
        for item in loaded.items where item.returned {
            returnedIds.insert(item.id)
        }
    ...
}
```

`KioskCheckoutDetail.ReturnItem` already has a `returned: Bool` field (`ios/Wisconsin/Kiosk/KioskModels.swift:253-264`); the pickup view simply ignores it today. `KioskScanResult.ScannedItem` (same file, lines 228-233) has stored props `id, name, tagName, type` with no custom initializer, so Swift synthesizes a memberwise `init` you can call.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused route tests | `npx vitest run tests/kiosk-bulk-detail-routes.test.ts` | all pass |
| Type gate | `npx tsc --noEmit` | exit 0, no errors |
| iOS drift gate | `npm run drift:ios` | exit 0 |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |

Note: `npm run build` runs `prisma migrate deploy` first and needs `DIRECT_URL`/`DATABASE_URL` set; for a type-only check prefer `npx tsc --noEmit`. There is no Xcode/`xcodebuild` in this environment, so the Swift change is verified by source inspection + `drift:ios`, **not** a real compile -- flag it as "needs an iOS build check before merge" in your summary.

## Scope

**In scope** (the only files you may modify):

- `src/app/api/kiosk/checkout/[id]/route.ts` -- the `PENDING_PICKUP` paths only (serialized `returned`, battery filled slots, and adding `scanEvents` to the query).
- `ios/Wisconsin/Kiosk/KioskPickupView.swift` -- the `loadDetail()` seeding only.
- `tests/kiosk-bulk-detail-routes.test.ts` -- new cases + add `scanEvents: []` to existing detail-GET fixtures.

**Out of scope** (do NOT touch, even though they look related):

- The non-`PENDING_PICKUP` (return) branch of the detail route -- it already seeds correctly; changing it risks regressing the return flow.
- The empty-slot placeholder name `` `${bi.bulkSku.name} ${index + 1}` `` (no `#`). Leave it byte-identical; an existing test pins it (`tests/kiosk-bulk-detail-routes.test.ts:124` expects `"Sony Battery 1"`). Only the **filled** slots get the `#${unitNumber}` name.
- `ios/Wisconsin/Kiosk/KioskReturnView.swift` -- exemplar only, do not edit.
- `src/app/api/kiosk/pickup/[id]/scan/route.ts` and `.../confirm/route.ts` -- unchanged.
- Any Prisma schema / migration -- none is needed; all required relations are already selected.

## Git workflow

- Branch: `improve-exec/018-kiosk-pickup-resume` (fresh from `main` HEAD; do NOT reuse any `codex/*` or `advisor/*` branch).
- Conventional commits, e.g. `fix: resumed kiosk pickup no longer dead-ends when items were already scanned`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Select `scanEvents` and make serialized `returned` reflect pickup progress

In `src/app/api/kiosk/checkout/[id]/route.ts`, add a `scanEvents` selection to the booking query (place it alongside `serializedItems`/`bulkItems` in the top-level `select`), matching how the confirm route selects them:

```ts
scanEvents: {
  where: { success: true, phase: "CHECKOUT", assetId: { not: null } },
  select: { assetId: true },
},
```

Then change the serialized mapping so `returned` is status-aware (pickup uses scan progress; everything else keeps the allocation-status meaning):

```ts
const scannedAssetIds = new Set(booking.scanEvents.map((event) => event.assetId));
const serializedItems = booking.serializedItems.map((si) => ({
  id: si.asset.id,
  tagName: si.asset.assetTag,
  name: si.asset.name || si.asset.assetTag,
  returned:
    booking.status === "PENDING_PICKUP"
      ? scannedAssetIds.has(si.asset.id)
      : si.allocationStatus === "returned",
  type: "serialized" as const,
}));
```

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Fill already-checked-out battery slots in the `PENDING_PICKUP` branch

Replace the `PENDING_PICKUP` arm of the `bulkItems` ternary (the first branch only; leave the `else` return-flow branch unchanged) with one that fills the first slots from real allocations and keeps the rest as placeholders:

```ts
const bulkItems = booking.status === "PENDING_PICKUP"
  ? booking.bulkItems.flatMap((bi) => {
      // Units already checked out for this pickup, in scan order (checkedOutAt asc).
      // This count equals checkedOutQuantity and maps unit -> slot:1..N, matching
      // the slot ids the scan route returns for live scans.
      const pickedUnits = bi.unitAllocations.filter((allocation) => !allocation.checkedInAt);
      return Array.from({ length: bi.plannedQuantity }, (_, index) => {
        const alloc = pickedUnits[index];
        if (alloc) {
          return {
            id: `${bi.id}:slot:${index + 1}`,
            tagName: `#${alloc.bulkSkuUnit.unitNumber}`,
            name: `${bi.bulkSku.name} #${alloc.bulkSkuUnit.unitNumber}`,
            returned: true,
            type: "numbered_bulk" as const,
            bulkSkuId: bi.bulkSku.id,
            bulkSkuName: bi.bulkSku.name,
            unitNumber: alloc.bulkSkuUnit.unitNumber,
          };
        }
        return {
          id: `${bi.id}:slot:${index + 1}`,
          tagName: `#${index + 1}`,
          name: `${bi.bulkSku.name} ${index + 1}`,
          returned: false,
          type: "numbered_bulk" as const,
          bulkSkuId: bi.bulkSku.id,
          bulkSkuName: bi.bulkSku.name,
          unitNumber: null,
        };
      });
    })
  : booking.bulkItems.flatMap((bi) =>
      /* unchanged return-flow branch */
    );
```

Leave `scanSummary` and `numberedBulkCompleted` as they are -- they already reflect `checkedOutQuantity` correctly.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Seed the iOS pickup checklist from server progress

In `ios/Wisconsin/Kiosk/KioskPickupView.swift`, change `loadDetail()` to seed `confirmedIds` (and overrides so already-picked battery units render with their real unit number) from items the server marks `returned`, mirroring `KioskReturnView`:

```swift
private func loadDetail() async {
    isLoading = true
    error = nil
    do {
        let loaded = try await KioskAPI.shared.kioskCheckoutDetail(id: bookingId)
        detail = loaded
        // Seed already-picked-up items. A resumed pickup re-rejects every
        // already-scanned item as "already scanned", so without this the
        // Confirm button could never enable. Mirrors KioskReturnView.
        for item in loaded.items where item.returned {
            confirmedIds.insert(item.id)
            confirmedItemOverrides[item.id] = KioskScanResult.ScannedItem(
                id: item.id,
                name: item.name,
                tagName: item.tagName,
                type: item.type
            )
        }
    } catch {
        self.error = (error as? APIError)?.errorDescription ?? "Could not load pickup details."
    }
    isLoading = false
}
```

**Verify**: `npm run drift:ios` exits 0. Confirm by inspection that `confirmedIds.insert` now appears inside `loadDetail()` (`grep -n "confirmedIds.insert" ios/Wisconsin/Kiosk/KioskPickupView.swift` returns at least one match inside `loadDetail`, plus the existing one in `handleScan`).

### Step 4: Tests

In `tests/kiosk-bulk-detail-routes.test.ts`:

1. **Unblock existing fixtures**: add `scanEvents: []` to the `mocks.bookingFindUnique.mockResolvedValue({...})` objects used by the two existing detail-GET tests (`"includes pending pickup battery quantity as scan checklist slots"` at line ~92 and `"includes checked-out battery units in return detail"` at line ~149). Without this, `booking.scanEvents.map(...)` throws on those tests.

2. **New case -- battery resume**: in the `describe("kiosk checkout detail bulk units", ...)` block, add a test where `status: "PENDING_PICKUP"`, `plannedQuantity: 2`, `checkedOutQuantity: 1`, and `unitAllocations: [{ checkedInAt: null, bulkSkuUnit: { id: "unit-7", unitNumber: 7 } }]`. Assert `json.items[0]` is `{ id: "bulk-item-1:slot:1", tagName: "#7", name: "<sku> #7", returned: true, ..., unitNumber: 7 }` and `json.items[1]` is the empty `slot:2` with `returned: false, unitNumber: null`.

3. **New case -- serialized resume**: a `PENDING_PICKUP` booking with one serialized item (`asset: { id: "a1", assetTag: "CAM-1", name: "Camera" }`, `allocationStatus: "pending"`) and `scanEvents: [{ assetId: "a1" }]`. Assert that serialized item comes back `returned: true`. Add a sibling assertion (or second test) with `scanEvents: []` asserting `returned: false`.

Use the existing `it("includes pending pickup battery quantity as scan checklist slots")` as the structural pattern (same mock shape, same `getKioskCheckoutDetail` call).

**Verify**: `npx vitest run tests/kiosk-bulk-detail-routes.test.ts` -> all pass, including the new cases.

### Step 5: Full verification + doc sync

Add a change-log row to `docs/AREA_KIOSK.md` noting that resumed/partial kiosk pickups now reload their scanned progress instead of dead-ending (this doc edit is permitted for this step).

**Verify**: `npm run test` exit 0; `npm run lint` exit 0; `npm run drift:ios` exit 0.

## Test plan

- New server tests in `tests/kiosk-bulk-detail-routes.test.ts` (model after the existing `"includes pending pickup battery quantity as scan checklist slots"`):
  - battery: already-checked-out slot reports `returned: true` with the real `unitNumber`; remaining slots stay `returned: false`.
  - serialized: `returned: true` iff a successful `CHECKOUT`-phase `ScanEvent` exists for the asset (one positive, one negative).
- The iOS seeding has no compile/runtime gate in this environment; it is verified by source inspection against the `KioskReturnView` exemplar and `npm run drift:ios`. The maintenance note flags the required build check.
- Regression guard: the two existing detail-GET tests must still pass after the `scanEvents: []` fixture additions, proving the return-flow branch is unchanged.

## Done criteria

ALL must hold:

- [ ] `grep -n "scanEvents" src/app/api/kiosk/checkout/[id]/route.ts` shows the new selection
- [ ] `grep -n "confirmedIds.insert" ios/Wisconsin/Kiosk/KioskPickupView.swift` matches inside `loadDetail()` (in addition to the existing `handleScan` match)
- [ ] The empty-slot name string `` `${bi.bulkSku.name} ${index + 1}` `` is still present (placeholder naming unchanged)
- [ ] `npx vitest run tests/kiosk-bulk-detail-routes.test.ts` exits 0, including 2+ new cases
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test` exits 0; `npm run lint` exits 0; `npm run drift:ios` exits 0
- [ ] No files modified outside the in-scope list plus `docs/AREA_KIOSK.md` (`git status`)
- [ ] `plans/README.md` status row for 018 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The detail route or `KioskPickupView.swift` no longer matches the "Current state" excerpts (drift since this plan was written).
- The booking query's `bulkItems.unitAllocations` no longer selects `checkedInAt` and `bulkSkuUnit.unitNumber`, or is no longer ordered by `checkedOutAt asc` -- the slot mapping in Step 2 depends on both.
- `KioskScanResult.ScannedItem` has gained a custom initializer (the synthesized memberwise `init` in Step 3 would no longer exist) -- report rather than adding an init.
- A new-case test fails twice after a reasonable fix attempt, or any previously-passing test in this file regresses and you cannot trace it to the `scanEvents` fixture addition.
- You find the assumption "every PENDING_PICKUP `unitAllocation` represents a currently-checked-out unit (checkedInAt null), and their count equals `checkedOutQuantity`" is false in real data.

## Maintenance notes

For whoever owns this after it lands:

- **iOS build check required before merge**: this environment has no Xcode. Compile `KioskPickupView.swift` and visually confirm that reopening a partially-scanned pickup shows the already-scanned items pre-checked and the Confirm button enabled once the rest are scanned. (iOS is the day-to-day ops surface for this flow.)
- The fix overloads the shared `returned` field to mean "already picked up" inside the `PENDING_PICKUP` branch. It is mechanically safe because the pickup view previously ignored `returned`, but if pickup ever needs to distinguish "picked up" from "returned" on the same payload, add a dedicated flag rather than overloading further.
- The slot<->unit mapping assumes scan order equals `checkedOutAt asc`. If the scan service (`src/lib/services/bulk-unit-scans.ts`) ever changes how it assigns `:slot:N` ids, Step 2's ordering must be revisited in lockstep.
- A reviewer should scrutinize that the **return** branch of the detail route is byte-unchanged and that the two pre-existing detail tests still pass -- that is the regression boundary.
