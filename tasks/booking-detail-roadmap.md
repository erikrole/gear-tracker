# BookingDetailPage Roadmap (V1 → V2 → V3)

## Document Control
- Page: `BookingDetailPage` (`src/app/(app)/bookings/BookingDetailPage.tsx`)
- Routes: `/checkouts/[id]` (kind=CHECKOUT), `/reservations/[id]` (kind=RESERVATION)
- Created: 2026-03-24
- Status: Analysis only — no code changes

---

## Current State Assessment

### What it does today
The BookingDetailPage is a unified detail view serving both checkouts and reservations via a `kind` prop. It renders:

1. **Header** — Editable `InlineTitle`, status Badge, ref number (copy-to-clipboard), urgency countdown Badge, action buttons
2. **Info Card** (left column) — SaveableField rows: title, location, from/to dates, user (avatar), creator (avatar), notes, created date. Mixed-location Alert.
3. **Equipment Card** (right column) — Serialized item rows with thumbnails, bulk item rows, checkin progress bar, search (3+ items), return controls (checkbox selection, bulk quantity stepper), context menus
4. **History Section** — Collapsible audit log with ToggleGroup filter (All/Booking/Equipment), field-level diffs, natural-language labels
5. **Edit Sheet** — Full BookingDetailsSheet for multi-field editing (title, dates, equipment, user)

### What works well (keep in all versions)
- Unified component for both kinds — no feature drift
- Optimistic UI for check-in (items show "returned" immediately)
- Live countdown timer with urgency-appropriate intervals
- Ref number copy-to-clipboard
- Inline title editing with save feedback
- Action gating via `allowedActions` from server
- Auto-select all returnable items
- Collapsible history with preview line when collapsed
- Keyboard shortcut (E to edit)
- Responsive layout (stacks on mobile)

### What's missing or broken
1. **No event context** — Schema has `eventId`, `sportCode`, `event` relation, `shiftAssignmentId`, but none are surfaced. Staff can't see which game this checkout is for.
2. **No source reservation link** — `sourceReservationId` exists but isn't shown. When a checkout was created from a reservation, there's no link back.
3. **No derived checkout links** — Reservations don't show which checkouts were created from them (`derivedCheckouts` relation).
4. **No scan session history** — ScanEvent/ScanSession data exists but isn't shown. Staff can't see who scanned what and when.
5. **No shift context** — `shiftAssignment` relation exists but isn't surfaced on the detail page.
6. **No accessory visibility** — Items with parent-child relationships (D-023) don't show accessories.
7. **No item images in info card** — Only equipment tab shows thumbnails.
8. **No print/share** — No way to generate a printable packing list or share a link.
9. **No conflict preview** — For BOOKED reservations, no way to see if conflicts have appeared since creation.
10. **Info card fields are mostly read-only** — Only title and notes are inline-editable; dates, location, user require the full edit sheet.
11. **No related bookings** — Can't see other bookings for the same user or event.
12. **Bulk item return UX is manual** — Must type quantity; no "return all" shortcut.

### Schema data not surfaced
- `Booking.eventId` / `event` (CalendarEvent: summary, startsAt, opponent, sportCode, isHome)
- `Booking.sportCode`
- `Booking.sourceReservationId` / `sourceReservation`
- `Booking.derivedCheckouts[]`
- `Booking.shiftAssignmentId` / `shiftAssignment` (→ Shift → ShiftGroup → CalendarEvent)
- `Booking.scanEvents[]` (actor, phase, scanValue, success, timestamp)
- `Booking.scanSessions[]` (phase, status, startedAt, completedAt)
- `Booking.overrides[]` (actor, reason, details)
- `BookingSerializedItem.asset.accessories[]` (parent-child from D-023)
- `BookingSerializedItem.asset.kitMemberships[]`

### Roles and mobile
- **ADMIN/STAFF**: Full mutation access. Desktop-primary but mobile-capable.
- **STUDENT**: View-only on others' bookings; own bookings allow edit/checkin/extend. Mobile-primary (phone in the field).
- **Mobile**: Layout stacks correctly (`flex-col sm:flex-row`). Touch targets adequate. Row action menus always visible on mobile. Urgency badges prominent.

---

## V1 — Core (Current + Event Context + Links)

