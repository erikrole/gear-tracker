# UX Audit: Booking Experience & Related Flows

**Date**: 2026-03-22
**Scope**: Full booking lifecycle — creation, detail/edit, list/dashboard, scan/checkout
**Method**: Deep code-level flow mapping across all booking components

---

## Flow Map: Complete Booking Journey

```
ENTRY POINTS                    CREATION                     POST-CREATE
─────────────                   ────────                     ───────────
Dashboard "New checkout"   ─┐
Dashboard "New reservation" │   CreateBookingCard            BookingDetailsSheet opens
Event detail "Reserve gear" ├─→ (inline on list page)  ──→  with newly created booking
Event detail "Checkout"     │   • Title / User / Location    │
Shift "Create checkout"     │   • From / To datetime         ├─→ Edit (sheet or inline)
Resume draft               ─┘   • Equipment picker           ├─→ Extend (quick buttons)
                                • Event tie (optional)        ├─→ Cancel (confirmation)
                                • Draft auto-save             ├─→ Start checkout (reservation→checkout)
                                                              └─→ Scan items out/in
```

---

## 1. CRITICAL UX ISSUES (Fix Immediately)

### C-1: No confirmation before booking creation
**Flow**: User fills form → clicks "Create checkout" → booking is instantly created
**Problem**: No summary/review step. For a system where "failed bookings = lost trust," users have zero chance to verify their selections before committing. Equipment list could have 15+ items — easy to miss a wrong selection.
**Fix**: Add a confirmation summary before POST. Show: title, dates, location, equipment count with names, requester. Button: "Confirm booking" (not "Create checkout").

### C-2: Silent auth/draft/event failures degrade UX without explanation
**Flow**: Page load silently swallows errors for `/api/me`, draft loading, event fetching, and shift context
**Files**: `BookingListPage.tsx` lines 171, 197, 221, 246
**Problem**: If `/api/me` fails, permission checks use empty values — user may see wrong action buttons or get denied. If draft load fails, user loses saved work with no notification. If events fail to load, the event selector shows empty with no explanation.
**Fix**:
- `/api/me` failure: Show banner "Session may have expired" with retry
- Draft load failure: Toast "Couldn't load your draft — starting fresh"
- Event load failure: Inline message "Couldn't load events" with retry link

### C-3: Draft save failures are completely invisible
**Flow**: User closes create form → draft save silently fails → user thinks work is saved
**Files**: `BookingListPage.tsx` lines 299-310 (catch blocks with empty comments)
**Problem**: User navigates away expecting to resume later, but draft was never saved. No feedback whatsoever.
**Fix**: On draft save failure, show warning toast: "Draft couldn't be saved — your changes may be lost"

### C-4: Equipment conflict errors lack actionable guidance
**Flow**: User creates booking → 409 conflict → sees list of conflicting items
**Problem**: Error shows which items conflict but doesn't help user fix it. No way to deselect the conflicting items from the error state — user must scroll back through equipment picker to find and uncheck them.
**Fix**: Make conflict error items actionable — click to auto-deselect the conflicting item from the picker. Or show "Remove conflicting items" button.

### C-5: Booking detail page — no loading distinction between 404 and network error
**Flow**: Navigate to `/checkouts/invalid-id` → see "Checkout not found or failed to load"
**Problem**: Same message for genuinely missing bookings and temporary network failures. User can't tell if they should retry or give up.
**Fix**: Distinguish: "This checkout doesn't exist" (404) vs "Couldn't load — check your connection" (network) with retry button.

---

## 2. FRICTION POINTS

### F-1: Create form is inline on list page — context loss
**Flow**: User navigates to `/checkouts` → clicks "New checkout" → form appears above list
**Problem**: Form shares the page with the booking list. On mobile, the list pushes below the fold. User loses context of what they already have checked out. No dedicated creation experience.
**Recommendation**: Consider a dedicated create page or full-screen sheet for booking creation. Keeps list visible for reference on desktop (split view).

### F-2: Equipment picker defaults to expanded — overwhelms on first load
**Flow**: Open create form → equipment picker is fully expanded immediately
**Problem**: User sees a wall of equipment sections before they've even set dates/location. Equipment availability depends on dates, so selecting equipment first may show stale availability.
**Fix**: Default picker to collapsed. Show "Add equipment" button. Expand on click. Alternatively, enforce date selection before equipment picker becomes interactive.

