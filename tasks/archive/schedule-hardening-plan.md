# Schedule API hardening plan

Audit of schedule mutation flows (shift assignments, trades, shift edit/delete)
found the trade/swap lifecycle can violate custody trust when an assignment
changes underneath a posted trade, plus route-parity and validation gaps.

## Findings

### F1 (P0) -- Stale trade claim double-books a shift
`executeSwap` (shift-trades.ts) never re-checks that the posted assignment is
still active or that the shift wasn't refilled. Sequence: student posts trade →
staff removes the assignment (→ DECLINED, trade stays OPEN) → staff assigns
someone else → another student claims the stale trade → the DECLINED assignment
flips to SWAPPED and a **second active assignment** is created on the shift.

### F2 (P0) -- Inactive user can claim a trade
`claimTrade` selects the claimant without `active`; direct assignment and open
pickup both reject inactive users, trade claim does not.

### F3 (P0) -- Staff swap misses validations the trade swap has
`initiateSwap` (shift-assignments.ts): no target-user existence/active check
(missing user → FK P2003 → 500), no approved-time-off blocking check, no
advisory conflict note, and it strands OPEN/CLAIMED trades on the outgoing
assignment.

### F4 (P1) -- Removing an assignment leaves its trade live on the board
`removeAssignment` never cancels OPEN/CLAIMED trades for the assignment, so the
Trade Board keeps advertising a shift the poster no longer holds (feeds F1).

### F5 (P1) -- Standalone `DELETE /api/shifts/[id]` lacks the safe-delete contract
The nested `/api/shift-groups/[id]/shifts/[shiftId]` DELETE blocks staffed
shifts without `?force=true`, cancels trades, and audits the assignment count.
The standalone route (no web/iOS caller found) silently cascades all of it.
Also: the nested route's trade cancel misses `resolvedAt`.

### F6 (P2) -- Shift PATCH can invert the time window
`PATCH /api/shifts/[id]` validates start/end order only when both are provided;
updating only `startsAt` can move it past the existing `endsAt`.

### F7 (P2) -- `checkTimeConflict` `take: 10` false-negative edge
If 10+ rows match the raw-window prefilter but all fail the effective-window
recheck, a real 11th conflict is missed. Drop the cap (per-user, window-bounded
query -- small).

## Slices

- [x] S1: Trade swap integrity -- executeSwap requires active source assignment
      + no other active assignment on the shift; claimTrade rejects inactive
      claimants (F1, F2)
- [x] S2: Staff swap parity -- initiateSwap validates target user, blocks on
      approved time off, records advisory conflict note, cancels trades on the
      outgoing assignment (F3)
- [x] S3: removeAssignment cancels OPEN/CLAIMED trades in the same transaction (F4)
- [x] S4: Standalone shift DELETE gets force-guard + trade cancel + audit
      context; nested route cancel gains resolvedAt (F5)
- [x] S5: Shift PATCH merged-window validation; drop checkTimeConflict cap (F6, F7)
- [x] S6: Tests + build + docs sync

## Review

All slices shipped in one pass (small, interlocking service-layer edits).
Tests: extended `tests/shift-trades.test.ts` and `tests/shift-assignments.test.ts`
with stale-trade double-book, inactive-claimant, swap-parity, trade-cancel-on-
remove, and shift-route guard coverage; full suite + `npm run build` green.
