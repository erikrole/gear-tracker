# Cross-Cutting Security & Data Integrity Audit

**Date**: 2026-03-30
**Auditor**: Claude (automated)
**Area**: Cross-cutting — transaction safety, CSRF, race conditions, data integrity
**Overall Verdict**: Nearly ready (18/25)

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | Platform invariants (D-001, D-006, D-007) are crystal clear. NORTH_STAR explicitly calls out "Integrity Before Velocity" as non-negotiable. |
| Hardening | 3/5 | Core booking/scan paths are hardened with SERIALIZABLE. But **15+ shift/trade transactions lack isolation**, 4 documented bugs remain open, and CSRF has a bypass. |
| Roadmap | 3/5 | Security work tracked ad-hoc in `tasks/todo.md` and `GAPS_AND_RISKS.md`. No dedicated security roadmap or checklist. |
| Feature completeness | 4/5 | All core integrity features shipped (derived status, audit logging, overlap prevention). GAP-27 (reports partial failure) is the only open feature gap. |
| Doc sync | 3/5 | Bugs are documented in todo.md with proof tests. But shift-assignments.ts isolation gaps (15+ functions) are NOT tracked in GAPS_AND_RISKS.md. |

---

## Bug Inventory (4 Known + Newly Discovered)

### BUG-1: `claimTrade()` missing SERIALIZABLE (DOCUMENTED)

**File**: `src/lib/services/shift-trades.ts:72`
**Severity**: HIGH — double-claim race condition
**Test**: `tests/shift-trades.test.ts:149-162`

The `claimTrade()` function wraps its logic in `db.$transaction()` but specifies **no isolation level**, defaulting to READ COMMITTED. Two concurrent claims can both read the trade as "OPEN", both pass validation, and both execute the swap — resulting in a double-claimed shift.

**Root cause**: Missing `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }` on the transaction call.

**Fix**: Add SERIALIZABLE isolation to the `db.$transaction()` call at line 72.

---

### BUG-2: Bulk scan TOCTOU — quantity guard outside transaction (DOCUMENTED)

**File**: `src/lib/services/scans.ts:262-309`
**Severity**: HIGH — inventory overflow
**Test**: `tests/bulk-scan-race.test.ts:65-106`

For standard (non-numbered) bulk scans, the quantity guard check at lines 268-276 reads `bulkItem.checkedOutQuantity` from data fetched in the **first** SERIALIZABLE transaction (line 58-137), but the increment happens in a **second** transaction (line 278-307) that has **no isolation level**.

Race window:
1. Thread A reads `checkedOutQuantity = 8` (max 10) — passes guard
2. Thread B reads `checkedOutQuantity = 8` (max 10) — passes guard
3. Thread A increments to 13
4. Thread B increments to 18 — exceeds planned quantity

**Root cause**: Quantity guard runs between two transactions. The second transaction lacks SERIALIZABLE isolation.

**Fix**: Either (a) move the quantity guard inside the second transaction with SERIALIZABLE, or (b) merge both transactions into one SERIALIZABLE transaction for the bulk path.

---

### BUG-3: `markCheckoutCompleted` double-return (DOCUMENTED)

**File**: `src/lib/services/bookings.ts:703-706`
**Severity**: MEDIUM — inventory count corruption
**Test**: `tests/mark-checkout-completed.test.ts:147-171`

When completing a checkout, the function returns bulk items to stock using:
```typescript
const checkinItems = booking.bulkItems.map((item) => ({
  bulkSkuId: item.bulkSkuId,
  quantity: item.checkedOutQuantity ?? item.plannedQuantity
}));
```

This ignores `checkedInQuantity` — items already returned via partial check-in. If 10 items were checked out and 5 already returned, it returns all 10 again, double-returning 5 units.

**Root cause**: Missing subtraction of `checkedInQuantity`.

**Fix**: Change to `quantity: (item.checkedOutQuantity ?? item.plannedQuantity) - (item.checkedInQuantity ?? 0)`.

---

### BUG-4: CSRF bypass with missing Origin header (DOCUMENTED)

**File**: `src/lib/api.ts:30-38`
**Severity**: HIGH — security bypass
**Test**: `tests/api-wrapper.test.ts:140-154`

The CSRF check in `withAuth` only validates Origin when the header is **present**. If Origin is completely absent, the check is skipped entirely. While modern browsers typically send Origin on POST requests, some edge cases (bookmarklets, older HTTP clients, certain redirect flows) may omit it.

