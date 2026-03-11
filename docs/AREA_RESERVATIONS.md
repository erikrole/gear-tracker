# Reservations Area Scope (V1 Hardened)

## Document Control
- Area: Reservations
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-11
- Status: Active — V1 Shipped (2026-03-10)
- Version: V1

## Direction
Keep reservation planning and checkout execution unified, predictable, and safe under concurrency.

## Core Rules
1. Reservations live in Booking with lifecycle states: `BOOKED`, `OPEN`, `COMPLETED`, `CANCELLED`.
2. Reservation creation typically starts as `BOOKED`.
3. Transition from `BOOKED` to `OPEN` represents active handoff start.
4. Cancel and archive patterns are used in V1. No hard delete.
5. Role and ownership controls follow `AREA_USERS.md`.

## V1 Workflow

### Create Reservation
1. Start from `New Reservation`.
2. Optional event linkage can prefill context fields.
3. Select owner, date window, location, and equipment.
4. Validate overlap and availability before commit.
5. Save as `BOOKED`.

### Edit Reservation
1. Allowed fields depend on role, ownership, and lifecycle state.
2. Edit must re-run conflict checks for changed windows/items.
3. Edit path remains fully auditable.

### Convert Reservation to Active Checkout
1. Action: `Start checkout` from reservation detail.
2. Transition: `BOOKED` -> `OPEN`.
3. Preserve allocation linkage and audit trail.

### Cancel Reservation
1. Allowed by role and policy.
2. Transition: `BOOKED` -> `CANCELLED`.
3. Canceled reservations remain visible for operations and audit.

## Reservation Detail Surface (V1)

### Header and Status Context
1. Show reservation title as primary heading.
2. Show state chip and reservation id.
3. Show due-to-checkout countdown when still `BOOKED`.
4. Primary CTA is `Proceed to check-out` when transition is valid.

### Tabs
1. `Info`: canonical reservation details and equipment.
2. `Attachments`: linked files relevant to reservation execution.
3. `History`: immutable event timeline from audit log.

### Info Panel Fields
1. Name
2. Location
3. From
4. To
5. User (owner)

### Equipment Panel
1. Show count and searchable list of reserved items.
2. Use `tagName` as primary item label.
3. Show quantity and key identity metadata.
4. Show inline conflict badge when item becomes unavailable, for example `Already reserved`.
5. Conflict badges must include reason and actionable next step.

## Reservations List Surface (V1)

### Top Bar Actions
1. `New reservation` primary CTA is always visible.
2. `Export` is visible to `STAFF` and `ADMIN`; hidden for `STUDENT`.
3. `Customize overview` is deferred in V1 unless low effort and no performance hit.

### Filters and Controls
1. Status scope control (default `Upcoming`).
2. Search field matches reservation name, owner, and reservation id.
3. Filter button opens advanced filters:
   - Sport
   - Location
   - Owner
   - Date range
4. Sort control defaults to earliest `From` datetime.
5. View toggle can support list/card modes if trivial; list mode is required.

### Table Columns (List Mode)
1. Selection checkbox
2. Name
3. From
4. To
5. Duration
6. User
7. Items (thumbnail strip + count fallback)

### Row Behavior
1. Row click opens reservation details.
2. Left-edge status color cue reflects reservation state.
3. Secondary line under name shows current state label (for example `Booked`).
4. Multi-select is allowed for future bulk actions; no bulk mutation actions in V1.
5. Mobile row interactions follow `AREA_MOBILE.md`:
   - Primary tap opens details.
   - Secondary actions open in action sheet.
   - Overdue or urgent states remain visually prioritized.

### Pagination and Density
1. Show total rows summary: `Showing X to Y of Z`.
2. Rows-per-page control defaults to 25.
3. Persist user rows-per-page preference per user/session when feasible.

## State Transition Rules
1. `BOOKED` -> `OPEN` allowed.
2. `BOOKED` -> `CANCELLED` allowed.
3. `OPEN` -> `COMPLETED` allowed when all items returned.
4. `OPEN` -> `CANCELLED` not allowed in normal flow; use return/check-in workflow.
5. `COMPLETED` and `CANCELLED` are terminal in V1.

## Action Matrix by State

Source of truth: `src/lib/services/booking-rules.ts` — `STATE_ACTIONS[RESERVATION]`

### `DRAFT`
- Allowed actions: Edit, Cancel
- Access: staff+ or owner

### `BOOKED`
- Allowed actions: Edit, Extend, Cancel, Convert to checkout
- Access: staff+ or owner

### `COMPLETED`
- Allowed actions: View only

