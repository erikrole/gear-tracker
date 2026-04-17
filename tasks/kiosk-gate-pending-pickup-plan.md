# Kiosk Gate + PENDING_PICKUP Plan

## Feature Description
Gate all checkout scanning to kiosk only. Desktop creates a booking with status `PENDING_PICKUP`; student picks up gear at kiosk to move it to `OPEN`.

## Key Decisions

**D-A: Allocation timing** — Option A. Allocations + bulk stock movements created at booking creation (PENDING_PICKUP), not at kiosk pickup. Items are held immediately. Kiosk pickup is a status flip + physical confirmation.

**D-B: Orphan cleanup** — PENDING_PICKUP bookings can be cancelled by staff/admin via existing cancel flow. Cron-based auto-expiry is a future enhancement (added as GAP-33).

**D-C: Asset computedStatus** — PENDING_PICKUP allocations keep `active=true`. Assets show as "CHECKED_OUT" — acceptable for V1 (items are held).

**D-D: Kiosk pickup UX** — Per-item scanning of serialized items. Bulk items auto-confirmed (no individual units). Matches ReturnFlow pattern.

**D-E: Keep scan lookup mode** — `/scan` page with no params remains accessible (lookup-only). Bottom nav item relabeled "Lookup" → `/scan` with no query params.

## Status Flow (Updated)
```
DRAFT → PENDING_PICKUP (created on desktop) → OPEN (kiosk pickup) → COMPLETED
         ↓ cancel (staff+)
       CANCELLED
```

## Slice Plan

- [x] Slice 1: Schema migration (add PENDING_PICKUP to BookingStatus)
- [x] Slice 2: Service + API layer
  - `bookings-lifecycle.ts`: CHECKOUT createBooking → PENDING_PICKUP
  - `booking-rules.ts`: add PENDING_PICKUP to STATE_ACTIONS
  - `POST /api/kiosk/pickup/[id]/scan` — validate item scan against booking
  - `POST /api/kiosk/pickup/[id]/confirm` — PENDING_PICKUP → OPEN
- [x] Slice 3: Desktop UI
  - `BookingWizard.tsx`: redirect to `/checkouts?highlight=${id}` after checkout creation
  - `WizardStep3.tsx`: update notice to "Pick up at kiosk"
  - `AppShell.tsx`: relabel "Scan" → "Lookup" (keep /scan URL for lookup mode)
- [x] Slice 4: Kiosk UI
  - `kiosk/student/[userId]/route.ts`: add pendingPickups to response
  - `StudentHub.tsx`: show "Pending Pickup" section
  - `KioskShell.tsx`: add "pickup" screen type
  - New `PickupFlow.tsx`: scan-to-confirm items, then call confirm API
- [x] Slice 5: Gate checkout/checkin scan APIs
  - `/api/checkouts/[id]/scan` and `/api/checkouts/[id]/checkin-scan`: return 403 from regular auth
- [ ] Slice 6: Doc updates + GAPS update

## Affected Status Queries (Verified — all explicitly filter OPEN, not all statuses)
- `/api/dashboard/route.ts`: `status = 'OPEN'` — correct, PENDING_PICKUP excluded
- `/api/dashboard/stats/route.ts`: `status = 'OPEN'` — correct
- `/api/reports/route.ts`: `status: "OPEN"` — correct
- `/api/checkouts/route.ts`: list filter, will need to show PENDING_PICKUP in "pending" view
- `kiosk/student/[userId]/route.ts`: currently `status: "OPEN"` for checkouts — needs PENDING_PICKUP section added

## Files to Modify
- `prisma/schema.prisma` (enum change + migration)
- `src/lib/services/bookings-lifecycle.ts`
- `src/lib/services/booking-rules.ts`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep3.tsx`
- `src/components/AppShell.tsx`
- `src/app/api/kiosk/student/[userId]/route.ts`
- `src/app/api/checkouts/[id]/scan/route.ts` (gate)
- `src/app/api/checkouts/[id]/checkin-scan/route.ts` (gate)

## Files to Create
- `src/app/api/kiosk/pickup/[id]/scan/route.ts`
- `src/app/api/kiosk/pickup/[id]/confirm/route.ts`
- `src/app/(kiosk)/kiosk/_components/PickupFlow.tsx`
