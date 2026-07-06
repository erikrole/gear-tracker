# Bookings backend hardening plan

Audit of booking lifecycle flows (create, update, extend, cancel, force-complete)
found one ledger-corruption bug on checkout equipment edits plus validation and
guard gaps. Availability reads `BulkStockBalance.onHandQuantity` directly, so
balance drift corrupts future availability decisions -- this is the custody
ledger, not just reporting.

## Findings

### B1 (P0) -- Checkout equipment edits corrupt the bulk ledger and custody history
`updateCheckout` handles equipment changes by delete-all-recreate:
- No `BulkStockMovement`/`BulkStockBalance` deltas are written when bulk
  quantities change on a CHECKOUT (create and cancel both write them), so the
  on-hand balance drifts and availability lies from then on.
- `bookingBulkItem.deleteMany` cascades away `BookingBulkUnitAllocation` rows
  (numbered-unit custody history) and erases `checkedOutQuantity` /
  `checkedInQuantity`, while `BulkSkuUnit.status` stays CHECKED_OUT with no
  allocation (stale flag).
- `bookingSerializedItem.deleteMany` + recreate resets partially returned
  items' `allocationStatus` from "returned" back to "active" and resurrects
  their active allocations.

Fix: make checkout equipment edits diff-based.
- Serialized: add/remove only the changed asset rows; block removing an
  already-returned item (409); window changes update allocations in place.
- Bulk: block edits to any SKU row that has custody activity (active unit
  allocations, `checkedOutQuantity` set, or `checkedInQuantity` > 0) with a
  409 that routes staff to kiosk check-in; otherwise apply row diffs and write
  matching CHECKOUT/CHECKIN movement deltas via `upsertBulkBalancesAndMovements`.
Reservations keep delete-all-recreate (no custody state exists yet).

### B2 (P1) -- extendBooking ignores bulk shortages
It rejects only `availability.conflicts`; a checkout with bulk gear can be
extended over a window where future reservations depend on that quantity.
Add `shortages` to the rejection (leave `unavailableAssets` alone: gear already
in custody should not be blocked from extension by a later retire flag).

### B3 (P1) -- cancelReservation has no status guard inside its transaction
Route policy blocks cancel on COMPLETED/CANCELLED, but the policy read happens
outside the service transaction (TOCTOU): a reservation completed between the
check and the cancel gets flipped to CANCELLED, deactivating history. Add the
same in-transaction guards `cancelBooking` has.

### B4 (P2) -- updateReservation accepts an arbitrary `status`
`UpdateBookingInput.status` is passed straight into `booking.update` with no
lifecycle side effects; no caller sends it today. Remove the field.

### B5 (P2) -- Requester never validated
`createBooking`/`updateReservation` accept any `requesterUserId`: a missing
user surfaces as a Prisma FK 500, an inactive user silently becomes the
requester. Validate exists + active inside the transaction.

## Slices

- [x] S1: Diff-based checkout equipment edits with ledger deltas + custody
      guards (B1)
- [x] S2: extendBooking rejects shortages (B2)
- [x] S3: cancelReservation in-transaction status guards (B3)
- [x] S4: Remove UpdateBookingInput.status (B4)
- [x] S5: Requester exists+active validation on create and reservation
      requester change (B5)
- [x] S6: Tests + build + docs sync

## Review

All slices shipped together (service-layer edits share the same files/tests).
`tests/update-booking.test.ts`, `tests/create-booking.test.ts`,
`tests/extend-booking.test.ts`, `tests/cancel-booking.test.ts` updated and
extended; full suite + `npx next build` green.