### `CANCELLED`
- Allowed actions: View only

**Note**: Reservations do not use the `OPEN` state — they convert directly to a checkout (new `OPEN` booking linked via `sourceReservationId`).

## Actions Menu (V1 Shipped)
1. Edit — respects state + role gating
2. Proceed to check-out — converts `BOOKED` reservation to `OPEN` checkout
3. Extend — extends booking window (conflict-checked)
4. Cancel reservation — soft cancel, record preserved for audit
5. Deferred: Spotcheck creation, PDF generation, duplicate/clone

## Bug Traps and Mitigations

### Trap: Booking window edit bypasses conflict check
- Mitigation:
  - Run conflict check on every date, location, or item change.
  - Fail with explicit collision details.

### Trap: Concurrent edits cause silent overwrite
- Mitigation:
  - Preserve SERIALIZABLE behavior.
  - Add optimistic stale-write detection messaging where possible.

### Trap: Cancel on already-open handoff loses custody accountability
- Mitigation:
  - Disallow direct `OPEN` -> `CANCELLED` in normal path.
  - Require check-in completion path.

### Trap: Student edits non-owned reservation via deep link
- Mitigation:
  - Server-side ownership check on mutation endpoints.
  - Return consistent authorization error and audit event.

### Trap: Event record changed after reservation created
- Mitigation:
  - Reservation remains valid with stored contextual snapshot fields.
  - Event badge degrades gracefully if upstream event is missing.

### Trap: Reservation details and equipment state drift out of sync
- Mitigation:
  - Render item conflict badges from current availability checks.
  - Show stale-state notice and refresh action if read model is outdated.

### Trap: List results and detail state disagree after quick edits
- Mitigation:
  - Refresh affected list row after mutation success.
  - Show subtle syncing indicator when list is stale.

## Edge Cases
- Cross-midnight reservations and timezone conversions.
- Reservation spans multiple locations with exception approval.
- Owner reassigned after creation.
- Late edits close to handoff time.
- Reservation with mixed serialized and bulk equipment.
- Item shows in reservation list but is now unavailable at checkout time.
- Attachments exist but user lacks permission to download.
- Search query returns records user can view but not edit.
- Export requested by student role.
- Thumbnail image missing for one or more items in row.

## Acceptance Criteria
1. `BOOKED` reservations can transition to `OPEN` without data loss.
2. Edit operations revalidate conflicts for all relevant field changes.
3. `OPEN` records cannot be canceled directly in normal flow.
4. Permission and ownership enforcement matches `AREA_USERS.md`.
5. All transitions and edits emit audit records.
6. Terminal states are immutable in V1.
7. Reservation detail page exposes `Info`, `Attachments`, and `History` tabs.
8. Equipment panel surfaces item-level conflict badges with actionable guidance.
9. Actions menu behavior matches state and policy mapping.
10. Reservations list supports status scope, search, sort, and required columns.
11. `Export` visibility follows role policy.
12. List and detail views remain consistent after edit/cancel/start-checkout actions.

## Dependencies
- Booking and allocation constraints from `DECISIONS.md` (D-001, D-006, D-007).
- User permission model from `AREA_USERS.md`.
- Event context behavior from `AREA_EVENTS.md`.
- Mobile operations contract from `AREA_MOBILE.md`.

## Out of Scope (V1)
1. Multi-calendar external reservation sync.
2. Approval workflows beyond current tier model.
3. Reservation templates and assistants.

## Developer Brief (No Code)
1. Implement explicit transition guardrails for booking lifecycle states.
2. Enforce conflict revalidation for every reservation edit that impacts availability.
3. Prevent cancel misuse on active handoffs by enforcing check-in completion flows.
4. Preserve audit completeness for transitions, denials, and reassignment events.
5. Add regression coverage for concurrency races, permission bypass, and cross-midnight edits.
6. Implement reservation detail anatomy with tabbed context and searchable equipment panel.
7. Implement state-aware actions menu with clone/repeat behaviors and deferred items hidden.
8. Implement list page controls and row behavior from V1 list surface spec.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 workflow, logic, and transition spec.
- 2026-03-01: Added reservation detail-page and actions-menu behavior from Cheqroom context.
- 2026-03-01: Added reservations list-page controls, columns, and role-based export behavior.
- 2026-03-02: Added explicit mobile row-interaction contract alignment.
- 2026-03-11: Docs hardening — synced action matrix to shipped `booking-rules.ts`. Removed Cheqroom action mapping. Replaced "Reserve again"/"Repeat reservation" with deferred duplicate action. Added DRAFT state. Marked V1 as shipped.
