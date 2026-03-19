# Schedule Page Hardening Plan

## Audit Summary

The schedule/shift management feature has 17 API routes, 3 service files, and a 463-line page. Core issues:
- **CRITICAL**: Race conditions on trade claims and shift group creation
- **HIGH**: No shift time conflict detection (users can be double-booked)
- **HIGH**: Trade claims don't validate area eligibility
- **HIGH**: Trade swap can fail after marking COMPLETED
- **MEDIUM**: Silent error handling across all loaders
- **MEDIUM**: Coverage calculation inconsistency between page and API
- **MEDIUM**: Status constants duplicated in 4 places

## Scope

Fixes that **don't** require schema migrations or new features. Focus on correctness and reliability.

---

## Implementation Plan

### Slice 1: Shift conflict detection in services

**Files**: `src/lib/services/shift-assignments.ts`, `src/lib/services/shift-trades.ts`

- [ ] **1a. `directAssignShift()`**: Before creating assignment, query all active assignments for the target user that overlap with the shift's `startsAt/endsAt`. If overlap found, throw `HttpError(409, "User already has a shift during this time")`.
- [ ] **1b. `requestShift()`**: Same overlap check — prevent students from requesting shifts that conflict with their existing assignments.
- [ ] **1c. `claimTrade()` → `executeSwap()`**: Before executing swap, validate the claimant has no overlapping active assignments during the shift's time window.
- [ ] **1d. `initiateSwap()`**: Validate target user has no overlapping assignments.

Overlap query pattern:
```ts
const conflict = await tx.shiftAssignment.findFirst({
  where: {
    userId: targetUserId,
    status: { in: ACTIVE_STATUSES },
    shift: {
      startsAt: { lt: shift.endsAt },
      endsAt: { gt: shift.startsAt },
    },
    id: { not: excludeAssignmentId }, // exclude the assignment being swapped
  },
  include: { shift: true },
});
if (conflict) {
  throw new HttpError(409, `Conflicts with existing shift ${format(conflict.shift.startsAt)}`);
}
```

### Slice 2: Trade area eligibility validation

**Files**: `src/lib/services/shift-trades.ts`

- [ ] **2a. `claimTrade()`**: After checking trade status, verify claimant is eligible for the shift's area. Query `StudentAreaAssignment` (or equivalent) to confirm user can work in that `ShiftArea`.
- [ ] **2b.** If no area eligibility model exists, at minimum verify the claimant's role allows the worker type (FT vs ST) required by the shift.

### Slice 3: Race condition fixes

**Files**: `src/lib/services/shift-trades.ts`, `src/lib/services/shift-generation.ts`

- [ ] **3a. `claimTrade()`**: Move the status check inside a transaction. Re-fetch the trade within `db.$transaction()` and recheck `status === "OPEN"` after the re-fetch. If not OPEN, throw 409.
- [ ] **3b. `executeSwap()`**: Ensure swap execution is atomic — if any step fails, the entire transaction rolls back. Currently `executeSwap` is called inside `claimTrade`'s transaction, so verify the boundary is correct.
- [ ] **3c. `generateShiftsForEvent()`**: The existing transaction already wraps the creation, but add a recheck: `if (event.shiftGroupId)` inside the transaction after refetching the event.

### Slice 4: Trade swap failure handling

**Files**: `src/lib/services/shift-trades.ts`

- [ ] **4a.** In `claimTrade()` for non-approval trades: ensure `executeSwap()` is awaited and its result checked BEFORE marking trade as COMPLETED. If swap throws, the transaction should roll back (verify this is already the case since both are in the same `$transaction`).
- [ ] **4b.** Add explicit error propagation — if `executeSwap` fails, the trade should remain OPEN, not silently marked COMPLETED.

### Slice 5: UI error handling and loading states

**Files**: `src/app/(app)/schedule/page.tsx`, `src/components/ShiftDetailPanel.tsx`, `src/components/TradeBoard.tsx`

- [ ] **5a. Schedule page**: Add `loadError` state. On fetch failure, show error banner with retry button instead of silently showing stale data.
- [ ] **5b. ShiftDetailPanel**: Add error state to `fetchGroup()` and `loadRoster()`. Show inline error with retry.
- [ ] **5c. TradeBoard**: Add error state to `loadTrades()`. Show error card with retry.
- [ ] **5d.** After action handlers (assign, claim, approve), validate the reload succeeded. If not, show toast warning "Action succeeded but display may be stale — tap to refresh".

### Slice 6: Coverage calculation consistency

**Files**: `src/app/(app)/schedule/page.tsx`

- [ ] **6a.** Fix `areaCoverage()` to only count assignments with status in `ACTIVE_STATUSES` (`DIRECT_ASSIGNED`, `APPROVED`), matching the API's calculation.

### Slice 7: Status constants dedup

**Files**: `src/lib/constants.ts` (new or existing), update imports in `shift-assignments.ts`, `shift-trades.ts`, `shift-groups/route.ts`, `schedule/page.tsx`

- [ ] **7a.** Create/add `ACTIVE_ASSIGNMENT_STATUSES` constant in a shared location.
- [ ] **7b.** Replace all inline/local definitions with the shared import.

---

## Out of Scope (future work)

- Trade SLA/timeout with escalation notifications
- Soft delete for shifts (requires schema change)
- Bulk assignment operations
- Timezone handling (needs broader investigation)
- Premier event immutability flag
- Booking/shift time mismatch validation

## Verification

- `npm run build` must pass
- `npm test` must pass
- Manual review: each service function has conflict/validation guard
