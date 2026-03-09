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

## Now (Implemented)
1. Ingest UW Badgers ICS feed — idempotent upsert by `external_id` (ICS UID). Source URL: `webcal://uwbadgers.com/api/v2/Calendar/subscribe?type=ics&locationIndicator=H`.
2. Normalize records into CalendarEvent model for operational use.
3. Support sport filtering for checkout selection (30-day event picker window via `resolveEventDefaults`).
4. Persist booking linkage fields (`eventId`, `sportCode`).
5. Events API defaults to `startsAt >= now()` when no `startDate` param supplied — avoids stale-looking event list.
6. Calendar source deletion: `DELETE /api/calendar-sources/[id]` — nullifies `eventId` on linked bookings (SET NULL before cascade), then deletes source and its events.
7. Calendar sync hardening: per-event error isolation so one malformed ICS event cannot crash the entire source sync.
8. Batch DB operations in sync pipeline to stay within Cloudflare Worker subrequest limits.
9. Production sync diagnostics: structured logging for missing event counts and sync failure details.

## Next
1. Calendar source enable/disable toggle — pause a feed without deleting its configuration.
2. Sync health admin UI — show last synced time, event count, last error per source on Events page.
3. Better normalization for opponent and venue fields.
4. Stale-data visibility: surface last sync time on source management table.

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
1. Core ingest pipeline is implemented — do not rewrite without a Decision record.
2. Next work: calendar source enable/disable toggle (`CalendarSource.enabled` flag, sync job skips disabled sources).
3. Next work: sync health UI — surface `lastFetchedAt` and `lastError` from CalendarSource on the Events admin view.
4. Fallback behavior for incomplete events is implemented — treat event context as non-blocking metadata on all booking flows.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-02: Added explicit dashboard-scope boundary and mobile/dashboard dependency alignment.
- 2026-03-09: Expanded "Now" to reflect shipped implementation: source deletion, upcoming-default filter, sync hardening, batch DB ops, production diagnostics. Added enable/disable and sync health UI to Next.
