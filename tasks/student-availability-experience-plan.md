# Student Availability Experience Plan - 2026-08-21

## Goal

- Make student availability easy to understand and quick to enter on web and iOS.
- Make the common case — recurring class times when the student cannot work — the clearest path.
- Support one-time exceptions as a single date or inclusive date range, including all-day time away.
- Preserve advisory availability semantics and approved-time-off blocking rules.

## Route

- Owner area: `AREA_SHIFTS`
- Secondary areas: `AREA_USERS`, `AREA_MOBILE`
- Ledger: `tasks/todo.md`
- Existing references: `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`, `tasks/student-availability-conflicts-plan.md`, `tasks/ios-schedule-availability-trade-redesign-plan.md`

## Source Checks

- `StudentAvailabilityBlock` currently stores one ad hoc `date` and required local `startsAt`/`endsAt`; there is no range or all-day representation.
- The web profile editor already supports weekly class signals, semester bounds, one-time conflicts, preferences, and time-off review, but presents them in one dense generic form.
- Native `AvailabilityView` already has a tappable weekday canvas and edit sheet, but one-time entry is single-date only and does not send semester bounds.
- Availability conflict evaluation is centralized in `src/lib/student-availability.ts`; new dated-range semantics must be implemented there so assignment, Open Work, and Trade Board stay aligned.
- The API returns Prisma records under `{ data }`; new iOS fields must remain optional for rollout skew.
- The current checkout contains unrelated dirty work; only availability source, tests, migration, docs, and this plan are in scope.

## Stop Conditions

- Stop if current API response or Prisma migration state contradicts the additive range/all-day contract.
- Stop if range semantics would require changing approved-time-off, assignment, pickup, trade, or call-window policy.
- Stop before live database writes if the configured migration/deployment environment is not explicitly approved or cannot apply the additive migration safely.
- Record browser, simulator, signing, or authenticated runtime blockers instead of treating source/build proof as acceptance.

## Slices

- [x] Slice 1: Add additive `dateEndsOn` and `allDay` storage, validation, audit shape, API response, and centralized conflict evaluation.
- [x] Slice 2: Rework the web Availability tab around a clear weekly class path and one-time date/range/all-day exception entry while retaining existing preference/time-off controls.
- [x] Slice 3: Bring native My Availability to the same range/all-day/term contract with native-first controls and rollout-tolerant decoding.
- [x] Slice 4: Add focused route/helper/source-contract coverage and run web/native verification gates.
- [x] Slice 5: Sync area docs, risks, task ledger, and review evidence.

## Verification

- [x] Focused availability route and conflict tests, including inclusive ranges, all-day overlap, legacy single-date rows, and validation.
- [x] Focused web/iOS source-contract tests.
- [x] `npx prisma generate`
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps` (passes; reports one unrelated unregistered `ScoreboardView.swift` from the existing dirty checkout)
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Affected iOS target build using the documented iPhone 16 Pro simulator, pinned to the available iOS 26.5 runtime.
- [ ] Authenticated browser smoke for the web profile Availability tab, or a precise runtime blocker.
- [ ] Native runtime inspection for My Availability when the documented simulator/runtime is available, or a precise blocker.

## Review

- Shipped: Local web/iOS UX and additive API/schema implementation; weekly class-first entry, one-off inclusive ranges, all-day time away, optional term bounds, and legacy-row compatibility.
- Verified: 76 focused tests; Prisma generate/validate; migration-prefix check; TypeScript; lint with one unrelated existing warning; codemap/docs; diff check; `npm run build:app`; iOS drift/project checks; pinned iPhone 16 Pro iOS 26.5 Xcode build.
- Deferred: Applying migration `0128_student_availability_date_ranges`, deployment, authenticated web smoke, and authenticated in-app visual inspection.
- Blocked: The unqualified iPhone 16 Pro destination requested the unavailable latest runtime; the available iPhone 16 Pro is iOS 26.5 and the pinned build passed. Authenticated browser/runtime proof was not available in this checkout.
- Proof artifacts: `/private/tmp/wisconsin-availability-build-cached`; source-contract and focused route/helper Vitest output; local build output.
- Next slice or stop: Stop at the local implementation boundary until migration/deployment authority and authenticated browser/native runtime proof are available.
