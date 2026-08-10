# Native Booking Extend Concurrency Fix Plan - 2026-08-09

## Goal
- Restore native booking extension for eligible users while preserving the server's stale-snapshot protection and installing the authoritative returned booking after success.

## Route
- Owner area: Mobile Operations
- Secondary areas: Reservations and Checkouts
- Ledger: this bounded active plan
- Existing reference: `tasks/archive/completed-2026-08-07/booking-api-hardening-plan.md`

## Source Checks
- `POST /api/bookings/[id]/extend` requires `If-Unmodified-Since`, returns HTTP 428 when it is absent, and returns an enriched booking envelope after success.
- Native `Booking` already decodes nullable `updatedAt`.
- Native `APIClient.extendBooking` currently sends no snapshot header and discards the response body.
- `ExtendBookingSheet` is opened from Booking Detail and the Bookings list, both of which already hold the source `Booking` snapshot.
- No schema, migration, permission, lifecycle, or custody change is required.

## Stop Conditions
- Stop if the extend route no longer returns `data: Booking`, if `updatedAt` is absent from a freshly loaded booking, or if the required iPhone 16 Pro simulator destination is unavailable.
- Stop rather than weakening the endpoint's HTTP 428 or stale-write behavior.

## Slices
- [x] Slice 1: Pass the visible booking snapshot into the extend sheet, send `If-Unmodified-Since`, decode the authoritative booking, and install it in both native callers.
- [x] Slice 2: Add focused source-contract coverage for the header, response envelope, and caller wiring.
- [x] Slice 3: Sync the Mobile area changelog and close this plan with verification evidence.

## Verification
- [x] `npx vitest run tests/booking-extend-route-contract.test.ts tests/ios-booking-extend-concurrency-contract.test.ts`
- [ ] `npx tsc --noEmit --pretty false` - blocked by unrelated stale `.next/types/app/scratch-accountability` imports and existing nullability errors in `tests/schedule-publication.test.ts:733,743`.
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:xcode:verify`
- [x] `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build`
- [ ] `npm run verify:docs` - blocked by pre-existing drift in dirty `docs/CODEMAPS/architecture.md` and `docs/CODEMAPS/backend.md`; regeneration was intentionally skipped to preserve unrelated work.
- [x] `git diff --check`

## Review
- Shipped: The native Extend flow sends the booking snapshot header and installs the enriched booking returned by the server in both caller surfaces.
- Verified: All 36 focused and adjacent native booking tests pass; the new test lints cleanly; iOS project consistency, drift, gap audit, exact iPhone 16 Pro build, and the full `ios:xcode:verify` build/XCTest/generic-device gate pass; `git diff --check` passes.
- Deferred: Authenticated runtime extension against a deployed server and app distribution.
- Blocked: Repository-wide TypeScript proof is blocked by unrelated pre-existing generated-type and Schedule fixture errors. Docs verification is blocked by unrelated pre-existing codemap drift in two already-dirty generated docs.
- Proof artifacts: Command output from this execution; no authenticated mutation or production data was created.
- Next slice or stop: Stop after docs and whitespace verification. Release through the normal native shipping workflow when authorized.
