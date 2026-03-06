# Events Area Scope

## Document Control
- Area: Events
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
- Status: Active

## Direction
Make athletics schedule data the operational backbone for booking and checkout workflows.

## Scope Clarifier
1. Event sync supports booking creation context and linkage.
2. V1 does not require a standalone Upcoming Events section on dashboard mobile or desktop.
3. Missing or stale event records must never block non-event booking operations.

## Now
1. Ingest UW Badgers ICS feed.
2. Normalize records into Event model for operational use.
3. Support sport filtering for checkout selection.
4. Persist booking linkage fields (`eventId`, `sportCode`).

## Next
1. Reliability hardening for sync retries and stale-data visibility.
2. Better normalization for opponent and venue fields.
3. Fallback behavior for partial or malformed event records.

## Later
1. Multi-source event ingestion, if required.
2. Event quality scoring for operator confidence.

## Acceptance Criteria
1. Event picker shows relevant upcoming events by sport.
2. Event-linked booking stores and displays event context reliably.
3. Sync pipeline is idempotent and observable.
4. Missing fields degrade gracefully without blocking checkout creation.

## Edge Cases
- Event cancellations or updates in source feed.
- Duplicate events caused by source UID changes.
- Missing home or away indicators.
- Delayed source feed availability.

## Dependencies
- External ICS source availability.
- Booking creation flow.
- Venue mapping policy.
- Mobile and dashboard behavior contracts from `AREA_MOBILE.md` and `AREA_DASHBOARD.md`.

## Out of Scope (Current Window)
- Deep scheduling analytics.
- Manual event authoring UI beyond current needs.

## Developer Brief (No Code)
1. Build idempotent event ingest and normalization pipeline.
2. Define strict fallback behavior for incomplete source events.
3. Expose optimized query surface for checkout event picker.
4. Add monitoring for sync failures and stale imports.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-02: Added explicit dashboard-scope boundary and mobile/dashboard dependency alignment.
