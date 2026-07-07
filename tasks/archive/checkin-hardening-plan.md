# Check-in flow hardening plan

Audit of `bookings-checkin.ts`, `bulk-unit-scans.ts`, `scans.ts`, and the kiosk
check-in routes. The serialized-asset paths are solid. The bulk ledger has a
split-brain convention on `checkedInQuantity` that corrupts
`BulkStockBalance.onHandQuantity` (which availability reads) in both
directions depending on which mix of paths a return takes.

## Findings

### K1 (P0) -- `checkedInQuantity` has two incompatible ledger conventions
Writers that increment it WITHOUT restocking the ledger:
- kiosk unit check-in scan (`scanKioskCheckinBulkUnit`)
- admin-override scan check-in (`scans.ts recordScan`, numbered + plain)

Writer that increments AND restocks immediately:
- web partial bulk check-in (`checkinBulkItem`)

Completion paths then assume one convention or the other:
- `maybeAutoComplete` (via `checkinItems`/`kioskCompleteCheckin`) restocks the
  FULL checked-out quantity -- correct for pure-scan flows, **double-restocks**
  anything already returned through `checkinBulkItem`.
- `markCheckoutCompleted` / `forceCompleteCheckout` restock `out - in (- lost)`
  -- correct for `checkinBulkItem` flows, **under-restocks** (permanent
  downward drift) anything returned through kiosk or override scans.

Mixing paths on one checkout (entirely normal: return batteries at the kiosk,
staff completes from the web) silently corrupts on-hand stock either way.

Fix, two layers:
1. **Restock at the moment of physical return, everywhere.** Kiosk unit
   check-in scans and `scans.ts` check-in scans now write a CHECKIN movement
   for exactly what they return, matching `checkinBulkItem`. Availability
   sees a returned battery immediately.
2. **Movement-sourced settle at completion.** New
   `settleBulkLedgerAtCompletion` helper computes, per SKU,
   `CHECKOUT movements - CHECKIN movements - lost units` for the booking and
   restores the positive remainder. Every completion path
   (`maybeAutoComplete`, `markCheckoutCompleted`, `forceCompleteCheckout`)
   uses it instead of field math. This is self-healing: checkouts with
   pre-deploy scan-based returns (no movements written) settle correctly at
   completion, as does any future path drift.

### K2 (P1) -- Reservation pickup can bind a unit count that disagrees with the ledger
`createBooking` decrements the ledger by `plannedQuantity` but binds however
many `bulkUnitItems` the caller sends and stamps that as `checkedOutQuantity`.
The kiosk confirm route blocks under-staging but not over-staging, and the
service trusts the route. Enforce `bound == plannedQuantity` per numbered SKU
inside the transaction (409), same defense-in-depth pattern as the
reservation-cancel guard.

## Non-findings (checked, fine)
- Serialized check-in paths (`checkinItems`, `kioskCheckinAsset`) validate
  membership and already-returned state, batch their writes, and run
  SERIALIZABLE.
- `markCheckoutCompleted` LOST handling correctly excludes lost units from
  restock and closes their custody episodes.
- Kiosk direct checkout keeps `planned == checkedOut == scanned` and
  decrements exactly that.
- Scan dedup window, unit-ownership checks, and cross-booking guards in
  `scans.ts` are sound.

## Slices

- [x] S1: `settleBulkLedgerAtCompletion` helper + adopt in all three
      completion paths; remove `bulkStockReturn` from `maybeAutoComplete` (K1.2)
- [x] S2: Per-scan CHECKIN restock in `scanKioskCheckinBulkUnit` and
      `scans.ts` check-in phase (K1.1)
- [x] S3: `bound == planned` backstop in createBooking's unit-bind block (K2)
- [x] S4: Tests + build + docs sync

## Review

Shipped together (the two K1 layers only make sense as one unit).
Updated `tests/mark-checkout-completed.test.ts`, `tests/checkin-items.test.ts`,
`tests/checkin-bulk-item.test.ts`, `tests/kiosk-checkout-complete-bulk-units.test.ts`
plus new regression coverage; full suite + build green.
