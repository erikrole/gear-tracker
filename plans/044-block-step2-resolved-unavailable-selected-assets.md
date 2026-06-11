# Plan 044: Block Step 2 resolved unavailable selected assets

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/EquipmentPicker.tsx src/components/booking-wizard/BookingWizard.tsx src/components/booking-wizard/WizardStep2.tsx src/components/booking-wizard/flow-summary.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 2 has stale-selection recovery for unresolved selected asset IDs, but not for selected assets that successfully resolve and now have `computedStatus !== "AVAILABLE"`. That can happen when resuming a draft or opening a deep link after another booking claimed the item. The picker can count that asset as selected, allow review, and only fail later at submit.

The flow should catch that in Step 2, where the user can see and remove the affected item.

## Current state

Resolved selected assets are all sent to the wizard parent:

```ts
// src/components/EquipmentPicker.tsx:390-403
const resolvedSelectedAssets = useMemo(() => {
  return selectedAssetIds
    .map((id) => selectedAssetsCache.get(id) ?? assetById.get(id))
    .filter((a): a is PickerAsset => !!a);
}, [selectedAssetIds, assetById, selectedAssetsCache, cacheVersion]);

useEffect(() => {
  if (!onSelectedAssetsChange) return;
  onSelectedAssetsChange(resolvedSelectedAssets);
}, [resolvedSelectedAssets, onSelectedAssetsChange]);
```

Only missing IDs become `unresolvedAssetCount`:

```ts
// src/components/EquipmentPicker.tsx:395-397
const unresolvedSelectedAssetIds = useMemo(() => {
  return selectedAssetIds.filter((id) => !assetById.has(id) && !selectedAssetsCache.has(id));
}, [assetById, selectedAssetIds, selectedAssetsCache, cacheVersion]);
```

Rows treat unavailable assets as unavailable only if they are not selected:

```ts
// src/components/EquipmentPicker.tsx:789-807
const isAvailable = asset.computedStatus === "AVAILABLE";
const isUnavailable = !isAvailable && !isSelected;

<Checkbox
  checked={isSelected}
  disabled={isUnavailable}
  onCheckedChange={() => toggleAsset(asset.id, asset)}
```

Step 2 blocks only unresolved selected IDs:

```ts
// src/components/booking-wizard/BookingWizard.tsx:337-340
if (itemCount === 0 && pickerSelectionState.unresolvedAssetCount > 0) {
  setCreateError("Remove unavailable selected items or pick replacement equipment before review");
  return;
}
```

Docs already state stale unresolved selections should not count toward readiness:

```md
docs/AREA_CHECKOUTS.md:367
Booking creation now surfaces unresolved deep-linked or draft asset IDs as removable unavailable rows, and unresolved serialized assets no longer count toward review readiness, confirmation totals, draft saves, or create payloads.
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused UX tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/components/EquipmentPicker.tsx`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep2.tsx`
- `src/components/booking-wizard/flow-summary.ts`
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Changing server-side create validation
- Changing scan-to-add rejection behavior
- Changing conflict-warning override policy for otherwise available assets
- Changing bulk SKU count recovery beyond status/counting needed by this plan

## Steps

### Step 1: Add selected-unavailable status to picker state

Extend `EquipmentPickerSelectionState` with a count for resolved selected assets whose `computedStatus !== "AVAILABLE"`. Suggested name:

```ts
unavailableSelectedAssetCount: number;
```

Compute it from `resolvedSelectedAssets`.

Do not include selected assets with availability conflicts from `/api/availability/check`; conflicts remain selectable warnings. This count is only for current derived status such as `CHECKED_OUT`, `PENDING_PICKUP`, `RESERVED`, `MAINTENANCE`, or `RETIRED`.

Verify: `npx tsc --noEmit` exits 0.

### Step 2: Render selected unavailable assets as recovery items

In `EquipmentPicker.tsx`:

- For selected rows with `computedStatus !== "AVAILABLE"`, show the derived status or holder context.
- Keep the remove checkbox/button enabled so the user can fix the selection.
- In the selected shelf, show a visible warning badge on those chips.

Do not hide selected unavailable rows behind the "Available only" filter if they are already selected and cached. The user needs a way to remove them.

Verify: add a source-contract test that fails if `isUnavailable` is defined only as `!isAvailable && !isSelected`.

### Step 3: Block review while selected unavailable assets remain

Update `BookingWizard` Step 2 navigation and `flow-summary.ts` so:

- The primary label says "Remove unavailable item" or "Remove unavailable items" when either unresolved IDs or resolved unavailable selected assets exist.
- `handleNext` blocks review while resolved unavailable selected assets remain.
- `WizardStep2` summary includes those assets in the unavailable count and copy.

Keep conflict and next-use warnings reviewable. Only unavailable current status should block.

Verify: `tests/booking-create-ux.test.ts` covers the new count in `getStep2PrimaryActionLabel`.

### Step 4: Update docs

Add checkout and reservation changelog rows noting that Step 2 now blocks both unresolved selected IDs and resolved selected assets that are no longer available.

## Done criteria

- [ ] Resolved selected assets with non-AVAILABLE computed status are visibly marked in Step 2.
- [ ] Those assets can be removed from the row or selected shelf.
- [ ] They do not count as valid review-ready equipment.
- [ ] The Step 2 primary action and status summary tell the user to remove unavailable items.
- [ ] Conflict-warning rows for otherwise available assets remain selectable and reviewable.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.

## STOP conditions

- Stop if the fix requires changing server create behavior instead of client Step 2 readiness.
- Stop if there is ambiguity between current derived status and time-window conflict warnings. Do not block conflict warnings in this plan.

## Maintenance notes

This plan tightens creation recovery only. The server must still reject unavailable assets authoritatively because client state can be stale.
