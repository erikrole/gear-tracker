# Booking Real-Time Sync Browser Proof - 2026-06-24

## Setup
- Local app: `http://localhost:3041`
- Authenticated as seeded admin: `admin@creative.local`
- Smoke booking id: `cmqs2rrjt000hkv9t8pp1kicm`
- Smoke item: `Anton Bauer Digital 150 Gold-Mount Battery`
- Screenshot: `tasks/archive/proofs/booking-realtime-dashboard-final.png`

## Proof
- Dashboard initially showed `Reserved 0`.
- Created reservation `Realtime Smoke 2026-06-24T12:54:18.106Z` from another authenticated client.
- Without clicking `Refresh dashboard`, Dashboard showed `Reserved 1` and the smoke row.
- `/bookings?tab=reservations` showed the smoke row after the list data rendered.
- Opened the booking detail sheet and patched title/notes. The first run exposed a bug: the list row updated, but the open sheet still showed old local state.
- Fixed the sheet by dispatching `BOOKING_CHANGE_SYNC_EVENT` from `useBookingChangeSync` and making `BookingDetailsSheet` silently refetch only when its current `bookingId` appears in the changed id list.
- Re-ran the detail proof. The already-open detail sheet updated to `Realtime Smoke Detail Synced 2026-06-24T12:54:18.106Z` and notes `Detail sheet picked up realtime smoke` without manual refresh.
- Cancelled the smoke reservation. The active reservations list dropped the row and the open sheet updated to `Cancelled`.
- Reloaded Dashboard. It showed `Reserved 0` and no `Realtime Smoke` row, proving persisted dashboard cache did not resurrect stale booking data.

## Remaining Proof Debt
- Checkout-tab convergence was covered by the shared `/bookings` list hook and source-contract tests, but this browser smoke did not mutate a checkout.
- Kiosk pickup fulfillment remains the unproven part of Reservations AC-12.
