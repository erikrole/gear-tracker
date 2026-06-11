# Plan 037: Share dashboard counts with stats transient lanes

## Status
- Status: TODO
- Priority: P1
- Effort: M
- Owner: unassigned
- Created: 2026-06-11
- Source audit: `/improve dashboard` at commit `8d445512`

## Problem
`/api/dashboard` returns authoritative totals for `pendingPickups` and `staleReservations`, but `/api/dashboard/stats` does not. `useDashboardData` overlays the 60-second stats response onto the 5-minute full dashboard payload, so checkout and reservation totals stay fresh while awaiting-pickup and stale-reservation lane counts can remain stale until the full payload refetches.

The same count query shape now exists in two routes, and the drift has already happened once.

## Benefit
Operators get current transient-lane counts without paying for the full dashboard payload every minute. The shared count helper also reduces future mismatches between the stat strip, dashboard lanes, iOS Home consumers, and maintenance queues.

## Evidence
- Full dashboard count SQL includes `pending_pickup` and `stale_reservations`: `src/app/api/dashboard/route.ts:185-189`.
- Full dashboard response includes `pendingPickups.total` and `staleReservations.total`: `src/app/api/dashboard/route.ts:779-785`.
- Lightweight stats SQL returns checkout and reservation totals, but not pending pickup or stale reservation totals: `src/app/api/dashboard/stats/route.ts:36-63`.
- `DashboardStats` lacks transient-lane count fields: `src/app/(app)/dashboard-types.ts:3-18`.
- `useDashboardData` overlays stats totals into `myCheckouts`, `teamCheckouts`, and `teamReservations`, but not `pendingPickups` or `staleReservations`: `src/hooks/use-dashboard-data.ts:108-132`.

## Scope
1. Extract a shared dashboard count reader, preferably under `src/lib/services/`, that accepts `user.id`, `now`, and the 7-day reservation window inputs needed by both routes.
2. Return all existing stats fields plus:
   - `pendingPickupTotal`
   - `staleReservationTotal`
3. Update `/api/dashboard` to consume the helper for its count fields without changing response shape.
4. Update `/api/dashboard/stats` to consume the helper and return the two new transient-lane totals.
5. Extend `DashboardStats` with the two new fields.
6. Update `useDashboardData` to overlay:
   - `pendingPickups.total`
   - `staleReservations.total`
7. Keep row item arrays owned by the full dashboard payload. The stats endpoint must not fetch row details.

## Out Of Scope
- Changing row caps, sorting, filters, or lane visibility.
- Adding new dashboard cards.
- Changing iOS Home presentation.

## Implementation Notes
- Keep the SQL as one bounded aggregate query. Do not replace it with multiple Prisma counts unless benchmarked and justified.
- Preserve `Promise.allSettled` fallback semantics in both routes.
- Be careful with the full dashboard's current `WHERE` clause: it includes all rows needed for checkout, reservation-window, stale reservation, and pending-pickup counts.
- Use numeric output at API boundaries. BigInt values must be converted before JSON.

## Verification
- Add or extend a focused route/source-contract test proving `/api/dashboard/stats` returns `pendingPickupTotal` and `staleReservationTotal`.
- Add a hook/source-contract test proving `useDashboardData` overlays those totals into `pendingPickups.total` and `staleReservations.total`.
- Run:
  - `npx vitest run tests/dashboard-pending-pickup-link.test.ts`
  - the new or updated dashboard stats test
  - `npx tsc --noEmit`
  - `git diff --check`

## Docs
- Update `docs/AREA_DASHBOARD.md` changelog with the stats count freshness behavior.
- If no gap is opened or closed, add a short "no new gap" note only if the project docs require it for the shipped slice.

## STOP Conditions
- Stop if the helper would need to change dashboard count semantics beyond moving existing SQL.
- Stop if stats endpoint changes would require fetching row-level booking data.