### F-3: Date inputs use native datetime-local — poor UX on desktop
**Flow**: Click date field → browser's native datetime picker appears
**Problem**: Native `datetime-local` inputs have inconsistent UX across browsers. On desktop Chrome, they're clunky. The app already has a shadcn DateTimePicker component but isn't using it everywhere.
**Fix**: Ensure shadcn DateTimePicker (Calendar + Popover + time selects) is used consistently across all date inputs in booking flows.

### F-4: "Tie to event" toggle adds cognitive overhead
**Flow**: Create form shows "Tie to event" toggle → user must decide before filling anything
**Problem**: New users don't understand what "tying to an event" means. The toggle changes which fields appear, creating decision fatigue upfront.
**Fix**: Remove the toggle. Instead: show an optional "Link to event" section at the bottom of the form, collapsed by default. Or auto-detect from context (came from event page → pre-linked).

### F-5: No keyboard shortcut to create booking
**Flow**: User on list page must click button to start creation
**Problem**: Power users (staff managing dozens of bookings daily) can't quickly start a new booking.
**Fix**: Add `N` keyboard shortcut to open create form (consistent with `E` for edit on detail page).

### F-6: Extending a booking requires clicking "Extend" then picking a date then "Save"
**Flow**: Detail page → click Extend → panel opens → pick date → Save
**Problem**: Three interactions for a common action. Quick-extend buttons (+1d, +3d, +1w) exist but still require clicking Extend first to reveal them.
**Fix**: Surface quick-extend buttons directly in the action bar. One click = instant extend by 1 day. No panel needed for the common case.

### F-7: Equipment editor in sheet — two levels of nesting
**Flow**: List → open sheet → Equipment tab → click Edit → sub-form with add/remove
**Problem**: User is in a sheet, then in an edit mode within the sheet. Navigation feels nested and claustrophobic, especially on mobile.
**Fix**: Equipment editing should happen on the full detail page, not nested in the sheet. Sheet should be view-only with a "Edit on full page" link.

### F-8: Scan page — "Tap to start camera" requires an extra click
**Flow**: Navigate to scan page → see "Tap to start camera" button → tap → camera starts
**Problem**: The scan page's entire purpose is scanning. Requiring a tap to start the camera adds a friction step to every scan session.
**Fix**: Auto-request camera permission on page load. Start scanning immediately. Show manual input as fallback.

### F-9: No "undo" for check-in operations
**Flow**: User checks in items → items marked returned → realizes wrong item
**Problem**: Check-in is one-way. If user accidentally returns the wrong item, there's no undo. Must contact admin.
**Fix**: Add 10-second undo toast after check-in: "3 items returned. Undo?" Or allow re-checkout from detail page.

---

## 3. UX ENHANCEMENTS

### E-1: Success celebration on booking creation
**Current**: Form closes, sheet opens silently
**Enhancement**: Brief success animation/toast: "Checkout created — #REF-1234" with confetti or checkmark animation similar to scan completion celebration.

### E-2: Smart defaults for repeat bookings
**Current**: Each booking starts from scratch (unless resuming draft)
**Enhancement**: "Repeat last booking" button that pre-fills title pattern, same equipment, next available time slot. Common pattern for recurring game-day setups.

### E-3: Equipment picker — show "recently used" section
**Current**: User browses through Cameras/Lenses/Batteries/Accessories/Others every time
**Enhancement**: Add "Recently used" tab showing the user's last 10 selected items. One-click to re-select a previous kit.

### E-4: Booking list — visual timeline/calendar view option
**Current**: List-only view with table rows
**Enhancement**: Toggle between list and timeline/Gantt view showing bookings on a time axis. Makes availability gaps immediately visible.

### E-5: Real-time availability preview during date selection
**Current**: Availability checked after equipment selection (debounced 500ms)
**Enhancement**: As user changes dates, show a live count: "23 cameras available for this period" in the equipment picker header. Gives confidence before browsing.

### E-6: Booking detail — inline date editing
**Current**: Dates are read-only on detail page. Must open edit sheet.
**Enhancement**: Click date → inline DateTimePicker (like title editing already works). Saves on blur.

### E-7: Progress indicators for multi-step creation
**Current**: Single form with all fields visible
**Enhancement**: Subtle step indicator: "1. Details → 2. Equipment → 3. Confirm" — gives users a sense of progress and reduces perceived complexity.