**Principle**: Surface the data that's already in the schema but hidden. Make the page self-contained — staff shouldn't need to navigate elsewhere to understand what this booking is about.

### Features included
1. **Event context card** — When `eventId` is set, show event summary, opponent, sport, home/away, event date/time in the Info card below dates. Link to `/schedule` with event focused.
2. **Sport badge** — When `sportCode` is set (even without event), show sport badge in status strip.
3. **Source reservation link** — For checkouts with `sourceReservationId`, show "Created from RV-XXXX" link in Info card.
4. **Derived checkouts list** — For reservations, show "Checkouts from this reservation" section listing linked checkouts with status and ref number.
5. **Shift context** — When `shiftAssignmentId` is set, show shift area and time window in a subtle banner or Info card row.
6. **Bulk "return all" button** — For bulk items with outstanding quantities, add "Return all" shortcut button next to the quantity stepper.
7. **Conflict indicator** — For BOOKED reservations, show a warning badge if any items now have scheduling conflicts (reuse existing `/api/availability/check` endpoint).

### What's NOT included yet
- Inline date/user editing (stays in edit sheet)
- Scan session history
- Print/share
- Related bookings
- Accessory display
- Overrides display
- Real-time updates

### shadcn components
- Existing: Card, Badge, Button, Input, Checkbox, DropdownMenu, Alert, Collapsible, ToggleGroup, Avatar, Progress, Skeleton, Empty, DateTimePicker, Separator
- New: `Tooltip` (for event context hover details)

### API routes
- **Modified**: `GET /api/bookings/[id]` — include `event` (summary, sportCode, opponent, isHome, startsAt, endsAt), `sourceReservation` (id, refNumber, title), `derivedCheckouts` (id, refNumber, status, title), `shiftAssignment` (area, shift.startsAt, shift.endsAt), `sportCode`
- **Existing**: `POST /api/availability/check` — for conflict indicator on BOOKED reservations

### RBAC
- All roles see event context, sport badge, source reservation link, derived checkouts
- Conflict indicator visible to all roles (read-only)
- "Return all" button follows same permissions as existing return controls (staff+ or owner on OPEN checkouts)

### Loading, error, and empty states
- Event context: "No event linked" in muted text (not an error)
- Source reservation: hidden when null (no empty state needed)
- Derived checkouts: "No checkouts created yet" empty state
- Conflict indicator: hidden when no conflicts detected

### Mobile behavior
- Event context renders as a compact card row (no extra column)
- Sport badge and ref number wrap naturally in status strip
- Derived checkouts list uses same compact row style as equipment items

### Schema changes
- None — all data exists in current schema

---

## V2 — Enhanced (Faster Editing, Scan Visibility, Cross-Page Connections)

**Principle**: Reduce friction on the highest-frequency operations. Surface operational data (scans, overrides) that currently requires database queries to find.

### New features
1. **Inline date editing** — Click-to-edit From/To dates in Info card using `DateTimePicker` (no need to open full edit sheet for date changes). Conflict check on save.
2. **Inline user reassignment** — Click-to-change requester in Info card using `Command` combobox (search users). Staff+ only.
3. **Scan session timeline** — New collapsible section below Equipment showing scan events grouped by session: who scanned, what phase (checkout/checkin), timestamps, success/failure count. Replaces "Activity" for scan-level detail.
4. **Override log** — Show override events in the History section with distinct styling (amber background, reason text). Staff can see when someone overrode a location exception or forced a status change.
5. **Accessory display** — Equipment rows for items with accessories show expandable sub-rows listing child items with their status (maintenance flag visible).
6. **Related bookings sidebar** — "Other bookings" collapsible section showing the requester's other active bookings (OPEN/BOOKED) with quick links. Helps staff see full picture.
7. **Quick-duplicate for checkouts** — Add duplicate action to checkout detail (currently reservation-only). Creates a new DRAFT with same items.
8. **Equipment reorder** — Drag-to-reorder equipment items within the booking (visual preference, not functional ordering).
9. **Optimistic extend** — Show new end date immediately before API confirms, with rollback on failure.
10. **Stale-data detection** — Use Page Visibility API to auto-refresh when tab becomes visible after backgrounding (addresses GAP-12).

### Smarter defaults
- When extending, pre-fill most common extension duration based on booking kind (checkouts: +1 day, reservations: +1 week)
- Remember last-used history filter in localStorage

