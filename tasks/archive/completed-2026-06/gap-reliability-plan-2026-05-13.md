# Gap Reliability Plan

Date: 2026-05-13

## Scope

Close the remaining high-value operational gaps in order:

1. GAP-58: kiosk dashboard partial-failure resilience.
2. GAP-54: unscheduled `archive-shifts` cron route cleanup.
3. GAP-33: pending-pickup auto-expiry.

## Audit Notes

- `AREA_KIOSK.md` defines the iOS kiosk idle screen as dependent on `/api/kiosk/dashboard`, so that route must degrade gracefully instead of taking the screen down.
- `AREA_SHIFTS.md` and `morning-refresh` already treat shift-group archiving as part of the scheduled morning refresh. The standalone `archive-shifts` route is duplicate maintenance surface.
- `AREA_CHECKOUTS.md` defines `PENDING_PICKUP` as held custody before pickup. Expiring stale rows must release serialized allocations, restore held bulk stock, cancel scan sessions, and leave audit evidence.
- `prisma/schema.prisma` already has the needed models and fields: `Booking.status`, `Booking.startsAt`, `AssetAllocation.active`, `BulkStockMovement.reason`, numbered bulk unit allocations, and nullable audit actors for system actions.

## Slices

- [x] Kiosk dashboard: replace `Promise.all` with `Promise.allSettled`, default failed stats/events/checkouts independently, and return `partialFailures`.
- [x] Cron cleanup: delete `src/app/api/cron/archive-shifts/route.ts`, keep `morning-refresh` as the single scheduled archive path, and update docs/gaps.
- [x] Pending pickup expiry: add a shared service that cancels stale `PENDING_PICKUP` checkouts older than 48 hours after `startsAt`, wire it into morning-refresh, and document the policy.
- [x] Verification: focused route/service tests, TypeScript, migration checks, full build, and doc sync.

## Review

- Kiosk dashboard now returns partial idle-screen data with `partialFailures` when stats, events, or checkout reads fail independently.
- `morning-refresh` is the single scheduled maintenance job for calendar sync, shift generation, shift archiving, stale trade expiry, and pending-pickup expiry.
- Stale pending-pickup expiry uses per-booking Serializable transactions, restores held bulk stock, releases scanned numbered units, cancels open scan sessions, and writes a system audit entry.
