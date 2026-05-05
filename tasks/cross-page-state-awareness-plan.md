# Cross-Page State Awareness Audit Plan

Date: 2026-05-05

## Goal

Audit the remaining Phase B+ cross-page state awareness work and clean up stale backlog entries before implementing anything new.

## Scope

- Verify whether booking detail date range grouping is already shipped.
- Verify event-context propagation from dashboard and event command paths into booking creation.
- Verify whether dashboard-to-detail navigation preserves useful state or has a concrete regression.
- Leave Game-Day Readiness Score deferred unless the audit finds a dependency that should move earlier.

## Checklist

- [x] Confirm current backlog entries against shipped code.
- [x] Reconcile stale Date range grouping entries in task docs.
- [x] Audit `eventId` propagation paths into booking creation.
- [x] Audit scroll preservation behavior on dashboard and booking detail paths.
- [x] Document findings and next recommended slice.

## Review

- Date range grouping was stale backlog: `BookingInfoTab` already renders connected start/end values with duration.
- Reservation conflict badges were also stale in the older checkout audit; active docs already had AC-8 verified.
- `eventId` propagation was already present from dashboard/event paths into the wizard.
- Missing-gear "Create checkout" links passed `requesterUserId`, but the intermediate booking list redirect and wizard ignored it. Fixed so the assigned user stays selected.
- Dashboard and booking list detail interactions preserve scroll by opening `BookingDetailsSheet` in-place rather than navigating away.
- Game-Day Readiness Score remains Phase C; no build work is recommended until operators ask for game-day command visibility.
