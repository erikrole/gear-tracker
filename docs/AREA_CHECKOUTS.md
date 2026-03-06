# Checkouts Area Scope (V1 Hardened)

## Document Control
- Area: Checkouts
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
- Status: Active
- Version: V1

## Direction
Optimize handoff and return execution so daily operators can move fast without data integrity regressions.

## Core Rules
1. Checkout records use the unified Booking model and states: `BOOKED`, `OPEN`, `COMPLETED`, `CANCELLED`.
2. Event tie-in defaults ON at creation.
3. Event link is optional for ad hoc checkouts.
4. Status and availability logic remain derived from allocations, never authoritative stored status.
5. Role and ownership controls follow `AREA_USERS.md`.

## V1 Workflow

### Create Checkout
1. Start from `New Checkout`.
2. Event tie-in defaults ON.
3. If event tie-in ON:
   - Select sport
   - Select event in next 30 days
   - Prefill title, time window, and location from event context
4. Select borrower/owner.
5. Select equipment (serialized and bulk).
6. Save as:
   - `OPEN` for immediate handoff
   - `BOOKED` for future handoff

### Edit Checkout
1. User opens checkout detail.
2. Editable fields respect role and ownership.
3. Mutations must preserve overlap and transaction constraints.

### Extend Checkout
1. `OPEN` checkouts can be extended if no conflicts exist.
2. Conflict must show blocking item and conflicting booking window.

### Check In
1. Partial check-in allowed for multi-item allocations.
2. Checkout remains `OPEN` until all allocated items are returned.
3. Auto-transition to `COMPLETED` when full return is confirmed.

### Cancel Checkout
1. Allowed only by policy and role.
2. Canceled records remain auditable.
3. No hard delete.

## Action Matrix by State

### `BOOKED`
- Allowed actions:
  - View
  - Edit
  - Cancel
  - Convert to `OPEN`

### `OPEN`
- Allowed actions:
  - View
  - Extend
  - Edit
  - Check in (partial or full)

### `COMPLETED`
- Allowed actions:
  - View only

### `CANCELLED`
- Allowed actions:
  - View only

## List and Detail UX Requirements
1. Checkout list is action-first and grouped by urgency.
2. Row click opens BookingDetailsSheet.
3. Desktop shows context actions directly.
4. Mobile uses action sheet with same behavior.
5. Event badge is informational only and must not block operations if source event changes.
6. Mobile list cards and quick actions follow `AREA_MOBILE.md`.

## Bug Traps and Mitigations

### Trap: Double submit creates duplicate checkouts
- Mitigation:
  - Idempotency token on create requests.
  - Disable submit during in-flight mutation.

### Trap: Extend passes UI but fails at commit due to overlap race
- Mitigation:
  - Keep SERIALIZABLE mutation handling.
  - Retry-safe error path with explicit conflict feedback.

### Trap: Partial check-in incorrectly flips to `COMPLETED`
- Mitigation:
  - Completion state requires zero active allocations.
  - Add invariant check before state transition.

### Trap: Stale event metadata blocks checkout operations
- Mitigation:
  - Treat event link as contextual metadata.
  - Checkout edit/check-in flows cannot depend on event feed availability.

### Trap: Student edits non-owned checkout via direct request
- Mitigation:
  - Server-side ownership enforcement on every mutation.
  - Audit denied attempts.

## Edge Cases
- No events in next 30 days for selected sport.
- Event missing opponent, venue, or end time.
- Cross-midnight checkouts and DST boundaries.
- Multi-location allocations on one checkout.
- Borrower reassignment mid-lifecycle.
- Check-in at alternate location due to approved exception.

## Acceptance Criteria
1. Event-linked checkout can be created without manual title/date entry.
2. User can create ad hoc checkout without event linkage.
3. State-based actions are enforced exactly by lifecycle state.
4. Partial check-in does not complete booking until all items are returned.
5. Extend flow blocks cleanly with actionable overlap details.
6. Permission and ownership gates match `AREA_USERS.md`.
7. Every mutation emits audit records with actor and diff context.

## Dependencies
- Event normalization read model from `AREA_EVENTS.md`.
- Equipment selection behavior from `AREA_ITEMS.md`.
- Permission policy from `AREA_USERS.md`.
- Integrity constraints and audit requirements from `AREA_PLATFORM_INTEGRITY.md`.
- Mobile operations contract from `AREA_MOBILE.md`.

## Out of Scope (V1)
1. Booking engine rewrite.
2. Kiosk mode.
3. Advanced automation flows.

## Developer Brief (No Code)
1. Implement deterministic checkout creation path with event-default and ad hoc fallback.
2. Enforce state transition rules and action gating by state, role, and ownership.
3. Implement safe extend and check-in flows with overlap-aware conflict handling.
4. Preserve transaction integrity and derived-status invariants in every mutation.
5. Add regression coverage for race conditions, partial returns, and permission bypass attempts.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 workflow, logic, and failure-mode spec.
- 2026-03-02: Added explicit mobile contract dependency and list-action alignment.