### E-8: Scan page — audio feedback option
**Current**: Haptic vibration only
**Enhancement**: Optional beep sound on successful scan (common in warehouse/inventory apps). Toggle in settings.

---

## 4. FLOW IMPROVEMENTS

### Current Creation Flow
```
1. Click "New checkout"
2. See all fields at once (title, user, location, dates, equipment picker expanded)
3. Fill fields in any order
4. Click "Create checkout"
5. Booking created immediately (no review)
6. Sheet opens with booking details
```

### Recommended Creation Flow
```
1. Click "New checkout" (or press N)
2. Step 1 — Details: Title, dates, location (smart defaults pre-filled)
   → "Next: Add equipment"
3. Step 2 — Equipment: Picker with availability based on selected dates
   → "Review booking"
4. Step 3 — Confirm: Summary card showing all selections
   → "Confirm checkout" (primary) or "Back" (secondary)
5. Success: Toast with ref number + sheet opens
```

### Current Check-in Flow
```
1. Navigate to booking detail
2. Click "Check in" → redirects to /scan
3. Click "Tap to start camera"
4. Scan each item
5. When all scanned → celebration overlay
6. Click "Complete check-in"
7. Redirect to booking detail (now COMPLETED)
```

### Recommended Check-in Flow
```
1. Navigate to booking detail
2. Click "Check in" → redirects to /scan
3. Camera auto-starts immediately (no tap needed)
4. Scan each item (audio + haptic feedback)
5. When all scanned → celebration + auto-complete after 3s countdown
   (with "Cancel auto-complete" option)
6. Redirect to booking detail (COMPLETED) with success toast
```

---

## 5. MICROCOPY REWRITES

### Buttons

| Before | After | Rationale |
|--------|-------|-----------|
| `Create checkout` | `Check out equipment` | Intent-driven, describes outcome |
| `Create reservation` | `Reserve equipment` | Intent-driven |
| `Creating...` | `Checking out...` | Matches new label |
| `Start checkout` (convert) | `Convert to checkout` | Clearer action |
| `Save changes` (edit) | `Update booking` | Specific to context |
| `Save equipment` | `Update equipment list` | Specific |
| `Done adding` (equipment) | `Confirm selection` | Clearer completion signal |
| `+ Add items` | `Browse equipment` | Less technical |
| `Complete Checkout` (scan) | `Confirm all items scanned` | Reduces anxiety |
| `Tap to start camera` | `Start scanning` | Simpler |

### Confirmation Dialogs

| Before | After |
|--------|-------|
| "Cancel this checkout? This action cannot be undone." | "Cancel this checkout? All equipment will be released and the booking closed permanently." |
| "Convert this reservation to a checkout? The reservation will be cancelled and a new checkout created." | "Ready to check out this equipment? This will activate the reservation and start tracking return dates." |
| "Complete check in? Any items not yet returned will be flagged." | "Finalize check-in? Any items not scanned will be marked as missing and flagged for follow-up." |

### Error Messages

| Before | After |
|--------|-------|
| "Title is required" | "Give this booking a name" |
| "User is required" | "Select who's checking out this equipment" |
| "Location is required" | "Choose a pickup location" |
| "Failed to create checkout" | "Couldn't create this checkout — please try again" |
| "Network error — please try again." | "Connection lost — check your network and try again" |
| "This item is not part of this checkout" | "This item isn't on this checkout's list — scan an item from the list below" |

### Empty States

| Before | After |
|--------|-------|
| "No checkouts found" / "Try adjusting your search or filters." | "No checkouts match your filters" / "Try a different search term or clear filters to see all checkouts." |
| "No equipment in this booking" | "No equipment added yet — use the picker to add items" |
| "Failed to load checkout details." | "Couldn't load this checkout — tap to retry" |

### Labels

| Before | After |
|--------|-------|
| "From" / "To" (dates) | "Pickup" / "Return by" (checkout) or "Start" / "End" (reservation) |
| "Tie to event" | "Link to an event" |
| "Sport (optional)" | "Sport" (just make it obviously optional via placeholder) |
| "User" (requester field) | "Checked out to" (checkout) or "Reserved for" (reservation) |

---

## 6. STATE HANDLING AUDIT

