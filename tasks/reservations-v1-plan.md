# Reservations V1 — Slice Plan

Date: 2026-03-10
Brief: `docs/BRIEF_RESERVATIONS_V1.md`
Goal: Bring reservations to parity with checkout V2 quality

## Current State

- Schema: 100% (unified Booking model supports both kinds)
- List API + basic UI: working but no action gating, no context menu
- Create: working but no sectioned equipment picker, no event integration
- Detail page: bare-bones (no tabs, no inline edit, no actions)
- Service layer: CRUD works but NO permission checks on update/cancel
- Action gating: 0% (checkout-rules.ts explicitly rejects reservations)
- Convert-to-checkout: implicit only (POST /api/checkouts with sourceReservationId)

## Slice Order

### Slice 1: Reservation Rules + Action Gating (Service Layer)
**Files:**
- NEW: `src/lib/services/reservation-rules.ts`
- EDIT: `src/app/api/reservations/[id]/route.ts` (wire permission checks)
- EDIT: `src/app/api/reservations/[id]/cancel/route.ts` (wire permission checks)
- EDIT: `src/lib/services/bookings.ts` (add permission enforcement to updateReservation/cancelReservation)

**Scope:**
- Define reservation action matrix (parallel to checkout-rules.ts):
  - BOOKED: edit (staff+/owner), cancel (staff+/owner), convert (staff+/owner), extend (staff+/owner)
  - OPEN: edit (staff+/owner, bounded), extend (staff+/owner), checkin (staff+/owner) — note: OPEN means converted to checkout, so this state is handled by checkout rules
  - COMPLETED/CANCELLED: view only
- `canPerformReservationAction(actor, booking, action)` — server enforcement
- `getAllowedReservationActions(actor, booking)` — for UI
- `requireReservationAction()` — throws 403
- Wire into existing reservation API endpoints
- Add `allowedActions` to GET /api/reservations/[id] response

**Acceptance:**
- [ ] Student cannot cancel another student's reservation
- [ ] Staff can cancel any reservation
- [ ] COMPLETED/CANCELLED reservations have no actions
- [ ] allowedActions returned in reservation detail API

---

### Slice 2: Reservation Detail Page V2
**Files:**
- REWRITE: `src/app/(app)/reservations/[id]/page.tsx`
- EDIT: `src/components/BookingDetailsSheet.tsx` (ensure reservation path gets allowedActions)

**Scope:**
- Tabbed interface: Info | Equipment | History (match checkout detail)
- Info tab: DataList (title, status, location, dates, requester, notes, event if linked)
- Info tab: inline edit mode (title, dates, notes) with conflict revalidation
- Equipment tab: serialized + bulk items table, search within, conflict badges
- Equipment tab: inline equipment edit (add/remove items with picker)
- History tab: audit log with filters (All, Booking changes, Equipment changes)
- Action buttons gated by `allowedActions`:
  - Edit, Extend (with date picker + quick buttons), Cancel (with confirmation)
  - "Start Checkout" CTA (the convert action) — prominent when BOOKED
- Status badge with state-appropriate coloring
- Return location suggestion for mixed-location equipment

**Acceptance:**
- [ ] Three tabs render correctly
- [ ] Inline edit saves and revalidates conflicts
- [ ] Equipment edit uses sectioned picker
- [ ] Actions hidden/shown based on allowedActions
- [ ] "Start Checkout" button visible for BOOKED reservations

---

### Slice 3: Reservation Create Flow + Equipment Picker
**Files:**
- EDIT: `src/app/(app)/reservations/page.tsx` (replace inline create form with sectioned picker)
- Reuse: `equipment-sections.ts`, `equipment-guidance.ts`

**Scope:**
- Sectioned equipment picker (5 tabs: Cameras, Lenses, Batteries, Accessories, Others)
- Status dots on assets (green/red/purple/amber)
- Equipment guidance rules (body-needs-batteries, lens-needs-body, etc.)
- Selected summary panel with remove buttons
- Optional event integration: "Tie to event" toggle → sport → event → auto-populate dates/title/location
- Conflict detection on submit (409 with aggregate error messages)
- Bulk items with quantity steppers

**Acceptance:**
- [ ] Equipment picker matches checkout create quality
- [ ] Guidance rules fire correctly
- [ ] Unavailable assets shown but not selectable
- [ ] Event integration auto-populates fields
- [ ] Conflict errors displayed clearly

---

### Slice 4: Reservation List Polish
**Files:**
- EDIT: `src/app/(app)/reservations/page.tsx` (list section)

**Scope:**
- Status scope filter: Upcoming (default), Active, Past, All
- Sport code filter (if any reservations have sportCode)
- Location filter
- Context menu (right-click / overflow ⋯) with state-aware actions:
  - View, Edit, Extend, Cancel, Start Checkout
  - Gated by `getAllowedReservationActions()`
- Export button (STAFF/ADMIN only, hidden for STUDENT)
- Mobile-friendly: primary tap opens detail, overflow for actions
- Overdue detection: BOOKED past endsAt → "overdue" badge
- Item count + requester in list rows

**Acceptance:**
- [ ] Default filter shows upcoming reservations
- [ ] Context menu actions match booking state
- [ ] Export hidden for students
- [ ] Overdue badges display correctly

---

### Slice 5: Convert-to-Checkout Flow
**Files:**
- NEW: `src/app/api/reservations/[id]/convert/route.ts`
- EDIT: `src/lib/services/bookings.ts` (add explicit convertReservationToCheckout function)
- EDIT: `src/app/(app)/reservations/[id]/page.tsx` (wire convert CTA)

**Scope:**
- Explicit POST /api/reservations/[id]/convert endpoint
- Confirmation step in UI: shows reservation summary, equipment list, dates
- Option to adjust dates/equipment before converting
- Atomic transaction: create checkout from reservation items → cancel reservation → link via sourceReservationId
- Audit: log conversion with both booking IDs
- Redirect to new checkout detail after conversion
- Permission: staff+ or owner of reservation

**Acceptance:**
- [ ] Convert creates checkout with all reservation items
- [ ] Original reservation status → CANCELLED with audit entry
- [ ] New checkout links back via sourceReservationId
- [ ] User redirected to checkout detail page
- [ ] Student cannot convert another student's reservation

---

## Slice Sequence

```
Slice 1 (rules) ──→ Slice 2 (detail) ──→ Slice 3 (create picker)
                                      ──→ Slice 4 (list polish)
                                      ──→ Slice 5 (convert flow)
```

Slice 1 is prerequisite for all others (everything depends on allowedActions).
Slices 3, 4, 5 can be done in any order after Slice 2.

## Non-Goals for V1
- Scanning/scan sessions for reservations (reservations don't handle physical handoff)
- Approval workflows
- Templates / "reserve again" / "repeat"
- PDF generation
- Bulk multi-select row actions
- Attachments tab (deferred — no attachment model exists yet)
