# Plan 054: Make item delete affordance match safety policy

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/(app)/items/[id]/_components/ItemHeader.tsx src/app/(app)/items/[id]/_hooks/use-item-actions.ts src/app/api/assets/[id]/route.ts tests/item-detail-actions-source.test.ts tests/asset-action-hardening.test.ts docs/AREA_ITEMS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 052
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

The server already protects item deletion inside a transaction. The UI still shows a disabled destructive `Delete` menu item when an item has booking history, which is technically safe but operationally weak: the documented policy says delete is allowed only for policy-safe records, and affected users should be steered to Retire instead. The action menu should make the safe action obvious and reserve Delete for records that can actually be deleted.

## Current state

- `docs/AREA_ITEMS.md` says the header action menu includes Duplicate, Retire, Delete, and Needs Maintenance, and Delete is allowed only for records with no linked booking history or active allocations.
- `ItemHeader.tsx` always renders Delete, disabling it when `hasBookingHistory` is true:

```tsx
// src/app/(app)/items/[id]/_components/ItemHeader.tsx:87-96
<DropdownMenuSeparator />
<DropdownMenuItem
  variant="destructive"
  disabled={disabled || asset.hasBookingHistory}
  title={asset.hasBookingHistory ? "Item has booking history. Use Retire instead." : "Permanently delete this item"}
  onSelect={() => onAction("delete")}
>
  Delete
</DropdownMenuItem>
```

- The delete handler still has the correct destructive confirmation and handles server rejection:

```ts
// src/app/(app)/items/[id]/_hooks/use-item-actions.ts:119-134
} else if (action === "delete") {
  const ok = await confirmDialog({
    title: "Delete item",
    message: "Permanently delete this item? This cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });
  if (!ok) return;
  const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
```

- The API transaction blocks booking history and active allocations:

```ts
// src/app/api/assets/[id]/route.ts:376-390
await db.$transaction(async (tx) => {
  const [bookingCount, activeAllocCount] = await Promise.all([
    tx.bookingSerializedItem.count({ where: { assetId: id } }),
    tx.assetAllocation.count({ where: { assetId: id, active: true } }),
  ]);

  if (bookingCount > 0 || activeAllocCount > 0) {
    throw new HttpError(
      409,
      "Cannot delete: this item has booking history. Use Retire instead."
    );
  }

  await tx.asset.delete({ where: { id } });
});
```

- Existing source tests can follow the pattern in `tests/item-bookable-policy-source.test.ts`, which reads source files and asserts key strings rather than rendering the whole page.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused source contract | `npx vitest run tests/item-detail-actions-source.test.ts` | exit 0, all tests pass |
| Existing action hardening | `npx vitest run tests/asset-action-hardening.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/(app)/items/[id]/_components/ItemHeader.tsx`
- `tests/item-detail-actions-source.test.ts`
- `docs/AREA_ITEMS.md`

**Out of scope**:
- Do not weaken or remove the API transaction guard in `src/app/api/assets/[id]/route.ts`.
- Do not change `use-item-actions.ts` delete confirmation unless the test shows it has drifted.
- Do not change bulk delete behavior.
- Do not add a new archive state; Retire is the existing safe path.

## Git workflow

- Branch: `advisor/054-item-delete-affordance-policy`
- Commit style: conventional commit, for example `fix: hide unsafe item delete actions`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Hide Delete when the item has booking history

In `ActionsMenu` in `ItemHeader.tsx`, render the destructive Delete menu item only when `!asset.hasBookingHistory`.

For items with booking history, do not render a disabled destructive row. The visible safe path should be the existing `Retire` menu item.

Keep the separator sensible:

- If Delete is rendered, include the separator before it.
- If Delete is hidden, avoid leaving a separator at the bottom of the menu.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Preserve the server-side safety net

Do not edit the API route unless tests fail because of unrelated drift. The route must continue to reject:

- Any booking history.
- Any active allocation.

This plan changes the affordance, not the authoritative guard.

**Verify**: `npx vitest run tests/asset-action-hardening.test.ts` exits 0.

### Step 3: Extend item-detail action source coverage

If plan 052 already created `tests/item-detail-actions-source.test.ts`, extend it. Otherwise create it.

Cover:

- `ItemHeader.tsx` conditionally renders Delete only when `!asset.hasBookingHistory`.
- The Delete menu item still uses `variant="destructive"`.
- The Retire menu item remains present.
- The API route still contains counts for both `bookingSerializedItem` and `assetAllocation` before deletion.
- The API error still mentions using Retire instead.

Keep assertions source-based and avoid brittle line-number checks.

**Verify**: `npx vitest run tests/item-detail-actions-source.test.ts` exits 0.

### Step 4: Sync docs

Update `docs/AREA_ITEMS.md` change log with a 2026-06-11 entry stating that item detail now hides Delete for items with booking history and leaves Retire as the visible safe lifecycle action, while the API keeps the transaction guard.

**Verify**: `rg -n "Delete|Retire|booking history|transaction guard|Change Log" docs/AREA_ITEMS.md` shows the new entry.

## Test plan

- Source-contract coverage in `tests/item-detail-actions-source.test.ts`.
- Existing action hardening in `tests/asset-action-hardening.test.ts`.
- `npx tsc --noEmit`.
- `git diff --check`.

## Done criteria

- [ ] Items with booking history do not render a Delete menu item.
- [ ] Items without booking history still render destructive Delete.
- [ ] Retire remains available in the action menu.
- [ ] API deletion still blocks booking history and active allocations.
- [ ] `npx vitest run tests/item-detail-actions-source.test.ts` exits 0.
- [ ] `npx vitest run tests/asset-action-hardening.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 054 is updated.

## STOP conditions

Stop and report back if:

- Product docs now require showing disabled destructive actions for blocked deletes.
- The API no longer has a transaction guard for delete safety.
- Retire has been removed or renamed.
- The action menu has moved out of `ItemHeader.tsx`.

## Maintenance notes

This plan intentionally keeps Delete available for clean, never-booked records. If future audit requirements demand no hard deletes at all, that should be a separate lifecycle policy plan touching API permissions, docs, and retention behavior.
