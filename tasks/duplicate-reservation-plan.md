# Duplicate Reservation — Implementation Plan

## Overview
Add a "Duplicate" action to reservations that creates a DRAFT copy with the same items, location, and notes. User then edits dates and confirms (DRAFT → BOOKED triggers availability check).

## Why DRAFT?
- Copying exact dates will almost always conflict (items already allocated)
- DRAFT skips availability check at creation time
- User edits dates, then confirms → availability validated on DRAFT → BOOKED transition
- Clean UX: duplicate → tweak → confirm

## Slices

### Slice 1: Backend — Action Rules + API Endpoint

- [ ] **booking-rules.ts**: Add `"duplicate"` to allowed actions for BOOKED, COMPLETED, CANCELLED (staff+ or owner)
- [ ] **booking-actions.ts**: Mirror the new action client-side
- [ ] **bookings.ts**: Add `duplicateReservation(sourceId, actorId)` service function
  - Loads source booking with serializedItems + bulkItems
  - Creates new Booking in DRAFT status via direct Prisma insert (no availability check)
  - Copies: title + " (copy)", requesterUserId, locationId, startsAt, endsAt, notes, sportCode, eventId
  - Copies serializedItems and bulkItems
  - Does NOT copy allocations (DRAFT = no allocations yet)
  - Emits AuditLog entry: `booking.duplicated` with sourceId in beforeJson
- [ ] **POST /api/reservations/[id]/duplicate/route.ts**: Thin handler calling `requireReservationAction(id, actor, "duplicate")` then `duplicateReservation()`

### Slice 2: Frontend — Context Menu + Detail Sheet

- [ ] **reservations/page.tsx**: Add `contextMenuExtra` for "duplicate" action
  - Handler: POST to `/api/reservations/${id}/duplicate`, redirect to new reservation detail page
- [ ] **BookingDetailsSheet.tsx**: If `allowedActions` includes "duplicate", show button (already renders action buttons from allowedActions — just needs the action to appear)

### Slice 3: Docs

- [ ] Update `AREA_RESERVATIONS.md`: Remove "duplicate/clone" from deferred list, add to action matrix
- [ ] Update `tasks/todo.md`: Mark complete

## Action Availability Matrix (updated)

| State | duplicate? | Who? |
|-------|-----------|------|
| DRAFT | No | — |
| BOOKED | Yes | staff+ or owner |
| COMPLETED | Yes | staff+ or owner |
| CANCELLED | Yes | staff+ or owner |

## Constraints
- No schema migration needed — DRAFT status already exists
- Must NOT call createBooking() (it forces BOOKED + availability check)
- Must emit AuditLog for traceability
- SERIALIZABLE transaction not needed (DRAFT has no allocations)