```typescript
if (origin) {                    // ← if null, entire block skipped
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const expected = host ? new URL(`https://${host}`).origin : null;
  if (expected && origin !== expected) {
    throw new HttpError(403, "Cross-origin request blocked");
  }
}
```

**Root cause**: Missing `else` branch to block requests without Origin on mutating methods.

**Fix**: Add: if `!origin` on POST/PUT/PATCH/DELETE, throw 403. Exempt internal routes (cron) that use CRON_SECRET auth instead.

---

### BUG-5: ALL shift-trades.ts functions missing SERIALIZABLE (NEWLY FOUND)

**File**: `src/lib/services/shift-trades.ts`
**Severity**: MEDIUM-HIGH — affects 5 functions
**Functions**: `postTrade()` (line 16), `claimTrade()` (line 72), `approveTrade()` (line 157), `declineTrade()` (line 186), `cancelTrade()` (line 208)

None of these transaction calls specify an isolation level. While `claimTrade` is the most critical (BUG-1), the others also have race windows:

- **`postTrade()`**: Concurrent calls could both pass the "no existing open trade" check and create duplicate trades.
- **`approveTrade()`**: Concurrent approvals could both execute `executeSwap()`, double-swapping.
- **`declineTrade()`**: Concurrent declines could both succeed on the same trade (low impact but violates D-006).
- **`cancelTrade()`**: Same pattern as decline.

---

### BUG-6: ALL shift-assignments.ts functions missing SERIALIZABLE (NEWLY FOUND)

**File**: `src/lib/services/shift-assignments.ts`
**Severity**: MEDIUM — affects 6 functions
**Functions**: `directAssignShift()` (line 50), `requestShift()` (line 84), `approveRequest()` (line 130), `declineRequest()` (line 161), `initiateSwap()` (line 183), `removeAssignment()` (line 222)

All use `db.$transaction()` without isolation level. Key risks:

- **`directAssignShift()`**: Two concurrent assigns to the same shift could both pass the "no existing active assignment" check. **Double-booking risk.**
- **`requestShift()`**: Two students could both pass the "already requested" check. Creates duplicate requests.
- **`approveRequest()`**: Concurrent approvals decline other requests then approve — could approve two requests for the same shift.
- **`initiateSwap()`**: Two concurrent swaps of the same assignment could both succeed.

---

### BUG-7: `generateShiftsForEvent()` missing SERIALIZABLE (NEWLY FOUND)

**File**: `src/lib/services/shift-generation.ts:67`
**Severity**: LOW-MEDIUM — mitigated by idempotency re-check inside transaction

The function does an outer read (lines 23-35) and re-checks inside the transaction (lines 69-74). However, without SERIALIZABLE, the re-check could still see stale data under READ COMMITTED if another transaction is creating the shift group concurrently.

**Mitigating factor**: The idempotency re-check pattern is present and mostly protects against duplicates in practice.

---

## GAP-27: Reports `Promise.all` Partial Failure

**File**: `src/app/api/reports/route.ts:48, 100, 288, 344`
**Severity**: LOW — read-only, affects UX only
**Status**: Open in GAPS_AND_RISKS.md

Four `Promise.all` calls in report functions. If any single query fails (timeout, connection error), the entire report returns 500 with no partial data.

**Current impact**: Low — all queries hit the same database, so if one fails they likely all fail. But under load, a slow `countAssetsByEffectiveStatus()` could timeout while simpler `db.asset.count()` succeeds.

**Fix**: Switch to `Promise.allSettled()` and return partial data with error indicators for failed sections.

---

## Transaction Safety Audit (Complete Inventory)

### Functions WITH SERIALIZABLE (correct) — 15 functions

| File | Function | Line |
|---|---|---|
| `services/bookings.ts` | `createBooking()` | 314 |
| `services/bookings.ts` | `updateReservation()` | 476 |
| `services/bookings.ts` | `cancelReservation()` | 632 |
| `services/bookings.ts` | `markCheckoutCompleted()` | 673 |
| `services/bookings.ts` | `updateCheckout()` | 740 |
| `services/bookings.ts` | `extendBooking()` | 892 |
| `services/bookings.ts` | `cancelBooking()` | 970 |
| `services/bookings.ts` | `checkinItems()` | 1015 |
| `services/bookings.ts` | `bulkCheckinBulkItems()` | 1170 |
| `services/bookings.ts` | `decrementBulkItem()` | 1251 |
| `services/scans.ts` | `recordScan()` (first tx) | 137 |
| `services/scans.ts` | `recordBulkUnitScan()` | 257 |
| `services/scans.ts` | `completeCheckoutScan()` | 441 |
| `services/scans.ts` | `completeCheckinScan()` | 476 |
| `api/bulk-skus/[id]/adjust/route.ts` | bulk adjust | 63 |

### Functions WITHOUT SERIALIZABLE (need fix) — 18+ functions

| File | Function | Line | Risk Level |
|---|---|---|---|
| `services/shift-trades.ts` | `postTrade()` | 16 | MEDIUM (duplicate trade) |
| `services/shift-trades.ts` | `claimTrade()` | 72 | **HIGH** (double-claim) |
| `services/shift-trades.ts` | `approveTrade()` | 157 | **HIGH** (double-swap) |
| `services/shift-trades.ts` | `declineTrade()` | 186 | LOW |
| `services/shift-trades.ts` | `cancelTrade()` | 208 | LOW |
| `services/shift-assignments.ts` | `directAssignShift()` | 50 | **HIGH** (double-book) |
| `services/shift-assignments.ts` | `requestShift()` | 84 | MEDIUM (duplicate request) |
| `services/shift-assignments.ts` | `approveRequest()` | 130 | **HIGH** (double-approve) |
| `services/shift-assignments.ts` | `declineRequest()` | 161 | LOW |
| `services/shift-assignments.ts` | `initiateSwap()` | 183 | MEDIUM |
| `services/shift-assignments.ts` | `removeAssignment()` | 222 | LOW |
| `services/shift-generation.ts` | `generateShiftsForEvent()` | 67 | LOW (mitigated) |
| `api/calendar-sources/[id]/route.ts` | DELETE handler | 47 | LOW |
| `api/bulk-skus/[id]/convert-to-numbered/route.ts` | convert | 17 | MEDIUM |
| `api/bulk-skus/[id]/units/[unitNumber]/route.ts` | update unit | 17 | LOW |
| `api/bulk-skus/[id]/units/route.ts` | add units | 28 | LOW |
| `api/bulk-skus/route.ts` | create SKU | 32 | LOW |
| `api/drafts/route.ts` | update/create draft | 82, 109 | LOW |

---

## CSRF Audit

**Implementation**: `src/lib/api.ts:24-47` — `withAuth()` wrapper

| Check | Status | Notes |
|---|---|---|
| Origin header validated on POST/PUT/PATCH/DELETE | PASS | Lines 30-38 |
| Mismatch Origin is blocked (403) | PASS | Line 36 |
| Missing Origin is blocked | **FAIL** | BUG-4: skipped entirely |
| All mutation endpoints use `withAuth` | PASS | 122 endpoints verified |
| Public routes (`withHandler`) don't allow mutations | PASS | Only used for auth + public reads |
| CRON routes use secret-based auth | PASS | `CRON_SECRET` comparison |

---

## Platform Invariant Compliance

| Invariant | Decision | Status | Notes |
|---|---|---|---|
| Derived status | D-001 | COMPLIANT | No stored status used as authoritative anywhere |
| SERIALIZABLE transactions | D-006 | **PARTIAL** | Booking/scan paths compliant. Shift paths violate D-006. |
| Audit completeness | D-007 | COMPLIANT | All mutation paths emit audit records |
| Overlap prevention | D-006 | COMPLIANT | PostgreSQL exclusion constraints + SERIALIZABLE on booking paths |
| Role-based access | D-011 | COMPLIANT | `requirePermission` + ownership guards on all mutation routes |

---

## Recommended Actions (prioritized)

### P0 — Fix before shipping to real users

1. **Fix BUG-1 + BUG-5**: Add SERIALIZABLE to all 5 `shift-trades.ts` transaction calls. Critical for `claimTrade()` and `approveTrade()`.

2. **Fix BUG-6**: Add SERIALIZABLE to all 6 `shift-assignments.ts` transaction calls. Critical for `directAssignShift()` and `approveRequest()`.

3. **Fix BUG-2**: Merge bulk scan quantity guard into the increment transaction with SERIALIZABLE, or move guard inside the second transaction.

4. **Fix BUG-3**: Subtract `checkedInQuantity` from return quantity in `markCheckoutCompleted()`.

5. **Fix BUG-4**: Block POST/PUT/PATCH/DELETE requests when Origin header is absent (except cron routes using CRON_SECRET).

### P1 — Fix soon after launch

6. **Fix BUG-7**: Add SERIALIZABLE to `generateShiftsForEvent()` transaction (low risk but violates D-006).

7. **Add SERIALIZABLE to remaining API route transactions**: `bulk-skus` CRUD, `drafts`, `calendar-sources` delete. Low individual risk but violates D-006 platform invariant.

8. **Fix GAP-27**: Switch reports `Promise.all` to `Promise.allSettled` with partial failure handling.

### P2 — Track and monitor

9. **Add shift isolation gaps to GAPS_AND_RISKS.md**: The 18+ missing-isolation functions are not currently tracked.

10. **Update tests**: After fixing bugs, update proof tests to assert SERIALIZABLE is present (flip from bug-documenting to regression-preventing).

11. **Add audit log retention policy**: Active risk in GAPS_AND_RISKS.md but no concrete plan.

---

## Roadmap Status

| Phase | Status |
|---|---|
| **V1 (shipped)** | Core booking/scan paths fully hardened. 13 security fixes shipped 2026-03-18. SERIALIZABLE on all booking mutations. |
| **V2 (in progress)** | Shift/trade paths need SERIALIZABLE. 4 documented bugs need fixing. CSRF bypass needs closing. |
| **V3 (unplanned)** | Rate limiting expansion (currently only auth endpoints). CSP headers. Audit log retention/archival. |

---

## Change Log

- 2026-03-30: Initial cross-cutting security & data integrity audit. Discovered 3 new bugs (BUG-5, BUG-6, BUG-7) beyond the 4 documented in todo.md. 18+ transactions missing SERIALIZABLE isolation, concentrated in shift-trades.ts and shift-assignments.ts.
