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
8. Batch DB operations in sync pipeline for performance (avoid N+1 query patterns).
9. Production sync diagnostics: structured logging for missing event counts and sync failure details.

## Now (Implemented — cont.)
10. **Unified Schedule page** — merged `/events` + old `/schedule` into single `/schedule` page. List view with date-grouped events + coverage badges. Calendar view with month grid + coverage indicator dots. Unified filters (sport, area, coverage, past events). Trade Board as tab. ShiftDetailPanel integration. Old `/events` page removed (detail page `/events/[id]` unchanged). Sidebar shows single "Schedule" entry.
11. **Venue Mappings moved to Settings** — `/settings/venue-mappings` page with add/delete/list. Removed from events page.
12. Calendar Sources management remains at `/settings/calendar-sources` (unchanged).

## Next
1. Better normalization for opponent and venue fields.
2. V2 enhancements: Day Drawer, Trade Board as sheet, inline coverage expansion, "My Shifts" filter — see `tasks/calendar-roadmap.md`.

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
- 2026-03-23: Unified Schedule page shipped (V1). Events + Schedule merged into `/schedule`. Old `/events` list page removed; `/events/[id]` detail unchanged. Venue Mappings moved to `/settings/venue-mappings`. Calendar Sources unchanged at `/settings/calendar-sources`.
- 2026-03-25: Event detail page hardened (4-pass). Design system: inline styles → Tailwind, `.breadcrumb` → shadcn Breadcrumb, `.data-table` → shadcn Table, `<a>` → `<Link>`. Data flow: AbortController on all fetches, 401 redirect on every endpoint, unmount cleanup. Resilience: error differentiation (network vs server), retry button, high-fidelity skeleton. UX: manual refresh with "Updated X ago" tooltip, shift panel onUpdated also refreshes command center.
