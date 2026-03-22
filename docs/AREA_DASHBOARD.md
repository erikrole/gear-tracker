# Dashboard Area Scope (V1 Ops-First)

## Document Control
- Area: Dashboard
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
- Status: Active
- Version: V1

## Direction
Make dashboard an action console for daily operations, not a reporting screen.

## Confirmed Product Decisions
1. Same dashboard layout for all users.
2. Primary focus is Check-outs and Reservations.
3. Overdue is visually red and prioritized.
4. Overdue banner includes inline highest-priority items.
5. Section row cap is 5, with `View all` for overflow.
6. Saved filters are deferred — not in V1.
7. No keyboard shortcut layer in V1.
8. Add a draft system for in-progress booking flows.
9. No standalone Upcoming Events section in dashboard V1.
10. Calendar sync remains backend support for event-linked reservations/checkouts.

## Information Architecture (Top to Bottom)
1. Overdue Banner (global)
2. Action Lanes
   - Check-outs needing action
   - Reservations needing action
3. My Gear in Custody cards
4. Drafts section (recover in-progress reservation/checkout drafts)
5. Filter chips (Sport, Location) are deferred — not in V1

## Section Specs

### 1) Overdue Banner
- Trigger: show when overdue count > 0.
- Style: red severity treatment.
- Content:
  - Overdue total
  - Inline top overdue items (max 3)
  - CTA: `View all overdue`
- Behavior:
  - Clicking inline item opens its BookingDetailsSheet.

### 2) Action Lane: Check-outs
- Purpose: immediate handling of active and risky check-outs.
- Grouping order:
  1. Overdue
  2. Due today
  3. Open (not overdue)
- Sorting: oldest overdue first, then nearest due time.
- Row fields:
  - Booking title
  - Borrower
  - Due time
  - Status
  - Linked event badge (if present)
- Row actions:
  - View
  - Extend
  - Check in

### 3) Action Lane: Reservations
- Purpose: operational prep for near-term reservations.
- Window: next 7 days.
- Grouping order:
  1. Today
  2. Upcoming (within 7 days)
- Sorting: soonest start time first.
- Row fields:
  - Reservation title
  - Owner
  - Start time
  - Status
  - Linked event badge (if present)
- Row actions:
  - View
  - Edit
  - Cancel

### 4) My Gear in Custody
- Purpose: personal accountability and due urgency.
- Card fields:
  - `tagName` primary
  - Booking/reservation title
  - Due datetime
  - Countdown to due
  - Suggested return location
- Sorting: overdue first, then nearest due.
- Empty state: `You currently have no gear checked out`.

### 5) Drafts
- Purpose: recover interrupted in-progress work.
- Scope:
  - Reservation drafts
  - Checkout drafts
- Row fields:
  - Draft type
  - Last edited timestamp
  - Owner
- Actions:
  - Resume
  - Discard

## Interaction Rules
- Desktop:
  - Row hover reveals actions.
  - Row click opens detail sheet.
- Mobile:
  - Row tap opens action sheet.
  - Keep critical tap targets at 44px minimum.
  - Follow shared mobile interaction contract in `AREA_MOBILE.md`.

## Permissions and Visibility
1. All users can view dashboard rows for reservations and check-outs.
2. All users can book gear.
3. All users can edit their own reservations.
4. Students can edit only their own reservations and check-outs.
5. Staff can add and edit all users, reservations, check-outs, and items.
6. Admins can do everything staff and students can do.
7. Dashboard action visibility must honor these rules per row and ownership.

## Explicit V1 Non-Goals
1. Chart-heavy widgets and analytics-first layout.
2. Standalone Upcoming Events dashboard section.
3. Keyboard shortcut layer.

## Acceptance Criteria
1. User can reach a checkout or reservation action in one click/tap from dashboard.
2. Overdue banner and overdue list counts remain consistent.
3. Check-outs and Reservations lanes each show max 5 rows plus `View all`.
4. Reservations lane only includes records within next 7 days.
5. Permission-restricted actions are hidden or disabled correctly.
6. Drafts can be resumed without losing entered data.