### Cross-page connections
- Equipment rows link to item detail page (already exists) — enhance with "View all bookings" for that item
- Event context links to schedule page with event focused
- User avatars link to user profile page

### Performance improvements
- `useBookingDetail` hook: add SWR-like revalidation on focus (stale-while-revalidate pattern)
- Optimistic updates for inline field edits (title, notes, dates, user)
- Background refresh after extend/cancel/checkin (already implemented via `reload()`)

### V1 features enhanced
- Info card: dates and user become inline-editable (V1 was read-only)
- History section: gains override entries and scan-level detail
- Equipment tab: gains accessory sub-rows

### V1 features left alone
- Header layout and action buttons
- Ref number copy-to-clipboard
- Extend panel UX (quick-extend buttons stay)
- Bulk item return controls

### shadcn components
- New: `Command` (user search combobox), `Collapsible` (scan sessions), `Separator` (section dividers)

### API routes
- **Modified**: `GET /api/bookings/[id]` — include `scanSessions` (with nested `scanEvents`), `overrides` (actor, reason, createdAt)
- **New**: `GET /api/bookings/[id]/related` — returns requester's other active bookings (limit 5)
- **New**: `POST /api/checkouts/[id]/duplicate` — clone checkout as DRAFT

### Schema changes
- None — all data exists in current schema

---

## V3 — Advanced (Predictive, Automated, Intelligent)

**Principle**: The page anticipates needs and automates repetitive patterns. Staff spend less time on routine decisions.

### Predictive features
1. **Smart extend suggestions** — When a booking is approaching its end time, suggest extend duration based on: (a) event end time if event-linked, (b) historical extension patterns for this requester, (c) shift end time if shift-linked. Show as a single "Extend to [time]" CTA.
2. **Equipment suggestions** — When viewing a reservation with a camera body but no batteries, show a contextual "Missing equipment?" hint linking to edit with the guidance rule pre-highlighted.
3. **Return prediction** — For OPEN checkouts, show predicted return time based on event schedule and historical patterns. "Expected back: Today 5:30 PM (based on game end)."

### Automation
4. **Auto-complete on full return** — When all items are returned via scan, auto-transition to COMPLETED without requiring "Complete check in" action (configurable setting).
5. **Batch extend** — Select multiple bookings from a user's profile or dashboard and extend all at once.
6. **Auto-flag overdue** — When a booking becomes overdue, automatically create an override event noting the escalation, visible in history.

### Advanced views
7. **Equipment utilization mini-chart** — For each serialized item in the booking, show a small availability timeline (next 7 days) showing when it's booked. Helps staff decide whether to extend or return.
8. **Booking cost estimate** — If financial fields are populated on items (D-018), show total estimated value of equipment in the booking. Useful for accountability.
9. **Diff view for edits** — When viewing the edit sheet, show a before/after comparison of changes before saving.

### Real-time features
10. **Live scan feed** — When a scan session is active for this booking, show real-time scan events as they happen (WebSocket or SSE). Staff at the desk can watch items being scanned in the field.
11. **Collaborative presence** — Show avatars of other users currently viewing this booking detail page. Prevents conflicting edits.

### Integration with other system domains
12. **Kit-aware equipment display** — When Kit management ships (D-020), group equipment by kit membership. Show "Camera Kit A" with all member items nested.
13. **Notification history** — Show which notifications were sent for this booking (reminders, escalations) and when.
14. **Game-Day Command Center link** — When this booking is part of a game-day event, link to the Command Center view showing all bookings for that event.

### API routes
- **New**: `GET /api/bookings/[id]/utilization` — equipment availability timelines
- **New**: `GET /api/bookings/[id]/notifications` — notification history for this booking
- **New**: WebSocket/SSE endpoint for live scan feed
- **Modified**: `GET /api/bookings/[id]` — include kit membership grouping, notification count

### Schema changes
- None for V3 features — all use existing schema
- Kit display depends on D-020 Kit management UI shipping first

---

## Dependencies

### V1
- **Schema changes**: None
- **Other pages**: None (self-contained)
- **Shared components**: Existing `Tooltip` from `src/components/ui/tooltip.tsx`
- **API routes**: Modify `GET /api/bookings/[id]` to include event, sourceReservation, derivedCheckouts, shiftAssignment, sportCode in the response
- **Reusable**: `POST /api/availability/check` for conflict indicator

