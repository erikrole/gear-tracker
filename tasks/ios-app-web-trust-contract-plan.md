# Native App and Web Trust Contract Plan - 2026-08-09

## Goal
- Make native booking and item mutations reflect the same authoritative state and permissions as web, preserve all linked event context, and prepare a uniquely versioned Build 24 source candidate.

## Route
- Owner area: Mobile Operations
- Secondary areas: Reservations, Items, Users, and Events
- Ledger: this bounded active plan
- Existing plan/archive references: `tasks/ios-booking-extend-concurrency-fix-plan.md`, `tasks/archive/completed-2026-07/booking-api-hardening-plan.md`, and `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`

## Source Checks
- Booking detail mutations return enriched `data: Booking` responses with `allowedActions`; native edit and cancel currently discard them.
- The combined booking list does not currently attach `allowedActions`, while native list and detail screens reproduce server policy locally.
- Asset PATCH distinguishes omitted fields from explicit `null` or empty text; native optional encoding currently omits fields a user cleared.
- Booking detail returns an ordered `events` array in addition to the legacy primary `event`; native decodes only the legacy field.
- The documented TestFlight build is 23 and current source still declares build 23 even though later native and Schedule work is not in that installed binary.
- The domain-cutover source test still expects the retired web password-recovery URL instead of the native recovery view.

## Stop Conditions
- Stop if a booking mutation no longer returns an enriched booking envelope, if list rows cannot compute `allowedActions` without additional database queries, or if the asset PATCH response does not include the fields the native edit surface changes.
- Stop rather than weakening optimistic concurrency or replacing server action policy with another native policy copy.
- Stop at source/build readiness if authenticated runtime credentials, App Store Connect authorization, or release authorization are unavailable.

## Slices
- [x] Slice 1: Return and install authoritative booking edit/cancel responses and require a visible edit snapshot.
- [x] Slice 2: Add server-authoritative booking actions to list payloads and consume them tolerantly in native list/detail surfaces.
- [x] Slice 3: Encode asset clears explicitly, decode the returned changed fields, and install them without a fallible post-save refresh.
- [x] Slice 4: Decode and render every linked event with legacy single-event fallback.
- [x] Slice 5: Update stale source-contract coverage, add regressions for each repaired mismatch, and set the app plus Live Activity source build to 24.
- [x] Slice 6: Sync area documentation and close with native, API, TypeScript, build, and docs evidence.

## Verification
- [x] Focused Vitest route and native source-contract tests
- [ ] `npx tsc --noEmit --pretty false` - blocked by unrelated stale `.next/types/app/scratch-accountability` imports and existing nullability errors in `tests/schedule-publication.test.ts:733,743`.
- [ ] `npm run lint` - blocked by two existing `@typescript-eslint/no-this-alias` errors in `.tmp/call-time-sync-bundle.mjs`.
- [x] `npm run build:app`
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:xcode:verify`
- [x] `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build`
- [ ] `npm run codemap` before `npm run verify:docs` if codemap-owned inputs change - intentionally skipped because four codemap outputs already contain unrelated dirty work.
- [ ] `npm run verify:docs` - blocked by pre-existing drift in `architecture.md`, `backend.md`, `frontend.md`, and `areas.md` codemaps.
- [x] `git diff --check`

## Review
- Shipped: Source-ready Build 24 candidate with authoritative booking mutations/actions, explicit item clears, complete linked-event detail, and current native auth guardrails.
- Verified: 97 focused route/native tests and all 422 iOS source-contract tests pass; route/test lint, `build:app`, iOS project/drift/gap checks, the exact iPhone 16 Pro build, XCTest, and generic-device build pass. A native XCTest now proves current and legacy Booking payload decoding.
- Deferred: Authenticated mutation walkthrough against a deployed server, installed-binary visual proof, archive/export, TestFlight upload, and distribution.
- Blocked: Repository-wide TypeScript, lint, and docs gates are blocked by unrelated existing generated artifacts, Schedule fixtures, `.tmp` code, and dirty codemaps listed above.
- Proof artifacts: Command output from this execution; no production mutation, deployment, upload, or distribution occurred.
- Next slice or stop: Stop at the verified source candidate. Use the normal native shipping workflow when deployment and TestFlight distribution are explicitly authorized.
