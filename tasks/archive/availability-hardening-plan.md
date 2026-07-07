# Availability service hardening plan

Audit of `src/lib/services/availability.ts` and its consumers
(`/api/availability/check`, kiosk checkout preflight, booking lifecycle,
equipment picker, picker-search). The service core is sound: serialized
conflicts run against active allocations with a turnaround buffer, bulk math
is deliberately conservative (sums all overlapping BOOKED reservations),
`Asset.status` is condition-only so the status gate is correct, and commits
are protected by SERIALIZABLE transactions plus the DB exclusion constraint.
Findings live at the route/client seam.

## Findings

### V1 (P1) -- Web preflight and commit disagree on per-kind availability flags
`checkAssetStatuses` gates `availableForCheckout`/`availableForReservation`
only when `bookingKind` is provided. `createBooking`/`updateReservation`/
`updateCheckout`/`extendBooking` and the kiosk preflight all pass it, but
`/api/availability/check` (the wizard and edit-sheet preflight) does not --
so the picker says an asset is fine, then the save 409s with
NOT_AVAILABLE_FOR_RESERVATION. Fix: optional `kind` on `availabilitySchema`,
pass through the route, plumb `bookingKind` through `useConflictCheck` and
`EquipmentPicker`, and send it from the wizard (RESERVATION), the booking
details sheet, and the booking equipment tab (`booking.kind`). iOS keeps
omitting it (additive field, legacy behavior unchanged) until a parity pass.

### V2 (P2) -- Picker holder lookup misses PENDING_PICKUP
`picker-search` computes unavailability with the shared derived-status helper
(which covers PENDING_PICKUP) but the "who has it" lookup only queries
BOOKED/OPEN bookings, so a staged-for-pickup asset shows unavailable with no
holder. Add PENDING_PICKUP to the holder query.

### V3 (P2) -- `/api/availability/check` has no permission check
Every sibling booking route calls `requirePermission`; this one only has
`withAuth`. Add `requirePermission(user.role, "booking", "view")` (all three
roles hold it, so no behavior change -- consistency and future-proofing).

## Non-findings (checked, fine)
- Bulk shortage model: checkout demand is in on-hand movements; committed =
  overlapping BOOKED reservations at the same location. Conservative
  over-count when reservations overlap the window but not each other is a
  deliberate simplification.
- Serialized blocking statuses (BOOKED/PENDING_PICKUP/OPEN) are consistent
  across conflicts, upcoming commitments, and the derived-status helper.
- Turnaround buffer (60m) applied on the query side via buffered start.
- kiosk checkout preflight passes `bookingKind: CHECKOUT` and ignores
  client-supplied location (already hardened 2026-07-03).

## Slices

- [x] S1: `kind` through schema, route, hook, picker, and the three web
      callers (V1)
- [x] S2: PENDING_PICKUP in picker-search holder lookup (V2)
- [x] S3: requirePermission on availability route (V3)
- [x] S4: Tests + build + docs sync

## Review

Shipped in one pass. Source-contract coverage added for the preflight kind
passthrough and holder statuses; full suite + build green.
