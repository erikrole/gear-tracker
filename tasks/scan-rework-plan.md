# Scan Page Rework Plan

## Problem Statement

The current scan page has two loose modes ("Quick Checkout" and "Quick Check in") that don't integrate with the actual booking scan workflow. The real student workflow is:

1. Student creates a reservation online
2. Goes to the office, reservation gets converted to a checkout (BOOKED→OPEN)
3. Staff/student must scan each item during handoff to confirm checkout
4. When returning gear, each item must be scanned to confirm check-in

Additionally, there's no "just look up an item" scan mode — scanning always assumes checkout/checkin context.

## Design: Three Scan Modes

### Mode 1: "Look Up Item" (default)
- Scan any QR/barcode → navigate directly to `/items/{id}`
- Simplest flow, useful for quick inventory checks
- No cart, no booking context

### Mode 2: "Checkout Scan" (booking-attached)
- Entry: user navigates from a checkout detail page via "Scan items" button (passes checkout ID)
- URL: `/scan?checkout={id}&phase=CHECKOUT`
- Shows checkout context (title, requester, item list)
- Each scan matches against the checkout's item list
- Items turn green as they're scanned ✓
- Progress indicator: "3 of 7 items scanned"
- When all items scanned → "Complete checkout" button enabled
- Calls existing `POST /api/checkouts/{id}/scan` + `POST /api/checkouts/{id}/complete-checkout`

### Mode 3: "Check-in Scan" (booking-attached)
- Entry: user navigates from checkout detail page via "Scan to check in" button
- URL: `/scan?checkout={id}&phase=CHECKIN`
- Shows checkout context with outstanding items
- Each scan marks the item as returned (calls `POST /api/checkouts/{id}/checkin-scan`)
- Progress indicator: "3 of 7 items returned"
- When all items scanned → "Complete check-in" button enabled
- Calls existing `POST /api/checkouts/{id}/complete-checkin`

## Implementation Slices

### Slice 1: Scan page rework
Rewrite `/scan` page with three modes:

**URL params drive mode:**
- No params → "Look Up" mode (default)
- `?checkout={id}&phase=CHECKOUT` → Checkout scan mode
- `?checkout={id}&phase=CHECKIN` → Check-in scan mode

**Look Up mode:**
- Scanner + manual entry
- On scan: look up asset, navigate to `/items/{id}`
- If not found: show error toast, stay on page

**Checkout Scan mode:**
- Fetch checkout details on mount
- Display item checklist (serialized items + bulk items)
- On scan: call `POST /api/checkouts/{id}/scan` with phase=CHECKOUT
- Mark item green on success, show error on mismatch
- Show progress bar
- "Complete Checkout" button when all items scanned (or admin override available)
- Calls `POST /api/checkouts/{id}/complete-checkout`

**Check-in Scan mode:**
- Same pattern as checkout scan but with phase=CHECKIN
- Only shows items with allocationStatus="active" (not yet returned)
- On scan: call `POST /api/checkouts/{id}/checkin-scan` with phase=CHECKIN
- "Complete Check-in" button when all items scanned
- Calls `POST /api/checkouts/{id}/complete-checkin`

### Slice 2: Checkout detail page — scan entry points
Add buttons to checkout detail page (`/checkouts/[id]`):
- When status=OPEN and action "open" is allowed: "Scan Items Out" → `/scan?checkout={id}&phase=CHECKOUT`
- When status=OPEN and action "checkin" is allowed: "Scan Items In" → `/scan?checkout={id}&phase=CHECKIN`

### Slice 3: API enhancement — scan status endpoint
Add `GET /api/checkouts/{id}/scan-status` that returns:
- List of required items with scanned/not-scanned state
- Bulk items with planned vs scanned quantities
- Used by the scan page to show real-time progress

## Files to Create/Modify

- `src/app/(app)/scan/page.tsx` — full rewrite
- `src/app/(app)/checkouts/[id]/page.tsx` — add scan entry buttons
- `src/app/api/checkouts/[id]/scan-status/route.ts` — new endpoint
- `src/components/QrScanner.tsx` — no changes needed

## Key UX Decisions

1. Scanner stays active between scans (no need to restart camera)
2. Audio/haptic feedback on successful scan (vibration API)
3. Error scans show inline message but don't stop scanning
4. Progress persists via server state (scan events), so page refresh recovers
5. Mobile-first layout: scanner at top, item list below, action button sticky at bottom