### V2
- **Schema changes**: None
- **Other pages**: User profile page must exist (for user avatar links)
- **Shared components**: `Command` combobox (already in `src/components/ui/command.tsx`)
- **API routes**: `GET /api/bookings/[id]/related` (new), scan session data in main GET response
- **Extractable**: `InlineDateField` component (reusable inline date picker with save-on-change)

### V3
- **Schema changes**: None
- **Other pages**: Kit management UI (D-020) must ship for kit-aware display
- **Shared components**: Chart/timeline component for utilization view
- **API routes**: Utilization endpoint, notification history endpoint, WebSocket infrastructure
- **Infrastructure**: WebSocket or SSE support on Vercel (may require upgrade from Hobby)

---

## Risks

### Scope creep — V1 into V2
- **Inline date editing** is tempting to add in V1 but requires conflict checking on save, which is complex. Keep in V2.
- **Scan session history** is appealing but adds a new data-fetch dimension. Keep in V2.
- **Accessory sub-rows** are visually simple but require API changes to include nested accessories. Keep in V2.

### YAGNI concerns — V2
- **Equipment reorder** — visual preference with no functional impact. May not be worth the drag-and-drop complexity. Evaluate after V1 user feedback.
- **Quick-duplicate for checkouts** — checkouts are typically unique per event. Duplication may not match the workflow. Monitor reservation duplicate usage first.

### V3 over-engineering
- **Live scan feed** sounds impressive but Vercel's serverless model doesn't naturally support WebSockets. Would require infrastructure changes or polling fallback.
- **Collaborative presence** — with a small team (5-10 concurrent users), conflicts are rare. Cost/benefit may not justify the complexity.
- **Return prediction** — requires historical data analysis that may not be reliable with small dataset in early usage.

### Tight coupling
- V2's inline editing depends on the same PATCH endpoint as V1's edit sheet. Both must coexist cleanly — inline edits should not break the sheet's stale-data detection.
- V3's kit-aware display is blocked by D-020. Don't start V3 kit work until D-020 ships.

---

## Build Order

### V1 (1-2 sessions)
1. **API enrichment** — Modify `getBookingDetail` service to include event, sourceReservation, derivedCheckouts, shiftAssignment, sportCode in the response payload. Update `BookingDetail` type.
2. **Info card: event context** — Add event summary row to `BookingInfoTab` with sport badge, opponent, home/away, link to schedule.
3. **Info card: source reservation** — Add "Created from" link for checkouts with sourceReservationId.
4. **Info card: shift context** — Add shift area/time row when shiftAssignmentId is set.
5. **Status strip: sport badge** — Add sport badge to status strip when sportCode is set.
6. **Derived checkouts section** — For reservations, add collapsible section listing derived checkouts.
7. **Bulk "return all"** — Add "Return all" button to bulk item rows.
8. **Conflict indicator** — For BOOKED reservations, call availability check and show warning badge on equipment with new conflicts.
9. **Test and verify** — Verify all three roles, both booking kinds, mobile layout.

### V2 (2-3 sessions)
1. **API: scan sessions + overrides** — Add scan session and override data to GET response.
2. **Inline date editing** — `InlineDateField` component with conflict check on save.
3. **Inline user reassignment** — Command combobox in Info card.
4. **Scan session timeline** — New collapsible section.
5. **Override log** — Styled entries in History section.
6. **Accessory sub-rows** — Expandable child items in equipment rows.
7. **Related bookings** — API endpoint + collapsible section.
8. **Stale-data detection** — Page Visibility API refresh in `useBookingDetail`.
9. **Test and verify** — All roles, both kinds, mobile, inline edit conflicts.

### V3 (3-4 sessions)
1. **Smart extend suggestions** — Prediction logic based on event/shift/history.
2. **Equipment utilization timeline** — API + mini-chart component.
3. **Auto-complete on full return** — Configurable setting + auto-transition.
4. **Booking cost estimate** — Sum financial fields.
5. **Kit-aware equipment display** — After D-020 ships.
6. **Notification history** — API + section.
7. **Live scan feed** — Evaluate infrastructure feasibility first.
