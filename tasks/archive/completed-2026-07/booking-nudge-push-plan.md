# Booking Nudge Push Plan - 2026-07-21

## Goal
- Make the existing staff/admin overdue-checkout Nudge action create its durable in-app notification and attempt an iOS push to the checkout requester.

## Route
- Owner area: Notifications
- Secondary area: Checkouts
- Ledger: this plan
- Existing plan/archive references: `tasks/audit-bookings-web.md`, `tasks/smart-notifications-plan.md`

## Source Checks
- `POST /api/bookings/[id]/nudge` already authenticates, rate-limits, requires the staff/admin `nudge` action on an `OPEN` checkout, rejects non-overdue checkouts, creates the inbox row, and writes the audit entry.
- `sendPushToUser` already owns APNs tokens, push/category preferences, revoked-token cleanup, and best-effort error handling.
- `deferPush` keeps request-path APNs delivery alive after the response and is the established producer pattern.
- Booking push payloads route natively through `bookingId`; manual overdue nudges belong to the `checkoutOverdue` preference category.
- No schema, response-envelope, permission, or native-client change is required.

## Stop Conditions
- Stop if the nudge route does not produce an in-app row before push dispatch.
- Stop if the existing APNs helper cannot preserve best-effort delivery or booking tap-through.
- Stop if the implementation would bypass the requester's push or checkout-overdue preferences.

## Slices
- [x] Slice 1: Dispatch a deferred `checkoutOverdue` push after the in-app nudge row is created.
- [x] Slice 2: Add focused route coverage for inbox persistence, push payload/category, ordering, and audit behavior.
- [x] Slice 3: Sync Notifications and Checkouts documentation and close the plan with verification evidence.

## Verification
- [x] `npx vitest run tests/booking-nudge-route.test.ts tests/notifications-ownership-ui-contract.test.ts`
- [x] Focused ESLint for touched TypeScript and test files
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] Authenticated browser smoke, or record why unavailable

## Review
- Shipped: Staff/admin overdue checkout nudges now persist the inbox row, then attempt a preference-aware deferred APNs push to the requester with booking tap-through.
- Verified: 7 focused tests, focused ESLint, TypeScript, codemap/docs verification, whitespace, and `build:app` pass. The Vercel performance review found no route-level N+1, blocking external await, accidental Edge runtime, or unbounded query.
- Deferred: A transport-wide APNs durability follow-up may bound the shared primary/fallback send sequence beneath the deployment execution deadline; this is pre-existing across all request-path push producers and is not expanded into this slice.
- Blocked: Authenticated browser delivery proof was not run because no authenticated runtime session or safe overdue smoke checkout was available, and the task did not authorize a production notification mutation.
- Proof artifacts: `tests/booking-nudge-route.test.ts`; `docs/AREA_NOTIFICATIONS.md`; `docs/AREA_CHECKOUTS.md`.
- Next slice or stop: Stop. Use the existing physical-device test notification and a real overdue checkout nudge during an authorized production smoke to prove external APNs delivery.