## Edge Cases
- No overdue items: banner hidden.
- No rows in a lane: empty state with primary action CTA.
- Cross-midnight and DST countdown behavior.
- Booking linked to deleted or changed event source record.
- Mixed-location return suggestion for multi-location allocations.
- Temporary stale data causing count mismatches: show refresh status.

## Dependencies
- Booking and allocation read models.
- Reservation and checkout action policy rules.
- Event linkage metadata on bookings (for badges only).
- Draft persistence model for in-progress flows.
- Role policy from `AREA_USERS.md`.
- Mobile operations contract from `AREA_MOBILE.md`.

## Developer Brief (No Code)
1. Replace chart-first dashboard sections with the V1 ops-first section order.
2. Implement lane read models with deterministic grouping, sorting, and 5-row cap.
3. Implement overdue banner with inline top overdue items and detail routing.
4. Add Drafts read/write/recovery behavior for reservation and checkout flows.
5. Enforce role-based action visibility at row-action level.
6. Add responsive interaction parity (desktop hover actions, mobile action sheets).
7. Add regression tests for permissions, window filtering (7 days), and overdue consistency.

## Change Log
- 2026-03-01: Rewritten as concrete V1 ops-first dashboard spec with no standalone upcoming-events section.
- 2026-03-01: Added permission model and draft-system requirements.
- 2026-03-02: Linked dashboard mobile behavior to shared `AREA_MOBILE.md` contract.
- 2026-03-11: Docs hardening — resolved hedged features: saved filters → deferred, filter chips → deferred. Removed ambiguous "if low effort" qualifiers.
- 2026-03-11: **V2 shipped** — two-column split layout (global ops left, personal accountability right). Live countdown timers on "In My Possession" items. Overdue banner with click-through to booking detail. Donut charts removed (future Reports page). Upcoming Events section added. All roles see all data; students read-only. Mobile stacks right column first.
- 2026-03-12: **V3 dashboard redesign** — Column reorganization: left = "My Gear" (possession, my checkouts, my reservations), right = "Team Activity" (team checkouts excl. user, team reservations excl. user, events). Stat strip with 4 glanceable KPIs (checked out, overdue, reserved, due today). Overdue banner redesigned: solid Wisconsin red background, white text, pulsing dot, stacked item list with elapsed times, "View all overdue" link. Inline overdue badges on checkout rows ("3d overdue" red pill). Due-today row treatment with amber left border. "View all N →" overflow links on capped sections. Quick action buttons (New checkout, New reservation) in page header. Mobile: My Gear column stacks first, stat strip goes 2×2.
- 2026-03-16: **Drafts section shipped** — DRAFT booking persistence via `/api/drafts` CRUD. Dashboard shows Drafts card in My Gear column with Resume/Discard actions. Create flow auto-saves as draft on cancel. Draft pre-fills form on resume via `?draftId=` param. Draft deleted on successful booking creation. Closes GAP-2.
- 2026-03-16: Booking reference numbers (D-024) — refNumber badge shown on all dashboard booking rows (my checkouts, my reservations, team checkouts, team reservations).
- 2026-03-17: **My Shifts widget** — shows upcoming shift assignments with gear status (none/reserved/checked out) in left column. "Reserve gear" action links to checkout creation pre-filled with event context.
- 2026-03-22: **Dashboard UX hardening** — Draft discard requires confirmation dialog + toast feedback. Error state differentiates 401 (redirect to login) from network/server errors. Refresh indicator (progress bar) after sheet mutations. Due date labels inline on all checkout rows. Ref numbers shown as badges. My Shifts reordered above Drafts. My Reservations gets "View all" overflow. Welcome banner condition patched (checks reservations/drafts/shifts). Overdue banner uses API-provided initials. Microcopy pass: personalized empty states, "Prep gear" label, "Resolve all overdue" CTA.
