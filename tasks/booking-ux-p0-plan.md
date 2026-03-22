# Booking UX P0 Fixes — Implementation Plan

**Goal**: Fix the 3 highest-trust-impact issues from the UX audit
**Branch**: `claude/audit-booking-pages-Y24I0`

---

## Slice 1: Surface Silent Failures (C-2, C-3)

**Files**: `src/components/BookingListPage.tsx`
**Effort**: Small — add toast/feedback to 5 existing catch blocks

### Changes:

1. **Line 171** — `/api/me` failure → toast warning: "Couldn't verify your session — some features may be limited"
2. **Line 197** — Draft load failure → toast: "Couldn't load your draft — starting fresh"
3. **Line 221** — Event fetch failure → set error state (not just stop loading): "Couldn't load events — try again"
4. **Line 246** — Shift context failure → silent is OK (non-critical, decorative only)
5. **Lines 299-301** — Draft save failure → toast warning: "Draft couldn't be saved — your changes may be lost"

### Why skip line 246:
Shift context is a "nice to have" banner. Missing it doesn't break trust or lose data. The other 4 are data-loss or permission risks.

---

## Slice 2: Microcopy Rewrites

**Files**: `CreateBookingCard.tsx`, `BookingListPage.tsx`
**Effort**: Small — text-only changes

### Button labels:
- "Create checkout" → "Check out equipment" / "Reserve equipment"
- "Creating..." → "Checking out..." / "Reserving..."
- "Cancel" (close form) → "Discard" (clearer intent)
- "From" / "To" → "Pickup" / "Return by" (checkout) or "Start" / "End" (reservation)

### Field labels:
- "User" → "Checked out to" (checkout) / "Reserved for" (reservation)
- "Tie to event" → "Link to event"
- "Title (auto-generated, editable)" → "Booking name (auto-filled from event)"

### Error messages:
- "Title is required" → "Give this booking a name"
- "User is required" → "Select who this is for"
- "Location is required" → "Choose a pickup location"

### Config-driven:
All label changes flow through `BookingListConfig` — checkouts get checkout-specific labels, reservations get reservation-specific labels. Check `config.kind` or add new config fields.

---

## Slice 3: Create Confirmation Step (C-1)

**Files**: `BookingListPage.tsx`, new `ConfirmBookingDialog.tsx`
**Effort**: Medium — new component + state management

### Approach:
Use shadcn AlertDialog as a confirmation modal (not a multi-step wizard — too much restructuring).

### Flow:
1. User fills form → clicks "Check out equipment"
2. Client-side validation runs (title, user, location)
3. If valid: open `ConfirmBookingDialog` with summary
4. Dialog shows: title, dates, location, requester name, equipment count + list preview
5. "Confirm" button → calls existing `handleCreate()` logic (POST to API)
6. "Go back" button → closes dialog, returns to form

### Dialog content:
```
┌─────────────────────────────────────┐
│ Confirm checkout                     │
│                                      │
│ Game Day Equipment                   │
│ Pickup:   Mar 25, 2:00 PM           │
│ Return:   Mar 27, 2:00 PM           │
│ Location: Equipment Room             │
│ For:      Jane Smith                 │
│                                      │
│ Equipment (4 items)                  │
│ • CAM-001 — Canon R5                │
│ • LENS-003 — 70-200mm               │
│ • BATT-012 — Canon LP-E6NH          │
│ • Batteries × 3                      │
│                                      │
│ [Go back]          [Check out equipment] │
└─────────────────────────────────────┘
```

### State changes in BookingListPage:
- Add `showConfirm` boolean state
- Split `handleCreate`: validation → show dialog; dialog confirm → POST
- Pass form data to dialog as props

---

## Verification

- [ ] `npm run build` passes
- [ ] Create checkout flow: silent failures now show toasts
- [ ] Create checkout flow: confirmation dialog appears before submit
- [ ] Create reservation flow: same, with reservation-specific labels
- [ ] All new microcopy matches audit spec
- [ ] No regressions in list view, filters, or sheet

---

## Out of Scope (deferred to Sprint 2)

- Equipment picker collapse-by-default (F-2)
- Event tie simplification (F-4)
- Scan page auto-start camera (F-8)
- 404 vs network error distinction (C-5)
