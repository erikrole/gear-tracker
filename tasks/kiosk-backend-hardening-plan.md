# Kiosk Backend Hardening — 2026-07-06

Audit result: the kiosk API surface is already heavily hardened (auth, rate limits,
SERIALIZABLE custody transactions, location scoping, partial-failure dashboard).
One real integrity defect remains, plus a set of error-state and cleanup items.

## Findings

### F1 — Reservation pickup confirm is not atomic (integrity bug, HIGH)
`POST /api/kiosk/pickup/[id]/confirm`, reservation branch:
1. `createBooking()` (tx A): creates the OPEN checkout, decrements bulk stock
   movements, marks the source reservation COMPLETED.
2. A second `db.$transaction` (tx B): binds staged numbered battery units
   (marks units CHECKED_OUT, creates `BookingBulkUnitAllocation`, sets
   `checkedOutQuantity`).

If tx B fails (unit grabbed between scan-staging and confirm), the reservation
is already COMPLETED and the checkout is OPEN with planned-but-unbound battery
units and decremented stock. Retry dead-ends with "booking is in COMPLETED
state" — student is stuck, staff must repair from web.

**Fix:** add optional `bulkUnitItems` to `CreateBookingInput` and bind units
inside `createBooking`'s own SERIALIZABLE transaction. Route drops tx B.
Any failure now rolls the whole pickup back — reservation stays BOOKED and the
student can simply retry.

Also dedupe staged units in the route before binding (duplicate scan events
would otherwise trip the units-found count check with a misleading 404).

### F2 — Raw status leaks in pickup-confirm error states (MED)
Double-tap / re-confirm surfaces `Cannot confirm pickup — booking is in
COMPLETED state` (and `... OPEN state`). Map the common statuses to clear,
student-readable messages ("already picked up", "already confirmed",
"cancelled — ask staff").

### F3 — Dead `startsAt` field in `checkoutCompleteBody` (LOW)
Schema accepts it; route ignores it (start is server-authoritative `now`).
iOS never sends it to complete (only to availability, where it is used).
Remove from the complete schema.

### F4 — Stale comment in `/api/kiosk/activate` (DOC)
Comment claims the limiter is per-instance; `rate-limit.ts` is Upstash-backed
with in-memory fallback (GAP-32 closed). Fix the comment.

### Reviewed and intentionally left alone
- Return-at-any-kiosk (check-in routes not location-scoped): deliberate; scan
  events record location-mismatch evidence.
- `checkout/scan` reconciling asset location pre-completion: documented behavior.
- Scan endpoints returning `ok({success:false})` vs scan-lookup throwing 404:
  existing iOS contract; not worth a breaking change.
- Kiosk trust model (actorId not bound to session): per AREA_KIOSK Trust Model.

## Slices
- [x] S1: `bulkUnitItems` binding inside `createBooking` + route uses it (F1)
- [x] S2: friendly already-done error states in pickup/confirm (F2)
- [x] S3: drop dead `startsAt` from `checkoutCompleteBody` (F3)
- [x] S4: fix stale activate-route comment (F4)
- [x] S5: tests, build, doc sync (AREA_KIOSK change log)

## Review (2026-07-06)
- All four findings fixed in one backend-only slice; no API contract changes
  the iOS client depends on (removed `startsAt` was never sent to complete;
  Zod strips unknown keys anyway).
- `createBooking` gained optional `bulkUnitItems`, guarded to CHECKOUT kind,
  binding units (AVAILABLE→CHECKED_OUT, allocations, checkedOutQuantity)
  inside the existing SERIALIZABLE transaction. Route dropped its second
  transaction and dedupes staged units by unit number.
- Verified: kiosk vitest suites green (40/40 targeted, full run 1762 passed;
  4 failures pre-existing on clean main in iOS guides/licenses/tabbar tests),
  `next build` green. `npm run build`'s migrate-deploy step fails locally on
  Neon TLS (known network limitation, no schema change in this slice).
- Left alone intentionally: return-at-any-kiosk scoping, pre-completion asset
  location reconcile, scan `ok({success:false})` vs lookup 404 asymmetry,
  kiosk trust model for actorId.