### Loading States — Current Assessment

| View | Pattern | Quality |
|------|---------|---------|
| Booking list | SkeletonTable (6 rows) | Good |
| Booking detail page | Multi-element skeleton | Good |
| Booking details sheet | Spinner | Acceptable |
| Equipment picker availability | Debounced 500ms, no visual | Needs shimmer/skeleton |
| Action buttons | Text change ("Saving...") | Good |
| Scan page | "Loading checkout details..." text | Needs skeleton |

### Error States — Gaps Found

| Scenario | Current Handling | Needed |
|----------|-----------------|--------|
| `/api/me` fails | Silent (empty catch) | Banner + retry |
| Draft load fails | Silent | Toast notification |
| Draft save fails | Silent | Warning toast |
| Event fetch fails | Silent | Inline retry |
| Booking not found (404) | Generic message | Distinct 404 vs network |
| Equipment options fail | Shows error + retry | Good |
| Conflict on create (409) | Shows conflict list | Add "remove conflicting" action |
| Scan session start fails | Toast (low visibility) | Banner (persistent) |

### Success States — Assessment

| Action | Feedback | Quality |
|--------|----------|---------|
| Create booking | Sheet opens with new booking | Needs toast/animation |
| Edit booking | Toast "Booking updated" | Good |
| Extend booking | Toast with duration | Good |
| Cancel booking | Toast | Good |
| Check in items | Toast with count | Good |
| Complete checkout scan | Celebration overlay + redirect | Excellent |
| Draft saved | Toast "Draft saved" | Good |

---

## 7. TRUST & CONFIDENCE GAPS

### "Did this actually book?"
- **Current**: Form closes + sheet opens. No explicit confirmation.
- **Fix**: Add success toast with ref number. Keep sheet open with clear "Booking confirmed" state.

### "Is this time still available?"
- **Current**: Availability checked on equipment selection, but not on the date fields themselves.
- **Fix**: Show availability summary as dates change: "15 cameras, 8 lenses available for Mar 25-27"

### "What happens if I close this form?"
- **Current**: Draft auto-saves silently. User doesn't know.
- **Fix**: Show "Draft auto-saved" indicator near form header (like Google Docs "All changes saved").

### "Did my check-in go through?"
- **Current**: Good — celebration overlay + toast + status change.
- **Assessment**: This is the strongest trust signal in the app. Extend this pattern to booking creation.

### "Can I undo this?"
- **Current**: Cancel/check-in are permanent with no undo.
- **Fix**: Add undo window for check-in (10s). For cancel, the confirmation dialog is sufficient.

---

## Priority Matrix

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| C-1: No create confirmation | High | Medium | P0 |
| C-2: Silent auth failures | High | Low | P0 |
| C-3: Invisible draft save failures | High | Low | P0 |
| C-4: Non-actionable conflict errors | Medium | Medium | P1 |
| C-5: 404 vs network error | Medium | Low | P1 |
| F-1: Inline create on list page | Medium | High | P2 |
| F-2: Equipment picker expanded default | Medium | Low | P1 |
| F-3: Native datetime inputs | Low | Medium | P2 |
| F-4: "Tie to event" cognitive load | Medium | Low | P1 |
| F-6: Quick-extend surface area | Low | Low | P2 |
| F-8: Scan auto-start camera | Medium | Low | P1 |
| F-9: No check-in undo | Medium | Medium | P2 |
| Microcopy rewrites | Medium | Low | P1 |
| E-1: Create success celebration | Low | Low | P2 |
| E-3: Recently used equipment | Medium | Medium | P2 |

---

## Recommended Implementation Order

### Sprint 1: Trust & Safety (P0)
1. Add booking creation confirmation step (C-1)
2. Surface all silent failures as user-visible feedback (C-2, C-3)
3. Microcopy rewrites for buttons and errors

### Sprint 2: Friction Reduction (P1)
4. Collapse equipment picker by default (F-2)
5. Simplify "Tie to event" → optional collapsed section (F-4)
6. Make conflict errors actionable (C-4)
7. Distinguish 404 vs network errors (C-5)
8. Auto-start camera on scan page (F-8)

### Sprint 3: Polish (P2)
9. Creation success celebration (E-1)
10. Quick-extend in action bar (F-6)
11. Check-in undo window (F-9)
12. "Recently used" equipment tab (E-3)
