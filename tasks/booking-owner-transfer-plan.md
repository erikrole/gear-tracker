# Booking Owner Transfer Plan

Date: 2026-07-09

Goal: let staff/admin and student owners transfer an active booking's requester/owner to another active visible user without changing creator provenance, custody history, equipment allocation, or kiosk boundaries. Also let editable reservations link, change, or clear scheduled-event context after creation using the existing multi-event contract.

## Source Checks

- [x] Confirm schema already has `Booking.requesterUserId`, `Booking.createdBy`, and requester/creator relations.
- [x] Confirm shared booking details use server-computed `allowedActions`.
- [x] Confirm `/api/users` defaults to active visible users for picker targets.
- [x] Confirm docs treat creator and assigned owner as distinct ownership signals.

## Slice

- [x] Add `transfer-owner` to booking action policy for active booking states.
- [x] Add `POST /api/bookings/[id]/transfer-owner` with the same optimistic-lock contract as booking edit and extend.
- [x] Add a lifecycle service that validates the target user, updates `requesterUserId`, and writes a transaction-scoped `owner_transferred` audit entry.
- [x] Add a shared transfer-owner dialog to the booking detail page and detail sheet.
- [x] Add focused route, policy, and service coverage.
- [x] Sync reservations, checkouts, users, and gaps docs.
- [x] Run focused tests, typecheck, doc verification, whitespace check, app build, and browser smoke where feasible.
- [x] Correct policy and service enforcement so student requesters/creators can transfer their own active bookings.
- [x] Add `POST /api/bookings/[id]/events` for editable reservations with `If-Unmodified-Since`, `eventIds[]` cap 3, duplicate rejection, chronological primary event, and clear support.
- [x] Add a shared reservation event-link dialog to the booking detail page and detail sheet.
- [x] Add event-link service/route/UI coverage and rerun verification.

## Non-Goals

- No schema migration.
- No reassignment of `createdBy`.
- No kiosk custody bypass.
- No direct production data mutation without an explicit deploy/runtime step.
- No schema migration; reuse `Booking.eventId` plus `BookingEvent`.

## Review

- 2026-07-09: Follow-up correction shipped locally. `transfer-owner` now follows owner-or-staff access for active bookings, with the lifecycle service enforcing requester/creator or staff/admin before updating `requesterUserId`. Editable reservations can link, replace, or clear scheduled events after creation through `POST /api/bookings/[id]/events`; the route uses optimistic locking and edit permission, and the service sorts events chronologically, keeps `Booking.eventId` as primary, rewrites `BookingEvent`, and writes `events_updated` audit history. Shared full-page and sheet UI use `EditReservationEventsDialog`. Verification passed with focused route/service/policy tests, TypeScript, codemap/docs, whitespace, and app build gates.
- 2026-07-09: Initial implementation shipped locally with staff/admin-only transfer gating, `POST /api/bookings/[id]/transfer-owner`, transaction-scoped `requesterUserId` update, active visible target validation, and `owner_transferred` audit history. The follow-up correction above broadens transfer-owner to student requesters/creators on their own active bookings. Web detail page and detail sheet share `TransferOwnerDialog`; standard kiosk custody remains unchanged.
